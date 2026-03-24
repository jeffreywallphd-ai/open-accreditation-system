import { IdentityAccessService } from './application/identity-access-service.js';
import {
  InMemoryPermissionRepository,
  InMemoryRoleRepository,
  InMemoryServicePrincipalRepository,
  InMemoryUserRepository,
} from './infrastructure/persistence/in-memory-identity-access-repositories.js';
import { OrganizationRegistryScopeReferenceAdapter } from './infrastructure/adapters/organization-registry-scope-reference-adapter.js';
import { createIdentityAccessApi } from './api/identity-access-api.js';

export function createIdentityAccessModule(dependencies = {}) {
  const repositories = {
    users: dependencies.users ?? new InMemoryUserRepository(),
    roles: dependencies.roles ?? new InMemoryRoleRepository(),
    permissions: dependencies.permissions ?? new InMemoryPermissionRepository(),
    servicePrincipals: dependencies.servicePrincipals ?? new InMemoryServicePrincipalRepository(),
  };

  const scopeReferences =
    dependencies.scopeReferences ??
    new OrganizationRegistryScopeReferenceAdapter({
      institutions: dependencies.organizationRegistry?.institutions,
      people: dependencies.organizationRegistry?.people,
      organizationUnits: dependencies.organizationRegistry?.organizationUnits,
      committees: dependencies.organizationRegistry?.committees,
    });

  const service = new IdentityAccessService({
    ...repositories,
    scopeReferences,
  });

  const api = createIdentityAccessApi(service);

  return {
    repositories,
    service,
    api,
  };
}
