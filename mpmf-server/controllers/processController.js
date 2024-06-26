const fs = require('fs');
const shell = require('shelljs');
const { spawn, exec ,execSync, spawnSync } = require('child_process');

// Get processing page
exports.process_home = function(req, res) {

    var size = Object.keys(req.query).length;

    // no query strings, load normal page
    if(size == 0){ 
        res.render('process', {'type': 'load'});
        return;
    } 

    // load from interface
    if(size == 1){ // 
        var caller = req.query.caller;
        res.render('process', {'type': caller});
        return;
    }

    // button press for processing
    var config = JSON.parse(req.query.config);
    var experiment = config.experiment.settings;
    var runs = config.runs.settings;
    var email = config.email.settings;
    var caller = req.query.caller;

    // look-up objects
    var exp_lookup = {"0" : "proteomics", "1" : "metabolomics"};
    var runs_lookup = {"0" : 1, "1" : 5 , "2" : 10, "3" : 20, "4" : -1};
    var email_lookup = {"0" : "Y", "1" : "N"};
    
    // get args
    experiment = exp_lookup[experiment[0].experiment];
    runs = runs_lookup[runs[0].runs];
    email = email_lookup[email[0].email];
   
    // spawn process
    const bat = spawn('cmd.exe', ['/c', 'process.bat', experiment, runs, email]);
    bat.stdout.on('data', (data) => {
        console.log(data.toString());
    });

    bat.stderr.on('data', (data) => {
        console.error(data.toString());
    });

    bat.on('exit', (code) => {
        console.log(`Child exited with code ${code}`);
    });
    
    res.render('process', {'type': caller});

    // handle errors 
    function error_handle(e){
        console.log(e.name + ": " + e.message);
    }
}