CREATE TABLE IF NOT EXISTS evidence_management_items (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  evidence_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL,
  is_complete INTEGER NOT NULL,
  superseded_by_evidence_item_id TEXT,
  reporting_period_id TEXT,
  review_cycle_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (institution_id) REFERENCES organization_registry_institutions(id),
  FOREIGN KEY (superseded_by_evidence_item_id) REFERENCES evidence_management_items(id),
  FOREIGN KEY (reporting_period_id) REFERENCES accreditation_frameworks_reporting_periods(id),
  FOREIGN KEY (review_cycle_id) REFERENCES accreditation_frameworks_cycles(id)
);

CREATE TABLE IF NOT EXISTS evidence_management_artifacts (
  id TEXT PRIMARY KEY,
  evidence_item_id TEXT NOT NULL,
  artifact_name TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_extension TEXT,
  byte_size INTEGER,
  storage_bucket TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  artifact_status TEXT NOT NULL,
  source_checksum TEXT,
  uploaded_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (evidence_item_id) REFERENCES evidence_management_items(id)
);

CREATE INDEX IF NOT EXISTS idx_evid_items_institution ON evidence_management_items(institution_id);
CREATE INDEX IF NOT EXISTS idx_evid_items_status ON evidence_management_items(status);
CREATE INDEX IF NOT EXISTS idx_evid_items_type ON evidence_management_items(evidence_type);
CREATE INDEX IF NOT EXISTS idx_evid_items_source ON evidence_management_items(source_type);
CREATE INDEX IF NOT EXISTS idx_evid_artifacts_item ON evidence_management_artifacts(evidence_item_id);
