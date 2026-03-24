import { createOrganizationRegistryModule } from './modules/organization-registry/index.js';
import { createIdentityAccessModule } from './modules/identity-access/index.js';

export function createCoreApiModules() {
  const organizationRegistry = createOrganizationRegistryModule();

  const identityAccess = createIdentityAccessModule({
    organizationRegistry: {
      institutions: organizationRegistry.repositories.institutions,
      people: organizationRegistry.repositories.people,
      organizationUnits: organizationRegistry.repositories.organizationUnits,
      committees: organizationRegistry.repositories.committees,
    },
  });

  return {
    organizationRegistry,
    identityAccess,
  };
}
