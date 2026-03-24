import { assertRequired } from '../../../shared/kernel/assertions.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';

export class CourseOutcomeMap {
  constructor(props) {
    assertRequired(props.id, 'CourseOutcomeMap.id');
    assertRequired(props.courseId, 'CourseOutcomeMap.courseId');
    assertRequired(props.learningOutcomeId, 'CourseOutcomeMap.learningOutcomeId');

    this.id = props.id;
    this.courseId = props.courseId;
    this.learningOutcomeId = props.learningOutcomeId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new CourseOutcomeMap({
      id: input.id ?? createId('course_outcome'),
      courseId: input.courseId,
      learningOutcomeId: input.learningOutcomeId,
      createdAt: now,
      updatedAt: now,
    });
  }
}
