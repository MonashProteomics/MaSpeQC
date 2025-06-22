import numpy as np
import os
import math
import glob
import json
import logging
logger = logging.getLogger('processing.thermo')

try:
    import clr
    clr.AddReference("ThermoFisher.CommonCore.RawFileReader")
    from ThermoFisher.CommonCore.RawFileReader import RawFileReaderAdapter
    clr.AddReference("ThermoFisher.CommonCore.Data")
    from ThermoFisher.CommonCore.Data.Business import * # can probably more specific than '*'
    dlls = True
except:
    logger.exception("No ThermoFisher libraries found")
    dlls = False


class ThermoMetrics:

    def __init__(self, filepath, filename, exp, db, fs, machine):

        # retur if no dlls
        if not dlls:
            return None

        self.exp = exp
        self.filepath = filepath
        self.filename = filename
        self.rawfile = RawFileReaderAdapter.FileFactory(self.filepath)
        self.db = db
        self.fs = fs
        self.machine = machine
        self.db.db.commit() # commit for any other instances
        self.run_id = self.db.get_run_id(self.filename)
        self.comp_id = self.set_component_id()

        if not self.rawfile.IsError:
            # set controller type 4 for UV, 2 for A/D
            if self.rawfile.GetInstrumentCountOfType(Device.UV) > 0:
                self.controller_type = Device.UV
            elif self.rawfile.GetInstrumentCountOfType(Device.Analog) > 0:
                self.controller_type = Device.Analog
            else:
                logger.warning("No Profile Data")

            if self.exp.upper() == "PROTEOMICS":
                # set controllers
                self.lp_cont = 1
                self.np_cont = 2
                self.co_cont = 3
                
                # valve limits
                valve_limits = self.get_valve_limits()
                self.first_valve = float(valve_limits[0])
                self.last_valve = float(valve_limits[1])

                # get data from raw
                self.lp_data = self.set_lp_data()
                self.np_data = self.set_np_data()
                self.co_data = self.set_co_data()
            elif self.exp == "METABOLOMICS":
                # controller and data
                self.mp_cont = 1
                self.mp_data = self.set_mp_data()
        else:
            logger.error('FileReader Error', self.rawfile.FileError)

        self.run()
        self.rawfile.Dispose()

    def run(self):
        if self.exp.upper() == "PROTEOMICS":
            self.all_loading_pump()
            self.all_nano_pump()
            self.insert_co_temp()
            self.insert_pressure_profile("np")
            self.insert_pressure_profile("lp")
        else:
            self.all_main_pump()
            self.insert_pressure_profile("mp")
            
        logger.info("INSTRUMENT METRICS INSERTED FOR " + self.filename)
        logger.info("PROFILE DATA INSERTED FOR " + self.filename)

    def set_lp_data(self):
        self.rawfile.SelectInstrument(self.controller_type, self.lp_cont)
        return self.get_chromatogram_data()

    def set_np_data(self):
        self.rawfile.SelectInstrument(self.controller_type, self.np_cont)
        return self.get_chromatogram_data()

    def set_co_data(self):
        # NOTE: not finding co data
        # check if column oven data first
        if self.rawfile.GetInstrumentCountOfType(Device.UV) > 2:
            self.rawfile.SelectInstrument(self.controller_type, self.co_cont)
            return self.get_chromatogram_data()
        return []

    def set_mp_data(self):
        self.rawfile.SelectInstrument(self.controller_type, self.mp_cont)
        return self.get_chromatogram_data()
        
    def get_chromatogram_data(self):
        settings = ChromatogramTraceSettings(TraceType.TIC) # not sure if this is the correct trace type
        _data = self.rawfile.GetChromatogramData([settings], -1, -1)
        trace = ChromatogramSignal.FromChromatogramData(_data)
        data = [[0] * trace[0].Length, [0] * trace[0].Length]
        # copy values from trace[0].Times and trace[0].Intensities
        for n in range(trace[0].Length):
            data[0][n] = trace[0].Times[n]
            data[1][n] = trace[0].Intensities[n]
        return data
        
    def set_component_id(self):
        # set the id needed for inserts based on experiment
        # may need to get these comp names from file for config purposes

        if self.exp == "METABOLOMICS":
            sql = "SELECT component_id FROM sample_component WHERE component_name = 'Metab Digest'"
        elif self.exp == "PROTEOMICS":
            sql = "SELECT component_id FROM sample_component WHERE component_name = 'Hela Digest'"

        try:
            self.db.cursor.execute(sql)
            return self.db.cursor.fetchone()[0]
        except Exception as e:
            logger.exception(e)
            return False
            
    def get_valve_limits(self):
        if os.path.exists(os.path.join(self.fs.config_dir, "pump", "loading-pump-" + self.machine + ".csv")):
            with open(os.path.join(self.fs.config_dir, "pump", "loading-pump-" + self.machine + ".csv"), "r") as infile:
                for line in infile:
                    pump_limits = line.strip().split("|")
            return pump_limits
        else:
            with open(os.path.join(self.fs.config_dir, "pump", "loading-pump.csv"), "r") as infile:
                for line in infile:
                    pump_limits = line.strip().split("|")
            return pump_limits
            
    # LOADING PUMP - PROTEOMICS
    def create_lp_starting_bp(self):
        """Ave Pressure in first 2min (config first valve)"""
        x = np.array(self.lp_data[0])
        y = np.array(self.lp_data[1])

        # find index (first_valve)
        cut = 0
        for i in range(len(x)):
            if x[i] >= self.first_valve:
                cut = i
                break
            else:
                cut = i
        #self.plot_loading_pump(0, cut, "S")
        return np.mean(y[:cut])

    def create_lp_end_pressure(self):
        """Ave Pressure in last 3min (config last valve)"""
        x = np.array(self.lp_data[0])
        y = np.array(self.lp_data[1])

        # find last min (end_valve)
        cut = 0
        ep_limit = x[len(x)-1] - self.last_valve
        for i in range(len(x)-1, -1, -1):
            if x[i] <= ep_limit:
                cut = i
                break
            else:
                cut = i
        #self.plot_loading_pump(cut, len(x), "E")
        return np.mean(y[cut:len(y)])

    def create_lp_air_injection(self):
        """Diff. b/w first reading and Max reading in first 60 sec"""
        x = np.array(self.lp_data[0])
        y = np.array(self.lp_data[1])

        # find 60sec index
        cut = 0
        air_limit = 1
        for i in range(len(x)):
            if x[i] >= air_limit:
                cut = i
                break
            else:
                cut = i

        first = y[0]
        max_60 = np.max(y[:cut])

        return max_60 - first


    def create_lp_valve_spike_start(self):
        """Creates a 10 sec window around the max starting pressure
            and returns abs value of this range
        """
        x = np.array(self.lp_data[0])
        y = np.array(self.lp_data[1])

        # find 2-min index (starting pressure)
        cut = 0
        for i in range(len(x)):
            if x[i] >= self.first_valve:
                cut = i
                break
            else:
                cut = i

        x_start = x[:cut]
        y_start = y[:cut]

        # find max and index of max
        max_start = np.max(y_start)
        max_index = np.where(y_start == max_start)[0][0]

        # find index 5 sec before
        start_index = max_index
        while start_index > 0 and x_start[max_index] - x_start[start_index] < 1/12:
            start_index -= 1

        # find index 5 sec after
        end_index = max_index
        while end_index < len(x_start)-1 and x_start[end_index] - x_start[max_index] < 1/12:
            end_index += 1

        #self.plot_loading_pump(start_index, end_index, "VS")
        return abs(y_start[start_index] - y_start[end_index])

    def create_lp_valve_spike_end(self):
        """Creates a 10 sec window around the max end pressure
            and returns abs value of this range
        """
        x = np.array(self.lp_data[0])
        y = np.array(self.lp_data[1])

        # find last 3 min
        cut = 0
        ep_limit = x[len(x) - 1] - self.last_valve
        for i in range(len(x) - 1, -1, -1):
            if x[i] <= ep_limit:
                cut = i
                break
            else:
                cut = i

        x_end = x[cut:len(x)]
        y_end = y[cut:len(y)]

        # find max and index of max
        max_start = np.max(y_end)
        max_index = np.where(y_end == max_start)[0][0]

        # find index 5 sec before
        start_index = max_index
        while start_index > 0 and x_end[max_index] - x_end[start_index] < 1/12:
            start_index -= 1

        # find index 5 sec after
        end_index = max_index
        while end_index < len(x_end)-1 and x_end[end_index] - x_end[max_index] < 1/12:
            end_index += 1

        #self.plot_loading_pump(start_index+cut, end_index+cut, "VE")
        return abs(y_end[start_index] - y_end[end_index])

    # NANO PUMP - PROTEOMICS
    def create_np_starting_pressure(self):
        """Median Pressure in first 2min"""
        x = np.array(self.np_data[0])
        y = np.array(self.np_data[1])

        # find 2-min index
        cut = 0
        sp_limit = 2
        for i in range(len(x)):
            if x[i] >= sp_limit:
                cut = i
                break
            else:
                cut = i

        #self.plot_nano_pump(0, cut)
        return np.median(y[:cut])

    def create_np_valve_drop(self):
        """Difference b/w starting pressure and first trough"""
        x = np.array(self.np_data[0])
        y = np.array(self.np_data[1])

        # find 3-min index
        cut = 0
        dp_limit = 3
        for i in range(len(x)):
            if x[i] >= dp_limit:
                cut = i
                break
            else:
                cut = i

        # find min of 1st 3 min (the trough)
        y_start = y[:cut]
        y_trough = np.min(y_start)

        # find index of the trough
        trough_index = np.where(y_start == y_trough)

        #self.plot_nano_pump(0, trough_index[0][0])
        return y_trough, trough_index[0][0]

    def create_np_max_pressure(self):
        """Max Pressure"""
        y = np.array(self.np_data[1])
        return np.max(y)

    def create_np_min_pressure(self):
        """Min Pressure"""
        y = np.array(self.np_data[1])
        return np.min(y)

    def create_np_inline_leak(self):
        """Difference b/w starting pressure and first peak after first trough"""
        x = np.array(self.np_data[0])
        y = np.array(self.np_data[1])

        trough = self.create_np_valve_drop()
        trough_index = trough[1]
        cut = x[trough_index] + 4 # 4 minute after trough

        cut_index = 0
        for i in range(trough_index, len(x) - 1):
            if x[i] > cut:
                cut_index = i
                break
            else:
                cut_index = i

        #self.plot_nano_pump(trough_index, cut_index)
        return np.max(y[trough_index:cut_index])

    def create_np_pressure_diff(self):
        """Difference b/w median of first minute and median of last minute"""
        x = np.array(self.np_data[0])
        y = np.array(self.np_data[1])

        # find 1-min index
        cut = 0
        fm_limit = 1
        for i in range(len(x)):
            if x[i] >= fm_limit:
                cut = i
                break
            else:
                cut = i

        # find last 1 min index
        cut_last = 0
        lm_limit = x[len(x) - 1] - 1
        for j in range(len(x) - 1, -1, -1):
            if x[j] <= lm_limit:
                cut_last = j
                break

        #self.plot_nano_pump()
        return np.median(y[:cut]) - np.median(y[cut_last:len(y)])

    # COLUMN OVEN - PROTEOMICS
    def create_column_range(self):
        """Temperature range (celcius) of column oven"""
        
        if self.co_data:
            y = np.array(self.co_data[0][1])
            #self.plot_column_oven()
            diff = np.max(y) - np.min(y)
            if diff < 2:
                return np.max(y) - np.min(y)
            else: # else likely error
                return -1
        return -1

    # MAIN PUMP - METABOLOMICS
    def create_mp_max_pressure(self):
        """Max Pressure, returns max pressure and RT of max pressure"""
        x = np.array(self.mp_data[0])
        y = np.array(self.mp_data[1])

        max_y = np.max(y)
        max_index = np.where(y == max_y)[0][0]
        #self.plot_main_pump()
        return max_y, x[max_index]

    def create_mp_starting_pressure(self):
        """Median Pressure in first 1min"""
        x = np.array(self.mp_data[0])
        y = np.array(self.mp_data[1])

        # find 2-min index
        cut = 0
        mp_limit = 1
        for i in range(len(x)):
            if x[i] >= mp_limit:
                cut = i
                break
            else:
                cut = i

        #self.plot_main_pump()
        return np.median(y[:cut])

    def create_mp_end_pressure(self):
        """Ave Pressure in last 1min"""
        x = np.array(self.mp_data[0])
        y = np.array(self.mp_data[1])

        # find last 1 min
        cut = 0
        ep_limit = x[len(x)-1] - 1
        for i in range(len(x)-1, -1, -1):
            if x[i] <= ep_limit:
                cut = i
                break
            else:
                cut = i
        #self.plot_main_pump()
        return np.median(y[cut:len(y)])

    # PRESSURE PROFILES
    def create_data_bins(self, pump):

        # bin the profile data for storing
        precision = 2

        if pump == "mp":
            x = np.array(self.mp_data[0])
            y = np.array(self.mp_data[1])
        elif pump == "np":
            x = np.array(self.np_data[0])
            y = np.array(self.np_data[1])
        else: # lp
            x = np.array(self.lp_data[0])
            y = np.array(self.lp_data[1])

        # bin in seconds (average)
        x_sec = []
        y_sec = []
        # iave = 0
        # count = 0
        # second = math.ceil(x[0] * 60)
        # for k in range(0, len(x)):
            # if x[k] * 60 > second:
                # x_sec.append(second)
                # y_sec.append(round(iave/count, precision))
                # iave = 0
                # count = 0
                # second = math.ceil(x[k] * 60)

            # iave += y[k]
            # count += 1

        # check whether the last values have been stored in x_sec, y_sec
        # if x_sec[-1] < second:
            # x_sec.append(second)
            # y_sec.append(round(iave/count, precision))

        start = 0
        second = math.ceil(x[0] * 60)
        for k in range(1, len(x)):
            if x[k] * 60 > second or k == len(x) - 1:
                x_sec.append(second)
                y_sec.append(round(sum(y[start:k])/(k - start), precision))
                start = k
                second = math.ceil(x[k] * 60)

        # transform retention times to vector containing the first retention time and only the retention time delta for all following values
        x_sec = [x_sec[k] - x_sec[k - 1] if k > 0 else x_sec[0] for k in range(0, len(x_sec))]

        return {"rts": x_sec, "intensities": y_sec}
        
    # GET ALL METRICS for PUMP
    def all_loading_pump(self):

        # get the values
        sbp = self.create_lp_starting_bp()
        ep = self.create_lp_end_pressure()
        ai = self.create_lp_air_injection()
        vss = self.create_lp_valve_spike_start()
        vse = self.create_lp_valve_spike_start()
        pd_lp = sbp - ep

        # set-up dict for metrics and insert
        metrics = {"sbp": sbp, "ep": ep, "ai": ai, "vss": vss, "vse": vse, "pd-lp": pd_lp}
        self.insert_metrics(metrics)
        logger.info("Inserted Loading Pump")

    def all_nano_pump(self):

        # get the values
        sp = self.create_np_starting_pressure()
        vd_end = self.create_np_valve_drop()[0]
        vd = sp - vd_end
        il_end = self.create_np_inline_leak()
        il = sp - il_end
        maxp = self.create_np_max_pressure()
        minp = self.create_np_min_pressure()
        pd = self.create_np_pressure_diff()

        # set up dict for metrics and insert
        metrics = {"sp": sp, "vd": vd, "maxp": maxp, "minp": minp, "il": il, "pd": pd}
        self.insert_metrics(metrics)
        logger.info("Inserted Nano Pump")

    def all_main_pump(self):
        # mp_names = ["maxp-metab", "rt-maxp", "sp-metab", "ep-metab"]

        # get the values
        mp_max = self.create_mp_max_pressure()
        maxp = mp_max[0]
        rt = mp_max[1]
        sp = self.create_mp_starting_pressure()
        ep = self.create_mp_end_pressure()

        # set up dict for metrics
        metrics = {"maxp-metab": maxp, "rt-maxp": rt, "sp-metab": sp, "ep-metab": ep}
        self.insert_metrics(metrics)
        logger.info("Inserted Main Pump")

        
    # INSERT FUNCTIONS  
    def insert_pressure_profile(self, pump):

        # get the profile data, convert to json and insert
        data = self.create_data_bins(pump)
        json_data = json.dumps(data, separators=(",", ":"))

        sql = "INSERT INTO pressure_profile VALUES(NULL,'" + json_data + "','" + str(pump) + "','" + str(self.run_id) + "')"

        try:
            self.db.cursor.execute(sql)
        except Exception as e:
            logger.exception(e)

        self.db.db.commit()
        
    def insert_co_temp(self):
        co_temp = self.create_column_range()
        metrics = {"co": co_temp}
        self.insert_metrics(metrics)
        logger.info("Inserted Column Temp")

    
    def insert_metrics(self, metrics):
        # INSERT (called by "all" functions)
        for metric in metrics:
            sql = "SELECT metric_id FROM metric WHERE metric_name = '" + metric + "'"
            try:
                self.db.cursor.execute(sql)
                metric_id = self.db.cursor.fetchone()[0]
            except Exception as e:
                logger.exception(e)

            insert_sql = "INSERT INTO measurement VALUES('" + str(metric_id) + "','" + \
                         str(self.comp_id) + "','" + str(self.run_id) + "','" + str(metrics[metric]) + "')"

            try:
                self.db.cursor.execute(insert_sql)
            except Exception as e:
                logger.exception(e)

        self.db.db.commit()
        
