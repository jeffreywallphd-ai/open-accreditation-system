import { Module } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../infrastructure/persistence/persistence.tokens.js';
import { IdentityAccessService } from './application/identity-access-service.js';
import { OrganizationRegistryScopeReferenceAdapter } from './infrastructure/adapters/organization-registry-scope-reference-adapter.js';
import {
  SqlitePermissionRepository,
  SqliteRoleRepository,
  SqliteServicePrincipalRepository,
  SqliteUserRepository,
} from './infrastructure/persistence/sqlite-identity-access-repositories.js';
import { ORG_REPOSITORY_TOKENS, OrganizationRegistryModule } from '../organization-registry/organization-registry.module.js';
import { IdentityAccessController } from './api/identity-access.controller.js';

export const IAM_REPOSITORY_TOKENS = {
  users: Symbol('IAM_USER_REPOSITORY'),
  roles: Symbol('IAM_ROLE_REPOSITORY'),
  permissions: Symbol('IAM_PERMISSION_REPOSITORY'),
  servicePrincipals: Symbol('IAM_SERVICE_PRINCIPAL_REPOSITORY'),
};

export const IAM_SCOPE_REFERENCES = Symbol('IAM_SCOPE_REFERENCES');
export const IAM_SERVICE = Symbol('IAM_SERVICE');

@Module({
  imports: [OrganizationRegistryModule],
  controllers: [IdentityAccessController],
  providers: [
    {
      provide: IAM_REPOSITORY_TOKENS.users,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteUserRepository(database),
    },
    {
      provide: IAM_REPOSITORY_TOKENS.roles,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteRoleRepository(database),
    },
    {
      provide: IAM_REPOSITORY_TOKENS.permissions,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqlitePermissionRepository(database),
    },
    {
      provide: IAM_REPOSITORY_TOKENS.servicePrincipals,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteServicePrincipalRepository(database),
    },
    {
      provide: IAM_SCOPE_REFERENCES,
      inject: [
        ORG_REPOSITORY_TOKENS.institutions,
        ORG_REPOSITORY_TOKENS.people,
        ORG_REPOSITORY_TOKENS.organizationUnits,
        ORG_REPOSITORY_TOKENS.committees,
      ],
      useFactory: (institutions, people, organizationUnits, committees) =>
        new OrganizationRegistryScopeReferenceAdapter({
          institutions,
          people,
          organizationUnits,
          committees,
        }),
    },
    {
      provide: IAM_SERVICE,
      inject: [
        IAM_REPOSITORY_TOKENS.users,
        IAM_REPOSITORY_TOKENS.roles,
        IAM_REPOSITORY_TOKENS.permissions,
        IAM_REPOSITORY_TOKENS.servicePrincipals,
        IAM_SCOPE_REFERENCES,
      ],
      useFactory: (users, roles, permissions, servicePrincipals, scopeReferences) =>
        new IdentityAccessService({
          users,
          roles,
          permissions,
          servicePrincipals,
          scopeReferences,
        }),
    },
  ],
  exports: [IAM_SERVICE],
})
export class IdentityAccessModule {}
