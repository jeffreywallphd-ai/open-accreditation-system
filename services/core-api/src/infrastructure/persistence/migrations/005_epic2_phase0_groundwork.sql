CREATE TABLE IF NOT EXISTS accreditation_frameworks_reporting_periods (
  id TEXT PRIMARY KEY,
  accreditation_cycle_id TEXT NOT NULL,
  name TEXT NOT NULL,
  period_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL,
  scope_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (accreditation_cycle_id) REFERENCES accreditation_frameworks_cycles(id),
  FOREIGN KEY (scope_id) REFERENCES accreditation_frameworks_scopes(id),
  UNIQUE (accreditation_cycle_id, name, start_date, end_date, scope_id)
);

CREATE TABLE IF NOT EXISTS curriculum_mapping_courses (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  program_id TEXT,
  owning_organization_unit_id TEXT,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (institution_id) REFERENCES organization_registry_institutions(id),
  FOREIGN KEY (program_id) REFERENCES curriculum_mapping_programs(id),
  FOREIGN KEY (owning_organization_unit_id) REFERENCES organization_registry_organization_units(id),
  UNIQUE (institution_id, code)
);

CREATE TABLE IF NOT EXISTS curriculum_mapping_learning_outcomes (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  statement TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  program_id TEXT,
  course_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (institution_id) REFERENCES organization_registry_institutions(id),
  FOREIGN KEY (program_id) REFERENCES curriculum_mapping_programs(id),
  FOREIGN KEY (course_id) REFERENCES curriculum_mapping_courses(id),
  UNIQUE (institution_id, code)
);

CREATE TABLE IF NOT EXISTS curriculum_mapping_course_outcome_maps (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  learning_outcome_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (course_id) REFERENCES curriculum_mapping_courses(id),
  FOREIGN KEY (learning_outcome_id) REFERENCES curriculum_mapping_learning_outcomes(id),
  UNIQUE (course_id, learning_outcome_id)
);

CREATE TABLE IF NOT EXISTS curriculum_mapping_assessments (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  program_id TEXT,
  course_id TEXT,
  reporting_period_id TEXT,
  review_cycle_id TEXT,
  name TEXT NOT NULL,
  assessment_type TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (institution_id) REFERENCES organization_registry_institutions(id),
  FOREIGN KEY (program_id) REFERENCES curriculum_mapping_programs(id),
  FOREIGN KEY (course_id) REFERENCES curriculum_mapping_courses(id),
  FOREIGN KEY (reporting_period_id) REFERENCES accreditation_frameworks_reporting_periods(id),
  FOREIGN KEY (review_cycle_id) REFERENCES accreditation_frameworks_cycles(id)
);

CREATE TABLE IF NOT EXISTS curriculum_mapping_assessment_outcome_links (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  learning_outcome_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (assessment_id) REFERENCES curriculum_mapping_assessments(id),
  FOREIGN KEY (learning_outcome_id) REFERENCES curriculum_mapping_learning_outcomes(id),
  UNIQUE (assessment_id, learning_outcome_id)
);

CREATE TABLE IF NOT EXISTS curriculum_mapping_assessment_artifacts (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  assessment_id TEXT,
  learning_outcome_id TEXT,
  reporting_period_id TEXT,
  review_cycle_id TEXT,
  scope_type TEXT NOT NULL,
  scope_entity_id TEXT,
  name TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (institution_id) REFERENCES organization_registry_institutions(id),
  FOREIGN KEY (assessment_id) REFERENCES curriculum_mapping_assessments(id),
  FOREIGN KEY (learning_outcome_id) REFERENCES curriculum_mapping_learning_outcomes(id),
  FOREIGN KEY (reporting_period_id) REFERENCES accreditation_frameworks_reporting_periods(id),
  FOREIGN KEY (review_cycle_id) REFERENCES accreditation_frameworks_cycles(id)
);

CREATE INDEX IF NOT EXISTS idx_afr_reporting_periods_cycle ON accreditation_frameworks_reporting_periods(accreditation_cycle_id);
CREATE INDEX IF NOT EXISTS idx_afr_reporting_periods_scope ON accreditation_frameworks_reporting_periods(scope_id);
CREATE INDEX IF NOT EXISTS idx_curr_courses_institution ON curriculum_mapping_courses(institution_id);
CREATE INDEX IF NOT EXISTS idx_curr_courses_program ON curriculum_mapping_courses(program_id);
CREATE INDEX IF NOT EXISTS idx_curr_outcomes_institution ON curriculum_mapping_learning_outcomes(institution_id);
CREATE INDEX IF NOT EXISTS idx_curr_outcomes_program ON curriculum_mapping_learning_outcomes(program_id);
CREATE INDEX IF NOT EXISTS idx_curr_outcomes_course ON curriculum_mapping_learning_outcomes(course_id);
CREATE INDEX IF NOT EXISTS idx_curr_assessments_institution ON curriculum_mapping_assessments(institution_id);
CREATE INDEX IF NOT EXISTS idx_curr_assessments_cycle ON curriculum_mapping_assessments(review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_curr_assessment_artifacts_assessment ON curriculum_mapping_assessment_artifacts(assessment_id);
CREATE INDEX IF NOT EXISTS idx_curr_assessment_artifacts_outcome ON curriculum_mapping_assessment_artifacts(learning_outcome_id);
