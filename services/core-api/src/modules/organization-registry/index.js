import { OrganizationRegistryService } from './application/organization-registry-service.js';
import {
  InMemoryInstitutionRepository,
  InMemoryPersonRepository,
  InMemoryOrganizationUnitRepository,
  InMemoryCommitteeRepository,
} from './infrastructure/persistence/in-memory-organization-registry-repositories.js';
import { createOrganizationRegistryApi } from './api/organization-registry-api.js';

export function createOrganizationRegistryModule(dependencies = {}) {
  const repositories = {
    institutions: dependencies.institutions ?? new InMemoryInstitutionRepository(),
    people: dependencies.people ?? new InMemoryPersonRepository(),
    organizationUnits: dependencies.organizationUnits ?? new InMemoryOrganizationUnitRepository(),
    committees: dependencies.committees ?? new InMemoryCommitteeRepository(),
  };

  const service = new OrganizationRegistryService(repositories);
  const api = createOrganizationRegistryApi(service);

  return {
    repositories,
    service,
    api,
  };
}
