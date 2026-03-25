export class SubmissionPackageRepository {
  async save(_submissionPackage) {
    throw new Error('SubmissionPackageRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('SubmissionPackageRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('SubmissionPackageRepository.findByFilter not implemented');
  }

  async getByCycleAndScope(_reviewCycleId, _scopeType, _scopeId) {
    throw new Error('SubmissionPackageRepository.getByCycleAndScope not implemented');
  }
}

export class NarrativeRepository {
  async save(_narrative) {
    throw new Error('NarrativeRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('NarrativeRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('NarrativeRepository.findByFilter not implemented');
  }

  async getBySubmissionPackageId(_submissionPackageId) {
    throw new Error('NarrativeRepository.getBySubmissionPackageId not implemented');
  }
}
