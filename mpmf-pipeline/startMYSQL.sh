#!/bin/bash

echo Running MaSpeQC database server. Leave this Window open while using MaSpeQC.
echo To run the database as a service see 'https://dev.mysql.com/doc/refman/8.4/en/windows-start-service.html'
cd ..\Software\mysql-5.7.41-winx64/bin
mysqld
