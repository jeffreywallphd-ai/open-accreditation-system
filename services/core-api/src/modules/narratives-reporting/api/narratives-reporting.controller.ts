import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe.js';
import { NARR_SERVICE } from '../narratives-reporting.module.js';
import {
  NARRATIVE_EVIDENCE_LINK_TYPE_VALUES,
  NARRATIVE_PACKAGE_LINK_TYPE_VALUES,
  NARRATIVE_SECTION_TYPE_VALUES,
} from '../domain/value-objects/narrative-statuses.js';
import {
  SUBMISSION_PACKAGE_ITEM_ASSEMBLY_ROLE_VALUES,
  SUBMISSION_PACKAGE_ITEM_TYPE_VALUES,
} from '../domain/value-objects/submission-package-statuses.js';

const createSubmissionPackageSchema = z.object({
  id: z.string().optional(),
  reviewCycleId: z.string().min(1),
  scopeType: z.string().min(1),
  scopeId: z.string().min(1),
  name: z.string().optional(),
});

const addSubmissionPackageItemSchema = z.object({
  id: z.string().optional(),
  itemType: z
    .string()
    .refine((value) => SUBMISSION_PACKAGE_ITEM_TYPE_VALUES.includes(value), 'Invalid itemType')
    .optional(),
  assemblyRole: z
    .string()
    .refine((value) => SUBMISSION_PACKAGE_ITEM_ASSEMBLY_ROLE_VALUES.includes(value), 'Invalid assemblyRole')
    .optional(),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  workflowId: z.string().optional(),
  sectionKey: z.string().optional(),
  sectionTitle: z.string().optional(),
  parentSectionKey: z.string().optional(),
  sectionType: z.string().optional(),
  evidenceItemIds: z.array(z.string()).optional(),
  label: z.string().optional(),
  rationale: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const reorderItemSchema = z.object({
  newPosition: z.number().int().min(1),
});

const captureSnapshotSchema = z.object({
  milestoneLabel: z.string().optional(),
  actorId: z.string().optional(),
  notes: z.string().optional(),
});

const finalizePackageSchema = z.object({
  milestoneLabel: z.string().optional(),
  actorId: z.string().optional(),
  notes: z.string().optional(),
});

const createNarrativeSchema = z.object({
  id: z.string().optional(),
  submissionPackageId: z.string().min(1),
  title: z.string().min(1),
});

const addNarrativeSectionSchema = z.object({
  sectionType: z
    .string()
    .refine((value) => NARRATIVE_SECTION_TYPE_VALUES.includes(value), 'Invalid sectionType'),
  sectionKey: z.string().min(1),
  parentSectionKey: z.string().optional(),
  title: z.string().min(1),
  content: z.string().optional(),
  ownerId: z.string().optional(),
});

const updateNarrativeSectionSchema = z.object({
  sectionType: z
    .string()
    .refine((value) => NARRATIVE_SECTION_TYPE_VALUES.includes(value), 'Invalid sectionType')
    .optional(),
  sectionKey: z.string().optional(),
  parentSectionKey: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  ownerId: z.string().optional(),
}).refine(
  (value) =>
    value.sectionType !== undefined ||
    value.sectionKey !== undefined ||
    value.parentSectionKey !== undefined ||
    value.title !== undefined ||
    value.content !== undefined ||
    value.ownerId !== undefined,
  'At least one update field is required',
);

const linkNarrativeSectionEvidenceSchema = z.object({
  evidenceItemId: z.string().min(1),
  relationshipType: z
    .string()
    .refine((value) => NARRATIVE_EVIDENCE_LINK_TYPE_VALUES.includes(value), 'Invalid relationshipType'),
  rationale: z.string().optional(),
});

const linkNarrativeSectionPackageItemSchema = z.object({
  submissionPackageItemId: z.string().min(1),
  linkType: z
    .string()
    .refine((value) => NARRATIVE_PACKAGE_LINK_TYPE_VALUES.includes(value), 'Invalid linkType'),
});

@Controller('narratives-reporting')
export class NarrativesReportingController {
  constructor(@Inject(NARR_SERVICE) private readonly service) {}

  @Post('submission-packages')
  @HttpCode(HttpStatus.CREATED)
  async createSubmissionPackage(@Body(new ZodValidationPipe(createSubmissionPackageSchema)) body) {
    return { data: await this.service.createSubmissionPackage(body) };
  }

  @Get('submission-packages/:submissionPackageId')
  async getSubmissionPackageById(@Param('submissionPackageId') submissionPackageId: string) {
    return { data: await this.service.getSubmissionPackageById(submissionPackageId) };
  }

  @Get('submission-packages')
  async listSubmissionPackages(
    @Query('id') id?: string,
    @Query('institutionId') institutionId?: string,
    @Query('reviewCycleId') reviewCycleId?: string,
    @Query('scopeType') scopeType?: string,
    @Query('scopeId') scopeId?: string,
    @Query('status') status?: string,
    @Query('assemblyRole') assemblyRole?: string,
  ) {
    return {
      data: await this.service.listSubmissionPackages({
        id,
        institutionId,
        reviewCycleId,
        scopeType,
        scopeId,
        status,
        assemblyRole,
      }),
    };
  }

  @Post('submission-packages/:submissionPackageId/items')
  async addSubmissionPackageItem(
    @Param('submissionPackageId') submissionPackageId: string,
    @Body(new ZodValidationPipe(addSubmissionPackageItemSchema)) body,
  ) {
    return { data: await this.service.addSubmissionPackageItem(submissionPackageId, body) };
  }

  @Delete('submission-packages/:submissionPackageId/items/:itemId')
  async removeSubmissionPackageItem(
    @Param('submissionPackageId') submissionPackageId: string,
    @Param('itemId') itemId: string,
  ) {
    return { data: await this.service.removeSubmissionPackageItem(submissionPackageId, itemId) };
  }

  @Post('submission-packages/:submissionPackageId/items/:itemId/reorder')
  async reorderSubmissionPackageItem(
    @Param('submissionPackageId') submissionPackageId: string,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(reorderItemSchema)) body,
  ) {
    return { data: await this.service.reorderSubmissionPackageItem(submissionPackageId, itemId, body.newPosition) };
  }

  @Post('submission-packages/:submissionPackageId/snapshots')
  async captureSubmissionPackageSnapshot(
    @Param('submissionPackageId') submissionPackageId: string,
    @Body(new ZodValidationPipe(captureSnapshotSchema)) body,
  ) {
    return { data: await this.service.snapshotSubmissionPackage(submissionPackageId, body) };
  }

  @Post('submission-packages/:submissionPackageId/finalize')
  async finalizeSubmissionPackage(
    @Param('submissionPackageId') submissionPackageId: string,
    @Body(new ZodValidationPipe(finalizePackageSchema)) body,
  ) {
    return {
      data: await this.service.snapshotSubmissionPackage(submissionPackageId, {
        ...body,
        finalize: true,
      }),
    };
  }

  @Get('submission-packages/:submissionPackageId/context')
  async getSubmissionPackageWithContext(@Param('submissionPackageId') submissionPackageId: string) {
    return { data: await this.service.getSubmissionPackageWithItemContext(submissionPackageId) };
  }

  @Post('narratives')
  @HttpCode(HttpStatus.CREATED)
  async createNarrative(@Body(new ZodValidationPipe(createNarrativeSchema)) body) {
    return { data: await this.service.createNarrative(body) };
  }

  @Get('narratives/:narrativeId')
  async getNarrativeById(@Param('narrativeId') narrativeId: string) {
    return { data: await this.service.getNarrativeById(narrativeId) };
  }

  @Get('narratives')
  async listNarratives(
    @Query('id') id?: string,
    @Query('institutionId') institutionId?: string,
    @Query('reviewCycleId') reviewCycleId?: string,
    @Query('submissionPackageId') submissionPackageId?: string,
    @Query('status') status?: string,
  ) {
    return {
      data: await this.service.listNarratives({
        id,
        institutionId,
        reviewCycleId,
        submissionPackageId,
        status,
      }),
    };
  }

  @Post('narratives/:narrativeId/sections')
  async addNarrativeSection(
    @Param('narrativeId') narrativeId: string,
    @Body(new ZodValidationPipe(addNarrativeSectionSchema)) body,
  ) {
    return { data: await this.service.addNarrativeSection(narrativeId, body) };
  }

  @Post('narratives/:narrativeId/sections/:sectionId')
  async updateNarrativeSection(
    @Param('narrativeId') narrativeId: string,
    @Param('sectionId') sectionId: string,
    @Body(new ZodValidationPipe(updateNarrativeSectionSchema)) body,
  ) {
    return { data: await this.service.updateNarrativeSection(narrativeId, sectionId, body) };
  }

  @Delete('narratives/:narrativeId/sections/:sectionId')
  async removeNarrativeSection(
    @Param('narrativeId') narrativeId: string,
    @Param('sectionId') sectionId: string,
  ) {
    return { data: await this.service.removeNarrativeSection(narrativeId, sectionId) };
  }

  @Post('narratives/:narrativeId/sections/:sectionId/reorder')
  async reorderNarrativeSection(
    @Param('narrativeId') narrativeId: string,
    @Param('sectionId') sectionId: string,
    @Body(new ZodValidationPipe(reorderItemSchema)) body,
  ) {
    return { data: await this.service.reorderNarrativeSection(narrativeId, sectionId, body.newPosition) };
  }

  @Post('narratives/:narrativeId/sections/:sectionId/evidence-links')
  async linkNarrativeSectionEvidence(
    @Param('narrativeId') narrativeId: string,
    @Param('sectionId') sectionId: string,
    @Body(new ZodValidationPipe(linkNarrativeSectionEvidenceSchema)) body,
  ) {
    return { data: await this.service.linkNarrativeSectionEvidence(narrativeId, sectionId, body) };
  }

  @Delete('narratives/:narrativeId/sections/:sectionId/evidence-links/:linkId')
  async unlinkNarrativeSectionEvidence(
    @Param('narrativeId') narrativeId: string,
    @Param('sectionId') sectionId: string,
    @Param('linkId') linkId: string,
  ) {
    return { data: await this.service.unlinkNarrativeSectionEvidence(narrativeId, sectionId, linkId) };
  }

  @Post('narratives/:narrativeId/sections/:sectionId/package-links')
  async linkNarrativeSectionToPackageItem(
    @Param('narrativeId') narrativeId: string,
    @Param('sectionId') sectionId: string,
    @Body(new ZodValidationPipe(linkNarrativeSectionPackageItemSchema)) body,
  ) {
    return { data: await this.service.linkNarrativeSectionToPackageItem(narrativeId, sectionId, body) };
  }

  @Delete('narratives/:narrativeId/sections/:sectionId/package-links/:submissionPackageItemId')
  async unlinkNarrativeSectionFromPackageItem(
    @Param('narrativeId') narrativeId: string,
    @Param('sectionId') sectionId: string,
    @Param('submissionPackageItemId') submissionPackageItemId: string,
  ) {
    return { data: await this.service.unlinkNarrativeSectionFromPackageItem(narrativeId, sectionId, submissionPackageItemId) };
  }

  @Post('narratives/:narrativeId/submit-for-review')
  async submitNarrativeForReview(@Param('narrativeId') narrativeId: string) {
    return { data: await this.service.submitNarrativeForReview(narrativeId) };
  }

  @Post('narratives/:narrativeId/return-to-draft')
  async returnNarrativeToDraft(@Param('narrativeId') narrativeId: string) {
    return { data: await this.service.returnNarrativeToDraft(narrativeId) };
  }

  @Post('narratives/:narrativeId/finalize')
  async finalizeNarrative(@Param('narrativeId') narrativeId: string) {
    return { data: await this.service.finalizeNarrative(narrativeId) };
  }
}
