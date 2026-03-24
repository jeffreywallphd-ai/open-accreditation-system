ALTER TABLE evidence_management_items
ADD COLUMN evidence_lineage_id TEXT;

ALTER TABLE evidence_management_items
ADD COLUMN version_number INTEGER;

ALTER TABLE evidence_management_items
ADD COLUMN supersedes_evidence_item_id TEXT;

UPDATE evidence_management_items
SET evidence_lineage_id = id
WHERE evidence_lineage_id IS NULL;

UPDATE evidence_management_items
SET version_number = 1
WHERE version_number IS NULL;

CREATE TABLE IF NOT EXISTS evidence_management_references (
  id TEXT PRIMARY KEY,
  evidence_item_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  rationale TEXT,
  anchor_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (evidence_item_id) REFERENCES evidence_management_items(id)
);

CREATE INDEX IF NOT EXISTS idx_evid_items_lineage ON evidence_management_items(evidence_lineage_id);
CREATE INDEX IF NOT EXISTS idx_evid_items_version ON evidence_management_items(version_number);
CREATE INDEX IF NOT EXISTS idx_evid_items_supersedes ON evidence_management_items(supersedes_evidence_item_id);
CREATE INDEX IF NOT EXISTS idx_evid_references_item ON evidence_management_references(evidence_item_id);
CREATE INDEX IF NOT EXISTS idx_evid_references_target ON evidence_management_references(target_type, target_entity_id);
