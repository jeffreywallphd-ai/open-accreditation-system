import {
  AccreditationCycleRepository,
  AccreditationFrameworkRepository,
  AccreditorRepository,
  FrameworkVersionRepository,
} from '../../domain/repositories/repositories.js';
import { ScopeReferencePort } from '../../application/scope-reference-port.js';
import { ValidationError } from '../../../shared/kernel/errors.js';

function matchesFilter(item, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (value === undefined || value === null) {
      return true;
    }
    return item[key] === value;
  });
}

export class InMemoryAccreditorRepository extends AccreditorRepository {
  constructor() {
    super();
    this.items = new Map();
  }

  async save(accreditor) {
    this.items.set(accreditor.id, accreditor);
    return accreditor;
  }

  async getById(id) {
    return this.items.get(id) ?? null;
  }

  async findByFilter(filter = {}) {
    return [...this.items.values()].filter((item) => matchesFilter(item, filter));
  }
}

export class InMemoryAccreditationFrameworkRepository extends AccreditationFrameworkRepository {
  constructor() {
    super();
    this.items = new Map();
  }

  async save(framework) {
    this.items.set(framework.id, framework);
    return framework;
  }

  async getById(id) {
    return this.items.get(id) ?? null;
  }

  async findByFilter(filter = {}) {
    return [...this.items.values()].filter((item) => matchesFilter(item, filter));
  }
}

export class InMemoryFrameworkVersionRepository extends FrameworkVersionRepository {
  constructor() {
    super();
    this.items = new Map();
  }

  async save(frameworkVersion) {
    this.items.set(frameworkVersion.id, frameworkVersion);
    return frameworkVersion;
  }

  async getById(id) {
    return this.items.get(id) ?? null;
  }

  async getByFrameworkIdAndVersionTag(frameworkId, versionTag) {
    return (
      [...this.items.values()].find((item) => item.frameworkId === frameworkId && item.versionTag === versionTag) ?? null
    );
  }

  async findByFilter(filter = {}) {
    return [...this.items.values()].filter((item) => matchesFilter(item, filter));
  }
}

export class InMemoryAccreditationCycleRepository extends AccreditationCycleRepository {
  constructor() {
    super();
    this.items = new Map();
  }

  async save(cycle) {
    this.items.set(cycle.id, cycle);
    return cycle;
  }

  async getById(id) {
    return this.items.get(id) ?? null;
  }

  async findByFilter(filter = {}) {
    return [...this.items.values()].filter((item) => matchesFilter(item, filter));
  }
}

export class InMemoryScopeReferenceAdapter extends ScopeReferencePort {
  constructor(input = {}) {
    super();
    this.institutionIds = new Set(input.institutionIds ?? []);
    this.programIds = new Set(input.programIds ?? []);
    this.organizationUnitIds = new Set(input.organizationUnitIds ?? []);
  }

  async ensureInstitutionExists(institutionId) {
    if (!this.institutionIds.has(institutionId)) {
      throw new ValidationError(`Institution not found: ${institutionId}`);
    }
  }

  async ensureProgramsExist(programIds) {
    for (const id of programIds) {
      if (!this.programIds.has(id)) {
        throw new ValidationError(`Program not found: ${id}`);
      }
    }
  }

  async ensureOrganizationUnitsExist(organizationUnitIds) {
    for (const id of organizationUnitIds) {
      if (!this.organizationUnitIds.has(id)) {
        throw new ValidationError(`OrganizationUnit not found: ${id}`);
      }
    }
  }
}
