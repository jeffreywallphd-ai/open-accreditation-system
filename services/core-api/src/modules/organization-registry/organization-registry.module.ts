import { Module } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../infrastructure/persistence/persistence.tokens.js';
import { OrganizationRegistryService } from './application/organization-registry-service.js';
import {
  SqliteCommitteeRepository,
  SqliteInstitutionRepository,
  SqliteOrganizationUnitRepository,
  SqlitePersonRepository,
} from './infrastructure/persistence/sqlite-organization-registry-repositories.js';
import { OrganizationRegistryController } from './api/organization-registry.controller.js';

export const ORG_REPOSITORY_TOKENS = {
  institutions: Symbol('ORG_INSTITUTION_REPOSITORY'),
  people: Symbol('ORG_PERSON_REPOSITORY'),
  organizationUnits: Symbol('ORG_ORGANIZATION_UNIT_REPOSITORY'),
  committees: Symbol('ORG_COMMITTEE_REPOSITORY'),
};

export const ORG_SERVICE = Symbol('ORG_SERVICE');

@Module({
  controllers: [OrganizationRegistryController],
  providers: [
    {
      provide: ORG_REPOSITORY_TOKENS.institutions,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteInstitutionRepository(database),
    },
    {
      provide: ORG_REPOSITORY_TOKENS.people,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqlitePersonRepository(database),
    },
    {
      provide: ORG_REPOSITORY_TOKENS.organizationUnits,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteOrganizationUnitRepository(database),
    },
    {
      provide: ORG_REPOSITORY_TOKENS.committees,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteCommitteeRepository(database),
    },
    {
      provide: ORG_SERVICE,
      inject: [
        ORG_REPOSITORY_TOKENS.institutions,
        ORG_REPOSITORY_TOKENS.people,
        ORG_REPOSITORY_TOKENS.organizationUnits,
        ORG_REPOSITORY_TOKENS.committees,
      ],
      useFactory: (institutions, people, organizationUnits, committees) =>
        new OrganizationRegistryService({
          institutions,
          people,
          organizationUnits,
          committees,
        }),
    },
  ],
  exports: [
    ORG_SERVICE,
    ORG_REPOSITORY_TOKENS.institutions,
    ORG_REPOSITORY_TOKENS.people,
    ORG_REPOSITORY_TOKENS.organizationUnits,
    ORG_REPOSITORY_TOKENS.committees,
  ],
})
export class OrganizationRegistryModule {}
