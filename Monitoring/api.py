"""API for the React front-end. Two independent data sources:

  A) LIVE STREAM  (CSV file, replayed at an adjustable speed)  -> /api/stream/...
     Raw sensor readings for real-time graphs. The server keeps a "playback clock", so every browser
     tab sees the same moment of the mission. The CSV 'status' column is NOT sent (it is the answer key).

  B) DAILY REPORTS (health.db, written by stream_csv_to_db.py + monitor.py)  -> /api/daily/..., /api/alerts
     One report per mission day: every biomarker's daily value + status, condition scores, alerts.

Run:   python api.py            (from the folder that contains features.py, health.db, data/)
Tip:   macOS uses port 5000 for AirPlay Receiver. If you get "address already in use",
       run  PORT=5001 python api.py  (and point React to 5001) or switch AirPlay Receiver off.
"""
import os
import sqlite3
import threading
import time
from pathlib import Path

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request

from features import condition_table, daily_table, load_config, load_thresholds

BASE = Path(__file__).resolve().parent
DB_PATH = os.environ.get("HEALTH_DB", str(BASE / "health.db"))
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE / "data"))
DEFAULT_CSV = os.environ.get("SENSOR_CSV", str(DATA_DIR / "mission_6.csv"))
THR_PATH = os.environ.get("THRESHOLDS", str(BASE / "instrument_map.csv"))
CFG_PATH = os.environ.get("CONFIG", str(BASE / "config.json"))

app = Flask(__name__)
try:
    from flask_cors import CORS
    CORS(app)
except ImportError:                                  # fallback so the API still works without flask-cors
    @app.after_request
    def _cors(resp):
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
        resp.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
        return resp


# ------------------------------------------------------------------ helpers
def db():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn


def records(df):
    """DataFrame -> list of dicts that is valid JSON (NaN / inf become null)."""
    df = df.replace([np.inf, -np.inf], np.nan)
    return df.astype(object).where(df.notna(), None).to_dict("records")


def bad(msg, code=400):
    return jsonify({"error": msg}), code


# ====================================================================== A) LIVE STREAM FROM CSV
class Playback:
    """A shared 'tape player' over a CSV file.

    position(now) = base + (now - t0) * speed      (rows), we set it to 20rows/s and needs to be synced with the heath.db reading for daily reports
    Nothing runs in the background: the position is computed from the clock when asked.
    """

    def __init__(self):
        self.lock = threading.Lock()
        self.df = None
        self.csv = None
        self.speed = 20        # rows per second
        self.running = True
        self.base = 0
        self.t0 = time.time()
        self.epoch = 0           # bumps on restart/seek/switch so clients know to clear their charts

    def load(self, path):
        df = pd.read_csv(path, usecols=["timestamp_utc", "mission_day", "phase", "instrument_id",
                                        "biomarker", "value", "dac_code", "dac_volts"])
        self.df = df.reset_index(drop=True)
        self.csv = str(path)
        self.base, self.t0, self.epoch = 0, time.time(), self.epoch + 1

    def _pos(self):
        if self.df is None:
            return 0
        if not self.running:
            return self.base
        return min(len(self.df), self.base + int((time.time() - self.t0) * self.speed))

    def position(self):
        with self.lock:
            return self._pos()

    def control(self, action, **kw):
        with self.lock:
            pos = self._pos()
            if action == "pause":
                self.base, self.running = pos, False
            elif action == "play":
                self.base, self.t0, self.running = pos, time.time(), True
            elif action == "speed":
                self.base, self.t0, self.speed = pos, time.time(), max(0.1, float(kw["speed"]))
            elif action == "restart":
                self.base, self.t0, self.running, self.epoch = 0, time.time(), True, self.epoch + 1
            elif action == "seek_day":
                idx = int(np.searchsorted(self.df["mission_day"].values, int(kw["day"]), side="left"))
                self.base, self.t0, self.epoch = min(idx, len(self.df)), time.time(), self.epoch + 1 
            else:
                raise ValueError(f"unknown action '{action}'")

    def status(self):
        with self.lock:
            pos = self._pos()
            last = self.df.iloc[pos - 1] if pos > 0 else None
            return {"csv": Path(self.csv).name, "running": self.running, "speed_rows_per_s": self.speed,
                    "cursor": pos, "total_rows": len(self.df), "finished": pos >= len(self.df),
                    "epoch": self.epoch,
                    "mission_day": None if last is None else int(last["mission_day"]),
                    "sim_time": None if last is None else str(last["timestamp_utc"])}


player = Playback()
if Path(DEFAULT_CSV).exists():
    player.load(DEFAULT_CSV)


def need_player():
    return None if player.df is not None else bad(f"no CSV loaded; put one in {DATA_DIR} and POST /api/stream/control", 503)


@app.route("/api/stream/files")
def stream_files():
    files = sorted(p.name for p in DATA_DIR.glob("*.csv") if not p.name.endswith("_events.csv"))
    return jsonify(files)


@app.route("/api/stream/status")
def stream_status():
    return need_player() or jsonify(player.status())


@app.route("/api/stream/control", methods=["POST"])
def stream_control():
    """Body examples: {"action":"pause"} {"action":"play"} {"action":"speed","speed":100}
                      {"action":"restart"} {"action":"seek_day","day":40} {"action":"load","csv":"mission_3.csv"}"""
    body = request.get_json(silent=True) or {}
    action = body.get("action")
    try:
        if action == "load":
            path = DATA_DIR / Path(str(body.get("csv", ""))).name        # only files inside data/
            if not path.exists():
                return bad("csv not found in data folder", 404)
            player.load(path)
        else:
            if player.df is None:
                return need_player()
            player.control(action, **{k: v for k, v in body.items() if k != "action"})
    except (ValueError, KeyError) as e:
        return bad(str(e))
    return jsonify(player.status())


@app.route("/api/stream/readings")
def stream_readings():
    """Poll this every ~1 s.  ?since=<next_cursor from last call>&limit=500&biomarkers=hrv,bpm_resting
    Returns only the rows the playback clock has 'produced' since your last call."""
    err = need_player()
    if err:
        return err
    since = request.args.get("since", default=0, type=int)
    limit = min(request.args.get("limit", default=500, type=int), 5000)
    epoch = request.args.get("epoch", default=None, type=int)
    cur = player.position()
    st = player.status()
    restarted = since > cur or (epoch is not None and epoch != st["epoch"])
    if restarted:                                    # tape was rewound / file switched: client must clear charts
        return jsonify({"rows": [], "next_cursor": cur, "restarted": True, **st})
    chunk = player.df.iloc[since:min(cur, since + limit)]
    end = since + len(chunk)
    wanted = request.args.get("biomarkers")
    if wanted:
        chunk = chunk[chunk["biomarker"].isin(wanted.split(","))]
    chunk = chunk.assign(i=chunk.index)
    return jsonify({"rows": records(chunk), "next_cursor": end, "restarted": False, **st})


@app.route("/api/stream/window")
def stream_window():
    """Initial chart fill: the last N points of each biomarker up to 'now'.
    ?biomarkers=hrv,bpm_resting&last=200  -> {"series": {"hrv": [...], ...}, "next_cursor": N}"""
    err = need_player()
    if err:
        return err
    last = min(request.args.get("last", default=200, type=int), 5000)
    wanted = request.args.get("biomarkers")
    cur = player.position()
    seen = player.df.iloc[:cur]
    if wanted:
        seen = seen[seen["biomarker"].isin(wanted.split(","))]
    seen = seen.assign(i=seen.index)
    series = {b: records(g.tail(last)) for b, g in seen.groupby("biomarker")}
    return jsonify({"series": series, "next_cursor": cur, **player.status()})


# ====================================================================== B) DAILY REPORTS FROM health.db
_cache = {}


def latest_mission(conn):
    r = conn.execute("SELECT mission FROM readings ORDER BY id DESC LIMIT 1").fetchone()
    return r["mission"] if r else None


def frames(mission):
    """Daily + condition tables for a mission, recomputed only when new readings arrived."""
    conn = db()
    n, max_day = conn.execute("SELECT COUNT(*), COALESCE(MAX(mission_day),-1) FROM readings WHERE mission=?",
                              (mission,)).fetchone()
    if n == 0:
        conn.close()
        return None
    key = (mission, n)
    if _cache.get("key") != key:
        readings = pd.read_sql_query("SELECT mission_day, phase, biomarker, value FROM readings WHERE mission=?",
                                     conn, params=(mission,))
        cfg, thr = load_config(CFG_PATH), load_thresholds(THR_PATH)
        d = daily_table(readings, thr, cfg)
        _cache.update(key=key, d=d, c=condition_table(d, cfg), max_day=int(max_day), cfg=cfg)
    conn.close()
    return _cache["d"], _cache["c"], _cache["max_day"]


def resolve_mission():
    m = request.args.get("mission")
    if m:
        return m
    conn = db()
    m = latest_mission(conn)
    conn.close()
    return m


@app.route("/api/missions")
def missions():
    conn = db()
    rows = conn.execute("SELECT mission, COUNT(*) AS readings, MIN(mission_day) AS first_day, "
                        "MAX(mission_day) AS last_day FROM readings GROUP BY mission").fetchall()
    st = {r["mission"]: r["last_day_done"] for r in conn.execute("SELECT * FROM monitor_state").fetchall()}
    conn.close()
    return jsonify([{**dict(r), "monitor_last_day_done": st.get(r["mission"])} for r in rows])


@app.route("/api/thresholds")
def thresholds():
    """Normal/critical limits per biomarker, so the front-end can draw bands and colour values."""
    t = load_thresholds(THR_PATH).reset_index()
    keep = [c for c in ["name", "unit", "rate", "baseline", "noise_sd", "norm_lo", "norm_hi", "crit_lo", "crit_hi"]
            if c in t.columns]
    return jsonify(records(t[keep]))


@app.route("/api/alerts")
def alerts():
    """?mission=M6&since_id=120&level=URGENT,CRITICAL&kind=SPIKE&day=34&limit=50   (newest first)"""
    mission = resolve_mission()
    q, args = "SELECT id, mission_day, subject, condition, kind, level, score, message FROM alerts WHERE mission=?", [mission]
    if request.args.get("since_id"):
        q += " AND id>?"; args.append(request.args.get("since_id", type=int))
    if request.args.get("day"):
        q += " AND mission_day=?"; args.append(request.args.get("day", type=int))
    if request.args.get("level"):
        lv = request.args["level"].split(","); q += f" AND level IN ({','.join('?' * len(lv))})"; args += lv
    if request.args.get("kind"):
        kd = request.args["kind"].split(","); q += f" AND kind IN ({','.join('?' * len(kd))})"; args += kd
    q += " ORDER BY mission_day DESC, id DESC LIMIT ?"
    args.append(min(request.args.get("limit", default=50, type=int), 500))
    conn = db()
    rows = [dict(r) for r in conn.execute(q, args).fetchall()]
    conn.close()
    return jsonify(rows)


@app.route("/api/readings")
def db_readings():
    """Latest raw rows that are already inside SQLite (kept from your original api.py)."""
    mission = resolve_mission()
    biomarker = request.args.get("biomarker")
    q, args = "SELECT ts, mission_day, biomarker, value FROM readings WHERE mission=?", [mission]
    if biomarker:
        q += " AND biomarker=?"; args.append(biomarker)
    q += " ORDER BY id DESC LIMIT ?"
    args.append(min(request.args.get("limit", default=50, type=int), 2000))
    conn = db()
    rows = [dict(r) for r in conn.execute(q, args).fetchall()]
    conn.close()
    return jsonify(rows)


@app.route("/api/daily/summary")
def daily_summary():
    """One line per mission day (timeline / calendar view): status counts + alert counts."""
    mission = resolve_mission()
    f = frames(mission) if mission else None
    if f is None:
        return jsonify({"mission": mission, "days": []})
    d, _, max_day = f
    st = d.pivot_table(index="mission_day", columns="status", values="biomarker", aggfunc="count", fill_value=0)
    for col in ["NORM", "URGENT", "CRITICAL", "FAULT"]:
        if col not in st:
            st[col] = 0
    phase = d.groupby("mission_day")["phase"].last()
    conn = db()
    al = pd.read_sql_query("SELECT mission_day, level, COUNT(*) AS n FROM alerts WHERE mission=? GROUP BY mission_day, level",
                           conn, params=(mission,))
    conn.close()
    alp = al.pivot_table(index="mission_day", columns="level", values="n", aggfunc="sum", fill_value=0)
    out = []
    for day in st.index:
        a = alp.loc[day] if day in alp.index else {}
        crit, urg = int(a.get("CRITICAL", 0)) if len(a) else 0, int(a.get("URGENT", 0)) if len(a) else 0
        out.append({"day": int(day), "phase": phase[day], "complete": bool(day < max_day),
                    "biomarkers": {k: int(st.loc[day, k]) for k in ["NORM", "URGENT", "CRITICAL", "FAULT"]},
                    "alerts": {k: int(a.get(k, 0)) if len(a) else 0 for k in ["CRITICAL", "URGENT", "WATCH", "INFO"]},
                    "worst": "CRITICAL" if crit else "URGENT" if urg else "NORMAL"})
    return jsonify({"mission": mission, "last_day": max_day, "days": out})


def build_report(mission, day):
    f = frames(mission)
    if f is None:
        return None
    d, c, max_day = f
    dd, cc = d[d["mission_day"] == day], c[c["mission_day"] == day]
    if dd.empty:
        return None
    bio_cols = ["biomarker", "condition", "unit", "value", "n", "faults", "status", "dev", "pbase", "eta_days",
                "spike_z", "norm_lo", "norm_hi", "crit_lo", "crit_hi"]
    bio = dd[bio_cols].copy()
    bio["trend"] = np.where(dd["toward"] > 0.01, "worsening", np.where(dd["toward"] < -0.01, "improving", "stable"))
    bio = bio.sort_values(["condition", "biomarker"])
    cc = cc.copy()
    cc["level"] = np.where(cc["n_crit"] > 0, "CRITICAL",
                           np.where(cc["thr_active"] | (cc["n_spike"] > 0), "URGENT", "NORMAL"))
    conn = db()
    al = [dict(r) for r in conn.execute(
        "SELECT id, subject, condition, kind, level, score, message FROM alerts WHERE mission=? AND mission_day=? "
        "ORDER BY CASE level WHEN 'CRITICAL' THEN 0 WHEN 'URGENT' THEN 1 WHEN 'WATCH' THEN 2 ELSE 3 END, id",
        (mission, day)).fetchall()]
    conn.close()
    counts = dd["status"].value_counts().to_dict()
    worst = "CRITICAL" if counts.get("CRITICAL") else "URGENT" if counts.get("URGENT") else "NORMAL"  #shouldn't we do watch out ...or u did it already guys
    return {"mission": mission, "day": int(day), "phase": dd["phase"].iloc[-1], "complete": bool(day < max_day),
            "overall": worst, "status_counts": {k: int(v) for k, v in counts.items()},
            "conditions": records(cc[["condition", "score", "n_urgent", "n_crit", "n_spike", "level"]]),
            "biomarkers": records(bio), "alerts": al}


@app.route("/api/daily/latest")
def daily_latest():
    mission = resolve_mission()
    f = frames(mission) if mission else None
    if f is None:
        return bad("no readings (in health.db yet)", 404)
    max_day = f[2]
    rep = build_report(mission, max(max_day - 1, 0)) #day 0 in case of just starting
    return jsonify(rep) if rep else bad("no data", 404)


@app.route("/api/daily/<int:day>")
def daily_report(day):
    mission = resolve_mission()
    rep = build_report(mission, day) if mission else None
    return jsonify(rep) if rep else bad(f"no data for day {day}", 404)


@app.route("/api/biomarker/<name>/daily")
def biomarker_daily(name):
    """Daily series of one biomarker for a trend chart (value, status, deviation from baseline)."""
    mission = resolve_mission()
    f = frames(mission) if mission else None
    if f is None:
        return bad("no readings in health.db yet", 404)
    g = f[0][f[0]["biomarker"] == name]
    if g.empty:
        return bad(f"unknown biomarker '{name}'", 404)
    return jsonify({"mission": mission, "biomarker": name, "unit": g["unit"].iloc[0],
                    "limits": records(g[["norm_lo", "norm_hi", "crit_lo", "crit_hi"]].head(1))[0],
                    "days": records(g[["mission_day", "phase", "value", "status", "dev"]])})


@app.route("/api/health")
def health():
    return jsonify({"ok": True, "csv_loaded": player.df is not None, "db": Path(DB_PATH).exists()})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 5001)), debug=True, threaded=True)