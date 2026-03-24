CREATE TABLE IF NOT EXISTS workflow_review_cycles (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL,
  program_ids_json TEXT NOT NULL DEFAULT '[]',
  organization_unit_ids_json TEXT NOT NULL DEFAULT '[]',
  evidence_set_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (institution_id) REFERENCES organization_registry_institutions(id)
);

CREATE TABLE IF NOT EXISTS workflow_review_workflows (
  id TEXT PRIMARY KEY,
  review_cycle_id TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  report_section_id TEXT,
  evidence_collection_id TEXT,
  evidence_item_ids_json TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (review_cycle_id) REFERENCES workflow_review_cycles(id),
  FOREIGN KEY (institution_id) REFERENCES organization_registry_institutions(id)
);

CREATE TABLE IF NOT EXISTS workflow_review_workflow_transitions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  reason TEXT,
  evidence_summary_json TEXT,
  transitioned_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workflow_id) REFERENCES workflow_review_workflows(id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_review_cycles_institution ON workflow_review_cycles(institution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_review_cycles_scope ON workflow_review_cycles(scope_key);
CREATE INDEX IF NOT EXISTS idx_workflow_review_cycles_status ON workflow_review_cycles(status);
CREATE UNIQUE INDEX IF NOT EXISTS ux_workflow_review_cycles_active_scope
  ON workflow_review_cycles(institution_id, scope_key)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_workflow_review_workflows_cycle ON workflow_review_workflows(review_cycle_id);
CREATE INDEX IF NOT EXISTS idx_workflow_review_workflows_state ON workflow_review_workflows(state);
CREATE INDEX IF NOT EXISTS idx_workflow_review_workflows_target ON workflow_review_workflows(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_workflow_review_transitions_workflow ON workflow_review_workflow_transitions(workflow_id);

