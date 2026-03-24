import { assertDateOrder, assertOneOf, assertRequired, assertString } from '../../../shared/kernel/assertions.js';
import { ValidationError } from '../../../shared/kernel/errors.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import { frameworkVersionStatus } from '../value-objects/accreditation-statuses.js';

function assertArrayUnique(items, keySelector, message) {
  const seen = new Set();
  for (const item of items) {
    const key = keySelector(item);
    if (seen.has(key)) {
      throw new ValidationError(message);
    }
    seen.add(key);
  }
}

export class Standard {
  constructor(props) {
    assertRequired(props.id, 'Standard.id');
    assertRequired(props.frameworkVersionId, 'Standard.frameworkVersionId');
    assertString(props.code, 'Standard.code');
    assertString(props.title, 'Standard.title');

    this.id = props.id;
    this.frameworkVersionId = props.frameworkVersionId;
    this.code = props.code;
    this.title = props.title;
    this.description = props.description ?? null;
    this.sequence = props.sequence ?? 0;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new Standard({
      id: input.id ?? createId('std'),
      frameworkVersionId: input.frameworkVersionId,
      code: input.code,
      title: input.title,
      description: input.description,
      sequence: input.sequence,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export class Criterion {
  constructor(props) {
    assertRequired(props.id, 'Criterion.id');
    assertRequired(props.frameworkVersionId, 'Criterion.frameworkVersionId');
    assertRequired(props.standardId, 'Criterion.standardId');
    assertString(props.code, 'Criterion.code');
    assertString(props.title, 'Criterion.title');

    this.id = props.id;
    this.frameworkVersionId = props.frameworkVersionId;
    this.standardId = props.standardId;
    this.code = props.code;
    this.title = props.title;
    this.statement = props.statement ?? null;
    this.sequence = props.sequence ?? 0;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new Criterion({
      id: input.id ?? createId('crit'),
      frameworkVersionId: input.frameworkVersionId,
      standardId: input.standardId,
      code: input.code,
      title: input.title,
      statement: input.statement,
      sequence: input.sequence,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export class CriterionElement {
  constructor(props) {
    assertRequired(props.id, 'CriterionElement.id');
    assertRequired(props.frameworkVersionId, 'CriterionElement.frameworkVersionId');
    assertRequired(props.criterionId, 'CriterionElement.criterionId');
    assertString(props.code, 'CriterionElement.code');
    assertString(props.title, 'CriterionElement.title');
    assertString(props.statement, 'CriterionElement.statement');
    assertDateOrder(props.effectiveStartDate, props.effectiveEndDate);

    this.id = props.id;
    this.frameworkVersionId = props.frameworkVersionId;
    this.criterionId = props.criterionId;
    this.code = props.code;
    this.title = props.title;
    this.statement = props.statement;
    this.elementType = props.elementType ?? 'indicator';
    this.requiredFlag = props.requiredFlag ?? true;
    this.sequence = props.sequence ?? 0;
    this.effectiveStartDate = props.effectiveStartDate ?? null;
    this.effectiveEndDate = props.effectiveEndDate ?? null;
    this.supersedesElementId = props.supersedesElementId ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new CriterionElement({
      id: input.id ?? createId('ce'),
      frameworkVersionId: input.frameworkVersionId,
      criterionId: input.criterionId,
      code: input.code,
      title: input.title,
      statement: input.statement,
      elementType: input.elementType,
      requiredFlag: input.requiredFlag,
      sequence: input.sequence,
      effectiveStartDate: input.effectiveStartDate,
      effectiveEndDate: input.effectiveEndDate,
      supersedesElementId: input.supersedesElementId,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export class EvidenceRequirement {
  constructor(props) {
    assertRequired(props.id, 'EvidenceRequirement.id');
    assertRequired(props.frameworkVersionId, 'EvidenceRequirement.frameworkVersionId');
    assertString(props.requirementCode, 'EvidenceRequirement.requirementCode');
    assertString(props.title, 'EvidenceRequirement.title');
    assertString(props.requirementType, 'EvidenceRequirement.requirementType');
    assertDateOrder(props.effectiveStartDate, props.effectiveEndDate);

    if (!props.criterionId && !props.criterionElementId) {
      throw new ValidationError('EvidenceRequirement must target criterionId or criterionElementId');
    }

    this.id = props.id;
    this.frameworkVersionId = props.frameworkVersionId;
    this.criterionId = props.criterionId ?? null;
    this.criterionElementId = props.criterionElementId ?? null;
    this.requirementCode = props.requirementCode;
    this.title = props.title;
    this.description = props.description ?? null;
    this.requirementType = props.requirementType;
    this.cardinalityRule = props.cardinalityRule ?? 'one-per-cycle';
    this.timingExpectation = props.timingExpectation ?? null;
    this.evidenceClass = props.evidenceClass ?? null;
    this.isMandatory = props.isMandatory ?? true;
    this.effectiveStartDate = props.effectiveStartDate ?? null;
    this.effectiveEndDate = props.effectiveEndDate ?? null;
    this.supersedesRequirementId = props.supersedesRequirementId ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new EvidenceRequirement({
      id: input.id ?? createId('erq'),
      frameworkVersionId: input.frameworkVersionId,
      criterionId: input.criterionId,
      criterionElementId: input.criterionElementId,
      requirementCode: input.requirementCode,
      title: input.title,
      description: input.description,
      requirementType: input.requirementType,
      cardinalityRule: input.cardinalityRule,
      timingExpectation: input.timingExpectation,
      evidenceClass: input.evidenceClass,
      isMandatory: input.isMandatory,
      effectiveStartDate: input.effectiveStartDate,
      effectiveEndDate: input.effectiveEndDate,
      supersedesRequirementId: input.supersedesRequirementId,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export class FrameworkVersion {
  constructor(props) {
    assertRequired(props.id, 'FrameworkVersion.id');
    assertRequired(props.frameworkId, 'FrameworkVersion.frameworkId');
    assertString(props.versionTag, 'FrameworkVersion.versionTag');
    assertOneOf(props.status, 'FrameworkVersion.status', Object.values(frameworkVersionStatus));
    assertDateOrder(props.effectiveStartDate, props.effectiveEndDate);

    this.id = props.id;
    this.frameworkId = props.frameworkId;
    this.versionTag = props.versionTag;
    this.status = props.status;
    this.publishedAt = props.publishedAt ?? null;
    this.effectiveStartDate = props.effectiveStartDate ?? null;
    this.effectiveEndDate = props.effectiveEndDate ?? null;
    this.standards = (props.standards ?? []).map((item) => (item instanceof Standard ? item : new Standard(item)));
    this.criteria = (props.criteria ?? []).map((item) => (item instanceof Criterion ? item : new Criterion(item)));
    this.criterionElements = (props.criterionElements ?? []).map((item) =>
      item instanceof CriterionElement ? item : new CriterionElement(item),
    );
    this.evidenceRequirements = (props.evidenceRequirements ?? []).map((item) =>
      item instanceof EvidenceRequirement ? item : new EvidenceRequirement(item),
    );
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;

    this.#assertStructuralIntegrity();
  }

  static create(input) {
    const now = nowIso();
    return new FrameworkVersion({
      id: input.id ?? createId('fwv'),
      frameworkId: input.frameworkId,
      versionTag: input.versionTag,
      status: input.status ?? frameworkVersionStatus.DRAFT,
      publishedAt: input.publishedAt,
      effectiveStartDate: input.effectiveStartDate,
      effectiveEndDate: input.effectiveEndDate,
      standards: [],
      criteria: [],
      criterionElements: [],
      evidenceRequirements: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  addStandard(input) {
    this.#assertStructureMutable();
    const standard = Standard.create({
      ...input,
      frameworkVersionId: this.id,
    });
    if (this.standards.some((item) => item.code === standard.code)) {
      throw new ValidationError(`Standard code already exists in framework version: ${standard.code}`);
    }
    this.standards.push(standard);
    this.updatedAt = nowIso();
    return standard;
  }

  addCriterion(input) {
    this.#assertStructureMutable();
    const standard = this.standards.find((item) => item.id === input.standardId);
    if (!standard) {
      throw new ValidationError(`Criterion.standardId not found in FrameworkVersion: ${input.standardId}`);
    }

    const criterion = Criterion.create({
      ...input,
      frameworkVersionId: this.id,
    });

    const hasDuplicateCode = this.criteria.some(
      (item) => item.standardId === criterion.standardId && item.code === criterion.code,
    );
    if (hasDuplicateCode) {
      throw new ValidationError(`Criterion code already exists in standard: ${criterion.code}`);
    }

    this.criteria.push(criterion);
    this.updatedAt = nowIso();
    return criterion;
  }

  addCriterionElement(input) {
    this.#assertStructureMutable();
    const criterion = this.criteria.find((item) => item.id === input.criterionId);
    if (!criterion) {
      throw new ValidationError(`CriterionElement.criterionId not found in FrameworkVersion: ${input.criterionId}`);
    }

    const element = CriterionElement.create({
      ...input,
      frameworkVersionId: this.id,
    });

    const hasDuplicateCode = this.criterionElements.some(
      (item) => item.criterionId === element.criterionId && item.code === element.code,
    );
    if (hasDuplicateCode) {
      throw new ValidationError(`CriterionElement code already exists in criterion: ${element.code}`);
    }

    this.criterionElements.push(element);
    this.updatedAt = nowIso();
    return element;
  }

  addEvidenceRequirement(input) {
    this.#assertStructureMutable();
    const requirement = EvidenceRequirement.create({
      ...input,
      frameworkVersionId: this.id,
    });

    if (requirement.criterionId && !this.criteria.some((item) => item.id === requirement.criterionId)) {
      throw new ValidationError(`EvidenceRequirement.criterionId not found in FrameworkVersion: ${requirement.criterionId}`);
    }

    if (requirement.criterionElementId) {
      const element = this.criterionElements.find((item) => item.id === requirement.criterionElementId);
      if (!element) {
        throw new ValidationError(
          `EvidenceRequirement.criterionElementId not found in FrameworkVersion: ${requirement.criterionElementId}`,
        );
      }

      if (requirement.criterionId && element.criterionId !== requirement.criterionId) {
        throw new ValidationError('EvidenceRequirement.criterionId must match CriterionElement.criterionId when both set');
      }
    }

    if (this.evidenceRequirements.some((item) => item.requirementCode === requirement.requirementCode)) {
      throw new ValidationError(`EvidenceRequirement requirementCode already exists: ${requirement.requirementCode}`);
    }

    this.evidenceRequirements.push(requirement);
    this.updatedAt = nowIso();
    return requirement;
  }

  publish(publishedAt = nowIso()) {
    if (this.status === frameworkVersionStatus.PUBLISHED) {
      return this;
    }

    if (this.status === frameworkVersionStatus.RETIRED) {
      throw new ValidationError('Retired FrameworkVersion cannot be published');
    }

    if (this.standards.length === 0) {
      throw new ValidationError('FrameworkVersion must include at least one Standard before publication');
    }

    if (this.criteria.length === 0) {
      throw new ValidationError('FrameworkVersion must include at least one Criterion before publication');
    }

    this.#assertStructuralIntegrity();

    this.status = frameworkVersionStatus.PUBLISHED;
    this.publishedAt = publishedAt;
    this.updatedAt = nowIso();
    return this;
  }

  retire() {
    if (this.status !== frameworkVersionStatus.PUBLISHED) {
      throw new ValidationError('Only published FrameworkVersion can be retired');
    }
    this.status = frameworkVersionStatus.RETIRED;
    this.updatedAt = nowIso();
    return this;
  }

  #assertStructureMutable() {
    if (this.status !== frameworkVersionStatus.DRAFT) {
      throw new ValidationError('FrameworkVersion structure is immutable unless status is draft');
    }
  }

  #assertStructuralIntegrity() {
    assertArrayUnique(this.standards, (item) => item.code, 'Standard.code must be unique within a FrameworkVersion');
    assertArrayUnique(
      this.criteria.map((item) => `${item.standardId}::${item.code}`),
      (item) => item,
      'Criterion.code must be unique within its parent Standard',
    );
    assertArrayUnique(
      this.criterionElements.map((item) => `${item.criterionId}::${item.code}`),
      (item) => item,
      'CriterionElement.code must be unique within its parent Criterion',
    );
    assertArrayUnique(
      this.evidenceRequirements,
      (item) => item.requirementCode,
      'EvidenceRequirement.requirementCode must be unique within a FrameworkVersion',
    );

    for (const standard of this.standards) {
      if (standard.frameworkVersionId !== this.id) {
        throw new ValidationError(`Standard.frameworkVersionId must match FrameworkVersion.id: ${standard.id}`);
      }
    }

    for (const criterion of this.criteria) {
      if (criterion.frameworkVersionId !== this.id) {
        throw new ValidationError(`Criterion.frameworkVersionId must match FrameworkVersion.id: ${criterion.id}`);
      }
      if (!this.standards.some((item) => item.id === criterion.standardId)) {
        throw new ValidationError(`Criterion.standardId not found in FrameworkVersion: ${criterion.standardId}`);
      }
    }

    for (const criterionElement of this.criterionElements) {
      if (criterionElement.frameworkVersionId !== this.id) {
        throw new ValidationError(
          `CriterionElement.frameworkVersionId must match FrameworkVersion.id: ${criterionElement.id}`,
        );
      }
      if (!this.criteria.some((item) => item.id === criterionElement.criterionId)) {
        throw new ValidationError(`CriterionElement.criterionId not found in FrameworkVersion: ${criterionElement.criterionId}`);
      }
    }

    for (const evidenceRequirement of this.evidenceRequirements) {
      if (evidenceRequirement.frameworkVersionId !== this.id) {
        throw new ValidationError(
          `EvidenceRequirement.frameworkVersionId must match FrameworkVersion.id: ${evidenceRequirement.id}`,
        );
      }

      if (
        evidenceRequirement.criterionId &&
        !this.criteria.some((item) => item.id === evidenceRequirement.criterionId)
      ) {
        throw new ValidationError(
          `EvidenceRequirement.criterionId not found in FrameworkVersion: ${evidenceRequirement.criterionId}`,
        );
      }

      if (evidenceRequirement.criterionElementId) {
        const element = this.criterionElements.find((item) => item.id === evidenceRequirement.criterionElementId);
        if (!element) {
          throw new ValidationError(
            `EvidenceRequirement.criterionElementId not found in FrameworkVersion: ${evidenceRequirement.criterionElementId}`,
          );
        }
        if (evidenceRequirement.criterionId && element.criterionId !== evidenceRequirement.criterionId) {
          throw new ValidationError(
            'EvidenceRequirement.criterionId must match CriterionElement.criterionId when both set',
          );
        }
      }
    }

    for (const standard of this.standards) {
      const standardCriteria = this.criteria.filter((item) => item.standardId === standard.id);
      if (this.status === frameworkVersionStatus.PUBLISHED && standardCriteria.length === 0) {
        throw new ValidationError(`Standard must include at least one Criterion before publication: ${standard.id}`);
      }
    }

    for (const criterion of this.criteria) {
      const criterionElements = this.criterionElements.filter((item) => item.criterionId === criterion.id);
      if (this.status === frameworkVersionStatus.PUBLISHED && criterionElements.length === 0) {
        throw new ValidationError(`Criterion must include at least one CriterionElement before publication: ${criterion.id}`);
      }
    }
  }
}
