import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCoreApiApp } from '../../src/bootstrap/create-core-api-app.js';
import { ORG_SERVICE } from '../../src/modules/organization-registry/organization-registry.module.js';
import { EVID_SERVICE } from '../../src/modules/evidence-management/evidence-management.module.js';
import { WF_SERVICE } from '../../src/modules/workflow-approvals/workflow-approvals.module.js';
import {
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
      { reason: 'Initial submission complete' },
    );
    await workflow.transitionWorkflowState(
      createdWorkflow.id,
      reviewWorkflowState.APPROVED,
      workflowActorRole.REVIEWER,
      { reason: 'Evidence package validated' },
    );
    const submitted = await workflow.transitionWorkflowState(
      createdWorkflow.id,
      reviewWorkflowState.SUBMITTED,
      workflowActorRole.ADMIN,
      { reason: 'Submitted to institutional governance queue' },
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

    const incompleteEvidence = await evidence.createEvidenceItem({
      institutionId,
      title: 'Incomplete Evidence',
      description: 'Incomplete evidence for negative transition assertions.',
      reviewCycleId: cycle.id,
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
      evidenceType: evidenceType.NARRATIVE,
      sourceType: evidenceSourceType.MANUAL,
    });
    await evidence.markEvidenceComplete(supersededPredecessor.id);
    await evidence.activateEvidenceItem(supersededPredecessor.id);

    const supersededSuccessor = await evidence.createSupersedingEvidenceVersion(supersededPredecessor.id, {
      title: 'Superseding Current Version',
      description: 'Current replacement version for superseded predecessor.',
      reviewCycleId: cycle.id,
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
  } finally {
    await app.close();
  }

  const secondApp = await createCoreApiApp({ port: 0, databasePath });
  try {
    const workflow = secondApp.get(WF_SERVICE);

    const restoredCycle = await workflow.getReviewCycleById(reviewCycleId);
    assert.ok(restoredCycle);
    assert.equal(restoredCycle?.institutionId, institutionId);
    assert.equal(restoredCycle?.status, 'active');
    assert.equal(restoredCycle?.programIds.length, 1);
    assert.equal(restoredCycle?.programIds[0], 'program_wp_1');

    const restoredWorkflow = await workflow.getReviewWorkflowById(reviewWorkflowId);
    assert.ok(restoredWorkflow);
    assert.equal(restoredWorkflow?.state, reviewWorkflowState.SUBMITTED);
    assert.equal(restoredWorkflow?.evidenceCollectionId, 'evidence_set_wp_1');
    assert.equal(restoredWorkflow?.transitionHistory.length, 3);
    assert.deepEqual(
      restoredWorkflow?.transitionHistory.map((item) => item.sequence),
      [1, 2, 3],
    );
    assert.equal(restoredWorkflow?.transitionHistory[0].fromState, reviewWorkflowState.DRAFT);
    assert.equal(restoredWorkflow?.transitionHistory[0].actorRole, workflowActorRole.FACULTY);
    assert.equal(restoredWorkflow?.transitionHistory[2].toState, reviewWorkflowState.SUBMITTED);
    assert.equal(restoredWorkflow?.transitionHistory[2].actorRole, workflowActorRole.ADMIN);
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
  } finally {
    await secondApp.close();
  }
}

