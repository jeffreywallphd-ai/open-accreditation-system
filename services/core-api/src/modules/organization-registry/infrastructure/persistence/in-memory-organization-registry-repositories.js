import { InstitutionRepository, PersonRepository, OrganizationUnitRepository, CommitteeRepository } from '../../domain/repositories/repositories.js';

function matchesFilter(item, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (value === undefined || value === null) {
      return true;
    }
    return item[key] === value;
  });
}

export class InMemoryInstitutionRepository extends InstitutionRepository {
  constructor() {
    super();
    this.items = new Map();
  }

  async save(institution) {
    this.items.set(institution.id, institution);
    return institution;
  }

  async getById(id) {
    return this.items.get(id) ?? null;
  }

  async findByFilter(filter = {}) {
    return [...this.items.values()].filter((item) => matchesFilter(item, filter));
  }
}

export class InMemoryPersonRepository extends PersonRepository {
  constructor() {
    super();
    this.items = new Map();
    this.references = new Set();
  }

  async save(person) {
    this.items.set(person.id, person);
    return person;
  }

  async getById(id) {
    return this.items.get(id) ?? null;
  }

  async findByFilter(filter = {}) {
    return [...this.items.values()].filter((item) => matchesFilter(item, filter));
  }

  async isReferenced(id) {
    return this.references.has(id);
  }

  async trackReference(id) {
    this.references.add(id);
  }
}

export class InMemoryOrganizationUnitRepository extends OrganizationUnitRepository {
  constructor() {
    super();
    this.items = new Map();
  }

  async save(unit) {
    this.items.set(unit.id, unit);
    return unit;
  }

  async getById(id) {
    return this.items.get(id) ?? null;
  }

  async findByFilter(filter = {}) {
    return [...this.items.values()].filter((item) => matchesFilter(item, filter));
  }

  async findByInstitutionId(institutionId) {
    return [...this.items.values()].filter((item) => item.institutionId === institutionId);
  }
}

export class InMemoryCommitteeRepository extends CommitteeRepository {
  constructor() {
    super();
    this.items = new Map();
  }

  async save(committee) {
    this.items.set(committee.id, committee);
    return committee;
  }

  async getById(id) {
    return this.items.get(id) ?? null;
  }

  async findByFilter(filter = {}) {
    return [...this.items.values()].filter((item) => matchesFilter(item, filter));
  }
}
