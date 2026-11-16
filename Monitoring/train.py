#!/usr/bin/env python3
"""STEP 2 - train the illness-FORECAST model.

  python train.py --data "data/mission_*.csv"

Honest evaluation: whole missions are held out (never random rows).
   all missions except the last two -> TRAIN
   second to last                   -> VALIDATION  (tune.py picks thresholds here)
   last                             -> TEST        (touched only for the final report)
"""
import argparse, glob
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import average_precision_score, precision_recall_fscore_support, roc_auc_score

from features import ML_FEATURES, load_config, load_thresholds, prepare_mission

ap = argparse.ArgumentParser()
ap.add_argument("--data", default="data/mission_*.csv")
ap.add_argument("--thresholds", default="instrument_map.csv")
ap.add_argument("--config", default="config.json")
ap.add_argument("--out", default="model.joblib")
a = ap.parse_args()

cfg, thr = load_config(a.config), load_thresholds(a.thresholds)
files = sorted(f for f in glob.glob(a.data) if not f.endswith("_events.csv"))
assert len(files) >= 3, "need at least 3 missions (train / validation / test) - see make_missions in the guide"

tables = []
for f in files:
    _, c, _ = prepare_mission(f, thr, cfg)
    c["mission"] = f
    tables.append(c)
train = pd.concat(tables[:-2]); val = tables[-2]; test = tables[-1]
tr = train[train.eligible]
print(f"missions: {len(files)} | train rows {len(tr)} (positives {int(tr.y.sum())}) | "
      f"val {int(val.eligible.sum())} | test {int(test.eligible.sum())}")

clf = RandomForestClassifier(n_estimators=300, max_depth=6, min_samples_leaf=3,
                             class_weight="balanced_subsample", random_state=42, n_jobs=-1)
clf.fit(tr[ML_FEATURES], tr["y"])

for name, tab in [("validation", val), ("test", test)]:
    t = tab[tab.eligible]
    p = clf.predict_proba(t[ML_FEATURES])[:, 1]
    pred = p >= 0.5
    pr, rc, f1, _ = precision_recall_fscore_support(t["y"], pred, average="binary", zero_division=0)
    print(f"{name:10s} AUC={roc_auc_score(t['y'], p):.3f}  AvgPrecision={average_precision_score(t['y'], p):.3f}"
          f"  @0.5 -> precision={pr:.2f} recall={rc:.2f}")

imp = pd.Series(clf.feature_importances_, index=ML_FEATURES).sort_values(ascending=False)
print("\nwhat the model relies on:\n", imp.head(6).round(3).to_string())
joblib.dump({"model": clf, "features": ML_FEATURES, "train_files": files[:-2]}, a.out)
print(f"\nsaved {a.out}")
