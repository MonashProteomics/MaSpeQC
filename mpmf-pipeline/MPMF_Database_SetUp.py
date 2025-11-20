# MaSpeQC - Quality control software for LC-MS/MS instrumentation
#
# Copyright (C) 2018-2025  Simon Caven
# Copyright (C) 2020-2025  Monash University
# Copyright (C) 2022-2025  University of Applied Sciences Mittweida
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

import json
import logging
import os
import sys

from MPMF_File_System import FileSystem

# LOGGING
# create module logger 
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# create file handler which logs even debug messages
fh = logging.FileHandler('database.log')
fh.setLevel(logging.DEBUG)

# create console handler with a higher log level
ch = logging.StreamHandler()
ch.setLevel(logging.INFO)

# create formatter and add it to the handlers
formatter = logging.Formatter('%(levelname)s - %(name)s - %(asctime)s - %(message)s', datefmt='%m/%d/%Y %I:%M:%S %p')
fh.setFormatter(formatter)
ch.setFormatter(formatter)

# add the handlers to the logger
logger.addHandler(fh)
logger.addHandler(ch)

try:
    import pymysql as MySQLdb
    MySQLdb.install_as_MySQLdb()
except ImportError as e:
    logger.exception(e)
    sys.exit(1)


class MPMFDBSetUp:
    """
        Database access module
        When run as a script sets up a DB based on config files
        Create a database in MYSQL before running
        Refer to QC ER Diagram for design
    """

    # CONSTRUCTOR connects to database as user with pword
    def __init__(self, user, pword, database, filesystem, portnumber):
        self.username = user
        self.password = pword
        self.database = database
        self.fs = filesystem
        self.port = portnumber
        self.connected = False
        try:
            self.db = MySQLdb.connect(host="localhost", user=self.username, password=self.password, db=self.database, port=self.port)
            self.cursor = self.db.cursor()
            self.connected = True
            logger.info("Database Connection Made")
        except Exception as e:
            logger.exception(e)
            sys.exit(1)

    def set_up(self):
        self.drop_all_tables()
        self.create_all_tables()
        self.insert_all()
        self.cursor.close()


    # CREATE TABLES
    def create_all_tables(self):
        self.create_table_experiment()
        self.create_table_machine()
        self.create_table_digest()
        self.create_table_sample_component()
        self.create_table_metric()
        self.create_table_qc_run()
        self.create_table_measurement()
        self.create_table_stat()
        self.create_table_chromatogram()
        self.create_table_pressure_profile()

    def create_table_sample_component(self):
        sql = "CREATE TABLE IF NOT EXISTS sample_component (" \
        "component_id INT AUTO_INCREMENT NOT NULL," \
        "component_name TINYTEXT NOT NULL," \
        "component_description TEXT," \
        "component_mode CHAR(1)," \
        "exp_mass_charge DECIMAL(8, 5) NOT NULL," \
        "exp_rt DECIMAL(5, 2) NOT NULL," \
        "digest_id INT NOT NULL, " \
        "PRIMARY KEY(component_id)," \
        "FOREIGN KEY (digest_id) REFERENCES digest(digest_id)) "

        try:
            self.cursor.execute(sql)
        except Exception as e:
            logger.exception(e)

    def create_table_digest(self):

        sql = "CREATE TABLE IF NOT EXISTS digest(" \
              "digest_id INT NOT NULL," \
              "machine_id INT NOT NULL," \
              "experiment_id INT NOT NULL," \
              "digest_type VARCHAR(10)," \
              "PRIMARY KEY(digest_id, machine_id, experiment_id)," \
              "FOREIGN KEY (experiment_id) REFERENCES experiment(experiment_id)," \
              "FOREIGN KEY (machine_id) REFERENCES machine(machine_id))"

        try:
            self.cursor.execute(sql)
        except Exception as e:
            logger.exception(e)

    def create_table_qc_run(self):
        sql = "CREATE TABLE IF NOT EXISTS qc_run(" \
        "run_id INT AUTO_INCREMENT NOT NULL," \
        "file_name TINYTEXT NOT NULL," \
        "date_time DATETIME NOT NULL," \
        "machine_id INT NOT NULL," \
        "experiment_id INT NOT NULL,"\
        "completed VARCHAR(1) NOT NULL," \
        "summary JSON," \
        "PRIMARY KEY(run_id)," \
        "FOREIGN KEY (machine_id) REFERENCES machine(machine_id)," \
        "FOREIGN KEY (experiment_id) REFERENCES experiment(experiment_id))"

        try:
            self.cursor.execute(sql)
        except Exception as e:
            logger.exception(e)

    def create_table_metric(self):
        sql = "CREATE TABLE IF NOT EXISTS metric (" \
        "metric_id INT AUTO_INCREMENT NOT NULL," \
        "metric_name TINYTEXT," \
        "metric_description TEXT,"  \
        "display_order TINYINT," \
        "display_name TINYTEXT," \
        "use_metab VARCHAR(1) NOT NULL," \
        "use_prot VARCHAR(1) NOT NULL," \
        "metric_type TEXT NOT NULL," \
        "metric_info TEXT," \
        "PRIMARY KEY(metric_id))"

        try:
            self.cursor.execute(sql)
        except Exception as e:
            logger.exception(e)

    def create_table_measurement(self):
        # watch FLOAT for value for range, powers in area metric

        sql = "CREATE TABLE IF NOT EXISTS measurement (" \
            "metric_id INT NOT NULL," \
            "component_id INT NOT NULL," \
            "run_id INT NOT NULL," \
            "value DECIMAL(36, 18)," \
            "PRIMARY KEY(metric_id, component_id, run_id)," \
            "FOREIGN KEY (metric_id) REFERENCES metric(metric_id)," \
            "FOREIGN KEY (component_id) REFERENCES sample_component(component_id)," \
            "FOREIGN KEY (run_id) REFERENCES qc_run(run_id) ON DELETE CASCADE)"

        try:
            self.cursor.execute(sql)
        except Exception as e:
            logger.exception(e)

    def create_table_stat(self):

        sql = "CREATE TABLE IF NOT EXISTS stat (" \
              "metric_id INT NOT NULL," \
              "component_id INT NOT NULL," \
              "machine_id INT NOT NULL," \
              "count INT," \
              "mean DECIMAL(36, 18)," \
              "std DECIMAL(36, 18)," \
              "min DECIMAL(36, 18)," \
              "25_percent DECIMAL(36, 18)," \
              "50_percent DECIMAL(36, 18)," \
              "75_percent DECIMAL(36, 18)," \
              "max DECIMAL(36, 18)," \
              "PRIMARY KEY(metric_id, component_id, machine_id)," \
              "FOREIGN KEY (metric_id) REFERENCES metric(metric_id)," \
              "FOREIGN KEY (component_id) REFERENCES sample_component(component_id)," \
              "FOREIGN KEY (machine_id) REFERENCES machine(machine_id))"

        try:
            self.cursor.execute(sql)
        except Exception as e:
            logger.exception(e)

    def create_table_machine(self):

        sql = "CREATE TABLE IF NOT EXISTS machine (" \
              "machine_id INT AUTO_INCREMENT NOT NULL," \
              "machine_name TINYTEXT NOT NULL," \
              "machine_serial TEXT," \
              "machine_description TEXT," \
              "use_metab VARCHAR(1) NOT NULL," \
              "use_prot VARCHAR(1) NOT NULL," \
              "machine_type TEXT NOT NULL," \
              "PRIMARY KEY(machine_id))"

        try:
            self.cursor.execute(sql)
        except Exception as e:
            logger.exception(e)

    def create_table_experiment(self):
        sql = "CREATE TABLE IF NOT EXISTS experiment (" \
              "experiment_id INT AUTO_INCREMENT NOT NULL," \
              "experiment_type TEXT NOT NULL," \
              "PRIMARY KEY(experiment_id))"

        try:
            self.cursor.execute(sql)
        except Exception as e:
            logger.exception(e)

    def create_table_pressure_profile(self):
        sql = "CREATE TABLE IF NOT EXISTS pressure_profile (" \
              "profile_id INT AUTO_INCREMENT NOT NULL," \
              "pressure_data JSON NOT NULL," \
              "pump_type TEXT NOT NULL," \
              "run_id INT NOT NULL," \
              "PRIMARY KEY(profile_id)," \
              "FOREIGN KEY (run_id) REFERENCES qc_run(run_id) ON DELETE CASCADE)"

        try:
            self.cursor.execute(sql)
        except Exception as e:
            logger.exception(e)

    def create_table_chromatogram(self):
        sql = "CREATE TABLE IF NOT EXISTS chromatogram (" \
              "chromatogram_id INT AUTO_INCREMENT NOT NULL," \
              "chrom_data JSON NOT NULL," \
              "run_id INT NOT NULL," \
              "component_id INT NOT NULL," \
              "PRIMARY KEY(chromatogram_id)," \
              "FOREIGN KEY (component_id) REFERENCES sample_component(component_id)," \
              "FOREIGN KEY (run_id) REFERENCES qc_run(run_id) ON DELETE CASCADE)"


        try:
            self.cursor.execute(sql)
        except Exception as e:
            logger.exception(e)


    # DROP TABLES
    def drop_table(self, tablename):
        sql = "DROP TABLE IF EXISTS " + tablename

        try:
            self.cursor.execute(sql)
        except Exception as e:
            logger.exception(e)
        self.db.commit()

    def drop_all_tables(self):
        # order by constraints
        tables = ['measurement', 'stat', 'pressure_profile', 'chromatogram', 'qc_run',
                  'sample_component', 'metric', 'digest', 'machine', 'experiment']
        for table in tables:
            self.drop_table(table)

    # INSERTS
    def insert_all(self):
        self.insert_experiments()
        self.insert_mzmine_metrics()
        self.insert_morpheus_metrics()
        self.insert_thermo_metrics()
        self.insert_machines()
        self.insert_digests()
        self.insert_components()

    def insert_digests(self):

        # set default digest

        # get experiment type ids
        sql = "SELECT experiment_id FROM experiment where experiment_type = 'metabolomics'"
        try:
            self.cursor.execute(sql)
            metab_exp_id = self.cursor.fetchone()[0]
        except Exception as e:
            logger.exception(e)

        sql = "SELECT experiment_id FROM experiment where experiment_type = 'proteomics'"
        try:
            self.cursor.execute(sql)
            prot_exp_id = self.cursor.fetchone()[0]
        except Exception as e:
            logger.exception(e)

        # get all machines
        sql = "SELECT * FROM machine"
        try:
            self.cursor.execute(sql)
            machines = self.cursor.fetchall()
        except Exception as e:
            logger.exception(e)

        # HERE inserts, plus digest ID for insert components
        for machine in machines:
            # metab
            sql = "INSERT INTO DIGEST VALUES ('1', '" + str(machine[0]) + "', '" + str(metab_exp_id) + "',NULL)"
            try:
                self.cursor.execute(sql)
            except Exception as e:
                logger.exception(e)

            # prot
            sql = "INSERT INTO DIGEST VALUES ('2', '" + str(machine[0]) + "', '" + str(prot_exp_id) + "',NULL)"
            try:
                self.cursor.execute(sql)
            except Exception as e:
                logger.exception(e)

        self.db.commit()

    def insert_components(self):

        # insert hela default digest (proteomics)
        sql = "INSERT INTO sample_component(component_id, component_name, exp_mass_charge, exp_rt, digest_id) " \
              "VALUES (NULL,'Hela Digest','-1','-1','1')"

        try:
            self.cursor.execute(sql)
        except Exception as e:
            logger.exception(e)

        # insert metab default digest
        sql = "INSERT INTO sample_component(component_id, component_name, exp_mass_charge, exp_rt, digest_id) " \
              "VALUES (NULL,'Metab Digest','-1','-1','2')"

        try:
            self.cursor.execute(sql)
        except Exception as e:
            logger.exception(e)

        # insert neg metab components
        with open(os.path.join(self.fs.databases, "negative-db-Default.csv"), 'r') as infile:
            for line in infile:
                component = line.strip().split("|")
                if component[0] != 'mz':
                    sql = "INSERT INTO sample_component(component_id, component_name, component_mode, exp_mass_charge, exp_rt, digest_id) " \
                          "VALUES (NULL, " + "'" + component[2].strip() + "'," + "'N'," + "'" + component[0].strip() + "'," + "'" + component[1].strip() + "','" \
                           + "2')"

                    try:
                        self.cursor.execute(sql)
                    except Exception as e:
                        logger.exception(e)

            self.db.commit()

        # insert pos metab comoponents
        with open(os.path.join(self.fs.databases, "positive-db-Default.csv"), 'r') as infile:
            for line in infile:
                component = line.strip().split("|")
                if component[0] != 'mz':
                    sql = "INSERT INTO sample_component(component_id, component_name, component_mode, exp_mass_charge, exp_rt, digest_id) " \
                          "VALUES (NULL, " + "'" + component[2].strip() + "'," + "'P'," + "'" + component[0].strip() + "'," + "'" + component[1].strip() + "','" \
                           + "2')"

                    try:
                        self.cursor.execute(sql)
                    except Exception as e:
                        logger.exception(e)

            self.db.commit()

        # insert iRT peptides (proteomics components)
        with open(os.path.join(self.fs.databases, "iRT-Reference-Default.csv"), 'r') as infile:
            for line in infile:
                component = line.strip().split("|")
                if component[0] != 'mz':
                    sql = "INSERT INTO sample_component(component_id, component_name, exp_mass_charge, exp_rt, digest_id) " \
                          "VALUES (NULL, " + "'" + component[2].strip()  + "','" + component[0].strip() + "'," + "'" + component[1].strip() + "','" \
                           + "1')"

                    try:
                        self.cursor.execute(sql)
                    except Exception as e:
                        logger.exception(e)

            self.db.commit()

        self.db.commit()

    def insert_machines(self):
        # id, name, (serial), (description), venue, use_metab, use_prot

        # insert metabolomics machines
        if os.path.exists(os.path.join(self.fs.config_dir, 'metab-machines.txt')):
            with open(os.path.join(self.fs.config_dir, 'metab-machines.txt'), 'r') as infile:
                for line in infile:
                    machine = line.strip().split("|")

                    sql = "INSERT INTO machine(machine_id, machine_name, use_metab, use_prot, machine_type) " \
                          "VALUES (NULL, " + "'" + machine[0].strip() + \
                          "','" + "Y" + "','" + "N" + "','" + machine[1].strip() + "')"

                    try:
                        self.cursor.execute(sql)
                    except Exception as e:
                        logger.exception(e)

                self.db.commit()

        # insert proteomics machines
        if os.path.exists(os.path.join(self.fs.config_dir, 'prot-machines.txt')):
            with open(os.path.join(self.fs.config_dir, 'prot-machines.txt'), 'r') as infile:
                for line in infile:
                    machine = line.strip().split("|")

                    # check if machine exists
                    sql = "SELECT * FROM machine WHERE machine_name = '" + machine[0].strip() + "'"

                    try:
                        self.cursor.execute(sql)
                        check = self.cursor.fetchone()
                    except Exception as e:
                        logger.exception(e)

                    # update
                    if check:
                        sql = "UPDATE machine SET use_prot = 'Y' WHERE machine_name = '" + machine[0].strip() + "'"
                        try:
                            self.cursor.execute(sql)
                        except Exception as e:
                            logger.exception(e)
                    else: # insert
                        sql = "INSERT INTO machine(machine_id, machine_name, use_metab, use_prot, machine_type) " \
                              "VALUES (NULL, " + "'" + machine[0].strip() + \
                              "','" + "N" + "','" + "Y" + "','" + machine[1].strip() + "')"

                        try:
                            self.cursor.execute(sql)
                        except Exception as e:
                            logger.exception(e)

                self.db.commit()

    def insert_experiments(self):

        sql = "INSERT INTO experiment(experiment_id, experiment_type) " \
              "VALUES (NULL, " + "'proteomics')"
        try:
            self.cursor.execute(sql)
        except Exception as e:
            logger.exception(e)

        sql = "INSERT INTO experiment(experiment_id, experiment_type) " \
              "VALUES (NULL, " + "'metabolomics')"
        try:
            self.cursor.execute(sql)
        except Exception as e:
            logger.exception(e)

        self.db.commit()

    def insert_mzmine_metrics(self):
        # name,full name,disp. order, disp. name, use_metab, use_prot, metric_type
        with open(os.path.join(self.fs.config_dir, 'mzmine_metrics.txt'), 'r') as infile:
            for line in infile:
                in_data = line.strip().split('|')
                if len(in_data[0]) != 0 and in_data[0][0] != "#":
                    sql = "INSERT INTO metric (metric_id, metric_name, metric_description, display_order, display_name," + \
                        " use_metab, use_prot, metric_type, metric_info)" + \
                        " VALUES (NULL," + "'" + in_data[0].strip() + "'," + "'" \
                    + in_data[1].strip() + "','" + in_data[2].strip() + "','" + in_data[3].strip() + \
                        "','" + in_data[4].strip() + "','" + in_data[5].strip() + "','" + "mzmine','" + in_data[6].strip() + "')"

                    try:
                        self.cursor.execute(sql)
                    except Exception as e:
                        logger.exception(e)
            self.db.commit()

    def insert_morpheus_metrics(self):
        # name,full name,disp. order, disp. name, use_metab, use_prot
        with open(os.path.join(self.fs.config_dir, 'morpheus_metrics.txt'), 'r') as infile:
            for line in infile:
                in_data = line.strip().split('|')
                if len(in_data[0]) != 0 and in_data[0][0] != "#":
                    sql = "INSERT INTO metric (metric_id, metric_name, metric_description, display_order, "  +\
                        "display_name, use_metab, use_prot, metric_type, metric_info)" + \
                        " VALUES (NULL," + "'" + in_data[0].strip() + "'," + "'" \
                        + in_data[1].strip() + "','" + in_data[2].strip() + "','" + in_data[3].strip() + \
                        "','" + in_data[4].strip() + "','" + in_data[5].strip() + "','" + "morpheus','" + in_data[6].strip() + "')"

                    try:
                        self.cursor.execute(sql)
                    except Exception as e:
                        logger.exception(e)
            self.db.commit()

    def insert_thermo_metrics(self):
        # name,description ,disp. order, disp. name, use_metab, use_prot, metric_type
        with open(os.path.join(self.fs.config_dir, 'thermo_metrics.txt'), 'r') as infile:
            for line in infile:
                in_data = line.strip().split('|')
                if len(in_data[0]) != 0 and in_data[0][0] != "#":
                    sql = "INSERT INTO metric (metric_id, metric_name, metric_description, display_order, " +\
                        "display_name, use_metab, use_prot, metric_type, metric_info)" + \
                        " VALUES (NULL," + "'" + in_data[0].strip() + "'," + "'" \
                        + in_data[1].strip() + "','" + in_data[2].strip() + "','" + in_data[3].strip() + \
                        "','" + in_data[4].strip() + "','" + in_data[5].strip() + "','" + "thermo','" + in_data[6].strip() + "')"

                    try:
                        self.cursor.execute(sql)
                    except Exception as e:
                        logger.exception(e)
            self.db.commit()

    # SELECTS
    def select_and_display_all(self, tablename):
        print(tablename.upper())
        sql = "SELECT * FROM " + tablename

        try:
            self.cursor.execute(sql)
            result =  self.cursor.fetchall()
            for line in result:
                print(line)
        except Exception as e:
            logger.exception(e)

    # GETS
    def get_run_id(self, datafile):
        sql = "SELECT run_id FROM qc_run WHERE file_name = " + "'" + datafile + "'"
        try:
            self.cursor.execute(sql)
            run_id = self.cursor.fetchone()
            return run_id[0]
        except Exception as e:
            logger.exception(e)
            return False

    def get_metric_id(self, name):
        sql = "SELECT metric_id FROM metric WHERE metric_name = " + "'" + name + "'"
        try:
            self.cursor.execute(sql)
            metric_id = self.cursor.fetchone()
            return metric_id[0]
        except Exception as e:
            logger.exception(e)
            return False

    def get_component_id(self, name):
        sql = "SELECT component_id FROM sample_component WHERE component_name = " + "'" + name + "'"
        try:
            self.cursor.execute(sql)
            comp_id = self.cursor.fetchone()
            return comp_id[0]
        except Exception as e:
            logger.exception(e)
            return False

    def get_measurement(self, cid, mid, rid):
        sql = "SELECT m.metric_name, c.component_name, r.value, q.date_time FROM " \
                "metric m, measurement r, qc_run q, sample_component c WHERE " \
                "r.metric_id = m.metric_id AND " \
                "r.component_id = c.component_id AND " \
                "r.run_id = q.run_id AND " \
                "c.component_id = " + str(cid) + " AND " \
                "q.run_id = " + str(rid) + " AND " \
                "m.metric_id = " + str(mid)

        try:
            self.cursor.execute(sql)
            measurement = self.cursor.fetchone()
            return measurement
        except Exception as e:
            logger.exception(e)
            return False


    # DEV UPDATES
    def update_mzmine_metrics(self):
        # name,full name,disp. order, disp. name, use_metab, use_prot, metric_type
        with open(os.path.join(self.fs.config_dir, 'mzmine_metrics.txt'), 'r') as infile:
            for line in infile:
                in_data = line.strip().split('|')
                sql = "UPDATE metric SET metric_info = '" + in_data[6].strip() + "'" +\
                        " WHERE metric_name = '" + in_data[0].strip() + "'"

                try:
                    self.cursor.execute(sql)
                except Exception as e:
                    logger.exception(e)
            self.db.commit()

    def update_morpheus_metrics(self):
        # name,full name,disp. order, disp. name, use_metab, use_prot
        with open(os.path.join(self.fs.config_dir, 'morpheus_metrics.txt'), 'r') as infile:
            for line in infile:
                in_data = line.strip().split('|')
                sql = "UPDATE metric SET metric_info = '" + in_data[6].strip() + "'" +\
                        " WHERE metric_name = '" + in_data[0].strip() + "'"

                try:
                    self.cursor.execute(sql)
                except Exception as e:
                    logger.exception(e)
            self.db.commit()

    def update_thermo_metrics(self):
        # name,description ,disp. order, disp. name, use_metab, use_prot, metric_type
        with open(os.path.join(self.fs.config_dir, 'thermo_metrics.txt'), 'r') as infile:
            for line in infile:
                in_data = line.strip().split('|')
                sql = "UPDATE metric SET metric_info = '" + in_data[6].strip() + "'" + \
                      " WHERE metric_name = '" + in_data[0].strip() + "'"

                try:
                    self.cursor.execute(sql)
                except Exception as e:
                    logger.exception(e)
            self.db.commit()

if __name__ == "__main__":

    # read in db details
    try:
        with open(os.path.join(os.getcwd(), "Config", "database-login.json"), 'r') as f:
            db_details = json.load(f)
    except Exception as e:
        logger.exception(e)
        sys.exit(1)

    # db details
    user = db_details["User"]
    port = db_details["Database Port"]
    database_name = db_details["Database Name"]

    try:
        with open(os.path.join(os.getcwd(), "Config", ".maspeqc_gen"), "r") as f:
            password = f.read()
    except Exception as e:
        logger.exception(e)
        sys.exit(1)


    # file system obj
    fs = FileSystem("", "", "", "")

    # connect to db
    db = MPMFDBSetUp(user, password, database_name, fs, port)

    if db.connected:
        # add tables and data
        db.set_up()
        logger.info("Database Loaded Successfully")
    
        # close conenction  
        db.db.close()
