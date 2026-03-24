import { ValidationError } from '../../../shared/kernel/errors.js';
import { ReviewCycleRepository, ReviewWorkflowRepository } from '../../domain/repositories/repositories.js';
import {
  buildReviewCycleCriticalFieldsFingerprint,
  ReviewCycle,
} from '../../domain/entities/review-cycle.js';
import { ReviewWorkflow } from '../../domain/entities/review-workflow.js';
import { reviewCycleStatus } from '../../domain/value-objects/workflow-statuses.js';

function toReviewCycleSnapshot(cycle) {
  return {
    id: cycle.id,
    institutionId: cycle.institutionId,
    name: cycle.name,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    status: cycle.status,
    programIds: [...(cycle.programIds ?? [])],
    organizationUnitIds: [...(cycle.organizationUnitIds ?? [])],
    evidenceSetIds: [...(cycle.evidenceSetIds ?? [])],
    createdAt: cycle.createdAt,
    updatedAt: cycle.updatedAt,
  };
}

function toReviewWorkflowSnapshot(workflow) {
  return {
    id: workflow.id,
    reviewCycleId: workflow.reviewCycleId,
    institutionId: workflow.institutionId,
    targetType: workflow.targetType,
    targetId: workflow.targetId,
    reportSectionId: workflow.reportSectionId,
    evidenceCollectionId: workflow.evidenceCollectionId,
    evidenceItemIds: [...(workflow.evidenceItemIds ?? [])],
    state: workflow.state,
    transitionHistory: (workflow.transitionHistory ?? []).map((item) => ({
      id: item.id,
      workflowId: item.workflowId,
      sequence: item.sequence,
      fromState: item.fromState,
      toState: item.toState,
      actorRole: item.actorRole,
      actorId: item.actorId ?? null,
      reason: item.reason,
      evidenceSummary: item.evidenceSummary,
      transitionedAt: item.transitionedAt,
      createdAt: item.createdAt,
    })),
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
  };
}

function reviewCycleMatchesFilter(cycle, filter = {}) {
  if (filter.id && cycle.id !== filter.id) {
    return false;
  }
  if (filter.institutionId && cycle.institutionId !== filter.institutionId) {
    return false;
  }
  if (filter.status && cycle.status !== filter.status) {
    return false;
  }
  if (filter.scopeKey && cycle.scopeKey !== filter.scopeKey) {
    return false;
  }
  return true;
}

function reviewWorkflowMatchesFilter(workflow, filter = {}) {
  if (filter.id && workflow.id !== filter.id) {
    return false;
  }
  if (filter.reviewCycleId && workflow.reviewCycleId !== filter.reviewCycleId) {
    return false;
  }
  if (filter.institutionId && workflow.institutionId !== filter.institutionId) {
    return false;
  }
  if (filter.state && workflow.state !== filter.state) {
    return false;
  }
  if (filter.targetType && workflow.targetType !== filter.targetType) {
    return false;
  }
  if (filter.targetId && workflow.targetId !== filter.targetId) {
    return false;
  }
  if (filter.reportSectionId && workflow.reportSectionId !== filter.reportSectionId) {
    return false;
  }
  if (filter.evidenceCollectionId && workflow.evidenceCollectionId !== filter.evidenceCollectionId) {
    return false;
  }
  return true;
}

export class InMemoryReviewCycleRepository extends ReviewCycleRepository {
  constructor() {
    super();
    this.cycles = new Map();
  }

  async save(cycle) {
    if (!(cycle instanceof ReviewCycle)) {
      throw new ValidationError('ReviewCycleRepository.save expects a ReviewCycle aggregate instance');
    }
    const validated = ReviewCycle.rehydrate(toReviewCycleSnapshot(cycle));

    const existing = this.cycles.get(validated.id);
    if (existing) {
      this.#assertIdentityUnchanged(existing, validated);
    }
    this.#assertSingleActiveScope(validated);

    const snapshot = structuredClone(toReviewCycleSnapshot(validated));
    this.cycles.set(validated.id, snapshot);
    return ReviewCycle.rehydrate(structuredClone(snapshot));
  }

  async getById(id) {
    const snapshot = this.cycles.get(id);
    return snapshot ? ReviewCycle.rehydrate(structuredClone(snapshot)) : null;
  }

  async findByFilter(filter = {}) {
    return [...this.cycles.values()]
      .map((item) => ReviewCycle.rehydrate(structuredClone(item)))
      .filter((cycle) => reviewCycleMatchesFilter(cycle, filter));
  }

  async getActiveByScope(institutionId, scopeKey) {
    const cycle = [...this.cycles.values()]
      .map((item) => ReviewCycle.rehydrate(structuredClone(item)))
      .find(
        (item) =>
          item.institutionId === institutionId &&
          item.scopeKey === scopeKey &&
          item.status === reviewCycleStatus.ACTIVE,
      );
    return cycle ?? null;
  }

  #assertIdentityUnchanged(existing, next) {
    if (existing.institutionId !== next.institutionId || existing.createdAt !== next.createdAt) {
      throw new ValidationError('ReviewCycle identity fields cannot be changed in-place');
    }
    if (
      (existing.status === reviewCycleStatus.COMPLETED || existing.status === reviewCycleStatus.ARCHIVED) &&
      buildReviewCycleCriticalFieldsFingerprint(existing) !== buildReviewCycleCriticalFieldsFingerprint(next)
    ) {
      throw new ValidationError(
        'ReviewCycle critical fields cannot be modified after status is completed or archived',
      );
    }
  }

  #assertSingleActiveScope(next) {
    if (next.status !== reviewCycleStatus.ACTIVE) {
      return;
    }
    const activeCycle = [...this.cycles.values()].find(
      (item) =>
        item.id !== next.id &&
        item.institutionId === next.institutionId &&
        item.status === reviewCycleStatus.ACTIVE &&
        ReviewCycle.rehydrate(item).scopeKey === next.scopeKey,
    );
    if (activeCycle) {
      throw new ValidationError(`Only one active ReviewCycle is allowed per scope (existing: ${activeCycle.id})`);
    }
  }
}

export class InMemoryReviewWorkflowRepository extends ReviewWorkflowRepository {
  constructor() {
    super();
    this.workflows = new Map();
  }

  async save(workflow) {
    if (!(workflow instanceof ReviewWorkflow)) {
      throw new ValidationError('ReviewWorkflowRepository.save expects a ReviewWorkflow aggregate instance');
    }
    const validated = ReviewWorkflow.rehydrate(toReviewWorkflowSnapshot(workflow));

    const existing = this.workflows.get(validated.id);
    if (existing) {
      this.#assertIdentityUnchanged(existing, validated);
      this.#assertTransitionHistoryAppendOnly(existing, validated);
    }
    this.#assertCycleTargetUnique(validated);

    const snapshot = structuredClone(toReviewWorkflowSnapshot(validated));
    this.workflows.set(validated.id, snapshot);
    return ReviewWorkflow.rehydrate(structuredClone(snapshot));
  }

  async getById(id) {
    const snapshot = this.workflows.get(id);
    return snapshot ? ReviewWorkflow.rehydrate(structuredClone(snapshot)) : null;
  }

  async findByFilter(filter = {}) {
    return [...this.workflows.values()]
      .map((item) => ReviewWorkflow.rehydrate(structuredClone(item)))
      .filter((workflow) => reviewWorkflowMatchesFilter(workflow, filter));
  }

  async getByCycleAndTarget(reviewCycleId, targetType, targetId) {
    const snapshot = [...this.workflows.values()].find(
      (workflow) =>
        workflow.reviewCycleId === reviewCycleId &&
        workflow.targetType === targetType &&
        workflow.targetId === targetId,
    );
    return snapshot ? ReviewWorkflow.rehydrate(structuredClone(snapshot)) : null;
  }

  #assertIdentityUnchanged(existing, next) {
    if (
      existing.reviewCycleId !== next.reviewCycleId ||
      existing.institutionId !== next.institutionId ||
      existing.targetType !== next.targetType ||
      existing.targetId !== next.targetId ||
      existing.createdAt !== next.createdAt
    ) {
      throw new ValidationError('ReviewWorkflow identity fields cannot be changed in-place');
    }
  }

  #assertTransitionHistoryAppendOnly(existing, next) {
    const nextHistoryById = new Map((next.transitionHistory ?? []).map((item) => [item.id, item]));
    for (const persisted of existing.transitionHistory ?? []) {
      const candidate = nextHistoryById.get(persisted.id);
      if (!candidate) {
        throw new ValidationError(`Workflow transition history is append-only: missing ${persisted.id}`);
      }
      if (
        candidate.sequence !== persisted.sequence ||
        candidate.workflowId !== persisted.workflowId ||
        candidate.fromState !== persisted.fromState ||
        candidate.toState !== persisted.toState ||
        candidate.actorRole !== persisted.actorRole ||
        candidate.actorId !== (persisted.actorId ?? null) ||
        candidate.reason !== persisted.reason ||
        JSON.stringify(candidate.evidenceSummary ?? null) !== JSON.stringify(persisted.evidenceSummary ?? null) ||
        candidate.transitionedAt !== persisted.transitionedAt ||
        candidate.createdAt !== persisted.createdAt
      ) {
        throw new ValidationError(`Workflow transition history is append-only: ${persisted.id} cannot be modified`);
      }
    }
  }

  #assertCycleTargetUnique(next) {
    const duplicate = [...this.workflows.values()].find(
      (workflow) =>
        workflow.id !== next.id &&
        workflow.reviewCycleId === next.reviewCycleId &&
        workflow.targetType === next.targetType &&
        workflow.targetId === next.targetId,
    );
    if (duplicate) {
      throw new ValidationError(
        `ReviewWorkflow cycle-target must be unique (existing: ${duplicate.id})`,
      );
    }
  }
}

