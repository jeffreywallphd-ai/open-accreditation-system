import { NotFoundError, ValidationError } from '../../shared/kernel/errors.js';
import { ReviewCycle } from '../domain/entities/review-cycle.js';
import { ReviewWorkflow } from '../domain/entities/review-workflow.js';
import { buildEvidenceReadinessPolicyForTransition } from '../domain/policies/workflow-evidence-readiness-policy.js';
import { reviewCycleStatus, reviewWorkflowState } from '../domain/value-objects/workflow-statuses.js';

export class WorkflowApprovalsService {
  constructor(deps) {
    this.cycles = deps.cycles;
    this.workflows = deps.workflows;
    this.institutions = deps.institutions;
    this.evidenceReadiness = deps.evidenceReadiness;
  }

  async createReviewCycle(input) {
    await this.#requireInstitution(input.institutionId);
    const cycle = ReviewCycle.create({
      ...input,
      status: input.status ?? reviewCycleStatus.NOT_STARTED,
    });
    if (cycle.status === reviewCycleStatus.ACTIVE) {
      await this.#assertNoOtherActiveCycleInScope(cycle, null);
    }
    return this.cycles.save(cycle);
  }

  async startReviewCycle(cycleId) {
    const cycle = await this.#requireReviewCycle(cycleId);
    await this.#assertNoOtherActiveCycleInScope(cycle, cycle.id);
    cycle.start();
    return this.cycles.save(cycle);
  }

  async completeReviewCycle(cycleId) {
    const cycle = await this.#requireReviewCycle(cycleId);
    cycle.complete();
    return this.cycles.save(cycle);
  }

  async archiveReviewCycle(cycleId) {
    const cycle = await this.#requireReviewCycle(cycleId);
    cycle.archive();
    return this.cycles.save(cycle);
  }

  async createWorkflowInstance(input) {
    const cycle = await this.#requireReviewCycle(input.reviewCycleId);
    if (cycle.status !== reviewCycleStatus.ACTIVE) {
      throw new ValidationError('ReviewWorkflow can only be created for an active ReviewCycle');
    }

    const workflow = ReviewWorkflow.create({
      ...input,
      institutionId: cycle.institutionId,
      reviewCycleId: cycle.id,
    });
    await this.#assertNoExistingWorkflowForCycleTarget(workflow.reviewCycleId, workflow.targetType, workflow.targetId);
    this.#assertEvidenceCollectionReference(workflow, cycle);
    await this.#assertEvidenceReferencesBelongToWorkflowInstitution(workflow, cycle);
    return this.workflows.save(workflow);
  }

  async transitionWorkflowState(workflowId, nextState, actorRole, options = {}) {
    const workflow = await this.#requireWorkflow(workflowId);
    const cycle = await this.#requireReviewCycle(workflow.reviewCycleId);
    if (cycle.status !== reviewCycleStatus.ACTIVE) {
      throw new ValidationError('Workflow transitions require ReviewCycle status=active');
    }

    const evidenceSummary = await this.#evaluateWorkflowEvidence(workflow, nextState);
    this.#applyWorkflowTransition(workflow, nextState, actorRole, {
      reason: options.reason,
      evidenceSummary,
    });
    return this.workflows.save(workflow);
  }

  async getReviewCycleById(id) {
    return this.cycles.getById(id);
  }

  async listReviewCycles(filter = {}) {
    return this.cycles.findByFilter(filter);
  }

  async getReviewWorkflowById(id) {
    return this.workflows.getById(id);
  }

  async listReviewWorkflows(filter = {}) {
    return this.workflows.findByFilter(filter);
  }

  async getWorkflowStateForCycle(reviewCycleId) {
    await this.#requireReviewCycle(reviewCycleId);
    return this.workflows.findByFilter({ reviewCycleId });
  }

  async getWorkflowStateForCycleTarget(reviewCycleId, targetType, targetId) {
    await this.#requireReviewCycle(reviewCycleId);
    if (!targetType || !targetId) {
      throw new ValidationError('targetType and targetId are required');
    }
    return this.workflows.getByCycleAndTarget(reviewCycleId, targetType, targetId);
  }

  async getWorkflowState(reviewCycleId, targetType, targetId) {
    if (targetType && targetId) {
      return this.getWorkflowStateForCycleTarget(reviewCycleId, targetType, targetId);
    }
    return this.getWorkflowStateForCycle(reviewCycleId);
  }

  async #requireInstitution(institutionId) {
    if (!institutionId) {
      throw new ValidationError('institutionId is required');
    }
    const institution = await this.institutions.getById(institutionId);
    if (!institution) {
      throw new ValidationError(`Institution not found: ${institutionId}`);
    }
  }

  async #requireReviewCycle(cycleId) {
    if (!cycleId) {
      throw new ValidationError('reviewCycleId is required');
    }
    const cycle = await this.cycles.getById(cycleId);
    if (!cycle) {
      throw new NotFoundError('ReviewCycle', cycleId);
    }
    return cycle;
  }

  async #requireWorkflow(workflowId) {
    if (!workflowId) {
      throw new ValidationError('reviewWorkflowId is required');
    }
    const workflow = await this.workflows.getById(workflowId);
    if (!workflow) {
      throw new NotFoundError('ReviewWorkflow', workflowId);
    }
    return workflow;
  }

  async #assertNoOtherActiveCycleInScope(cycle, excludeCycleId) {
    const activeCycle = await this.cycles.getActiveByScope(cycle.institutionId, cycle.scopeKey);
    if (activeCycle && activeCycle.id !== excludeCycleId) {
      throw new ValidationError(
        `Only one active ReviewCycle is allowed per scope (existing active cycle: ${activeCycle.id})`,
      );
    }
  }

  #assertEvidenceCollectionReference(workflow, cycle) {
    if (!workflow.evidenceCollectionId) {
      return;
    }
    if (!cycle.evidenceSetIds.includes(workflow.evidenceCollectionId)) {
      throw new ValidationError(
        `ReviewWorkflow evidenceCollectionId must be declared on ReviewCycle.evidenceSetIds: ${workflow.evidenceCollectionId}`,
      );
    }
  }

  async #assertEvidenceReferencesBelongToWorkflowInstitution(workflow, cycle) {
    if (!this.evidenceReadiness || workflow.evidenceItemIds.length === 0) {
      return;
    }
    const summary = await this.evidenceReadiness.evaluateWorkflowEvidenceReadiness({
      institutionId: workflow.institutionId,
      reviewCycleId: cycle.id,
      evidenceCollectionId: workflow.evidenceCollectionId,
      targetType: workflow.targetType,
      targetId: workflow.targetId,
      reportSectionId: workflow.reportSectionId,
      evidenceItemIds: workflow.evidenceItemIds,
      readinessPolicy: {
        requiredReadinessLevel: 'present',
        requireAnyEvidenceForDecision: false,
        requireCurrentReferencedEvidence: false,
        minimumReferencedUsableEvidenceCount: 0,
        requireCollectionScopedUsableEvidence: false,
        minimumCollectionUsableEvidenceCount: 0,
      },
    });

    if (summary.missingEvidenceItemIds.length > 0) {
      throw new ValidationError(
        `Referenced evidence item not found: ${summary.missingEvidenceItemIds.join(', ')}`,
      );
    }
    if (summary.outOfInstitutionScopeEvidenceItemIds.length > 0) {
      throw new ValidationError(
        `Referenced evidence item must belong to workflow institution: ${summary.outOfInstitutionScopeEvidenceItemIds.join(', ')}`,
      );
    }
  }

  async #evaluateWorkflowEvidence(workflow, nextState) {
    if (!this.evidenceReadiness) {
      return {
        requiredCount: workflow.evidenceItemIds.length,
        foundCount: workflow.evidenceItemIds.length,
        requiredUsableEvidenceCount: 0,
        usableEvidenceItemCount: workflow.evidenceItemIds.length,
        missingEvidenceItemIds: [],
        outOfInstitutionScopeEvidenceItemIds: [],
        incompleteEvidenceItemIds: [],
        inactiveEvidenceItemIds: [],
        unusableEvidenceItemIds: [],
        nonCurrentEvidenceItemIds: [],
        supersededEvidenceItemIds: [],
        evidenceCollectionId: workflow.evidenceCollectionId ?? null,
        collectionContextStatus: workflow.evidenceCollectionId ? 'not-evaluated' : 'not-applicable',
        collectionUsableEvidenceCount: 0,
        hasAnyEvidence: workflow.evidenceItemIds.length > 0,
        anyEvidenceRequirementSatisfied: true,
        collectionRequirementSatisfied: true,
        referencedEvidenceRequirementSatisfied: true,
        readinessPolicy: {
          requiredReadinessLevel: 'usable',
          requireAnyEvidenceForDecision: false,
          requireCurrentReferencedEvidence: true,
          minimumReferencedUsableEvidenceCount: workflow.evidenceItemIds.length,
          requireCollectionScopedUsableEvidence: false,
          minimumCollectionUsableEvidenceCount: 0,
        },
        isSufficient: true,
      };
    }

    const readinessPolicy = buildEvidenceReadinessPolicyForTransition(workflow.state, nextState, workflow);
    return this.evidenceReadiness.evaluateWorkflowEvidenceReadiness({
      institutionId: workflow.institutionId,
      reviewCycleId: workflow.reviewCycleId,
      evidenceCollectionId: workflow.evidenceCollectionId,
      targetType: workflow.targetType,
      targetId: workflow.targetId,
      reportSectionId: workflow.reportSectionId,
      evidenceItemIds: workflow.evidenceItemIds,
      readinessPolicy,
    });
  }

  async #assertNoExistingWorkflowForCycleTarget(reviewCycleId, targetType, targetId) {
    const existing = await this.workflows.getByCycleAndTarget(reviewCycleId, targetType, targetId);
    if (existing) {
      throw new ValidationError(
        `ReviewWorkflow already exists for cycle-target: cycle=${reviewCycleId} target=${targetType}:${targetId}`,
      );
    }
  }

  #applyWorkflowTransition(workflow, nextState, actorRole, options = {}) {
    switch (nextState) {
      case reviewWorkflowState.IN_REVIEW:
        return workflow.submitForReview(actorRole, options);
      case reviewWorkflowState.REVISION_REQUIRED:
        return workflow.requestRevision(actorRole, options);
      case reviewWorkflowState.DRAFT:
        return workflow.returnToDraft(actorRole, options);
      case reviewWorkflowState.APPROVED:
        return workflow.approve(actorRole, options);
      case reviewWorkflowState.SUBMITTED:
        return workflow.submitFinal(actorRole, options);
      default:
        return workflow.transitionTo(nextState, actorRole, options);
    }
  }
}

