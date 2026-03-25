import { assertOneOf } from '../../../shared/kernel/assertions.js';

export const narrativeStatus = Object.freeze({
  DRAFT: 'draft',
  IN_REVIEW: 'in-review',
  FINALIZED: 'finalized',
});

export const narrativeSectionType = Object.freeze({
  REPORT_SECTION: 'report-section',
  NARRATIVE_SECTION: 'narrative-section',
});

export const narrativeEvidenceLinkType = Object.freeze({
  PRIMARY_SUPPORT: 'primary-support',
  SUPPORTING: 'supporting',
  CITATION: 'citation',
});

export const narrativePackageLinkType = Object.freeze({
  GOVERNING_SECTION: 'governing-section',
  INCLUDED_ITEM: 'included-item',
});

export const NARRATIVE_STATUS_VALUES = Object.freeze(Object.values(narrativeStatus));
export const NARRATIVE_SECTION_TYPE_VALUES = Object.freeze(Object.values(narrativeSectionType));
export const NARRATIVE_EVIDENCE_LINK_TYPE_VALUES = Object.freeze(Object.values(narrativeEvidenceLinkType));
export const NARRATIVE_PACKAGE_LINK_TYPE_VALUES = Object.freeze(Object.values(narrativePackageLinkType));

export function parseNarrativeStatus(value, field = 'Narrative.status') {
  assertOneOf(value, field, NARRATIVE_STATUS_VALUES);
  return value;
}

export function parseNarrativeSectionType(value, field = 'NarrativeSection.sectionType') {
  assertOneOf(value, field, NARRATIVE_SECTION_TYPE_VALUES);
  return value;
}

export function parseNarrativeEvidenceLinkType(value, field = 'NarrativeSectionEvidenceLink.relationshipType') {
  assertOneOf(value, field, NARRATIVE_EVIDENCE_LINK_TYPE_VALUES);
  return value;
}

export function parseNarrativePackageLinkType(value, field = 'NarrativeSectionPackageLink.linkType') {
  assertOneOf(value, field, NARRATIVE_PACKAGE_LINK_TYPE_VALUES);
  return value;
}
