import os
import smtplib
import ssl
import json
from email.message import EmailMessage
from bs4 import BeautifulSoup


class SendEmail:
    """
        Email module
        Creates and sends emails
        Used by ProcessRawFile
    """
    def __init__(self, limit_data, db, fs):

        self.context = ssl.create_default_context()
        self.email_data = limit_data
        self.db = db
        self.fs = fs
        self.date_time = self.get_date_time()
        self.subject = self.create_subject()
        self.contacts_file = os.path.join("contacts", "contacts-" + self.email_data['metadata']['experiment'].lower() + ".csv")
        self.email_file = os.path.join("contacts", "email-server-" + self.email_data['metadata']['experiment'].lower() + ".json")
        self.contacts_file_path = os.path.join(self.fs.config_dir, self.contacts_file)
        self.email_file_path = os.path.join(self.fs.config_dir, self.email_file)
        self.set_sender()
        self.send_message()
        
    def set_sender(self):
        # read in db details
        with open(self.email_file_path) as f:
            email_details = json.load(f)
            
        self.port = email_details["Port"]
        self.smtp_server = email_details["SMTP Server"]
        self.sender_email = email_details["Email Sender"]
        self.password = email_details["Email Password"]

    def get_date_time(self):
        sql = "SELECT date_time FROM qc_run WHERE file_name = " + "'" + self.email_data['metadata']['filename'] + "'"
        self.db.cursor.execute(sql)
        dt = self.db.cursor.fetchone()[0]
        return dt

    def send_message(self):

        with smtplib.SMTP_SSL(self.smtp_server, self.port, context=self.context) as server:
            server.login(self.sender_email, self.password)
            with open(self.contacts_file_path) as file:
                addresses = file.readlines()
            addresses = [address.split("|") for address in addresses]

            for email in addresses:
                try:
                    msg = EmailMessage()
                    msg.set_content(self.create_body(email[1].strip()))
                    msg.add_alternative(self.create_html_body(email[1].strip()), subtype='html')
                    msg['Subject'] = self.subject
                    msg['From'] = self.sender_email
                    msg['To'] = email[0].strip()
                    server.send_message(msg)
                except Exception as e:
                    print(email[0])
                    print(e)

    def create_subject(self):
        return "WARNING:" + self.email_data['metadata']['experiment'].upper() + " QC for " + \
               self.email_data['metadata']['machine']

    def create_body(self, name):
        intro = "Hi " + name + ",\n\n" + \
            "This is the automated " + self.email_data['metadata']['experiment'] + " QC " + \
            "for " + self.email_data['metadata']['machine'] + ".\n\n" + \
            "Insufficient counts were encounterd on \n" + str(self.date_time) + "\n\n" + \
            "For the following metrics:\n\n"

        message = ""
        for metric in self.email_data:
            if metric != 'metadata':
                # set display metric names
                temp = metric
                if metric == 'tf':
                    metric = 'TAILING FACTOR'
                elif metric == 'af':
                    metric = 'ASYMMETRY FACTOR'
                elif metric == 'fwhm':
                    metric = 'FULL WIDTH HALF MAXIMUM'
                elif metric == 'rt':
                    metric = 'RETENTION TIME'
                message += metric.upper() + "\n"
                metric = temp
                for comp in self.email_data[metric]:
                    message += comp + "\t" + str(self.email_data[metric][comp]) + "\n"
            message += "\n"

        return intro + message

    def create_html_body(self, name):
        with open(os.path.join(self.fs.config_dir, "email_template.html")) as fp:
            self.soup = BeautifulSoup(fp, features="html.parser")

        # fill in intro
        tag_name = self.soup.find(id="name")
        tag_name.string = name
        tag_exp = self.soup.find(id="exp")
        tag_exp.string = self.email_data['metadata']['experiment'].upper()
        tag_mach = self.soup.find(id="machine")
        tag_mach.string = self.email_data['metadata']['machine'].upper()
        tag_dt = self.soup.find(id="datetime")
        tag_dt.string = str(self.date_time.strftime("%A, %d %B %Y %I:%M%p"))

        # add tables
        tag_tables = self.soup.find(id="tables")
        for metric in self.email_data:
            if metric != 'metadata':
                # set display metric names
                temp = metric
                if metric == 'tf':
                    metric = 'TAILING FACTOR'
                elif metric == 'af':
                    metric = 'ASYMMETRY FACTOR'
                elif metric == 'fwhm':
                    metric = 'FULL WIDTH HALF MAXIMUM'
                elif metric == 'rt':
                    metric = 'RETENTION TIME'

                # table header
                new_tag = self.soup.new_tag("h3")
                bold_tag = self.soup.new_tag("strong")
                bold_tag.string = metric.upper()
                new_tag.append(bold_tag)
                tag_tables.append(new_tag)

                metric = temp

                # table content
                table_tag = self.soup.new_tag("table")
                table_tag['style'] = "background-color:blanchedalmond"
                for comp in self.email_data[metric]:
                    row_tag = self.soup.new_tag("tr")
                    comp_tag = self.soup.new_tag("td")
                    i_tag = self.soup.new_tag("strong")
                    i_tag.string = comp
                    comp_tag.append(i_tag)
                    row_tag.append(comp_tag)
                    if self.email_data[metric][comp][0] != "NO VALUE":
                        for entry in range(len(self.email_data[metric][comp])):
                            col_tag = self.soup.new_tag("td")
                            col_tag.string = self.email_data[metric][comp][entry]
                            row_tag.append(col_tag)
                        table_tag.append(row_tag)
                    else:
                        col_tag = self.soup.new_tag("td")
                        col_tag['colspan'] = 2
                        col_tag.string = "NO VALUE"
                        row_tag.append(col_tag)
                        table_tag.append(row_tag)
                tag_tables.append(table_tag)
                #print(self.email_data)

        #print(self.soup.prettify())
        return str(self.soup)

