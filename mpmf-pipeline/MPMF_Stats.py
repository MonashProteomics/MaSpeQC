import json
import os
import numpy as np
import pandas as pd
import logging
logger = logging.getLogger('processing.stats')


class Stat:
    """
        Creates stats for history plots
        and the normalised metrics
        inserts these into database and updates processing status (completed='Y')
        Used by ProcessRawFile after a batch of raw files are processed
        NOTE: current implementation is quite slow and could be optimised
    """
    def __init__(self, exp_type, db, machine, m_type, file_sys):
        self.e_type = exp_type
        self.db = db
        self.machine = machine
        self.machine_type = m_type
        self.fs = file_sys
        self.thresholds = self.set_thresholds()

    def run(self):
    
        if not self.check_number_runs():
            logger.warning("5 runs or more needed for stats and normalised metrics")
            return False
            
        if self.check_for_updates():
            self.compute_stats()
            self.insert_update_stats()
            self.compute_derived_metrics()
            logger.info("Updated stats and normalised metrics for mzmine " + self.machine + " " + self.e_type)
            if self.machine_type == 'thermo':
                self.compute_thermo_stats()
                self.insert_update_stats()
                logger.info('Updated thermo stats')
            if self.e_type == 'PROTEOMICS':
                self.compute_morpheus_stats()
                self.update_current_thresholds()
                self.insert_update_morpheus_stats()
                logger.info("Updated morpheus stats " + self.machine + " " + self.e_type)
            self.update_completed()

        else:
            logger.info("No new data for " + self.machine + " " + self.e_type)
            
    def check_number_runs(self):
        sql = "SELECT COUNT(*) FROM qc_run WHERE machine_id = " + \
                " (SELECT machine_id FROM machine WHERE machine_name = '" + \
                self.machine + "') AND experiment_id = (SELECT experiment_id FROM experiment " + \
                " WHERE experiment_type = '" + self.e_type.lower() + "')" 

        count = 0
        try:
            self.db.db.commit() # not picking up commits in processing from other processes?
            self.db.cursor.execute(sql)
            count = int(self.db.cursor.fetchone()[0])
        except Exception as e:
            logger.exception(e)
        
        if count > 4:
            return True
        else:
            return False

    def check_for_updates(self):

        sql = "SELECT COUNT(*) FROM qc_run WHERE machine_id = " + \
                " (SELECT machine_id FROM machine WHERE machine_name = '" + \
                self.machine + "') AND experiment_id = (SELECT experiment_id FROM experiment " + \
                " WHERE experiment_type = '" + self.e_type.lower() + "')" + " AND completed = 'N'"

        count = 0
        try:
            self.db.db.commit() # not picking up commits in processing from other processes?
            self.db.cursor.execute(sql)
            count = int(self.db.cursor.fetchone()[0])
        except Exception as e:
            logger.exception(e)

        if count > 0:
            return True
        else:
            return False

    def compute_thermo_stats(self):
        sql_m = ""
        sql_c = ""
        if self.e_type == 'PROTEOMICS':
            sql_m = "SELECT metric_id FROM metric WHERE metric_type = 'thermo' AND use_prot = 'Y' " + \
                " AND display_order > 0"

            sql_c = "SELECT component_id FROM sample_component WHERE component_name = 'Hela Digest'"

        elif self.e_type == 'METABOLOMICS':
            sql_m = "SELECT metric_id FROM metric WHERE metric_type = 'thermo' AND use_metab = 'Y' " + \
                  " AND display_order > 0"

            sql_c = "SELECT component_id FROM sample_component WHERE component_name = 'Metab Digest'"

        try:
            self.db.cursor.execute(sql_m)
            metrics = self.db.cursor.fetchall()
        except Exception as e:
            logger.exception(e)

        try:
            self.db.cursor.execute(sql_c)
            comp_id = self.db.cursor.fetchone()[0]
        except Exception as e:
            logger.exception(e)

        all_stats = []
        for metric in metrics:
            stats = []
            sql_value = "SELECT r.value, q.date_time FROM measurement r, qc_run q, " \
                        "metric m, sample_component c, machine t " \
                        "WHERE r.metric_id = m.metric_id " \
                        "AND r.component_id = c.component_id " \
                        "AND r.run_id = q.run_id " \
                        "AND t.machine_id = q.machine_id " \
                        "AND c.component_id = " + "'" + str(comp_id) + "' " + \
                        "AND m.metric_id = " + "'" + str(metric[0]) + "' " + \
                        "AND t.machine_name = " + "'" + self.machine + "'"

            try:
                self.db.cursor.execute(sql_value)
                values = self.db.cursor.fetchall()
                new_line = [comp_id, metric[0], self.machine]
                for value in values:
                    # don't include missed values in stats
                    if not (float(value[0]) == 0 or float(value[0]) < -1000):
                        stats.append(float(value[0]))
                ds = pd.Series(stats)
                summary = ds.describe()
                for stat in summary:
                    new_line.append(stat)
                all_stats.append(new_line)
            except Exception as e:
                logger.exception(e)

        # a pandas table
        self.df = pd.DataFrame(all_stats,
                               columns=['Component', 'Metric', 'Machine', 'count', 'mean', 'std', 'min', '25%',
                                        '50%', '75%', 'max'])

    def compute_stats(self):
        # creates a pandas table of stats for the stats table for mzmine metrics
        #REFACTOR: get id not name like thermo compute stats (plus ref to Hela and Metab digest)
        # exclude area and height normalised
        if self.e_type == "METABOLOMICS":
            sql_m = "SELECT metric_id FROM metric WHERE metric_name <> '" + "area_normalised' " + \
                    "AND metric_name <> '" + "height_normalised'" + " AND use_metab = 'Y' AND metric_type = 'mzmine'" 

        elif self.e_type == "PROTEOMICS":
            sql_m = "SELECT metric_id FROM metric WHERE metric_name <> '" + "area_normalised' " + \
                    "AND metric_name <> '" + "height_normalised'" + " AND use_prot = 'Y'" + " AND metric_type = 'mzmine'" 

        # experiment_id equals digest_id
        sql_c = "SELECT component_id FROM sample_component WHERE component_name <> 'Hela Digest'" + \
                " AND component_name <> 'Metab Digest' " + \
                " AND digest_id = (SELECT experiment_id FROM experiment WHERE experiment_type = '" + self.e_type.lower() + "')"

        try:
            self.db.cursor.execute(sql_m)
            metrics = self.db.cursor.fetchall()
        except Exception as e:
            logger.exception(e)

        try:
            self.db.cursor.execute(sql_c)
            components = self.db.cursor.fetchall()
        except Exception as e:
            logger.exception(e)

        all_stats = []
        for metric in metrics:
            for component in components:
                stats = []
                sql_value = "SELECT r.value, q.date_time FROM measurement r, qc_run q, " \
                            "metric m, sample_component c, machine t " \
                            "WHERE r.metric_id = m.metric_id " \
                            "AND r.component_id = c.component_id " \
                            "AND r.run_id = q.run_id " \
                            "AND t.machine_id = q.machine_id " \
                            "AND c.component_id = " + "'" + str(component[0]) + "' " + \
                            "AND m.metric_id = " + "'" + str(metric[0]) + "' " + \
                            "AND t.machine_name = " + "'" + str(self.machine) + "'"

                try:
                    self.db.cursor.execute(sql_value)
                    values = self.db.cursor.fetchall()
                    new_line = [component[0], metric[0], self.machine]
                    for value in values:
                        # don't include missed values in stats
                        if not (float(value[0]) == 0 or float(value[0]) < -1000):
                            stats.append(float(value[0]))
                    ds = pd.Series(stats)
                    summary = ds.describe()
                    for stat in summary:
                        new_line.append(stat)
                    all_stats.append(new_line)
                except Exception as e:
                    logger.exception(e)

        # a pandas table
        self.df = pd.DataFrame(all_stats,
                          columns=['Component', 'Metric', 'Machine', 'count', 'mean', 'std', 'min', '25%',
                                   '50%', '75%', 'max'])
        #df = df.sort_values(by=['Metric', 'Venue'])
        #df.to_csv('stats.csv')

    def compute_morpheus_stats(self):

        sql = "SELECT metric_name FROM metric WHERE use_prot ='Y' AND metric_type = 'morpheus'"

        try:
            self.db.cursor.execute(sql)
            metrics = self.db.cursor.fetchall()
        except Exception as e:
            logger.exception(e)

        all_stats = []
        for metric in metrics:
            stats = []
            sql_value = "SELECT r.value, q.date_time FROM measurement r, qc_run q, " \
                        "metric m, sample_component c, machine t " \
                        "WHERE r.metric_id = m.metric_id " \
                        "AND r.component_id = c.component_id " \
                        "AND r.run_id = q.run_id " \
                        "AND t.machine_id = q.machine_id " \
                        "AND c.component_name = " + "'Hela Digest'" + \
                        "AND m.metric_name = " + "'" + str(metric[0]) + "' " + \
                        "AND t.machine_name = " + "'" + str(self.machine) + "'"

            try:
                self.db.cursor.execute(sql_value)
                values = self.db.cursor.fetchall()
                new_line = ["Hela Digest", metric[0], self.machine]
                for value in values:
                    # don't include missed values in stats
                    if not (float(value[0]) == 0 or float(value[0]) < -1000):
                        stats.append(float(value[0]))
                ds = pd.Series(stats)
                summary = ds.describe()

                # lower threshold (percentile)
                lower_thresh = int(self.thresholds[metric[0]][1])/100
                if lower_thresh > 0:
                    thresh_reading = ds.quantile(lower_thresh)
                else:
                    thresh_reading = 0 # ppm just set to 0

                for stat in summary:
                    new_line.append(stat)
                new_line.append(thresh_reading)
                all_stats.append(new_line)
            except Exception as e:
                logger.exception(e)

        # a pandas table
        self.hela_df = pd.DataFrame(all_stats,
                               columns=['Component', 'Metric', 'Machine', 'count', 'mean', 'std', 'min', '25%',
                                        '50%', '75%', 'max', 'lower_thresh'])

    def insert_update_morpheus_stats(self):

        sql_c = "SELECT component_id FROM sample_component WHERE component_name = 'Hela Digest'"

        try:
            self.db.cursor.execute(sql_c)
            cid = self.db.cursor.fetchone()
        except Exception as e:
            logger.exception(e)

        sql_mac = "SELECT machine_id FROM machine WHERE machine_name = '" + self.machine + "'"

        try:
            self.db.cursor.execute(sql_mac)
            macid = self.db.cursor.fetchone()
        except Exception as e:
            logger.exception(e)

        for i in range(len(self.hela_df)):
            sql_m = "SELECT metric_id FROM metric WHERE metric_name = " + "'" + self.hela_df.iloc[i]['Metric'] + "'"

            try:
                self.db.cursor.execute(sql_m)
                mid = self.db.cursor.fetchone()
            except Exception as e:
                logger.exception(e)

            mean = round(self.hela_df.iloc[i]['mean'], 8)
            std = round(self.hela_df.iloc[i]['std'], 8)
            dfMin = round(self.hela_df.iloc[i]['min'], 8)
            dfMax = round(self.hela_df.iloc[i]['max'], 8)
            med25 = round(self.hela_df.iloc[i]['25%'], 8)
            med = round(self.hela_df.iloc[i]['50%'], 8)
            med75 = round(self.hela_df.iloc[i]['75%'], 8)

            if not self.is_inserted_stat(mid[0], cid[0], macid[0]):

                sql = "INSERT into stat VALUES(" + "'" + str(mid[0]) + "','" + str(cid[0]) + "','" + \
                             str(macid[0]) + "','" + str(self.hela_df.iloc[i]['count']) + "','" + str(mean) + \
                             "','" + str(std) + "','" + str(dfMin) + "','" + \
                             str(med25) + "','" + str(med) + "','" + str(med75) + \
                             "','" + str(dfMax) + "')"
            else:
                # test in next update
                sql = "UPDATE stat SET count = '" + str(self.hela_df.iloc[i]['count']) + "', mean = '" + str(mean) + \
                        "', std = '" + str(std) + "', min = '" + str(dfMin) + \
                        "', 25_percent = '" + str(med25)  + "', 50_percent = '" + str(med)  + \
                        "', 75_percent = '" + str(med75) + "', max = '" + str(dfMax)  + \
                        "' WHERE metric_id = '" + str(mid[0]) + "' AND component_id = '" + str(cid[0]) + \
                        "' AND machine_id = '" + str(macid[0]) + "'"
            try:
                self.db.cursor.execute(sql)
            except Exception as e:
                logger.exception(e)

            self.db.db.commit()

    def insert_update_stats(self):
        # run after compute_stats()
        # columns = ['Component', 'Metric', 'Machine', 'count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max']

        sql_mac = "SELECT machine_id FROM machine WHERE machine_name = '" + self.machine + "'"

        try:
            self.db.cursor.execute(sql_mac)
            macid = self.db.cursor.fetchone()
        except Exception as e:
            logger.exception(e)

        for i in range(len(self.df)):
            mean = round(self.df.iloc[i]['mean'], 8)
            std = round(self.df.iloc[i]['std'], 8)
            dfMin = round(self.df.iloc[i]['min'], 8)
            dfMax = round(self.df.iloc[i]['max'], 8)
            med25 = round(self.df.iloc[i]['25%'], 8)
            med = round(self.df.iloc[i]['50%'], 8)
            med75 = round(self.df.iloc[i]['75%'], 8)

            if not self.is_inserted_stat(self.df.iloc[i]['Metric'], self.df.iloc[i]['Component'], macid[0]):
                sql = "INSERT into stat VALUES(" + "'" + str(self.df.iloc[i]['Metric']) + "','" + \
                      str(self.df.iloc[i]['Component']) + "','" + \
                             str(macid[0]) + "','" + str(self.df.iloc[i]['count']) + "','" + \
                      str(mean) + "','" + str(std) + "','" + str(dfMin) + "','" + \
                             str(med25) + "','" + str(med) + "','" + str(med75) + \
                             "','" + str(dfMax) + "')"
            else:
                sql = "UPDATE stat SET count = '" + str(self.df.iloc[i]['count']) + "', mean = '" + str(mean) + \
                        "', std = '" + str(std) + "', min = '" + str(dfMin) + \
                        "', 25_percent = '" + str(med25)  + "', 50_percent = '" + str(med) + \
                        "', 75_percent = '" + str(med75) + "', max = '" + str(dfMax) + \
                        "' WHERE metric_id = '" + str(self.df.iloc[i]['Metric']) + "' AND component_id = '" + str(self.df.iloc[i]['Component']) + \
                        "' AND machine_id = '" + str(macid[0]) + "'"
            try:
                self.db.cursor.execute(sql)
            except Exception as e:
                logger.exception(e)

            self.db.db.commit()

    def is_inserted_stat(self, mid, cid, macid):

        sql = "SELECT machine_id FROM stat WHERE metric_id = '" + str(mid) + "' AND " \
                "component_id = '"  + str(cid) + "' AND " \
                 "machine_id = '" + str(macid) + "'"

        try:
            self.db.cursor.execute(sql)
            result = self.db.cursor.fetchall()
            if len(result) == 0:
                return False
            else:
                return True
        except Exception as e:
            logger.exception(e)

    def compute_derived_metrics(self):
        # call after insert_update_stats

        # includes missed values to handle in charts

        metrics = ["area", "height"]
        for metric in metrics:
            norm_max = 0
            norm_min = 0 # test this query, limit to experiment type...join experiment and run ??
            sql = "SELECT m.metric_id, c.component_id, n.machine_id, r.run_id, r.value FROM metric m, " + \
                  "measurement r, sample_component c, qc_run q , machine n, experiment e WHERE " + \
                  "r.metric_id = m.metric_id AND " + \
                  "e.experiment_id = c.digest_id AND " + \
                  "n.machine_id = q.machine_id AND " + \
                  "r.run_id = q.run_id AND " + \
                  "r.component_id = c.component_id AND " + \
                  "c.component_name <> '" + "Hela Digest' AND " + \
                  "m.metric_name = '" + metric + "' AND " + \
                    "n.machine_name = '" + str(self.machine) + "' AND " + \
                    "e.experiment_type = '" + self.e_type + "'"


            try:
                self.db.cursor.execute(sql)
                values = self.db.cursor.fetchall()
                for value in values:
                    # REFACTOR: cache medians to avoid repeated db calls
                    get_median = "SELECT 50_percent FROM stat WHERE metric_id = '" + str(value[0]) + "' AND " + \
                                 "component_id = '" + str(value[1]) + "' AND " + \
                                 "machine_id = '" + str(value[2]) + "'"

                    try:
                        self.db.cursor.execute(get_median)
                        median = self.db.cursor.fetchone()
                    except Exception as e:
                        logger.exception(e)

                    # compute normalised median
                    # handle missed values by setting to -100
                    if median[0] != 0 and value[4] != 0:
                        norm = np.log2(float(value[4] / median[0]))
                    else:
                        norm = -100

                    if norm == -np.inf:
                        norm = -100

                    if norm != -100:
                        if norm > norm_max:
                            norm_max = norm
                        elif norm < norm_min:
                            norm_min = norm

                    # get metric id
                    get_mid = "SELECT metric_id FROM metric WHERE metric_name = " + "'" + metric + "_normalised" + "'"
                    try:
                        self.db.cursor.execute(get_mid)
                        mid = self.db.cursor.fetchone()
                    except Exception as e:
                        logger.exception(e)

                    # deleting means all values are updated using current stats
                    if self.is_inserted_measurement(mid[0], value[1], value[3]):
                        self.delete_measurement(mid[0], value[1], value[3])

                    insert_med = "INSERT INTO measurement VALUES('" + str(mid[0]) + "',' " + \
                                 str(value[1]) + "','" + str(value[3]) + "','" + str(round(norm,8)) + "')"
                    try:
                        self.db.cursor.execute(insert_med)
                    except Exception as e:
                        logger.exception(e)

            except Exception as e:
                logger.exception(e)


        self.db.db.commit()

    def is_inserted_measurement(self, mid, cid, rid):

        sql = "SELECT run_id FROM measurement WHERE metric_id = '" + str(mid) + "' AND " \
                "component_id = '"  + str(cid) + "' AND " \
                 "run_id = '" + str(rid) + "'"

        try:
            self.db.cursor.execute(sql)
            result = self.db.cursor.fetchall()
            if len(result) == 0:
                return False
            else:
                return True
        except Exception as e:
            logger.exception(e)

    def delete_measurement(self, mid, cid, rid):

        sql = "DELETE FROM measurement WHERE metric_id = '" + str(mid) + "' AND " \
                "component_id = '"  + str(cid) + "' AND " \
                 "run_id = '" + str(rid) + "'"

        try:
            self.db.cursor.execute(sql)
        except Exception as e:
            logger.exception(e)

        self.db.db.commit()

    def update_completed(self):
        sql = "UPDATE qc_run SET completed = 'Y' WHERE machine_id = " + \
            "(SELECT machine_id FROM machine WHERE machine_name = '" + \
            self.machine + "') AND experiment_id = (SELECT experiment_id FROM experiment " + \
            " WHERE experiment_type = '" + self.e_type.lower() + "')"

        try:
            self.db.cursor.execute(sql)
            self.db.db.commit()
            return True
        except Exception as e:
            logger.exception(e)

    def update_current_thresholds(self):
        # read in current thresholds
        with open(os.path.join(os.getcwd(), "Config", "thresholds", "thresholds-ms2-percentiles.json"), 'r') as f:
            current_thresholds = json.load(f)

        # update json
        for i in range(len(self.hela_df)):
            if self.hela_df.iloc[i]['Metric'] != 'Precursor Mass Error':
                current_thresholds[self.machine][self.hela_df.iloc[i]['Metric']] = self.hela_df.iloc[i]['lower_thresh']

        # save json
        with open(os.path.join(os.getcwd(), "Config", "thresholds", "thresholds-ms2-percentiles.json"), 'w') as f:
            f.write(json.dumps(current_thresholds))

    def set_thresholds(self):
        # get threshold limits
        with open(self.fs.thresh_email) as f:
            limits = f.readlines()

        # remove header
        limits.pop(0)

        # create dict for storing
        thresholds = {}
        for limit in limits:
            new_limit = limit.split("|")
            if new_limit[1] != '':
                thresholds[new_limit[0]] = [new_limit[1], new_limit[2], new_limit[3].strip()]

        return thresholds

