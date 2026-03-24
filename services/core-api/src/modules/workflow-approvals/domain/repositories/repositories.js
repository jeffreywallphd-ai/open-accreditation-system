export class ReviewCycleRepository {
  async save(_cycle) {
    throw new Error('ReviewCycleRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('ReviewCycleRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('ReviewCycleRepository.findByFilter not implemented');
  }

  async getActiveByScope(_institutionId, _scopeKey) {
    throw new Error('ReviewCycleRepository.getActiveByScope not implemented');
  }
}

export class ReviewWorkflowRepository {
  async save(_workflow) {
    throw new Error('ReviewWorkflowRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('ReviewWorkflowRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('ReviewWorkflowRepository.findByFilter not implemented');
  }

  async getByCycleAndTarget(_reviewCycleId, _targetType, _targetId) {
    throw new Error('ReviewWorkflowRepository.getByCycleAndTarget not implemented');
  }
}

