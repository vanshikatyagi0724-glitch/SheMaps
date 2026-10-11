-- SheMaps Database Schema
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL CHECK (length(trim(title)) >= 3 AND length(title) <= 100),
  description TEXT CHECK (description IS NULL OR length(description) <= 1000),
  category TEXT NOT NULL CHECK (category IN ('Streetlight', 'Footpath', 'Public Transport', 'Road Damage', 'Accessibility', 'Other')),
  location TEXT NOT NULL CHECK (length(trim(location)) >= 1 AND length(location) <= 255),
  severity TEXT NOT NULL CHECK (severity IN ('High', 'Medium', 'Low')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Resolved')),
  latitude REAL,
  longitude REAL,
  support_count INTEGER NOT NULL DEFAULT 1 CHECK (support_count >= 1),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR
    (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude >= -90.0 AND latitude <= 90.0 AND longitude >= -180.0 AND longitude <= 180.0)
  )
);

CREATE TABLE IF NOT EXISTS issue_supports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  supporter_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  UNIQUE(issue_id, supporter_id)
);

CREATE TABLE IF NOT EXISTS issue_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  old_status TEXT NOT NULL CHECK (old_status IN ('Pending', 'In Progress', 'Resolved')),
  new_status TEXT NOT NULL CHECK (new_status IN ('Pending', 'In Progress', 'Resolved')),
  note TEXT,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);
CREATE INDEX IF NOT EXISTS idx_issue_supports_lookup ON issue_supports(issue_id, supporter_id);
