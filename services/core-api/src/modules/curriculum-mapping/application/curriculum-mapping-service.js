import { ValidationError } from '../../shared/kernel/errors.js';
import { Program } from '../domain/entities/program.js';
import { Course } from '../domain/entities/course.js';
import { CourseOutcomeMap } from '../domain/entities/course-outcome-map.js';
import { Assessment, AssessmentArtifact, AssessmentOutcomeLink } from '../domain/entities/assessment.js';
import { LearningOutcome, learningOutcomeScopeType } from '../domain/entities/learning-outcome.js';

export class CurriculumMappingService {
  constructor({
    programs,
    courses,
    learningOutcomes,
    courseOutcomeMaps,
    assessments,
    assessmentOutcomeLinks,
    assessmentArtifacts,
    institutions,
    organizationUnits,
  }) {
    this.programs = programs;
    this.courses = courses;
    this.learningOutcomes = learningOutcomes;
    this.courseOutcomeMaps = courseOutcomeMaps;
    this.assessments = assessments;
    this.assessmentOutcomeLinks = assessmentOutcomeLinks;
    this.assessmentArtifacts = assessmentArtifacts;
    this.institutions = institutions;
    this.organizationUnits = organizationUnits;
  }

  async createProgram(input) {
    const institution = await this.institutions.getById(input.institutionId);
    if (!institution) {
      throw new ValidationError(`Institution not found: ${input.institutionId}`);
    }

    const existing = await this.programs.findByFilter({ institutionId: input.institutionId, code: input.code });
    if (existing.length > 0) {
      throw new ValidationError(`Program code already exists in institution: ${input.code}`);
    }

    const program = Program.create(input);
    return this.programs.save(program);
  }

  async createCourse(input) {
    await this.#requireInstitution(input.institutionId);

    if (input.programId) {
      const program = await this.programs.getById(input.programId);
      if (!program || program.institutionId !== input.institutionId) {
        throw new ValidationError('Course.programId must reference a Program in the same institution');
      }
    }

    if (input.owningOrganizationUnitId) {
      const unit = await this.organizationUnits.getById(input.owningOrganizationUnitId);
      if (!unit || unit.institutionId !== input.institutionId) {
        throw new ValidationError('Course.owningOrganizationUnitId must reference an OrganizationUnit in the same institution');
      }
    }

    const existing = await this.courses.findByFilter({ institutionId: input.institutionId, code: input.code });
    if (existing.length > 0) {
      throw new ValidationError(`Course code already exists in institution: ${input.code}`);
    }

    const course = Course.create(input);
    return this.courses.save(course);
  }

  async createLearningOutcome(input) {
    await this.#requireInstitution(input.institutionId);

    if (input.scopeType === learningOutcomeScopeType.PROGRAM) {
      const program = await this.programs.getById(input.programId);
      if (!program || program.institutionId !== input.institutionId) {
        throw new ValidationError('LearningOutcome.programId must reference a Program in the same institution');
      }
    }

    if (input.scopeType === learningOutcomeScopeType.COURSE) {
      const course = await this.courses.getById(input.courseId);
      if (!course || course.institutionId !== input.institutionId) {
        throw new ValidationError('LearningOutcome.courseId must reference a Course in the same institution');
      }
    }

    const existing = await this.learningOutcomes.findByFilter({ institutionId: input.institutionId });
    if (existing.some((item) => item.code === input.code)) {
      throw new ValidationError(`LearningOutcome code already exists in institution: ${input.code}`);
    }

    const learningOutcome = LearningOutcome.create(input);
    return this.learningOutcomes.save(learningOutcome);
  }

  async linkCourseToLearningOutcome(courseId, learningOutcomeId) {
    const course = await this.#requireCourse(courseId);
    const outcome = await this.#requireLearningOutcome(learningOutcomeId);

    if (course.institutionId !== outcome.institutionId) {
      throw new ValidationError('Course and LearningOutcome must belong to the same institution');
    }

    const exists = await this.courseOutcomeMaps.exists(courseId, learningOutcomeId);
    if (exists) {
      throw new ValidationError('CourseOutcomeMap already exists for this course and learning outcome');
    }

    const map = CourseOutcomeMap.create({
      courseId,
      learningOutcomeId,
    });

    return this.courseOutcomeMaps.save(map);
  }

  async createAssessment(input) {
    await this.#requireInstitution(input.institutionId);

    if (input.programId) {
      const program = await this.programs.getById(input.programId);
      if (!program || program.institutionId !== input.institutionId) {
        throw new ValidationError('Assessment.programId must reference a Program in the same institution');
      }
    }

    if (input.courseId) {
      const course = await this.courses.getById(input.courseId);
      if (!course || course.institutionId !== input.institutionId) {
        throw new ValidationError('Assessment.courseId must reference a Course in the same institution');
      }
    }

    const assessment = Assessment.create(input);
    return this.assessments.save(assessment);
  }

  async linkAssessmentToLearningOutcome(assessmentId, learningOutcomeId) {
    const assessment = await this.#requireAssessment(assessmentId);
    const learningOutcome = await this.#requireLearningOutcome(learningOutcomeId);

    if (assessment.institutionId !== learningOutcome.institutionId) {
      throw new ValidationError('Assessment and LearningOutcome must belong to the same institution');
    }

    const exists = await this.assessmentOutcomeLinks.exists(assessmentId, learningOutcomeId);
    if (exists) {
      throw new ValidationError('AssessmentOutcomeLink already exists for this assessment and learning outcome');
    }

    const link = AssessmentOutcomeLink.create({
      assessmentId,
      learningOutcomeId,
    });
    return this.assessmentOutcomeLinks.save(link);
  }

  async createAssessmentArtifact(input) {
    await this.#requireInstitution(input.institutionId);

    if (input.assessmentId) {
      const assessment = await this.#requireAssessment(input.assessmentId);
      if (assessment.institutionId !== input.institutionId) {
        throw new ValidationError('AssessmentArtifact.assessmentId must belong to the same institution');
      }
    }

    if (input.learningOutcomeId) {
      const learningOutcome = await this.#requireLearningOutcome(input.learningOutcomeId);
      if (learningOutcome.institutionId !== input.institutionId) {
        throw new ValidationError('AssessmentArtifact.learningOutcomeId must belong to the same institution');
      }
    }

    if (input.assessmentId && input.learningOutcomeId) {
      const linkExists = await this.assessmentOutcomeLinks.exists(input.assessmentId, input.learningOutcomeId);
      if (!linkExists) {
        throw new ValidationError(
          'AssessmentArtifact.learningOutcomeId must be linked to Assessment via AssessmentOutcomeLink when both are provided',
        );
      }
    }

    const assessmentArtifact = AssessmentArtifact.create(input);
    return this.assessmentArtifacts.save(assessmentArtifact);
  }

  async getProgramById(id) {
    return this.programs.getById(id);
  }

  async getCourseById(id) {
    return this.courses.getById(id);
  }

  async getLearningOutcomeById(id) {
    return this.learningOutcomes.getById(id);
  }

  async getAssessmentById(id) {
    return this.assessments.getById(id);
  }

  async getAssessmentArtifactById(id) {
    return this.assessmentArtifacts.getById(id);
  }

  async listPrograms(filter = {}) {
    return this.programs.findByFilter(filter);
  }

  async listCourses(filter = {}) {
    return this.courses.findByFilter(filter);
  }

  async listLearningOutcomes(filter = {}) {
    return this.learningOutcomes.findByFilter(filter);
  }

  async listCourseOutcomeMaps(filter = {}) {
    return this.courseOutcomeMaps.findByFilter(filter);
  }

  async listAssessments(filter = {}) {
    return this.assessments.findByFilter(filter);
  }

  async listAssessmentOutcomeLinks(filter = {}) {
    return this.assessmentOutcomeLinks.findByFilter(filter);
  }

  async listAssessmentArtifacts(filter = {}) {
    return this.assessmentArtifacts.findByFilter(filter);
  }

  async #requireInstitution(institutionId) {
    const institution = await this.institutions.getById(institutionId);
    if (!institution) {
      throw new ValidationError(`Institution not found: ${institutionId}`);
    }
    return institution;
  }

  async #requireCourse(courseId) {
    const course = await this.courses.getById(courseId);
    if (!course) {
      throw new ValidationError(`Course not found: ${courseId}`);
    }
    return course;
  }

  async #requireLearningOutcome(learningOutcomeId) {
    const learningOutcome = await this.learningOutcomes.getById(learningOutcomeId);
    if (!learningOutcome) {
      throw new ValidationError(`LearningOutcome not found: ${learningOutcomeId}`);
    }
    return learningOutcome;
  }

  async #requireAssessment(assessmentId) {
    const assessment = await this.assessments.getById(assessmentId);
    if (!assessment) {
      throw new ValidationError(`Assessment not found: ${assessmentId}`);
    }
    return assessment;
  }
}
