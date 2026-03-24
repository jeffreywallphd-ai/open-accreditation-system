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

export class ListEvidenceByCriterionQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(criterionId, options = {}) {
    return this.service.listEvidenceByCriterion(criterionId, options);
  }
}

export class ListEvidenceByCriterionElementQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(criterionElementId, options = {}) {
    return this.service.listEvidenceByCriterionElement(criterionElementId, options);
  }
}

export class ListEvidenceByLearningOutcomeQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(learningOutcomeId, options = {}) {
    return this.service.listEvidenceByLearningOutcome(learningOutcomeId, options);
  }
}

export class ListEvidenceByNarrativeSectionQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(narrativeSectionId, options = {}) {
    return this.service.listEvidenceByNarrativeSection(narrativeSectionId, options);
  }
}

export class ListCurrentEvidenceQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(filter = {}) {
    return this.service.listCurrentEvidence(filter);
  }
}

export class ListHistoricalEvidenceQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(filter = {}) {
    return this.service.listHistoricalEvidence(filter);
  }
}

export class ListEvidenceWithLinkageContextQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(filter = {}) {
    return this.service.listEvidenceWithLinkageContext(filter);
  }
}

export class GetEvidenceLineageCycleReadinessQuery {
  constructor(service) {
    this.service = service;
  }

  async execute(evidenceLineageId) {
    return this.service.getEvidenceLineageCycleReadiness(evidenceLineageId);
  }
}
