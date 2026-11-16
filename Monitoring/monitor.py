#!/usr/bin/env python3
"""STEP 3 - the live monitor. Watches SQLite for NEW readings and raises alerts.

  python monitor.py --db health.db --mission M6            # leave running while stream_csv_to_db.py feeds the DB

Loop:  find new rows -> a mission day is 'complete' once a later day has started -> for every complete day:
       1) rebuild the daily table from the last few weeks (+ the baseline days)
       2) rule-based detection (thresholds, spikes, sensor faults, condition score)
       3) ML forecast for conditions that are still normal
       4) write alerts to the 'alerts' table and print them
"""
import argparse, sqlite3, time
import joblib
import numpy as np
import pandas as pd

from db import connect
from features import (ML_FEATURES, condition_table, daily_table, detect, load_config, load_thresholds)

ap = argparse.ArgumentParser()
ap.add_argument("--db", default="health.db")
ap.add_argument("--mission", default="M1")
ap.add_argument("--model", default="model.joblib")
ap.add_argument("--thresholds", default="instrument_map.csv")
ap.add_argument("--config", default="config.json")
ap.add_argument("--poll", type=float, default=1.0, help="seconds between checks")
ap.add_argument("--idle-exit", type=int, default=5, help="stop after N polls without new data (0 = never)")
ap.add_argument("--quiet", action="store_true")
a = ap.parse_args()

cfg, thr = load_config(a.config), load_thresholds(a.thresholds)
clf = joblib.load(a.model)["model"]
conn = connect(a.db)
LOOKBACK = max(cfg["spike_window"], 7) + 12     # days of history the features need


def last_done():
    r = conn.execute("SELECT last_day_done FROM monitor_state WHERE mission=?", (a.mission,)).fetchone()
    return -1 if r is None else r[0]


def process(first_day, last_day):
    """Evaluate mission days first_day..last_day (inclusive), all of which are complete."""
    q = ("SELECT mission_day, phase, biomarker, value FROM readings WHERE mission=? AND mission_day<=? "
         "AND (mission_day>=? OR mission_day<?)")
    readings = pd.read_sql_query(q, conn, params=(a.mission, last_day, first_day - LOOKBACK, cfg["baseline_days"]))
    d = daily_table(readings, thr, cfg)
    c = condition_table(d, cfg)
    alerts = detect(d, c, cfg)

    # ML forecast: only for conditions that are still normal and not in a spike
    todo = c[(~c.thr_active) & (c.n_spike == 0) & c.mission_day.between(first_day, last_day)].copy()
    if len(todo):
        todo["p"] = clf.predict_proba(todo[ML_FEATURES])[:, 1]
        todo = todo[todo.p >= cfg["ml_threshold"]]
        rows = []
        for r in todo.itertuples():
            dd = d[(d.mission_day == r.mission_day) & (d.condition == r.condition)]
            drv = dd.loc[dd["toward"].idxmax()]
            eta = f", ~{drv.eta_days:.0f} days to leave normal range" if np.isfinite(drv.eta_days) else ""
            rows.append((r.mission_day, r.condition, r.condition, "RISK_FORECAST", "WATCH", r.p,
                         f"{r.condition}: {r.p:.0%} risk of becoming abnormal within {cfg['horizon']} days "
                         f"(main driver: {drv.biomarker}{eta})"))
        alerts = pd.concat([alerts, pd.DataFrame(rows, columns=alerts.columns)], ignore_index=True)

    alerts = alerts[alerts.mission_day.between(first_day, last_day)].sort_values("mission_day")
    new = 0
    for r in alerts.itertuples():
        cur = conn.execute("INSERT OR IGNORE INTO alerts(mission, mission_day, subject, condition, kind, level, score, message)"
                           " VALUES (?,?,?,?,?,?,?,?)", (a.mission, r.mission_day, r.subject, r.condition, r.kind,
                                                        r.level, r.score, r.message))
        if cur.rowcount and not a.quiet and r.level != "INFO":
            print(f"[day {r.mission_day:3d}] {r.level:8s} {r.kind:13s} {r.message}")
        new += cur.rowcount
    conn.execute("INSERT INTO monitor_state(mission, last_day_done) VALUES (?,?) "
                 "ON CONFLICT(mission) DO UPDATE SET last_day_done=excluded.last_day_done", (a.mission, last_day))
    conn.commit()
    return new


idle, prev_count, total_alerts = 0, -1, 0
print(f"monitoring mission {a.mission} in {a.db} (resuming after day {last_done()})")
while True:
    n, max_day = conn.execute("SELECT COUNT(*), COALESCE(MAX(mission_day), -1) FROM readings WHERE mission=?",
                              (a.mission,)).fetchone()
    idle = idle + 1 if n == prev_count else 0
    prev_count = n
    done = last_done()
    final = a.idle_exit and idle >= a.idle_exit          # stream has stopped -> the last day is complete too
    ready_to = max_day if final else max_day - 1         # a day is complete once the next day has started
    if ready_to > done:
        total_alerts += process(done + 1, ready_to)
    if final:
        break
    time.sleep(a.poll)
print(f"done. {total_alerts} new alerts stored in table 'alerts'.")
