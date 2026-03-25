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
