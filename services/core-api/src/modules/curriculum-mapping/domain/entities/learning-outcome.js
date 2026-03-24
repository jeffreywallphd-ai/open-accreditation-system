import { assertOneOf, assertRequired, assertString } from '../../../shared/kernel/assertions.js';
import { ValidationError } from '../../../shared/kernel/errors.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import { recordStatus } from '../../../shared/value-objects/statuses.js';

export const learningOutcomeScopeType = Object.freeze({
  INSTITUTION: 'institution',
  PROGRAM: 'program',
  COURSE: 'course',
});

export class LearningOutcome {
  constructor(props) {
    assertRequired(props.id, 'LearningOutcome.id');
    assertRequired(props.institutionId, 'LearningOutcome.institutionId');
    assertString(props.code, 'LearningOutcome.code');
    assertString(props.title, 'LearningOutcome.title');
    assertString(props.statement, 'LearningOutcome.statement');
    assertOneOf(props.scopeType, 'LearningOutcome.scopeType', Object.values(learningOutcomeScopeType));
    assertOneOf(props.status, 'LearningOutcome.status', Object.values(recordStatus));

    if (props.scopeType === learningOutcomeScopeType.PROGRAM && !props.programId) {
      throw new ValidationError('LearningOutcome.programId is required when scopeType is program');
    }
    if (props.scopeType !== learningOutcomeScopeType.PROGRAM && props.programId) {
      throw new ValidationError('LearningOutcome.programId is only allowed when scopeType is program');
    }
    if (props.scopeType === learningOutcomeScopeType.COURSE && !props.courseId) {
      throw new ValidationError('LearningOutcome.courseId is required when scopeType is course');
    }
    if (props.scopeType !== learningOutcomeScopeType.COURSE && props.courseId) {
      throw new ValidationError('LearningOutcome.courseId is only allowed when scopeType is course');
    }

    this.id = props.id;
    this.institutionId = props.institutionId;
    this.code = props.code;
    this.title = props.title;
    this.statement = props.statement;
    this.scopeType = props.scopeType;
    this.programId = props.programId ?? null;
    this.courseId = props.courseId ?? null;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new LearningOutcome({
      id: input.id ?? createId('outcome'),
      institutionId: input.institutionId,
      code: input.code,
      title: input.title,
      statement: input.statement,
      scopeType: input.scopeType ?? learningOutcomeScopeType.PROGRAM,
      programId: input.programId,
      courseId: input.courseId,
      status: input.status ?? recordStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
  }
}
