export class AccreditorRepository {
  async save(_accreditor) {
    throw new Error('AccreditorRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('AccreditorRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('AccreditorRepository.findByFilter not implemented');
  }
}

export class AccreditationFrameworkRepository {
  async save(_framework) {
    throw new Error('AccreditationFrameworkRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('AccreditationFrameworkRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('AccreditationFrameworkRepository.findByFilter not implemented');
  }
}

export class FrameworkVersionRepository {
  async save(_frameworkVersion) {
    throw new Error('FrameworkVersionRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('FrameworkVersionRepository.getById not implemented');
  }

  async getByFrameworkIdAndVersionTag(_frameworkId, _versionTag) {
    throw new Error('FrameworkVersionRepository.getByFrameworkIdAndVersionTag not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('FrameworkVersionRepository.findByFilter not implemented');
  }
}

export class AccreditationCycleRepository {
  async save(_cycle) {
    throw new Error('AccreditationCycleRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('AccreditationCycleRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('AccreditationCycleRepository.findByFilter not implemented');
  }
}
