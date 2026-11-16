#!/bin/bash

# Exit immediately if any setup command fails
set -e

echo "1. Generating mock flight data..."
mkdir -p data
for s in 1 2 3 4 5 6; do 
   python gen_mock_flight_data.py --seed $s --out data/mission_$s.csv --hf-minutes 15 --pre 10 --transit 60 --mars 30 --event-jitter 3 --profile-var 0.1
done

echo "2. Training and tuning models..."
python train.py
python tune.py

echo "3. Initializing database..."
python -c "from db import connect; connect('health.db')"

echo "4. Starting monitor in the background..."
python monitor.py --mission M6 &
MONITOR_PID=$!

# Ensure the background monitor stops when this script finishes or is interrupted
trap "echo 'Stopping monitor...'; kill $MONITOR_PID 2>/dev/null" EXIT

# Give the monitor 2 seconds to start up before streaming data
sleep 2

echo "5. Streaming mission data..."
python stream_csv_to_db.py data/mission_6.csv --mission M6 --delay 0.02

echo "Done!"

