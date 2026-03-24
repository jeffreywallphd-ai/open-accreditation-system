export class GetOrganizationUnitHierarchyQuery {
  constructor(service) {
    this.service = service;
  }

  async execute({ institutionId, status }) {
    return this.service.getOrganizationUnitHierarchy(institutionId, status);
  }
}

export class ListInstitutionsQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(filter) {
    return this.service.listInstitutions(filter);
  }
}

export class ListPeopleQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(filter) {
    return this.service.listPeople(filter);
  }
}

export class ListOrganizationUnitsQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(filter) {
    return this.service.listOrganizationUnits(filter);
  }
}

export class ListCommitteesQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(filter) {
    return this.service.listCommittees(filter);
  }
}
