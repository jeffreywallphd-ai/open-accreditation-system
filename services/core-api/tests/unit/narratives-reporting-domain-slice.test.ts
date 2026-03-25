import assert from 'node:assert/strict';
import { ValidationError } from '../../src/modules/shared/kernel/errors.js';
import { SubmissionPackage } from '../../src/modules/narratives-reporting/domain/entities/submission-package.js';
import {
  submissionPackageItemAssemblyRole,
  submissionPackageItemType,
  submissionPackageStatus,
} from '../../src/modules/narratives-reporting/domain/value-objects/submission-package-statuses.js';

export async function runTests(): Promise<void> {
  const submissionPackage = SubmissionPackage.create({
    institutionId: 'inst_1',
    reviewCycleId: 'cycle_1',
    scopeType: 'report-bundle',
    scopeId: 'program-self-study',
    name: 'Program self-study package',
  });

  assert.equal(submissionPackage.status, submissionPackageStatus.DRAFT);
  assert.equal(submissionPackage.items.length, 0);

  const sectionItem = submissionPackage.addItem({
    itemType: submissionPackageItemType.REPORT_SECTION,
    assemblyRole: submissionPackageItemAssemblyRole.GOVERNED_SECTION,
    targetType: 'report-section',
    targetId: 'section_1_1',
    sectionKey: 'section-1-1',
    sectionTitle: 'Mission and strategy',
    evidenceItemIds: ['ev_1', 'ev_2'],
    label: 'Mission and strategy',
  });
  const workflowItem = submissionPackage.addItem({
    itemType: submissionPackageItemType.WORKFLOW_TARGET,
    targetType: 'report-section',
    targetId: 'section_2_1',
    sectionKey: 'section-1-1',
    evidenceItemIds: ['ev_3'],
  });

  assert.equal(sectionItem.sequence, 1);
  assert.equal(workflowItem.sequence, 2);

  const evidenceInclusion = submissionPackage.addItem({
    itemType: submissionPackageItemType.EVIDENCE_ITEM,
    targetType: 'evidence-item',
    targetId: 'ev_4',
    sectionKey: 'section-1-1',
  });
  assert.equal(evidenceInclusion.assemblyRole, submissionPackageItemAssemblyRole.EVIDENCE_INCLUSION);
  assert.deepEqual(evidenceInclusion.evidenceItemIds, ['ev_4']);

  assert.throws(
    () =>
      submissionPackage.addItem({
        itemType: submissionPackageItemType.REPORT_SECTION,
        targetType: 'report-section',
        targetId: 'section_1_1',
        sectionKey: 'section-1-1-dup',
        sectionTitle: 'Duplicate target',
      }),
    ValidationError,
    'duplicate package targets should be rejected',
  );

  assert.throws(
    () =>
      submissionPackage.addItem({
        itemType: submissionPackageItemType.REPORT_SECTION,
        targetType: 'report-section',
        targetId: 'section_4_1',
      }),
    ValidationError,
    'governed-section items require section metadata',
  );

  assert.throws(
    () =>
      submissionPackage.addItem({
        itemType: submissionPackageItemType.WORKFLOW_TARGET,
        targetType: 'report-section',
        targetId: 'section_orphan',
        sectionKey: 'missing-section',
      }),
    ValidationError,
    'non-section items cannot reference unknown section keys',
  );

  submissionPackage.reorderItem(workflowItem.id, 1);
  assert.equal(submissionPackage.items[0].id, workflowItem.id);
  assert.equal(submissionPackage.items[0].sequence, 1);
  assert.equal(submissionPackage.items[1].id, sectionItem.id);
  assert.equal(submissionPackage.items[1].sequence, 2);

  assert.throws(
    () => submissionPackage.removeItem(sectionItem.id),
    ValidationError,
    'cannot remove a governed section while other items still reference its section key',
  );

  submissionPackage.removeItem(evidenceInclusion.id);
  submissionPackage.removeItem(workflowItem.id);
  submissionPackage.removeItem(sectionItem.id);
  assert.equal(submissionPackage.items.length, 0);

  const nonFinalSnapshot = submissionPackage.captureSnapshot({
    milestoneLabel: 'internal-checkpoint',
    actorId: 'person_faculty_1',
  });
  assert.equal(nonFinalSnapshot.versionNumber, 1);
  assert.equal(nonFinalSnapshot.finalized, false);
  assert.equal(submissionPackage.status, submissionPackageStatus.DRAFT);

  const finalSnapshot = submissionPackage.finalize({
    milestoneLabel: 'governance-submission',
    actorId: 'person_admin_1',
  });
  assert.equal(finalSnapshot.versionNumber, 2);
  assert.equal(finalSnapshot.finalized, true);
  assert.equal(submissionPackage.status, submissionPackageStatus.FINALIZED);
  assert.ok(submissionPackage.finalizedAt);

  assert.throws(
    () =>
      submissionPackage.addItem({
        itemType: submissionPackageItemType.REPORT_SECTION,
        targetType: 'report-section',
        targetId: 'section_9_9',
        sectionKey: 'section-9-9',
        sectionTitle: 'Locked',
      }),
    ValidationError,
    'finalized package should reject item edits',
  );

  assert.throws(
    () => submissionPackage.reorderItem(workflowItem.id, 1),
    ValidationError,
    'finalized package should reject reordering',
  );

  assert.throws(
    () =>
      SubmissionPackage.rehydrate({
        ...submissionPackage,
        status: submissionPackageStatus.FINALIZED,
        finalizedAt: null,
      } as any),
    ValidationError,
    'finalized packages require finalizedAt',
  );
}
