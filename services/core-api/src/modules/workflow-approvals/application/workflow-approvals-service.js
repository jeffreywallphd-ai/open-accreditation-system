import { NotFoundError, ValidationError } from '../../shared/kernel/errors.js';
import { ReviewCycle } from '../domain/entities/review-cycle.js';
import { ReviewWorkflow } from '../domain/entities/review-workflow.js';
import { reviewCycleStatus } from '../domain/value-objects/workflow-statuses.js';

export class WorkflowApprovalsService {
  constructor(deps) {
    this.cycles = deps.cycles;
    this.workflows = deps.workflows;
    this.institutions = deps.institutions;
    this.evidenceManagement = deps.evidenceManagement;
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
    await this.#assertEvidenceReferencesBelongToWorkflowInstitution(workflow);
    return this.workflows.save(workflow);
  }

  async transitionWorkflowState(workflowId, nextState, actorRole, options = {}) {
    const workflow = await this.#requireWorkflow(workflowId);
    const cycle = await this.#requireReviewCycle(workflow.reviewCycleId);
    if (cycle.status !== reviewCycleStatus.ACTIVE) {
      throw new ValidationError('Workflow transitions require ReviewCycle status=active');
    }

    const evidenceSummary = await this.#evaluateWorkflowEvidence(workflow);
    workflow.transitionTo(nextState, actorRole, {
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

  async #assertEvidenceReferencesBelongToWorkflowInstitution(workflow) {
    if (!this.evidenceManagement || workflow.evidenceItemIds.length === 0) {
      return;
    }
    for (const evidenceItemId of workflow.evidenceItemIds) {
      const evidenceItem = await this.evidenceManagement.getEvidenceItemById(evidenceItemId);
      if (!evidenceItem) {
        throw new ValidationError(`Referenced evidence item not found: ${evidenceItemId}`);
      }
      if (evidenceItem.institutionId !== workflow.institutionId) {
        throw new ValidationError(`Evidence item ${evidenceItemId} must belong to workflow institution`);
      }
    }
  }

  async #evaluateWorkflowEvidence(workflow) {
    if (!this.evidenceManagement || workflow.evidenceItemIds.length === 0) {
      return {
        requiredCount: workflow.evidenceItemIds.length,
        foundCount: workflow.evidenceItemIds.length,
        missingEvidenceItemIds: [],
        incompleteEvidenceItemIds: [],
        inactiveEvidenceItemIds: [],
        unusableEvidenceItemIds: [],
        isSufficient: true,
      };
    }

    const missingEvidenceItemIds = [];
    const incompleteEvidenceItemIds = [];
    const inactiveEvidenceItemIds = [];
    const unusableEvidenceItemIds = [];

    for (const evidenceItemId of workflow.evidenceItemIds) {
      const evidenceItem = await this.evidenceManagement.getEvidenceItemById(evidenceItemId);
      if (!evidenceItem) {
        missingEvidenceItemIds.push(evidenceItemId);
        continue;
      }
      if (evidenceItem.isComplete !== true) {
        incompleteEvidenceItemIds.push(evidenceItemId);
      }
      if (evidenceItem.status !== 'active') {
        inactiveEvidenceItemIds.push(evidenceItemId);
      }
      if (evidenceItem.usability?.isUsable !== true) {
        unusableEvidenceItemIds.push(evidenceItemId);
      }
    }

    return {
      requiredCount: workflow.evidenceItemIds.length,
      foundCount: workflow.evidenceItemIds.length - missingEvidenceItemIds.length,
      missingEvidenceItemIds,
      incompleteEvidenceItemIds,
      inactiveEvidenceItemIds,
      unusableEvidenceItemIds,
      isSufficient:
        missingEvidenceItemIds.length === 0 &&
        incompleteEvidenceItemIds.length === 0 &&
        inactiveEvidenceItemIds.length === 0 &&
        unusableEvidenceItemIds.length === 0,
    };
  }
}

