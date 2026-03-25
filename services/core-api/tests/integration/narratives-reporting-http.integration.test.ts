import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCoreApiApp } from '../../src/bootstrap/create-core-api-app.js';
import { ORG_SERVICE } from '../../src/modules/organization-registry/organization-registry.module.js';
import { WF_SERVICE } from '../../src/modules/workflow-approvals/workflow-approvals.module.js';
import { EVID_SERVICE } from '../../src/modules/evidence-management/evidence-management.module.js';
import {
  reviewWorkflowState,
  workflowActorRole,
} from '../../src/modules/workflow-approvals/domain/value-objects/workflow-statuses.js';
import {
  evidenceSourceType,
  evidenceType,
} from '../../src/modules/evidence-management/domain/value-objects/evidence-classifications.js';

function createTempDbPath(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-api-narratives-http-'));
  return path.join(root, 'core-api.sqlite');
}

export async function runTests(): Promise<void> {
  const app = await createCoreApiApp({ port: 0, databasePath: createTempDbPath() });

  try {
    const org = app.get(ORG_SERVICE);
    const workflow = app.get(WF_SERVICE);
    const evidence = app.get(EVID_SERVICE);

    const institution = await org.createInstitution({
      name: 'Narratives HTTP University',
      code: 'NHU',
    });

    const cycle = await workflow.createReviewCycle({
      institutionId: institution.id,
      name: '2026 Narratives HTTP Cycle',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      programIds: ['program_http_1'],
      organizationUnitIds: ['org_http_1'],
    });
    await workflow.startReviewCycle(cycle.id);

    const evidenceItem = await evidence.createEvidenceItem({
      institutionId: institution.id,
      title: 'HTTP narratives evidence',
      description: 'Evidence used for API-level narratives package tests.',
      reviewCycleId: cycle.id,
      evidenceType: evidenceType.NARRATIVE,
      sourceType: evidenceSourceType.MANUAL,
    });
    await evidence.markEvidenceComplete(evidenceItem.id);
    await evidence.activateEvidenceItem(evidenceItem.id);

    const sectionWorkflow = await workflow.createWorkflowInstance({
      reviewCycleId: cycle.id,
      targetType: 'report-section',
      targetId: 'section_http_1',
      reportSectionId: 'section_http_1',
      evidenceItemIds: [evidenceItem.id],
    });
    await workflow.transitionWorkflowState(sectionWorkflow.id, reviewWorkflowState.IN_REVIEW, workflowActorRole.FACULTY);
    await workflow.transitionWorkflowState(sectionWorkflow.id, reviewWorkflowState.APPROVED, workflowActorRole.REVIEWER);

    const workflowTarget = await workflow.createWorkflowInstance({
      reviewCycleId: cycle.id,
      targetType: 'report-section',
      targetId: 'section_http_2',
      reportSectionId: 'section_http_2',
      evidenceItemIds: [evidenceItem.id],
    });
    await workflow.transitionWorkflowState(workflowTarget.id, reviewWorkflowState.IN_REVIEW, workflowActorRole.FACULTY);
    await workflow.transitionWorkflowState(workflowTarget.id, reviewWorkflowState.SUBMITTED, workflowActorRole.REVIEWER);

    const createPackage = await app.inject({
      method: 'POST',
      url: '/narratives-reporting/submission-packages',
      payload: {
        reviewCycleId: cycle.id,
        scopeType: 'report-bundle',
        scopeId: 'narr-http-package',
        name: 'Narratives HTTP package',
      },
    });
    assert.equal(createPackage.statusCode, 201);
    const submissionPackage = createPackage.json().data;

    const getPackage = await app.inject({
      method: 'GET',
      url: `/narratives-reporting/submission-packages/${submissionPackage.id}`,
    });
    assert.equal(getPackage.statusCode, 200);
    assert.equal(getPackage.json().data.id, submissionPackage.id);

    const addSection = await app.inject({
      method: 'POST',
      url: `/narratives-reporting/submission-packages/${submissionPackage.id}/items`,
      payload: {
        itemType: 'report-section',
        assemblyRole: 'governed-section',
        targetType: 'report-section',
        targetId: 'section_http_1',
        sectionKey: 'http-sec-1',
        sectionTitle: 'Section HTTP 1',
        evidenceItemIds: [evidenceItem.id],
      },
    });
    assert.equal(addSection.statusCode, 201);

    const sectionItemId = addSection.json().data.items[0].id;

    const addWorkflowTarget = await app.inject({
      method: 'POST',
      url: `/narratives-reporting/submission-packages/${submissionPackage.id}/items`,
      payload: {
        itemType: 'workflow-target',
        targetType: 'report-section',
        targetId: 'section_http_2',
        sectionKey: 'http-sec-1',
        evidenceItemIds: [evidenceItem.id],
      },
    });
    assert.equal(addWorkflowTarget.statusCode, 201);

    const workflowItemId = addWorkflowTarget.json().data.items[1].id;

    const addEvidenceInclusion = await app.inject({
      method: 'POST',
      url: `/narratives-reporting/submission-packages/${submissionPackage.id}/items`,
      payload: {
        itemType: 'evidence-item',
        assemblyRole: 'evidence-inclusion',
        targetType: 'evidence-item',
        targetId: evidenceItem.id,
        sectionKey: 'http-sec-1',
      },
    });
    assert.equal(addEvidenceInclusion.statusCode, 201);

    const evidenceItemPackageId = addEvidenceInclusion.json().data.items[2].id;

    const reorderItem = await app.inject({
      method: 'POST',
      url: `/narratives-reporting/submission-packages/${submissionPackage.id}/items/${evidenceItemPackageId}/reorder`,
      payload: {
        newPosition: 2,
      },
    });
    assert.equal(reorderItem.statusCode, 201);
    assert.equal(reorderItem.json().data.items[1].id, evidenceItemPackageId);

    const removeItem = await app.inject({
      method: 'DELETE',
      url: `/narratives-reporting/submission-packages/${submissionPackage.id}/items/${workflowItemId}`,
    });
    assert.equal(removeItem.statusCode, 200);
    assert.equal(removeItem.json().data.items.length, 2);

    const listPackages = await app.inject({
      method: 'GET',
      url: `/narratives-reporting/submission-packages?reviewCycleId=${cycle.id}&scopeType=report-bundle`,
    });
    assert.equal(listPackages.statusCode, 200);
    assert.equal(listPackages.json().data.length, 1);

    const filterByAssemblyRole = await app.inject({
      method: 'GET',
      url: '/narratives-reporting/submission-packages?assemblyRole=evidence-inclusion',
    });
    assert.equal(filterByAssemblyRole.statusCode, 200);
    assert.equal(filterByAssemblyRole.json().data.length, 1);

    const captureSnapshot = await app.inject({
      method: 'POST',
      url: `/narratives-reporting/submission-packages/${submissionPackage.id}/snapshots`,
      payload: {
        milestoneLabel: 'checkpoint-http',
        actorId: 'person_http_reviewer',
      },
    });
    assert.equal(captureSnapshot.statusCode, 201);
    assert.equal(captureSnapshot.json().data.versionNumber, 1);

    const contextResponse = await app.inject({
      method: 'GET',
      url: `/narratives-reporting/submission-packages/${submissionPackage.id}/context`,
    });
    assert.equal(contextResponse.statusCode, 200);
    assert.equal(contextResponse.json().data.itemContext.length, 2);
    assert.equal(contextResponse.json().data.assembly.sections.length, 1);
    assert.equal(contextResponse.json().data.assembly.sections[0].itemId, sectionItemId);

    const finalizePackage = await app.inject({
      method: 'POST',
      url: `/narratives-reporting/submission-packages/${submissionPackage.id}/finalize`,
      payload: {
        milestoneLabel: 'final-http',
        actorId: 'person_http_admin',
      },
    });
    assert.equal(finalizePackage.statusCode, 201);
    assert.equal(finalizePackage.json().data.finalized, true);

    const removeAfterFinalize = await app.inject({
      method: 'DELETE',
      url: `/narratives-reporting/submission-packages/${submissionPackage.id}/items/${sectionItemId}`,
    });
    assert.equal(removeAfterFinalize.statusCode, 400);
  } finally {
    await app.close();
  }
}
