import { ValidationError } from '../../shared/kernel/errors.js';
import { evidenceReferenceTargetType } from '../domain/value-objects/evidence-classifications.js';
import { normalizeEvidenceReferenceInput } from '../domain/value-objects/evidence-reference-policy.js';

export class EvidenceReferenceTargetValidatorRegistry {
  constructor(validators = []) {
    this.validatorsByType = new Map();
    for (const validator of validators) {
      this.register(validator);
    }
  }

  register(validator) {
    if (!validator?.targetType || typeof validator.validate !== 'function') {
      throw new ValidationError('EvidenceReference target validator must define targetType and validate()');
    }
    if (this.validatorsByType.has(validator.targetType)) {
      throw new ValidationError(
        `Duplicate EvidenceReference target validator registered for targetType=${validator.targetType}`,
      );
    }
    this.validatorsByType.set(validator.targetType, validator);
  }

  get(targetType) {
    return this.validatorsByType.get(targetType) ?? null;
  }
}

function makeAccreditationTargetValidator({ targetType, getterName, label, accreditationFrameworksService }) {
  return {
    targetType,
    async validate({ targetEntityId }) {
      const getter = accreditationFrameworksService?.[getterName];
      if (typeof getter !== 'function') {
        return {
          exists: false,
          admissible: false,
          reason: `${label} target validation contract is unavailable`,
        };
      }
      const target = await getter.call(accreditationFrameworksService, targetEntityId);
      return {
        exists: Boolean(target),
        admissible: Boolean(target),
      };
    },
  };
}

export function createDefaultEvidenceReferenceTargetValidators({
  accreditationFrameworksService,
  curriculumMappingService,
  narrativesReportingService,
} = {}) {
  const validators = [
    makeAccreditationTargetValidator({
      targetType: evidenceReferenceTargetType.CRITERION,
      getterName: 'getCriterionById',
      label: 'Criterion',
      accreditationFrameworksService,
    }),
    makeAccreditationTargetValidator({
      targetType: evidenceReferenceTargetType.CRITERION_ELEMENT,
      getterName: 'getCriterionElementById',
      label: 'CriterionElement',
      accreditationFrameworksService,
    }),
    {
      targetType: evidenceReferenceTargetType.LEARNING_OUTCOME,
      async validate({ targetEntityId }) {
        const getter = curriculumMappingService?.getLearningOutcomeById;
        if (typeof getter !== 'function') {
          return {
            exists: false,
            admissible: false,
            reason: 'LearningOutcome target validation contract is unavailable',
          };
        }
        const outcome = await getter.call(curriculumMappingService, targetEntityId);
        return {
          exists: Boolean(outcome),
          admissible: Boolean(outcome),
          institutionId: outcome?.institutionId ?? null,
        };
      },
    },
    {
      targetType: evidenceReferenceTargetType.NARRATIVE_SECTION,
      async validate({ targetEntityId }) {
        const getter = narrativesReportingService?.getNarrativeSectionById;
        if (typeof getter !== 'function') {
          return {
            exists: false,
            admissible: false,
            reason: 'NarrativeSection target validation contract is unavailable',
          };
        }
        const section = await getter.call(narrativesReportingService, targetEntityId);
        return {
          exists: Boolean(section),
          admissible: Boolean(section),
          institutionId: section?.institutionId ?? null,
        };
      },
    },
  ];

  return new EvidenceReferenceTargetValidatorRegistry(validators);
}

export function normalizeAndValidateReferenceInput(input) {
  return normalizeEvidenceReferenceInput(input);
}
