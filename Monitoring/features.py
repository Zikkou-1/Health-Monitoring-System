"""Shared brain of the pipeline. Training, tuning and the live monitor ALL use these functions,
so what the model sees in training is exactly what it sees in flight.

Data flow:
  readings (raw rows)  ->  daily_table()      one row per biomarker per day  (+ status, deviation, spike, trend)
                       ->  condition_table()  one row per condition per day  (+ trend features for the ML model)
                       ->  detect()           rule-based alerts (threshold / spike / fault / condition)
                       ->  add_labels()       training answers (only used in training, never in flight)
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

# ----------------------------------------------------------------------------- conditions
# Which biomarkers belong to which "illness" (all 28 are covered).
CONDITIONS = {
    "SYSTEMIC_INFLAMMATION":     ["IL_6", "TNF_alpha", "body_temp", "cfu_rate"],
    "AUTONOMIC_STRESS_CARDIO":   ["bpm_resting", "hrv", "sleep_duration", "sleep_efficiency_pct"],
    "SANS_OCULAR_RISK":          ["trt_difference", "refraction_shift", "visual_acuity_decrement",
                                  "calf_circumference"],
    "VTE_THROMBOSIS_RISK":       ["ijv_flow", "ijv_stasis", "ijv_microthrombi"],
    "BONE_RENAL_DECONDITIONING": ["bone_loss_rate_pct", "t_score", "ctx_p1np_ratio",
                                  "urinary_calcium_mg"],
    "METABOLIC_HYDRATION":       ["b_glucose_mg_dl", "hydration_L", "calories_kcal", "body_weight",
                                  "protein_g_per_kg"],
    "NUTRITION_DEFICIENCY":      ["vitamin_D_serum", "omega3_g", "zinc_mg", "magnesium_serum"],
    "ACUTE_RADIATION_SYNDROME":  ["absorbed_dose_msv", "lymphocyte_count"],
}
BIO2COND = {b: c for c, bs in CONDITIONS.items() for b in bs}
PHASE_CODE = {"earth": 0, "transit": 1, "mars": 2}
SEV = {"NORM": 0, "URGENT": 1, "CRITICAL": 2}

# ----------------------------------------------------------------------------- settings
# tune.py overwrites the tunable ones in config.json.
DEFAULTS = dict(
    baseline_days=10,      # first N days (on Earth) define the astronaut's PERSONAL baseline
    spike_k=4.0,          # TUNABLE: a day is a "spike" if it jumps more than k noise-sigmas
    spike_window=14,      # TUNABLE: compare today with the median of the previous N days
    persist_days=2,       # URGENT must last this many days before alerting (CRITICAL is immediate)
    cond_score_min=2,     # condition is "active" at score>=2 (URGENT=1 point, CRITICAL=2 points)
    horizon=3,            # the ML model predicts "abnormal within the next H days"
    ml_threshold=0.5,     # TUNABLE: minimum probability to raise a forecast alert
)


def load_config(path="config.json"):
    cfg = dict(DEFAULTS)
    if Path(path).exists():
        cfg.update(json.loads(Path(path).read_text()))
    return cfg


def load_thresholds(path="instrument_map.csv"):
    """The 'medical record': one row per biomarker (index = name)."""
    t = pd.read_csv(path).set_index("name")
    need = {"baseline", "noise_sd", "norm_lo", "norm_hi", "crit_lo", "crit_hi"}
    miss = need - set(t.columns)
    if miss:
        raise ValueError(f"thresholds file is missing columns: {miss}")
    return t


# ----------------------------------------------------------------------------- 1. daily table
def _slope(y):
    return np.polyfit(np.arange(len(y)), y, 1)[0]


def daily_table(readings, thr, cfg):
    """Raw readings -> one row per (biomarker, day).

    readings needs: mission_day, phase, biomarker, value (NaN = broken sensor).
    """
    r = readings.copy()
    r["is_fault"] = r["value"].isna()
    d = (r.groupby(["biomarker", "mission_day"])
          .agg(value=("value", "mean"), n=("value", "size"), faults=("is_fault", "sum"),
               phase=("phase", "last"))
          .reset_index()
          .sort_values(["biomarker", "mission_day"])
          .reset_index(drop=True))
    d["fault_frac"] = d["faults"] / d["n"]

    # attach the medical record to every row
    t = thr.reindex(d["biomarker"])
    for col in ["baseline", "noise_sd", "norm_lo", "norm_hi", "crit_lo", "crit_hi"]:
        d[col] = t[col].values
    d["unit"] = t["unit"].values if "unit" in t else ""

    # personal baseline = this astronaut's average over the first days (fallback: population value)
    early = d[d["mission_day"] < cfg["baseline_days"]].groupby("biomarker")["value"].mean()
    d["pbase"] = d["biomarker"].map(early).fillna(d["baseline"])

    # status of the daily value against the thresholds
    v = d["value"]
    crit = (v < d["crit_lo"]) | (v > d["crit_hi"])
    norm = (v >= d["norm_lo"]) & (v <= d["norm_hi"])
    d["status"] = np.where(v.isna(), "FAULT", np.where(crit, "CRITICAL", np.where(norm, "NORM", "URGENT")))
    d["sev"] = d["status"].map(SEV).fillna(0).astype(int)

    # deviation: 0 = at personal baseline, 1 = exactly at the edge of the normal range
    margin = np.where(v >= d["pbase"], d["norm_hi"] - d["pbase"], d["pbase"] - d["norm_lo"])
    margin = np.maximum(margin, 3 * d["noise_sd"])          # avoid divide-by-zero / tiny margins
    d["dev"] = ((v - d["pbase"]) / margin)
    g = d.groupby("biomarker")
    d["dev"] = g["dev"].ffill().fillna(0)                   # missing day -> keep last known deviation
    d["dev_s"] = d.groupby("biomarker")["dev"].transform(lambda s: s.rolling(3, min_periods=1).mean())

    # trend: how fast the (smoothed) deviation changes per day, over the last 7 days
    d["slope"] = (d.groupby("biomarker")["dev_s"]
                   .transform(lambda s: s.rolling(7, min_periods=3).apply(_slope, raw=True)).fillna(0))
    d["toward"] = np.sign(d["dev_s"]) * d["slope"]          # >0 = drifting AWAY from normal
    gap = np.maximum(0, 1 - d["dev_s"].abs())
    d["eta_days"] = np.where(d["toward"] > 1e-6, gap / np.maximum(d["toward"], 1e-6), np.inf)

    # spike: today's day-to-day CHANGE vs the usual day-to-day change of the previous N days, in noise units.
    # Using the change (not the level) means a steady ramp (cumulative radiation dose, slow bone loss...)
    # is NOT a spike, while a sudden jump or crash is.
    step = d.groupby("biomarker")["value"].diff()
    usual = d.groupby("biomarker")["value"].transform(
        lambda s: s.diff().shift(1).rolling(cfg["spike_window"], min_periods=3).median())
    scale = d["noise_sd"] * np.sqrt(1 + 1 / d["n"].clip(lower=1))   # noise of a change between two days
    d["spike_z"] = ((step - usual) / scale).fillna(0)
    d["condition"] = d["biomarker"].map(BIO2COND)
    return d


# ----------------------------------------------------------------------------- 2. condition table
ML_FEATURES = (["score", "n_urgent", "n_crit", "max_adev", "mean_adev", "max_toward", "max_spike",
                "adev_change3", "adev_change7", "score_mean3", "phase_code"]
               + ["cond_" + c for c in CONDITIONS])


def condition_table(d, cfg):
    """One row per (condition, day) with the features the ML model uses."""
    d = d.copy()
    d["adev"] = d["dev_s"].abs()
    d["aspike"] = d["spike_z"].abs()
    d["is_spike"] = d["aspike"] >= cfg["spike_k"]
    c = (d.groupby(["condition", "mission_day"])
          .agg(phase=("phase", "last"), score=("sev", "sum"),
               n_urgent=("sev", lambda s: int((s == 1).sum())),
               n_crit=("sev", lambda s: int((s == 2).sum())),
               max_adev=("adev", "max"), mean_adev=("adev", "mean"),
               max_toward=("toward", "max"), max_spike=("aspike", "max"),
               n_spike=("is_spike", "sum"))
          .reset_index()
          .sort_values(["condition", "mission_day"])
          .reset_index(drop=True))
    gc = c.groupby("condition")
    c["adev_change3"] = (c["max_adev"] - gc["max_adev"].shift(3)).fillna(0)
    c["adev_change7"] = (c["max_adev"] - gc["max_adev"].shift(7)).fillna(0)
    c["score_mean3"] = gc["score"].transform(lambda s: s.rolling(3, min_periods=1).mean())
    c["phase_code"] = c["phase"].map(PHASE_CODE).fillna(0)
    for name in CONDITIONS:
        c["cond_" + name] = (c["condition"] == name).astype(int)
    c["thr_active"] = c["score"] >= cfg["cond_score_min"]
    return c


# ----------------------------------------------------------------------------- 3. rule-based detection
def detect(d, c, cfg):
    """Rule-based alerts (this is the 'detect anomalies' half). Returns a DataFrame."""
    p = cfg["persist_days"]
    d = d.copy()
    d["abn_run"] = (d.groupby("biomarker")["sev"]
                     .transform(lambda s: (s >= 1).astype(int).rolling(p, min_periods=p).sum())
                     .fillna(0))
    out = []

    def add(day, subject, cond, kind, level, score, msg):
        out.append((int(day), subject, cond, kind, level, float(score), msg))

    for r in d.itertuples():
        if r.fault_frac >= 0.5:
            add(r.mission_day, r.biomarker, r.condition, "SENSOR_FAULT", "INFO", 0,
                f"{r.biomarker}: sensor path looks broken ({r.faults}/{r.n} readings lost) - re-measure")
            continue
        if r.status == "CRITICAL" or (r.status == "URGENT" and r.abn_run >= p):
            add(r.mission_day, r.biomarker, r.condition, "THRESHOLD", r.status, r.dev,
                f"{r.biomarker} = {r.value:.2f} {r.unit} is outside the normal range "
                f"[{r.norm_lo:g}, {r.norm_hi:g}]")
        if abs(r.spike_z) >= cfg["spike_k"]:
            lvl = "CRITICAL" if r.status == "CRITICAL" else "URGENT"
            add(r.mission_day, r.biomarker, r.condition, "SPIKE", lvl, r.spike_z,
                f"{r.biomarker} changed {r.spike_z:+.1f} sigma more than its usual day-to-day change (last {cfg['spike_window']} days)")

    for r in c.itertuples():
        if r.thr_active or r.n_spike > 0:
            lvl = "CRITICAL" if r.n_crit > 0 else "URGENT"
            add(r.mission_day, r.condition, r.condition, "CONDITION", lvl, r.score,
                f"{r.condition}: score {r.score} ({r.n_crit} critical, {r.n_urgent} urgent, {r.n_spike} spike)")
    cols = ["mission_day", "subject", "condition", "kind", "level", "score", "message"]
    return pd.DataFrame(out, columns=cols)


# ----------------------------------------------------------------------------- 4. training labels
def add_labels(c, events, cfg):
    """Ground truth for training only.

    y          = the condition becomes abnormal (score>=2) within the next H days
    eligible   = the row is a fair question for the model:
                   - the condition is NOT abnormal yet (otherwise it's detection, not prediction)
                   - no scripted event is in progress or coming (a sudden shock cannot be predicted
                     from the past; that's the spike detector's job)
                   - there are H future days to check
    """
    c = c.copy()
    ev = set()
    for e in events.itertuples():
        cond = BIO2COND.get(e.biomarker)
        for day in range(int(e.start_day), int(e.start_day + e.duration_days)):
            ev.add((cond, day))
    H = cfg["horizon"]
    parts = []
    for cond, g in c.groupby("condition"):
        g = g.sort_values("mission_day").reset_index(drop=True)
        ta = g["thr_active"].values
        ea = np.array([(cond, day) in ev for day in g["mission_day"]])
        fut_t, fut_e = np.zeros(len(g), bool), np.zeros(len(g), bool)
        for h in range(1, H + 1):
            fut_t[:-h] |= ta[h:]
            fut_e[:-h] |= ea[h:]
        g["event_now"] = ea
        g["y"] = fut_t
        g["eligible"] = (~ta) & (~ea) & (~fut_e) & (np.arange(len(g)) < len(g) - H)
        parts.append(g)
    return pd.concat(parts, ignore_index=True)


def prepare_mission(csv_path, thr, cfg):
    """Load one mission CSV (+ its _events.csv) and return (daily, condition table with labels, events)."""
    readings = pd.read_csv(csv_path)
    events = pd.read_csv(str(csv_path).replace(".csv", "_events.csv"))
    d = daily_table(readings, thr, cfg)
    c = add_labels(condition_table(d, cfg), events, cfg)
    return d, c, events
