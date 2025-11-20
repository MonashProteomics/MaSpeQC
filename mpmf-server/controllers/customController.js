/*!
* MaSpeQC - Quality control software for LC-MS/MS instrumentation
*
* Copyright (C) 2018-2025  Simon Caven
* Copyright (C) 2020-2025  Monash University
* Copyright (C) 2022-2025  University of Applied Sciences Mittweida
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as published
* by the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

const fs = require('fs');
const os = require('os');

// Get configuration grids
exports.custom_home = function(req, res) {

    // look-up object for metric names
    var metric_names = {
        "Mass Error (ppm)" : "mass_error_ppm",
        "Retention Time (minutes)" : "rt",
        "Area Normalised" : "area_normalised",
        "Area Normalised (percentile)" : "area_normalised",
        "Full Width Half Maximum (seconds)" : "fwhm",
        "Tailing Factor (seconds)" : "tf",
        "Asymmetry Factor (seconds)" : "af",
        "MS/MS Spectra (percentile)" : "MS/MS Spectra",
        "Target PSMs (percentile)" : "Target PSMs",
        "Unique Target Peptides (percentile)" : "Unique Target Peptides",
        "Target Protein Groups (percentile)" : "Target Protein Groups",
        "Precursor Mass Error (ppm)" : "Precursor Mass Error"
    }

    var caller = req.query.caller;
    var machine = req.query.machine;
    
    if(caller == "main"){
        res.render('custom', {'type': caller, 'machine': machine, op_system: os.platform()});
        return;
    }

    if(caller == "custom"){

        var config = JSON.parse(req.query.config);
        var components = config.component.settings;
        var thresholds = config.thresholds.settings;
        var exp = req.query.experiment;

        if(exp == "Proteomics"){
            var thresholds_ms2 = config.thresholds_ms2.settings;
            var pump_times = config.pump.settings;
        }
        
        // thresholds file (LCMS)
        var new_thresh_file = "metric|trigger|threshold_low|threshold_high\n";
        for(var i=0; i<thresholds.length; i++){
            var new_line = metric_names[thresholds[i].Metric] + "|" + thresholds[i].Trigger + "|";
            // lower threshold
            if('Lower Threshold' in thresholds[i]){
                new_line += thresholds[i]["Lower Threshold"] + "|"
            }
            else{
                new_line += "|"
            }

            // upper threshold
            if('Upper Threshold' in thresholds[i]){
                new_line += thresholds[i]["Upper Threshold"]
            }
            new_thresh_file += new_line + "\n"
        }
        
        // threshold file (MS2)
        if(exp == "Proteomics"){
            for(var i=0; i<thresholds_ms2.length; i++){
                var new_line = metric_names[thresholds_ms2[i].Metric] + "|" + "1" + "|";

                // lower threshold
                if('Lower Threshold' in thresholds_ms2[i]){
                    new_line += thresholds_ms2[i]["Lower Threshold"] + "|"
                }
                else{
                    new_line += "|"
                }

                // upper threshold
                if('Upper Threshold' in thresholds_ms2[i]){
                    new_line += thresholds_ms2[i]["Upper Threshold"]
                }
                new_thresh_file += new_line + "\n"
            }

            // pump times
            var pump_file = pump_times[0]["Valve Start"] + "|" + pump_times[0]["Valve End"] + "\n";
            console.log(pump_file);
        }
        
        // components file (Proteomics)
        if(exp == "Proteomics"){
            var new_comp_file = "mz|RT|Name\n";
            for(var i=0; i<components.length; i++){
                var new_line = components[i].mz + "|" + components[i]['RT (minutes)'] + "|" + components[i].Name + "\n";
                new_comp_file += new_line;
            }
        }

        // components file (Metabolomics)
        if(exp == "Metabolomics"){
            var new_comp_file_pos = "mz|RT|Name\n";
            var new_comp_file_neg = "mz|RT|Name\n";
            for(var i=0; i<components.length; i++){
                var new_line = components[i].mz + "|" + components[i]['RT (minutes)'] + "|" + components[i].Name + "\n";
                if(components[i].Polarity == 1){
                    new_comp_file_pos += new_line;
                }
                else{
                    new_comp_file_neg += new_line;
                }
            }
        }

        // write config files for metab and prot 
        if(exp == "Metabolomics"){

            // save new custom json
            fs.writeFile('./public/data/customconfigMetab' + machine + '.json', JSON.stringify(config), function (err) {
                if (err) error_handle(err);
            });

            // threshold file
            fs.writeFile('../mpmf-pipeline/Config/thresholds/metab-thresholds-' + machine + '.txt', new_thresh_file, function (err) {
                if (err) error_handle(err);
            });

            // component file (neg)
            fs.writeFile('../mpmf-pipeline/Config/databases/negative-db-' + machine + '.csv', new_comp_file_neg, function (err) {
                if (err) error_handle(err);
            });

            // component file (pos)
            fs.writeFile('../mpmf-pipeline/Config/databases/positive-db-' + machine + '.csv', new_comp_file_pos, function (err) {
                if (err) error_handle(err);
            });
        } else {

            // save new custom json
            fs.writeFile('./public/data/customconfigProt' + machine + '.json', JSON.stringify(config), function (err) {
                if (err) error_handle(err);
            });

            // threshold file
            fs.writeFile('../mpmf-pipeline/Config/thresholds/proteomics-thresholds-' + machine + '.txt', new_thresh_file, function (err) {
                if (err) error_handle(err);
            });

            // component file
            fs.writeFile('../mpmf-pipeline/Config/databases/iRT-Reference-' + machine + '.csv', new_comp_file, function (err) {
                if (err) error_handle(err);
            });

            // loading pump valve times file
            fs.writeFile('../mpmf-pipeline/Config/pump/loading-pump-' + machine + '.csv', pump_file, function (err) {
                if (err) error_handle(err);
            });
        }

        res.render('custom', {'type': caller, 'machine': machine, op_system: os.platform()});
        return;
        }
    
    // handle errors 
    function error_handle(e){
        console.log(e.name + ": " + e.message);
    }

}