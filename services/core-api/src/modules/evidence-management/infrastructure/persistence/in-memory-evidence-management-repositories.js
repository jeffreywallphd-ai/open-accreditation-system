import { ValidationError } from '../../../shared/kernel/errors.js';
import { EvidenceItemRepository } from '../../domain/repositories/repositories.js';
import { EvidenceItem } from '../../domain/entities/evidence-item.js';
import { evidenceItemMatchesFilter } from './evidence-item-filtering.js';

export class InMemoryEvidenceItemRepository extends EvidenceItemRepository {
  constructor() {
    super();
    this.items = new Map();
  }

  async save(evidenceItem) {
    if (!(evidenceItem instanceof EvidenceItem)) {
      throw new ValidationError('EvidenceItemRepository.save expects an EvidenceItem aggregate instance');
    }

    const existing = this.items.get(evidenceItem.id);
    if (existing) {
      this.#assertAppendOnlyArtifacts(existing, evidenceItem);
      this.#assertAppendOnlyReferences(existing, evidenceItem);
      this.#assertIdentityFieldsUnchanged(existing, evidenceItem);
      this.#assertVersionFieldsUnchanged(existing, evidenceItem);
    } else {
      this.#assertValidVersionInsert(evidenceItem);
    }
    if (evidenceItem.supersededByEvidenceItemId) {
      this.#assertValidSupersededByLink(evidenceItem);
    }
    const persisted = structuredClone(evidenceItem);
    this.items.set(evidenceItem.id, persisted);
    return EvidenceItem.rehydrate(structuredClone(persisted));
  }

  async getById(id) {
    const item = this.items.get(id);
    return item ? EvidenceItem.rehydrate(structuredClone(item)) : null;
  }

  async getCurrentByLineageId(evidenceLineageId) {
    const candidates = [...this.items.values()].filter(
      (item) => item.evidenceLineageId === evidenceLineageId && !item.supersededByEvidenceItemId,
    );
    if (candidates.length === 0) {
      return null;
    }
    candidates.sort((a, b) => b.versionNumber - a.versionNumber);
    return EvidenceItem.rehydrate(structuredClone(candidates[0]));
  }

  async listByLineageId(evidenceLineageId) {
    return [...this.items.values()]
      .filter((item) => item.evidenceLineageId === evidenceLineageId)
      .sort((a, b) => a.versionNumber - b.versionNumber)
      .map((item) => EvidenceItem.rehydrate(structuredClone(item)));
  }

  async findByFilter(filter = {}) {
    return [...this.items.values()]
      .map((item) => EvidenceItem.rehydrate(structuredClone(item)))
      .filter((item) => evidenceItemMatchesFilter(item, filter));
  }

  #assertAppendOnlyArtifacts(existingItem, nextItem) {
    const nextArtifacts = new Map((nextItem.artifacts ?? []).map((artifact) => [artifact.id, artifact]));
    for (const existingArtifact of existingItem.artifacts ?? []) {
      const candidate = nextArtifacts.get(existingArtifact.id);
      if (!candidate) {
        throw new ValidationError(`EvidenceArtifact ${existingArtifact.id} cannot be removed from EvidenceItem aggregate`);
      }

      const hasArtifactChange =
        candidate.evidenceItemId !== existingArtifact.evidenceItemId ||
        candidate.artifactName !== existingArtifact.artifactName ||
        candidate.artifactType !== existingArtifact.artifactType ||
        candidate.mimeType !== existingArtifact.mimeType ||
        candidate.fileExtension !== existingArtifact.fileExtension ||
        candidate.byteSize !== existingArtifact.byteSize ||
        candidate.storageBucket !== existingArtifact.storageBucket ||
        candidate.storageKey !== existingArtifact.storageKey ||
        candidate.status !== existingArtifact.status ||
        candidate.sourceChecksum !== existingArtifact.sourceChecksum ||
        candidate.uploadedAt !== existingArtifact.uploadedAt;

      if (hasArtifactChange) {
        throw new ValidationError(`EvidenceArtifact ${existingArtifact.id} is append-only and cannot be changed in-place`);
      }
    }
  }

  #assertAppendOnlyReferences(existingItem, nextItem) {
    const nextReferences = new Map((nextItem.references ?? []).map((reference) => [reference.id, reference]));
    for (const existingReference of existingItem.references ?? []) {
      const candidate = nextReferences.get(existingReference.id);
      if (!candidate) {
        throw new ValidationError(`EvidenceReference ${existingReference.id} cannot be removed from EvidenceItem aggregate`);
      }

      const hasReferenceChange =
        candidate.evidenceItemId !== existingReference.evidenceItemId ||
        candidate.targetType !== existingReference.targetType ||
        candidate.targetEntityId !== existingReference.targetEntityId ||
        candidate.relationshipType !== existingReference.relationshipType ||
        candidate.rationale !== existingReference.rationale ||
        candidate.anchorPath !== existingReference.anchorPath;

      if (hasReferenceChange) {
        throw new ValidationError(`EvidenceReference ${existingReference.id} is append-only and cannot be changed in-place`);
      }
    }
  }

  #assertIdentityFieldsUnchanged(existingItem, nextItem) {
    if (
      existingItem.institutionId !== nextItem.institutionId ||
      existingItem.evidenceType !== nextItem.evidenceType ||
      existingItem.sourceType !== nextItem.sourceType ||
      existingItem.createdAt !== nextItem.createdAt
    ) {
      throw new ValidationError('EvidenceItem identity fields cannot be changed in-place');
    }
  }

  #assertVersionFieldsUnchanged(existingItem, nextItem) {
    if (
      existingItem.evidenceLineageId !== nextItem.evidenceLineageId ||
      existingItem.versionNumber !== nextItem.versionNumber ||
      existingItem.supersedesEvidenceItemId !== nextItem.supersedesEvidenceItemId
    ) {
      throw new ValidationError('EvidenceItem version identity fields cannot be changed in-place');
    }
  }

  #assertValidVersionInsert(evidenceItem) {
    if (!evidenceItem.supersedesEvidenceItemId) {
      return;
    }

    const predecessor = this.items.get(evidenceItem.supersedesEvidenceItemId);
    if (!predecessor) {
      throw new ValidationError(
        `EvidenceItem.supersedesEvidenceItemId must reference an existing EvidenceItem: ${evidenceItem.supersedesEvidenceItemId}`,
      );
    }
    if (predecessor.evidenceLineageId !== evidenceItem.evidenceLineageId) {
      throw new ValidationError('EvidenceItem predecessor and successor must share evidenceLineageId');
    }
    if (predecessor.versionNumber + 1 !== evidenceItem.versionNumber) {
      throw new ValidationError('EvidenceItem successor versionNumber must be predecessor.versionNumber + 1');
    }
    if (predecessor.supersededByEvidenceItemId) {
      throw new ValidationError(`EvidenceItem predecessor already superseded: ${predecessor.id}`);
    }

    const sibling = [...this.items.values()].find(
      (item) => item.supersedesEvidenceItemId === predecessor.id && item.id !== evidenceItem.id,
    );
    if (sibling) {
      throw new ValidationError(`EvidenceItem predecessor already has a successor: ${predecessor.id}`);
    }
  }

  #assertValidSupersededByLink(evidenceItem) {
    const successor = this.items.get(evidenceItem.supersededByEvidenceItemId);
    if (!successor) {
      throw new ValidationError(
        `EvidenceItem.supersededByEvidenceItemId must reference an existing EvidenceItem: ${evidenceItem.supersededByEvidenceItemId}`,
      );
    }

    if (successor.evidenceLineageId === evidenceItem.evidenceLineageId) {
      if (successor.supersedesEvidenceItemId !== evidenceItem.id) {
        throw new ValidationError('EvidenceItem successor must reference predecessor via supersedesEvidenceItemId');
      }
      if (successor.versionNumber !== evidenceItem.versionNumber + 1) {
        throw new ValidationError('EvidenceItem lineage successor must increment versionNumber by exactly 1');
      }
      return;
    }

    const isLegacyStandaloneSuccessor =
      successor.evidenceLineageId === successor.id && successor.versionNumber === 1 && !successor.supersedesEvidenceItemId;
    if (!isLegacyStandaloneSuccessor) {
      throw new ValidationError('EvidenceItem supersededByEvidenceItemId must point to a valid successor evidence item');
    }
  }
}
