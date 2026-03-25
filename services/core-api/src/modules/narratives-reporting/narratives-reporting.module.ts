import { Module } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../infrastructure/persistence/persistence.tokens.js';
import {
  EVID_WORKFLOW_READINESS,
  EvidenceManagementModule,
} from '../evidence-management/evidence-management.module.js';
import { WF_SERVICE, WorkflowApprovalsModule } from '../workflow-approvals/workflow-approvals.module.js';
import { NarrativesReportingController } from './api/narratives-reporting.controller.js';
import { NarrativesReportingService } from './application/narratives-reporting-service.js';
import { WorkflowApprovalsSubmissionContractsAdapter } from './infrastructure/adapters/workflow-approvals-submission-contracts-adapter.js';
import { SqliteSubmissionPackageRepository } from './infrastructure/persistence/sqlite-narratives-reporting-repositories.js';

export const NARR_REPOSITORY_TOKENS = {
  submissionPackages: Symbol('NARR_SUBMISSION_PACKAGE_REPOSITORY'),
  workflowContracts: Symbol('NARR_WORKFLOW_CONTRACTS'),
};

export const NARR_SERVICE = Symbol('NARR_SERVICE');

@Module({
  imports: [WorkflowApprovalsModule, EvidenceManagementModule],
  controllers: [NarrativesReportingController],
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
      provide: NARR_SERVICE,
      inject: [
        NARR_REPOSITORY_TOKENS.submissionPackages,
        NARR_REPOSITORY_TOKENS.workflowContracts,
        EVID_WORKFLOW_READINESS,
      ],
      useFactory: (submissionPackages, workflowContracts, evidenceReadiness) =>
        new NarrativesReportingService({
          submissionPackages,
          reviewCycles: workflowContracts,
          workflowTargets: workflowContracts,
          evidenceReadiness,
        }),
    },
  ],
  exports: [NARR_SERVICE],
})
export class NarrativesReportingModule {}
