import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCoreApiApp } from '../../src/bootstrap/create-core-api-app.js';
import { DATABASE_CONNECTION } from '../../src/infrastructure/persistence/persistence.tokens.js';
import { ORG_SERVICE } from '../../src/modules/organization-registry/organization-registry.module.js';
import { WF_SERVICE } from '../../src/modules/workflow-approvals/workflow-approvals.module.js';
import { EVID_SERVICE } from '../../src/modules/evidence-management/evidence-management.module.js';
import { NARR_SERVICE } from '../../src/modules/narratives-reporting/narratives-reporting.module.js';
import {
  reviewWorkflowState,
  workflowActorRole,
} from '../../src/modules/workflow-approvals/domain/value-objects/workflow-statuses.js';
import {
  evidenceSourceType,
  evidenceType,
} from '../../src/modules/evidence-management/domain/value-objects/evidence-classifications.js';
import {
  narrativeEvidenceLinkType,
  narrativePackageLinkType,
  narrativeSectionType,
} from '../../src/modules/narratives-reporting/domain/value-objects/narrative-statuses.js';
import { ValidationError } from '../../src/modules/shared/kernel/errors.js';

function createTempDbPath(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-api-narratives-narrative-persistence-'));
  return path.join(root, 'core-api.sqlite');
}

export async function runTests(): Promise<void> {
  const databasePath = createTempDbPath();
  const app = await createCoreApiApp({ port: 0, databasePath });

  let narrativeId = '';
  let sectionId = '';
  let evidenceLinkId = '';
  let submissionPackageItemId = '';

  try {
    const org = app.get(ORG_SERVICE);
    const workflow = app.get(WF_SERVICE);
    const evidence = app.get(EVID_SERVICE);
    const narratives = app.get(NARR_SERVICE);

    const institution = await org.createInstitution({
      name: 'Narrative Persistence University',
      code: 'NPU2',
    });

    const cycle = await workflow.createReviewCycle({
      institutionId: institution.id,
      name: '2026 Narrative Persistence Cycle',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      programIds: ['program_np2_1'],
      organizationUnitIds: ['org_np2_1'],
    });
    await workflow.startReviewCycle(cycle.id);

    const evidenceItem = await evidence.createEvidenceItem({
      institutionId: institution.id,
      title: 'Narrative persistence evidence',
      description: 'Evidence for narrative persistence tests',
      reviewCycleId: cycle.id,
      evidenceType: evidenceType.NARRATIVE,
      sourceType: evidenceSourceType.MANUAL,
    });
    await evidence.markEvidenceComplete(evidenceItem.id);
    await evidence.activateEvidenceItem(evidenceItem.id);

    const reviewWorkflow = await workflow.createWorkflowInstance({
      reviewCycleId: cycle.id,
      targetType: 'report-section',
      targetId: 'persist_sec_1',
      reportSectionId: 'persist_sec_1',
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
      scopeId: 'narrative-persistence-package',
      name: 'Narrative persistence package',
    });
    const packageWithSection = await narratives.addSubmissionPackageItem(submissionPackage.id, {
      itemType: 'report-section',
      targetType: 'report-section',
      targetId: 'persist_sec_1',
      sectionKey: 'persist-sec-1',
      sectionTitle: 'Persistence section',
      evidenceItemIds: [evidenceItem.id],
    });
    submissionPackageItemId = packageWithSection.items[0].id;

    const narrative = await narratives.createNarrative({
      submissionPackageId: submissionPackage.id,
      title: 'Persistence narrative',
    });
    narrativeId = narrative.id;

    const withSection = await narratives.addNarrativeSection(narrative.id, {
      sectionType: narrativeSectionType.REPORT_SECTION,
      sectionKey: 'persist-sec-1',
      title: 'Persistence section narrative',
      content: 'Narrative persistence content',
    });
    sectionId = withSection.sections[0].id;

    const withEvidenceLink = await narratives.linkNarrativeSectionEvidence(narrative.id, sectionId, {
      evidenceItemId: evidenceItem.id,
      relationshipType: narrativeEvidenceLinkType.PRIMARY_SUPPORT,
    });
    evidenceLinkId = withEvidenceLink.sections[0].evidenceLinks[0].id;

    const withPackageLink = await narratives.linkNarrativeSectionToPackageItem(narrative.id, sectionId, {
      submissionPackageItemId,
      linkType: narrativePackageLinkType.GOVERNING_SECTION,
    });
    assert.equal(withPackageLink.sections[0].packageLinks.length, 1);

    await narratives.submitNarrativeForReview(narrative.id);
    const finalized = await narratives.finalizeNarrative(narrative.id);
    assert.equal(finalized.status, 'finalized');

    await assert.rejects(
      () =>
        narratives.linkNarrativeSectionEvidence(narrative.id, sectionId, {
          evidenceItemId: evidenceItem.id,
          relationshipType: narrativeEvidenceLinkType.SUPPORTING,
        }),
      ValidationError,
      'finalized narratives should reject mutation through persistence-backed repository',
    );
  } finally {
    await app.close();
  }

  const secondApp = await createCoreApiApp({ port: 0, databasePath });
  try {
    const narratives = secondApp.get(NARR_SERVICE);
    const database = secondApp.get(DATABASE_CONNECTION);

    const restored = await narratives.getNarrativeById(narrativeId);
    assert.ok(restored);
    assert.equal(restored?.sections.length, 1);
    assert.equal(restored?.sections[0].id, sectionId);
    assert.equal(restored?.sections[0].evidenceLinks.length, 1);
    assert.equal(restored?.sections[0].evidenceLinks[0].id, evidenceLinkId);
    assert.equal(restored?.sections[0].packageLinks.length, 1);
    assert.equal(restored?.status, 'finalized');

    const listed = await narratives.listNarratives({ status: 'finalized' });
    assert.equal(listed.length, 1);

    const now = new Date().toISOString();
    const duplicateSectionId = 'narrative_persistence_duplicate_section';
    database.run(
      `INSERT INTO narratives_narrative_sections
        (id, narrative_id, section_sequence, section_type, section_key, parent_section_key, title, content, owner_id, created_at, updated_at)
       VALUES
        (@id, @narrativeId, @sequence, @sectionType, @sectionKey, @parentSectionKey, @title, @content, @ownerId, @createdAt, @updatedAt)`,
      {
        id: duplicateSectionId,
        narrativeId,
        sequence: 2,
        sectionType: 'report-section',
        sectionKey: 'persistence-duplicate',
        parentSectionKey: null,
        title: 'Persistence duplicate section',
        content: null,
        ownerId: null,
        createdAt: now,
        updatedAt: now,
      },
    );
    assert.throws(
      () =>
        database.run(
          `INSERT INTO narratives_narrative_section_package_links
            (id, section_id, narrative_id, submission_package_item_id, link_type, created_at)
           VALUES
            (@id, @sectionId, @narrativeId, @submissionPackageItemId, @linkType, @createdAt)`,
          {
            id: 'narrative_persistence_duplicate_pkg_link',
            sectionId: duplicateSectionId,
            narrativeId,
            submissionPackageItemId,
            linkType: 'included-item',
            createdAt: now,
          },
        ),
      /UNIQUE constraint failed/,
      'narrative-level package item links should be unique in persistence',
    );

    const tampered = await narratives.getNarrativeById(narrativeId);
    assert.ok(tampered);
    tampered!.title = 'Tampered';
    await assert.rejects(
      () => narratives.narratives.save(tampered!),
      ValidationError,
      'finalized narrative rows should remain immutable during repository save',
    );
  } finally {
    await secondApp.close();
  }
}
