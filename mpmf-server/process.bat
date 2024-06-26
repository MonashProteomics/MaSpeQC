@ECHO OFF
SETLOCAL ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION
SET me=%~n0

CALL activate.bat
cd ..\mpmf-pipeline
python "MPMF_Process_Raw_Files.py" %1 %2 %3

@ECHO ON
@EXIT /B 0