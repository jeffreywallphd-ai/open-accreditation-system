import { ValidationError } from '../../../shared/kernel/errors.js';
import { SubmissionPackageRepository } from '../../domain/repositories/repositories.js';
import { SubmissionPackage } from '../../domain/entities/submission-package.js';
import { submissionPackageStatus } from '../../domain/value-objects/submission-package-statuses.js';

function toSnapshot(submissionPackage) {
  return {
    id: submissionPackage.id,
    institutionId: submissionPackage.institutionId,
    reviewCycleId: submissionPackage.reviewCycleId,
    scopeType: submissionPackage.scopeType,
    scopeId: submissionPackage.scopeId,
    name: submissionPackage.name,
    status: submissionPackage.status,
    finalizedAt: submissionPackage.finalizedAt,
    items: (submissionPackage.items ?? []).map((item) => ({
      id: item.id,
      packageId: item.packageId,
      sequence: item.sequence,
      itemType: item.itemType,
      assemblyRole: item.assemblyRole,
      targetType: item.targetType,
      targetId: item.targetId,
      workflowId: item.workflowId,
      sectionKey: item.sectionKey,
      sectionTitle: item.sectionTitle,
      parentSectionKey: item.parentSectionKey,
      sectionType: item.sectionType,
      evidenceItemIds: [...(item.evidenceItemIds ?? [])],
      label: item.label,
      rationale: item.rationale,
      metadata: item.metadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    snapshots: (submissionPackage.snapshots ?? []).map((snapshot) => ({
      id: snapshot.id,
      packageId: snapshot.packageId,
      versionNumber: snapshot.versionNumber,
      milestoneLabel: snapshot.milestoneLabel,
      actorId: snapshot.actorId,
      notes: snapshot.notes,
      finalized: snapshot.finalized,
      createdAt: snapshot.createdAt,
      items: (snapshot.items ?? []).map((item) => ({
        id: item.id,
        snapshotId: item.snapshotId,
        packageItemId: item.packageItemId,
        sequence: item.sequence,
        itemType: item.itemType,
        assemblyRole: item.assemblyRole,
        targetType: item.targetType,
        targetId: item.targetId,
        workflowId: item.workflowId,
        sectionKey: item.sectionKey,
        sectionTitle: item.sectionTitle,
        parentSectionKey: item.parentSectionKey,
        sectionType: item.sectionType,
        evidenceItemIds: [...(item.evidenceItemIds ?? [])],
        label: item.label,
        rationale: item.rationale,
        metadata: item.metadata,
        createdAt: item.createdAt,
      })),
    })),
    createdAt: submissionPackage.createdAt,
    updatedAt: submissionPackage.updatedAt,
  };
}

function matchesFilter(submissionPackage, filter = {}) {
  if (filter.id && submissionPackage.id !== filter.id) {
    return false;
  }
  if (filter.institutionId && submissionPackage.institutionId !== filter.institutionId) {
    return false;
  }
  if (filter.reviewCycleId && submissionPackage.reviewCycleId !== filter.reviewCycleId) {
    return false;
  }
  if (filter.scopeType && submissionPackage.scopeType !== filter.scopeType) {
    return false;
  }
  if (filter.scopeId && submissionPackage.scopeId !== filter.scopeId) {
    return false;
  }
  if (filter.status && submissionPackage.status !== filter.status) {
    return false;
  }
  if (filter.assemblyRole) {
    const hasRole = (submissionPackage.items ?? []).some((item) => item.assemblyRole === filter.assemblyRole);
    if (!hasRole) {
      return false;
    }
  }
  return true;
}

export class InMemorySubmissionPackageRepository extends SubmissionPackageRepository {
  constructor() {
    super();
    this.packages = new Map();
  }

  async save(submissionPackage) {
    if (!(submissionPackage instanceof SubmissionPackage)) {
      throw new ValidationError('SubmissionPackageRepository.save expects a SubmissionPackage aggregate instance');
    }

    const validated = SubmissionPackage.rehydrate(toSnapshot(submissionPackage));
    const existing = this.packages.get(validated.id);
    if (existing) {
      this.#assertIdentityUnchanged(existing, validated);
      this.#assertSnapshotHistoryAppendOnly(existing, validated);
      if (existing.status === submissionPackageStatus.FINALIZED) {
        this.#assertItemsUnchanged(existing, validated);
      }
    }
    this.#assertScopeUniqueness(validated);

    const persisted = structuredClone(toSnapshot(validated));
    this.packages.set(validated.id, persisted);
    return SubmissionPackage.rehydrate(structuredClone(persisted));
  }

  async getById(id) {
    const stored = this.packages.get(id);
    return stored ? SubmissionPackage.rehydrate(structuredClone(stored)) : null;
  }

  async findByFilter(filter = {}) {
    return [...this.packages.values()]
      .map((item) => SubmissionPackage.rehydrate(structuredClone(item)))
      .filter((item) => matchesFilter(item, filter));
  }

  async getByCycleAndScope(reviewCycleId, scopeType, scopeId) {
    const stored = [...this.packages.values()].find(
      (item) =>
        item.reviewCycleId === reviewCycleId &&
        item.scopeType === scopeType &&
        item.scopeId === scopeId,
    );
    return stored ? SubmissionPackage.rehydrate(structuredClone(stored)) : null;
  }

  #assertIdentityUnchanged(existing, next) {
    if (
      existing.institutionId !== next.institutionId ||
      existing.reviewCycleId !== next.reviewCycleId ||
      existing.scopeType !== next.scopeType ||
      existing.scopeId !== next.scopeId ||
      existing.createdAt !== next.createdAt
    ) {
      throw new ValidationError('SubmissionPackage identity fields cannot be changed in-place');
    }
  }

  #assertScopeUniqueness(next) {
    const duplicate = [...this.packages.values()].find(
      (item) =>
        item.id !== next.id &&
        item.reviewCycleId === next.reviewCycleId &&
        item.scopeType === next.scopeType &&
        item.scopeId === next.scopeId,
    );
    if (duplicate) {
      throw new ValidationError(
        `SubmissionPackage reviewCycle+scope must be unique (existing: ${duplicate.id})`,
      );
    }
  }

  #assertSnapshotHistoryAppendOnly(existing, next) {
    const nextById = new Map((next.snapshots ?? []).map((snapshot) => [snapshot.id, snapshot]));
    for (const snapshot of existing.snapshots ?? []) {
      const candidate = nextById.get(snapshot.id);
      if (!candidate) {
        throw new ValidationError(`SubmissionPackage snapshots are append-only: missing ${snapshot.id}`);
      }
      if (JSON.stringify(candidate) !== JSON.stringify(snapshot)) {
        throw new ValidationError(`SubmissionPackage snapshots are append-only: ${snapshot.id} cannot be modified`);
      }
    }
  }

  #assertItemsUnchanged(existing, next) {
    if (JSON.stringify(existing.items ?? []) !== JSON.stringify(next.items ?? [])) {
      throw new ValidationError('SubmissionPackage items cannot be modified after finalization');
    }
  }
}
