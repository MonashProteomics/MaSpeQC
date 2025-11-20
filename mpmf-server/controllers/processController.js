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
const shell = require('shelljs');
const { spawn, exec ,execSync, spawnSync } = require('child_process');
const os = require('os');


// Get processing page
exports.process_home = function(req, res) {

    var size = Object.keys(req.query).length;
    const os_type = os.platform();

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

    // spawn process.bat Windows
    if(os_type == 'win32'){
        var bat = spawn('cmd.exe', ['/c', 'process.bat', experiment, runs, email]);
    }

    // spawn bash for process.sh Linux 
    if(os_type == 'linux'){
        var bat = spawn('bash', ['source processLinux.sh', experiment, runs, email]);
    }

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