import { Institution } from '../domain/entities/institution.js';
import { Person } from '../domain/entities/person.js';
import { OrganizationUnit } from '../domain/entities/organization-unit.js';
import { Committee } from '../domain/entities/committee.js';
import { NotFoundError, ValidationError } from '../../shared/kernel/errors.js';
import { OrganizationHierarchyService } from '../domain/services/organization-hierarchy-service.js';

export class OrganizationRegistryService {
  constructor(repositories) {
    this.institutions = repositories.institutions;
    this.people = repositories.people;
    this.organizationUnits = repositories.organizationUnits;
    this.committees = repositories.committees;
  }

  async createInstitution(input) {
    const institution = Institution.create(input);
    return this.institutions.save(institution);
  }

  async updateInstitution(id, patch) {
    const institution = await this.institutions.getById(id);
    if (!institution) {
      throw new NotFoundError('Institution', id);
    }
    institution.update(patch);
    return this.institutions.save(institution);
  }

  async getInstitutionById(id) {
    return this.institutions.getById(id);
  }

  async listInstitutions(filter = {}) {
    return this.institutions.findByFilter(filter);
  }

  async createPerson(input) {
    await this.#requireInstitution(input.institutionId);
    const person = Person.create(input);
    return this.people.save(person);
  }

  async updatePerson(id, patch) {
    const person = await this.people.getById(id);
    if (!person) {
      throw new NotFoundError('Person', id);
    }

    if (patch.personStatus === 'historical-only' && !(await this.people.isReferenced(id))) {
      throw new ValidationError('historical-only status requires referenced person records');
    }

    person.update(patch);
    return this.people.save(person);
  }

  async getPersonById(id) {
    return this.people.getById(id);
  }

  async listPeople(filter = {}) {
    return this.people.findByFilter(filter);
  }

  async createOrganizationUnit(input) {
    await this.#requireInstitution(input.institutionId);

    if (input.parentUnitId) {
      const parent = await this.organizationUnits.getById(input.parentUnitId);
      if (!parent) {
        throw new ValidationError(`Parent OrganizationUnit not found: ${input.parentUnitId}`);
      }
      if (parent.institutionId !== input.institutionId) {
        throw new ValidationError('OrganizationUnit parent must belong to same institution');
      }
    }

    const unit = OrganizationUnit.create(input);
    const allUnits = await this.organizationUnits.findByInstitutionId(input.institutionId);
    const unitsById = new Map(allUnits.map((item) => [item.id, item]));
    OrganizationHierarchyService.assertAcyclic(unitsById, unit.id, unit.parentUnitId);

    return this.organizationUnits.save(unit);
  }

  async updateOrganizationUnit(id, patch) {
    const unit = await this.organizationUnits.getById(id);
    if (!unit) {
      throw new NotFoundError('OrganizationUnit', id);
    }

    const nextParentId = patch.parentUnitId === undefined ? unit.parentUnitId : patch.parentUnitId;
    if (nextParentId) {
      const parent = await this.organizationUnits.getById(nextParentId);
      if (!parent) {
        throw new ValidationError(`Parent OrganizationUnit not found: ${nextParentId}`);
      }
      if (parent.institutionId !== unit.institutionId) {
        throw new ValidationError('OrganizationUnit parent must belong to same institution');
      }
    }

    const allUnits = await this.organizationUnits.findByInstitutionId(unit.institutionId);
    const unitsById = new Map(allUnits.map((item) => [item.id, item]));
    unitsById.set(id, { ...unit, ...patch });
    OrganizationHierarchyService.assertAcyclic(unitsById, id, nextParentId);

    unit.update(patch);
    return this.organizationUnits.save(unit);
  }

  async getOrganizationUnitById(id) {
    return this.organizationUnits.getById(id);
  }

  async listOrganizationUnits(filter = {}) {
    return this.organizationUnits.findByFilter(filter);
  }

  async getOrganizationUnitHierarchy(institutionId, status = undefined) {
    const units = await this.organizationUnits.findByInstitutionId(institutionId);
    const filtered = status ? units.filter((u) => u.status === status) : units;
    return OrganizationHierarchyService.buildHierarchy(filtered);
  }

  async createCommittee(input) {
    await this.#requireInstitution(input.institutionId);

    if (input.sponsoringUnitId) {
      const sponsoringUnit = await this.organizationUnits.getById(input.sponsoringUnitId);
      if (!sponsoringUnit || sponsoringUnit.institutionId !== input.institutionId) {
        throw new ValidationError('Committee sponsoringUnitId must refer to unit in same institution');
      }
    }

    const committee = Committee.create(input);
    return this.committees.save(committee);
  }

  async updateCommittee(id, patch) {
    const committee = await this.committees.getById(id);
    if (!committee) {
      throw new NotFoundError('Committee', id);
    }

    const institutionId = patch.institutionId ?? committee.institutionId;

    if (patch.sponsoringUnitId) {
      const sponsoringUnit = await this.organizationUnits.getById(patch.sponsoringUnitId);
      if (!sponsoringUnit || sponsoringUnit.institutionId !== institutionId) {
        throw new ValidationError('Committee sponsoringUnitId must refer to unit in same institution');
      }
    }

    committee.update(patch);
    return this.committees.save(committee);
  }

  async getCommitteeById(id) {
    return this.committees.getById(id);
  }

  async listCommittees(filter = {}) {
    return this.committees.findByFilter(filter);
  }

  async #requireInstitution(institutionId) {
    const institution = await this.institutions.getById(institutionId);
    if (!institution) {
      throw new ValidationError(`Institution not found: ${institutionId}`);
    }
  }
}
