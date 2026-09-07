-- ============================================================
-- In Vivo CAR-T Navigator — Initial Schema
-- ============================================================

-- Organizations (for Multi User tier)
CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Users: four access tiers
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin','demo','single_user','multi_user')),
  org_id INTEGER,
  display_name TEXT,
  can_upload INTEGER DEFAULT 0,     -- explicit Super Admin override for a multi_user account
  can_export INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  last_login_at TEXT,
  FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Data versions: every monthly upload AND every same-month revision is a row here
CREATE TABLE IF NOT EXISTS data_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_label TEXT NOT NULL,              -- e.g. '2026-09'
  version_number INTEGER NOT NULL,        -- 1, 2, 3 ... within the month
  version_label TEXT,                     -- 'Version 1', 'Version 2 (Revised)', 'Version 3 (Final)'
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK(status IN ('draft','pending_review','approved','rejected','superseded')),
  is_current_live INTEGER DEFAULT 0,      -- exactly one row across the whole table should have 1
  data_cutoff_date TEXT,
  reporting_month_confirmed INTEGER DEFAULT 0,
  source_filename TEXT,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by INTEGER,
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INTEGER,
  reviewed_at TEXT,
  review_notes TEXT,
  rejection_reason TEXT,
  summary_json TEXT,                      -- {module: {new, updated, discontinued, conflicting, unchanged}}
  baseline_version_id INTEGER,            -- version this upload was diffed against
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_versions_month_num ON data_versions(month_label, version_number);
CREATE INDEX IF NOT EXISTS idx_versions_live ON data_versions(is_current_live);

-- Records: full snapshot of every module row belonging to a version
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version_id INTEGER NOT NULL,
  module TEXT NOT NULL,
  record_key TEXT NOT NULL,               -- stable natural key used for diffing across versions
  data_json TEXT NOT NULL,                -- full row of fields as JSON
  row_order INTEGER,
  change_type TEXT DEFAULT 'unchanged'
    CHECK(change_type IN ('new','updated','unchanged','discontinued','conflicting')),
  confidence_level TEXT,                  -- High / Medium / Low
  validation_status TEXT,                 -- Verified / Pending / Conflicting / Unverified
  primary_source_url TEXT,
  independent_source_url TEXT,
  source_date TEXT,
  verification_date TEXT,
  conflict_notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (version_id) REFERENCES data_versions(id)
);
CREATE INDEX IF NOT EXISTS idx_records_version_module ON records(version_id, module);
CREATE INDEX IF NOT EXISTS idx_records_key ON records(module, record_key);

-- Change log: detailed field-level diff entries surfaced in the review UI
CREATE TABLE IF NOT EXISTS change_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version_id INTEGER NOT NULL,
  module TEXT NOT NULL,
  record_key TEXT NOT NULL,
  change_type TEXT NOT NULL,
  previous_data_json TEXT,
  new_data_json TEXT,
  field_diffs_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (version_id) REFERENCES data_versions(id)
);
CREATE INDEX IF NOT EXISTS idx_changelog_version ON change_log(version_id);

-- Audit log: full system audit trail
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);

-- AI Analyst query log (for transparency / admin review)
CREATE TABLE IF NOT EXISTS ai_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  question TEXT NOT NULL,
  answer TEXT,
  sources_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Manual record edits (Super Admin direct DB edits) — captured for the audit trail
CREATE TABLE IF NOT EXISTS record_edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER NOT NULL,
  version_id INTEGER NOT NULL,
  module TEXT NOT NULL,
  record_key TEXT NOT NULL,
  edited_by INTEGER,
  previous_data_json TEXT,
  new_data_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (record_id) REFERENCES records(id),
  FOREIGN KEY (edited_by) REFERENCES users(id)
);
