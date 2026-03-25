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
import { NARR_APPLICATION_SERVICE_TOKENS } from '../narratives-reporting.module.js';
import {
  NARRATIVE_EVIDENCE_LINK_TYPE_VALUES,
  NARRATIVE_PACKAGE_LINK_TYPE_VALUES,
  NARRATIVE_SECTION_TYPE_VALUES,
} from '../domain/value-objects/narrative-statuses.js';

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

const reorderItemSchema = z.object({
  newPosition: z.number().int().min(1),
});

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

@Controller('narratives-reporting/narratives')
export class NarrativesController {
  constructor(
    @Inject(NARR_APPLICATION_SERVICE_TOKENS.narrativeService) private readonly narratives,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createNarrative(@Body(new ZodValidationPipe(createNarrativeSchema)) body) {
    return { data: await this.narratives.createNarrative(body) };
  }

  @Get(':narrativeId')
  async getNarrativeById(@Param('narrativeId') narrativeId: string) {
    return { data: await this.narratives.getNarrativeById(narrativeId) };
  }

  @Get(':narrativeId/context')
  async getNarrativeWithContext(@Param('narrativeId') narrativeId: string) {
    return { data: await this.narratives.getNarrativeWithSectionContext(narrativeId) };
  }

  @Get()
  async listNarratives(
    @Query('id') id?: string,
    @Query('institutionId') institutionId?: string,
    @Query('reviewCycleId') reviewCycleId?: string,
    @Query('submissionPackageId') submissionPackageId?: string,
    @Query('status') status?: string,
  ) {
    return {
      data: await this.narratives.listNarratives({
        id,
        institutionId,
        reviewCycleId,
        submissionPackageId,
        status,
      }),
    };
  }

  @Post(':narrativeId/sections')
  async addNarrativeSection(
    @Param('narrativeId') narrativeId: string,
    @Body(new ZodValidationPipe(addNarrativeSectionSchema)) body,
  ) {
    return { data: await this.narratives.addNarrativeSection(narrativeId, body) };
  }

  @Post(':narrativeId/sections/:sectionId')
  async updateNarrativeSection(
    @Param('narrativeId') narrativeId: string,
    @Param('sectionId') sectionId: string,
    @Body(new ZodValidationPipe(updateNarrativeSectionSchema)) body,
  ) {
    return { data: await this.narratives.updateNarrativeSection(narrativeId, sectionId, body) };
  }

  @Delete(':narrativeId/sections/:sectionId')
  async removeNarrativeSection(
    @Param('narrativeId') narrativeId: string,
    @Param('sectionId') sectionId: string,
  ) {
    return { data: await this.narratives.removeNarrativeSection(narrativeId, sectionId) };
  }

  @Post(':narrativeId/sections/:sectionId/reorder')
  async reorderNarrativeSection(
    @Param('narrativeId') narrativeId: string,
    @Param('sectionId') sectionId: string,
    @Body(new ZodValidationPipe(reorderItemSchema)) body,
  ) {
    return { data: await this.narratives.reorderNarrativeSection(narrativeId, sectionId, body.newPosition) };
  }

  @Post(':narrativeId/sections/:sectionId/evidence-links')
  async linkNarrativeSectionEvidence(
    @Param('narrativeId') narrativeId: string,
    @Param('sectionId') sectionId: string,
    @Body(new ZodValidationPipe(linkNarrativeSectionEvidenceSchema)) body,
  ) {
    return { data: await this.narratives.linkNarrativeSectionEvidence(narrativeId, sectionId, body) };
  }

  @Delete(':narrativeId/sections/:sectionId/evidence-links/:linkId')
  async unlinkNarrativeSectionEvidence(
    @Param('narrativeId') narrativeId: string,
    @Param('sectionId') sectionId: string,
    @Param('linkId') linkId: string,
  ) {
    return { data: await this.narratives.unlinkNarrativeSectionEvidence(narrativeId, sectionId, linkId) };
  }

  @Post(':narrativeId/sections/:sectionId/package-links')
  async linkNarrativeSectionToPackageItem(
    @Param('narrativeId') narrativeId: string,
    @Param('sectionId') sectionId: string,
    @Body(new ZodValidationPipe(linkNarrativeSectionPackageItemSchema)) body,
  ) {
    return { data: await this.narratives.linkNarrativeSectionToPackageItem(narrativeId, sectionId, body) };
  }

  @Delete(':narrativeId/sections/:sectionId/package-links/:submissionPackageItemId')
  async unlinkNarrativeSectionFromPackageItem(
    @Param('narrativeId') narrativeId: string,
    @Param('sectionId') sectionId: string,
    @Param('submissionPackageItemId') submissionPackageItemId: string,
  ) {
    return { data: await this.narratives.unlinkNarrativeSectionFromPackageItem(narrativeId, sectionId, submissionPackageItemId) };
  }

  @Post(':narrativeId/submit-for-review')
  async submitNarrativeForReview(@Param('narrativeId') narrativeId: string) {
    return { data: await this.narratives.submitNarrativeForReview(narrativeId) };
  }

  @Post(':narrativeId/return-to-draft')
  async returnNarrativeToDraft(@Param('narrativeId') narrativeId: string) {
    return { data: await this.narratives.returnNarrativeToDraft(narrativeId) };
  }

  @Post(':narrativeId/finalize')
  async finalizeNarrative(@Param('narrativeId') narrativeId: string) {
    return { data: await this.narratives.finalizeNarrative(narrativeId) };
  }
}
