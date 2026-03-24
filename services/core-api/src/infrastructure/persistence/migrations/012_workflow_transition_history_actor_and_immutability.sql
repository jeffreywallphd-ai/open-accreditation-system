ALTER TABLE workflow_review_workflow_transitions
ADD COLUMN actor_id TEXT;

CREATE TRIGGER IF NOT EXISTS trg_workflow_transition_history_no_delete
BEFORE DELETE ON workflow_review_workflow_transitions
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'workflow transition history is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_workflow_transition_history_no_update
BEFORE UPDATE OF
  workflow_id,
  transition_sequence,
  from_state,
  to_state,
  actor_role,
  actor_id,
  reason,
  evidence_summary_json,
  transitioned_at,
  created_at
ON workflow_review_workflow_transitions
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'workflow transition history is append-only');
END;
