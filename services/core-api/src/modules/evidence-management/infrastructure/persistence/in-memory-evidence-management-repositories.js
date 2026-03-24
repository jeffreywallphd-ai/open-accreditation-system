import { ValidationError } from '../../../shared/kernel/errors.js';
import { EvidenceItemRepository } from '../../domain/repositories/repositories.js';
import { EvidenceItem } from '../../domain/entities/evidence-item.js';

function matchesFilter(item, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (value === undefined || value === null) {
      return true;
    }
    return item[key] === value;
  });
}

export class InMemoryEvidenceItemRepository extends EvidenceItemRepository {
  constructor() {
    super();
    this.items = new Map();
  }

  async save(evidenceItem) {
    const existing = this.items.get(evidenceItem.id);
    if (existing) {
      this.#assertAppendOnlyArtifacts(existing, evidenceItem);
    }
    const persisted = structuredClone(evidenceItem);
    this.items.set(evidenceItem.id, persisted);
    return EvidenceItem.rehydrate(structuredClone(persisted));
  }

  async getById(id) {
    const item = this.items.get(id);
    return item ? EvidenceItem.rehydrate(structuredClone(item)) : null;
  }

  async findByFilter(filter = {}) {
    return [...this.items.values()]
      .filter((item) => matchesFilter(item, filter))
      .map((item) => EvidenceItem.rehydrate(structuredClone(item)));
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
}
