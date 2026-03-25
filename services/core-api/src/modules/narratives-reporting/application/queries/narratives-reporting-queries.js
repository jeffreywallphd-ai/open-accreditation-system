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
