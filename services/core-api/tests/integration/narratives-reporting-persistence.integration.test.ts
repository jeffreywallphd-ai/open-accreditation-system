import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCoreApiApp } from '../../src/bootstrap/create-core-api-app.js';
import { ORG_SERVICE } from '../../src/modules/organization-registry/organization-registry.module.js';
import { WF_SERVICE } from '../../src/modules/workflow-approvals/workflow-approvals.module.js';
import { EVID_SERVICE } from '../../src/modules/evidence-management/evidence-management.module.js';
import { NARR_SERVICE } from '../../src/modules/narratives-reporting/narratives-reporting.module.js';
import {
  reviewWorkflowState,
  workflowActorRole,
} from '../../src/modules/workflow-approvals/domain/value-objects/workflow-statuses.js';
import { ValidationError } from '../../src/modules/shared/kernel/errors.js';
import {
  evidenceSourceType,
  evidenceType,
} from '../../src/modules/evidence-management/domain/value-objects/evidence-classifications.js';

function createTempDbPath(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-api-narratives-persistence-'));
  return path.join(root, 'core-api.sqlite');
}

export async function runTests(): Promise<void> {
  const databasePath = createTempDbPath();
  const app = await createCoreApiApp({ port: 0, databasePath });

  let packageId = '';
  let itemId = '';

  try {
    const org = app.get(ORG_SERVICE);
    const workflow = app.get(WF_SERVICE);
    const evidence = app.get(EVID_SERVICE);
    const narratives = app.get(NARR_SERVICE);

    const institution = await org.createInstitution({
      name: 'Narratives Persistence University',
      code: 'NPU',
    });

    const cycle = await workflow.createReviewCycle({
      institutionId: institution.id,
      name: '2026 Narratives Persistence Cycle',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      programIds: ['program_np_1'],
      organizationUnitIds: ['org_np_1'],
    });
    await workflow.startReviewCycle(cycle.id);

    const evidenceItem = await evidence.createEvidenceItem({
      institutionId: institution.id,
      title: 'Narratives package evidence',
      description: 'Evidence used by submission package item persistence tests.',
      reviewCycleId: cycle.id,
      evidenceType: evidenceType.NARRATIVE,
      sourceType: evidenceSourceType.MANUAL,
    });
    await evidence.markEvidenceComplete(evidenceItem.id);
    await evidence.activateEvidenceItem(evidenceItem.id);

    const reviewWorkflow = await workflow.createWorkflowInstance({
      reviewCycleId: cycle.id,
      targetType: 'report-section',
      targetId: 'section_5_1',
      reportSectionId: 'section_5_1',
      evidenceItemIds: [evidenceItem.id],
    });
    await workflow.transitionWorkflowState(
      reviewWorkflow.id,
      reviewWorkflowState.IN_REVIEW,
      workflowActorRole.FACULTY,
    );
    await workflow.transitionWorkflowState(
      reviewWorkflow.id,
      reviewWorkflowState.APPROVED,
      workflowActorRole.REVIEWER,
    );

    const submissionPackage = await narratives.createSubmissionPackage({
      reviewCycleId: cycle.id,
      scopeType: 'report-bundle',
      scopeId: 'package_np_1',
      name: 'Persistence package',
    });
    packageId = submissionPackage.id;

    const withSection = await narratives.addSubmissionPackageItem(packageId, {
      itemType: 'report-section',
      targetType: 'report-section',
      targetId: 'section_5_1',
      sectionKey: 'sec-5-1',
      sectionTitle: 'Faculty qualifications narrative',
      evidenceItemIds: [evidenceItem.id],
      label: 'Faculty qualifications narrative',
    });
    itemId = withSection.items[0].id;

    const withEvidence = await narratives.addSubmissionPackageItem(packageId, {
      itemType: 'evidence-item',
      targetType: 'evidence-item',
      targetId: evidenceItem.id,
      sectionKey: 'sec-5-1',
    });
    assert.equal(withEvidence.items.length, 2);

    const snapshot = await narratives.snapshotSubmissionPackage(packageId, {
      milestoneLabel: 'checkpoint-1',
      actorId: 'person_reviewer_1',
    });
    assert.equal(snapshot.versionNumber, 1);

    await workflow.transitionWorkflowState(
      reviewWorkflow.id,
      reviewWorkflowState.SUBMITTED,
      workflowActorRole.ADMIN,
    );

    const finalized = await narratives.snapshotSubmissionPackage(packageId, {
      milestoneLabel: 'final',
      actorId: 'person_admin_1',
      finalize: true,
    });
    assert.equal(finalized.finalized, true);

    await assert.rejects(
      () => narratives.reorderSubmissionPackageItem(packageId, itemId, 1),
      ValidationError,
      'finalized package should reject reorder through persistence-backed repository',
    );
  } finally {
    await app.close();
  }

  const secondApp = await createCoreApiApp({ port: 0, databasePath });
  try {
    const narratives = secondApp.get(NARR_SERVICE);

    const restored = await narratives.getSubmissionPackageById(packageId);
    assert.ok(restored);
    assert.equal(restored?.items.length, 2);
    assert.equal(restored?.items[0].id, itemId);
    assert.equal(restored?.items[0].sectionKey, 'sec-5-1');
    assert.equal(restored?.items[0].assemblyRole, 'governed-section');
    assert.equal(restored?.snapshots.length, 2);
    assert.equal(restored?.snapshots[1].finalized, true);
    assert.equal(restored?.status, 'finalized');

    const context = await narratives.getSubmissionPackageWithItemContext(packageId);
    assert.equal(context.itemContext.length, 2);
    assert.equal(context.itemContext[0].workflowState, 'submitted');
    assert.equal(context.assembly.sections.length, 1);

    const tampered = await narratives.getSubmissionPackageById(packageId);
    assert.ok(tampered);
    tampered!.snapshots[0].milestoneLabel = 'tampered';
    await assert.rejects(
      () => narratives.submissionPackages.save(tampered!),
      ValidationError,
      'snapshot rows should remain append-only during repository save',
    );
  } finally {
    await secondApp.close();
  }
}
