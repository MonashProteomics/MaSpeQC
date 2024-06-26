var mysql = require('mysql');
const setup = process.env.npm_config_setup;
const fs = require('fs');

// https://github.com/mysqljs/mysql#pooling-connections
// change to pooled as drops connection

// command line arg for setup mode
if(setup == undefined){

  // get db details
  try {
    var dbInfo = fs.readFileSync("./database-login.json", 'utf8');
    dbInfo = JSON.parse(dbInfo);
	
    var dbPassword = fs.readFileSync("./.maspeqc_gen", "utf8");

    var pool = mysql.createPool({
      host: "localhost",
      user: dbInfo["User"],
      // password: dbInfo["Password"],
	  password: dbPassword,
	  port: dbInfo["Database Port"],
      database: dbInfo["Database Name"]
    });

    pool.getConnection(function(err, connection) {
      // no release here?, see below
      if(!err) {
        console.log("Database is connected");
        console.log("Navigate to http://localhost or https://localhost");
      } else {
        console.log("Error while connecting to database");
        //throw err; throw it??
      }
    });
    module.exports = pool;

    } catch (err) {
    console.log("No database info file");
    }
}
else{
  console.log("Running in configuration mode");
  console.log("Navigate to http://localhost/configuration or https://localhost/configuration");
}