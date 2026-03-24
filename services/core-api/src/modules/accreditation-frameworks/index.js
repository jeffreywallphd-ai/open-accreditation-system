import { AccreditationFrameworksService } from './application/accreditation-frameworks-service.js';
import {
  InMemoryAccreditationCycleRepository,
  InMemoryAccreditationFrameworkRepository,
  InMemoryAccreditorRepository,
  InMemoryFrameworkVersionRepository,
  InMemoryScopeReferenceAdapter,
} from './infrastructure/persistence/in-memory-accreditation-frameworks-repositories.js';

export function createAccreditationFrameworksModule(dependencies = {}) {
  const repositories = {
    accreditors: dependencies.accreditors ?? new InMemoryAccreditorRepository(),
    frameworks: dependencies.frameworks ?? new InMemoryAccreditationFrameworkRepository(),
    frameworkVersions: dependencies.frameworkVersions ?? new InMemoryFrameworkVersionRepository(),
    cycles: dependencies.cycles ?? new InMemoryAccreditationCycleRepository(),
  };

  const scopeReferences = dependencies.scopeReferences ?? new InMemoryScopeReferenceAdapter(dependencies.scopeReferenceSeed);

  const service = new AccreditationFrameworksService({
    ...repositories,
    scopeReferences,
  });

  return {
    repositories,
    service,
  };
}
