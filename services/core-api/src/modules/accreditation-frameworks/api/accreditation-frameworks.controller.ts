import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe.js';
import { AFR_SERVICE } from '../accreditation-frameworks.module.js';

const createAccreditorSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  status: z.string().optional(),
});

const createFrameworkSchema = z.object({
  id: z.string().optional(),
  accreditorId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  status: z.string().optional(),
});

const createFrameworkVersionSchema = z.object({
  id: z.string().optional(),
  frameworkId: z.string().min(1),
  versionTag: z.string().min(1),
  status: z.string().optional(),
  publishedAt: z.string().optional(),
  effectiveStartDate: z.string().optional(),
  effectiveEndDate: z.string().optional(),
});

const addStandardSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  sequence: z.number().optional(),
});

const addCriterionSchema = z.object({
  id: z.string().optional(),
  standardId: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  statement: z.string().optional(),
  sequence: z.number().optional(),
});

const addCriterionElementSchema = z.object({
  id: z.string().optional(),
  criterionId: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  statement: z.string().min(1),
  elementType: z.string().optional(),
  requiredFlag: z.boolean().optional(),
  sequence: z.number().optional(),
  effectiveStartDate: z.string().optional(),
  effectiveEndDate: z.string().optional(),
  supersedesElementId: z.string().optional(),
});

const addEvidenceRequirementSchema = z.object({
  id: z.string().optional(),
  criterionId: z.string().optional(),
  criterionElementId: z.string().optional(),
  requirementCode: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  requirementType: z.string().min(1),
  cardinalityRule: z.string().optional(),
  timingExpectation: z.string().optional(),
  evidenceClass: z.string().optional(),
  isMandatory: z.boolean().optional(),
  effectiveStartDate: z.string().optional(),
  effectiveEndDate: z.string().optional(),
  supersedesRequirementId: z.string().optional(),
});

const createCycleSchema = z.object({
  id: z.string().optional(),
  frameworkVersionId: z.string().min(1),
  institutionId: z.string().min(1),
  name: z.string().min(1),
  cycleStartDate: z.string().min(1),
  cycleEndDate: z.string().min(1),
  status: z.string().optional(),
});

const addScopeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  scopeType: z.string().min(1),
  description: z.string().optional(),
  status: z.string().optional(),
  programIds: z.array(z.string()).optional(),
  organizationUnitIds: z.array(z.string()).optional(),
  effectiveStartDate: z.string().optional(),
  effectiveEndDate: z.string().optional(),
  scopeOrder: z.number().optional(),
});

const addMilestoneSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  milestoneType: z.string().optional(),
  dueDate: z.string().min(1),
  status: z.string().optional(),
  scopeId: z.string().optional(),
});

const addReportingPeriodSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  periodType: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: z.string().optional(),
  scopeId: z.string().optional(),
});

const addReviewEventSchema = z.object({
  id: z.string().optional(),
  reviewTeamId: z.string().optional(),
  scopeId: z.string().optional(),
  name: z.string().min(1),
  eventType: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: z.string().optional(),
});

const issueDecisionSchema = z.object({
  id: z.string().optional(),
  reviewEventId: z.string().optional(),
  decisionType: z.string().min(1),
  outcome: z.string().min(1),
  rationale: z.string().optional(),
  issuedAt: z.string().optional(),
  supersedesDecisionRecordId: z.string().optional(),
});

const supersedeDecisionSchema = z.object({
  id: z.string().optional(),
  reviewEventId: z.string().optional(),
  decisionType: z.string().min(1),
  outcome: z.string().min(1),
  rationale: z.string().optional(),
  issuedAt: z.string().optional(),
});

const createReviewerProfileSchema = z.object({
  id: z.string().optional(),
  personId: z.string().min(1),
  institutionId: z.string().min(1),
  reviewerType: z.string().min(1),
  credentialSummary: z.string().optional(),
  conflictOfInterestNotes: z.string().optional(),
  expertiseAreas: z.array(z.string()).optional(),
  status: z.string().optional(),
  effectiveStartDate: z.string().optional(),
  effectiveEndDate: z.string().optional(),
});

const createReviewTeamSchema = z.object({
  id: z.string().optional(),
  accreditationCycleId: z.string().min(1),
  institutionId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.string().optional(),
});

const addReviewTeamMembershipSchema = z.object({
  id: z.string().optional(),
  personId: z.string().min(1),
  reviewerProfileId: z.string().optional(),
  role: z.string().min(1),
  responsibilitySummary: z.string().optional(),
  isPrimary: z.boolean().optional(),
  conflictStatus: z.string().optional(),
  state: z.string().optional(),
  effectiveStartDate: z.string().optional(),
  effectiveEndDate: z.string().optional(),
  supersedesMembershipId: z.string().optional(),
});

@Controller('accreditation-frameworks')
export class AccreditationFrameworksController {
  constructor(@Inject(AFR_SERVICE) private readonly service) {}

  @Post('accreditors')
  @HttpCode(HttpStatus.CREATED)
  async createAccreditor(@Body(new ZodValidationPipe(createAccreditorSchema)) body) {
    return { data: await this.service.createAccreditor(body) };
  }

  @Post('frameworks')
  @HttpCode(HttpStatus.CREATED)
  async createFramework(@Body(new ZodValidationPipe(createFrameworkSchema)) body) {
    return { data: await this.service.createFramework(body) };
  }

  @Post('framework-versions')
  @HttpCode(HttpStatus.CREATED)
  async createFrameworkVersion(@Body(new ZodValidationPipe(createFrameworkVersionSchema)) body) {
    return { data: await this.service.createFrameworkVersion(body) };
  }

  @Get('framework-versions/:frameworkVersionId')
  async getFrameworkVersionById(@Param('frameworkVersionId') frameworkVersionId: string) {
    return { data: await this.service.getFrameworkVersionById(frameworkVersionId) };
  }

  @Get('framework-versions')
  async listFrameworkVersions(
    @Query('frameworkId') frameworkId?: string,
    @Query('versionTag') versionTag?: string,
    @Query('status') status?: string,
  ) {
    return {
      data: await this.service.listFrameworkVersions({
        frameworkId,
        versionTag,
        status,
      }),
    };
  }

  @Post('framework-versions/:frameworkVersionId/standards')
  async addStandard(
    @Param('frameworkVersionId') frameworkVersionId: string,
    @Body(new ZodValidationPipe(addStandardSchema)) body,
  ) {
    return { data: await this.service.addStandard(frameworkVersionId, body) };
  }

  @Post('framework-versions/:frameworkVersionId/criteria')
  async addCriterion(
    @Param('frameworkVersionId') frameworkVersionId: string,
    @Body(new ZodValidationPipe(addCriterionSchema)) body,
  ) {
    return { data: await this.service.addCriterion(frameworkVersionId, body) };
  }

  @Post('framework-versions/:frameworkVersionId/criterion-elements')
  async addCriterionElement(
    @Param('frameworkVersionId') frameworkVersionId: string,
    @Body(new ZodValidationPipe(addCriterionElementSchema)) body,
  ) {
    return { data: await this.service.addCriterionElement(frameworkVersionId, body) };
  }

  @Post('framework-versions/:frameworkVersionId/evidence-requirements')
  async addEvidenceRequirement(
    @Param('frameworkVersionId') frameworkVersionId: string,
    @Body(new ZodValidationPipe(addEvidenceRequirementSchema)) body,
  ) {
    return { data: await this.service.addEvidenceRequirement(frameworkVersionId, body) };
  }

  @Post('framework-versions/:frameworkVersionId/publish')
  async publishFrameworkVersion(@Param('frameworkVersionId') frameworkVersionId: string) {
    return { data: await this.service.publishFrameworkVersion(frameworkVersionId) };
  }

  @Post('cycles')
  @HttpCode(HttpStatus.CREATED)
  async createCycle(@Body(new ZodValidationPipe(createCycleSchema)) body) {
    return { data: await this.service.createAccreditationCycle(body) };
  }

  @Get('cycles/:cycleId')
  async getCycleById(@Param('cycleId') cycleId: string) {
    return { data: await this.service.getAccreditationCycleById(cycleId) };
  }

  @Get('cycles')
  async listCycles(
    @Query('frameworkVersionId') frameworkVersionId?: string,
    @Query('institutionId') institutionId?: string,
    @Query('status') status?: string,
  ) {
    return {
      data: await this.service.listAccreditationCycles({
        frameworkVersionId,
        institutionId,
        status,
      }),
    };
  }

  @Post('cycles/:cycleId/activate')
  async activateCycle(@Param('cycleId') cycleId: string) {
    return { data: await this.service.activateAccreditationCycle(cycleId) };
  }

  @Post('cycles/:cycleId/scopes')
  async addScope(@Param('cycleId') cycleId: string, @Body(new ZodValidationPipe(addScopeSchema)) body) {
    return { data: await this.service.addAccreditationScope(cycleId, body) };
  }

  @Post('cycles/:cycleId/milestones')
  async addMilestone(@Param('cycleId') cycleId: string, @Body(new ZodValidationPipe(addMilestoneSchema)) body) {
    return { data: await this.service.addCycleMilestone(cycleId, body) };
  }

  @Post('cycles/:cycleId/reporting-periods')
  async addReportingPeriod(
    @Param('cycleId') cycleId: string,
    @Body(new ZodValidationPipe(addReportingPeriodSchema)) body,
  ) {
    return { data: await this.service.addReportingPeriod(cycleId, body) };
  }

  @Post('cycles/:cycleId/review-events')
  async addReviewEvent(@Param('cycleId') cycleId: string, @Body(new ZodValidationPipe(addReviewEventSchema)) body) {
    return { data: await this.service.addReviewEvent(cycleId, body) };
  }

  @Post('cycles/:cycleId/decision-records')
  async issueDecision(@Param('cycleId') cycleId: string, @Body(new ZodValidationPipe(issueDecisionSchema)) body) {
    return { data: await this.service.issueDecisionRecord(cycleId, body) };
  }

  @Post('cycles/:cycleId/decision-records/:decisionRecordId/supersede')
  async supersedeDecision(
    @Param('cycleId') cycleId: string,
    @Param('decisionRecordId') decisionRecordId: string,
    @Body(new ZodValidationPipe(supersedeDecisionSchema)) body,
  ) {
    return { data: await this.service.supersedeDecisionRecord(cycleId, decisionRecordId, body) };
  }

  @Post('reviewer-profiles')
  @HttpCode(HttpStatus.CREATED)
  async createReviewerProfile(@Body(new ZodValidationPipe(createReviewerProfileSchema)) body) {
    return { data: await this.service.createReviewerProfile(body) };
  }

  @Get('reviewer-profiles/:reviewerProfileId')
  async getReviewerProfileById(@Param('reviewerProfileId') reviewerProfileId: string) {
    return { data: await this.service.getReviewerProfileById(reviewerProfileId) };
  }

  @Get('reviewer-profiles')
  async listReviewerProfiles(
    @Query('personId') personId?: string,
    @Query('institutionId') institutionId?: string,
    @Query('reviewerType') reviewerType?: string,
    @Query('status') status?: string,
  ) {
    return {
      data: await this.service.listReviewerProfiles({
        personId,
        institutionId,
        reviewerType,
        status,
      }),
    };
  }

  @Post('review-teams')
  @HttpCode(HttpStatus.CREATED)
  async createReviewTeam(@Body(new ZodValidationPipe(createReviewTeamSchema)) body) {
    return { data: await this.service.createReviewTeam(body) };
  }

  @Get('review-teams/:reviewTeamId')
  async getReviewTeamById(@Param('reviewTeamId') reviewTeamId: string) {
    return { data: await this.service.getReviewTeamById(reviewTeamId) };
  }

  @Get('review-teams')
  async listReviewTeams(
    @Query('accreditationCycleId') accreditationCycleId?: string,
    @Query('institutionId') institutionId?: string,
    @Query('status') status?: string,
    @Query('name') name?: string,
  ) {
    return {
      data: await this.service.listReviewTeams({
        accreditationCycleId,
        institutionId,
        status,
        name,
      }),
    };
  }

  @Post('review-teams/:reviewTeamId/memberships')
  async addReviewTeamMembership(
    @Param('reviewTeamId') reviewTeamId: string,
    @Body(new ZodValidationPipe(addReviewTeamMembershipSchema)) body,
  ) {
    return { data: await this.service.addReviewTeamMembership(reviewTeamId, body) };
  }
}
