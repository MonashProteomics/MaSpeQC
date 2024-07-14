:: Name:     runMetabolomics.bat
:: Purpose:  Processing for metabolomics
:: Author:   Simon Caven
:: Revision: 30/5/2022

@ECHO OFF
SETLOCAL ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION
SET me=%~n0

:: activate python environment
CALL ..\mpmf-pipeline\.venv\Scripts\activate.bat

:: run script
cd ..\mpmf-pipeline
python MPMF_Process_Raw_Files.py "metabolomics" "20" "Y"

:: deactivate python environment
CALL ..\mpmf-pipeline\.venv\Scripts\deactivate.bat


:END
ENDLOCAL
ECHO ON
@EXIT /B 0



