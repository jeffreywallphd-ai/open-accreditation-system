import { ValidationError } from '../../../shared/kernel/errors.js';
import {
  parseReviewWorkflowState,
  parseWorkflowActorRole,
  reviewWorkflowState,
  workflowActorRole,
} from '../value-objects/workflow-statuses.js';

const WORKFLOW_STATE_TRANSITIONS = Object.freeze({
  [reviewWorkflowState.DRAFT]: new Set([reviewWorkflowState.IN_REVIEW]),
  [reviewWorkflowState.IN_REVIEW]: new Set([reviewWorkflowState.REVISION_REQUIRED, reviewWorkflowState.APPROVED]),
  [reviewWorkflowState.REVISION_REQUIRED]: new Set([reviewWorkflowState.DRAFT]),
  [reviewWorkflowState.APPROVED]: new Set([reviewWorkflowState.SUBMITTED]),
  [reviewWorkflowState.SUBMITTED]: new Set(),
});

const ROLE_TRANSITION_POLICY = Object.freeze({
  [`${reviewWorkflowState.DRAFT}->${reviewWorkflowState.IN_REVIEW}`]: new Set([
    workflowActorRole.FACULTY,
    workflowActorRole.ADMIN,
  ]),
  [`${reviewWorkflowState.IN_REVIEW}->${reviewWorkflowState.REVISION_REQUIRED}`]: new Set([
    workflowActorRole.REVIEWER,
    workflowActorRole.ADMIN,
  ]),
  [`${reviewWorkflowState.REVISION_REQUIRED}->${reviewWorkflowState.DRAFT}`]: new Set([
    workflowActorRole.FACULTY,
    workflowActorRole.ADMIN,
  ]),
  [`${reviewWorkflowState.IN_REVIEW}->${reviewWorkflowState.APPROVED}`]: new Set([
    workflowActorRole.REVIEWER,
    workflowActorRole.ADMIN,
  ]),
  [`${reviewWorkflowState.APPROVED}->${reviewWorkflowState.SUBMITTED}`]: new Set([workflowActorRole.ADMIN]),
});

export function assertAllowedWorkflowStateTransition(currentState, nextState) {
  parseReviewWorkflowState(currentState, 'ReviewWorkflow.currentState');
  parseReviewWorkflowState(nextState, 'ReviewWorkflow.nextState');
  const allowed = WORKFLOW_STATE_TRANSITIONS[currentState] ?? new Set();
  if (!allowed.has(nextState)) {
    throw new ValidationError(
      `ReviewWorkflow cannot transition from state=${currentState} to state=${nextState}`,
    );
  }
}

export function assertWorkflowRoleCanTransition(currentState, nextState, actorRole) {
  parseReviewWorkflowState(currentState, 'ReviewWorkflow.currentState');
  parseReviewWorkflowState(nextState, 'ReviewWorkflow.nextState');
  parseWorkflowActorRole(actorRole, 'ReviewWorkflow.actorRole');

  const key = `${currentState}->${nextState}`;
  const allowedRoles = ROLE_TRANSITION_POLICY[key] ?? new Set();
  if (!allowedRoles.has(actorRole)) {
    throw new ValidationError(
      `Role ${actorRole} cannot transition ReviewWorkflow from ${currentState} to ${nextState}`,
    );
  }
}

