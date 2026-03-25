import { NotFoundError, ValidationError } from '../../shared/kernel/errors.js';
import { WorkflowEvidenceReadinessContract } from '../../evidence-management/application/contracts/workflow-evidence-readiness-contract.js';
import { Narrative } from '../domain/entities/narrative.js';
import {
  narrativePackageLinkType,
  narrativeSectionType,
} from '../domain/value-objects/narrative-statuses.js';
import { submissionPackageItemAssemblyRole } from '../domain/value-objects/submission-package-statuses.js';

function normalizeSectionEvidenceItemIds(section) {
  return [...new Set((section.evidenceLinks ?? []).map((link) => link.evidenceItemId).filter(Boolean))];
}

function toPackageItemContext(item) {
  return item
    ? {
      itemId: item.id,
      itemType: item.itemType,
      assemblyRole: item.assemblyRole,
      targetType: item.targetType,
      targetId: item.targetId,
      sectionKey: item.sectionKey,
      sectionTitle: item.sectionTitle,
      label: item.label,
      rationale: item.rationale,
    }
    : null;
}

export class NarrativeApplicationService {
  constructor(deps) {
    this.narratives = deps.narratives;
    this.submissionPackages = deps.submissionPackages;
    this.evidenceReadiness = deps.evidenceReadiness;

    if (!this.narratives || typeof this.narratives.save !== 'function') {
      throw new ValidationError('NarrativeApplicationService requires narratives repository');
    }
    if (!this.submissionPackages || typeof this.submissionPackages.getById !== 'function') {
      throw new ValidationError('NarrativeApplicationService requires submissionPackages repository');
    }
    if (!(this.evidenceReadiness instanceof WorkflowEvidenceReadinessContract)) {
      throw new ValidationError('NarrativeApplicationService requires WorkflowEvidenceReadinessContract');
    }
  }

  async createNarrative(input) {
    if (!input?.submissionPackageId) {
      throw new ValidationError('submissionPackageId is required');
    }
    const submissionPackage = await this.#requireSubmissionPackage(input.submissionPackageId);
    const existing = await this.narratives.getBySubmissionPackageId(submissionPackage.id);
    if (existing) {
      throw new ValidationError(
        `Narrative already exists for submissionPackageId ${submissionPackage.id}`,
      );
    }

    const narrative = Narrative.create({
      id: input.id,
      institutionId: submissionPackage.institutionId,
      reviewCycleId: submissionPackage.reviewCycleId,
      submissionPackageId: submissionPackage.id,
      title: input.title,
    });
    return this.narratives.save(narrative);
  }

  async addNarrativeSection(narrativeId, input) {
    const narrative = await this.#requireNarrative(narrativeId);
    narrative.addSection(input);
    return this.narratives.save(narrative);
  }

  async updateNarrativeSection(narrativeId, sectionId, input) {
    const narrative = await this.#requireNarrative(narrativeId);
    narrative.updateSection(sectionId, input);
    return this.narratives.save(narrative);
  }

  async removeNarrativeSection(narrativeId, sectionId) {
    const narrative = await this.#requireNarrative(narrativeId);
    narrative.removeSection(sectionId);
    return this.narratives.save(narrative);
  }

  async reorderNarrativeSection(narrativeId, sectionId, newPosition) {
    const narrative = await this.#requireNarrative(narrativeId);
    narrative.reorderSection(sectionId, newPosition);
    return this.narratives.save(narrative);
  }

  async linkNarrativeSectionEvidence(narrativeId, sectionId, input) {
    const narrative = await this.#requireNarrative(narrativeId);
    const section = narrative.getSectionById(sectionId);
    if (!section) {
      throw new ValidationError(`Narrative section not found: ${sectionId}`);
    }

    await this.#assertNarrativeSectionEvidenceLinkValid(narrative, section, input.evidenceItemId);
    narrative.linkSectionEvidence(sectionId, input);
    return this.narratives.save(narrative);
  }

  async unlinkNarrativeSectionEvidence(narrativeId, sectionId, linkId) {
    const narrative = await this.#requireNarrative(narrativeId);
    narrative.unlinkSectionEvidence(sectionId, linkId);
    return this.narratives.save(narrative);
  }

  async linkNarrativeSectionToPackageItem(narrativeId, sectionId, input) {
    const narrative = await this.#requireNarrative(narrativeId);
    const section = narrative.getSectionById(sectionId);
    if (!section) {
      throw new ValidationError(`Narrative section not found: ${sectionId}`);
    }

    const submissionPackage = await this.#requireSubmissionPackage(narrative.submissionPackageId);
    const packageItem = submissionPackage.items.find((item) => item.id === input.submissionPackageItemId);
    if (!packageItem) {
      throw new ValidationError(
        `Narrative section package link target not found in submission package: ${input.submissionPackageItemId}`,
      );
    }
    this.#assertSectionPackageLinkSemantics(section, packageItem, input.linkType);

    narrative.linkSectionToPackageItem(sectionId, input);
    return this.narratives.save(narrative);
  }

  async unlinkNarrativeSectionFromPackageItem(narrativeId, sectionId, submissionPackageItemId) {
    const narrative = await this.#requireNarrative(narrativeId);
    narrative.unlinkSectionFromPackageItem(sectionId, submissionPackageItemId);
    return this.narratives.save(narrative);
  }

  async submitNarrativeForReview(narrativeId) {
    const narrative = await this.#requireNarrative(narrativeId);
    narrative.submitForReview();
    return this.narratives.save(narrative);
  }

  async returnNarrativeToDraft(narrativeId) {
    const narrative = await this.#requireNarrative(narrativeId);
    narrative.returnToDraft();
    return this.narratives.save(narrative);
  }

  async finalizeNarrative(narrativeId) {
    const narrative = await this.#requireNarrative(narrativeId);
    narrative.finalize();
    return this.narratives.save(narrative);
  }

  async getNarrativeById(id) {
    return this.narratives.getById(id);
  }

  async listNarratives(filter = {}) {
    return this.narratives.findByFilter(filter);
  }

  async getNarrativeSectionById(sectionId) {
    if (!sectionId) {
      throw new ValidationError('sectionId is required');
    }
    if (typeof this.narratives.getSectionById === 'function') {
      return this.narratives.getSectionById(sectionId);
    }

    const candidates = await this.narratives.findByFilter({});
    for (const narrative of candidates) {
      const section = narrative.sections.find((entry) => entry.id === sectionId);
      if (section) {
        return {
          ...section,
          institutionId: narrative.institutionId,
          reviewCycleId: narrative.reviewCycleId,
          submissionPackageId: narrative.submissionPackageId,
          narrativeId: narrative.id,
        };
      }
    }
    return null;
  }

  async getNarrativeWithSectionContext(narrativeId) {
    const narrative = await this.#requireNarrative(narrativeId);
    const submissionPackage = await this.#requireSubmissionPackage(narrative.submissionPackageId);
    const packageItemById = new Map((submissionPackage.items ?? []).map((item) => [item.id, item]));
    const sectionContext = [];

    for (const section of narrative.sections) {
      const evidenceItemIds = normalizeSectionEvidenceItemIds(section);
      const evidenceSummary = evidenceItemIds.length > 0
        ? await this.evidenceReadiness.evaluateWorkflowEvidenceReadiness({
          institutionId: narrative.institutionId,
          reviewCycleId: narrative.reviewCycleId,
          targetType: section.sectionType,
          targetId: section.sectionKey,
          reportSectionId: section.sectionType === narrativeSectionType.REPORT_SECTION ? section.sectionKey : null,
          evidenceItemIds,
          readinessPolicy: {
            requiredReadinessLevel: 'present',
            requireAnyEvidenceForDecision: false,
            requireCurrentReferencedEvidence: false,
            requireCollectionScopedUsableEvidence: false,
            minimumReferencedUsableEvidenceCount: 0,
            minimumCollectionUsableEvidenceCount: 0,
          },
        })
        : null;

      sectionContext.push({
        sectionId: section.id,
        sectionKey: section.sectionKey,
        sectionType: section.sectionType,
        sequence: section.sequence,
        parentSectionKey: section.parentSectionKey,
        title: section.title,
        ownerId: section.ownerId,
        evidenceItemIds,
        evidenceSummary,
        packageLinks: section.packageLinks.map((link) => ({
          id: link.id,
          submissionPackageItemId: link.submissionPackageItemId,
          linkType: link.linkType,
          packageItem: toPackageItemContext(packageItemById.get(link.submissionPackageItemId)),
        })),
      });
    }

    return {
      narrative,
      submissionPackage: {
        id: submissionPackage.id,
        institutionId: submissionPackage.institutionId,
        reviewCycleId: submissionPackage.reviewCycleId,
        scopeType: submissionPackage.scopeType,
        scopeId: submissionPackage.scopeId,
        status: submissionPackage.status,
        name: submissionPackage.name,
      },
      sectionContext,
    };
  }

  async #requireNarrative(narrativeId) {
    if (!narrativeId) {
      throw new ValidationError('narrativeId is required');
    }
    const narrative = await this.narratives.getById(narrativeId);
    if (!narrative) {
      throw new NotFoundError('Narrative', narrativeId);
    }
    return narrative;
  }

  async #requireSubmissionPackage(submissionPackageId) {
    if (!submissionPackageId) {
      throw new ValidationError('submissionPackageId is required');
    }
    const submissionPackage = await this.submissionPackages.getById(submissionPackageId);
    if (!submissionPackage) {
      throw new NotFoundError('SubmissionPackage', submissionPackageId);
    }
    return submissionPackage;
  }

  async #assertNarrativeSectionEvidenceLinkValid(narrative, section, evidenceItemId) {
    const readiness = await this.evidenceReadiness.evaluateWorkflowEvidenceReadiness({
      institutionId: narrative.institutionId,
      reviewCycleId: narrative.reviewCycleId,
      targetType: section.sectionType,
      targetId: section.sectionKey,
      reportSectionId: section.sectionType === narrativeSectionType.REPORT_SECTION ? section.sectionKey : null,
      evidenceItemIds: [evidenceItemId],
      readinessPolicy: {
        requiredReadinessLevel: 'present',
        requireAnyEvidenceForDecision: false,
        requireCurrentReferencedEvidence: false,
        requireCollectionScopedUsableEvidence: false,
        minimumReferencedUsableEvidenceCount: 0,
        minimumCollectionUsableEvidenceCount: 0,
      },
    });

    if (readiness.missingEvidenceItemIds.length > 0) {
      throw new ValidationError(
        `NarrativeSection evidence link references missing evidence: ${readiness.missingEvidenceItemIds.join(', ')}`,
      );
    }
    if (readiness.outOfInstitutionScopeEvidenceItemIds.length > 0) {
      throw new ValidationError(
        `NarrativeSection evidence link references out-of-scope evidence: ${readiness.outOfInstitutionScopeEvidenceItemIds.join(', ')}`,
      );
    }
  }

  #assertSectionPackageLinkSemantics(section, packageItem, linkType) {
    if (
      linkType === narrativePackageLinkType.INCLUDED_ITEM &&
      packageItem.assemblyRole === submissionPackageItemAssemblyRole.GOVERNED_SECTION
    ) {
      throw new ValidationError('NarrativeSection included-item links cannot target governed-section package items');
    }

    if (
      linkType === narrativePackageLinkType.GOVERNING_SECTION &&
      packageItem.assemblyRole !== submissionPackageItemAssemblyRole.GOVERNED_SECTION
    ) {
      throw new ValidationError('NarrativeSection governing-section links require a governed-section package item');
    }

    if (
      linkType === narrativePackageLinkType.GOVERNING_SECTION &&
      section.sectionType !== packageItem.targetType
    ) {
      throw new ValidationError('NarrativeSection governing-section links require matching section and package target types');
    }

    if (
      linkType === narrativePackageLinkType.GOVERNING_SECTION &&
      section.sectionKey !== packageItem.sectionKey
    ) {
      throw new ValidationError('NarrativeSection governing-section links require matching sectionKey alignment');
    }
  }
}
