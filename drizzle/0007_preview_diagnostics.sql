CREATE TABLE IF NOT EXISTS preview_diagnostics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  probe TEXT NOT NULL,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  status INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS preview_diagnostics_probe ON preview_diagnostics(probe, created_at);
