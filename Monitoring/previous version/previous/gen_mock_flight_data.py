#!/usr/bin/env python3
"""Mock flight-measurement generator (Earth -> Transit -> Mars) for the ESP32-S2 DAC replay.

Outputs:
  flight_measurements.csv  one row per sample  (timestamp, instrument_id, value, status, dac_code, ...)
  instrument_map.csv       lookup table: instrument_id -> biomarker, scale, thresholds

Usage:
  python gen_mock_flight_data.py                      # compressed demo mission (60 days)
  python gen_mock_flight_data.py --pre 14 --transit 180 --mars 30 --hf-minutes 10
"""
import argparse
import numpy as np
import pandas as pd

# ------------------------------------------------------------------ DAC model
DAC_BITS = 8                 # ESP32-S2 DAC is 8-bit
DAC_MAX = 2**DAC_BITS - 1    # 255
VREF = 3.3                   # ~full-scale volts
BASELINE_V = 0.5             # below this = broken path, at/above = valid reading
BASE_CODE = int(round(BASELINE_V / VREF * DAC_MAX))   # ~39


def to_dac(value, scale_min, scale_max):
    """Map physical value -> DAC code in [BASE_CODE, 255]. 0 is reserved for 'broken path'."""
    frac = np.clip((value - scale_min) / (scale_max - scale_min), 0, 1)
    return int(round(BASE_CODE + frac * (DAC_MAX - BASE_CODE)))


# ---------------------------------------------------------- instrument table
# id, name, unit, rate, baseline, noise_sd, norm_lo, norm_hi, crit_lo, crit_hi,
# dac_min, dac_max, drift_transit, drift_mars, round_to_int
# status: inside [norm_lo, norm_hi] = NORM; outside norm but inside [crit_lo, crit_hi] = URGENT;
#         outside [crit_lo, crit_hi] = CRITICAL.
# Some critical limits are ASSUMED (not in the source list) - agree on them as a team.
COLS = ["id", "name", "unit", "rate", "base", "sd", "n_lo", "n_hi", "c_lo", "c_hi",
        "dac_min", "dac_max", "d_transit", "d_mars", "ordinal"]
INSTR = [
    (0,  "bpm_resting",            "bpm",     "HF", 68,   3,    60,  100,  40,  150,  30,  160,   4,    2,    0),
    (1,  "hrv",                    "ms",      "HF", 55,   6,    20,  90,   10,  150,  0,   150,   -10,  -5,   0),
    (2,  "body_weight",            "kg",      "LF", 75,   0.3,  73.5, 76.5, 67.5, 90,  50,  100,   -2.5, -1.5, 0),
    (3,  "b_glucose_mg_dl",        "mg/dL",   "LF", 88,   5,    70,  99,   54,  200,  40,  250,   4,    3,    0),
    (4,  "sleep_duration",         "h",       "LF", 7.5,  0.6,  7,   9,    4,   12,   0,   24,    -0.8, -0.3, 0),
    (5,  "sleep_efficiency_pct",   "%",       "LF", 90,   3,    85,  100,  65,  100,  40,  100,   -4,   -2,   0),
    (6,  "calories_kcal",          "kcal",    "LF", 2800, 150,  2600, 3200, 1400, 4500, 0, 4500,  -200, -100, 0),
    (7,  "protein_g_per_kg",       "g/kg/d",  "LF", 1.0,  0.08, 0.8, 1.2,  0.4, 2.5,   0,   3,     -0.1, -0.05, 0),
    (8,  "vitamin_D_serum",        "ng/mL",   "LF", 38,   3,    30,  50,   10,  150,  0,   160,   -10,  -6,   0),
    (9,  "omega3_g",               "g/d",     "LF", 0.4,  0.05, 0.25, 1.0, 0.10, 3,   0,   3,     -0.1, -0.05, 0),
    (10, "hydration_L",            "L/d",     "LF", 2.4,  0.25, 2.0, 4.0,  1.0, 6.0,  0,   6,     -0.3, -0.1, 0),
    (11, "zinc_mg",                "mg/d",    "LF", 11,   1,    8,   40,   3,   60,   0,   60,    -1,   -0.5, 0),
    (12, "magnesium_serum",        "mg/dL",   "LF", 2.0,  0.08, 1.7, 2.2,  1.0, 3.0,  0.5, 3.5,   -0.15, -0.1, 0),
    (13, "trt_difference",         "um",      "LF", 19,   1,    0,   20.9, -10, 50,   0,   100,   8,    4,    0),
    (14, "refraction_shift",       "D",       "LF", 0,    0.08, -0.25, 0.25, -1.5, 1.5, -2, 3,    0.5,  0.3,  0),
    (15, "visual_acuity_decrement", "lines",  "LF", 0,    0.15, 0,   0.5,  -1,  3,    0,   5,      0.8,  0.5,  0),
    (16, "bone_loss_rate_pct",     "%/month", "LF", 1.0,  0.08, 0,   1.5,  -1,  10,   0,   12,     0.1,  0.05, 0),
    (17, "t_score",                "SD",      "LF", -0.4, 0.05, -1.0, 3,   -2.0, 4,   -4,  3,     -0.4, -0.2, 0),
    (18, "ctx_p1np_ratio",         "x base",  "LF", 1.0,  0.08, 0.5, 1.5,  0.0, 2.0,  0,   3,      0.35, 0.2,  0),
    (19, "urinary_calcium_mg",     "mg/d",    "LF", 220,  25,   0,   300,  -1,  500,  0,   700,    50,   30,   0),
    (20, "IL_6",                   "pg/mL",   "LF", 2.5,  0.8,  0,   7,    -1,  100,  0,   120,    1,    0.5,  0),
    (21, "TNF_alpha",              "pg/mL",   "LF", 4,    1,    0,   8.1,  -1,  50,   0,   60,     1,    0.5,  0),
    (22, "ijv_flow",               "state",   "LF", 0,    0.25, 0,   0,    0,   1,    0,   2,      0.45, 0.2,  1),
    (23, "ijv_stasis",             "state",   "LF", 0,    0.25, 0,   0,    0,   1,    0,   2,      0.45, 0.2,  1),
    (24, "ijv_microthrombi",       "ug/mL FEU", "LF", 0.25, 0.08, 0, 0.5,  -1,  1.0,  0,   1.5,    0.15, 0.05, 0),
    (25, "calf_circumference",     "cm",      "LF", 36.5, 0.3,  35,  38,   31,  42,   25,  45,    -1.5, -0.5, 0),
    (26, "cfu_rate",               "CFU/m3",  "LF", 150,  40,   0,   500,  -1,  1000, 0,   1500,   50,   30,   0),
    (27, "body_temp",              "degC",    "LF", 36.8, 0.15, 36.1, 38.1, 35.0, 39.5, 34, 42,    0.1,  0.05, 0),
    (28, "absorbed_dose_msv", "mSv",      "HF", 10,   5,   1,    400,  1,   600,  0,   700,  300,  420, 0),
    (29, "lymphocyte_count",  "cells/uL", "LF", 2000, 100, 1500, 3000, 500, 5000, 100, 5000, -200, -500, 0),
    (30, "oxygen_sat",  "SpO2", "LF", 100, .1, 95, 1000, 90, 1000, 0, 100, -1, -4, 0)

]
INST = pd.DataFrame(INSTR, columns=COLS)
INST["id_bits"] = INST["id"].map(lambda i: format(i, "05b"))   # 5 parallel digital lines (32 ids)

# Scripted events: (mission_day, biomarker, additive_shock, duration_days)
EVENTS = [
    ("transit", 0.40, "IL_6", 60.0, 3),          # inflammation episode at 40% of transit
    ("transit", 0.40, "body_temp", 1.5, 3),      # fever together with the IL_6 spike
    ("transit", 0.55, "bpm_resting", 55.0, 1),   # tachycardia episode
    ("mars",    0.05, "hrv", -40.0, 2),          # stress collapse after landing
    ("mars",    0.30, "b_glucose_mg_dl", 35.0, 4),
]


def status_of(v, r):
    if v < r.c_lo or v > r.c_hi:
        return "CRITICAL"
    if r.n_lo <= v <= r.n_hi:
        return "NORM"
    return "URGENT"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pre", type=int, default=10, help="days on Earth (baseline)")
    ap.add_argument("--transit", type=int, default=30, help="days in transit")
    ap.add_argument("--mars", type=int, default=20, help="days on Mars surface")
    ap.add_argument("--hf-minutes", type=int, default=5, help="HF sample period (min)")
    ap.add_argument("--fault-rate", type=float, default=0.002, help="broken-path probability")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default="flight_measurements.csv")
    ap.add_argument("--map-out", default="instrument_map.csv")
    ap.add_argument("--event-jitter", type=int, default=0,
                    help="shift each event by +-N days and scale its size by +-20%% (per seed)")
    ap.add_argument("--profile-var", type=float, default=0.0,
                    help="per-astronaut baseline variation, as a fraction of the normal-range width, e.g. 0.1")
    a = ap.parse_args()
    rng = np.random.default_rng(a.seed)

    t0 = pd.Timestamp("2035-01-01 00:00:00")
    phases = [("earth", a.pre), ("transit", a.transit), ("mars", a.mars)]
    starts, d = {}, 0
    for name, n in phases:
        starts[name] = (d, n)
        d += n
    total_days = d

    def phase_of(day):
        for name, (s, n) in starts.items():
            if s <= day < s + n:
                return name, (day - s) / max(n, 1)   # progress 0..1 inside the phase
        return "mars", 1.0

    # per-day drift (linear ramp inside phase; mars starts from the end-of-transit offset)
    def drift(r, phase, prog):
        if phase == "earth":
            return 0.0
        if phase == "transit":
            return r.d_transit * prog
        return r.d_transit + r.d_mars * prog

    # event shocks as {(biomarker, day): shock}
    shocks, truth = {}, []
    for ph, frac, bm, amt, dur in EVENTS:
        s, n = starts[ph]
        day0 = s + int(frac * n)
        if a.event_jitter:
            day0 += int(rng.integers(-a.event_jitter, a.event_jitter + 1))
            amt *= float(rng.uniform(0.8, 1.2))
        truth.append((ph, bm, round(amt, 3), day0, dur))
        for k in range(dur):
            shocks[(bm, day0 + k)] = amt * (1 - k / dur)

    rows = []
    for r in INST.itertuples():
        if r.rate == "HF":
            step = pd.Timedelta(minutes=a.hf_minutes)
            times = pd.date_range(t0, t0 + pd.Timedelta(days=total_days) - step, freq=step)
        else:  # LF: one sample/day, staggered by instrument id so lines don't collide
            times = pd.date_range(t0 + pd.Timedelta(hours=8, minutes=r.id * 2),
                                  periods=total_days, freq="D")
        day = ((times - t0) // pd.Timedelta(days=1)).astype(int)
        hour = times.hour + times.minute / 60
        n = len(times)

        val = np.full(n, float(r.base) + rng.normal(0, a.profile_var * (r.n_hi - r.n_lo)))
        phase_names, progs = zip(*[phase_of(x) for x in day])
        val += np.array([drift(r, p, g) for p, g in zip(phase_names, progs)])
        val += np.array([shocks.get((r.name, x), 0.0) for x in day])
        # circadian shape on the HF channels (night dip on BPM, opposite on HRV)
        if r.name == "bpm_resting":
            val += 6 * np.cos(2 * np.pi * (hour - 14) / 24)   # peak 14h, trough 02h
        if r.name == "hrv":
            val -= 6 * np.cos(2 * np.pi * (hour - 14) / 24)
        val += rng.normal(0, r.sd, n)
        if r.ordinal:
            val = np.clip(np.round(val), 0, 2)
        val = np.clip(val, r.dac_min, r.dac_max)

        for i in range(n):
            v = float(val[i])
            if rng.random() < a.fault_rate:        # broken path: DAC pinned at 0V
                code, volts, st, v_out = 0, 0.0, "FAULT", np.nan
            else:
                code = to_dac(v, r.dac_min, r.dac_max)
                volts = round(code / DAC_MAX * VREF, 3)
                st, v_out = status_of(v, r), round(v, 3)
            rows.append((times[i], int(day[i]), phase_names[i], r.id, r.id_bits,
                         r.name, r.unit, r.rate, v_out, st, code, volts))

    df = pd.DataFrame(rows, columns=["timestamp_utc", "mission_day", "phase", "instrument_id",
                                     "id_bits", "biomarker", "unit", "rate_class", "value",
                                     "status", "dac_code", "dac_volts"])
    df = df.sort_values(["timestamp_utc", "instrument_id"]).reset_index(drop=True)
    df.to_csv(a.out, index=False)
    pd.DataFrame(truth, columns=["phase", "biomarker", "shock", "start_day", "duration_days"]) \
        .to_csv(a.out.replace(".csv", "_events.csv"), index=False)

    INST.rename(columns={"base": "baseline", "sd": "noise_sd", "n_lo": "norm_lo", "n_hi": "norm_hi",
                         "c_lo": "crit_lo", "c_hi": "crit_hi"}).drop(columns=["ordinal"]) \
        .to_csv(a.map_out, index=False)

    print(f"{len(df)} rows -> {a.out} | DAC baseline code {BASE_CODE} ({BASELINE_V} V)")
    print(df.groupby(["phase", "status"]).size().unstack(fill_value=0))


if __name__ == "__main__":
    main()
