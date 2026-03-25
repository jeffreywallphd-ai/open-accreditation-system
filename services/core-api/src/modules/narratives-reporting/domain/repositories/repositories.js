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
