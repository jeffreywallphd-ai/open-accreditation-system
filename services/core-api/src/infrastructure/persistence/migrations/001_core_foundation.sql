CREATE TABLE IF NOT EXISTS organization_registry_institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  timezone TEXT NOT NULL,
  status TEXT NOT NULL,
  effective_start_date TEXT,
  effective_end_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_registry_people (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  preferred_name TEXT,
  legal_name TEXT,
  display_name TEXT NOT NULL,
  primary_email TEXT,
  secondary_email TEXT,
  person_status TEXT NOT NULL,
  employee_like_indicator INTEGER NOT NULL DEFAULT 0,
  external_reference_summary TEXT,
  match_confidence_notes TEXT,
  effective_start_date TEXT,
  effective_end_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (institution_id) REFERENCES organization_registry_institutions(id)
);

CREATE TABLE IF NOT EXISTS organization_registry_person_references (
  person_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  FOREIGN KEY (person_id) REFERENCES organization_registry_people(id)
);

CREATE TABLE IF NOT EXISTS organization_registry_organization_units (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  unit_type TEXT NOT NULL,
  parent_unit_id TEXT,
  status TEXT NOT NULL,
  effective_start_date TEXT,
  effective_end_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (institution_id) REFERENCES organization_registry_institutions(id),
  FOREIGN KEY (parent_unit_id) REFERENCES organization_registry_organization_units(id)
);

CREATE TABLE IF NOT EXISTS organization_registry_committees (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  sponsoring_unit_id TEXT,
  charter_summary TEXT,
  status TEXT NOT NULL,
  effective_start_date TEXT,
  effective_end_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (institution_id) REFERENCES organization_registry_institutions(id),
  FOREIGN KEY (sponsoring_unit_id) REFERENCES organization_registry_organization_units(id)
);

CREATE TABLE IF NOT EXISTS identity_access_users (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL UNIQUE,
  institution_id TEXT NOT NULL,
  external_subject_id TEXT,
  email TEXT,
  status TEXT NOT NULL,
  last_login_at TEXT,
  access_attributes_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (person_id) REFERENCES organization_registry_people(id),
  FOREIGN KEY (institution_id) REFERENCES organization_registry_institutions(id)
);

CREATE TABLE IF NOT EXISTS identity_access_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  scope_type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_access_permissions (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_access_role_permission_grants (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  state TEXT NOT NULL,
  reason TEXT,
  effective_start_date TEXT,
  effective_end_date TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (role_id) REFERENCES identity_access_roles(id),
  FOREIGN KEY (permission_id) REFERENCES identity_access_permissions(id)
);

CREATE TABLE IF NOT EXISTS identity_access_user_role_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  institution_id TEXT,
  organization_unit_id TEXT,
  committee_id TEXT,
  accreditation_cycle_id TEXT,
  review_team_id TEXT,
  state TEXT NOT NULL,
  reason TEXT,
  superseded_by_assignment_id TEXT,
  effective_start_date TEXT,
  effective_end_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES identity_access_users(id),
  FOREIGN KEY (role_id) REFERENCES identity_access_roles(id),
  FOREIGN KEY (institution_id) REFERENCES organization_registry_institutions(id),
  FOREIGN KEY (organization_unit_id) REFERENCES organization_registry_organization_units(id),
  FOREIGN KEY (committee_id) REFERENCES organization_registry_committees(id),
  FOREIGN KEY (superseded_by_assignment_id) REFERENCES identity_access_user_role_assignments(id)
);

CREATE TABLE IF NOT EXISTS identity_access_service_principals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  principal_type TEXT NOT NULL,
  client_id TEXT NOT NULL,
  credential_metadata_json TEXT NOT NULL,
  status TEXT NOT NULL,
  human_person_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_org_people_institution ON organization_registry_people(institution_id);
CREATE INDEX IF NOT EXISTS idx_org_units_institution ON organization_registry_organization_units(institution_id);
CREATE INDEX IF NOT EXISTS idx_org_units_parent ON organization_registry_organization_units(parent_unit_id);
CREATE INDEX IF NOT EXISTS idx_org_committees_institution ON organization_registry_committees(institution_id);

CREATE INDEX IF NOT EXISTS idx_iam_users_person ON identity_access_users(person_id);
CREATE INDEX IF NOT EXISTS idx_iam_roles_scope_type ON identity_access_roles(scope_type);
CREATE INDEX IF NOT EXISTS idx_iam_role_permission_grants_role ON identity_access_role_permission_grants(role_id);
CREATE INDEX IF NOT EXISTS idx_iam_role_permission_grants_permission ON identity_access_role_permission_grants(permission_id);
CREATE INDEX IF NOT EXISTS idx_iam_user_role_assignments_user ON identity_access_user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_iam_user_role_assignments_role ON identity_access_user_role_assignments(role_id);
