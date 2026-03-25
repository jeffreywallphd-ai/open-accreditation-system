import assert from 'node:assert/strict';
import { ValidationError } from '../../src/modules/shared/kernel/errors.js';
import {
  SubmissionPackage,
} from '../../src/modules/narratives-reporting/domain/entities/submission-package.js';
import {
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

  const itemA = submissionPackage.addItem({
    itemType: submissionPackageItemType.REPORT_SECTION,
    targetType: 'report-section',
    targetId: 'section_1_1',
    evidenceItemIds: ['ev_1', 'ev_2'],
    label: 'Mission and strategy',
  });
  const itemB = submissionPackage.addItem({
    itemType: submissionPackageItemType.WORKFLOW_TARGET,
    targetType: 'report-section',
    targetId: 'section_2_1',
    evidenceItemIds: ['ev_3'],
  });

  assert.equal(itemA.sequence, 1);
  assert.equal(itemB.sequence, 2);

  assert.throws(
    () =>
      submissionPackage.addItem({
        itemType: submissionPackageItemType.REPORT_SECTION,
        targetType: 'report-section',
        targetId: 'section_1_1',
      }),
    ValidationError,
    'duplicate package targets should be rejected',
  );

  submissionPackage.reorderItem(itemB.id, 1);
  assert.equal(submissionPackage.items[0].id, itemB.id);
  assert.equal(submissionPackage.items[0].sequence, 1);
  assert.equal(submissionPackage.items[1].id, itemA.id);
  assert.equal(submissionPackage.items[1].sequence, 2);

  submissionPackage.removeItem(itemA.id);
  assert.equal(submissionPackage.items.length, 1);
  assert.equal(submissionPackage.items[0].sequence, 1);

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
      }),
    ValidationError,
    'finalized package should reject item edits',
  );

  assert.throws(
    () => submissionPackage.reorderItem(itemB.id, 1),
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
