import { NotFoundError, ValidationError } from '../../shared/kernel/errors.js';
import { WorkflowEvidenceReadinessContract } from '../../evidence-management/application/contracts/workflow-evidence-readiness-contract.js';
import { Narrative } from '../domain/entities/narrative.js';
import { SubmissionPackage } from '../domain/entities/submission-package.js';
import {
  narrativePackageLinkType,
  narrativeSectionType,
} from '../domain/value-objects/narrative-statuses.js';
import {
  normalizeSubmissionPackageItemAssemblyRole,
  submissionPackageItemAssemblyRole,
  submissionPackageItemType,
  submissionPackageStatus,
} from '../domain/value-objects/submission-package-statuses.js';

const WORKFLOW_ELIGIBLE_STATES = new Set(['approved', 'submitted']);

function normalizeEvidenceIdsForInput(input = {}) {
  const normalized = [...new Set((input.evidenceItemIds ?? []).filter(Boolean).map((value) => `${value}`.trim()))].filter(
    Boolean,
  );
  normalized.sort((left, right) => left.localeCompare(right));

  if (normalized.length === 0 && input.targetType === 'evidence-item' && input.targetId) {
    return [input.targetId];
  }
  return normalized;
}

function buildAssemblyProjection(submissionPackage, contextByItemId) {
  const orderedItems = submissionPackage.items.map((item) => {
    const context = contextByItemId.get(item.id) ?? { workflowState: null, evidenceSummary: null };
    return {
      itemId: item.id,
      sequence: item.sequence,
      assemblyRole: item.assemblyRole,
      itemType: item.itemType,
      targetType: item.targetType,
      targetId: item.targetId,
      workflowId: item.workflowId,
      workflowState: context.workflowState,
      sectionKey: item.sectionKey,
      sectionTitle: item.sectionTitle,
      parentSectionKey: item.parentSectionKey,
      sectionType: item.sectionType,
      evidenceItemIds: [...item.evidenceItemIds],
      evidenceSummary: context.evidenceSummary,
      label: item.label,
      rationale: item.rationale,
      metadata: item.metadata,
    };
  });

  const sectionsByKey = new Map();
  for (const item of orderedItems) {
    if (item.assemblyRole !== submissionPackageItemAssemblyRole.GOVERNED_SECTION) {
      continue;
    }
    sectionsByKey.set(item.sectionKey, {
      ...item,
      includedItemIds: [],
      childSectionKeys: [],
    });
  }

  for (const item of orderedItems) {
    if (item.assemblyRole === submissionPackageItemAssemblyRole.GOVERNED_SECTION || !item.sectionKey) {
      continue;
    }
    const section = sectionsByKey.get(item.sectionKey);
    if (section) {
      section.includedItemIds.push(item.itemId);
    }
  }

  for (const section of sectionsByKey.values()) {
    if (!section.parentSectionKey) {
      continue;
    }
    const parent = sectionsByKey.get(section.parentSectionKey);
    if (parent) {
      parent.childSectionKeys.push(section.sectionKey);
    }
  }

  const sections = [...sectionsByKey.values()];
  const rootSectionKeys = sections
    .filter((section) => !section.parentSectionKey)
    .map((section) => section.sectionKey);

  const buildSectionTree = (sectionKey) => {
    const section = sectionsByKey.get(sectionKey);
    if (!section) {
      return null;
    }
    return {
      sectionKey: section.sectionKey,
      sectionTitle: section.sectionTitle,
      sectionType: section.sectionType,
      itemId: section.itemId,
      sequence: section.sequence,
      parentSectionKey: section.parentSectionKey,
      includedItemIds: [...section.includedItemIds],
      childSections: section.childSectionKeys.map(buildSectionTree).filter(Boolean),
    };
  };

  return {
    orderedItems,
    sections,
    rootSectionKeys,
    sectionTree: rootSectionKeys.map(buildSectionTree).filter(Boolean),
    assemblyRoleCounts: {
      governedSection: orderedItems.filter((item) => item.assemblyRole === submissionPackageItemAssemblyRole.GOVERNED_SECTION)
        .length,
      workflowTarget: orderedItems.filter((item) => item.assemblyRole === submissionPackageItemAssemblyRole.WORKFLOW_TARGET)
        .length,
      evidenceInclusion: orderedItems.filter((item) => item.assemblyRole === submissionPackageItemAssemblyRole.EVIDENCE_INCLUSION)
        .length,
    },
    unsectionedItemIds: orderedItems
      .filter((item) => item.assemblyRole !== submissionPackageItemAssemblyRole.GOVERNED_SECTION && !item.sectionKey)
      .map((item) => item.itemId),
  };
}

export class NarrativesReportingService {
  constructor(deps) {
    this.submissionPackages = deps.submissionPackages;
    this.narratives = deps.narratives;
    this.reviewCycles = deps.reviewCycles;
    this.workflowTargets = deps.workflowTargets;
    this.evidenceReadiness = deps.evidenceReadiness;

    if (!this.submissionPackages || typeof this.submissionPackages.save !== 'function') {
      throw new ValidationError('NarrativesReportingService requires submissionPackages repository');
    }
    if (!this.narratives || typeof this.narratives.save !== 'function') {
      throw new ValidationError('NarrativesReportingService requires narratives repository');
    }
    if (!this.reviewCycles || typeof this.reviewCycles.getReviewCycleById !== 'function') {
      throw new ValidationError('NarrativesReportingService requires reviewCycles contract');
    }
    if (!this.workflowTargets || typeof this.workflowTargets.getWorkflowStateForCycleTarget !== 'function') {
      throw new ValidationError('NarrativesReportingService requires workflowTargets contract');
    }
    if (!(this.evidenceReadiness instanceof WorkflowEvidenceReadinessContract)) {
      throw new ValidationError('NarrativesReportingService requires WorkflowEvidenceReadinessContract');
    }
  }

  async createSubmissionPackage(input) {
    const reviewCycle = await this.#requireReviewCycle(input.reviewCycleId);
    const existing = await this.submissionPackages.getByCycleAndScope(
      reviewCycle.id,
      input.scopeType,
      input.scopeId,
    );
    if (existing) {
      throw new ValidationError(
        `SubmissionPackage already exists for reviewCycle+scope: ${reviewCycle.id} ${input.scopeType}:${input.scopeId}`,
      );
    }

    const submissionPackage = SubmissionPackage.create({
      ...input,
      institutionId: reviewCycle.institutionId,
      reviewCycleId: reviewCycle.id,
      status: submissionPackageStatus.DRAFT,
    });

    return this.submissionPackages.save(submissionPackage);
  }

  async addSubmissionPackageItem(submissionPackageId, input) {
    const submissionPackage = await this.#requireSubmissionPackage(submissionPackageId);
    const assemblyRole = normalizeSubmissionPackageItemAssemblyRole(input);
    const evidenceItemIds = normalizeEvidenceIdsForInput(input);

    if (this.#requiresWorkflowEligibility(assemblyRole, input.targetType)) {
      const workflow = await this.#requireEligibleWorkflowTarget(submissionPackage, input);
      input = {
        ...input,
        workflowId: input.workflowId ?? workflow.id,
      };
    }

    if (evidenceItemIds.length > 0) {
      await this.#assertEvidenceReferencesValid(
        submissionPackage,
        {
          targetType: input.targetType,
          targetId: input.targetId,
          evidenceItemIds,
        },
        {
          requiredReadinessLevel: 'present',
          requireCurrentReferencedEvidence: false,
          requireAnyEvidenceForDecision: false,
        },
      );
    }

    submissionPackage.addItem({
      ...input,
      evidenceItemIds,
      assemblyRole,
      itemType: input.itemType ?? submissionPackageItemType.WORKFLOW_TARGET,
    });

    return this.submissionPackages.save(submissionPackage);
  }

  async removeSubmissionPackageItem(submissionPackageId, itemId) {
    const submissionPackage = await this.#requireSubmissionPackage(submissionPackageId);
    submissionPackage.removeItem(itemId);
    return this.submissionPackages.save(submissionPackage);
  }

  async reorderSubmissionPackageItem(submissionPackageId, itemId, newPosition) {
    const submissionPackage = await this.#requireSubmissionPackage(submissionPackageId);
    submissionPackage.reorderItem(itemId, newPosition);
    return this.submissionPackages.save(submissionPackage);
  }

  async snapshotSubmissionPackage(submissionPackageId, options = {}) {
    const submissionPackage = await this.#requireSubmissionPackage(submissionPackageId);

    for (const item of submissionPackage.items) {
      if (this.#requiresWorkflowEligibility(item.assemblyRole, item.targetType)) {
        await this.#requireEligibleWorkflowTarget(submissionPackage, {
          targetType: item.targetType,
          targetId: item.targetId,
        });
      }

      if (item.evidenceItemIds.length > 0) {
        await this.#assertEvidenceReferencesValid(
          submissionPackage,
          {
            targetType: item.targetType,
            targetId: item.targetId,
            evidenceItemIds: item.evidenceItemIds,
          },
          {
            requiredReadinessLevel: options.finalize === true ? 'usable' : 'present',
            requireCurrentReferencedEvidence: options.finalize === true,
            requireAnyEvidenceForDecision: options.finalize === true,
            minimumReferencedUsableEvidenceCount: options.finalize === true ? item.evidenceItemIds.length : 0,
          },
        );
      }
    }

    const snapshot = options.finalize === true
      ? submissionPackage.finalize(options)
      : submissionPackage.captureSnapshot({
        milestoneLabel: options.milestoneLabel,
        actorId: options.actorId,
        notes: options.notes,
      });

    await this.submissionPackages.save(submissionPackage);
    return snapshot;
  }

  async getSubmissionPackageById(id) {
    return this.submissionPackages.getById(id);
  }

  async listSubmissionPackages(filter = {}) {
    return this.submissionPackages.findByFilter(filter);
  }

  async getSubmissionPackageWithItemContext(id) {
    const submissionPackage = await this.#requireSubmissionPackage(id);
    const itemContext = [];

    for (const item of submissionPackage.items) {
      let workflow = null;
      if (this.#requiresWorkflowEligibility(item.assemblyRole, item.targetType) || item.workflowId) {
        workflow = await this.workflowTargets.getWorkflowStateForCycleTarget(
          submissionPackage.reviewCycleId,
          item.targetType,
          item.targetId,
        );
      }
      let evidenceSummary = null;
      if (item.evidenceItemIds.length > 0) {
        evidenceSummary = await this.evidenceReadiness.evaluateWorkflowEvidenceReadiness({
          institutionId: submissionPackage.institutionId,
          reviewCycleId: submissionPackage.reviewCycleId,
          targetType: item.targetType,
          targetId: item.targetId,
          reportSectionId: this.#resolveReportSectionId(item.targetType, item.targetId),
          evidenceItemIds: item.evidenceItemIds,
          readinessPolicy: {
            requiredReadinessLevel: 'present',
            requireAnyEvidenceForDecision: false,
            requireCurrentReferencedEvidence: false,
            requireCollectionScopedUsableEvidence: false,
            minimumReferencedUsableEvidenceCount: 0,
            minimumCollectionUsableEvidenceCount: 0,
          },
        });
      }
      itemContext.push({
        itemId: item.id,
        targetType: item.targetType,
        targetId: item.targetId,
        assemblyRole: item.assemblyRole,
        sectionKey: item.sectionKey,
        workflowState: workflow?.state ?? null,
        evidenceSummary,
      });
    }

    const contextByItemId = new Map(itemContext.map((entry) => [entry.itemId, entry]));

    return {
      submissionPackage,
      itemContext,
      assembly: buildAssemblyProjection(submissionPackage, contextByItemId),
    };
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

  async #requireReviewCycle(reviewCycleId) {
    if (!reviewCycleId) {
      throw new ValidationError('reviewCycleId is required');
    }
    const reviewCycle = await this.reviewCycles.getReviewCycleById(reviewCycleId);
    if (!reviewCycle) {
      throw new ValidationError(`ReviewCycle not found: ${reviewCycleId}`);
    }
    return reviewCycle;
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

  async #requireEligibleWorkflowTarget(submissionPackage, input) {
    if (!input.targetType || !input.targetId) {
      throw new ValidationError('SubmissionPackageItem targetType and targetId are required');
    }
    const workflow = await this.workflowTargets.getWorkflowStateForCycleTarget(
      submissionPackage.reviewCycleId,
      input.targetType,
      input.targetId,
    );
    if (!workflow) {
      throw new ValidationError(
        `SubmissionPackageItem target must have workflow state for cycle ${submissionPackage.reviewCycleId}: ${input.targetType}:${input.targetId}`,
      );
    }
    if (!WORKFLOW_ELIGIBLE_STATES.has(workflow.state)) {
      throw new ValidationError(
        `SubmissionPackageItem target workflow state must be approved/submitted for assembly: received ${workflow.state}`,
      );
    }
    return workflow;
  }

  async #assertEvidenceReferencesValid(submissionPackage, input, readinessPolicy) {
    const readiness = await this.evidenceReadiness.evaluateWorkflowEvidenceReadiness({
      institutionId: submissionPackage.institutionId,
      reviewCycleId: submissionPackage.reviewCycleId,
      targetType: input.targetType,
      targetId: input.targetId,
      reportSectionId: this.#resolveReportSectionId(input.targetType, input.targetId),
      evidenceItemIds: input.evidenceItemIds ?? [],
      readinessPolicy: {
        requireCollectionScopedUsableEvidence: false,
        minimumCollectionUsableEvidenceCount: 0,
        ...readinessPolicy,
      },
    });

    if (readiness.missingEvidenceItemIds.length > 0) {
      throw new ValidationError(
        `SubmissionPackageItem references missing evidence: ${readiness.missingEvidenceItemIds.join(', ')}`,
      );
    }
    if (readiness.outOfInstitutionScopeEvidenceItemIds.length > 0) {
      throw new ValidationError(
        `SubmissionPackageItem references out-of-scope evidence: ${readiness.outOfInstitutionScopeEvidenceItemIds.join(', ')}`,
      );
    }
    if (readinessPolicy.requiredReadinessLevel === 'usable' && readiness.isSufficient !== true) {
      throw new ValidationError('SubmissionPackage snapshot/finalization requires sufficient referenced evidence readiness');
    }
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
  }

  #requiresWorkflowEligibility(assemblyRole, targetType) {
    if (assemblyRole === submissionPackageItemAssemblyRole.EVIDENCE_INCLUSION && targetType === 'evidence-item') {
      return false;
    }
    return true;
  }

  #resolveReportSectionId(targetType, targetId) {
    if (targetType === 'report-section' || targetType === 'narrative-section') {
      return targetId;
    }
    return null;
  }
}
