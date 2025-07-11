#!/bin/bash

cd ../mpmf-pipeline

# activate python environment
source .venv/bin/activate

# run processing
python3 MPMF_Process_Raw_Files.py $1 $2 $3

# deactivate python environment
deactivate

cd ../mpmf-server



