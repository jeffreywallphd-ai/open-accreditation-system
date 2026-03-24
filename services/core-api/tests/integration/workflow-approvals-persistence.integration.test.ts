import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCoreApiApp } from '../../src/bootstrap/create-core-api-app.js';
import { DATABASE_CONNECTION } from '../../src/infrastructure/persistence/persistence.tokens.js';
import { ORG_SERVICE } from '../../src/modules/organization-registry/organization-registry.module.js';
import { EVID_SERVICE } from '../../src/modules/evidence-management/evidence-management.module.js';
import { WF_SERVICE } from '../../src/modules/workflow-approvals/workflow-approvals.module.js';
import {
  evidenceReferenceRelationshipType,
  evidenceReferenceTargetType,
  evidenceSourceType,
  evidenceType,
} from '../../src/modules/evidence-management/domain/value-objects/evidence-classifications.js';
import {
  reviewWorkflowState,
  workflowActorRole,
} from '../../src/modules/workflow-approvals/domain/value-objects/workflow-statuses.js';
import { ValidationError } from '../../src/modules/shared/kernel/errors.js';

function createTempDbPath(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-api-workflow-persistence-'));
  return path.join(root, 'core-api.sqlite');
}

export async function runTests(): Promise<void> {
  const databasePath = createTempDbPath();
  const app = await createCoreApiApp({ port: 0, databasePath });

  let reviewCycleId = '';
  let reviewWorkflowId = '';
  let completedCycleId = '';
  let institutionId = '';
  try {
    const org = app.get(ORG_SERVICE);
    const evidence = app.get(EVID_SERVICE);
    const workflow = app.get(WF_SERVICE);

    const institution = await org.createInstitution({
      name: 'Workflow Persistence University',
      code: 'WPU',
    });
    institutionId = institution.id;

    const cycle = await workflow.createReviewCycle({
      institutionId,
      name: '2026 Workflow Persistence Cycle',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      programIds: ['program_wp_1'],
      organizationUnitIds: ['org_wp_1'],
      evidenceSetIds: ['evidence_set_wp_1'],
    });
    reviewCycleId = cycle.id;
    await workflow.startReviewCycle(cycle.id);

    const evidenceItem = await evidence.createEvidenceItem({
      institutionId,
      title: 'Program Self Study Narrative',
      description: 'Self-study narrative evidence for workflow persistence test.',
      reviewCycleId: cycle.id,
      evidenceSetIds: ['evidence_set_wp_1'],
      evidenceType: evidenceType.NARRATIVE,
      sourceType: evidenceSourceType.MANUAL,
    });
    await evidence.addEvidenceArtifact(evidenceItem.id, {
      artifactName: 'self-study.pdf',
      artifactType: 'primary',
      mimeType: 'application/pdf',
      storageBucket: 'evidence',
      storageKey: 'workflow/self-study.pdf',
    });
    await evidence.markEvidenceComplete(evidenceItem.id);
    await evidence.activateEvidenceItem(evidenceItem.id);

    const createdWorkflow = await workflow.createWorkflowInstance({
      reviewCycleId: cycle.id,
      targetType: 'report-section',
      targetId: 'section_3_2',
      reportSectionId: 'section_3_2',
      evidenceCollectionId: 'evidence_set_wp_1',
      evidenceItemIds: [evidenceItem.id],
    });
    reviewWorkflowId = createdWorkflow.id;
    assert.equal(createdWorkflow.state, reviewWorkflowState.DRAFT);

    await workflow.transitionWorkflowState(
      createdWorkflow.id,
      reviewWorkflowState.IN_REVIEW,
      workflowActorRole.FACULTY,
      { reason: 'Initial submission complete', actorId: 'person_faculty_wp_1' },
    );
    await workflow.transitionWorkflowState(
      createdWorkflow.id,
      reviewWorkflowState.APPROVED,
      workflowActorRole.REVIEWER,
      { reason: 'Evidence package validated', actorId: 'person_reviewer_wp_1' },
    );
    const submitted = await workflow.transitionWorkflowState(
      createdWorkflow.id,
      reviewWorkflowState.SUBMITTED,
      workflowActorRole.ADMIN,
      { reason: 'Submitted to institutional governance queue', actorId: 'person_admin_wp_1' },
    );
    assert.equal(submitted.transitionHistory.length, 3);
    assert.deepEqual(
      submitted.transitionHistory.map((entry) => entry.sequence),
      [1, 2, 3],
    );
    assert.equal(submitted.transitionHistory[2].evidenceSummary.collectionRequirementSatisfied, true);

    await assert.rejects(
      () =>
        workflow.createWorkflowInstance({
          reviewCycleId: cycle.id,
          targetType: 'report-section',
          targetId: 'section_missing_evidence',
          evidenceItemIds: ['ev_missing'],
        }),
      ValidationError,
      'missing referenced evidence should be rejected during workflow creation',
    );

    await assert.rejects(
      () =>
        workflow.createWorkflowInstance({
          reviewCycleId: cycle.id,
          targetType: 'report-section',
          targetId: 'section_unknown_collection',
          evidenceCollectionId: 'set_unknown',
        }),
      ValidationError,
      'workflow evidenceCollectionId must be declared by the owning review cycle',
    );

    await assert.rejects(
      () =>
        workflow.createWorkflowInstance({
          reviewCycleId: cycle.id,
          targetType: 'report-section',
          targetId: 'section_3_2',
        }),
      ValidationError,
      'cycle-target tuple should be unique for workflow instances',
    );

    const evidenceFreeWorkflow = await workflow.createWorkflowInstance({
      reviewCycleId: cycle.id,
      targetType: 'report-section',
      targetId: 'section_no_evidence',
      reportSectionId: 'section_no_evidence',
      evidenceItemIds: [],
    });
    await workflow.transitionWorkflowState(
      evidenceFreeWorkflow.id,
      reviewWorkflowState.IN_REVIEW,
      workflowActorRole.FACULTY,
      { reason: 'Attempt evidence-free approval path' },
    );
    await assert.rejects(
      () =>
        workflow.transitionWorkflowState(
          evidenceFreeWorkflow.id,
          reviewWorkflowState.APPROVED,
          workflowActorRole.REVIEWER,
          { reason: 'Should fail because no evidence readiness is satisfied' },
        ),
      ValidationError,
      'approval should fail when no evidence is supplied for governed transitions',
    );

    const incompleteEvidence = await evidence.createEvidenceItem({
      institutionId,
      title: 'Incomplete Evidence',
      description: 'Incomplete evidence for negative transition assertions.',
      reviewCycleId: cycle.id,
      evidenceSetIds: ['evidence_set_wp_1'],
      evidenceType: evidenceType.NARRATIVE,
      sourceType: evidenceSourceType.MANUAL,
    });
    const incompleteWorkflow = await workflow.createWorkflowInstance({
      reviewCycleId: cycle.id,
      targetType: 'report-section',
      targetId: 'section_4_1',
      reportSectionId: 'section_4_1',
      evidenceCollectionId: 'evidence_set_wp_1',
      evidenceItemIds: [incompleteEvidence.id],
    });
    await workflow.transitionWorkflowState(
      incompleteWorkflow.id,
      reviewWorkflowState.IN_REVIEW,
      workflowActorRole.FACULTY,
      { reason: 'Send incomplete package for review' },
    );
    await assert.rejects(
      () =>
        workflow.transitionWorkflowState(
          incompleteWorkflow.id,
          reviewWorkflowState.APPROVED,
          workflowActorRole.REVIEWER,
          { reason: 'Should fail due to incomplete/unusable evidence' },
        ),
      ValidationError,
      'approval should fail for incomplete evidence',
    );

    const presentButUnusableEvidence = await evidence.createEvidenceItem({
      institutionId,
      title: 'Present But Unusable Evidence',
      description: 'Evidence is complete but still not activated.',
      reviewCycleId: cycle.id,
      evidenceSetIds: ['evidence_set_wp_1'],
      evidenceType: evidenceType.NARRATIVE,
      sourceType: evidenceSourceType.MANUAL,
    });
    await evidence.markEvidenceComplete(presentButUnusableEvidence.id);

    const presentButUnusableWorkflow = await workflow.createWorkflowInstance({
      reviewCycleId: cycle.id,
      targetType: 'report-section',
      targetId: 'section_4_2',
      reportSectionId: 'section_4_2',
      evidenceCollectionId: 'evidence_set_wp_1',
      evidenceItemIds: [presentButUnusableEvidence.id],
    });
    await workflow.transitionWorkflowState(
      presentButUnusableWorkflow.id,
      reviewWorkflowState.IN_REVIEW,
      workflowActorRole.FACULTY,
      { reason: 'Send complete but inactive evidence for review' },
    );
    await assert.rejects(
      () =>
        workflow.transitionWorkflowState(
          presentButUnusableWorkflow.id,
          reviewWorkflowState.APPROVED,
          workflowActorRole.REVIEWER,
          { reason: 'Should fail due to inactive/unusable evidence' },
        ),
      ValidationError,
      'approval should fail for present-but-unusable evidence',
    );

    const supersededPredecessor = await evidence.createEvidenceItem({
      institutionId,
      title: 'Superseded Predecessor',
      description: 'Initial version that will be superseded before approval.',
      reviewCycleId: cycle.id,
      evidenceSetIds: ['evidence_set_wp_1'],
      evidenceType: evidenceType.NARRATIVE,
      sourceType: evidenceSourceType.MANUAL,
    });
    await evidence.markEvidenceComplete(supersededPredecessor.id);
    await evidence.activateEvidenceItem(supersededPredecessor.id);

    const supersededSuccessor = await evidence.createSupersedingEvidenceVersion(supersededPredecessor.id, {
      title: 'Superseding Current Version',
      description: 'Current replacement version for superseded predecessor.',
      reviewCycleId: cycle.id,
      evidenceSetIds: ['evidence_set_wp_1'],
    });
    await evidence.markEvidenceComplete(supersededSuccessor.id);
    await evidence.activateEvidenceItem(supersededSuccessor.id);

    const supersededWorkflow = await workflow.createWorkflowInstance({
      reviewCycleId: cycle.id,
      targetType: 'report-section',
      targetId: 'section_4_3',
      reportSectionId: 'section_4_3',
      evidenceCollectionId: 'evidence_set_wp_1',
      evidenceItemIds: [supersededPredecessor.id],
    });
    await workflow.transitionWorkflowState(
      supersededWorkflow.id,
      reviewWorkflowState.IN_REVIEW,
      workflowActorRole.FACULTY,
      { reason: 'Send superseded predecessor evidence for review' },
    );
    await assert.rejects(
      () =>
        workflow.transitionWorkflowState(
          supersededWorkflow.id,
          reviewWorkflowState.APPROVED,
          workflowActorRole.REVIEWER,
          { reason: 'Should fail because predecessor is superseded/non-current' },
        ),
      ValidationError,
      'approval should fail for superseded/non-current referenced evidence',
    );

    const collectionScopedEvidence = await evidence.createEvidenceItem({
      institutionId,
      title: 'Collection-scoped supporting narrative',
      description: 'Evidence used for collection-only workflow readiness checks.',
      reviewCycleId: cycle.id,
      evidenceSetIds: ['evidence_set_wp_1'],
      evidenceType: evidenceType.NARRATIVE,
      sourceType: evidenceSourceType.MANUAL,
    });
    await evidence.addEvidenceReference(collectionScopedEvidence.id, {
      targetType: evidenceReferenceTargetType.NARRATIVE_SECTION,
      targetEntityId: 'section_collection_only',
      relationshipType: evidenceReferenceRelationshipType.INCLUDED_IN,
      anchorPath: 'section://collection-only',
    });
    await evidence.markEvidenceComplete(collectionScopedEvidence.id);
    await evidence.activateEvidenceItem(collectionScopedEvidence.id);

    const collectionOnlyWorkflow = await workflow.createWorkflowInstance({
      reviewCycleId: cycle.id,
      targetType: 'report-section',
      targetId: 'section_collection_only',
      reportSectionId: 'section_collection_only',
      evidenceCollectionId: 'evidence_set_wp_1',
      evidenceItemIds: [],
    });
    await workflow.transitionWorkflowState(
      collectionOnlyWorkflow.id,
      reviewWorkflowState.IN_REVIEW,
      workflowActorRole.FACULTY,
      { reason: 'Collection-only review route' },
    );
    const collectionOnlyApproved = await workflow.transitionWorkflowState(
      collectionOnlyWorkflow.id,
      reviewWorkflowState.APPROVED,
      workflowActorRole.REVIEWER,
      { reason: 'Collection evidence readiness satisfied' },
    );
    assert.equal(collectionOnlyApproved.transitionHistory[1].evidenceSummary.collectionRequirementSatisfied, true);
    assert.equal(collectionOnlyApproved.transitionHistory[1].evidenceSummary.collectionUsableEvidenceCount, 1);
    assert.equal(collectionOnlyApproved.transitionHistory[1].evidenceSummary.anyEvidenceRequirementSatisfied, true);

    const duplicateScope = await workflow.createReviewCycle({
      institutionId,
      name: 'Duplicate Active Scope',
      startDate: '2027-01-01',
      endDate: '2027-12-31',
      programIds: ['program_wp_1'],
      organizationUnitIds: ['org_wp_1'],
    });
    await assert.rejects(
      () => workflow.startReviewCycle(duplicateScope.id),
      ValidationError,
      'active scope uniqueness should be enforced through persistence-backed repository checks',
    );

    const completedCycle = await workflow.createReviewCycle({
      institutionId,
      name: '2028 Completed Cycle Round Trip',
      startDate: '2028-01-01',
      endDate: '2028-12-31',
      programIds: ['program_wp_completed'],
    });
    completedCycleId = completedCycle.id;
    await workflow.startReviewCycle(completedCycle.id);
    await workflow.completeReviewCycle(completedCycle.id);
  } finally {
    await app.close();
  }

  const secondApp = await createCoreApiApp({ port: 0, databasePath });
  try {
    const workflow = secondApp.get(WF_SERVICE);

    const restoredCycle = await workflow.getReviewCycleById(reviewCycleId);
    assert.ok(restoredCycle);
    assert.equal(restoredCycle?.institutionId, institutionId);
    assert.equal(restoredCycle?.name, '2026 Workflow Persistence Cycle');
    assert.equal(restoredCycle?.startDate, '2026-01-01');
    assert.equal(restoredCycle?.endDate, '2026-12-31');
    assert.equal(restoredCycle?.status, 'active');
    assert.equal(restoredCycle?.programIds.length, 1);
    assert.equal(restoredCycle?.programIds[0], 'program_wp_1');

    const restoredCompletedCycle = await workflow.getReviewCycleById(completedCycleId);
    assert.ok(restoredCompletedCycle);
    assert.equal(restoredCompletedCycle?.status, 'completed');

    const restoredWorkflow = await workflow.getReviewWorkflowById(reviewWorkflowId);
    assert.ok(restoredWorkflow);
    assert.equal(restoredWorkflow?.state, reviewWorkflowState.SUBMITTED);
    assert.equal(restoredWorkflow?.evidenceCollectionId, 'evidence_set_wp_1');
    assert.equal(restoredWorkflow?.evidenceItemIds.length, 1);
    assert.equal(restoredWorkflow?.transitionHistory.length, 3);
    assert.deepEqual(
      restoredWorkflow?.transitionHistory.map((item) => item.sequence),
      [1, 2, 3],
    );
    assert.equal(restoredWorkflow?.transitionHistory[0].fromState, reviewWorkflowState.DRAFT);
    assert.equal(restoredWorkflow?.transitionHistory[0].actorRole, workflowActorRole.FACULTY);
    assert.equal(restoredWorkflow?.transitionHistory[0].actorId, 'person_faculty_wp_1');
    assert.equal(restoredWorkflow?.transitionHistory[2].toState, reviewWorkflowState.SUBMITTED);
    assert.equal(restoredWorkflow?.transitionHistory[2].actorRole, workflowActorRole.ADMIN);
    assert.equal(restoredWorkflow?.transitionHistory[2].actorId, 'person_admin_wp_1');
    assert.equal(restoredWorkflow?.transitionHistory[2].evidenceSummary.collectionRequirementSatisfied, true);
    assert.equal(restoredWorkflow?.transitionHistory[2].evidenceSummary.requiredUsableEvidenceCount, 1);
    assert.equal(restoredWorkflow?.transitionHistory[2].evidenceSummary.readinessPolicy.requireCurrentReferencedEvidence, true);

    const restoredCycleTargetState = await workflow.getWorkflowStateForCycleTarget(
      reviewCycleId,
      'report-section',
      'section_3_2',
    );
    assert.ok(restoredCycleTargetState);
    assert.equal(restoredCycleTargetState?.id, reviewWorkflowId);
    assert.equal(restoredCycleTargetState?.state, reviewWorkflowState.SUBMITTED);

    await assert.rejects(
      () =>
        workflow.transitionWorkflowState(
          reviewWorkflowId,
          reviewWorkflowState.APPROVED,
          workflowActorRole.ADMIN,
        ),
      ValidationError,
      'submitted workflow should reject invalid backward transitions after round-trip rehydration',
    );

    await assert.rejects(
      () => workflow.startReviewCycle(reviewCycleId),
      ValidationError,
      'rehydrated active review cycle should continue enforcing lifecycle transition rules',
    );

    const database = secondApp.get(DATABASE_CONNECTION);
    database.run(
      `INSERT INTO workflow_review_workflow_transitions
         (id, workflow_id, transition_sequence, from_state, to_state, actor_role, actor_id, reason, evidence_summary_json, transitioned_at, created_at)
       VALUES
         (@id, @workflowId, @sequence, @fromState, @toState, @actorRole, @actorId, @reason, @evidenceSummaryJson, @transitionedAt, @createdAt)`,
      {
        id: 'wf_hist_corrupt_1',
        workflowId: reviewWorkflowId,
        sequence: 4,
        fromState: reviewWorkflowState.DRAFT,
        toState: reviewWorkflowState.SUBMITTED,
        actorRole: workflowActorRole.ADMIN,
        actorId: 'person_admin_wp_1',
        reason: 'corrupted transition chain',
        evidenceSummaryJson: null,
        transitionedAt: '2026-12-15T00:00:00.000Z',
        createdAt: '2026-12-15T00:00:00.000Z',
      },
    );

    await assert.rejects(
      () => workflow.getReviewWorkflowById(reviewWorkflowId),
      ValidationError,
      'repository should reject invalid persisted transition history during rehydration',
    );
  } finally {
    await secondApp.close();
  }
}

