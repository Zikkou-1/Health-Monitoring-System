#!/usr/bin/env bash
# One command to (re)build everything: fake data -> trained model -> tuned settings -> empty database.
# Usage:  ./run-mission.sh         (use PYTHON=python3 ./run-mission.sh if "python" is not found)
set -e
cd "$(dirname "$0")"
PY=${PYTHON:-python}
mkdir -p data

echo "1. Generating 6 mock missions (different astronauts / event days)..."
for s in 1 2 3 4 5 6; do
  $PY gen_mock_flight_data.py --seed $s --out data/mission_$s.csv \
      --hf-minutes 15 --pre 10 --transit 60 --mars 30 \
      --event-jitter 3 --profile-var 0.1 > /dev/null
done

echo "2. Training the forecast model..."
$PY train.py

echo "3. Tuning the detector against the scripted events..."
$PY tune.py

echo "4. Creating a fresh empty database..."
rm -f health.db health.db-wal health.db-shm
$PY -c "from db import connect; connect('health.db')"

cat <<'MSG'

Ready. Run these in 3 separate terminals (same folder):
  python monitor.py --mission M6
  python stream_csv_to_db.py data/mission_6.csv --mission M6 --batch 20 --delay 1
  python api.py
MSG
