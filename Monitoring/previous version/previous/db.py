"""SQLite schema shared by the streamer and the monitor."""
import sqlite3

SCHEMA = """
CREATE TABLE IF NOT EXISTS readings(
  id            INTEGER PRIMARY KEY AUTOINCREMENT,  -- arrival order = what the monitor follows
  mission       TEXT    NOT NULL,
  ts            TEXT    NOT NULL,
  mission_day   INTEGER NOT NULL,
  phase         TEXT    NOT NULL,                   -- earth | transit | mars
  instrument_id INTEGER,
  biomarker     TEXT    NOT NULL,
  value         REAL,                               -- NULL = broken sensor path (DAC code 0)
  dac_code      INTEGER,
  dac_volts     REAL
);
CREATE INDEX IF NOT EXISTS idx_readings_day ON readings(mission, mission_day, biomarker);

CREATE TABLE IF NOT EXISTS alerts(
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  mission     TEXT,
  mission_day INTEGER,
  subject     TEXT,     -- a biomarker name, or a condition name for CONDITION / RISK_FORECAST
  condition   TEXT,
  kind        TEXT,     -- THRESHOLD | SPIKE | SENSOR_FAULT | CONDITION | RISK_FORECAST
  level       TEXT,     -- INFO | WATCH | URGENT | CRITICAL
  score       REAL,
  message     TEXT,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mission, mission_day, subject, kind)       -- re-running never duplicates an alert
);

CREATE TABLE IF NOT EXISTS monitor_state(
  mission TEXT PRIMARY KEY,
  last_day_done INTEGER                               -- so the monitor can restart safely
);
"""


def connect(path):
    conn = sqlite3.connect(path, timeout=30)
    conn.execute("PRAGMA journal_mode=WAL")   # lets the monitor read while the streamer writes
    conn.executescript(SCHEMA)
    return conn
