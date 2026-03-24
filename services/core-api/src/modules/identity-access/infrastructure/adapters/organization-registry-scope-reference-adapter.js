import { AccessScopeReferencePort } from '../../domain/repositories/repositories.js';
import { ValidationError } from '../../../shared/kernel/errors.js';

export class OrganizationRegistryScopeReferenceAdapter extends AccessScopeReferencePort {
  constructor({ institutions, people, organizationUnits, committees }) {
    super();
    this.institutions = institutions;
    this.people = people;
    this.organizationUnits = organizationUnits;
    this.committees = committees;
  }

  async ensurePersonExists(personId) {
    const person = await this.people.getById(personId);
    if (!person) {
      throw new ValidationError(`Person not found: ${personId}`);
    }
  }

  async getPerson(personId) {
    const person = await this.people.getById(personId);
    if (!person) {
      throw new ValidationError(`Person not found: ${personId}`);
    }
    return person;
  }

  async ensureInstitutionExists(institutionId) {
    const institution = await this.institutions.getById(institutionId);
    if (!institution) {
      throw new ValidationError(`Institution not found: ${institutionId}`);
    }
  }

  async ensureOrganizationUnitExists(organizationUnitId) {
    const unit = await this.organizationUnits.getById(organizationUnitId);
    if (!unit) {
      throw new ValidationError(`OrganizationUnit not found: ${organizationUnitId}`);
    }
  }

  async ensureCommitteeExists(committeeId) {
    const committee = await this.committees.getById(committeeId);
    if (!committee) {
      throw new ValidationError(`Committee not found: ${committeeId}`);
    }
  }

  async trackPersonReference(personId) {
    if (typeof this.people.trackReference === 'function') {
      await this.people.trackReference(personId);
    }
  }
}
