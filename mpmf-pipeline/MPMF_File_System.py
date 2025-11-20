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

