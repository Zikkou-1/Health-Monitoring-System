# Astronaut health monitor - pipeline

## Quick start
    pip install -r requirements.txt
    ./run-mission.sh                       # builds data, trains, tunes, makes an empty health.db
Then, in 3 terminals (same folder):

    python monitor.py --mission M6                                              # the "brain": watches the DB, writes alerts
    python stream_csv_to_db.py data/mission_6.csv --mission M6 --batch 20 --delay 1   # fake sensors -> DB
    python api.py                                                               # serves JSON to React (port 5000; PORT=5001 python api.py on macOS)

## What each file does (in the order data flows)
| File | Job | Edit it when... |
|---|---|---|
| gen_mock_flight_data.py | Makes fake missions: `data/mission_N.csv` (readings), `mission_N_events.csv` (answer key), `instrument_map.csv` (thresholds) | you add/change a biomarker (the `INSTR` table) or a scripted event (`EVENTS`) |
| db.py | Defines the SQLite tables (readings, alerts, monitor_state) | you need a new column |
| stream_csv_to_db.py | Copies a CSV into `health.db` a few rows at a time, like live sensors | never (swap it for real sensor code later) |
| features.py | THE CORE. Turns raw readings into daily values, status, trends, spikes, condition scores, alerts | you add a biomarker to a condition (`CONDITIONS`) or change detection rules |
| train.py | Trains the model that forecasts "condition abnormal within 3 days" -> `model.joblib` | never; just rerun |
| tune.py | Tries settings, keeps the best, compares with the scripted events -> `config.json` | never; just rerun |
| monitor.py | Live loop: new rows in DB -> detect + forecast -> `alerts` table | never |
| api.py | JSON endpoints for React: live CSV playback + daily reports from the DB | you add an endpoint |
| run-mission.sh | Runs the whole preparation in one go | you change the mission length |

## If you add a new biomarker
1. Add one row to `INSTR` in `gen_mock_flight_data.py` (give it a new unique `id`, 0-31).
2. Add its exact name to a group in `CONDITIONS` in `features.py` (a biomarker in no group is ignored!).
3. Run `./run-mission.sh` again (the model must be retrained because the condition list changed).

## Detection in one paragraph
Each day every biomarker is averaged and compared with `instrument_map.csv`: inside normal = NORM, outside = URGENT,
far outside = CRITICAL. A SPIKE means today's change is far bigger than the usual day-to-day change (steady drifts such as
radiation dose are not spikes). Biomarkers are grouped into conditions; a condition is "active" at score >= 2
(URGENT = 1 point, CRITICAL = 2). For conditions still normal, the model estimates the chance they turn abnormal within 3 days.
