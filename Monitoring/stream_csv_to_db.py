#!/usr/bin/env python3
"""STEP 1 - replay a CSV into SQLite like a live sensor feed.

  python stream_csv_to_db.py data/mission_6.csv --mission M6 --delay 0.05

The CSV 'status' column is deliberately NOT copied: it is the answer key. In real flight the
monitor must work out the status itself from value + thresholds.
"""
import argparse, os, time
import pandas as pd
from db import connect

ap = argparse.ArgumentParser()
ap.add_argument("csv")
ap.add_argument("--db", default="health.db")
ap.add_argument("--mission", default="M1")
ap.add_argument("--batch", type=int, default=200, help="rows inserted per commit")
ap.add_argument("--delay", type=float, default=0.0, help="seconds to wait between batches")
ap.add_argument("--reset", action="store_true", help="delete the database first")
a = ap.parse_args()

if a.reset and os.path.exists(a.db):
    for ext in ("", "-wal", "-shm"):
        if os.path.exists(a.db + ext):
            os.remove(a.db + ext)

conn = connect(a.db)
INSERT = ("INSERT INTO readings(mission, ts, mission_day, phase, instrument_id, biomarker, value,"
          " dac_code, dac_volts) VALUES (?,?,?,?,?,?,?,?,?)")
total = 0
for chunk in pd.read_csv(a.csv, chunksize=a.batch):          # reads the file piece by piece
    rows = [(a.mission, str(r.timestamp_utc), int(r.mission_day), r.phase, int(r.instrument_id),
             r.biomarker, None if pd.isna(r.value) else float(r.value),
             int(r.dac_code), float(r.dac_volts)) for r in chunk.itertuples()]
    conn.executemany(INSERT, rows)
    conn.commit()                                            # monitor can now see these rows
    total += len(rows)
    if a.delay:
        time.sleep(a.delay)
print(f"streamed {total} rows into {a.db} (mission {a.mission})")
