CREATE TABLE IF NOT EXISTS accreditation_frameworks_scope_programs (
  id TEXT PRIMARY KEY,
  accreditation_scope_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (accreditation_scope_id) REFERENCES accreditation_frameworks_scopes(id),
  FOREIGN KEY (program_id) REFERENCES curriculum_mapping_programs(id),
  UNIQUE (accreditation_scope_id, program_id)
);

CREATE TABLE IF NOT EXISTS accreditation_frameworks_scope_organization_units (
  id TEXT PRIMARY KEY,
  accreditation_scope_id TEXT NOT NULL,
  organization_unit_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (accreditation_scope_id) REFERENCES accreditation_frameworks_scopes(id),
  FOREIGN KEY (organization_unit_id) REFERENCES organization_registry_organization_units(id),
  UNIQUE (accreditation_scope_id, organization_unit_id)
);

INSERT OR IGNORE INTO accreditation_frameworks_scope_programs (
  id,
  accreditation_scope_id,
  program_id,
  created_at,
  updated_at
)
SELECT
  'scope_prog_' || s.id || '_' || REPLACE(CAST(p.value AS TEXT), '-', '_') AS id,
  s.id,
  CAST(p.value AS TEXT),
  s.created_at,
  s.updated_at
FROM accreditation_frameworks_scopes s,
  json_each(s.program_ids_json) p
WHERE TRIM(CAST(p.value AS TEXT)) <> '';

INSERT OR IGNORE INTO accreditation_frameworks_scope_organization_units (
  id,
  accreditation_scope_id,
  organization_unit_id,
  created_at,
  updated_at
)
SELECT
  'scope_org_' || s.id || '_' || REPLACE(CAST(o.value AS TEXT), '-', '_') AS id,
  s.id,
  CAST(o.value AS TEXT),
  s.created_at,
  s.updated_at
FROM accreditation_frameworks_scopes s,
  json_each(s.organization_unit_ids_json) o
WHERE TRIM(CAST(o.value AS TEXT)) <> '';

CREATE INDEX IF NOT EXISTS idx_afr_scope_programs_scope ON accreditation_frameworks_scope_programs(accreditation_scope_id);
CREATE INDEX IF NOT EXISTS idx_afr_scope_programs_program ON accreditation_frameworks_scope_programs(program_id);
CREATE INDEX IF NOT EXISTS idx_afr_scope_org_units_scope ON accreditation_frameworks_scope_organization_units(accreditation_scope_id);
CREATE INDEX IF NOT EXISTS idx_afr_scope_org_units_org ON accreditation_frameworks_scope_organization_units(organization_unit_id);
