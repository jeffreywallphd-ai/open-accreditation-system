import { assertDateOrder, assertOneOf, assertRequired, assertString } from '../../../shared/kernel/assertions.js';
import { ValidationError } from '../../../shared/kernel/errors.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';

export const institutionalScopeType = Object.freeze({
  INSTITUTION: 'institution',
  ORGANIZATION_UNIT: 'organization-unit',
  PROGRAM: 'program',
  COURSE: 'course',
});

export const assessmentStatus = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CLOSED: 'closed',
});

export class Assessment {
  constructor(props) {
    assertRequired(props.id, 'Assessment.id');
    assertRequired(props.institutionId, 'Assessment.institutionId');
    assertString(props.name, 'Assessment.name');
    assertString(props.assessmentType, 'Assessment.assessmentType');
    assertOneOf(props.status, 'Assessment.status', Object.values(assessmentStatus));
    assertDateOrder(props.startDate, props.endDate, 'Assessment.startDate', 'Assessment.endDate');

    if (!props.programId && !props.courseId) {
      throw new ValidationError('Assessment must reference at least one of programId or courseId');
    }

    this.id = props.id;
    this.institutionId = props.institutionId;
    this.programId = props.programId ?? null;
    this.courseId = props.courseId ?? null;
    this.reportingPeriodId = props.reportingPeriodId ?? null;
    this.reviewCycleId = props.reviewCycleId ?? null;
    this.name = props.name;
    this.assessmentType = props.assessmentType;
    this.startDate = props.startDate ?? null;
    this.endDate = props.endDate ?? null;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new Assessment({
      id: input.id ?? createId('assessment'),
      institutionId: input.institutionId,
      programId: input.programId,
      courseId: input.courseId,
      reportingPeriodId: input.reportingPeriodId,
      reviewCycleId: input.reviewCycleId,
      name: input.name,
      assessmentType: input.assessmentType,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status ?? assessmentStatus.DRAFT,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export class AssessmentOutcomeLink {
  constructor(props) {
    assertRequired(props.id, 'AssessmentOutcomeLink.id');
    assertRequired(props.assessmentId, 'AssessmentOutcomeLink.assessmentId');
    assertRequired(props.learningOutcomeId, 'AssessmentOutcomeLink.learningOutcomeId');

    this.id = props.id;
    this.assessmentId = props.assessmentId;
    this.learningOutcomeId = props.learningOutcomeId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new AssessmentOutcomeLink({
      id: input.id ?? createId('assessment_outcome'),
      assessmentId: input.assessmentId,
      learningOutcomeId: input.learningOutcomeId,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export class AssessmentArtifact {
  constructor(props) {
    assertRequired(props.id, 'AssessmentArtifact.id');
    assertRequired(props.institutionId, 'AssessmentArtifact.institutionId');
    assertString(props.name, 'AssessmentArtifact.name');
    assertString(props.artifactType, 'AssessmentArtifact.artifactType');
    assertOneOf(props.scopeType, 'AssessmentArtifact.scopeType', Object.values(institutionalScopeType));

    if (!props.assessmentId && !props.learningOutcomeId) {
      throw new ValidationError('AssessmentArtifact must reference assessmentId and/or learningOutcomeId');
    }

    if (props.scopeType === institutionalScopeType.INSTITUTION && props.scopeEntityId) {
      throw new ValidationError('AssessmentArtifact.scopeEntityId must be empty when scopeType is institution');
    }

    if (props.scopeType !== institutionalScopeType.INSTITUTION && !props.scopeEntityId) {
      throw new ValidationError('AssessmentArtifact.scopeEntityId is required for non-institution scopes');
    }

    this.id = props.id;
    this.institutionId = props.institutionId;
    this.assessmentId = props.assessmentId ?? null;
    this.learningOutcomeId = props.learningOutcomeId ?? null;
    this.reportingPeriodId = props.reportingPeriodId ?? null;
    this.reviewCycleId = props.reviewCycleId ?? null;
    this.scopeType = props.scopeType;
    this.scopeEntityId = props.scopeEntityId ?? null;
    this.name = props.name;
    this.artifactType = props.artifactType;
    this.description = props.description ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new AssessmentArtifact({
      id: input.id ?? createId('artifact'),
      institutionId: input.institutionId,
      assessmentId: input.assessmentId,
      learningOutcomeId: input.learningOutcomeId,
      reportingPeriodId: input.reportingPeriodId,
      reviewCycleId: input.reviewCycleId,
      scopeType: input.scopeType ?? institutionalScopeType.INSTITUTION,
      scopeEntityId: input.scopeEntityId,
      name: input.name,
      artifactType: input.artifactType,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    });
  }
}
