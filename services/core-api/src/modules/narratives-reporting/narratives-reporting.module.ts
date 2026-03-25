import { Module } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../infrastructure/persistence/persistence.tokens.js';
import {
  EVID_WORKFLOW_READINESS,
  EvidenceManagementModule,
} from '../evidence-management/evidence-management.module.js';
import { WF_SERVICE, WorkflowApprovalsModule } from '../workflow-approvals/workflow-approvals.module.js';
import { NarrativesController } from './api/narratives.controller.js';
import { SubmissionPackagesController } from './api/submission-packages.controller.js';
import { NarrativeApplicationService } from './application/narrative-application-service.js';
import { NarrativesReportingService } from './application/narratives-reporting-service.js';
import { SubmissionPackageApplicationService } from './application/submission-package-application-service.js';
import { WorkflowApprovalsSubmissionContractsAdapter } from './infrastructure/adapters/workflow-approvals-submission-contracts-adapter.js';
import {
  SqliteNarrativeRepository,
  SqliteSubmissionPackageRepository,
} from './infrastructure/persistence/sqlite-narratives-reporting-repositories.js';

export const NARR_REPOSITORY_TOKENS = {
  submissionPackages: Symbol('NARR_SUBMISSION_PACKAGE_REPOSITORY'),
  narratives: Symbol('NARR_NARRATIVE_REPOSITORY'),
  workflowContracts: Symbol('NARR_WORKFLOW_CONTRACTS'),
};

export const NARR_APPLICATION_SERVICE_TOKENS = {
  submissionPackageService: Symbol('NARR_SUBMISSION_PACKAGE_APPLICATION_SERVICE'),
  narrativeService: Symbol('NARR_NARRATIVE_APPLICATION_SERVICE'),
};

// Backward-compatible aliases for existing imports.
export const NARR_APPLICATION_TOKENS = {
  submissionPackages: NARR_APPLICATION_SERVICE_TOKENS.submissionPackageService,
  narratives: NARR_APPLICATION_SERVICE_TOKENS.narrativeService,
};

export const NARR_SERVICE = Symbol('NARR_SERVICE');

@Module({
  imports: [WorkflowApprovalsModule, EvidenceManagementModule],
  controllers: [SubmissionPackagesController, NarrativesController],
  providers: [
    {
      provide: NARR_REPOSITORY_TOKENS.submissionPackages,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteSubmissionPackageRepository(database),
    },
    {
      provide: NARR_REPOSITORY_TOKENS.workflowContracts,
      inject: [WF_SERVICE],
      useFactory: (workflowApprovals) => new WorkflowApprovalsSubmissionContractsAdapter(workflowApprovals),
    },
    {
      provide: NARR_REPOSITORY_TOKENS.narratives,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteNarrativeRepository(database),
    },
    {
      provide: NARR_APPLICATION_SERVICE_TOKENS.submissionPackageService,
      inject: [
        NARR_REPOSITORY_TOKENS.submissionPackages,
        NARR_REPOSITORY_TOKENS.workflowContracts,
        EVID_WORKFLOW_READINESS,
      ],
      useFactory: (submissionPackages, workflowContracts, evidenceReadiness) =>
        new SubmissionPackageApplicationService({
          submissionPackages,
          reviewCycles: workflowContracts,
          workflowTargets: workflowContracts,
          evidenceReadiness,
        }),
    },
    {
      provide: NARR_APPLICATION_SERVICE_TOKENS.narrativeService,
      inject: [NARR_REPOSITORY_TOKENS.narratives, NARR_REPOSITORY_TOKENS.submissionPackages, EVID_WORKFLOW_READINESS],
      useFactory: (narratives, submissionPackages, evidenceReadiness) =>
        new NarrativeApplicationService({
          narratives,
          submissionPackages,
          evidenceReadiness,
        }),
    },
    {
      provide: NARR_SERVICE,
      inject: [
        NARR_APPLICATION_SERVICE_TOKENS.submissionPackageService,
        NARR_APPLICATION_SERVICE_TOKENS.narrativeService,
      ],
      useFactory: (submissionPackageService, narrativeService) =>
        new NarrativesReportingService({
          submissionPackageService,
          narrativeService,
        }),
    },
  ],
  exports: [
    NARR_SERVICE,
    NARR_APPLICATION_SERVICE_TOKENS.submissionPackageService,
    NARR_APPLICATION_SERVICE_TOKENS.narrativeService,
  ],
})
export class NarrativesReportingModule {}
