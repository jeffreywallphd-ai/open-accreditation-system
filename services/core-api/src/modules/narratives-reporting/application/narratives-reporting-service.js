import { NotFoundError, ValidationError } from '../../shared/kernel/errors.js';
import { WorkflowEvidenceReadinessContract } from '../../evidence-management/application/contracts/workflow-evidence-readiness-contract.js';
import { SubmissionPackage } from '../domain/entities/submission-package.js';
import { submissionPackageItemType, submissionPackageStatus } from '../domain/value-objects/submission-package-statuses.js';

const WORKFLOW_ELIGIBLE_STATES = new Set(['approved', 'submitted']);

export class NarrativesReportingService {
  constructor(deps) {
    this.submissionPackages = deps.submissionPackages;
    this.reviewCycles = deps.reviewCycles;
    this.workflowTargets = deps.workflowTargets;
    this.evidenceReadiness = deps.evidenceReadiness;

    if (!this.submissionPackages || typeof this.submissionPackages.save !== 'function') {
      throw new ValidationError('NarrativesReportingService requires submissionPackages repository');
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
    const workflow = await this.#requireEligibleWorkflowTarget(submissionPackage, input);

    if ((input.evidenceItemIds ?? []).length > 0) {
      await this.#assertEvidenceReferencesValid(submissionPackage, input, {
        requiredReadinessLevel: 'present',
        requireCurrentReferencedEvidence: false,
        requireAnyEvidenceForDecision: false,
      });
    }

    submissionPackage.addItem({
      ...input,
      itemType: input.itemType ?? submissionPackageItemType.WORKFLOW_TARGET,
      workflowId: input.workflowId ?? workflow.id,
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
      await this.#requireEligibleWorkflowTarget(submissionPackage, {
        targetType: item.targetType,
        targetId: item.targetId,
      });

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
      const workflow = await this.workflowTargets.getWorkflowStateForCycleTarget(
        submissionPackage.reviewCycleId,
        item.targetType,
        item.targetId,
      );
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
        workflowState: workflow?.state ?? null,
        evidenceSummary,
      });
    }

    return {
      submissionPackage,
      itemContext,
    };
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

  #resolveReportSectionId(targetType, targetId) {
    if (targetType === 'report-section' || targetType === 'narrative-section') {
      return targetId;
    }
    return null;
  }
}
