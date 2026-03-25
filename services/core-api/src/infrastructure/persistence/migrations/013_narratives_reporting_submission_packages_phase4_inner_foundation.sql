CREATE TABLE IF NOT EXISTS narratives_submission_packages (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  review_cycle_id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  name TEXT,
  status TEXT NOT NULL,
  finalized_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (institution_id) REFERENCES organization_registry_institutions(id),
  FOREIGN KEY (review_cycle_id) REFERENCES workflow_review_cycles(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_narratives_submission_packages_cycle_scope
  ON narratives_submission_packages(review_cycle_id, scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_narratives_submission_packages_institution
  ON narratives_submission_packages(institution_id);
CREATE INDEX IF NOT EXISTS idx_narratives_submission_packages_status
  ON narratives_submission_packages(status);

CREATE TABLE IF NOT EXISTS narratives_submission_package_items (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  item_sequence INTEGER NOT NULL,
  item_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  workflow_id TEXT,
  evidence_item_ids_json TEXT NOT NULL DEFAULT '[]',
  label TEXT,
  rationale TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (package_id) REFERENCES narratives_submission_packages(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_narratives_submission_package_items_sequence
  ON narratives_submission_package_items(package_id, item_sequence);
CREATE INDEX IF NOT EXISTS idx_narratives_submission_package_items_target
  ON narratives_submission_package_items(target_type, target_id);

CREATE TABLE IF NOT EXISTS narratives_submission_package_snapshots (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  milestone_label TEXT,
  actor_id TEXT,
  notes TEXT,
  is_finalized INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (package_id) REFERENCES narratives_submission_packages(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_narratives_submission_package_snapshots_version
  ON narratives_submission_package_snapshots(package_id, version_number);

CREATE TABLE IF NOT EXISTS narratives_submission_snapshot_items (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  package_item_id TEXT NOT NULL,
  item_sequence INTEGER NOT NULL,
  item_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  workflow_id TEXT,
  evidence_item_ids_json TEXT NOT NULL DEFAULT '[]',
  label TEXT,
  rationale TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (snapshot_id) REFERENCES narratives_submission_package_snapshots(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_narratives_submission_snapshot_items_sequence
  ON narratives_submission_snapshot_items(snapshot_id, item_sequence);

CREATE TRIGGER IF NOT EXISTS trg_narratives_submission_snapshot_no_delete
BEFORE DELETE ON narratives_submission_package_snapshots
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'submission package snapshots are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_narratives_submission_snapshot_no_update
BEFORE UPDATE OF
  package_id,
  version_number,
  milestone_label,
  actor_id,
  notes,
  is_finalized,
  created_at
ON narratives_submission_package_snapshots
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'submission package snapshots are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_narratives_submission_snapshot_item_no_delete
BEFORE DELETE ON narratives_submission_snapshot_items
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'submission package snapshot items are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_narratives_submission_snapshot_item_no_update
BEFORE UPDATE OF
  snapshot_id,
  package_item_id,
  item_sequence,
  item_type,
  target_type,
  target_id,
  workflow_id,
  evidence_item_ids_json,
  label,
  rationale,
  metadata_json,
  created_at
ON narratives_submission_snapshot_items
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'submission package snapshot items are append-only');
END;
