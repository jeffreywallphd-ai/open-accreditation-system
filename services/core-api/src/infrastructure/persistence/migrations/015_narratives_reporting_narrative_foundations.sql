CREATE TABLE IF NOT EXISTS narratives_narratives (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  review_cycle_id TEXT NOT NULL,
  submission_package_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  submitted_for_review_at TEXT,
  finalized_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (institution_id) REFERENCES organization_registry_institutions(id),
  FOREIGN KEY (review_cycle_id) REFERENCES workflow_review_cycles(id),
  FOREIGN KEY (submission_package_id) REFERENCES narratives_submission_packages(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_narratives_narratives_submission_package
  ON narratives_narratives(submission_package_id);
CREATE INDEX IF NOT EXISTS idx_narratives_narratives_institution
  ON narratives_narratives(institution_id);
CREATE INDEX IF NOT EXISTS idx_narratives_narratives_review_cycle
  ON narratives_narratives(review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_narratives_narratives_status
  ON narratives_narratives(status);

CREATE TABLE IF NOT EXISTS narratives_narrative_sections (
  id TEXT PRIMARY KEY,
  narrative_id TEXT NOT NULL,
  section_sequence INTEGER NOT NULL,
  section_type TEXT NOT NULL,
  section_key TEXT NOT NULL,
  parent_section_key TEXT,
  title TEXT NOT NULL,
  content TEXT,
  owner_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (narrative_id) REFERENCES narratives_narratives(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_narratives_narrative_sections_sequence
  ON narratives_narrative_sections(narrative_id, section_sequence);
CREATE UNIQUE INDEX IF NOT EXISTS ux_narratives_narrative_sections_key
  ON narratives_narrative_sections(narrative_id, section_key);
CREATE INDEX IF NOT EXISTS idx_narratives_narrative_sections_parent
  ON narratives_narrative_sections(narrative_id, parent_section_key);

CREATE TABLE IF NOT EXISTS narratives_narrative_section_evidence_links (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  evidence_item_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  rationale TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (section_id) REFERENCES narratives_narrative_sections(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_narratives_narrative_section_evidence_links_uniqueness
  ON narratives_narrative_section_evidence_links(section_id, evidence_item_id, relationship_type);

CREATE TABLE IF NOT EXISTS narratives_narrative_section_package_links (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  submission_package_item_id TEXT NOT NULL,
  link_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (section_id) REFERENCES narratives_narrative_sections(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_package_item_id) REFERENCES narratives_submission_package_items(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_narratives_narrative_section_package_links_item
  ON narratives_narrative_section_package_links(section_id, submission_package_item_id);
