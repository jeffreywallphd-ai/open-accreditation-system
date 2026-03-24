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
