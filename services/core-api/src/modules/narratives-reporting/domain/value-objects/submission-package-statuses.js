import { assertOneOf } from '../../../shared/kernel/assertions.js';

export const submissionPackageStatus = Object.freeze({
  DRAFT: 'draft',
  FINALIZED: 'finalized',
});

export const submissionPackageItemType = Object.freeze({
  WORKFLOW_TARGET: 'workflow-target',
  REPORT_SECTION: 'report-section',
  NARRATIVE_SECTION: 'narrative-section',
  EVIDENCE_ITEM: 'evidence-item',
});

export function parseSubmissionPackageStatus(value, field = 'SubmissionPackage.status') {
  assertOneOf(value, field, Object.values(submissionPackageStatus));
  return value;
}

export function parseSubmissionPackageItemType(value, field = 'SubmissionPackageItem.itemType') {
  assertOneOf(value, field, Object.values(submissionPackageItemType));
  return value;
}
