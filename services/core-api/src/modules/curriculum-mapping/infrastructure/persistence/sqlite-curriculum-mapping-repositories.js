import {
  AssessmentArtifactRepository,
  AssessmentOutcomeLinkRepository,
  AssessmentRepository,
  CourseOutcomeMapRepository,
  CourseRepository,
  LearningOutcomeRepository,
  ProgramRepository,
} from '../../domain/repositories/repositories.js';
import { Program } from '../../domain/entities/program.js';
import { Course } from '../../domain/entities/course.js';
import { CourseOutcomeMap } from '../../domain/entities/course-outcome-map.js';
import { Assessment, AssessmentArtifact, AssessmentOutcomeLink } from '../../domain/entities/assessment.js';
import { LearningOutcome } from '../../domain/entities/learning-outcome.js';

function filterClause(filter = {}, keyMap = {}) {
  const where = [];
  const params = {};
  for (const [filterKey, column] of Object.entries(keyMap)) {
    const value = filter[filterKey];
    if (value === undefined || value === null) {
      continue;
    }
    where.push(`${column} = @${filterKey}`);
    params[filterKey] = value;
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export class SqliteProgramRepository extends ProgramRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(program) {
    this.database.run(
      `INSERT INTO curriculum_mapping_programs
       (id, institution_id, name, code, description, status, created_at, updated_at)
       VALUES (@id, @institutionId, @name, @code, @description, @status, @createdAt, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         institution_id=excluded.institution_id, name=excluded.name, code=excluded.code,
         description=excluded.description, status=excluded.status, updated_at=excluded.updated_at`,
      {
        id: program.id,
        institutionId: program.institutionId,
        name: program.name,
        code: program.code,
        description: program.description,
        status: program.status,
        createdAt: program.createdAt,
        updatedAt: program.updatedAt,
      },
    );
    return program;
  }

  async getById(id) {
    const row = this.database.get('SELECT * FROM curriculum_mapping_programs WHERE id = @id', { id });
    return row
      ? new Program({
          id: row.id,
          institutionId: row.institution_id,
          name: row.name,
          code: row.code,
          description: row.description,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })
      : null;
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      institutionId: 'institution_id',
      code: 'code',
      status: 'status',
    });
    const rows = this.database.all(`SELECT * FROM curriculum_mapping_programs ${sql} ORDER BY created_at ASC`, params);
    return rows.map(
      (row) =>
        new Program({
          id: row.id,
          institutionId: row.institution_id,
          name: row.name,
          code: row.code,
          description: row.description,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }),
    );
  }
}

export class SqliteCourseRepository extends CourseRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(course) {
    this.database.run(
      `INSERT INTO curriculum_mapping_courses
       (id, institution_id, program_id, owning_organization_unit_id, name, code, description, status, created_at, updated_at)
       VALUES (@id, @institutionId, @programId, @owningOrganizationUnitId, @name, @code, @description, @status, @createdAt, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         institution_id=excluded.institution_id, program_id=excluded.program_id,
         owning_organization_unit_id=excluded.owning_organization_unit_id,
         name=excluded.name, code=excluded.code, description=excluded.description,
         status=excluded.status, updated_at=excluded.updated_at`,
      {
        id: course.id,
        institutionId: course.institutionId,
        programId: course.programId,
        owningOrganizationUnitId: course.owningOrganizationUnitId,
        name: course.name,
        code: course.code,
        description: course.description,
        status: course.status,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
      },
    );
    return course;
  }

  async getById(id) {
    const row = this.database.get('SELECT * FROM curriculum_mapping_courses WHERE id = @id', { id });
    return row
      ? new Course({
          id: row.id,
          institutionId: row.institution_id,
          programId: row.program_id,
          owningOrganizationUnitId: row.owning_organization_unit_id,
          name: row.name,
          code: row.code,
          description: row.description,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })
      : null;
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      institutionId: 'institution_id',
      programId: 'program_id',
      code: 'code',
      status: 'status',
    });
    const rows = this.database.all(`SELECT * FROM curriculum_mapping_courses ${sql} ORDER BY created_at ASC`, params);
    return rows.map(
      (row) =>
        new Course({
          id: row.id,
          institutionId: row.institution_id,
          programId: row.program_id,
          owningOrganizationUnitId: row.owning_organization_unit_id,
          name: row.name,
          code: row.code,
          description: row.description,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }),
    );
  }
}

export class SqliteLearningOutcomeRepository extends LearningOutcomeRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(learningOutcome) {
    this.database.run(
      `INSERT INTO curriculum_mapping_learning_outcomes
       (id, institution_id, code, title, statement, scope_type, program_id, course_id, status, created_at, updated_at)
       VALUES (@id, @institutionId, @code, @title, @statement, @scopeType, @programId, @courseId, @status, @createdAt, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         institution_id=excluded.institution_id, code=excluded.code, title=excluded.title,
         statement=excluded.statement, scope_type=excluded.scope_type, program_id=excluded.program_id,
         course_id=excluded.course_id, status=excluded.status, updated_at=excluded.updated_at`,
      {
        id: learningOutcome.id,
        institutionId: learningOutcome.institutionId,
        code: learningOutcome.code,
        title: learningOutcome.title,
        statement: learningOutcome.statement,
        scopeType: learningOutcome.scopeType,
        programId: learningOutcome.programId,
        courseId: learningOutcome.courseId,
        status: learningOutcome.status,
        createdAt: learningOutcome.createdAt,
        updatedAt: learningOutcome.updatedAt,
      },
    );
    return learningOutcome;
  }

  async getById(id) {
    const row = this.database.get('SELECT * FROM curriculum_mapping_learning_outcomes WHERE id = @id', { id });
    return row
      ? new LearningOutcome({
          id: row.id,
          institutionId: row.institution_id,
          code: row.code,
          title: row.title,
          statement: row.statement,
          scopeType: row.scope_type,
          programId: row.program_id,
          courseId: row.course_id,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })
      : null;
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      institutionId: 'institution_id',
      scopeType: 'scope_type',
      programId: 'program_id',
      courseId: 'course_id',
      status: 'status',
    });
    const rows = this.database.all(
      `SELECT * FROM curriculum_mapping_learning_outcomes ${sql} ORDER BY created_at ASC`,
      params,
    );
    return rows.map(
      (row) =>
        new LearningOutcome({
          id: row.id,
          institutionId: row.institution_id,
          code: row.code,
          title: row.title,
          statement: row.statement,
          scopeType: row.scope_type,
          programId: row.program_id,
          courseId: row.course_id,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }),
    );
  }
}

export class SqliteCourseOutcomeMapRepository extends CourseOutcomeMapRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(courseOutcomeMap) {
    this.database.run(
      `INSERT INTO curriculum_mapping_course_outcome_maps
       (id, course_id, learning_outcome_id, created_at, updated_at)
       VALUES (@id, @courseId, @learningOutcomeId, @createdAt, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         course_id=excluded.course_id, learning_outcome_id=excluded.learning_outcome_id,
         updated_at=excluded.updated_at`,
      {
        id: courseOutcomeMap.id,
        courseId: courseOutcomeMap.courseId,
        learningOutcomeId: courseOutcomeMap.learningOutcomeId,
        createdAt: courseOutcomeMap.createdAt,
        updatedAt: courseOutcomeMap.updatedAt,
      },
    );
    return courseOutcomeMap;
  }

  async exists(courseId, learningOutcomeId) {
    const row = this.database.get(
      `SELECT id FROM curriculum_mapping_course_outcome_maps
       WHERE course_id = @courseId AND learning_outcome_id = @learningOutcomeId`,
      { courseId, learningOutcomeId },
    );
    return Boolean(row);
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      courseId: 'course_id',
      learningOutcomeId: 'learning_outcome_id',
    });
    const rows = this.database.all(
      `SELECT * FROM curriculum_mapping_course_outcome_maps ${sql} ORDER BY created_at ASC`,
      params,
    );
    return rows.map(
      (row) =>
        new CourseOutcomeMap({
          id: row.id,
          courseId: row.course_id,
          learningOutcomeId: row.learning_outcome_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }),
    );
  }
}

export class SqliteAssessmentRepository extends AssessmentRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(assessment) {
    this.database.run(
      `INSERT INTO curriculum_mapping_assessments
       (id, institution_id, program_id, course_id, reporting_period_id, review_cycle_id,
        name, assessment_type, start_date, end_date, status, created_at, updated_at)
       VALUES (@id, @institutionId, @programId, @courseId, @reportingPeriodId, @reviewCycleId,
        @name, @assessmentType, @startDate, @endDate, @status, @createdAt, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         institution_id=excluded.institution_id, program_id=excluded.program_id, course_id=excluded.course_id,
         reporting_period_id=excluded.reporting_period_id, review_cycle_id=excluded.review_cycle_id,
         name=excluded.name, assessment_type=excluded.assessment_type, start_date=excluded.start_date,
         end_date=excluded.end_date, status=excluded.status, updated_at=excluded.updated_at`,
      {
        id: assessment.id,
        institutionId: assessment.institutionId,
        programId: assessment.programId,
        courseId: assessment.courseId,
        reportingPeriodId: assessment.reportingPeriodId,
        reviewCycleId: assessment.reviewCycleId,
        name: assessment.name,
        assessmentType: assessment.assessmentType,
        startDate: assessment.startDate,
        endDate: assessment.endDate,
        status: assessment.status,
        createdAt: assessment.createdAt,
        updatedAt: assessment.updatedAt,
      },
    );
    return assessment;
  }

  async getById(id) {
    const row = this.database.get('SELECT * FROM curriculum_mapping_assessments WHERE id = @id', { id });
    return row
      ? new Assessment({
          id: row.id,
          institutionId: row.institution_id,
          programId: row.program_id,
          courseId: row.course_id,
          reportingPeriodId: row.reporting_period_id,
          reviewCycleId: row.review_cycle_id,
          name: row.name,
          assessmentType: row.assessment_type,
          startDate: row.start_date,
          endDate: row.end_date,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })
      : null;
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      institutionId: 'institution_id',
      programId: 'program_id',
      courseId: 'course_id',
      status: 'status',
    });
    const rows = this.database.all(`SELECT * FROM curriculum_mapping_assessments ${sql} ORDER BY created_at ASC`, params);
    return rows.map(
      (row) =>
        new Assessment({
          id: row.id,
          institutionId: row.institution_id,
          programId: row.program_id,
          courseId: row.course_id,
          reportingPeriodId: row.reporting_period_id,
          reviewCycleId: row.review_cycle_id,
          name: row.name,
          assessmentType: row.assessment_type,
          startDate: row.start_date,
          endDate: row.end_date,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }),
    );
  }
}

export class SqliteAssessmentOutcomeLinkRepository extends AssessmentOutcomeLinkRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(assessmentOutcomeLink) {
    this.database.run(
      `INSERT INTO curriculum_mapping_assessment_outcome_links
       (id, assessment_id, learning_outcome_id, created_at, updated_at)
       VALUES (@id, @assessmentId, @learningOutcomeId, @createdAt, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         assessment_id=excluded.assessment_id, learning_outcome_id=excluded.learning_outcome_id,
         updated_at=excluded.updated_at`,
      {
        id: assessmentOutcomeLink.id,
        assessmentId: assessmentOutcomeLink.assessmentId,
        learningOutcomeId: assessmentOutcomeLink.learningOutcomeId,
        createdAt: assessmentOutcomeLink.createdAt,
        updatedAt: assessmentOutcomeLink.updatedAt,
      },
    );
    return assessmentOutcomeLink;
  }

  async exists(assessmentId, learningOutcomeId) {
    const row = this.database.get(
      `SELECT id FROM curriculum_mapping_assessment_outcome_links
       WHERE assessment_id = @assessmentId AND learning_outcome_id = @learningOutcomeId`,
      { assessmentId, learningOutcomeId },
    );
    return Boolean(row);
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      assessmentId: 'assessment_id',
      learningOutcomeId: 'learning_outcome_id',
    });
    const rows = this.database.all(
      `SELECT * FROM curriculum_mapping_assessment_outcome_links ${sql} ORDER BY created_at ASC`,
      params,
    );
    return rows.map(
      (row) =>
        new AssessmentOutcomeLink({
          id: row.id,
          assessmentId: row.assessment_id,
          learningOutcomeId: row.learning_outcome_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }),
    );
  }
}

export class SqliteAssessmentArtifactRepository extends AssessmentArtifactRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(assessmentArtifact) {
    this.database.run(
      `INSERT INTO curriculum_mapping_assessment_artifacts
       (id, institution_id, assessment_id, learning_outcome_id, reporting_period_id, review_cycle_id,
        scope_type, scope_entity_id, name, artifact_type, description, created_at, updated_at)
       VALUES (@id, @institutionId, @assessmentId, @learningOutcomeId, @reportingPeriodId, @reviewCycleId,
        @scopeType, @scopeEntityId, @name, @artifactType, @description, @createdAt, @updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         institution_id=excluded.institution_id, assessment_id=excluded.assessment_id,
         learning_outcome_id=excluded.learning_outcome_id, reporting_period_id=excluded.reporting_period_id,
         review_cycle_id=excluded.review_cycle_id, scope_type=excluded.scope_type,
         scope_entity_id=excluded.scope_entity_id, name=excluded.name, artifact_type=excluded.artifact_type,
         description=excluded.description, updated_at=excluded.updated_at`,
      {
        id: assessmentArtifact.id,
        institutionId: assessmentArtifact.institutionId,
        assessmentId: assessmentArtifact.assessmentId,
        learningOutcomeId: assessmentArtifact.learningOutcomeId,
        reportingPeriodId: assessmentArtifact.reportingPeriodId,
        reviewCycleId: assessmentArtifact.reviewCycleId,
        scopeType: assessmentArtifact.scopeType,
        scopeEntityId: assessmentArtifact.scopeEntityId,
        name: assessmentArtifact.name,
        artifactType: assessmentArtifact.artifactType,
        description: assessmentArtifact.description,
        createdAt: assessmentArtifact.createdAt,
        updatedAt: assessmentArtifact.updatedAt,
      },
    );
    return assessmentArtifact;
  }

  async getById(id) {
    const row = this.database.get('SELECT * FROM curriculum_mapping_assessment_artifacts WHERE id = @id', { id });
    return row
      ? new AssessmentArtifact({
          id: row.id,
          institutionId: row.institution_id,
          assessmentId: row.assessment_id,
          learningOutcomeId: row.learning_outcome_id,
          reportingPeriodId: row.reporting_period_id,
          reviewCycleId: row.review_cycle_id,
          scopeType: row.scope_type,
          scopeEntityId: row.scope_entity_id,
          name: row.name,
          artifactType: row.artifact_type,
          description: row.description,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })
      : null;
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      institutionId: 'institution_id',
      assessmentId: 'assessment_id',
      learningOutcomeId: 'learning_outcome_id',
      scopeType: 'scope_type',
    });
    const rows = this.database.all(
      `SELECT * FROM curriculum_mapping_assessment_artifacts ${sql} ORDER BY created_at ASC`,
      params,
    );
    return rows.map(
      (row) =>
        new AssessmentArtifact({
          id: row.id,
          institutionId: row.institution_id,
          assessmentId: row.assessment_id,
          learningOutcomeId: row.learning_outcome_id,
          reportingPeriodId: row.reporting_period_id,
          reviewCycleId: row.review_cycle_id,
          scopeType: row.scope_type,
          scopeEntityId: row.scope_entity_id,
          name: row.name,
          artifactType: row.artifact_type,
          description: row.description,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }),
    );
  }
}
