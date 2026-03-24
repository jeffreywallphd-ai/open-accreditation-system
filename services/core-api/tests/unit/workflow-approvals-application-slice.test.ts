import assert from 'node:assert/strict';
import { EvidenceManagementService } from '../../src/modules/evidence-management/application/evidence-management-service.js';
import { WorkflowEvidenceReadinessService } from '../../src/modules/evidence-management/application/workflow-evidence-readiness-service.js';
import { InMemoryEvidenceItemRepository } from '../../src/modules/evidence-management/infrastructure/persistence/in-memory-evidence-management-repositories.js';
import {
  evidenceReferenceRelationshipType,
  evidenceReferenceTargetType,
  evidenceSourceType,
  evidenceType,
} from '../../src/modules/evidence-management/domain/value-objects/evidence-classifications.js';
import { WorkflowApprovalsService } from '../../src/modules/workflow-approvals/application/workflow-approvals-service.js';
import {
  CompleteReviewCycleCommand,
  CreateReviewCycleCommand,
  CreateReviewWorkflowCommand,
  StartReviewCycleCommand,
  TransitionReviewWorkflowStateCommand,
} from '../../src/modules/workflow-approvals/application/commands/workflow-approvals-commands.js';
import {
  GetWorkflowStateQuery,
  GetWorkflowStateForCycleQuery,
  GetWorkflowStateForCycleTargetQuery,
} from '../../src/modules/workflow-approvals/application/queries/workflow-approvals-queries.js';
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
  const evidenceItems = new InMemoryEvidenceItemRepository();

  const institution = Institution.create({
    id: 'inst_workflow_application',
    name: 'Workflow Application University',
    code: 'WAU',
  });
  await institutions.save(institution);

  const evidenceManagement = new EvidenceManagementService({
    institutions,
    evidenceItems,
    accreditationFrameworks: {},
    curriculumMapping: {},
  });
  const evidenceReadiness = new WorkflowEvidenceReadinessService({
    evidenceManagement,
  });

  assert.throws(
    () =>
      new WorkflowApprovalsService({
        cycles,
        workflows,
        institutions,
      } as any),
    ValidationError,
    'workflow application service should require evidence readiness contract',
  );

  const service = new WorkflowApprovalsService({
    cycles,
    workflows,
    institutions,
    evidenceReadiness,
  });

  const createReviewCycle = new CreateReviewCycleCommand(service);
  const startReviewCycle = new StartReviewCycleCommand(service);
  const completeReviewCycle = new CompleteReviewCycleCommand(service);
  const createReviewWorkflow = new CreateReviewWorkflowCommand(service);
  const transitionReviewWorkflowState = new TransitionReviewWorkflowStateCommand(service);
  const getWorkflowState = new GetWorkflowStateQuery(service);
  const getWorkflowStateForCycle = new GetWorkflowStateForCycleQuery(service);
  const getWorkflowStateForCycleTarget = new GetWorkflowStateForCycleTargetQuery(service);

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

  const draftEvidence = await evidenceManagement.createEvidenceItem({
    id: 'ev_1',
    institutionId: institution.id,
    title: 'Cycle Evidence 1',
    description: 'Initial evidence package',
    reviewCycleId: cycle.id,
    evidenceSetIds: ['collection_1'],
    evidenceType: evidenceType.NARRATIVE,
    sourceType: evidenceSourceType.MANUAL,
  });

  const orphanCollectionCycle = await createReviewCycle.execute({
    institutionId: institution.id,
    name: '2026 Orphan Collection Cycle',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    programIds: ['program_3'],
    evidenceSetIds: [],
  });
  await startReviewCycle.execute(orphanCollectionCycle.id);

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

  await assert.rejects(
    () =>
      createReviewWorkflow.execute({
        reviewCycleId: cycle.id,
        targetType: 'report-section',
        targetId: 'section_missing_evidence',
        evidenceItemIds: ['ev_missing'],
      }),
    ValidationError,
    'workflow creation should reject missing evidence references',
  );

  await assert.rejects(
    () =>
      createReviewWorkflow.execute({
        reviewCycleId: orphanCollectionCycle.id,
        targetType: 'report-section',
        targetId: 'section_orphan_collection',
        evidenceCollectionId: 'collection_missing',
      }),
    ValidationError,
    'workflow creation should reject evidenceCollectionId not declared by the ReviewCycle',
  );

  const evidenceFreeWorkflow = await createReviewWorkflow.execute({
    reviewCycleId: cycle.id,
    targetType: 'report-section',
    targetId: 'section_evidence_free',
    reportSectionId: 'section_evidence_free',
    evidenceItemIds: [],
  });
  await transitionReviewWorkflowState.execute(
    evidenceFreeWorkflow.id,
    reviewWorkflowState.IN_REVIEW,
    workflowActorRole.FACULTY,
  );
  await assert.rejects(
    () =>
      transitionReviewWorkflowState.execute(
        evidenceFreeWorkflow.id,
        reviewWorkflowState.APPROVED,
        workflowActorRole.REVIEWER,
      ),
    ValidationError,
    'approval should fail when no evidence is provided for governed decision transitions',
  );

  const workflow = await createReviewWorkflow.execute({
    reviewCycleId: cycle.id,
    targetType: 'report-section',
    targetId: 'section_2_1',
    reportSectionId: 'section_2_1',
    evidenceCollectionId: 'collection_1',
    evidenceItemIds: ['ev_1'],
  });
  assert.equal(workflow.state, reviewWorkflowState.DRAFT);

  await assert.rejects(
    () =>
      createReviewWorkflow.execute({
        reviewCycleId: cycle.id,
        targetType: 'report-section',
        targetId: 'section_2_1',
      }),
    ValidationError,
    'workflow cycle-target tuple should be unique',
  );

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

  await evidenceManagement.markEvidenceComplete(draftEvidence.id);
  await evidenceManagement.activateEvidenceItem(draftEvidence.id);

  const approved = await transitionReviewWorkflowState.execute(
    workflow.id,
    reviewWorkflowState.APPROVED,
    workflowActorRole.REVIEWER,
  );
  assert.equal(approved.state, reviewWorkflowState.APPROVED);
  assert.equal(approved.transitionHistory.length, 2);
  assert.equal(approved.transitionHistory[1].evidenceSummary.collectionRequirementSatisfied, true);

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

  const persistedSubmittedWorkflow = await workflows.getById(workflow.id);
  assert.ok(persistedSubmittedWorkflow);
  persistedSubmittedWorkflow!.transitionHistory[0].reason = 'tampered reason';
  await assert.rejects(
    () => workflows.save(persistedSubmittedWorkflow!),
    ValidationError,
    'workflow transition history should be append-only at repository boundary',
  );

  const cycleWorkflows = await getWorkflowStateForCycle.execute(cycle.id);
  assert.equal(cycleWorkflows.length, 1);
  assert.equal(cycleWorkflows[0].state, reviewWorkflowState.SUBMITTED);
  assert.equal(cycleWorkflows[0].transitionHistory[2].evidenceSummary.requiredUsableEvidenceCount, 1);
  assert.equal(cycleWorkflows[0].transitionHistory[2].evidenceSummary.isSufficient, true);

  const cycleTargetWorkflow = await getWorkflowStateForCycleTarget.execute(
    cycle.id,
    'report-section',
    'section_2_1',
  );
  assert.ok(cycleTargetWorkflow);
  assert.equal(cycleTargetWorkflow?.id, workflow.id);
  assert.equal(cycleTargetWorkflow?.state, reviewWorkflowState.SUBMITTED);

  const genericCycleWorkflows = await getWorkflowState.execute(cycle.id);
  assert.equal(genericCycleWorkflows.length, 1);

  const genericCycleTargetState = await getWorkflowState.execute(cycle.id, 'report-section', 'section_2_1');
  assert.equal(genericCycleTargetState?.id, workflow.id);

  const supersededPredecessor = await evidenceManagement.createEvidenceItem({
    id: 'ev_superseded_predecessor',
    institutionId: institution.id,
    title: 'Superseded predecessor',
    description: 'Initial evidence version to be superseded',
    reviewCycleId: cycle.id,
    evidenceSetIds: ['collection_1'],
    evidenceType: evidenceType.NARRATIVE,
    sourceType: evidenceSourceType.MANUAL,
  });
  await evidenceManagement.markEvidenceComplete(supersededPredecessor.id);
  await evidenceManagement.activateEvidenceItem(supersededPredecessor.id);

  const successor = await evidenceManagement.createSupersedingEvidenceVersion(supersededPredecessor.id, {
    id: 'ev_superseded_successor',
    title: 'Superseding evidence version',
    description: 'Current replacement version',
    reviewCycleId: cycle.id,
    evidenceSetIds: ['collection_1'],
  });
  await evidenceManagement.markEvidenceComplete(successor.id);
  await evidenceManagement.activateEvidenceItem(successor.id);

  const supersededWorkflow = await createReviewWorkflow.execute({
    reviewCycleId: cycle.id,
    targetType: 'report-section',
    targetId: 'section_superseded',
    reportSectionId: 'section_superseded',
    evidenceCollectionId: 'collection_1',
    evidenceItemIds: [supersededPredecessor.id],
  });
  await transitionReviewWorkflowState.execute(
    supersededWorkflow.id,
    reviewWorkflowState.IN_REVIEW,
    workflowActorRole.FACULTY,
  );
  await assert.rejects(
    () =>
      transitionReviewWorkflowState.execute(
        supersededWorkflow.id,
        reviewWorkflowState.APPROVED,
        workflowActorRole.REVIEWER,
      ),
    ValidationError,
    'approval should fail when referenced evidence is superseded/non-current',
  );

  const collectionScopedEvidence = await evidenceManagement.createEvidenceItem({
    id: 'ev_collection_1',
    institutionId: institution.id,
    title: 'Collection-scoped section evidence',
    description: 'Evidence linked to section and collection for collection-only readiness checks.',
    reviewCycleId: cycle.id,
    evidenceSetIds: ['collection_1'],
    evidenceType: evidenceType.NARRATIVE,
    sourceType: evidenceSourceType.MANUAL,
  });
  await evidenceManagement.addEvidenceReference(collectionScopedEvidence.id, {
    targetType: evidenceReferenceTargetType.NARRATIVE_SECTION,
    targetEntityId: 'section_collection_only_ready',
    relationshipType: evidenceReferenceRelationshipType.INCLUDED_IN,
    anchorPath: 'section://collection-only-ready',
  });
  await evidenceManagement.markEvidenceComplete(collectionScopedEvidence.id);
  await evidenceManagement.activateEvidenceItem(collectionScopedEvidence.id);

  const collectionScopedWorkflow = await createReviewWorkflow.execute({
    reviewCycleId: cycle.id,
    targetType: 'report-section',
    targetId: 'section_collection_only_ready',
    reportSectionId: 'section_collection_only_ready',
    evidenceCollectionId: 'collection_1',
    evidenceItemIds: [],
  });
  await transitionReviewWorkflowState.execute(
    collectionScopedWorkflow.id,
    reviewWorkflowState.IN_REVIEW,
    workflowActorRole.FACULTY,
  );
  const collectionApproved = await transitionReviewWorkflowState.execute(
    collectionScopedWorkflow.id,
    reviewWorkflowState.APPROVED,
    workflowActorRole.REVIEWER,
  );
  assert.equal(collectionApproved.transitionHistory[1].evidenceSummary.collectionRequirementSatisfied, true);
  assert.equal(collectionApproved.transitionHistory[1].evidenceSummary.collectionUsableEvidenceCount, 1);
  assert.equal(collectionApproved.transitionHistory[1].evidenceSummary.anyEvidenceRequirementSatisfied, true);

  const immutableCycle = await createReviewCycle.execute({
    institutionId: institution.id,
    name: 'Immutable Completed Cycle',
    startDate: '2029-01-01',
    endDate: '2029-12-31',
    programIds: ['program_immutable'],
    organizationUnitIds: ['org_immutable'],
    evidenceSetIds: ['set_immutable'],
  });
  await startReviewCycle.execute(immutableCycle.id);
  await completeReviewCycle.execute(immutableCycle.id);

  const mutatedCompletedCycle = await cycles.getById(immutableCycle.id);
  assert.ok(mutatedCompletedCycle);
  mutatedCompletedCycle!.startDate = '2029-02-01';
  await assert.rejects(
    () => cycles.save(mutatedCompletedCycle!),
    ValidationError,
    'completed review cycles should reject critical field updates at repository boundary',
  );
}

