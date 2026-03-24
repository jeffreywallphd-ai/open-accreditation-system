import { assertOneOf } from '../../../shared/kernel/assertions.js';

export const evidenceType = Object.freeze({
  DOCUMENT: 'document',
  METRIC: 'metric',
  NARRATIVE: 'narrative',
  DATASET: 'dataset',
  ASSESSMENT_ARTIFACT: 'assessment-artifact',
});
export const EVIDENCE_TYPE_VALUES = Object.freeze(Object.values(evidenceType));

export const evidenceSourceType = Object.freeze({
  MANUAL: 'manual',
  UPLOAD: 'upload',
  INTEGRATION: 'integration',
});
export const EVIDENCE_SOURCE_TYPE_VALUES = Object.freeze(Object.values(evidenceSourceType));

export const evidenceStatus = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  SUPERSEDED: 'superseded',
  INCOMPLETE: 'incomplete',
  ARCHIVED: 'archived',
});
export const EVIDENCE_STATUS_VALUES = Object.freeze(Object.values(evidenceStatus));

export const evidenceArtifactStatus = Object.freeze({
  AVAILABLE: 'available',
  QUARANTINED: 'quarantined',
  REMOVED: 'removed',
});
export const EVIDENCE_ARTIFACT_STATUS_VALUES = Object.freeze(Object.values(evidenceArtifactStatus));

const EVIDENCE_TYPES_REQUIRING_ARTIFACT_FOR_ACTIVATION_SET = new Set([
  evidenceType.DOCUMENT,
  evidenceType.DATASET,
  evidenceType.ASSESSMENT_ARTIFACT,
]);

export function parseEvidenceType(value, field = 'EvidenceItem.evidenceType') {
  assertOneOf(value, field, EVIDENCE_TYPE_VALUES);
  return value;
}

export function parseEvidenceSourceType(value, field = 'EvidenceItem.sourceType') {
  assertOneOf(value, field, EVIDENCE_SOURCE_TYPE_VALUES);
  return value;
}

export function parseEvidenceStatus(value, field = 'EvidenceItem.status') {
  assertOneOf(value, field, EVIDENCE_STATUS_VALUES);
  return value;
}

export function parseEvidenceArtifactStatus(value, field = 'EvidenceArtifact.status') {
  assertOneOf(value, field, EVIDENCE_ARTIFACT_STATUS_VALUES);
  return value;
}

export function requiresArtifactForActivation({ evidenceType: itemType, sourceType }) {
  return sourceType === evidenceSourceType.UPLOAD || EVIDENCE_TYPES_REQUIRING_ARTIFACT_FOR_ACTIVATION_SET.has(itemType);
}
