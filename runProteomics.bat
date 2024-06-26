:: Name:     runProteomics.bat
:: Purpose:  Processing for proteomics
:: Author:   Simon Caven
:: Revision: 26/11/2023

@ECHO OFF
SETLOCAL ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION
SET me=%~n0

:: activate python environment
CALL F:\lc-ms-quality-control-visual-analytics-main\mpmf-pipeline\.venv\Scripts\activate.bat

:: run script
cd F:\lc-ms-quality-control-visual-analytics-main\mpmf-pipeline
python MPMF_Process_Raw_Files.py "proteomics" "20" "Y"

:: deactivate python environment
CALL F:\lc-ms-quality-control-visual-analytics-main\mpmf-pipeline\.venv\Scripts\deactivate.bat


:END
ENDLOCAL
ECHO ON
@EXIT /B 0



