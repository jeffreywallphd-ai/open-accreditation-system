export class CreateEvidenceItemCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(input) {
    return this.service.createEvidenceItem(input);
  }
}

export class AttachEvidenceArtifactCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(evidenceItemId, input) {
    return this.service.addEvidenceArtifact(evidenceItemId, input);
  }
}

export class AttachEvidenceReferenceCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(evidenceItemId, input) {
    return this.service.addEvidenceReference(evidenceItemId, input);
  }
}

export class MarkEvidenceCompleteCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(evidenceItemId) {
    return this.service.markEvidenceComplete(evidenceItemId);
  }
}

export class MarkEvidenceIncompleteCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(evidenceItemId) {
    return this.service.markEvidenceIncomplete(evidenceItemId);
  }
}

export class ActivateEvidenceItemCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(evidenceItemId) {
    return this.service.activateEvidenceItem(evidenceItemId);
  }
}

export class SupersedeEvidenceItemCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(evidenceItemId, successorEvidenceItemId) {
    return this.service.supersedeEvidenceItem(evidenceItemId, successorEvidenceItemId);
  }
}

export class ArchiveEvidenceItemCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(evidenceItemId) {
    return this.service.archiveEvidenceItem(evidenceItemId);
  }
}

export class UpdateEvidenceItemStatusCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(evidenceItemId, action, input = {}) {
    return this.service.updateEvidenceItemStatus(evidenceItemId, action, input);
  }
}

export class CreateSupersedingEvidenceVersionCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(evidenceItemId, input = {}) {
    return this.service.createSupersedingEvidenceVersion(evidenceItemId, input);
  }
}
