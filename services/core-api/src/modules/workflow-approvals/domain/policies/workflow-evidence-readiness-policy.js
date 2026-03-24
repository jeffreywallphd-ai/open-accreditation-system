import { parseReviewWorkflowState, reviewWorkflowState } from '../value-objects/workflow-statuses.js';

export function buildEvidenceReadinessPolicyForTransition(currentState, nextState, workflow) {
  parseReviewWorkflowState(currentState, 'ReviewWorkflow.currentState');
  parseReviewWorkflowState(nextState, 'ReviewWorkflow.nextState');

  const requiresApprovalEvidence =
    nextState === reviewWorkflowState.APPROVED || nextState === reviewWorkflowState.SUBMITTED;
  const hasReferencedEvidence = (workflow.evidenceItemIds ?? []).length > 0;
  const requiresCollectionEvidence =
    Boolean(workflow.evidenceCollectionId) && requiresApprovalEvidence && !hasReferencedEvidence;

  return {
    requiredReadinessLevel: requiresApprovalEvidence && hasReferencedEvidence ? 'usable' : 'present',
    requireCurrentReferencedEvidence: requiresApprovalEvidence && hasReferencedEvidence,
    minimumReferencedUsableEvidenceCount: requiresApprovalEvidence && hasReferencedEvidence
      ? workflow.evidenceItemIds.length
      : 0,
    requireCollectionScopedUsableEvidence: requiresCollectionEvidence,
    minimumCollectionUsableEvidenceCount: requiresCollectionEvidence ? 1 : 0,
  };
}
