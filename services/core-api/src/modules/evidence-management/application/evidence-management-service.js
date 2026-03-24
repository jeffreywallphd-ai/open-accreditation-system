import { NotFoundError, ValidationError } from '../../shared/kernel/errors.js';
import { EvidenceItem } from '../domain/entities/evidence-item.js';
import {
  evidenceReferenceTargetType,
  parseEvidenceReferenceTargetType,
  evidenceStatus,
} from '../domain/value-objects/evidence-classifications.js';
import {
  createDefaultEvidenceReferenceTargetValidators,
  normalizeAndValidateReferenceInput,
} from './evidence-reference-target-validators.js';

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
    this.narrativesReporting = deps.narrativesReporting;
    this.referenceTargetValidators =
      deps.referenceTargetValidators ??
      createDefaultEvidenceReferenceTargetValidators({
        accreditationFrameworksService: this.accreditationFrameworks,
        curriculumMappingService: this.curriculumMapping,
        narrativesReportingService: this.narrativesReporting,
      });
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
    const normalizedInput = normalizeAndValidateReferenceInput(input);
    await this.#validateReferenceTarget(evidenceItem, normalizedInput);
    evidenceItem.addReference(normalizedInput);
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
    return this.evidenceItems.findByFilter(this.#normalizeQueryFilter(filter));
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
    parseEvidenceReferenceTargetType(targetType, 'EvidenceReference.targetType');
    return this.evidenceItems.findByFilter({
      targetType,
      targetEntityId,
      relationshipType: options.relationshipType,
      versionState: options.versionState,
      currentOnly: options.currentOnly,
      institutionId: options.institutionId,
      reviewCycleId: options.reviewCycleId,
      reportingPeriodId: options.reportingPeriodId,
      status: options.status,
      statuses: options.statuses,
      isUsable: options.isUsable,
      hasAvailableArtifact: options.hasAvailableArtifact,
      requiresArtifactForActivation: options.requiresArtifactForActivation,
      hasRationale: options.hasRationale,
    });
  }

  async listEvidenceByCriterion(criterionId, options = {}) {
    return this.listEvidenceByReference(evidenceReferenceTargetType.CRITERION, criterionId, options);
  }

  async listEvidenceByCriterionElement(criterionElementId, options = {}) {
    return this.listEvidenceByReference(evidenceReferenceTargetType.CRITERION_ELEMENT, criterionElementId, options);
  }

  async listEvidenceByLearningOutcome(learningOutcomeId, options = {}) {
    return this.listEvidenceByReference(evidenceReferenceTargetType.LEARNING_OUTCOME, learningOutcomeId, options);
  }

  async listEvidenceByNarrativeSection(narrativeSectionId, options = {}) {
    return this.listEvidenceByReference(evidenceReferenceTargetType.NARRATIVE_SECTION, narrativeSectionId, options);
  }

  async listCurrentEvidence(filter = {}) {
    return this.evidenceItems.findByFilter({
      ...this.#normalizeQueryFilter(filter),
      versionState: 'current',
    });
  }

  async listHistoricalEvidence(filter = {}) {
    return this.evidenceItems.findByFilter({
      ...this.#normalizeQueryFilter(filter),
      versionState: 'historical',
    });
  }

  async listEvidenceWithLinkageContext(filter = {}) {
    const normalizedFilter = this.#normalizeQueryFilter(filter);
    const items = await this.evidenceItems.findByFilter(normalizedFilter);
    return items.map((evidenceItem) => {
      const matchingReferences = this.#selectMatchingReferences(evidenceItem, normalizedFilter);
      return {
        evidenceItem,
        linkageContext: {
          matchingReferences,
          referenceCount: evidenceItem.references.length,
          matchingReferenceCount: matchingReferences.length,
        },
      };
    });
  }

  async getEvidenceLineageCycleReadiness(evidenceLineageId) {
    const versions = await this.listEvidenceVersions(evidenceLineageId, { includeHistorical: true });
    const reviewCycleIds = [...new Set(versions.map((item) => item.reviewCycleId).filter(Boolean))];
    const reportingPeriodIds = [...new Set(versions.map((item) => item.reportingPeriodId).filter(Boolean))];

    return {
      evidenceLineageId,
      versionCount: versions.length,
      reviewCycleIds,
      reportingPeriodIds,
      hasCrossCycleReuse: reviewCycleIds.length > 1 || reportingPeriodIds.length > 1,
      versions: versions.map((item) => ({
        id: item.id,
        versionNumber: item.versionNumber,
        status: item.status,
        reviewCycleId: item.reviewCycleId,
        reportingPeriodId: item.reportingPeriodId,
        supersedesEvidenceItemId: item.supersedesEvidenceItemId,
        supersededByEvidenceItemId: item.supersededByEvidenceItemId,
      })),
    };
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
    const validator = this.referenceTargetValidators.get(input.targetType);
    if (!validator) {
      throw new ValidationError(`EvidenceReference targetType is not supported: ${input.targetType}`);
    }

    const result = await validator.validate({
      targetEntityId: input.targetEntityId,
      evidenceItem,
      referenceInput: input,
    });

    if (!result?.exists || result?.admissible === false) {
      throw new ValidationError(
        result?.reason ?? `EvidenceReference target not found or inadmissible: ${input.targetType}:${input.targetEntityId}`,
      );
    }

    if (result?.institutionId && result.institutionId !== evidenceItem.institutionId) {
      throw new ValidationError(`EvidenceReference ${input.targetType} must belong to the same institution`);
    }
  }

  #normalizeQueryFilter(filter = {}) {
    const normalized = { ...filter };
    if (normalized.currentOnly === true && !normalized.versionState) {
      normalized.versionState = 'current';
    }
    if (normalized.currentOnly === false && !normalized.versionState) {
      normalized.versionState = 'all';
    }

    if (normalized.versionState && !['current', 'historical', 'all'].includes(normalized.versionState)) {
      throw new ValidationError('versionState must be one of: current, historical, all');
    }

    return normalized;
  }

  #selectMatchingReferences(evidenceItem, filter) {
    const references = evidenceItem.references ?? [];
    const referenceFiltersDefined =
      filter.targetType !== undefined ||
      filter.targetEntityId !== undefined ||
      filter.relationshipType !== undefined ||
      filter.hasRationale !== undefined;

    if (!referenceFiltersDefined) {
      return references;
    }

    return references.filter((reference) => {
      const hasRationale = Boolean(reference.rationale && reference.rationale.trim() !== '');
      if (filter.targetType && reference.targetType !== filter.targetType) {
        return false;
      }
      if (filter.targetEntityId && reference.targetEntityId !== filter.targetEntityId) {
        return false;
      }
      if (filter.relationshipType && reference.relationshipType !== filter.relationshipType) {
        return false;
      }
      if (filter.hasRationale === true && !hasRationale) {
        return false;
      }
      if (filter.hasRationale === false && hasRationale) {
        return false;
      }
      return true;
    });
  }
}
