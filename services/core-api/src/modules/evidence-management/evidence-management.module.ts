import { Module } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../infrastructure/persistence/persistence.tokens.js';
import { AFR_SERVICE, AccreditationFrameworksModule } from '../accreditation-frameworks/accreditation-frameworks.module.js';
import { CURR_SERVICE, CurriculumMappingModule } from '../curriculum-mapping/curriculum-mapping.module.js';
import { ORG_REPOSITORY_TOKENS, OrganizationRegistryModule } from '../organization-registry/organization-registry.module.js';
import { EvidenceManagementController } from './api/evidence-management.controller.js';
import { EvidenceManagementService } from './application/evidence-management-service.js';
import { WorkflowEvidenceReadinessService } from './application/workflow-evidence-readiness-service.js';
import { SqliteEvidenceItemRepository } from './infrastructure/persistence/sqlite-evidence-management-repositories.js';

export const EVID_REPOSITORY_TOKENS = {
  evidenceItems: Symbol('EVID_EVIDENCE_ITEM_REPOSITORY'),
};

export const EVID_SERVICE = Symbol('EVID_SERVICE');
export const EVID_WORKFLOW_READINESS = Symbol('EVID_WORKFLOW_READINESS');

@Module({
  imports: [OrganizationRegistryModule, AccreditationFrameworksModule, CurriculumMappingModule],
  controllers: [EvidenceManagementController],
  providers: [
    {
      provide: EVID_REPOSITORY_TOKENS.evidenceItems,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteEvidenceItemRepository(database),
    },
    {
      provide: EVID_SERVICE,
      inject: [EVID_REPOSITORY_TOKENS.evidenceItems, ORG_REPOSITORY_TOKENS.institutions, AFR_SERVICE, CURR_SERVICE],
      useFactory: (evidenceItems, institutions, accreditationFrameworks, curriculumMapping) =>
        new EvidenceManagementService({
          evidenceItems,
          institutions,
          accreditationFrameworks,
          curriculumMapping,
        }),
    },
    {
      provide: EVID_WORKFLOW_READINESS,
      inject: [EVID_SERVICE],
      useFactory: (evidenceManagement) =>
        new WorkflowEvidenceReadinessService({
          evidenceManagement,
        }),
    },
  ],
  exports: [EVID_SERVICE, EVID_WORKFLOW_READINESS],
})
export class EvidenceManagementModule {}
