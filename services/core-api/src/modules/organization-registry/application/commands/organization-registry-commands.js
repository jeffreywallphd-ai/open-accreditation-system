export class CreateInstitutionCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(input) {
    return this.service.createInstitution(input);
  }
}

export class UpdateInstitutionCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(id, patch) {
    return this.service.updateInstitution(id, patch);
  }
}

export class CreatePersonCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(input) {
    return this.service.createPerson(input);
  }
}

export class UpdatePersonCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(id, patch) {
    return this.service.updatePerson(id, patch);
  }
}

export class CreateOrganizationUnitCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(input) {
    return this.service.createOrganizationUnit(input);
  }
}

export class UpdateOrganizationUnitCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(id, patch) {
    return this.service.updateOrganizationUnit(id, patch);
  }
}

export class CreateCommitteeCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(input) {
    return this.service.createCommittee(input);
  }
}

export class UpdateCommitteeCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(id, patch) {
    return this.service.updateCommittee(id, patch);
  }
}
