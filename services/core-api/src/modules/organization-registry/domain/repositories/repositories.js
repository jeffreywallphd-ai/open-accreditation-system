export class InstitutionRepository {
  async save(_institution) {
    throw new Error('InstitutionRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('InstitutionRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('InstitutionRepository.findByFilter not implemented');
  }
}

export class PersonRepository {
  async save(_person) {
    throw new Error('PersonRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('PersonRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('PersonRepository.findByFilter not implemented');
  }

  async isReferenced(_id) {
    throw new Error('PersonRepository.isReferenced not implemented');
  }
}

export class OrganizationUnitRepository {
  async save(_unit) {
    throw new Error('OrganizationUnitRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('OrganizationUnitRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('OrganizationUnitRepository.findByFilter not implemented');
  }

  async findByInstitutionId(_institutionId) {
    throw new Error('OrganizationUnitRepository.findByInstitutionId not implemented');
  }
}

export class CommitteeRepository {
  async save(_committee) {
    throw new Error('CommitteeRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('CommitteeRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('CommitteeRepository.findByFilter not implemented');
  }
}
