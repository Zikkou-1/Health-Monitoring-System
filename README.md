# 🚀 NASA Astronaut Health Monitor — AESS Expedition 74

> A real-time biotelemetry HUD simulating live health monitoring for long-duration spaceflight. Sensor data streams into a SQLite database, an ML-backed monitor raises alerts, a Flask API serves JSON, and a holographic sci-fi dashboard renders everything in the browser.

---

## 📐 Architecture Overview

```
gen_mock_flight_data.py
        │
        ▼  (CSV per mission)
stream_csv_to_db.py  ──►  health.db  ◄──  monitor.py
                                │               │
                                └───────────────┘
                                        │
                                     api.py  (Flask :5001)
                                        │
                                   Vite dev server
                                   (npm run dev :5173)
                                        │
                               Browser HUD (nasa.html,
                               profile.html, alerts.html,
                               calander.html)
```

---

## ⚡ Quick Start — Full Pipeline

### Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Python | 3.9+ |
| Node.js | 18+ |
| npm | 9+ |

---

### Step 0 — Install Dependencies

**Python:**
```bash
cd Monitoring
pip install -r requirements.txt
```

**Node / Frontend:**
```bash
cd Monitoring
npm install
```

---

### Step 1 — Generate Mock Mission Data & Build the Model

Run the shell script from the `Monitoring/` folder. This generates 6 synthetic astronaut missions, trains the forecast model, tunes detection thresholds, and creates a fresh empty database.

```bash
cd Monitoring
./run-mission.sh
```

> **macOS note:** If `python` is not found, run:
> ```bash
> PYTHON=python3 ./run-mission.sh
> ```

This script produces:
- `data/mission_1.csv` … `data/mission_6.csv` — 30-biomarker sensor readings
- `data/mission_1_events.csv` … `data/mission_6_events.csv` — ground truth event logs
- `instrument_map.csv` — normal / critical thresholds for every biomarker
- `model.joblib` — trained ML risk-forecast model
- `config.json` — tuned detection parameters
- `health.db` — fresh empty SQLite database (readings + alerts schema)

---

### Step 2 — Start the Live Data Pipeline

Open **4 separate terminal windows**, all from the `Monitoring/` folder:

#### Terminal 1 — Stream CSV sensor data into the database
```bash
cd Monitoring
python stream_csv_to_db.py data/mission_6.csv --mission M6 --batch 20 --delay 1
```
Replays the mission CSV into `health.db` in real time, 20 rows per second, simulating live sensor telemetry.

#### Terminal 2 — Run the health monitor (alert engine)
```bash
cd Monitoring
python monitor.py --mission M6
```
Watches the database for new readings. For each completed mission day it runs:
1. Rule-based threshold & spike detection
2. ML risk forecasting for conditions still in normal range
3. Writes alerts to the `alerts` table in `health.db`

#### Terminal 3 — Start the Flask API server
```bash
cd Monitoring
PORT=5001 python api.py
```
Serves JSON to the frontend on `http://127.0.0.1:5001`. Key endpoints:

| Endpoint | Description |
|---|---|
| `GET /api/thresholds` | Normal / critical limits per biomarker |
| `GET /api/daily/latest` | Latest daily report (conditions, biomarkers, alerts) |
| `GET /api/daily/<day>` | Report for a specific mission day |
| `GET /api/alerts` | Active alerts list (filterable by level, day, condition) |
| `GET /api/stream/window` | Live sensor window for real-time graphs |
| `GET /api/health` | Server health check |

> **macOS port conflict:** macOS reserves port 5000 for AirPlay Receiver. Always use `PORT=5001 python api.py`.

#### Terminal 4 — Start the frontend dev server
```bash
cd Monitoring
npm run dev
```
Launches Vite on `http://localhost:5173`. The Vite proxy forwards all `/api/...` requests to `http://127.0.0.1:5001` automatically.

Open your browser and navigate to:

```
http://localhost:5173/src/nasa.html
```

---

## 🖥️ HUD Pages

| Page | URL | Description |
|---|---|---|
| **Vitals** | `/src/nasa.html` | Real-time biomarker gauges, blood pressure, heart rate, radiation |
| **Stats** | `/src/profile.html` | Full biomarker table with active alarm tags + deviation bars |
| **Alerts** | `/src/alerts.html` | 8-condition alert grid, diagnosis column, symptom bus lines |
| **Calendar** | `/src/calander.html` | Mission history log and day-by-day calendar |

---

## 🗂️ Project Structure

```
├── README.md                      ← You are here
├── instrument_map.csv             ← Root-level biomarker reference
├── Monitoring/
│   ├── run-mission.sh             ← One-shot data + model build script
│   ├── gen_mock_flight_data.py    ← Generates synthetic CSV missions
│   ├── stream_csv_to_db.py        ← Replays CSV into SQLite (fake sensors)
│   ├── monitor.py                 ← Live alert engine (thresholds + ML)
│   ├── api.py                     ← Flask JSON API (:5001)
│   ├── features.py                ← Core: daily aggregation, scoring, detection
│   ├── db.py                      ← SQLite schema (readings, alerts, monitor_state)
│   ├── train.py                   ← Trains the 3-day risk forecast model
│   ├── tune.py                    ← Tunes detector against scripted events
│   ├── instrument_map.csv         ← Biomarker thresholds (norm_lo/hi, crit_lo/hi)
│   ├── config.json                ← Tuned detection config
│   ├── model.joblib               ← Trained ML forecast model
│   ├── health.db                  ← SQLite: readings + alerts (generated, gitignored)
│   ├── requirements.txt           ← Python dependencies
│   ├── package.json               ← Node/Vite setup
│   ├── vite.config.js             ← Vite dev server + /api proxy config
│   ├── data/                      ← Generated mission CSVs (gitignored after generation)
│   └── src/
│       ├── nasa.html / nasa.js    ← Vitals HUD page
│       ├── profile.html / profile.js  ← Stats + biomarkers page
│       ├── alerts.html / alerts.js    ← Alerts & diagnosis page
│       ├── calander.html / calander.js ← Mission calendar page
│       ├── api.js                 ← Frontend API client (Vite ESM)
│       ├── conditions.js          ← Condition metadata & colour maps
│       ├── hooks.js               ← React hooks for live data
│       └── *.css                  ← Per-page sci-fi HUD stylesheets
```

---

## 🧬 The 30 Biomarkers

The simulation tracks 30 instruments grouped into 8 medical condition categories:

| Condition | Biomarkers |
|---|---|
| **Radiation** | `absorbed_dose_msv`, `lymphocyte_count` |
| **Bone & Renal** | `bone_loss_rate_pct`, `t_score`, `ctx_p1np_ratio`, `urinary_calcium_mg` |
| **Metabolism & Hydration** | `body_weight`, `b_glucose_mg_dl`, `calories_kcal`, `hydration_L` |
| **Nutrition** | `protein_g_per_kg`, `vitamin_D_serum`, `omega3_g`, `zinc_mg`, `magnesium_serum` |
| **SANS / Ocular** | `refraction_shift`, `visual_acuity_decrement`, `trt_difference` |
| **Autonomic / Cardio** | `bpm_resting`, `hrv`, `sleep_duration`, `sleep_efficiency_pct` |
| **Inflammation** | `IL_6`, `TNF_alpha`, `body_temp`, `cfu_rate` |
| **VTE / Thrombosis** | `ijv_flow`, `ijv_stasis`, `ijv_microthrombi`, `calf_circumference` |

---

## 🔧 Configuration & Customisation

### Adding a new biomarker
1. Add a row to `INSTR` in `gen_mock_flight_data.py` (give it a unique `id` 0–31)
2. Add its exact name to a condition group in `CONDITIONS` inside `features.py`
3. Re-run `./run-mission.sh` to regenerate data, retrain the model, and retune the detector

### Changing mission speed
Adjust `--batch` and `--delay` in the `stream_csv_to_db.py` command:
```bash
# Faster (10 rows/batch, no delay)
python stream_csv_to_db.py data/mission_6.csv --mission M6 --batch 10 --delay 0

# Slower (1 row/batch, 2 second delay)
python stream_csv_to_db.py data/mission_6.csv --mission M6 --batch 1 --delay 2
```

### Switching missions
Replace `M6` with any mission ID (`M1`–`M6`) in both `stream_csv_to_db.py` and `monitor.py`:
```bash
python stream_csv_to_db.py data/mission_2.csv --mission M2 --batch 20 --delay 1
python monitor.py --mission M2
```

---

## 🩺 Alert Severity Levels

| Level | Meaning |
|---|---|
| `CRITICAL` | Biomarker is outside the critical safety boundary — immediate action |
| `URGENT` | Biomarker outside normal range but within safety limits — caution |
| `WATCH` | ML model predicts ≥50% chance of becoming abnormal within 3 days |
| `INFO` | Sensor fault or data quality warning |

A **condition** is considered active (score ≥ 2) when enough of its biomarkers breach thresholds:
- `URGENT` biomarker = +1 point
- `CRITICAL` biomarker = +2 points

---

## 🛠️ Troubleshooting

| Problem | Fix |
|---|---|
| `address already in use` on port 5000 | Use `PORT=5001 python api.py` (macOS AirPlay conflict) |
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` from `Monitoring/` |
| HUD shows fallback data | Make sure `api.py` is running and accessible on `:5001` |
| `health.db` not found | Run `./run-mission.sh` first |
| `model.joblib` not found | Run `./run-mission.sh` first |
| Vite `/api` calls fail | Ensure `api.py` is on port 5001 (Vite proxies to `http://127.0.0.1:5001`) |

---

## 📄 License

This project was built for the NASA App Development Challenge. All biomedical thresholds are simulated reference values for demonstration purposes only — **not for clinical use**.
