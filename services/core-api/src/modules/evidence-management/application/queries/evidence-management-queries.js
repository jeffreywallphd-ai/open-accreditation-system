export class GetEvidenceItemByIdQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(id) {
    return this.service.getEvidenceItemById(id);
  }
}

export class ListEvidenceItemsQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(filter = {}) {
    return this.service.listEvidenceItems(filter);
  }
}

export class GetCurrentEvidenceVersionQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(evidenceLineageId) {
    return this.service.getCurrentEvidenceVersion(evidenceLineageId);
  }
}

export class ListEvidenceVersionsQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(evidenceLineageId, options = { includeHistorical: true }) {
    return this.service.listEvidenceVersions(evidenceLineageId, options);
  }
}

export class ListEvidenceByReferenceQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(targetType, targetEntityId, options = {}) {
    return this.service.listEvidenceByReference(targetType, targetEntityId, options);
  }
}
