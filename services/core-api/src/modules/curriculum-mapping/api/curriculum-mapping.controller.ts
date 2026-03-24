import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe.js';
import { CURR_SERVICE } from '../curriculum-mapping.module.js';

const createProgramSchema = z.object({
  id: z.string().optional(),
  institutionId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  status: z.string().optional(),
});

const createCourseSchema = z.object({
  id: z.string().optional(),
  institutionId: z.string().min(1),
  programId: z.string().optional(),
  owningOrganizationUnitId: z.string().optional(),
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  status: z.string().optional(),
});

const createLearningOutcomeSchema = z.object({
  id: z.string().optional(),
  institutionId: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  statement: z.string().min(1),
  scopeType: z.string().optional(),
  programId: z.string().optional(),
  courseId: z.string().optional(),
  status: z.string().optional(),
});

const createCourseOutcomeMapSchema = z.object({
  courseId: z.string().min(1),
  learningOutcomeId: z.string().min(1),
});

const createAssessmentSchema = z.object({
  id: z.string().optional(),
  institutionId: z.string().min(1),
  programId: z.string().optional(),
  courseId: z.string().optional(),
  reportingPeriodId: z.string().optional(),
  reviewCycleId: z.string().optional(),
  name: z.string().min(1),
  assessmentType: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
});

const createAssessmentOutcomeLinkSchema = z.object({
  assessmentId: z.string().min(1),
  learningOutcomeId: z.string().min(1),
});

const createAssessmentArtifactSchema = z.object({
  id: z.string().optional(),
  institutionId: z.string().min(1),
  assessmentId: z.string().optional(),
  learningOutcomeId: z.string().optional(),
  reportingPeriodId: z.string().optional(),
  reviewCycleId: z.string().optional(),
  scopeType: z.string().optional(),
  scopeEntityId: z.string().optional(),
  name: z.string().min(1),
  artifactType: z.string().min(1),
  description: z.string().optional(),
});

@Controller('curriculum-mapping')
export class CurriculumMappingController {
  constructor(@Inject(CURR_SERVICE) private readonly service) {}

  @Post('programs')
  @HttpCode(HttpStatus.CREATED)
  async createProgram(@Body(new ZodValidationPipe(createProgramSchema)) body) {
    return { data: await this.service.createProgram(body) };
  }

  @Post('courses')
  @HttpCode(HttpStatus.CREATED)
  async createCourse(@Body(new ZodValidationPipe(createCourseSchema)) body) {
    return { data: await this.service.createCourse(body) };
  }

  @Post('learning-outcomes')
  @HttpCode(HttpStatus.CREATED)
  async createLearningOutcome(@Body(new ZodValidationPipe(createLearningOutcomeSchema)) body) {
    return { data: await this.service.createLearningOutcome(body) };
  }

  @Post('course-outcome-maps')
  @HttpCode(HttpStatus.CREATED)
  async createCourseOutcomeMap(@Body(new ZodValidationPipe(createCourseOutcomeMapSchema)) body) {
    return { data: await this.service.linkCourseToLearningOutcome(body.courseId, body.learningOutcomeId) };
  }

  @Post('assessments')
  @HttpCode(HttpStatus.CREATED)
  async createAssessment(@Body(new ZodValidationPipe(createAssessmentSchema)) body) {
    return { data: await this.service.createAssessment(body) };
  }

  @Post('assessment-outcome-links')
  @HttpCode(HttpStatus.CREATED)
  async createAssessmentOutcomeLink(@Body(new ZodValidationPipe(createAssessmentOutcomeLinkSchema)) body) {
    return { data: await this.service.linkAssessmentToLearningOutcome(body.assessmentId, body.learningOutcomeId) };
  }

  @Post('assessment-artifacts')
  @HttpCode(HttpStatus.CREATED)
  async createAssessmentArtifact(@Body(new ZodValidationPipe(createAssessmentArtifactSchema)) body) {
    return { data: await this.service.createAssessmentArtifact(body) };
  }
}
