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

export const submissionPackageItemAssemblyRole = Object.freeze({
  GOVERNED_SECTION: 'governed-section',
  WORKFLOW_TARGET: 'workflow-target',
  EVIDENCE_INCLUSION: 'evidence-inclusion',
});

export const submissionPackageSectionTargetType = Object.freeze({
  REPORT_SECTION: 'report-section',
  NARRATIVE_SECTION: 'narrative-section',
});

export const SUBMISSION_PACKAGE_ITEM_TYPE_VALUES = Object.freeze(Object.values(submissionPackageItemType));
export const SUBMISSION_PACKAGE_ITEM_ASSEMBLY_ROLE_VALUES = Object.freeze(
  Object.values(submissionPackageItemAssemblyRole),
);
export const SUBMISSION_PACKAGE_SECTION_TARGET_TYPE_VALUES = Object.freeze(
  Object.values(submissionPackageSectionTargetType),
);

export function parseSubmissionPackageStatus(value, field = 'SubmissionPackage.status') {
  assertOneOf(value, field, Object.values(submissionPackageStatus));
  return value;
}

export function parseSubmissionPackageItemType(value, field = 'SubmissionPackageItem.itemType') {
  assertOneOf(value, field, SUBMISSION_PACKAGE_ITEM_TYPE_VALUES);
  return value;
}

export function parseSubmissionPackageItemAssemblyRole(
  value,
  field = 'SubmissionPackageItem.assemblyRole',
) {
  assertOneOf(value, field, SUBMISSION_PACKAGE_ITEM_ASSEMBLY_ROLE_VALUES);
  return value;
}

export function normalizeSubmissionPackageItemAssemblyRole(input = {}) {
  const provided = input.assemblyRole;
  if (provided) {
    return parseSubmissionPackageItemAssemblyRole(provided);
  }

  switch (input.itemType) {
    case submissionPackageItemType.REPORT_SECTION:
    case submissionPackageItemType.NARRATIVE_SECTION:
      return submissionPackageItemAssemblyRole.GOVERNED_SECTION;
    case submissionPackageItemType.EVIDENCE_ITEM:
      return submissionPackageItemAssemblyRole.EVIDENCE_INCLUSION;
    default:
      return submissionPackageItemAssemblyRole.WORKFLOW_TARGET;
  }
}

export function parseSubmissionPackageSectionTargetType(
  value,
  field = 'SubmissionPackageItem.targetType',
) {
  assertOneOf(value, field, SUBMISSION_PACKAGE_SECTION_TARGET_TYPE_VALUES);
  return value;
}
