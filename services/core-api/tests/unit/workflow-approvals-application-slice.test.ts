import assert from 'node:assert/strict';
import { WorkflowApprovalsService } from '../../src/modules/workflow-approvals/application/workflow-approvals-service.js';
import {
  CreateReviewCycleCommand,
  CreateReviewWorkflowCommand,
  StartReviewCycleCommand,
  TransitionReviewWorkflowStateCommand,
} from '../../src/modules/workflow-approvals/application/commands/workflow-approvals-commands.js';
import { GetWorkflowStateForCycleQuery } from '../../src/modules/workflow-approvals/application/queries/workflow-approvals-queries.js';
import {
  InMemoryReviewCycleRepository,
  InMemoryReviewWorkflowRepository,
} from '../../src/modules/workflow-approvals/infrastructure/persistence/in-memory-workflow-approvals-repositories.js';
import { InMemoryInstitutionRepository } from '../../src/modules/organization-registry/infrastructure/persistence/in-memory-organization-registry-repositories.js';
import { Institution } from '../../src/modules/organization-registry/domain/entities/institution.js';
import { ValidationError } from '../../src/modules/shared/kernel/errors.js';
import {
  reviewWorkflowState,
  workflowActorRole,
} from '../../src/modules/workflow-approvals/domain/value-objects/workflow-statuses.js';

export async function runTests(): Promise<void> {
  const cycles = new InMemoryReviewCycleRepository();
  const workflows = new InMemoryReviewWorkflowRepository();
  const institutions = new InMemoryInstitutionRepository();

  const institution = Institution.create({
    id: 'inst_workflow_application',
    name: 'Workflow Application University',
    code: 'WAU',
  });
  await institutions.save(institution);

  const evidenceById = new Map<string, any>([
    [
      'ev_1',
      {
        id: 'ev_1',
        institutionId: institution.id,
        isComplete: false,
        status: 'draft',
        usability: { isUsable: false },
      },
    ],
  ]);

  const service = new WorkflowApprovalsService({
    cycles,
    workflows,
    institutions,
    evidenceManagement: {
      async getEvidenceItemById(id: string) {
        return evidenceById.get(id) ?? null;
      },
    },
  });

  const createReviewCycle = new CreateReviewCycleCommand(service);
  const startReviewCycle = new StartReviewCycleCommand(service);
  const createReviewWorkflow = new CreateReviewWorkflowCommand(service);
  const transitionReviewWorkflowState = new TransitionReviewWorkflowStateCommand(service);
  const getWorkflowStateForCycle = new GetWorkflowStateForCycleQuery(service);

  const cycle = await createReviewCycle.execute({
    institutionId: institution.id,
    name: '2026 Workflow Cycle',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    programIds: ['program_1'],
    organizationUnitIds: ['org_1'],
    evidenceSetIds: ['collection_1'],
  });
  await startReviewCycle.execute(cycle.id);

  const duplicateScopeCycle = await createReviewCycle.execute({
    institutionId: institution.id,
    name: 'Duplicate Scope Cycle',
    startDate: '2027-01-01',
    endDate: '2027-12-31',
    programIds: ['program_1'],
    organizationUnitIds: ['org_1'],
  });
  await assert.rejects(
    () => startReviewCycle.execute(duplicateScopeCycle.id),
    ValidationError,
    'only one active cycle per scope should be enforced',
  );

  const inactiveCycle = await createReviewCycle.execute({
    institutionId: institution.id,
    name: 'Not Started Cycle',
    startDate: '2028-01-01',
    endDate: '2028-12-31',
    programIds: ['program_2'],
  });
  await assert.rejects(
    () =>
      createReviewWorkflow.execute({
        reviewCycleId: inactiveCycle.id,
        targetType: 'report-section',
        targetId: 'section_1_1',
      }),
    ValidationError,
    'workflow creation should require active cycle',
  );

  const workflow = await createReviewWorkflow.execute({
    reviewCycleId: cycle.id,
    targetType: 'report-section',
    targetId: 'section_2_1',
    reportSectionId: 'section_2_1',
    evidenceItemIds: ['ev_1'],
  });
  assert.equal(workflow.state, reviewWorkflowState.DRAFT);

  await transitionReviewWorkflowState.execute(
    workflow.id,
    reviewWorkflowState.IN_REVIEW,
    workflowActorRole.FACULTY,
    {
      reason: 'Submitted for review',
    },
  );

  await assert.rejects(
    () =>
      transitionReviewWorkflowState.execute(
        workflow.id,
        reviewWorkflowState.APPROVED,
        workflowActorRole.FACULTY,
      ),
    ValidationError,
    'application transitions should still enforce role rules via domain',
  );

  await assert.rejects(
    () =>
      transitionReviewWorkflowState.execute(
        workflow.id,
        reviewWorkflowState.APPROVED,
        workflowActorRole.REVIEWER,
      ),
    ValidationError,
    'approval should fail while referenced evidence is incomplete/inactive',
  );

  evidenceById.set('ev_1', {
    id: 'ev_1',
    institutionId: institution.id,
    isComplete: true,
    status: 'active',
    usability: { isUsable: true },
  });

  const approved = await transitionReviewWorkflowState.execute(
    workflow.id,
    reviewWorkflowState.APPROVED,
    workflowActorRole.REVIEWER,
  );
  assert.equal(approved.state, reviewWorkflowState.APPROVED);
  assert.equal(approved.transitionHistory.length, 2);

  await assert.rejects(
    () =>
      transitionReviewWorkflowState.execute(
        workflow.id,
        reviewWorkflowState.SUBMITTED,
        workflowActorRole.REVIEWER,
      ),
    ValidationError,
    'submitted state should remain admin-only',
  );

  await transitionReviewWorkflowState.execute(
    workflow.id,
    reviewWorkflowState.SUBMITTED,
    workflowActorRole.ADMIN,
  );

  const cycleWorkflows = await getWorkflowStateForCycle.execute(cycle.id);
  assert.equal(cycleWorkflows.length, 1);
  assert.equal(cycleWorkflows[0].state, reviewWorkflowState.SUBMITTED);
}

