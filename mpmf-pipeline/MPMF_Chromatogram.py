import base64 # peak data is base64 encoded
import json # store chromatograms and spectra as json
import math
import os
import struct # data is stored in binary form
import sys
import xml.etree.ElementTree as et # descriptions of the scans are stored as xml
import zipfile # mzmine files are zip files


class Chromatogram:

    def __init__(self, filename, filesystem, exp, machine, db):

        self.file_name = filename
        self.experiment = exp
        self.machine = machine
        self.fs = filesystem
        self.db = db
        self.db.db.commit()  # commit for any other instances
        self.run_id = self.db.get_run_id(self.file_name)
        self.outfiles_dir = os.path.join(self.fs.out_dir, self.experiment, self.machine, self.file_name)
        self.path = os.path.join(self.outfiles_dir, self.file_name + ".mzmine")
        self.peaklistfiles = []
        self.scansfiles = []
        self.rawdatafiles = []

        if not os.path.isfile(self.path):
            print("file " + self.path + " does not exist")
            sys.exit(1)

        self.unzip_files()
        self.create_xic()
        print("INSERTED CHROMATOGRAMS for " + self.file_name)

    def unzip_files(self):
        with zipfile.ZipFile(self.path, "r") as _zip:
            # get all files in mzmine file
            namelist = _zip.namelist()

            # find files
            for filename in namelist:
                if filename.startswith("Peak list #") and filename.endswith(".xml"):
                    self.peaklistfiles.append(filename)
                elif filename.startswith("Raw data file #") and filename.endswith(".scans"):
                    self.scansfiles.append(filename)
                elif filename.startswith("Raw data file #") and filename.endswith(".xml"):
                    self.rawdatafiles.append(filename)
            # extract files
            for peaklistfile in self.peaklistfiles:
                _zip.extract(peaklistfile, self.outfiles_dir)
            for scansfile in self.scansfiles:
                _zip.extract(scansfile, self.outfiles_dir)
            for rawdatafile in self.rawdatafiles:
                _zip.extract(rawdatafile, self.outfiles_dir)
            _zip.close()

    def create_xic(self):
        # for every peak file
        for peaklistfile in self.peaklistfiles:
            # store peaks as dictionary
            peaksdict = {}

            # parse xml file
            tree = et.parse(os.path.join(self.outfiles_dir, peaklistfile))
            root = tree.getroot()

            # peak list name
            peaksdict["name"] = root.find("pl_name").text
            # number of peaks
            peaksdict["numberofpeaks"] = int(root.find("quantity").text)
            # corresponding raw file
            peaksdict["rawfile"] = root.find("raw_file").text
            peaksdict["peaks"] = {}

            k = 0
            # every row describes a compound peak
            for row in root.findall("row"):
                k += 1
                peakdict = {}
                # get peak information
                peakdict["id"] = int(row.get("id"))
                peakdict["name"] = row.find("identity/identity_property").text
                peakdict["chromatogram"] = [[], []]
                peak = row.find("peak")
                # store xic for peak as dictionary
                xic = {}
                if not peak is None:
                    peakdict["mzval"] = float(peak.get("mz"))
                    # rentention time is float in seconds
                    peakdict["rt"] = float(peak.get("rt")) / 60.0
                    peakdict["height"] = float(peak.get("height"))
                    peakdict["area"] = float(peak.get("area"))
                    peakdict["bestscanid"] = int(peak.find("best_scan").text)
                    mzpeaks = peak.find("mzpeaks")
                    quantity = int(mzpeaks.get("quantity"))
                    scanidbin = mzpeaks.find("scan_id").text
                    # scan IDs are stored as binary data and base64 encoded
                    # (1) base64 decode
                    # (2) unpack binary data
                    # integer (i) or unsigned integer (I) or long (l) or unsigned long (L), integer seems to work
                    # data is stored as integer -> "i", data is stored big endian -> ">" => format description ">i"
                    scanids = struct.unpack(">" + str(quantity) + "i", base64.b64decode(scanidbin))
                    mzbin = mzpeaks.find("mz").text
                    # mz values are stored as binary data and base64 encoded
                    # (1) base64 decode
                    # (2) unpack binary data
                    # data is stored as float -> "f", data is stored big endian -> ">" => format description ">f"
                    mzvalues = struct.unpack(">" + str(quantity) + "f", base64.b64decode(mzbin))
                    heightbin = mzpeaks.find("height").text
                    # heights are stored as binary data and base64 encoded
                    # (1) base64 decode
                    # (2) unpack binary data
                    # data is stored as float -> "f", data is stored big endian -> ">" => format description ">f"
                    heights = struct.unpack(">" + str(quantity) + "f", base64.b64decode(heightbin))
                    #print(scanids)
                    #print(mzvalues)
                    #print(heights)
                    #print()

                    # add peak data to xic
                    xic["scanids"] = scanids
                    xic["mzvals"] = mzvalues
                    xic["heights"] = heights
                    peakdict["xic"] = xic
                    peaksdict["peaks"][peakdict["id"]] = peakdict

            if k != peaksdict["numberofpeaks"]:
                print("mismatch between number of peaks and peaks read")

            scansfile = None
            rawdatafile = None
            for filename in self.scansfiles:
                if filename.startswith("Raw data file #" + peaksdict["rawfile"]):
                    scansfile = filename
            for filename in self.rawdatafiles:
                if filename.startswith("Raw data file #" + peaksdict["rawfile"]):
                    rawdatafile = filename

            # store scans as dictionary
            scansdict = {}
            if scansfile and rawdatafile:
                # read the xml first to get metadata, read the scans file then
                # parse xml file
                tree = et.parse(os.path.join(self.outfiles_dir, rawdatafile))
                root = tree.getroot()

                scansdict["name"] = root.find("name").text

                # get stored data points from xml file
                # describes the offset and number of data points in the scans file
                storeddatapoints = root.find("stored_datapoints")
                numdatapoints = int(storeddatapoints.get("quantity"))
                storage = [{} for k in range(0, numdatapoints)]
                for storeddata in storeddatapoints.findall("stored_data"):
                    storageid = int(storeddata.get("storage_id"))
                    storage[storageid - 1]["numberofdatapoints"] = int(storeddata.get("num_dp"))
                    storage[storageid - 1]["offset"] = int(storeddata.text)

                # get number of scans in scans file
                scansdict["numberofscans"] = int(root.find("num_scans").text)
                # validata number of data points against number of scans
                if scansdict["numberofscans"] != numdatapoints:
                    print("mismatch between number of data points and number of scans")

                scansdict["scans"] = {}
                # open the scans file as binary file
                f = open(os.path.join(self.outfiles_dir, scansfile), "rb")

                for scan in root.findall("scan"):
                    scandict = {}
                    # get information about each scan from xml file
                    storageid = int(scan.get("storage_id"))
                    scandict["id"] = int(scan.find("id").text)
                    scandict["mslevel"] = int(scan.find("mslevel").text)
                    # rentention time is float in seconds
                    scandict["rt"] = float(scan.find("rt").text) / 60.0
                    scandict["centroid"] = scan.find("centroid").text
                    # number of data points is stored here as well
                    scandict["numberofdatapoints"] = int(scan.find("num_dp").text)
                    # validata number of data points from storage against number of data points from scan metadata
                    if scandict["numberofdatapoints"] != storage[storageid - 1]["numberofdatapoints"]:
                        print("mismatch between number of data points in storage and number of data points in scan")
                    if scandict["numberofdatapoints"] == 0:
                        continue
                    scandict["polarity"] = scan.find("polarity").text
                    scandict["description"] = scan.find("scan_description").text
                    scandict["mzrange"] = scan.find("scan_mz_range").text

                    # set position in scans file according to offset from storage data
                    f.seek(storage[storageid - 1]["offset"], 0)
                    # read number of data points from scans file
                    # each data point (8 bytes) has two floats (2 * 4 bytes) stored, m/z value and intensity
                    scandatabin = f.read(storage[storageid - 1]["numberofdatapoints"] * 2 * 4)
                    # unpack binary values
                    # data is stored as float -> "f", data is stored big endian -> ">" => format description ">f"
                    # add number of data points to format description => ">###f"
                    # return value from unpack is tuple
                    scandata = struct.unpack(">" + str(storage[storageid - 1]["numberofdatapoints"] * 2) + "f",
                                             scandatabin)
                    scandict["data"] = (scandata[0:-1:2], scandata[1::2])
                    scansdict["scans"][scandict["id"]] = scandict

                f.close()

            # create chromatograms for peaks
            if scansdict:
                # TODO: add filter for polarity?
                # sort scans by scan id
                # for each scan
                for _id in sorted(scansdict["scans"].keys()):
                    scandict = scansdict["scans"][_id]
                    if scandict["mslevel"] == 1:
                        # for each peak filter scan data according the min / max mz value and add to peak chromatogram
                        for peakdict in peaksdict["peaks"].values():
                            peakdict["chromatogram"][0].append(scandict["rt"])
                            mzvaluemin = min(peakdict["xic"]["mzvals"])
                            mzvaluemax = max(peakdict["xic"]["mzvals"])
                            intensities = [0]
                            for _id, mzvalue in enumerate(scandict["data"][0]):
                                if mzvalue >= mzvaluemin and mzvalue <= mzvaluemax:
                                    intensities.append(scandict["data"][1][_id])
                            peakdict["chromatogram"][1].append(max(intensities))

            # save json
            with open(os.path.join(self.outfiles_dir, peaklistfile.replace(".xml", ".json")), "w") as jsonfile:
                json.dump(peaksdict, jsonfile)

            self.insert_chromatograms(peaksdict)

    def insert_chromatograms(self, peaksdict):
        precision = 0

        for peakdict in peaksdict["peaks"].values():

            x = peakdict["chromatogram"][0]
            y = peakdict["chromatogram"][1]

            # x_sec = []
            # y_sec = []
            # imax = 0
            # second = math.ceil(x[0] * 60)
            # zerobeforemax = False
            # zeroaftermax = False
            # for k in range(0, len(x)):
                # if x[k] * 60 > second:
                    # # check whether intensity dropped to zero before peak
                    # # avoid storing two zeros for same second - 0.5
                    # if imax > 0 and zerobeforemax and (not x_sec or x_sec[-1] < second - 0.5):
                        # x_sec.append(second - 0.5)
                        # y_sec.append(0)
                    # x_sec.append(second)
                    # y_sec.append(int(round(imax, precision)))
                    # # check whether intensity dropped to zero after peak
                    # if imax > 0 and zeroaftermax:
                        # x_sec.append(second + 0.5)
                        # y_sec.append(0)
                    # imax = 0
                    # second = math.ceil(x[k] * 60)
                    # zerobeforemax = False
                    # zeroaftermax = False
                # if imax == 0 and y[k] == 0:
                    # zerobeforemax = True
                # if y[k] > imax:
                    # imax = y[k]
                # if imax > 0 and y[k] == 0:
                    # zeroaftermax = True
            # # check whether the last values have been stored in x_sec, y_sec
            # if x_sec[-1] < second:
                # if imax > 0 and zerobeforemax and (not x_sec or x_sec[-1] < second - 0.5):
                    # x_sec.append(second - 0.5)
                    # y_sec.append(0)
                # x_sec.append(second)
                # y_sec.append(int(round(imax, precision)))
                # if imax > 0 and zeroaftermax:
                    # x_sec.append(second + 0.5)
                    # y_sec.append(0)
            # round retention times with precision 3 and itensities with precision 'precision'
            x_sec = [round(x[k], 3) for k in range(0, len(x))]
            # casting to int must be removed if precision > 0
            y_sec = [int(round(y[k], precision)) for k in range(0, len(y))]

            # remove adjacent zeros
            k = 0
            indices = []
            while k < len(y_sec):
                if y_sec[k] == 0:
                    start = k
                    stop = k
                    k += 1
                    while k < len(y_sec) and y_sec[k] == 0:
                        stop = k
                        k += 1
                    if stop - start >= 2:
                        indices.extend(list(range(start + 1, stop)))
                else:
                    k += 1
            x_sec = [val for idx, val in enumerate(x_sec) if idx not in indices]
            y_sec = [val for idx, val in enumerate(y_sec) if idx not in indices]

            # transform retention times to vector containing the first retention time and only the retention time delta for all following values
            # multiply resulting values by 1000 to store them as integers
            x_sec = [round((x_sec[k] - x_sec[k - 1]) * 1000) if k > 0 else round(x_sec[0] * 1000) for k in range(0, len(x_sec))]

            chrom_data = {"rts": x_sec, "intensities": y_sec, "mz": peakdict["mzval"], "exp_rt": peakdict["rt"]}
            comp_id = self.db.get_component_id(peakdict["name"])
            self.insert_chromatogram_data(comp_id, chrom_data)

    def insert_chromatogram_data(self, c_id, chrom_dict):

        json_data = json.dumps(chrom_dict, separators=(",", ":"))

        sql = "INSERT INTO chromatogram VALUES(NULL,'" + json_data + "','" + str(self.run_id) + \
                    "','" + str(c_id) + "')"

        try:
            self.db.cursor.execute(sql)
        except Exception as e:
            print(e)

        self.db.db.commit()

    def get_rt_indexes(self, start, rts):
        min_index = 0
        max_index = 0
        tail = 5

        # find min index
        for i in range(len(rts)):
            if rts[i] > start - tail:
                min_index = i
                break

        # find max index
        for i in range(min_index, len(rts) -1):
            if rts[i] > start + tail:
                max_index = i
                break

        return {"start_index" :min_index, "end_index": max_index}

    def create_data_bins(self, rts, intensities):

        start_time = int(round(rts[0]*60, 0))

        x = rts
        y = intensities
        skip = 1
        second = start_time + skip
        max_rt = 0
        y_sec = [y[0]]  # append start intensity
        for index in range(1, len(x)):
            # check for max per second
            if y[index] > max_rt:
                max_rt = y[index]

            # next second
            if x[index] * 60 > second:
                y_sec.append(max_rt)  # append max for previous sec
                max_rt = 0  # reset for next second
                second += skip


        # count zeroes
        zero = 0
        for i in y_sec:
            if i == 0:
                zero += 1

        return {'start_rt' : start_time, 'intensities' : y_sec}

    def check_json(self):

        comp_id = 3
        sql = "SELECT chrom_data FROM chromatogram WHERE component_id = '" + str(comp_id) + \
                "' AND run_id = '" + str(self.run_id) + "'"

        try:
            self.db.cursor.execute(sql)
            profile = self.db.cursor.fetchall()
        except Exception as e:
            print(e)

        profile_dict = json.loads(profile[0][0])
        print(profile_dict["mz"])

