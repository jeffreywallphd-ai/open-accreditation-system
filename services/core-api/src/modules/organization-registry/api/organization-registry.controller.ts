import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { ORG_SERVICE } from '../organization-registry.module.js';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe.js';

const createInstitutionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  code: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
  status: z.string().optional(),
  effectiveStartDate: z.string().optional(),
  effectiveEndDate: z.string().optional(),
});

const updateInstitutionSchema = createInstitutionSchema.partial();

const createPersonSchema = z
  .object({
    id: z.string().optional(),
    institutionId: z.string().min(1),
    preferredName: z.string().optional(),
    legalName: z.string().optional(),
    displayName: z.string().min(1),
    primaryEmail: z.string().email().optional(),
    secondaryEmail: z.string().email().optional(),
    personStatus: z.string().optional(),
    employeeLikeIndicator: z.boolean().optional(),
    externalReferenceSummary: z.string().optional(),
    matchConfidenceNotes: z.string().optional(),
    effectiveStartDate: z.string().optional(),
    effectiveEndDate: z.string().optional(),
  })
  .refine((value) => value.primaryEmail || value.secondaryEmail, {
    message: 'primaryEmail or secondaryEmail is required',
  });

const updatePersonSchema = createPersonSchema.partial().omit({ institutionId: true, displayName: true });

const createOrganizationUnitSchema = z.object({
  id: z.string().optional(),
  institutionId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().optional(),
  unitType: z.string().min(1),
  parentUnitId: z.string().optional().nullable(),
  status: z.string().optional(),
  effectiveStartDate: z.string().optional(),
  effectiveEndDate: z.string().optional(),
});

const updateOrganizationUnitSchema = createOrganizationUnitSchema.partial().omit({ institutionId: true });

const createCommitteeSchema = z.object({
  id: z.string().optional(),
  institutionId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().optional(),
  sponsoringUnitId: z.string().optional().nullable(),
  charterSummary: z.string().optional(),
  status: z.string().optional(),
  effectiveStartDate: z.string().optional(),
  effectiveEndDate: z.string().optional(),
});

const updateCommitteeSchema = createCommitteeSchema.partial();

const listPeopleQuerySchema = z.object({
  id: z.string().optional(),
  institutionId: z.string().optional(),
  displayName: z.string().optional(),
  personStatus: z.string().optional(),
  primaryEmail: z.string().optional(),
});

const listCommitteesQuerySchema = z.object({
  id: z.string().optional(),
  institutionId: z.string().optional(),
  sponsoringUnitId: z.string().optional(),
  status: z.string().optional(),
  name: z.string().optional(),
});

const hierarchyQuerySchema = z.object({
  status: z.string().optional(),
});

@Controller('organization-registry')
export class OrganizationRegistryController {
  constructor(@Inject(ORG_SERVICE) private readonly service) {}

  @Post('institutions')
  @HttpCode(HttpStatus.CREATED)
  async createInstitution(@Body(new ZodValidationPipe(createInstitutionSchema)) body) {
    return { data: await this.service.createInstitution(body) };
  }

  @Patch('institutions/:id')
  async updateInstitution(@Param('id') id: string, @Body(new ZodValidationPipe(updateInstitutionSchema)) body) {
    return { data: await this.service.updateInstitution(id, body) };
  }

  @Post('people')
  @HttpCode(HttpStatus.CREATED)
  async createPerson(@Body(new ZodValidationPipe(createPersonSchema)) body) {
    return { data: await this.service.createPerson(body) };
  }

  @Patch('people/:id')
  async updatePerson(@Param('id') id: string, @Body(new ZodValidationPipe(updatePersonSchema)) body) {
    return { data: await this.service.updatePerson(id, body) };
  }

  @Get('people')
  async listPeople(@Query(new ZodValidationPipe(listPeopleQuerySchema)) query) {
    return { data: await this.service.listPeople(query) };
  }

  @Post('organization-units')
  @HttpCode(HttpStatus.CREATED)
  async createOrganizationUnit(@Body(new ZodValidationPipe(createOrganizationUnitSchema)) body) {
    return { data: await this.service.createOrganizationUnit(body) };
  }

  @Patch('organization-units/:id')
  async updateOrganizationUnit(@Param('id') id: string, @Body(new ZodValidationPipe(updateOrganizationUnitSchema)) body) {
    return { data: await this.service.updateOrganizationUnit(id, body) };
  }

  @Get('institutions/:institutionId/hierarchy')
  async getOrganizationHierarchy(
    @Param('institutionId') institutionId: string,
    @Query(new ZodValidationPipe(hierarchyQuerySchema)) query,
  ) {
    return { data: await this.service.getOrganizationUnitHierarchy(institutionId, query.status) };
  }

  @Post('committees')
  @HttpCode(HttpStatus.CREATED)
  async createCommittee(@Body(new ZodValidationPipe(createCommitteeSchema)) body) {
    return { data: await this.service.createCommittee(body) };
  }

  @Patch('committees/:id')
  async updateCommittee(@Param('id') id: string, @Body(new ZodValidationPipe(updateCommitteeSchema)) body) {
    return { data: await this.service.updateCommittee(id, body) };
  }

  @Get('committees')
  async listCommittees(@Query(new ZodValidationPipe(listCommitteesQuerySchema)) query) {
    return { data: await this.service.listCommittees(query) };
  }
}
