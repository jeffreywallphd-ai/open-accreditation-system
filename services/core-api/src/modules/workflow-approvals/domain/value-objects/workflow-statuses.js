import { assertOneOf } from '../../../shared/kernel/assertions.js';

export const reviewCycleStatus = Object.freeze({
  NOT_STARTED: 'not-started',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
});

export const reviewWorkflowState = Object.freeze({
  DRAFT: 'draft',
  IN_REVIEW: 'in-review',
  REVISION_REQUIRED: 'revision-required',
  APPROVED: 'approved',
  SUBMITTED: 'submitted',
});

export const workflowActorRole = Object.freeze({
  FACULTY: 'faculty',
  REVIEWER: 'reviewer',
  ADMIN: 'admin',
});

export function parseReviewCycleStatus(value, field = 'ReviewCycle.status') {
  assertOneOf(value, field, Object.values(reviewCycleStatus));
  return value;
}

export function parseReviewWorkflowState(value, field = 'ReviewWorkflow.state') {
  assertOneOf(value, field, Object.values(reviewWorkflowState));
  return value;
}

export function parseWorkflowActorRole(value, field = 'Workflow.actorRole') {
  assertOneOf(value, field, Object.values(workflowActorRole));
  return value;
}

