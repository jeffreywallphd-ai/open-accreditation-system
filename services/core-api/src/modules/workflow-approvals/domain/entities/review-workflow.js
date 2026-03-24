import { assertRequired, assertString } from '../../../shared/kernel/assertions.js';
import { ValidationError } from '../../../shared/kernel/errors.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
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

function normalizeIdList(values = []) {
  const normalized = [...new Set(values.filter(Boolean).map((value) => `${value}`.trim()).filter(Boolean))];
  normalized.sort((left, right) => left.localeCompare(right));
  return normalized;
}

export class WorkflowTransitionRecord {
  constructor(props) {
    assertRequired(props.id, 'WorkflowTransitionRecord.id');
    assertRequired(props.workflowId, 'WorkflowTransitionRecord.workflowId');
    parseReviewWorkflowState(props.fromState, 'WorkflowTransitionRecord.fromState');
    parseReviewWorkflowState(props.toState, 'WorkflowTransitionRecord.toState');
    parseWorkflowActorRole(props.actorRole, 'WorkflowTransitionRecord.actorRole');
    assertRequired(props.transitionedAt, 'WorkflowTransitionRecord.transitionedAt');

    this.id = props.id;
    this.workflowId = props.workflowId;
    this.fromState = props.fromState;
    this.toState = props.toState;
    this.actorRole = props.actorRole;
    this.reason = props.reason ?? null;
    this.evidenceSummary = props.evidenceSummary ?? null;
    this.transitionedAt = props.transitionedAt;
    this.createdAt = props.createdAt;
  }

  static create(input) {
    const now = nowIso();
    return new WorkflowTransitionRecord({
      id: input.id ?? createId('wf_hist'),
      workflowId: input.workflowId,
      fromState: input.fromState,
      toState: input.toState,
      actorRole: input.actorRole,
      reason: input.reason,
      evidenceSummary: input.evidenceSummary ?? null,
      transitionedAt: now,
      createdAt: now,
    });
  }
}

export class ReviewWorkflow {
  constructor(props) {
    assertRequired(props.id, 'ReviewWorkflow.id');
    assertRequired(props.reviewCycleId, 'ReviewWorkflow.reviewCycleId');
    assertRequired(props.institutionId, 'ReviewWorkflow.institutionId');
    assertString(props.targetType, 'ReviewWorkflow.targetType');
    assertRequired(props.targetId, 'ReviewWorkflow.targetId');
    parseReviewWorkflowState(props.state);

    this.id = props.id;
    this.reviewCycleId = props.reviewCycleId;
    this.institutionId = props.institutionId;
    this.targetType = props.targetType;
    this.targetId = props.targetId;
    this.reportSectionId = props.reportSectionId ?? null;
    this.evidenceCollectionId = props.evidenceCollectionId ?? null;
    this.evidenceItemIds = normalizeIdList(props.evidenceItemIds ?? []);
    this.state = props.state;
    this.transitionHistory = (props.transitionHistory ?? []).map((item) =>
      item instanceof WorkflowTransitionRecord ? item : new WorkflowTransitionRecord(item),
    );
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;

    this.#assertIntegrity();
  }

  static create(input) {
    const now = nowIso();
    return new ReviewWorkflow({
      id: input.id ?? createId('rev_wf'),
      reviewCycleId: input.reviewCycleId,
      institutionId: input.institutionId,
      targetType: input.targetType,
      targetId: input.targetId,
      reportSectionId: input.reportSectionId,
      evidenceCollectionId: input.evidenceCollectionId,
      evidenceItemIds: input.evidenceItemIds ?? [],
      state: input.state ?? reviewWorkflowState.DRAFT,
      transitionHistory: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(input) {
    return new ReviewWorkflow(input);
  }

  transitionTo(nextState, actorRole, options = {}) {
    parseReviewWorkflowState(nextState, 'ReviewWorkflow.nextState');
    parseWorkflowActorRole(actorRole, 'ReviewWorkflow.actorRole');
    this.#assertStateTransition(nextState);
    this.#assertRoleTransition(actorRole, nextState);
    this.#assertEvidenceForTransition(nextState, options.evidenceSummary);

    const previousState = this.state;
    this.state = nextState;
    const historyEntry = WorkflowTransitionRecord.create({
      workflowId: this.id,
      fromState: previousState,
      toState: nextState,
      actorRole,
      reason: options.reason,
      evidenceSummary: options.evidenceSummary ?? null,
    });
    this.transitionHistory.push(historyEntry);
    this.updatedAt = nowIso();
    this.#assertIntegrity();
    return historyEntry;
  }

  #assertIntegrity() {
    const transitionIds = new Set();
    for (const record of this.transitionHistory) {
      if (record.workflowId !== this.id) {
        throw new ValidationError('WorkflowTransitionRecord.workflowId must match ReviewWorkflow.id');
      }
      if (transitionIds.has(record.id)) {
        throw new ValidationError(`WorkflowTransitionRecord.id must be unique within workflow: ${record.id}`);
      }
      transitionIds.add(record.id);
    }
  }

  #assertStateTransition(nextState) {
    const allowed = WORKFLOW_STATE_TRANSITIONS[this.state] ?? new Set();
    if (!allowed.has(nextState)) {
      throw new ValidationError(
        `ReviewWorkflow cannot transition from state=${this.state} to state=${nextState}`,
      );
    }
  }

  #assertRoleTransition(actorRole, nextState) {
    const key = `${this.state}->${nextState}`;
    const allowedRoles = ROLE_TRANSITION_POLICY[key] ?? new Set();
    if (!allowedRoles.has(actorRole)) {
      throw new ValidationError(
        `Role ${actorRole} cannot transition ReviewWorkflow from ${this.state} to ${nextState}`,
      );
    }
  }

  #assertEvidenceForTransition(nextState, evidenceSummary) {
    if (
      (nextState === reviewWorkflowState.APPROVED || nextState === reviewWorkflowState.SUBMITTED) &&
      this.evidenceItemIds.length > 0
    ) {
      if (!evidenceSummary || evidenceSummary.isSufficient !== true) {
        throw new ValidationError(
          'ReviewWorkflow cannot be approved/submitted until referenced evidence is complete and active',
        );
      }
    }
  }
}

