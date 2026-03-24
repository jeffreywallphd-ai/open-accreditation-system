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
