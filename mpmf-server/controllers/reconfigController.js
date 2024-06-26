var db = require('../models/modelDB');
var fs = require('fs');

// Get reconfiguration grids
exports.reconfig_home = function(req, res) {


    // look-up objects
    var types = {"other": 0, "agilent": 1, "bruker": 2, "thermo": 3};
    var vendors = {"0": "other", "1": "agilent", "2": "bruker", "3": "thermo"};
    var use = {"Y": 0, "N": 1}
    var convert = {"0": "Y", "1": "N"}

    // machines for instruments grid
    var machines;
    var sql = "SELECT * FROM machine";

    // number of machines in DB
    var machine_no;

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
    
    // execute promise for sql query
    let p1 = db.execute(sql).then(
        result => machines = result
    ).catch(
        error => error_handle(error)
    );

    // wait for promise and chain next functions
    Promise.all([p1]).then(
       function(){
           return create_instruments_grid();
       }
    ).then((machine_length) => {
        var size = Object.keys(req.query).length;
        if(size == 0){ // no query strings, load normal page
            res.render('reconfig');
            return;
        } 
        else{
            var exp = req.query.experiment; 
            if(exp == "Instruments"){
                var p1 = update_instruments(machine_length);
                var p2 = update_ms2_json(); // threshold file (current percentiles)

                // wait for the functions to run then render
                Promise.all([p1 ,p2]).then(function(){
                    res.render('reconfig');
                }).catch(
                    error => error_handle(error)
                ); 
            }
            else{
                // *update ms2 (REMOVE this comment after testing)
                var p1 = update_config();
                // *update lcms (REMOVE this comment after testing)
                var p2 = update_components();
                
                // wait for the functions to run then render
                Promise.all([p1, p2]).then(function(){
                    setTimeout(function(){
                        res.render('reconfig');
                    },100);
                }).catch(
                    error => error_handle(error)
                );
            }
        }
    })
    .catch(
        error => error_handle(error)
    );

    function update_ms2_json(){
        var config = JSON.parse(req.query.config);
        var instruments = config.instruments.settings;
        
        // read threshold file
        var check = false;
        var threshold_json = JSON.parse(fs.readFileSync("../mpmf-pipeline/Config/thresholds/thresholds-ms2-percentiles.json", 'utf-8'));
        for(let instr in instruments){
            if(instruments[instr]['Use Proteomics'] == 0){
                if(!(instruments[instr]['Name'] in threshold_json)){
                    // add if no entry
                    threshold_json[instruments[instr]['Name']] = {
                        "MS/MS Spectra": 0,
                        "Target PSMs": 0,
                        "Unique Target Peptides": 0,
                        "Target Protein Groups": 0
                    }
                    check  = true;
                }
            }
        }

        // save file
        if(check){
            fs.writeFile("../mpmf-pipeline/Config/thresholds/thresholds-ms2-percentiles.json", JSON.stringify(threshold_json), function (err) {
                if (err) error_handle(err);
            });
        }

    }
    
    function create_instruments_grid(){
        // add instruments settings
        machine_no = machines.length;

        // read instruments file and add settings
        fs.readFile('./public/data/instruments.json', function (err, data) {
            if (err) error_handle(err);
            var instruments_file = JSON.parse(data);

            // only if no settings (first load)
            if(!("settings" in instruments_file["instruments"])){

                var settings = [];
                for(let machine in machines){
                    var new_machine = {};
                    new_machine["Name"] = machines[machine]["machine_name"];
                    new_machine["Type"] = types[machines[machine]["machine_type"]];
                    new_machine["Use Proteomics"] = use[machines[machine]["use_prot"]];
                    new_machine["Use Metabolomics"] = use[machines[machine]["use_metab"]];
                    new_machine["Custom"] = "<button data-name=" +  machines[machine]["machine_name"] + " onclick='loadCustom()' class='btn btn-dark custom'>Customize</button>";
                    settings.push(new_machine);
                }

                instruments_file["instruments"]["settings"] = settings;

                // save instruments with settings 
                fs.writeFile('./public/data/instruments.json', JSON.stringify(instruments_file), function (err) {
                    if (err) error_handle(err);
                });
            }
        });

        return machine_no;
    }

    function update_instruments(machine_length){
        var config = JSON.parse(req.query.config);
        var instruments = config.instruments.settings;
        var instruments_no = instruments.length;
        var all_promises = [];
    
        for(var i = 0; i<machine_length; i++){
            let sql = "UPDATE machine SET use_prot = '" + convert[instruments[i]["Use Proteomics"]] + 
                        "', use_metab = '" + convert[instruments[i]["Use Metabolomics"]] +
                        "' WHERE machine_name = '" + instruments[i]["Name"] + "'";

            var p1 = db.execute(sql).catch(
                error => error_handle(error)
            );

            all_promises.push(p1);
        }

        setTimeout(function(){
            // check for added machines and insert
            if(instruments_no > machine_length){
                for(let i=machine_length; i<instruments_no; i++){
                    let sql = "INSERT INTO machine VALUES (NULL, '" + instruments[i]["Name"] + "',NULL, NULL,'" +
                        convert[instruments[i]["Use Metabolomics"]] + "','" + convert[instruments[i]["Use Proteomics"]] +
                        "','" + vendors[instruments[i]["Type"]] + "')";

                    var p1 = db.execute(sql).catch(
                        error => error_handle(error)
                    );
        
                    all_promises.push(p1);
                }
            }
        }, 50)
        

        setTimeout(function(){
            // save instruments with settings
            fs.writeFile('./public/data/instruments.json', JSON.stringify(config), function (err) {
                if (err) error_handle(err);
            });
        }, 50);

        Promise.all(all_promises).then(result => {return});
        
    }

    // updates for metabolomics and proteomics buttons
    function update_config(){
        // get data from query strings
        var exp = req.query.experiment;
        var config = JSON.parse(req.query.config);
        var components = config.component.settings;
        var contacts = config.contacts.settings;
        var email = config.email.settings;
        var thresholds = config.thresholds.settings;
        var in_folder = config.in_folder.settings;
        var out_folder = config.out_folder.settings;
        if(exp == "Proteomics"){
            var thresholds_ms2 = config.thresholds_ms2.settings;
            var pump_times = config.pump.settings;
            //console.log(thresholds_ms2);
            //console.log(pump_times);
        }

        //console.log(components);
        //console.log(contacts);
        //console.log(thresholds);
        //console.log(in_folder);
        //console.log(out_folder);

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
                var new_line = components[i].mz + "|" + components[i]['RT (minutes)']+ "|" + components[i].Name + "\n";
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

            // save reconfig
            fs.writeFile('./public/data/reconfigMetab.json', JSON.stringify(config), function (err) {
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

        } else {

            // save reconfig
            fs.writeFile('./public/data/reconfigProt.json', JSON.stringify(config), function (err) {
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
        }  
    }

    // OLD NOT USED (remove after testing)
    function update_lcms(){
        /* DATABASE UPDATES lcms thresholds*/
        var config = JSON.parse(req.query.config);
        var thresholds = config.thresholds.settings;
        var exp = req.query.experiment;
        var exp_id ;
        var all_promises = [];
        
        // update thresholds in DB (LC-MS)
        let sql_exp = "SELECT experiment_id FROM experiment WHERE experiment_type = '" + exp.toLowerCase() + "'";

        let p1 = db.execute(sql_exp).then(
            result => exp_id = result[0]["experiment_id"]
        ).catch(
            error => error_handle(error)
        );

        Promise.all([p1])
        .then(async function(){
            
            for(var index=0; index < thresholds.length; index++){
                let sql = "SELECT metric_id FROM metric WHERE metric_name = '" + metric_names[thresholds[index]["Metric"]] + "'";
                var results;

                let p2 = await db.execute(sql).then(
                    result => results = [result[0]["metric_id"],index]
                ).catch(
                    error => error_handle(error)
                );
                
                Promise.all([p2]).then(function(){
                    // triggers
                    var sql = "UPDATE threshold SET threshold_trigger = '" + thresholds[results[1]]["Trigger"] +
                        "' WHERE experiment_id = '" + exp_id + "' AND metric_id = '" + results[0] + "'";
                    
                    var p3 = db.execute(sql).catch(
                        error => error_handle(error)
                    );
        
                    all_promises.push(p3);

                    // upper (if exists)
                    if("Upper Threshold" in thresholds[results[1]]){
                        if(thresholds[results[1]]["Upper Threshold"] != ""){
                            var sql = "UPDATE threshold SET threshold_high = '" + thresholds[results[1]]["Upper Threshold"] +
                            "' WHERE experiment_id = '" + exp_id + "' AND metric_id = '" + results[0] + "'";
                            
                            var p3 = db.execute(sql).catch(
                                error => error_handle(error)
                            );
                
                            all_promises.push(p3);
                        }
                    }

                    // lower (if exists)
                    if("Lower Threshold" in thresholds[results[1]]){
                        if(thresholds[results[1]]["Lower Threshold"] != ""){
                            var sql = "UPDATE threshold SET threshold_low = '" + thresholds[results[1]]["Lower Threshold"] +
                            "' WHERE experiment_id = '" + exp_id + "' AND metric_id = '" + results[0] + "'";
                            
                            var p3 = db.execute(sql).catch(
                                error => error_handle(error)
                            );
                
                            all_promises.push(p3);
                        }
                    }

                })
            }   
        })
        .catch(
            error => error_handle(error)
        );

        Promise.all(all_promises).then(result => {
            setTimeout(function(){
                return;
            },100);
        });
    }

    // OLD NOT USED (remove after testing)
    function update_ms2(){

        var exp = req.query.experiment;
        if(exp.toLowerCase() == "metabolomics"){
            return;
        }

        /* DATABASE UPDATES ms2 thresholds*/
        var config = JSON.parse(req.query.config);
        var thresholds = config.thresholds_ms2.settings;
        var exp_id ;
        var all_promises = [];
        
        // update thresholds in DB (MS2)
        let sql_exp = "SELECT experiment_id FROM experiment WHERE experiment_type = '" + exp.toLowerCase() + "'";

        let p1 = db.execute(sql_exp).then(
            result => exp_id = result[0]["experiment_id"]
        ).catch(
            error => error_handle(error)
        );

        Promise.all([p1])
        .then(async function(){
            
            for(var index=0; index < thresholds.length; index++){
                let sql = "SELECT metric_id FROM metric WHERE metric_name = '" + metric_names[thresholds[index]["Metric"]] + "'";
                var results;

                let p2 = await db.execute(sql).then(
                    result => results = [result[0]["metric_id"],index]
                ).catch(
                    error => error_handle(error)
                );
                
                Promise.all([p2]).then(function(){

                    // upper (if exists)
                    if("Upper Threshold" in thresholds[results[1]]){
                        if(thresholds[results[1]]["Upper Threshold"] != ""){
                            var sql = "UPDATE threshold SET threshold_high = '" + thresholds[results[1]]["Upper Threshold"] +
                            "' WHERE experiment_id = '" + exp_id + "' AND metric_id = '" + results[0] + "'";
                            
                            var p3 = db.execute(sql).catch(
                                error => error_handle(error)
                            );
                
                            all_promises.push(p3);
                        }
                    }

                    // lower (if exists)
                    if("Lower Threshold" in thresholds[results[1]]){
                        if(thresholds[results[1]]["Lower Threshold"] != ""){
                            var sql = "UPDATE threshold SET threshold_low = '" + thresholds[results[1]]["Lower Threshold"] +
                            "' WHERE experiment_id = '" + exp_id + "' AND metric_id = '" + results[0] + "'";
                            
                            var p3 = db.execute(sql).catch(
                                error => error_handle(error)
                            );
                
                            all_promises.push(p3);
                        }
                    }

                })
            }   
        })
        .catch(
            error => error_handle(error)
        );

        Promise.all(all_promises).then(result => {
            setTimeout(function(){
                return;
            },100);
        });
    }

    function update_components(){
        /* DATABASE UPDATES lcms thresholds*/
        var config = JSON.parse(req.query.config);
        var components = config.component.settings;
        var all_promises = [];

        for(var index=0; index < components.length; index++){
            var sql = "UPDATE sample_component SET exp_mass_charge = '" + components[index]["mz"] + 
                        "', exp_rt = '" + components[index]["RT (minutes)"] + "' WHERE component_name = '" +
                        components[index]["Name"] + "'";
            //console.log(sql);

            var p1 = db.execute(sql).catch(
                error => error_handle(error)
            );

            all_promises.push(p1);
        }

        Promise.all(all_promises).then(result => {
            setTimeout(function(){
                return;
            },100);
        });
    }

    // handle errors 
    function error_handle(e){
        console.log(e.name + ": " + e.message);
    }
}