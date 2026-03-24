export class ScopeReferencePort {
  async ensureInstitutionExists(_institutionId) {
    throw new Error('ScopeReferencePort.ensureInstitutionExists not implemented');
  }

  async ensureProgramsExist(_programIds) {
    throw new Error('ScopeReferencePort.ensureProgramsExist not implemented');
  }

  async ensureOrganizationUnitsExist(_organizationUnitIds) {
    throw new Error('ScopeReferencePort.ensureOrganizationUnitsExist not implemented');
  }
}
