CREATE UNIQUE INDEX IF NOT EXISTS ux_workflow_review_workflows_cycle_target
  ON workflow_review_workflows(review_cycle_id, target_type, target_id);
