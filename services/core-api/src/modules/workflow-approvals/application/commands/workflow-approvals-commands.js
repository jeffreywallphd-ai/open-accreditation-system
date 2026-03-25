export class CreateReviewCycleCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(input) {
    return this.service.createReviewCycle(input);
  }
}

export class StartReviewCycleCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(reviewCycleId) {
    return this.service.startReviewCycle(reviewCycleId);
  }
}

export class CompleteReviewCycleCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(reviewCycleId) {
    return this.service.completeReviewCycle(reviewCycleId);
  }
}

export class CreateReviewWorkflowCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(input) {
    return this.service.createWorkflowInstance(input);
  }
}

export class TransitionReviewWorkflowStateCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(reviewWorkflowId, nextState, actorRole, options = {}) {
    return this.service.transitionWorkflowState(reviewWorkflowId, nextState, actorRole, options);
  }
}

export class CreateWorkflowInstanceCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(input) {
    return this.service.createWorkflowInstance(input);
  }
}

export class TransitionWorkflowStateCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(reviewWorkflowId, nextState, actorRole, options = {}) {
    return this.service.transitionWorkflowState(reviewWorkflowId, nextState, actorRole, options);
  }
}

