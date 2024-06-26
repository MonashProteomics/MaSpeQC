import os


class FileSystem:
    """
        A structure for the configuration files
        Sets the location of the configuration files
        Used by ProcessRawFile and MPMFDBSetup
    """
    def __init__(self, file_directory, out_directory, machine, experiment):

        self.main_dir = os.getcwd()
        self.sw_dir = os.path.join(self.main_dir, "..", "Software")
        self.config_dir = os.path.join(self.main_dir, "Config")
        self.databases = os.path.join(self.config_dir, "databases")
        self.thresholds = os.path.join(self.config_dir, "thresholds")
        self.in_dir = file_directory

        # config for processing
        if out_directory != "":
            self.xml_template_metab = os.path.join(self.config_dir, "metab_template.xml")
            self.xml_template_proteo = os.path.join(self.config_dir, "proteo_template.xml")
            self.out_dir = out_directory

            # set Proteomics mzmine input file
            if experiment.upper() == "PROTEOMICS":
                instr_file = "iRT-Reference-" + machine + ".csv"
                self.irt_db = os.path.join(self.databases, instr_file)
                if not os.path.exists(self.irt_db):
                    self.irt_db = os.path.join(self.databases, "iRT-Reference-Default.csv")

                # and threshold file for email notification
                threshold_file = "proteomics-thresholds-" + machine + ".txt"
                self.thresh_email = os.path.join(self.thresholds, threshold_file)
                if not os.path.exists(self.thresh_email):
                    self.thresh_email = os.path.join(self.thresholds, "proteomics-thresholds-default.txt")

            # set Metabolomics mzmine input file
            if experiment.upper() == "METABOLOMICS":
                instr_file_neg = "negative-db-" + machine + ".csv"
                instr_file_pos = "positive-db-" + machine + ".csv"
                self.neg_db = os.path.join(self.databases, instr_file_neg)
                self.pos_db = os.path.join(self.databases, instr_file_pos)
                if not os.path.exists(self.neg_db):
                    self.neg_db = os.path.join(self.databases, "negative-db-Default.csv")
                if not os.path.exists(self.pos_db):
                    self.pos_db = os.path.join(self.databases, "positive-db-Default.csv")

                # and threshold file for email notification
                threshold_file = "metab-thresholds-" + machine + ".txt"
                self.thresh_email = os.path.join(self.thresholds, threshold_file)
                if not os.path.exists(self.thresh_email):
                    self.thresh_email = os.path.join(self.thresholds, "metab-thresholds-default.txt")

