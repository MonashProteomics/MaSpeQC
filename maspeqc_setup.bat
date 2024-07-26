@echo off
rem TODO: adjust links to MaSpeQC

rem This batch file should be used to set up MaSpeQC initially.
rem It supports the user by downloading and configuring all required software.

rem Set PATH to make sure the correct tar and curl version are used
set PATH=C:\Windows\System32;%PATH%;

rem EnableDelayedExpansion is required to expand variables at execution time rather than at parse time
setlocal EnableDelayedExpansion

rem Set minimal required Python version
set python_major=3
set python_minor_min=8
set python_minor_max=11

rem Database configuration
set database_port=3306

rem Should downloads be deleted? [no=0, 1=yes]
set delete_downloads=0

set success_maspeqc=0
set success_mysql=0
set success_nodejs=0
set success_python=0
set success_mzmine=0
set success_morpheus=0
set success_msconvert=0

echo.
echo This batch script will guide you through the initial setup of MaSpeQC 1.0
echo It will download all required software directly where possible or open a browser window for download where necessary
echo The script will also create folders and unpack software or, in case of Python, start the installation for you
pause
echo.

rem Check whether curl.exe and tar.exe are available
curl.exe -h > check_curl.log
if errorlevel 1 (
    if exist check_curl.log del check_curl.log
    echo Cannot find curl.exe but it is required to set up MaSpeQC, curl.exe is available on Windows 10 ^(1803^) and newer as well as Windows Server 2019 ^(10.0.17763.1339^) and newer
    echo Skipping MaSpeQC setup
    exit /b
)
tar.exe -h > check_tar.log
if errorlevel 1 (
    if exist check_curl.log del check_curl.log
    if exist check_tar.log del check_tar.log
    echo Cannot find tar.exe but it is required to set up MaSpeQC, tar.exe is available on Windows 10 ^(1803^) and newer as well as Windows Server 2019 ^(10.0.17763.1339^) and newer
    echo Skipping MaSpeQC setup
    exit /b
)
if exist check_curl.log del check_curl.log
if exist check_tar.log del check_tar.log

rem MaSpeQC
echo ===== Checking MaSpeQC =====
if not exist mpmf-pipeline goto error-maspeqc
if not exist mpmf-server goto error-maspeqc
goto found-maspeqc
:error-maspeqc
echo Could not find MaSpeQC 1.0
echo Please download MaSpeQC 1.0 from https://github.com/CodeCaven/lc-ms-quality-control-visual-analytics/releases as zip file and unzip the downloaded zip file
echo Run maspeqc_setup.bat again afterwards
pause
echo.
exit /b
:found-maspeqc
echo == Found MaSpeQC 1.0 directories mpmf-pipeline and mpmf-server
echo.
set success_maspeqc=1


if not exist Software (
    echo Creating directory 'Software'
    mkdir Software
)
echo Changing directory to Software
cd Software
echo.


rem MySQL
:mysql
set mysql_install=0
set mysqld_running=0
echo ===== Configuring MySQL Community Server =====
:check-mysql
echo == Checking MySQL Community Server configuration
if exist mysql-5.7.41-winx64 (
    echo Changing directory to mysql-5.7.41-winx64\bin
    cd mysql-5.7.41-winx64\bin
    echo Running "mysql.exe -V"
    mysql.exe -V
    if !mysql_install! equ 1 if errorlevel 1 (
        cd ..\..
        goto error-mysql
    )
    if errorlevel 1 (
        cd ..\..
        goto get-mysql
    )
    for /f "tokens=*" %%g in ('mysql.exe -V') do (
        set mysql_version=%%g
        cd ..\..
        goto found-mysql
    )
    cd ..\..
)
:get-mysql
if not exist mysql-5.7.41-winx64 (
    if not exist mysql-5.7.41-winx64.zip (
        echo Downloading MySQL Community Server 5.7.41 from https://dev.mysql.com/downloads/mysql/
        curl --output mysql-5.7.41-winx64.zip --location --ssl-no-revoke https://dev.mysql.com/get/Downloads/MySQL-5.0/mysql-5.7.41-winx64.zip
    )
    if exist mysql-5.7.41-winx64.zip (
        echo Unpacking mysql-5.7.41-winx64.zip
        tar -xf mysql-5.7.41-winx64.zip
        if !delete_downloads! equ 1 del mysql-5.7.41-winx64.zip
        set mysql_install=1
        goto check-mysql
    )
)
:error-mysql
echo Could not download and unpack MySQL Community Server 5.7.41
echo Please download MySQL Community Server 5.7.41 as zip from https://dev.mysql.com/downloads/mysql/ and put the downloaded zip file in !cd!
echo Run maspeqc_setup.bat again afterwards
pause
echo.
goto nodejs
:found-mysql
echo == Found !mysql_version!
rem Create data directory, configuration file my.cnf, initialise server, create user, change root password
if not exist ..\data (
    cd ..
    echo.
    echo Creating data directory "data" for MySQL Community Server 5.7.41 in !cd!
    mkdir data
    echo Changing directory to data
    cd data
    set datadir=!cd!
    echo Changing directory to ..\Software\mysql-5.7.41-winx64
    cd ..\Software\mysql-5.7.41-winx64
    if not exist my.cnf (
        echo Creating configuration file my.cnf for MySQL Community Server 5.7.41 in !cd!
        echo [mysqld]> my.cnf
        echo # set basedir to your installation path>> my.cnf
        rem Need to double backslashes
        echo basedir="!cd:\=\\!">> my.cnf
        echo # set datadir to the location of your data directory>> my.cnf
        rem Need to double backslashes
        echo datadir="!datadir:\=\\!">> my.cnf
        echo # server port>> my.cnf
        echo port=!database_port!>> my.cnf
        echo # do not use deprecated TIMESTAMP with implicit DEFAULT value>> my.cnf
        echo explicit-defaults-for-timestamp=ON>> my.cnf
        echo # do not attempt to write to Windows event log>> my.cnf
        echo log-syslog=OFF>> my.cnf
        echo # do not use deprecated TLS versions 1.0 and 1.1>> my.cnf
        echo tls_version=TLSv1.2>> my.cnf
        echo [client]>> my.cnf
        echo # server port>> my.cnf
        echo port=!database_port!>> my.cnf
        echo Creating database-login.json for MaSpeQC in directories mpmf-pipeline\Config and mpmf-server
        echo {"Database Port": !database_port!, "Database Name": "maspeqc", "User": "maspeqc"}> ..\..\mpmf-pipeline\Config\database-login.json
        echo {"Database Port": !database_port!, "Database Name": "maspeqc", "User": "maspeqc"}> ..\..\mpmf-server\database-login.json
    )
    echo.
    echo == Initialising MySQL server
    echo Changing directory to bin
    cd bin
    echo Running "mysqld.exe --initialize-insecure --console"
    echo.
    mysqld.exe --initialize-insecure --console
    echo.
    echo == Checking if MySQL server initialisation was successful
    dir /b /a "!datadir!" > check_data.log
    for %%g in ("check_data.log") do set size=%%~zg
       if exist check_data.log del check_data.log
    if !size! equ 0 (
        echo MySQL server initialisation was not successful, "!datadir!" is empty
        echo Skipping MySQL configuration
        echo.
        cd ..\..
        goto nodejs
    )
    echo MySQL server initialisation was successful
    echo.
    echo == Starting MySQL server ^(in a new console window^)
    echo Do not stop the server and do not close the new window
    echo ^(You might be asked by the Windows Firewall to allow network access for mysqld.exe, please "Allow access"^)
    echo TODO: We need to check if network access is necessary for mysqld.exe
    pause
    echo.
    echo == Checking if MySQL server is running already
    echo Running "mysqladmin.exe -s ping"
    mysqladmin.exe -s ping
    if not errorlevel 1 (
        echo.
        echo MySQL server is running already
        echo Cannot start a new instance of MySQL server
        echo It seems there is already a MySQL server running which cannot be used by the script
        echo You will need to configure MySQL manually as described on https://github.com/CodeCaven/lc-ms-quality-control-visual-analytics/
        echo Skipping MySQL configuration
        pause
        cd ..\..
        echo.
        goto nodejs
    )
    echo Running "start mysqld.exe --console"
    start mysqld.exe --console
    echo Wait until you can see the message "mysqld.exe: ready for connections." in the new console window
    pause
    echo.
    echo == Checking if MySQL server is running now
    echo Running "mysqladmin.exe -s ping"
    mysqladmin.exe -s ping
    if errorlevel 1 (
        echo.
        echo MySQL server is not running
        echo It seems the MySQL server cannot be started by the script
        echo You will need to configure MySQL manually as described on https://github.com/CodeCaven/lc-ms-quality-control-visual-analytics/
        echo Skipping MySQL configuration
        pause
        cd ..\..
        echo.
        goto nodejs
    )
    set mysqld_running=1
    echo.
    echo == Creating MaSpeQC database "maspeqc"
    echo Checking whether database "maspeqc" exists already
    echo Running "mysql -u root -e "show databases like 'maspeqc';""
    for /f "delims=" %%g in ('mysql -u root -e "show databases like 'maspeqc';"') do (
        set output=%%g
        if not "!output:maspeqc=!"=="!output!" (
            echo MaSpeQC database "maspeqc" exists already
            echo It seems a MaSpeQC database exists already
            echo You will need to configure MySQL manually as described on https://github.com/CodeCaven/lc-ms-quality-control-visual-analytics/
            echo Skipping MySQL configuration
            pause
            cd ..\..
            echo.
            goto nodejs
        )        
    )
    echo MaSpeQC database "maspeqc" does not exist, creating it
    echo Running "mysql -u root -e "create database maspeqc;""
    mysql -u root -e "create database maspeqc;"
    for /f "delims=" %%g in ('mysql -u root -e "show databases like 'maspeqc';"') do (
        set output=%%g
        if not "!output:maspeqc=!"=="!output!" goto database-exists-now
    )
    echo MaSpeQC database "maspeqc" still does not exist
    echo It seems the MaSpeQC database could not be created by the script
    echo You will need to configure MySQL manually as described on https://github.com/CodeCaven/lc-ms-quality-control-visual-analytics/
    echo Skipping MySQL configuration
    pause
    cd ..\..
    echo.
    goto nodejs
    :database-exists-now
    echo MaSpeQC database "maspeqc" exists now
    echo == Creating MaSpeQC database user "maspeqc"
    rem generate password, write it to .maspeqc_gen, and use it to create user maspeqc 
    echo Generating password
    set chars=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789
    set password=
    for /l %%g in (1, 1, 16) do (
        set /a idx=!random! %% 62
        call set password=!password!%%chars:~!idx!,1%%
    )
    rem piping and set necessary to avoid newline, "!password!" necessary to avoid a space character after the password in the file
    echo | set /p dummy="!password!" > ..\..\..\mpmf-pipeline\Config\.maspeqc_gen
    echo | set /p dummy="!password!" > ..\..\..\mpmf-server\.maspeqc_gen
    echo Creating user
    echo Running "mysql -u root -e "create user 'maspeqc'@'localhost' identified by '!password!';""
    mysql -u root -e "create user 'maspeqc'@'localhost' identified by '!password!';"
    echo Setting privileges
    echo Running "mysql -u root -e "grant all privileges on `maspeqc`.* to `maspeqc`@`localhost`; flush privileges;""
    mysql -u root -e "grant all privileges on `maspeqc`.* to `maspeqc`@`localhost`; flush privileges;"
    echo.
    echo == Setting database password for user "root"
    echo Enter and confirm database password for user "root" when asked for password
    echo Ignore the subsequent warning 
    echo Running "mysqladmin.exe -u root password"
    mysqladmin.exe -u root password
    cd ..\..
)
echo.
set success_mysql=1


rem Node.js
:nodejs
set nodejs_install=0
echo ===== Configuring Node.js =====
:check-nodejs
echo == Checking Node.js configuration
if exist node-v18.20.4-win-x64 (
    echo Changing directory to node-v18.20.4-win-x64
    cd node-v18.20.4-win-x64
    echo Running "node.exe -v"
    node.exe -v
    if !nodejs_install! equ 1 if errorlevel 1 (
        cd ..
        goto error-nodejs
    )
    if errorlevel 1 (
        cd ..
        goto get-nodejs
    )
    for /f "tokens=*" %%g in ('node.exe -v') do (
        set nodejs_version=%%g
        cd ..
        goto found-nodejs
    )
    cd ..
)
:get-nodejs
if not exist node-v18.20.4-win-x64 (
    if not exist node-v18.20.4-win-x64.zip (
        echo Downloading Node.js 18.20.4 from https://nodejs.org/en/download
        curl --output node-v18.20.4-win-x64.zip --location --ssl-no-revoke https://nodejs.org/dist/v18.20.4/node-v18.20.4-win-x64.zip
    )
    if exist node-v18.20.4-win-x64.zip (
        echo Unpacking node-v18.20.4-win-x64.zip
        tar -xf node-v18.20.4-win-x64.zip
        if !delete_downloads! equ 1 del node-v18.20.4-win-x64.zip
        set nodejs_install=1
        goto check-nodejs
    )
)
:error-nodejs
echo Could not download and unpack Node.js 18.20.4
echo Please download Node.js 18.20.4 64-bit as zip from https://nodejs.org/en/download and put the downloaded zip file in !cd!
echo Run maspeqc_setup.bat again afterwards
pause
echo.
goto python
:found-nodejs
echo == Found Node.js !nodejs_version!
rem Install node modules and run configuration
if exist ..\mpmf-server if not exist ..\mpmf-server\node_modules (
    echo.
    echo Changing directory to node-v18.20.4-win-x64
    cd node-v18.20.4-win-x64
    echo Adding !cd! to PATH
    set PATH="!cd!";!PATH!
    echo Changing directory to ..\..\mpmf-server
    cd ..\..\mpmf-server
    echo == Installing Node.js modules
    echo Running "call npm install"
    call npm install
    echo.
    if exist node_modules (
        echo == Starting MaSpeQC server configuration
        echo Running "start call npm start --setup" ^(starts the MaSpeQC server in a new console window^)
        echo ^(You might be asked by the Windows Firewall to allow network access for Node.js JavaScript Runtime, please "Allow access"^)
        echo TODO: We need to check which network access is necessary for Node.js JavaScript Runtime ^("Private", "Public"^)
        start call npm start --setup
        echo A Node.js server for the MaSpeQC configuration has been started ^(in a new console window^)
        echo A browser window will be opened now and the configuration for MaSpeQC will be loaded
        echo Please configure MaSpeQC accordingly
        pause
        echo Running "start http://localhost/configuration"
        start http://localhost/configuration
        pause
        echo.
    )
    echo Changing directory to ..\Software
    cd ..\Software
)
echo.
set success_nodejs=1


rem Python
:python
set python_install=0
echo ===== Configuring Python =====
:check-python
echo == Checking Python installation
if exist Python (
    echo Running "Python\python.exe -V"
    Python\python.exe -V > check_python.log 2>&1
    if errorlevel 1 goto check-system-python
    for /f "tokens=*" %%g in ('Python\python.exe -V') do (
        set python_version=%%g
        for /F "tokens=1,2 delims=." %%a in ("!python_version:~7!") do (
            if %%a lss !python_major! goto check-system-python
            if %%b lss !python_minor_min! goto check-system-python
            if %%b gtr !python_minor_max! goto check-system-python
        )
        if exist check_python.log del check_python.log
        goto found-python
    )
)
:check-system-python
echo Running "python.exe -V"
python.exe -V > check_python.log 2>&1
if !python_install! equ 1 if errorlevel 1 (
    if exist check_python.log del check_python.log
    goto error-python
)
if errorlevel 1 goto get-python
for /f "tokens=*" %%g in ('python.exe -V') do (
    set python_version=%%g
    for /F "tokens=1,2 delims=." %%a in ("!python_version:~7!") do (
        if %%a lss !python_major! goto get-python
        if %%b lss !python_minor_min! goto get-python
        if %%b gtr !python_minor_max! goto get-python
    )
    if exist check_python.log del check_python.log
    goto found-python
)
:get-python
echo Could not find Python installation version !python_major!.!python_minor_min! to !python_major!.!python_minor_max!
if not exist python-3.10.11-amd64.exe (
    echo Downloading Python 3.10.11 from https://www.python.org/downloads/windows/
    curl --output python-3.10.11-amd64.exe --location --ssl-no-revoke https://www.python.org/ftp/python/3.10.11/python-3.10.11-amd64.exe
)
if exist python-3.10.11-amd64.exe (
    echo Starting a minimal Python installation
    echo Step 1^) If it is ticked, untick "Use admin privileges when installing py.exe", then click on "Customize installation"
    echo Step 2^) Keep the selections as they are and click on "Next"
    echo Step 3^) Keep the selections and the install location as they are and click on "Install"
    echo Step 4^) Click on "Close"
    pause
    rem Command line parameters for Python installation
    rem https://docs.python.org/3/using/windows.html#installing-without-ui
    echo Running "python-3.10.11-amd64.exe InstallAllUsers=0 Shortcuts=0 Include_doc=0 Include_launcher=0 Include_tcltk=0 Include_test=0 TargetDir="!cd!\Python""
    python-3.10.11-amd64.exe InstallAllUsers=0 Shortcuts=0 Include_doc=0 Include_launcher=0 Include_tcltk=0 Include_test=0 TargetDir="!cd!\Python"
    if !delete_downloads! equ 1 del python-3.10.11-amd64.exe
    set python_install=1
    goto check-python
)
:error-python
echo Could not download and install Python 3.10.11
echo Please download Python 3.10.11 from https://www.python.org/downloads/windows/ and put the downloaded file in !cd!
echo Run maspeqc_setup.bat again afterwards
pause
echo.
goto mzmine
:found-python
echo == Found !python_version!
rem Create Python environment, install modules
if exist ..\mpmf-pipeline if not exist ..\mpmf-pipeline\.venv (
    echo.
    echo Changing directory to ..\mpmf-pipeline
    cd ..\mpmf-pipeline
    set python_alias=python.exe
    if exist ..\Software\Python\python.exe set python_alias=..\Software\Python\python.exe
    echo Creating Python environment in mpmf-pipeline
    echo Running "!python_alias! -m venv .venv"
    !python_alias! -m venv .venv
    if exist .venv (
        echo Activating Python environment
        echo Running "call .venv\Scripts\activate.bat"
        call .venv\Scripts\activate.bat
        echo == Installing Python modules
        echo Running "pip install -r requirements.txt"
        pip install -r requirements.txt
        if exist Config\.maspeqc_gen (
            echo == Configuring MaSpeQC database
            if !mysqld_running! equ 0 (
                echo Checking if MySQL server is running
                echo Changing directory to ..\Software\mysql-5.7.41-winx64\bin
                cd ..\Software\mysql-5.7.41-winx64\bin
                echo Running "mysqladmin.exe -s ping"
                mysqladmin.exe -s ping
                if errorlevel 1 (
                    echo Starting MySQL server ^(in a new console window^)
                    echo Do not stop the server and do not close the new window
                    echo Running "start mysqld.exe --console"
                    start mysqld.exe --console
                    echo Wait until you can see the message "mysqld.exe: ready for connections." in the new console window
                    pause
                )
                echo Changing directory to ..\..\..\mpmf-pipeline
                cd ..\..\..\mpmf-pipeline
            )
            echo Running "python.exe MPMF_Database_SetUp.py"
            python.exe MPMF_Database_SetUp.py
        )
        echo Deactivating Python environment
        echo Running "call .venv\Scripts\deactivate.bat
        call .venv\Scripts\deactivate.bat
    )
    echo Changing directory to ..\Software
    cd ..\Software
)
echo.
set success_python=1


rem MZmine
:mzmine
set mzmine_install=0
echo ===== Configuring MZmine =====
:check-mzmine
echo == Checking MZmine configuration
if exist MZmine-2.53-Windows (
    echo Changing directory to MZmine-2.53-Windows
    cd MZmine-2.53-Windows
    echo Running "bin\java.exe -classpath lib\* io.github.mzmine.main.MZmineCore"
    echo Please close MZmine 2.53 after it was launched successfully
    bin\java.exe -classpath lib\* io.github.mzmine.main.MZmineCore > check_mzmine.log 2>&1
    if !mzmine_install! equ 1 if errorlevel 1 (
        cd ..
        goto error-mzmine
    )
    if errorlevel 1 (
        cd ..
        goto get-mzmine
    )
    del check_mzmine.log
    cd ..
    goto found-mzmine
)
:get-mzmine
if not exist MZmine-2.53-Windows (
    if not exist MZmine-2.53-Windows.zip (
        echo Downloading MZmine 2.53 from https://github.com/mzmine/mzmine2/releases
        curl --output MZmine-2.53-Windows.zip --location --ssl-no-revoke https://github.com/mzmine/mzmine2/releases/download/v2.53/MZmine-2.53-Windows.zip
    )
    if exist MZmine-2.53-Windows.zip (
        echo Unpacking MZmine-2.53-Windows.zip
        tar -xf MZmine-2.53-Windows.zip
        if !delete_downloads! equ 1 del MZmine-2.53-Windows.zip
        set mzmine_install=1
        goto check-mzmine
    )
)
:error-mzmine
echo Could not download and unpack MZmine 2.53
echo Please download MZmine 2.53 from https://github.com/mzmine/mzmine2/releases and put the downloaded zip file in !cd!
echo Run maspeqc_setup.bat again afterwards
pause
echo.
goto morpheus
:found-mzmine
echo == MZmine 2.53 launched successfully
echo.
set success_mzmine=1


rem Morpheus
:morpheus
set morpheus_install=0
echo ===== Configuring Morpheus =====
:check-morpheus
echo == Checking Morpheus configuration
if exist "Morpheus (mzML)" (
    echo Changing directory to "Morpheus (mzML)"
    cd "Morpheus (mzML)"
    echo Running "morpheus_mzml_cl.exe"
    morpheus_mzml_cl.exe
    if !morpheus_install! equ 1 if errorlevel 1 (
        cd ..
        goto error-morpheus
    )
    if errorlevel 1 (
        cd ..
        goto get-morpheus
    )
    for /f "tokens=*" %%g in ('morpheus_mzml_cl.exe') do (
        set morpheus_version=%%g
        cd ..
        goto found-morpheus
    )
    cd ..
)
:get-morpheus
if not exist "Morpheus (mzML)" (
    if not exist Morpheus_mzML.zip (
        echo Downloading Morpheus r287, command line r272 from https://cwenger.github.io/Morpheus/
        curl --output Morpheus_mzML.zip --location --ssl-no-revoke https://github.com/cwenger/Morpheus/releases/download/r287/Morpheus_mzML.zip
    )
    if exist Morpheus_mzML.zip (
        echo Unpacking Morpheus_mzML.zip
        tar -xf Morpheus_mzML.zip
        if !delete_downloads! equ 1 del Morpheus_mzML.zip
        set morpheus_install=1
        goto check-morpheus
    )
)
:error-morpheus
echo Could not download and unpack Morpheus r287, command line r272
echo Please download Morpheus r287 as zip from https://cwenger.github.io/Morpheus/ and put the downloaded zip file in !cd!
echo Run maspeqc_setup.bat again afterwards
pause
echo.
goto bzip2
:found-morpheus
echo == Found !morpheus_version!
echo.
set success_morpheus=1


rem bzip2
:bzip2
set bzip2_install=0
echo ===== Configuring bzip2 for Windows ^(required to configure ProteoWizard^) =====
:check-bzip2
echo == Checking bzip2 configuration
if exist bzip2 (
    echo Changing directory to bzip2
    cd bzip2
    echo Running "bzip2.exe -h"
    bzip2.exe -h > check_bzip2.log 2>&1
    if !bzip2_install! equ 1 if errorlevel 1 (
        cd ..
        goto error-bzip2
    )
    if errorlevel 1 (
        cd ..
        goto get-bzip2
    )
    for /f "delims=" %%g in (check_bzip2.log) do (
        set bzip2_version=%%g
        del check_bzip2.log
        cd ..
        goto found-bzip2
    )
    cd ..
)
:get-bzip2
if not exist bzip2 (
    if not exist bzip2-1.0.8.0-win-x64.zip (
        echo Downloading bzip2 1.0.8 for Windows from https://github.com/philr/bzip2-windows
        curl --output bzip2-1.0.8.0-win-x64.zip --location --ssl-no-revoke https://github.com/philr/bzip2-windows/releases/download/v1.0.8.0/bzip2-1.0.8.0-win-x64.zip
    )
    if exist bzip2-1.0.8.0-win-x64.zip (
        echo Unpacking bzip2-1.0.8.0-win-x64.zip
        echo Creating directory 'bzip2'
        mkdir bzip2
        tar -xf bzip2-1.0.8.0-win-x64.zip -C bzip2
        if !delete_downloads! equ 1 del bzip2-1.0.8.0-win-x64.zip
        set bzip2_install=1
        goto check-bzip2
    )
)
:error-bzip2
echo Could not download and unpack bzip2 1.0.8 for Windows
echo Please download bzip2 1.0.8 for Windows x64 as zip from https://github.com/philr/bzip2-windows/releases and put the downloaded zip file in !cd!
echo Run maspeqc_setup.bat again afterwards
pause
echo.
goto msconvert
:found-bzip2
echo == Found !bzip2_version!
echo.


rem msconvert
:msconvert
set msconvert_install=0
echo ===== Configuring ProteoWizard ^(msconvert^) =====
:check-msconvert
echo == Checking ProteoWizard configuration
if exist ProteoWizard (
    echo Changing directory to ProteoWizard
    cd ProteoWizard
    echo Running "msconvert.exe"
    msconvert.exe > check_msconvert.log 2>&1
    if !msconvert_install! equ 1 if errorlevel 1 (
        del check_msconvert.log
        cd ..
        goto error-msconvert
    )
    if errorlevel 1 (
        del check_msconvert.log
        cd ..
        echo Could not run msconvert.exe
        pause
        goto get-msconvert
    )
    set current=""
    for /f "delims=" %%g in (check_msconvert.log) do (
        set msconvert_version=!current!
        set current=%%g
    )
    del check_msconvert.log
    cd ..
    goto found-msconvert
)
if not exist ProteoWizard (
    :get-msconvert
    if not exist pwiz-bin-*.tar.bz2 (
        echo Please download ProteoWizard 3.0.23097 or later from https://proteowizard.sourceforge.io/download.html and put the downloaded tar.bz2 file in !cd!
        echo A browser window will be opened now and you can download ProteoWizard 3.0.23097
        echo Select "Windows 64-bit tar.bz2 (able to convert vendor files except T2D)" from the "Platform" dropdown and confirm the license agreement
        start https://proteowizard.sourceforge.io/download.html
        pause
    )
    if not exist pwiz-bin-*.tar.bz2 goto error-msconvert
    for /f %%g in ('dir /b /a pwiz-bin-*.tar.bz2') do (
        echo Unpacking %%g
        bzip2\bzip2.exe -d -k %%g
        if !delete_downloads! equ 1 del pwiz-bin-*.tar.bz2
    )
    for /f %%g in ('dir /b /a pwiz-bin-*.tar') do (
        echo Unpacking %%g
        echo Creating directory 'ProteoWizard'
        mkdir ProteoWizard
        tar -xf %%g -C ProteoWizard
        del pwiz-bin-*.tar
    )
    set msconvert_install=1
    goto check-msconvert
)
:error-msconvert
echo Could not unpack ProteoWizard 3.0.23097 or later
pause
goto summary
:found-msconvert
echo == Found !msconvert_version!
echo.
set success_msconvert=1


:summary
echo ===== Summary =====
set success=1
if !success_maspeqc! equ 1 (
    echo Found MaSpeQC 1.0
) else (
    echo Could not find MaSpeQC 1.0
    set success=0
)
if !success_mysql! equ 1 (
    echo Configured MySQL successfully
) else (
    echo Could not configure MySQL
    set success=0
)
if !success_nodejs! equ 1 (
    echo Configured Node.js successfully
) else (
    echo Could not configure Node.js
    set success=0
)
if !success_python! equ 1 (
    echo Configured Python successfully
) else (
    echo Could not configure Python
    set success=0
)
if !success_mzmine! equ 1 (
    echo Configured MZmine successfully
) else (
    echo Could not configure MZmine
    set success=0
)
if !success_morpheus! equ 1 (
    echo Configured Morpheus successfully
) else (
    echo Could not configure Morpheus
    set success=0
)
if !success_msconvert! equ 1 (
    echo Configured ProteoWizard successfully
) else (
    echo Could not configure ProteoWizard
    set success=0
)
echo.
if !success! equ 1 (
    echo MaSpeQC 1.0 has been configured successfully
    echo You should be able to use MaSpeQC as described on https://github.com/CodeCaven/lc-ms-quality-control-visual-analytics/
) else (
    echo Could not configure MaSpeQC 1.0
    echo Please check the output above for errors
)
echo.
echo You can close the browser windows now
echo You can stop the MySQL server by switching to the console window and pressing Ctrl+C
echo You can stop the Node.js server by switching to the console window, pressing Ctrl+C, confirming and closing the window
pause

cd ..

endlocal
