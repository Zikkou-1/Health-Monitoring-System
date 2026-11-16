import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

# 1. Load Data & Thresholds
df = pd.read_csv("flight_measurements.csv", parse_dates=["timestamp_utc"])
thresholds = pd.read_csv("instrument_map.csv").set_index("name")
df = df.sort_values(["biomarker", "timestamp_utc"]).reset_index(drop=True)
df["timestamp_utc"] = df["timestamp_utc"].dt.floor("5min") # normilize time stamps to exally 5min steps

# 2. Compute Phase Progress & Days Elapsed
phase_bounds = df.groupby("phase")["timestamp_utc"].agg(["min", "max"])
df = df.merge(phase_bounds, on="phase", how="left")
df["phase_duration_days"] = (
    df["max"] - df["min"]
).dt.total_seconds() / 86400.0
df["phase_days_elapsed"] = (
    df["timestamp_utc"] - df["min"]
).dt.total_seconds() / 86400.0
df["phase_progress"] = (
    df["phase_days_elapsed"] / df["phase_duration_days"].replace(0, 1)
).clip(0, 1)

# 3. Engineer Time-Series Features
df["baseline"] = df["biomarker"].map(thresholds["baseline"])
df["delta_from_baseline"] = df["value"] - df["baseline"]
df["rolling_mean"] = df.groupby("biomarker")["value"].transform(
    lambda s: s.rolling(window=6, min_periods=1).mean()
)
df["rolling_trend"] = df["value"] - df["rolling_mean"]

# 4. Tag Your Scripted EVENTS Explicitly (For Auditing & Self-Correction)
EVENTS = [
    ("transit", 0.40, "IL_6", 60.0, 3),
    ("transit", 0.55, "bpm_resting", 55.0, 1),
    ("mars", 0.05, "hrv", -40.0, 2),
    ("mars", 0.30, "b_glucose_mg_dl", 35.0, 4),
]

df["is_scripted_event"] = False
for phase_name, start_pct, bio, delta_val, dur_days in EVENTS:
  # Calculate exact start and end day inside that phase
  phase_total_days = df.loc[
      df["phase"] == phase_name, "phase_duration_days"
  ].max()
  start_day = start_pct * phase_total_days
  end_day = start_day + dur_days

  mask = (
      (df["phase"] == phase_name)
      & (df["biomarker"] == bio)
      & (df["phase_days_elapsed"] >= start_day)
      & (df["phase_days_elapsed"] <= end_day)
  )
  df.loc[mask, "is_scripted_event"] = True

# 5. Map Every Biomarker to its Clinical Condition
BIOMARKER_TO_CONDITION = {
    "IL_6": "SYSTEMIC_INFLAMMATION",
    "TNF_alpha": "SYSTEMIC_INFLAMMATION",
    "body_temp": "SYSTEMIC_INFLAMMATION",
    "cfu_rate": "SYSTEMIC_INFLAMMATION",
    "bpm_resting": "AUTONOMIC_STRESS_CARDIO",
    "hrv": "AUTONOMIC_STRESS_CARDIO",
    "trt_difference": "SANS_OCULAR_RISK",
    "refraction_shift": "SANS_OCULAR_RISK",
    "visual_acuity_delta": "SANS_OCULAR_RISK",
    "ijv_flow": "VTE_THROMBOSIS_RISK",
    "ijv_stasis": "VTE_THROMBOSIS_RISK",
    "ijv_microthrombi": "VTE_THROMBOSIS_RISK",
    "bone_loss_rate": "BONE_RENAL_DECONDITIONING",
    "t_score": "BONE_RENAL_DECONDITIONING",
    "ctx_p1np_ratio": "BONE_RENAL_DECONDITIONING",
    "urinary_calcium": "BONE_RENAL_DECONDITIONING",
    "b_glucose_mg_dl": "METABOLIC_HYDRATION",
    "hydration_L": "METABOLIC_HYDRATION",
    "calories_kcal": "METABOLIC_HYDRATION",
    "body_weight": "METABOLIC_HYDRATION",
    "absorbtion_msy": "ACUTE_RADIATION_SYNDOME",
    "lymphocyty_count": "ACUTE_RADIATION_SYNDOME",
    "oxygen_sat": "HYPOXEMIA"
}

df["condition_label"] = "NORMAL"
df.loc[df["status"] == "FAULT", "condition_label"] = "SENSOR_HW_FAULT"
abnormal_mask = (df["status"].isin(["URGENT", "CRITICAL"])) | (
    df["is_scripted_event"]
)
df.loc[abnormal_mask, "condition_label"] = (
    df.loc[abnormal_mask, "biomarker"]
    .map(BIOMARKER_TO_CONDITION)
    .fillna("GENERAL_ANOMALY")
)

# 6. Honest 80/20 Train/Test Split
feature_cols = [
    "value",
    "dac_volts",
    "phase_progress",
    "delta_from_baseline",
    "rolling_mean",
    "rolling_trend",
]
X = pd.get_dummies(
    df[feature_cols + ["biomarker", "phase"]], drop_first=False
)
y = df["condition_label"]

X_train, X_test, y_train, y_test, idx_train, idx_test = train_test_split(
    X, y, df.index, test_size=0.2, random_state=42, stratify=y
)

clf = RandomForestClassifier(
    n_estimators=150, class_weight="balanced", random_state=42, n_jobs=-1
)
clf.fit(X_train, y_train)

# 7. Audit on Unseen Data & Scripted Events
y_pred = clf.predict(X_test)
print("=== Honest Performance on Unseen 20% Data ===")
print(classification_report(y_test, y_pred))

# Check how many of your scripted EVENTS rows in the test set were caught
test_events = df.loc[idx_test]
scripted_subset = test_events[test_events["is_scripted_event"]]
caught = (
    y_pred[test_events["is_scripted_event"].values] != "NORMAL"
).sum()
print(
    f"Scripted EVENTS Caught in Test Set: {caught} / {len(scripted_subset)}"
)

# 8. Save Production Bundle
joblib.dump(
    {
        "thresholds": thresholds.to_dict(orient="index"),
        "model": clf,
        "feature_columns": list(X.columns),
        "phase_durations": phase_bounds.to_dict(orient="index"),
    },
    "nasa_health_monitor.pkl",
)


