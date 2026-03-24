import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe.js';
import { EVID_SERVICE } from '../evidence-management.module.js';
import {
  EVIDENCE_ARTIFACT_STATUS_VALUES,
  EVIDENCE_SOURCE_TYPE_VALUES,
  EVIDENCE_STATUS_VALUES,
  EVIDENCE_TYPE_VALUES,
} from '../domain/value-objects/evidence-classifications.js';
import { evidenceLifecycleAction } from '../application/evidence-management-service.js';

const createEvidenceItemSchema = z.object({
  id: z.string().optional(),
  institutionId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  evidenceType: z.string().refine((value) => EVIDENCE_TYPE_VALUES.includes(value), 'Invalid evidenceType'),
  sourceType: z.string().refine((value) => EVIDENCE_SOURCE_TYPE_VALUES.includes(value), 'Invalid sourceType'),
  status: z.string().refine((value) => EVIDENCE_STATUS_VALUES.includes(value), 'Invalid status').optional(),
  isComplete: z.boolean().optional(),
  reportingPeriodId: z.string().optional(),
  reviewCycleId: z.string().optional(),
});

const addEvidenceArtifactSchema = z.object({
  id: z.string().optional(),
  artifactName: z.string().min(1),
  artifactType: z.string().optional(),
  mimeType: z.string().min(1),
  fileExtension: z.string().optional(),
  byteSize: z.number().int().nonnegative().optional(),
  storageBucket: z.string().min(1),
  storageKey: z.string().min(1),
  sourceChecksum: z.string().optional(),
  status: z.string().refine((value) => EVIDENCE_ARTIFACT_STATUS_VALUES.includes(value), 'Invalid artifact status').optional(),
  uploadedAt: z.string().optional(),
});

const supersedeEvidenceSchema = z.object({
  successorEvidenceItemId: z.string().min(1),
});

const lifecycleActionSchema = z
  .object({
    action: z
      .string()
      .refine(
        (value) =>
          [
            evidenceLifecycleAction.COMPLETE,
            evidenceLifecycleAction.INCOMPLETE,
            evidenceLifecycleAction.ACTIVATE,
            evidenceLifecycleAction.SUPERSEDE,
            evidenceLifecycleAction.ARCHIVE,
          ].includes(value),
        'Invalid lifecycle action',
      ),
    successorEvidenceItemId: z.string().optional(),
  })
  .superRefine((body, ctx) => {
    if (body.action === evidenceLifecycleAction.SUPERSEDE && !body.successorEvidenceItemId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'successorEvidenceItemId is required for supersede action',
        path: ['successorEvidenceItemId'],
      });
    }
  });

@Controller('evidence-management')
export class EvidenceManagementController {
  constructor(@Inject(EVID_SERVICE) private readonly service) {}

  @Post('evidence-items')
  @HttpCode(HttpStatus.CREATED)
  async createEvidenceItem(@Body(new ZodValidationPipe(createEvidenceItemSchema)) body) {
    return { data: await this.service.createEvidenceItem(body) };
  }

  @Get('evidence-items/:evidenceItemId')
  async getEvidenceItemById(@Param('evidenceItemId') evidenceItemId: string) {
    return { data: await this.service.getEvidenceItemById(evidenceItemId) };
  }

  @Get('evidence-items')
  async listEvidenceItems(
    @Query('institutionId') institutionId?: string,
    @Query('evidenceType') evidenceType?: string,
    @Query('sourceType') sourceType?: string,
    @Query('status') status?: string,
  ) {
    return {
      data: await this.service.listEvidenceItems({
        institutionId,
        evidenceType,
        sourceType,
        status,
      }),
    };
  }

  @Post('evidence-items/:evidenceItemId/artifacts')
  async addEvidenceArtifact(
    @Param('evidenceItemId') evidenceItemId: string,
    @Body(new ZodValidationPipe(addEvidenceArtifactSchema)) body,
  ) {
    return { data: await this.service.addEvidenceArtifact(evidenceItemId, body) };
  }

  @Post('evidence-items/:evidenceItemId/complete')
  async markEvidenceComplete(@Param('evidenceItemId') evidenceItemId: string) {
    return { data: await this.service.markEvidenceComplete(evidenceItemId) };
  }

  @Post('evidence-items/:evidenceItemId/incomplete')
  async markEvidenceIncomplete(@Param('evidenceItemId') evidenceItemId: string) {
    return { data: await this.service.markEvidenceIncomplete(evidenceItemId) };
  }

  @Post('evidence-items/:evidenceItemId/activate')
  async activateEvidenceItem(@Param('evidenceItemId') evidenceItemId: string) {
    return { data: await this.service.activateEvidenceItem(evidenceItemId) };
  }

  @Post('evidence-items/:evidenceItemId/supersede')
  async supersedeEvidenceItem(
    @Param('evidenceItemId') evidenceItemId: string,
    @Body(new ZodValidationPipe(supersedeEvidenceSchema)) body,
  ) {
    return { data: await this.service.supersedeEvidenceItem(evidenceItemId, body.successorEvidenceItemId) };
  }

  @Post('evidence-items/:evidenceItemId/archive')
  async archiveEvidenceItem(@Param('evidenceItemId') evidenceItemId: string) {
    return { data: await this.service.archiveEvidenceItem(evidenceItemId) };
  }

  @Post('evidence-items/:evidenceItemId/status')
  async updateEvidenceItemStatus(
    @Param('evidenceItemId') evidenceItemId: string,
    @Body(new ZodValidationPipe(lifecycleActionSchema)) body,
  ) {
    return {
      data: await this.service.updateEvidenceItemStatus(evidenceItemId, body.action, {
        successorEvidenceItemId: body.successorEvidenceItemId,
      }),
    };
  }
}
