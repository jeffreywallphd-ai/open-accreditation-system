import { assertRequired, assertString } from '../../../shared/kernel/assertions.js';
import { ValidationError } from '../../../shared/kernel/errors.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import {
  parseReviewWorkflowState,
  parseWorkflowActorRole,
  reviewWorkflowState,
} from '../value-objects/workflow-statuses.js';
import {
  assertAllowedWorkflowStateTransition,
  assertWorkflowRoleCanTransition,
} from '../policies/review-workflow-transition-policy.js';

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
    if (!Number.isInteger(props.sequence) || props.sequence < 1) {
      throw new ValidationError('WorkflowTransitionRecord.sequence must be an integer >= 1');
    }

    this.id = props.id;
    this.workflowId = props.workflowId;
    this.sequence = props.sequence;
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
      sequence: input.sequence,
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

  submitForReview(actorRole, options = {}) {
    return this.#transition(reviewWorkflowState.IN_REVIEW, actorRole, options);
  }

  requestRevision(actorRole, options = {}) {
    return this.#transition(reviewWorkflowState.REVISION_REQUIRED, actorRole, options);
  }

  returnToDraft(actorRole, options = {}) {
    return this.#transition(reviewWorkflowState.DRAFT, actorRole, options);
  }

  approve(actorRole, options = {}) {
    return this.#transition(reviewWorkflowState.APPROVED, actorRole, options);
  }

  submitFinal(actorRole, options = {}) {
    return this.#transition(reviewWorkflowState.SUBMITTED, actorRole, options);
  }

  transitionTo(nextState, actorRole, options = {}) {
    return this.#transition(nextState, actorRole, options);
  }

  #transition(nextState, actorRole, options = {}) {
    parseReviewWorkflowState(nextState, 'ReviewWorkflow.nextState');
    parseWorkflowActorRole(actorRole, 'ReviewWorkflow.actorRole');
    this.#assertStateTransition(nextState);
    this.#assertRoleTransition(actorRole, nextState);
    this.#assertEvidenceForTransition(nextState, options.evidenceSummary);

    const previousState = this.state;
    this.state = nextState;
    const historyEntry = WorkflowTransitionRecord.create({
      workflowId: this.id,
      sequence: this.transitionHistory.length + 1,
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
    let previous = null;
    for (const record of this.transitionHistory) {
      if (record.workflowId !== this.id) {
        throw new ValidationError('WorkflowTransitionRecord.workflowId must match ReviewWorkflow.id');
      }
      if (transitionIds.has(record.id)) {
        throw new ValidationError(`WorkflowTransitionRecord.id must be unique within workflow: ${record.id}`);
      }
      if (record.sequence !== transitionIds.size + 1) {
        throw new ValidationError('WorkflowTransitionRecord.sequence must be contiguous and start at 1');
      }
      if (!previous && record.fromState !== reviewWorkflowState.DRAFT) {
        throw new ValidationError('WorkflowTransitionRecord history must start from draft');
      }
      if (previous && record.fromState !== previous.toState) {
        throw new ValidationError('WorkflowTransitionRecord history chain is invalid');
      }
      transitionIds.add(record.id);
      previous = record;
    }

    if (this.transitionHistory.length === 0) {
      if (this.state !== reviewWorkflowState.DRAFT) {
        throw new ValidationError('ReviewWorkflow without transition history must be in draft state');
      }
      return;
    }

    const lastTransition = this.transitionHistory[this.transitionHistory.length - 1];
    if (lastTransition.toState !== this.state) {
      throw new ValidationError('ReviewWorkflow.state must match the last transition toState');
    }
  }

  #assertStateTransition(nextState) {
    assertAllowedWorkflowStateTransition(this.state, nextState);
  }

  #assertRoleTransition(actorRole, nextState) {
    assertWorkflowRoleCanTransition(this.state, nextState, actorRole);
  }

  #assertEvidenceForTransition(nextState, evidenceSummary) {
    if (nextState === reviewWorkflowState.APPROVED || nextState === reviewWorkflowState.SUBMITTED) {
      if (!evidenceSummary || evidenceSummary.isSufficient !== true) {
        throw new ValidationError('ReviewWorkflow cannot be approved/submitted until evidence readiness is sufficient');
      }
    }
  }
}

