ALTER TABLE workflow_review_workflow_transitions
ADD COLUMN transition_sequence INTEGER;

UPDATE workflow_review_workflow_transitions
SET transition_sequence = (
  SELECT COUNT(*)
  FROM workflow_review_workflow_transitions ranked
  WHERE ranked.workflow_id = workflow_review_workflow_transitions.workflow_id
    AND (
      ranked.created_at < workflow_review_workflow_transitions.created_at
      OR (
        ranked.created_at = workflow_review_workflow_transitions.created_at
        AND ranked.id <= workflow_review_workflow_transitions.id
      )
    )
)
WHERE transition_sequence IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_workflow_review_transitions_sequence
  ON workflow_review_workflow_transitions(workflow_id, transition_sequence);

CREATE TRIGGER IF NOT EXISTS trg_workflow_transition_sequence_insert
BEFORE INSERT ON workflow_review_workflow_transitions
FOR EACH ROW
WHEN NEW.transition_sequence IS NULL OR NEW.transition_sequence < 1
BEGIN
  SELECT RAISE(ABORT, 'workflow transition_sequence must be >= 1');
END;

CREATE TRIGGER IF NOT EXISTS trg_workflow_transition_sequence_update
BEFORE UPDATE OF transition_sequence ON workflow_review_workflow_transitions
FOR EACH ROW
WHEN NEW.transition_sequence IS NULL OR NEW.transition_sequence < 1
BEGIN
  SELECT RAISE(ABORT, 'workflow transition_sequence must be >= 1');
END;
