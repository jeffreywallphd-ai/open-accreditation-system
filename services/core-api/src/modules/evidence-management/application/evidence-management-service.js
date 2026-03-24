import { NotFoundError, ValidationError } from '../../shared/kernel/errors.js';
import { EvidenceItem } from '../domain/entities/evidence-item.js';
import {
  evidenceReferenceTargetType,
  evidenceStatus,
} from '../domain/value-objects/evidence-classifications.js';

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
    this.accreditationFrameworks = deps.accreditationFrameworks;
    this.curriculumMapping = deps.curriculumMapping;
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

  async addEvidenceReference(evidenceItemId, input) {
    const evidenceItem = await this.#requireEvidenceItem(evidenceItemId);
    await this.#validateReferenceTarget(evidenceItem, input);
    evidenceItem.addReference(input);
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
    const successor = await this.#requireEvidenceItem(successorEvidenceItemId);
    this.#assertValidSupersessionSuccessor(evidenceItem, successor);
    evidenceItem.supersedeBy(successorEvidenceItemId);
    return this.evidenceItems.save(evidenceItem);
  }

  async createSupersedingEvidenceVersion(evidenceItemId, input = {}) {
    const evidenceItem = await this.#requireEvidenceItem(evidenceItemId);
    const successor = evidenceItem.createSupersedingVersion(input);
    await this.evidenceItems.save(successor);
    evidenceItem.supersedeBy(successor.id);
    await this.evidenceItems.save(evidenceItem);
    return successor;
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
        if (!input.successorEvidenceItemId) {
          throw new ValidationError('successorEvidenceItemId is required for supersede action');
        }
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

  async getCurrentEvidenceVersion(evidenceLineageId) {
    if (!evidenceLineageId) {
      throw new ValidationError('evidenceLineageId is required');
    }
    return this.evidenceItems.getCurrentByLineageId(evidenceLineageId);
  }

  async listEvidenceVersions(evidenceLineageId, options = { includeHistorical: true }) {
    if (!evidenceLineageId) {
      throw new ValidationError('evidenceLineageId is required');
    }
    if (options?.includeHistorical === false) {
      const current = await this.evidenceItems.getCurrentByLineageId(evidenceLineageId);
      return current ? [current] : [];
    }
    return this.evidenceItems.listByLineageId(evidenceLineageId);
  }

  async listEvidenceByReference(targetType, targetEntityId, options = {}) {
    if (!targetType || !targetEntityId) {
      throw new ValidationError('targetType and targetEntityId are required');
    }
    return this.evidenceItems.findByFilter({
      targetType,
      targetEntityId,
      relationshipType: options.relationshipType,
      currentOnly: options.currentOnly,
      institutionId: options.institutionId,
    });
  }

  async #requireInstitution(institutionId) {
    const institution = await this.institutions.getById(institutionId);
    if (!institution) {
      throw new ValidationError(`Institution not found: ${institutionId}`);
    }
  }

  async #requireEvidenceItem(evidenceItemId) {
    if (!evidenceItemId) {
      throw new ValidationError('EvidenceItem id is required');
    }
    const evidenceItem = await this.evidenceItems.getById(evidenceItemId);
    if (!evidenceItem) {
      throw new NotFoundError('EvidenceItem', evidenceItemId);
    }
    return evidenceItem;
  }

  #assertValidSupersessionSuccessor(evidenceItem, successor) {
    if (successor.institutionId !== evidenceItem.institutionId) {
      throw new ValidationError('Superseding EvidenceItem must belong to the same institution');
    }
    if (successor.status === evidenceStatus.SUPERSEDED || successor.status === evidenceStatus.ARCHIVED) {
      throw new ValidationError(
        `Superseding EvidenceItem must not be terminal (received status=${successor.status})`,
      );
    }
  }

  async #validateReferenceTarget(evidenceItem, input) {
    if (!input?.targetType || !input?.targetEntityId) {
      throw new ValidationError('EvidenceReference targetType and targetEntityId are required');
    }

    if (input.targetType === evidenceReferenceTargetType.CRITERION) {
      const criterion = await this.accreditationFrameworks?.getCriterionById?.(input.targetEntityId);
      if (!criterion) {
        throw new ValidationError(`Criterion not found: ${input.targetEntityId}`);
      }
      return;
    }

    if (input.targetType === evidenceReferenceTargetType.CRITERION_ELEMENT) {
      const criterionElement = await this.accreditationFrameworks?.getCriterionElementById?.(input.targetEntityId);
      if (!criterionElement) {
        throw new ValidationError(`CriterionElement not found: ${input.targetEntityId}`);
      }
      return;
    }

    if (input.targetType === evidenceReferenceTargetType.LEARNING_OUTCOME) {
      const learningOutcome = await this.curriculumMapping?.getLearningOutcomeById?.(input.targetEntityId);
      if (!learningOutcome) {
        throw new ValidationError(`LearningOutcome not found: ${input.targetEntityId}`);
      }
      if (learningOutcome.institutionId !== evidenceItem.institutionId) {
        throw new ValidationError('EvidenceReference LearningOutcome must belong to the same institution');
      }
    }
  }
}
