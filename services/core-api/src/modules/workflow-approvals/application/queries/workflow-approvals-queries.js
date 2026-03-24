export class GetReviewCycleByIdQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(id) {
    return this.service.getReviewCycleById(id);
  }
}

export class ListReviewCyclesQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(filter = {}) {
    return this.service.listReviewCycles(filter);
  }
}

export class GetReviewWorkflowByIdQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(id) {
    return this.service.getReviewWorkflowById(id);
  }
}

export class ListReviewWorkflowsQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(filter = {}) {
    return this.service.listReviewWorkflows(filter);
  }
}

export class GetWorkflowStateForCycleQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(reviewCycleId) {
    return this.service.getWorkflowStateForCycle(reviewCycleId);
  }
}

