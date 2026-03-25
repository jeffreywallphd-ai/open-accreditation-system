ALTER TABLE narratives_narrative_section_package_links
  ADD COLUMN narrative_id TEXT;

UPDATE narratives_narrative_section_package_links
SET narrative_id = (
  SELECT s.narrative_id
  FROM narratives_narrative_sections s
  WHERE s.id = narratives_narrative_section_package_links.section_id
)
WHERE narrative_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_narratives_narrative_section_package_links_narrative
  ON narratives_narrative_section_package_links(narrative_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_narratives_narrative_section_package_links_narrative_item
  ON narratives_narrative_section_package_links(narrative_id, submission_package_item_id);

CREATE TRIGGER IF NOT EXISTS tr_narratives_section_package_links_narrative_match_insert
BEFORE INSERT ON narratives_narrative_section_package_links
FOR EACH ROW
WHEN NEW.narrative_id IS NULL
  OR NEW.narrative_id <> (
    SELECT s.narrative_id
    FROM narratives_narrative_sections s
    WHERE s.id = NEW.section_id
  )
BEGIN
  SELECT RAISE(ABORT, 'Narrative section package link narrative_id must match owning section narrative_id');
END;

CREATE TRIGGER IF NOT EXISTS tr_narratives_section_package_links_narrative_match_update
BEFORE UPDATE ON narratives_narrative_section_package_links
FOR EACH ROW
WHEN NEW.narrative_id IS NULL
  OR NEW.narrative_id <> (
    SELECT s.narrative_id
    FROM narratives_narrative_sections s
    WHERE s.id = NEW.section_id
  )
BEGIN
  SELECT RAISE(ABORT, 'Narrative section package link narrative_id must match owning section narrative_id');
END;
