import { ValidationError } from '../../../shared/kernel/errors.js';
import {
  evidenceReferenceTargetType,
  parseEvidenceReferenceTargetType,
} from './evidence-classifications.js';

const TARGET_ANCHOR_REQUIREMENTS = Object.freeze({
  [evidenceReferenceTargetType.CRITERION]: 'optional',
  [evidenceReferenceTargetType.CRITERION_ELEMENT]: 'optional',
  [evidenceReferenceTargetType.LEARNING_OUTCOME]: 'optional',
  [evidenceReferenceTargetType.NARRATIVE_SECTION]: 'required',
});

const MAX_REFERENCE_RATIONALE_LENGTH = 1000;
const MAX_REFERENCE_ANCHOR_PATH_LENGTH = 512;

function normalizeOptionalString(value, field, maxLength) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a string when provided`);
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length > maxLength) {
    throw new ValidationError(`${field} must be ${maxLength} characters or fewer`);
  }
  return normalized;
}

export function getEvidenceReferenceAnchorRequirement(targetType) {
  parseEvidenceReferenceTargetType(targetType, 'EvidenceReference.targetType');
  return TARGET_ANCHOR_REQUIREMENTS[targetType] ?? 'optional';
}

export function normalizeEvidenceReferenceInput(input) {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('EvidenceReference input is required');
  }

  const normalizedTargetType = parseEvidenceReferenceTargetType(input.targetType, 'EvidenceReference.targetType');
  if (!input.targetEntityId || typeof input.targetEntityId !== 'string' || input.targetEntityId.trim() === '') {
    throw new ValidationError('EvidenceReference.targetEntityId is required');
  }

  const normalizedAnchorPath = normalizeOptionalString(
    input.anchorPath,
    'EvidenceReference.anchorPath',
    MAX_REFERENCE_ANCHOR_PATH_LENGTH,
  );
  const normalizedRationale = normalizeOptionalString(
    input.rationale,
    'EvidenceReference.rationale',
    MAX_REFERENCE_RATIONALE_LENGTH,
  );

  const anchorRequirement = getEvidenceReferenceAnchorRequirement(normalizedTargetType);
  if (anchorRequirement === 'required' && !normalizedAnchorPath) {
    throw new ValidationError(`EvidenceReference.anchorPath is required for targetType=${normalizedTargetType}`);
  }
  if (anchorRequirement === 'forbidden' && normalizedAnchorPath) {
    throw new ValidationError(`EvidenceReference.anchorPath is not allowed for targetType=${normalizedTargetType}`);
  }

  return {
    ...input,
    targetType: normalizedTargetType,
    targetEntityId: input.targetEntityId.trim(),
    anchorPath: normalizedAnchorPath,
    rationale: normalizedRationale,
  };
}
