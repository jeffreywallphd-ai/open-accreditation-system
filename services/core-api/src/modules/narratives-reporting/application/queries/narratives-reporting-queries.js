export class GetSubmissionPackageByIdQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(id) {
    return this.service.getSubmissionPackageById(id);
  }
}

export class ListSubmissionPackagesQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(filter = {}) {
    return this.service.listSubmissionPackages(filter);
  }
}

export class GetSubmissionPackageWithContextQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(id) {
    return this.service.getSubmissionPackageWithItemContext(id);
  }
}

export class GetNarrativeByIdQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(id) {
    return this.service.getNarrativeById(id);
  }
}

export class GetNarrativeWithContextQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(id) {
    return this.service.getNarrativeWithSectionContext(id);
  }
}

export class ListNarrativesQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(filter = {}) {
    return this.service.listNarratives(filter);
  }
}
