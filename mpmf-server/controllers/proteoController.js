var async = require('async');
var db = require('../models/modelDB');
const fs = require('fs');

// Get data for Proteomics Charts
exports.proteo_home = function(req, res) {
    // retrieve query strings
    var machine = req.query.machine;
    var experiment = req.query.experiment;
    var display_metric = req.query.metric;
    var machine_data = {};
    var machine_type;

    // number of runs
    const RUNS = 200; 

    // get data sqls
    let runs_sql = "SELECT run_id, date_time FROM qc_run WHERE machine_id = " +
                    "(SELECT machine_id FROM machine WHERE machine_name = '" + machine + "')" +
                    " AND experiment_id = (SELECT experiment_id FROM experiment WHERE experiment_type = 'proteomics')" + 
                    "ORDER BY date_time DESC LIMIT " + RUNS;

    let component_sql = "SELECT component_name,component_mode, component_id FROM sample_component " +
                        " WHERE component_name <>" + "'Hela Digest'" + 
                        " AND digest_id = '1'"; //" AND experiment_id = (SELECT experiment_id FROM experiment WHERE experiment_type = 'proteomics')" + 
                        //" ORDER BY component_name";

    let lcms_metrics_sql = "SELECT display_order, display_name, metric_id, metric_info FROM metric WHERE display_order > 0 " + 
                            "AND use_prot='Y' AND metric_type = 'mzmine' ORDER BY display_order";

    let ms2_metrics_sql = "SELECT display_order, display_name, metric_id, metric_name, metric_info FROM metric WHERE display_order > 0 " + 
                            "AND use_prot='Y' AND metric_type = 'morpheus' ORDER BY display_order";

    let pressure_metrics_sql = "SELECT display_order, display_name, metric_id, metric_description, metric_info FROM metric WHERE display_order > 0 " + 
                            "AND use_prot='Y' AND metric_type = 'thermo' ORDER BY display_order";

    let machine_type_sql = "SELECT machine_type FROM machine WHERE machine_name = '" + machine + "'";

    // execute query as a promise
    let p1 = db.execute(runs_sql).then(
            result => machine_data["run_data"] = JSON.parse(JSON.stringify(result))
        ).catch(
            error => error_handle(error)
        );

    // execute query as a promise
    let p2 = db.execute(component_sql).then(
        result => machine_data["components"] = JSON.parse(JSON.stringify(result))
    ).catch(
        error => error_handle(error)
    );

    // execute query as a promise
    let p3 = db.execute(lcms_metrics_sql).then(
        result => machine_data["lcms_metrics"] = JSON.parse(JSON.stringify(result))
    ).catch(
        error => error_handle(error)
    );

    // execute query as a promise
    let p4 = db.execute(machine_type_sql).then(
        result => machine_type = result[0].machine_type
    ).catch(
        error => error_handle(error)
    );

    // execute query as a promise
    let p5 = db.execute(pressure_metrics_sql).then(
        result => machine_data["pressure_metrics"] = JSON.parse(JSON.stringify(result))
    ).catch(
        error => error_handle(error)
    );

    // execute query as a promise
    let p6 = db.execute(ms2_metrics_sql).then(
        result => machine_data["ms2_metrics"] = JSON.parse(JSON.stringify(result))
    ).catch(
        error => error_handle(error)
    );

    // wait for all the promises
    Promise.all([p1, p2, p3, p4, p5, p6]).then(
        result => add_run_data()
    ).catch(
        error => error_handle(error)
    );

    async function add_run_data(){
        /*CHROMATOGRAMS*/
        // loop through components
        for(let comp in machine_data["components"]){
            var component_id = machine_data["components"][comp].component_id;
            var chromatograms = [];
            // loop through runs 
            for(let run in machine_data["run_data"]){
                var run_id = machine_data["run_data"][run].run_id;

                // get chromatograms data
                var sql = "SELECT chrom_data FROM chromatogram WHERE component_id = " + 
                            component_id + " AND run_id = " + run_id;
                await db.execute(sql).then(
                            result => chromatograms.push(JSON.parse(JSON.stringify(result)))
                    ).catch(
                        error => console.log("Missing chromotogram data")//error_handle(error) 
                    );  
            }
            machine_data["components"][comp]["chromatograms"] = chromatograms;
        }
        
        /*PRESSURE PROFILES*/
        if(machine_type == "thermo"){
            // nano pump
            for(let run in machine_data["run_data"]){
                var run_id = machine_data["run_data"][run].run_id;
                var pressure = [];
                // get pressure profile data
                var sql = "SELECT pressure_data FROM pressure_profile WHERE run_id = " + run_id +
                            " AND pump_type = 'np'"; // only one metab pump but filter anyway

                await db.execute(sql).then(
                    result => pressure.push(JSON.parse(JSON.stringify(result)))
                ).catch(
                    error => console.log("Missing pressure profile - np")//error_handle(error)  
                ); 
                machine_data["run_data"][run]["pressure_profile_np"] = pressure;
            } 
            // loading pump
            for(let run in machine_data["run_data"]){
                var run_id = machine_data["run_data"][run].run_id;
                var pressure = [];
                // get pressure profile data
                var sql = "SELECT pressure_data FROM pressure_profile WHERE run_id = " + run_id +
                            " AND pump_type = 'lp'"; // only one metab pump but filter anyway

                await db.execute(sql).then(
                    result => pressure.push(JSON.parse(JSON.stringify(result)))
                ).catch(
                    error => console.log("Missing pressure profile - lp")//error_handle(error)  
                ); 
                machine_data["run_data"][run]["pressure_profile_lp"] = pressure;
            } 
        }
        
        /* SUMMARY DATA*/
        for(let run in machine_data["run_data"]){
            var run_id = machine_data["run_data"][run].run_id;
            // get summary data
            var sql = "SELECT summary FROM qc_run WHERE run_id = " + run_id +
                        " AND completed = 'Y'"; 

            await db.execute(sql).then(
                result => machine_data["run_data"][run]["summary"]= JSON.parse(JSON.stringify(result))
            ).catch(
                error => console.log("Missing summary data")//error_handle(error)  
            ); 
        } 

        /* LC-MS METRICS */
        // component
        for(let component in machine_data["components"]){
            var comp_id = machine_data["components"][component].component_id;
            machine_data["components"][component]["lcms_metrics"] = {};
            // metrics
            for(let metric in machine_data["lcms_metrics"]){
                var metric_id = machine_data["lcms_metrics"][metric].metric_id;
                var metric_name = machine_data["lcms_metrics"][metric].display_name;
                var metric_values = [];
                // runs
                for(let run in machine_data["run_data"]){
                    var run_id = machine_data["run_data"][run].run_id;
                    
                    var sql = "SELECT value FROM measurement WHERE run_id = " + run_id +
                            " AND metric_id = " + metric_id +
                            " AND component_id = " + comp_id;
                    await db.execute(sql).then(
                        result => metric_values.push(JSON.parse(JSON.stringify(result))[0].value)
                    ).catch(
                        error => error_handle("measure") 
                    ); 

                }
                machine_data["components"][component]["lcms_metrics"][metric_name] = metric_values;
            }  
        }

        // /*MS2 METRICS*/
        // metrics
        for(let metric in machine_data["ms2_metrics"]){
            var metric_id = machine_data["ms2_metrics"][metric].metric_id;
            var metric_name = machine_data["ms2_metrics"][metric].display_name;
            var metric_values = [];
            // runs
            for(let run in machine_data["run_data"]){
                var run_id = machine_data["run_data"][run].run_id;
                
                var sql = "SELECT value FROM measurement WHERE run_id = " + run_id +
                        " AND metric_id = " + metric_id +
                        " AND component_id = (SELECT component_id FROM sample_component WHERE component_name = 'Hela Digest')";
                await db.execute(sql).then(
                    result => metric_values.push(JSON.parse(JSON.stringify(result))[0].value)
                ).catch(
                    error => error_handle("measure") 
                ); 

            }
            machine_data["ms2_metrics"][metric]["values"] = metric_values;
        }  
        
        /* PRESSURE METRICS */
        // metrics
        if(machine_type == "thermo"){
            for(let metric in machine_data["pressure_metrics"]){
                
                var metric_id = machine_data["pressure_metrics"][metric].metric_id;
                var metric_values = [];
                // runs
                for(let run in machine_data["run_data"]){
                    var run_id = machine_data["run_data"][run].run_id;
                    
                    var sql = "SELECT value FROM measurement WHERE run_id = " + run_id +
                            " AND metric_id = " + metric_id +
                            " AND component_id = (SELECT component_id FROM sample_component WHERE " +
                                " component_name = 'Hela Digest')";
                    await db.execute(sql).then(
                        result => metric_values.push(JSON.parse(JSON.stringify(result))[0].value)
                    ).catch(
                        error => error_handle("measure") 
                    ); 
                }
                machine_data["pressure_metrics"][metric]["values"] = metric_values;
            }  
        }

        /* STATS - LC-MS */
        // component
        for(let component in machine_data["components"]){
            var comp_id = machine_data["components"][component].component_id;
            machine_data["components"][component]["stats"] = {};
            for(let metric in machine_data["lcms_metrics"]){
                var metric_id = machine_data["lcms_metrics"][metric].metric_id;
                var metric_name = machine_data["lcms_metrics"][metric].display_name;
                // no box plots for normalised metrics
                if(metric_name != "Area (normalised)" && metric_name != "Height (normalised)"){
                    sql = "SELECT mean, std, min, 25_percent, 50_percent, 75_percent, max FROM stat where " +
                            " machine_id = (SELECT machine_id FROM machine WHERE machine_name = '" + machine + "')" +
                            " AND component_id = " + comp_id + " AND " +
                            " metric_id = " + metric_id;
                    await db.execute(sql).then(
                        result => machine_data["components"][component]["stats"][metric_name]=JSON.parse(JSON.stringify(result))[0]
                    ).catch(
                        error => console.log("Missing LC-MS stat")//error_handle(error) 
                    ); 
                }
            }
        }

        /* STATS - Pressure Metrics */
        if(machine_type == "thermo"){
            for(let metric in machine_data["pressure_metrics"]){
                var metric_id = machine_data["pressure_metrics"][metric].metric_id;
                machine_data["pressure_metrics"][metric]["stats"] = {};
                sql = "SELECT mean, std, min, 25_percent, 50_percent, 75_percent, max FROM stat where " +
                        " machine_id = (SELECT machine_id FROM machine WHERE machine_name = '" + machine + "')" +
                        " AND component_id = (SELECT component_id FROM sample_component WHERE component_name = 'Hela Digest')" +
                        " AND metric_id = " + metric_id;
                await db.execute(sql).then(
                    result => machine_data["pressure_metrics"][metric]["stats"]=JSON.parse(JSON.stringify(result))[0]
                ).catch(
                    error => console.log("Missing pressure stat")//error_handle(error) 
                ); 
            }
        }

        // /*MS2 METRICS STATS*/
        for(let metric in machine_data["ms2_metrics"]){
            var metric_id = machine_data["ms2_metrics"][metric].metric_id;
            machine_data["ms2_metrics"][metric]["stats"] = {};
            sql = "SELECT mean, std, min, 25_percent, 50_percent, 75_percent, max FROM stat where " +
                    " machine_id = (SELECT machine_id FROM machine WHERE machine_name = '" + machine + "')" +
                    " AND component_id = (SELECT component_id FROM sample_component WHERE component_name = 'Hela Digest')" +
                    " AND metric_id = " + metric_id;
            await db.execute(sql).then(
                result => machine_data["ms2_metrics"][metric]["stats"]=JSON.parse(JSON.stringify(result))[0]
            ).catch(
                error => console.log("Missing MS2 stat")//error_handle(error)
            ); 
        }
        add_thresholds();
        render();
    }

    function add_thresholds(){
       
       // filename of defaults
       const filenameDefault = "proteomics-thresholds-default.txt";
       const filename = "proteomics-thresholds-" + machine + ".txt";
       var openfile;

       // get file name
       try {
        fs.readFileSync("../mpmf-pipeline/Config/thresholds/" + filename, 'utf8');
        openfile = filename;
        } catch (err) {
        openfile = filenameDefault;
        }

        // read file, should have used json
        var threshData = [];
        const allFileContents = fs.readFileSync("../mpmf-pipeline/Config/thresholds/" + openfile, 'utf-8');
            allFileContents.split(/\r?\n/).forEach(line =>  {
                if(line != ""){
                    var newLine = line.split("|");
                    threshData.push(newLine);
                }
            });
        
        // remove header
        threshData.shift();

        // display name look up
        const displayNames = {'mass_error_ppm': 'Mass Error (ppm)',
        'rt': 'Retention Time',
        'area_normalised': 'Area (normalised)',
        'fwhm': 'Full Width Half Maximum',
        'tf': 'Tailing',
        'af': 'Asymmetry',
        'MS/MS Spectra': 'MS/MS Spectra (Morpheus)',
        'Target PSMs': 'PSM (Morpheus)',
        'Unique Target Peptides': 'Unique Peptides (Morpheus)',
        'Target Protein Groups': 'Protein Groups (Morpheus)',
        'Precursor Mass Error': 'Precursor Mass Error ppm (Morpheus)'}

        // create look-up obj
        var threshObj = {};
        for(let row in threshData){
            // handle display names
            if(threshData[row][0] in displayNames){
                threshObj[displayNames[threshData[row][0]]] ={"threshold_trigger":threshData[row][1],
                                                "threshold_low":threshData[row][2],
                                                "threshold_high":threshData[row][3]}
            }
        }

        // add to machine data (lcms)
        for(let i in machine_data["lcms_metrics"]){
            if(machine_data["lcms_metrics"][i]['display_name'] in threshObj){
                machine_data["lcms_metrics"][i]["thresholds"] = threshObj[machine_data["lcms_metrics"][i]['display_name']];
            }
            else{
                machine_data["lcms_metrics"][i]["thresholds"] = {'threshold_trigger': '','threshold_low': '','threshold_high': '' };
            }
        }

        // add to machine data (ms2)
        for(let i in machine_data["ms2_metrics"]){
            if(machine_data["ms2_metrics"][i]['display_name'] in threshObj){
                machine_data["ms2_metrics"][i]["thresholds"] = threshObj[machine_data["ms2_metrics"][i]['display_name']];
            }
            else{
                machine_data["ms2_metrics"][i]["thresholds"] = {'threshold_trigger': '','threshold_low': '','threshold_high': '' };
            }
        }

        // add current threshold percentiles (ms2)
        var percentile_json = JSON.parse(fs.readFileSync("../mpmf-pipeline/Config/thresholds/thresholds-ms2-percentiles.json", 'utf-8'));
        for(let i in machine_data["ms2_metrics"]){ 
            if(machine_data["ms2_metrics"][i]['metric_name'] in percentile_json[machine]){
                machine_data["ms2_metrics"][i]["thresholds"]["lower_percentile"] = percentile_json[machine][machine_data["ms2_metrics"][i]['metric_name']];
            }
            else{
                machine_data["ms2_metrics"][i]["thresholds"]["lower_percentile"] = 0;
            }
        }

    }

    function render(){
        var machine_details = {"machine_name": machine, 
                                "machine_type": machine_type, 
                                "experiment": experiment,
                                "display_metric": display_metric}
        machine_data["machine_details"] = machine_details;
        res.render('proteomics', { ejs_machine_data: machine_data});
    }

    // handle errors from promises
    function error_handle(e){

        // just return on missing measurements, handled front-end
        if(e == "measure"){
            return;
        }
        console.log(e.name + ": " + e.message);
    }
};