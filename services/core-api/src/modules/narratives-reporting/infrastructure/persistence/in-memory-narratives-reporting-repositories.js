import { ValidationError } from '../../../shared/kernel/errors.js';
import { Narrative } from '../../domain/entities/narrative.js';
import { SubmissionPackageRepository, NarrativeRepository } from '../../domain/repositories/repositories.js';
import { SubmissionPackage } from '../../domain/entities/submission-package.js';
import { narrativeStatus } from '../../domain/value-objects/narrative-statuses.js';
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

function toNarrativeSnapshot(narrative) {
  return {
    id: narrative.id,
    institutionId: narrative.institutionId,
    reviewCycleId: narrative.reviewCycleId,
    submissionPackageId: narrative.submissionPackageId,
    title: narrative.title,
    status: narrative.status,
    sections: (narrative.sections ?? []).map((section) => ({
      id: section.id,
      narrativeId: section.narrativeId,
      sequence: section.sequence,
      sectionType: section.sectionType,
      sectionKey: section.sectionKey,
      parentSectionKey: section.parentSectionKey,
      title: section.title,
      content: section.content,
      ownerId: section.ownerId,
      evidenceLinks: (section.evidenceLinks ?? []).map((link) => ({
        id: link.id,
        sectionId: link.sectionId,
        evidenceItemId: link.evidenceItemId,
        relationshipType: link.relationshipType,
        rationale: link.rationale,
        createdAt: link.createdAt,
      })),
      packageLinks: (section.packageLinks ?? []).map((link) => ({
        id: link.id,
        sectionId: link.sectionId,
        submissionPackageItemId: link.submissionPackageItemId,
        linkType: link.linkType,
        createdAt: link.createdAt,
      })),
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    })),
    createdAt: narrative.createdAt,
    updatedAt: narrative.updatedAt,
    submittedForReviewAt: narrative.submittedForReviewAt,
    finalizedAt: narrative.finalizedAt,
  };
}

function matchesNarrativeFilter(narrative, filter = {}) {
  if (filter.id && narrative.id !== filter.id) {
    return false;
  }
  if (filter.institutionId && narrative.institutionId !== filter.institutionId) {
    return false;
  }
  if (filter.reviewCycleId && narrative.reviewCycleId !== filter.reviewCycleId) {
    return false;
  }
  if (filter.submissionPackageId && narrative.submissionPackageId !== filter.submissionPackageId) {
    return false;
  }
  if (filter.status && narrative.status !== filter.status) {
    return false;
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

export class InMemoryNarrativeRepository extends NarrativeRepository {
  constructor() {
    super();
    this.narratives = new Map();
  }

  async save(narrative) {
    if (!(narrative instanceof Narrative)) {
      throw new ValidationError('NarrativeRepository.save expects a Narrative aggregate instance');
    }

    const validated = Narrative.rehydrate(toNarrativeSnapshot(narrative));
    const existing = this.narratives.get(validated.id);
    if (existing) {
      this.#assertIdentityUnchanged(existing, validated);
      if (existing.status === narrativeStatus.FINALIZED) {
        this.#assertFinalizedRecordUnchanged(existing, validated);
      }
    }
    this.#assertSubmissionPackageUniqueness(validated);

    const persisted = structuredClone(toNarrativeSnapshot(validated));
    this.narratives.set(validated.id, persisted);
    return Narrative.rehydrate(structuredClone(persisted));
  }

  async getById(id) {
    const stored = this.narratives.get(id);
    return stored ? Narrative.rehydrate(structuredClone(stored)) : null;
  }

  async findByFilter(filter = {}) {
    return [...this.narratives.values()]
      .map((item) => Narrative.rehydrate(structuredClone(item)))
      .filter((item) => matchesNarrativeFilter(item, filter));
  }

  async getBySubmissionPackageId(submissionPackageId) {
    const stored = [...this.narratives.values()].find((item) => item.submissionPackageId === submissionPackageId);
    return stored ? Narrative.rehydrate(structuredClone(stored)) : null;
  }

  #assertIdentityUnchanged(existing, next) {
    if (
      existing.institutionId !== next.institutionId ||
      existing.reviewCycleId !== next.reviewCycleId ||
      existing.submissionPackageId !== next.submissionPackageId ||
      existing.createdAt !== next.createdAt
    ) {
      throw new ValidationError('Narrative identity fields cannot be changed in-place');
    }
  }

  #assertSubmissionPackageUniqueness(next) {
    const duplicate = [...this.narratives.values()].find(
      (item) => item.id !== next.id && item.submissionPackageId === next.submissionPackageId,
    );
    if (duplicate) {
      throw new ValidationError(
        `Narrative submissionPackageId must be unique (existing: ${duplicate.id})`,
      );
    }
  }

  #assertFinalizedRecordUnchanged(existing, next) {
    const expected = Narrative.rehydrate(existing);
    const candidate = Narrative.rehydrate(toNarrativeSnapshot(next));
    if (JSON.stringify(toNarrativeSnapshot(expected)) !== JSON.stringify(toNarrativeSnapshot(candidate))) {
      throw new ValidationError('Narrative cannot be modified after finalization');
    }
  }
}
