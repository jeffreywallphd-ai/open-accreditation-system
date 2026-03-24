export class EvidenceItemRepository {
  async save(_evidenceItem) {
    throw new Error('EvidenceItemRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('EvidenceItemRepository.getById not implemented');
  }

  async getCurrentByLineageId(_evidenceLineageId) {
    throw new Error('EvidenceItemRepository.getCurrentByLineageId not implemented');
  }

  async listByLineageId(_evidenceLineageId) {
    throw new Error('EvidenceItemRepository.listByLineageId not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('EvidenceItemRepository.findByFilter not implemented');
  }
}
