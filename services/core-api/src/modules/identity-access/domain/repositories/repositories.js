export class UserRepository {
  async save(_user) {
    throw new Error('UserRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('UserRepository.getById not implemented');
  }

  async getByPersonId(_personId) {
    throw new Error('UserRepository.getByPersonId not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('UserRepository.findByFilter not implemented');
  }
}

export class RoleRepository {
  async save(_role) {
    throw new Error('RoleRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('RoleRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('RoleRepository.findByFilter not implemented');
  }
}

export class PermissionRepository {
  async save(_permission) {
    throw new Error('PermissionRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('PermissionRepository.getById not implemented');
  }

  async getByKey(_key) {
    throw new Error('PermissionRepository.getByKey not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('PermissionRepository.findByFilter not implemented');
  }
}

export class ServicePrincipalRepository {
  async save(_principal) {
    throw new Error('ServicePrincipalRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('ServicePrincipalRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('ServicePrincipalRepository.findByFilter not implemented');
  }
}

export class AccessScopeReferencePort {
  async ensurePersonExists(_personId) {
    throw new Error('AccessScopeReferencePort.ensurePersonExists not implemented');
  }

  async getPerson(_personId) {
    throw new Error('AccessScopeReferencePort.getPerson not implemented');
  }

  async ensureInstitutionExists(_institutionId) {
    throw new Error('AccessScopeReferencePort.ensureInstitutionExists not implemented');
  }

  async ensureOrganizationUnitExists(_organizationUnitId) {
    throw new Error('AccessScopeReferencePort.ensureOrganizationUnitExists not implemented');
  }

  async ensureCommitteeExists(_committeeId) {
    throw new Error('AccessScopeReferencePort.ensureCommitteeExists not implemented');
  }

  async trackPersonReference(_personId) {
    throw new Error('AccessScopeReferencePort.trackPersonReference not implemented');
  }
}
