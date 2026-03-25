ALTER TABLE narratives_submission_package_items
  ADD COLUMN assembly_role TEXT NOT NULL DEFAULT 'workflow-target';

ALTER TABLE narratives_submission_package_items
  ADD COLUMN section_key TEXT;

ALTER TABLE narratives_submission_package_items
  ADD COLUMN section_title TEXT;

ALTER TABLE narratives_submission_package_items
  ADD COLUMN parent_section_key TEXT;

ALTER TABLE narratives_submission_package_items
  ADD COLUMN section_type TEXT;

ALTER TABLE narratives_submission_snapshot_items
  ADD COLUMN assembly_role TEXT NOT NULL DEFAULT 'workflow-target';

ALTER TABLE narratives_submission_snapshot_items
  ADD COLUMN section_key TEXT;

ALTER TABLE narratives_submission_snapshot_items
  ADD COLUMN section_title TEXT;

ALTER TABLE narratives_submission_snapshot_items
  ADD COLUMN parent_section_key TEXT;

ALTER TABLE narratives_submission_snapshot_items
  ADD COLUMN section_type TEXT;

UPDATE narratives_submission_package_items
SET assembly_role = CASE item_type
  WHEN 'report-section' THEN 'governed-section'
  WHEN 'narrative-section' THEN 'governed-section'
  WHEN 'evidence-item' THEN 'evidence-inclusion'
  ELSE 'workflow-target'
END;

UPDATE narratives_submission_snapshot_items
SET assembly_role = CASE item_type
  WHEN 'report-section' THEN 'governed-section'
  WHEN 'narrative-section' THEN 'governed-section'
  WHEN 'evidence-item' THEN 'evidence-inclusion'
  ELSE 'workflow-target'
END;

CREATE INDEX IF NOT EXISTS idx_narratives_submission_package_items_assembly_role
  ON narratives_submission_package_items(assembly_role);

CREATE INDEX IF NOT EXISTS idx_narratives_submission_package_items_section_key
  ON narratives_submission_package_items(package_id, section_key);

CREATE INDEX IF NOT EXISTS idx_narratives_submission_snapshot_items_assembly_role
  ON narratives_submission_snapshot_items(assembly_role);

CREATE INDEX IF NOT EXISTS idx_narratives_submission_snapshot_items_section_key
  ON narratives_submission_snapshot_items(snapshot_id, section_key);
