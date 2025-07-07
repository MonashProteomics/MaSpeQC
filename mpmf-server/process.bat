@ECHO OFF
SETLOCAL ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION
SET me=%~n0

:: activate python environment
cd ..\mpmf-pipeline\.venv\Scripts
CALL activate.bat

:: run processing
cd ..\..
python "MPMF_Process_Raw_Files.py" %1 %2 %3

:: deactivate python environment
CALL .venv\Scripts\deactivate.bat

@ECHO ON
@EXIT /B 0