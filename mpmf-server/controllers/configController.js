var fs = require('fs');
var os = require('os');

// Get configuration grids
exports.config_home = function(req, res) {

    // request normal display
    var size = Object.keys(req.query).length;
    if(size == 0){
        res.render('config', {op_system: os.platform()});
        return;
    }

    // get data from query strings
    var exp = req.query.experiment;
    var config = JSON.parse(req.query.config);
    var custom_config = JSON.parse(req.query.config);
    var instruments = config.instruments.settings;
    var components = config.component.settings;
    var contacts = config.contacts.settings;
    var email = config.email.settings;
    var thresholds = config.thresholds.settings;
    var in_folder = config.in_folder.settings;
    var out_folder = config.out_folder.settings;
    //var database_info = config.Database.settings;
    
    
    if(exp == "Proteomics"){
        var thresholds_ms2 = config.thresholds_ms2.settings;
        var pump_times = config.pump.settings;
    }
    
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
    
    //console.log(instruments);
    //console.log(components);
    //console.log(contacts);
    //console.log(thresholds);
    //console.log(in_folder);
    //console.log(out_folder);
    //console.log(database_info);
    //console.log(email[0]);
    
    // email config file
    var new_email_file = "";
    for(var i=0; i<contacts.length; i++){
        var new_line = contacts[i].Email + "|" + contacts[i].Name + "\n";
        new_email_file += new_line;
    }

    // directory config file
    var new_dir_file = in_folder[0].Location + "|" + out_folder[0].Location + "\n";

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

    // machines file
    var machines_file = "";
    var types = {"0": "none", "1": "agilent", "2": "bruker", "3": "thermo", 
                    "4": "sciex", "5": "shimadzu", "6": "waters", "7": "other"};
    var machines_json = {};
    for(var i=0; i<instruments.length; i++){

        // machines file
        var new_type = instruments[i].Type;
        var new_line = instruments[i].Name + "|" + types[new_type] + "\n";
        machines_file += new_line;

        // thresholds json for ms2 (for current percentile readings)
        if(exp == "Proteomics"){
            machines_json[instruments[i].Name] = {"MS/MS Spectra":0 , "Target PSMs":0, 
            "Unique Target Peptides":0, "Target Protein Groups":0};
        }
    }

    // reconfig writes and database (thresh, components and machines)

    // components
    config.component.fields[0]["editing"] = false;
    config.component.fields[3]["editing"] = false;
    config.component.fields[config.component.fields.length-1]["deleteButton"] = false;
    config.component["grid-configuration"].inserting = false;

    // machines (delete from config file)
    delete config["instruments"];
    delete config["Database"];

    // custom config file
    custom_config.component.fields[0]["editing"] = false;
    custom_config.component.fields[1]["editing"] = false;
    custom_config.component.fields[3]["editing"] = false;
    custom_config.component.fields[custom_config.component.fields.length-1]["deleteButton"] = false;
    custom_config.component["grid-configuration"].inserting = false;

    // delete all but components and thresholds (and pump for proteomics)
    delete custom_config["instruments"];
    delete custom_config["contacts"];
    delete custom_config["in_folder"];
    delete custom_config["out_folder"];
    delete custom_config["Database"];
    delete custom_config["email"];
    
    
    // write config files for metab and prot 
    if(exp == "Metabolomics"){

        // save custom config
        fs.writeFile('./public/data/customconfigMetab.json', JSON.stringify(custom_config), function (err) {
            if (err) error_handle(err);
        });

        // save reconfig
        fs.writeFile('./public/data/reconfigMetab.json', JSON.stringify(config), function (err) {
            if (err) error_handle(err);
        });

        // save config for UI
        fs.writeFile('./public/data/configurationMetab.json', req.query.config, function (err) {
            if (err) error_handle(err);
        });

        // contacts file
        fs.writeFile('../mpmf-pipeline/Config/contacts/contacts-metabolomics.csv', new_email_file, function (err) {
            if (err) error_handle(err);
        });

        // directory file
        fs.writeFile('../mpmf-pipeline/Config/dir-metabolomics.csv', new_dir_file, function (err) {
            if (err) error_handle(err);
        });

        // threshold file
        fs.writeFile('../mpmf-pipeline/Config/thresholds/metab-thresholds-default.txt', new_thresh_file, function (err) {
            if (err) error_handle(err);
        });

        // machines file
        fs.writeFile('../mpmf-pipeline/Config/metab-machines.txt', machines_file, function (err) {
            if (err) error_handle(err);
        });

        // component file (neg)
        fs.writeFile('../mpmf-pipeline/Config/databases/negative-db-Default.csv', new_comp_file_neg, function (err) {
            if (err) error_handle(err);
        });

        // component file (pos)
        fs.writeFile('../mpmf-pipeline/Config/databases/positive-db-Default.csv', new_comp_file_pos, function (err) {
            if (err) error_handle(err);
        });

        // email info
        fs.writeFile('../mpmf-pipeline/Config/contacts/email-server-metabolomics.json', JSON.stringify(email[0]), function (err) {
           if (err) error_handle(err);
        });

        // database info (processing)
        //fs.writeFile('../mpmf-pipeline/Config/database-login.json', JSON.stringify(database_info[0]), function (err) {
        //    if (err) error_handle(err);
        //});
    } else {

        // save custom config
        fs.writeFile('./public/data/customconfigProt.json', JSON.stringify(custom_config), function (err) {
            if (err) error_handle(err);
        });

        // save reconfig
        fs.writeFile('./public/data/reconfigProt.json', JSON.stringify(config), function (err) {
            if (err) error_handle(err);
        });

        // save config for UI
        fs.writeFile('./public/data/configurationProt.json', req.query.config, function (err) {
            if (err) error_handle(err);
        }); 

        // contacts file
        fs.writeFile('../mpmf-pipeline/Config/contacts/contacts-proteomics.csv', new_email_file, function (err) {
            if (err) error_handle(err);
        });

        // directory file
        fs.writeFile('../mpmf-pipeline/Config/dir-proteomics.csv', new_dir_file, function (err) {
            if (err) error_handle(err);
        });

        // threshold file
        fs.writeFile('../mpmf-pipeline/Config/thresholds/proteomics-thresholds-default.txt', new_thresh_file, function (err) {
            if (err) error_handle(err);
        });

        // file to store current ms2 threshold percentile readings
        fs.writeFile('../mpmf-pipeline/Config/thresholds/thresholds-ms2-percentiles.json', JSON.stringify(machines_json), function (err) {
            if (err) error_handle(err);
        }); 

        // machines file
        fs.writeFile('../mpmf-pipeline/Config/prot-machines.txt', machines_file, function (err) {
            if (err) error_handle(err);
        });

        // component file
        fs.writeFile('../mpmf-pipeline/Config/databases/iRT-Reference-Default.csv', new_comp_file, function (err) {
            if (err) error_handle(err);
        });

        // loading pump valve times file
        fs.writeFile('../mpmf-pipeline/Config/pump/loading-pump.csv', pump_file, function (err) {
            if (err) error_handle(err);
        });

        // email info
        fs.writeFile('../mpmf-pipeline/Config/contacts/email-server-proteomics.json', JSON.stringify(email[0]), function (err) {
            if (err) error_handle(err);
        });

        // database info (processing)
        //fs.writeFile('../mpmf-pipeline/Config/database-login.json', JSON.stringify(database_info[0]), function (err) {
        //    if (err) error_handle(err);
        //});
    }

    // render page
    res.render('config', {op_system: os.platform()});

    // handle errors 
    function error_handle(e){
        console.log(e.name + ": " + e.message);
    }

}