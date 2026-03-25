export class CreateSubmissionPackageCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(input) {
    return this.service.createSubmissionPackage(input);
  }
}

export class AddSubmissionPackageItemCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(submissionPackageId, input) {
    return this.service.addSubmissionPackageItem(submissionPackageId, input);
  }
}

export class RemoveSubmissionPackageItemCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(submissionPackageId, itemId) {
    return this.service.removeSubmissionPackageItem(submissionPackageId, itemId);
  }
}

export class ReorderSubmissionPackageItemCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(submissionPackageId, itemId, newPosition) {
    return this.service.reorderSubmissionPackageItem(submissionPackageId, itemId, newPosition);
  }
}

export class SnapshotSubmissionPackageCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(submissionPackageId, options = {}) {
    return this.service.snapshotSubmissionPackage(submissionPackageId, options);
  }
}

export class CreateNarrativeCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(input) {
    return this.service.createNarrative(input);
  }
}

export class AddNarrativeSectionCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(narrativeId, input) {
    return this.service.addNarrativeSection(narrativeId, input);
  }
}

export class LinkNarrativeSectionEvidenceCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(narrativeId, sectionId, input) {
    return this.service.linkNarrativeSectionEvidence(narrativeId, sectionId, input);
  }
}

export class LinkNarrativeSectionToPackageItemCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(narrativeId, sectionId, input) {
    return this.service.linkNarrativeSectionToPackageItem(narrativeId, sectionId, input);
  }
}

export class SubmitNarrativeForReviewCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(narrativeId) {
    return this.service.submitNarrativeForReview(narrativeId);
  }
}

export class FinalizeNarrativeCommand {
  constructor(service) {
    this.service = service;
  }

  async execute(narrativeId) {
    return this.service.finalizeNarrative(narrativeId);
  }
}
