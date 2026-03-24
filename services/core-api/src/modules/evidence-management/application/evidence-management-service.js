import { NotFoundError, ValidationError } from '../../shared/kernel/errors.js';
import { EvidenceItem } from '../domain/entities/evidence-item.js';

export const evidenceLifecycleAction = Object.freeze({
  COMPLETE: 'complete',
  INCOMPLETE: 'incomplete',
  ACTIVATE: 'activate',
  SUPERSEDE: 'supersede',
  ARCHIVE: 'archive',
});

export class EvidenceManagementService {
  constructor(deps) {
    this.evidenceItems = deps.evidenceItems;
    this.institutions = deps.institutions;
  }

  async createEvidenceItem(input) {
    await this.#requireInstitution(input.institutionId);
    const evidenceItem = EvidenceItem.create(input);
    return this.evidenceItems.save(evidenceItem);
  }

  async addEvidenceArtifact(evidenceItemId, input) {
    const evidenceItem = await this.#requireEvidenceItem(evidenceItemId);
    evidenceItem.registerArtifactMetadata(input);
    return this.evidenceItems.save(evidenceItem);
  }

  async markEvidenceComplete(evidenceItemId) {
    const evidenceItem = await this.#requireEvidenceItem(evidenceItemId);
    evidenceItem.markReadyForUse();
    return this.evidenceItems.save(evidenceItem);
  }

  async markEvidenceIncomplete(evidenceItemId) {
    const evidenceItem = await this.#requireEvidenceItem(evidenceItemId);
    evidenceItem.markIncomplete();
    return this.evidenceItems.save(evidenceItem);
  }

  async activateEvidenceItem(evidenceItemId) {
    const evidenceItem = await this.#requireEvidenceItem(evidenceItemId);
    evidenceItem.activateForUse();
    return this.evidenceItems.save(evidenceItem);
  }

  async supersedeEvidenceItem(evidenceItemId, successorEvidenceItemId) {
    const evidenceItem = await this.#requireEvidenceItem(evidenceItemId);
    evidenceItem.supersedeBy(successorEvidenceItemId);
    return this.evidenceItems.save(evidenceItem);
  }

  async archiveEvidenceItem(evidenceItemId) {
    const evidenceItem = await this.#requireEvidenceItem(evidenceItemId);
    evidenceItem.archive();
    return this.evidenceItems.save(evidenceItem);
  }

  async updateEvidenceItemStatus(evidenceItemId, action, input = {}) {
    switch (action) {
      case evidenceLifecycleAction.COMPLETE:
        return this.markEvidenceComplete(evidenceItemId);
      case evidenceLifecycleAction.INCOMPLETE:
        return this.markEvidenceIncomplete(evidenceItemId);
      case evidenceLifecycleAction.ACTIVATE:
        return this.activateEvidenceItem(evidenceItemId);
      case evidenceLifecycleAction.SUPERSEDE:
        return this.supersedeEvidenceItem(evidenceItemId, input.successorEvidenceItemId);
      case evidenceLifecycleAction.ARCHIVE:
        return this.archiveEvidenceItem(evidenceItemId);
      default:
        throw new ValidationError(
          `Unsupported evidence lifecycle action: ${action}. Allowed actions: ${Object.values(evidenceLifecycleAction).join(', ')}`,
        );
    }
  }

  async getEvidenceItemById(id) {
    return this.evidenceItems.getById(id);
  }

  async listEvidenceItems(filter = {}) {
    return this.evidenceItems.findByFilter(filter);
  }

  async #requireInstitution(institutionId) {
    const institution = await this.institutions.getById(institutionId);
    if (!institution) {
      throw new ValidationError(`Institution not found: ${institutionId}`);
    }
  }

  async #requireEvidenceItem(evidenceItemId) {
    const evidenceItem = await this.evidenceItems.getById(evidenceItemId);
    if (!evidenceItem) {
      throw new NotFoundError('EvidenceItem', evidenceItemId);
    }
    return evidenceItem;
  }
}
