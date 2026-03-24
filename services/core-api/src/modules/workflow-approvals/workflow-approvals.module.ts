import { Module } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../infrastructure/persistence/persistence.tokens.js';
import {
  EVID_WORKFLOW_READINESS,
  EvidenceManagementModule,
} from '../evidence-management/evidence-management.module.js';
import { ORG_REPOSITORY_TOKENS, OrganizationRegistryModule } from '../organization-registry/organization-registry.module.js';
import { WorkflowApprovalsService } from './application/workflow-approvals-service.js';
import {
  SqliteReviewCycleRepository,
  SqliteReviewWorkflowRepository,
} from './infrastructure/persistence/sqlite-workflow-approvals-repositories.js';

export const WF_REPOSITORY_TOKENS = {
  reviewCycles: Symbol('WF_REVIEW_CYCLE_REPOSITORY'),
  reviewWorkflows: Symbol('WF_REVIEW_WORKFLOW_REPOSITORY'),
};

export const WF_SERVICE = Symbol('WF_SERVICE');

@Module({
  imports: [OrganizationRegistryModule, EvidenceManagementModule],
  providers: [
    {
      provide: WF_REPOSITORY_TOKENS.reviewCycles,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteReviewCycleRepository(database),
    },
    {
      provide: WF_REPOSITORY_TOKENS.reviewWorkflows,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteReviewWorkflowRepository(database),
    },
    {
      provide: WF_SERVICE,
      inject: [
        WF_REPOSITORY_TOKENS.reviewCycles,
        WF_REPOSITORY_TOKENS.reviewWorkflows,
        ORG_REPOSITORY_TOKENS.institutions,
        EVID_WORKFLOW_READINESS,
      ],
      useFactory: (cycles, workflows, institutions, evidenceReadiness) =>
        new WorkflowApprovalsService({
          cycles,
          workflows,
          institutions,
          evidenceReadiness,
        }),
    },
  ],
  exports: [WF_SERVICE],
})
export class WorkflowApprovalsModule {}

