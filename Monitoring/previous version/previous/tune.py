#!/usr/bin/env python3
"""STEP 4 - self-tuning: compare what the system detected with the scripted EVENTS (answer key).

  python tune.py                                        # grid-search + final test report, writes config.json
  python tune.py --report-db health.db --mission M6 --events data/mission_6_events.csv   # score a live run

What it tunes (and why):
  spike_k, spike_window : too low = false alarms, too high = missed events. We keep the pair with the best F2
                          (F2 weights recall 4x more than precision: missing a medical event is worse than a false alarm).
  ml_threshold          : probability needed for a forecast alert, chosen on the VALIDATION mission.
"""
import argparse, glob, itertools, json
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import precision_recall_fscore_support, roc_auc_score

from features import ML_FEATURES, daily_table, load_config, load_thresholds, prepare_mission

TOL = 2   # an alert up to 2 days after an event ends still counts (the day-after "rebound" is expected)


def spike_scorecard(alerts, events, tol=TOL):
    """alerts: DataFrame[biomarker, mission_day] of SPIKE alerts. events: ground truth table."""
    windows = [(e.biomarker, int(e.start_day), int(e.start_day + e.duration_days - 1 + tol)) for e in events.itertuples()]
    tp_alerts, caught, delays = 0, 0, []
    for bio, s, e in windows:
        hit = alerts[(alerts.biomarker == bio) & alerts.mission_day.between(s, e)]
        if len(hit):
            caught += 1
            delays.append(int(hit.mission_day.min()) - s)
    for r in alerts.itertuples():
        if any(r.biomarker == b and s <= r.mission_day <= e for b, s, e in windows):
            tp_alerts += 1
    n_alerts = len(alerts)
    return dict(events=len(events), caught=caught, alerts=n_alerts, false_alerts=n_alerts - tp_alerts,
                precision=tp_alerts / n_alerts if n_alerts else 1.0,
                recall=caught / len(events) if len(events) else 1.0,
                mean_delay=float(np.mean(delays)) if delays else float("nan"))


def f_beta(p, r, beta=2.0):
    return 0.0 if p + r == 0 else (1 + beta**2) * p * r / (beta**2 * p + r)


def spikes_from_daily(d, k):
    s = d[d.spike_z.abs() >= k]
    return s[["biomarker", "mission_day"]]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/mission_*.csv")
    ap.add_argument("--thresholds", default="instrument_map.csv")
    ap.add_argument("--config", default="config.json")
    ap.add_argument("--model", default="model.joblib")
    ap.add_argument("--report-db"); ap.add_argument("--mission"); ap.add_argument("--events")
    a = ap.parse_args()
    cfg, thr = load_config(a.config), load_thresholds(a.thresholds)

    if a.report_db:                                   # score a live run stored in SQLite
        import sqlite3
        al = pd.read_sql_query("SELECT subject AS biomarker, mission_day FROM alerts WHERE kind='SPIKE' AND mission=?",
                               sqlite3.connect(a.report_db), params=(a.mission,))
        print(spike_scorecard(al, pd.read_csv(a.events)))
        raise SystemExit

    files = sorted(f for f in glob.glob(a.data) if not f.endswith("_events.csv"))
    tune_files, val_file, test_file = files[:-2], files[-2], files[-1]

    # ---- A) spike detector grid search on every non-test mission
    raw = {f: (pd.read_csv(f), pd.read_csv(f.replace(".csv", "_events.csv"))) for f in tune_files + [val_file]}
    best = None
    print("spike_window  spike_k   precision  recall   F2     false_alerts")
    for window, k in itertools.product([7, 10, 14, 21], [3, 4, 5, 6, 8]):
        c2 = dict(cfg, spike_window=window, spike_k=k)
        tot = dict(events=0, caught=0, alerts=0, false_alerts=0)
        for f, (readings, events) in raw.items():
            sc = spike_scorecard(spikes_from_daily(daily_table(readings, thr, c2), k), events)
            for key in tot:
                tot[key] += sc[key]
        prec = 1 - tot["false_alerts"] / tot["alerts"] if tot["alerts"] else 1.0
        rec = tot["caught"] / tot["events"]
        score = f_beta(prec, rec)
        print(f"{window:12d}  {k:7.1f}   {prec:9.2f}  {rec:6.2f}  {score:5.2f}   {tot['false_alerts']:5d}")
        if best is None or score > best[0] + 1e-9 or (abs(score - best[0]) < 1e-9 and k > best[2]):
            best = (score, window, k)
    cfg["spike_window"], cfg["spike_k"] = best[1], best[2]
    print(f"\n-> chosen: spike_window={best[1]}, spike_k={best[2]} (F2={best[0]:.2f})")

    # ---- B) forecast threshold on the validation mission
    bundle = joblib.load(a.model); clf = bundle["model"]
    _, cv, _ = prepare_mission(val_file, thr, cfg)
    v = cv[cv.eligible]
    pv = clf.predict_proba(v[ML_FEATURES])[:, 1]
    cand = [(f_beta(*precision_recall_fscore_support(v.y, pv >= t, average="binary", zero_division=0)[:2]), t)
            for t in np.arange(0.05, 0.96, 0.05)]
    cfg["ml_threshold"] = round(float(max(cand)[1]), 2)
    print(f"-> chosen: ml_threshold={cfg['ml_threshold']}")
    json.dump({k: cfg[k] for k in ("spike_k", "spike_window", "ml_threshold")}, open(a.config, "w"), indent=2)

    # ---- C) final report on the untouched TEST mission
    d, ct, ev = prepare_mission(test_file, thr, cfg)
    sc = spike_scorecard(spikes_from_daily(d, cfg["spike_k"]), ev)
    print("\n=== TEST mission, spike detector vs scripted EVENTS ===")
    print(f"events caught {sc['caught']}/{sc['events']} | alerts {sc['alerts']} (false {sc['false_alerts']}) | "
          f"mean delay {sc['mean_delay']:.1f} days")
    t = ct[ct.eligible]
    p = clf.predict_proba(t[ML_FEATURES])[:, 1]
    pr, rc, _, _ = precision_recall_fscore_support(t.y, p >= cfg["ml_threshold"], average="binary", zero_division=0)
    print("=== TEST mission, illness forecast ===")
    print(f"AUC={roc_auc_score(t.y, p):.3f}  precision={pr:.2f}  recall={rc:.2f} at threshold {cfg['ml_threshold']}")
    ct = ct.assign(p=np.nan); ct.loc[t.index, "p"] = p
    leads = []
    for cond, g in ct.groupby("condition"):
        g = g.sort_values("mission_day")
        first = g[g.thr_active & ~g.event_now & (g.phase != 'earth')]
        if first.empty:
            continue
        t0 = int(first.mission_day.iloc[0])
        warn = g[(g.mission_day < t0) & (g.mission_day >= t0 - 10) & (g.p >= cfg["ml_threshold"])]
        leads.append((cond, t0, t0 - int(warn.mission_day.min()) if len(warn) else 0))
    print("conditions becoming abnormal in flight -> days of advance warning (looking back at most 10 days):")
    for cond, t0, lead in leads:
        print(f"  {cond:28s} abnormal on day {t0:3d}  warned {lead} day(s) ahead")
