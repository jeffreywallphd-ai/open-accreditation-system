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
  metadata: z.record(z.any()).optional(),
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
}
