import { assertRequired, assertString } from '../../../shared/kernel/assertions.js';
import { ValidationError } from '../../../shared/kernel/errors.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import {
  parseSubmissionPackageItemType,
  parseSubmissionPackageStatus,
  submissionPackageItemType,
  submissionPackageStatus,
} from '../value-objects/submission-package-statuses.js';

function normalizeIdList(values = []) {
  const normalized = [...new Set((values ?? []).filter(Boolean).map((value) => `${value}`.trim()).filter(Boolean))];
  normalized.sort((left, right) => left.localeCompare(right));
  return normalized;
}

function normalizeObject(value, field) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${field} must be an object when provided`);
  }
  return value;
}

function resequence(items = []) {
  return items.map((item, index) => {
    item.sequence = index + 1;
    return item;
  });
}

export class SubmissionPackageItem {
  constructor(props) {
    assertRequired(props.id, 'SubmissionPackageItem.id');
    assertRequired(props.packageId, 'SubmissionPackageItem.packageId');
    parseSubmissionPackageItemType(props.itemType);
    assertString(props.targetType, 'SubmissionPackageItem.targetType');
    assertRequired(props.targetId, 'SubmissionPackageItem.targetId');
    if (!Number.isInteger(props.sequence) || props.sequence < 1) {
      throw new ValidationError('SubmissionPackageItem.sequence must be an integer >= 1');
    }

    this.id = props.id;
    this.packageId = props.packageId;
    this.sequence = props.sequence;
    this.itemType = props.itemType;
    this.targetType = props.targetType;
    this.targetId = props.targetId;
    this.workflowId = props.workflowId ? `${props.workflowId}`.trim() || null : null;
    this.evidenceItemIds = normalizeIdList(props.evidenceItemIds ?? []);
    this.label = props.label ? `${props.label}`.trim() || null : null;
    this.rationale = props.rationale ? `${props.rationale}`.trim() || null : null;
    this.metadata = normalizeObject(props.metadata, 'SubmissionPackageItem.metadata');
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;

    if (
      this.itemType === submissionPackageItemType.EVIDENCE_ITEM &&
      this.evidenceItemIds.length === 0 &&
      this.targetType !== 'evidence-item'
    ) {
      throw new ValidationError(
        'SubmissionPackageItem itemType=evidence-item requires targetType=evidence-item or explicit evidenceItemIds',
      );
    }
  }

  static create(input) {
    const now = nowIso();
    return new SubmissionPackageItem({
      id: input.id ?? createId('sub_pkg_item'),
      packageId: input.packageId,
      sequence: input.sequence,
      itemType: input.itemType ?? submissionPackageItemType.WORKFLOW_TARGET,
      targetType: input.targetType,
      targetId: input.targetId,
      workflowId: input.workflowId,
      evidenceItemIds: input.evidenceItemIds ?? [],
      label: input.label,
      rationale: input.rationale,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(input) {
    return new SubmissionPackageItem(input);
  }
}

export class SubmissionPackageSnapshotItem {
  constructor(props) {
    assertRequired(props.id, 'SubmissionPackageSnapshotItem.id');
    assertRequired(props.snapshotId, 'SubmissionPackageSnapshotItem.snapshotId');
    assertRequired(props.packageItemId, 'SubmissionPackageSnapshotItem.packageItemId');
    parseSubmissionPackageItemType(props.itemType, 'SubmissionPackageSnapshotItem.itemType');
    assertString(props.targetType, 'SubmissionPackageSnapshotItem.targetType');
    assertRequired(props.targetId, 'SubmissionPackageSnapshotItem.targetId');
    if (!Number.isInteger(props.sequence) || props.sequence < 1) {
      throw new ValidationError('SubmissionPackageSnapshotItem.sequence must be an integer >= 1');
    }

    this.id = props.id;
    this.snapshotId = props.snapshotId;
    this.packageItemId = props.packageItemId;
    this.sequence = props.sequence;
    this.itemType = props.itemType;
    this.targetType = props.targetType;
    this.targetId = props.targetId;
    this.workflowId = props.workflowId ? `${props.workflowId}`.trim() || null : null;
    this.evidenceItemIds = normalizeIdList(props.evidenceItemIds ?? []);
    this.label = props.label ? `${props.label}`.trim() || null : null;
    this.rationale = props.rationale ? `${props.rationale}`.trim() || null : null;
    this.metadata = normalizeObject(props.metadata, 'SubmissionPackageSnapshotItem.metadata');
    this.createdAt = props.createdAt;
  }

  static create(input) {
    return new SubmissionPackageSnapshotItem({
      id: input.id ?? createId('sub_pkg_snap_item'),
      snapshotId: input.snapshotId,
      packageItemId: input.packageItemId,
      sequence: input.sequence,
      itemType: input.itemType,
      targetType: input.targetType,
      targetId: input.targetId,
      workflowId: input.workflowId,
      evidenceItemIds: input.evidenceItemIds,
      label: input.label,
      rationale: input.rationale,
      metadata: input.metadata,
      createdAt: input.createdAt ?? nowIso(),
    });
  }
}

export class SubmissionPackageSnapshot {
  constructor(props) {
    assertRequired(props.id, 'SubmissionPackageSnapshot.id');
    assertRequired(props.packageId, 'SubmissionPackageSnapshot.packageId');
    if (!Number.isInteger(props.versionNumber) || props.versionNumber < 1) {
      throw new ValidationError('SubmissionPackageSnapshot.versionNumber must be an integer >= 1');
    }

    this.id = props.id;
    this.packageId = props.packageId;
    this.versionNumber = props.versionNumber;
    this.milestoneLabel = props.milestoneLabel ? `${props.milestoneLabel}`.trim() || null : null;
    this.actorId = props.actorId ? `${props.actorId}`.trim() || null : null;
    this.notes = props.notes ? `${props.notes}`.trim() || null : null;
    this.finalized = props.finalized === true;
    this.items = (props.items ?? []).map((item) =>
      item instanceof SubmissionPackageSnapshotItem ? item : SubmissionPackageSnapshotItem.create(item),
    );
    this.createdAt = props.createdAt;

    this.#assertIntegrity();
  }

  static create(input) {
    return new SubmissionPackageSnapshot({
      id: input.id ?? createId('sub_pkg_snap'),
      packageId: input.packageId,
      versionNumber: input.versionNumber,
      milestoneLabel: input.milestoneLabel,
      actorId: input.actorId,
      notes: input.notes,
      finalized: input.finalized === true,
      items: input.items ?? [],
      createdAt: input.createdAt ?? nowIso(),
    });
  }

  static rehydrate(input) {
    return new SubmissionPackageSnapshot(input);
  }

  #assertIntegrity() {
    const ids = new Set();
    let lastSequence = 0;
    for (const item of this.items) {
      if (item.snapshotId !== this.id) {
        throw new ValidationError('SubmissionPackageSnapshotItem.snapshotId must match owning snapshot id');
      }
      if (ids.has(item.id)) {
        throw new ValidationError(`SubmissionPackageSnapshotItem.id must be unique within snapshot: ${item.id}`);
      }
      if (item.sequence !== lastSequence + 1) {
        throw new ValidationError('SubmissionPackageSnapshotItem.sequence must be contiguous and start at 1');
      }
      ids.add(item.id);
      lastSequence = item.sequence;
    }
  }
}

export class SubmissionPackage {
  constructor(props) {
    assertRequired(props.id, 'SubmissionPackage.id');
    assertRequired(props.institutionId, 'SubmissionPackage.institutionId');
    assertRequired(props.reviewCycleId, 'SubmissionPackage.reviewCycleId');
    assertString(props.scopeType, 'SubmissionPackage.scopeType');
    assertRequired(props.scopeId, 'SubmissionPackage.scopeId');
    parseSubmissionPackageStatus(props.status);

    this.id = props.id;
    this.institutionId = props.institutionId;
    this.reviewCycleId = props.reviewCycleId;
    this.scopeType = props.scopeType;
    this.scopeId = props.scopeId;
    this.name = props.name ? `${props.name}`.trim() || null : null;
    this.status = props.status;
    this.items = resequence(
      (props.items ?? []).map((item) => (item instanceof SubmissionPackageItem ? item : SubmissionPackageItem.rehydrate(item))),
    );
    this.snapshots = (props.snapshots ?? []).map((snapshot) =>
      snapshot instanceof SubmissionPackageSnapshot
        ? snapshot
        : SubmissionPackageSnapshot.rehydrate(snapshot),
    );
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.finalizedAt = props.finalizedAt ?? null;

    this.#assertIntegrity();
  }

  static create(input) {
    const now = nowIso();
    return new SubmissionPackage({
      id: input.id ?? createId('sub_pkg'),
      institutionId: input.institutionId,
      reviewCycleId: input.reviewCycleId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      name: input.name,
      status: input.status ?? submissionPackageStatus.DRAFT,
      items: [],
      snapshots: [],
      createdAt: now,
      updatedAt: now,
      finalizedAt: null,
    });
  }

  static rehydrate(input) {
    return new SubmissionPackage(input);
  }

  addItem(input) {
    this.#assertDraft('add item');
    const item = SubmissionPackageItem.create({
      ...input,
      packageId: this.id,
      sequence: this.items.length + 1,
    });
    this.#assertNoDuplicateTarget(item);
    this.items.push(item);
    this.updatedAt = nowIso();
    return item;
  }

  removeItem(itemId) {
    this.#assertDraft('remove item');
    const index = this.items.findIndex((item) => item.id === itemId);
    if (index < 0) {
      throw new ValidationError(`SubmissionPackage item not found: ${itemId}`);
    }
    this.items.splice(index, 1);
    resequence(this.items);
    this.updatedAt = nowIso();
    return this;
  }

  reorderItem(itemId, newPosition) {
    this.#assertDraft('reorder item');
    if (!Number.isInteger(newPosition) || newPosition < 1 || newPosition > this.items.length) {
      throw new ValidationError('SubmissionPackage.reorderItem newPosition must be within current item range');
    }
    const currentIndex = this.items.findIndex((item) => item.id === itemId);
    if (currentIndex < 0) {
      throw new ValidationError(`SubmissionPackage item not found: ${itemId}`);
    }
    const [item] = this.items.splice(currentIndex, 1);
    this.items.splice(newPosition - 1, 0, item);
    resequence(this.items);
    this.updatedAt = nowIso();
    return this;
  }

  captureSnapshot(options = {}) {
    const snapshotId = options.snapshotId ?? createId('sub_pkg_snap');
    const versionNumber = this.snapshots.length + 1;
    const now = nowIso();
    const items = this.items.map((item) =>
      SubmissionPackageSnapshotItem.create({
        snapshotId,
        packageItemId: item.id,
        sequence: item.sequence,
        itemType: item.itemType,
        targetType: item.targetType,
        targetId: item.targetId,
        workflowId: item.workflowId,
        evidenceItemIds: [...item.evidenceItemIds],
        label: item.label,
        rationale: item.rationale,
        metadata: item.metadata,
        createdAt: now,
      }),
    );

    const snapshot = SubmissionPackageSnapshot.create({
      id: snapshotId,
      packageId: this.id,
      versionNumber,
      milestoneLabel: options.milestoneLabel,
      actorId: options.actorId,
      notes: options.notes,
      finalized: options.finalized === true,
      items,
      createdAt: now,
    });

    this.snapshots.push(snapshot);
    if (options.finalized === true) {
      this.status = submissionPackageStatus.FINALIZED;
      this.finalizedAt = now;
    }
    this.updatedAt = now;
    this.#assertIntegrity();
    return snapshot;
  }

  finalize(options = {}) {
    if (this.status === submissionPackageStatus.FINALIZED) {
      throw new ValidationError('SubmissionPackage is already finalized');
    }
    return this.captureSnapshot({
      ...options,
      finalized: true,
    });
  }

  get latestSnapshot() {
    if (this.snapshots.length === 0) {
      return null;
    }
    return this.snapshots[this.snapshots.length - 1];
  }

  #assertDraft(action) {
    if (this.status !== submissionPackageStatus.DRAFT) {
      throw new ValidationError(`SubmissionPackage cannot ${action} while status is ${this.status}`);
    }
  }

  #assertIntegrity() {
    const itemIds = new Set();
    const targetKeys = new Set();
    let previousSequence = 0;
    for (const item of this.items) {
      if (item.packageId !== this.id) {
        throw new ValidationError('SubmissionPackageItem.packageId must match owning package id');
      }
      if (item.sequence !== previousSequence + 1) {
        throw new ValidationError('SubmissionPackageItem.sequence must be contiguous and start at 1');
      }
      if (itemIds.has(item.id)) {
        throw new ValidationError(`SubmissionPackageItem.id must be unique within package: ${item.id}`);
      }
      const targetKey = this.#targetKey(item);
      if (targetKeys.has(targetKey)) {
        throw new ValidationError(
          `SubmissionPackage cannot contain duplicate target entries for ${item.targetType}:${item.targetId}`,
        );
      }
      targetKeys.add(targetKey);
      itemIds.add(item.id);
      previousSequence = item.sequence;
    }

    let previousSnapshotVersion = 0;
    const snapshotIds = new Set();
    for (const snapshot of this.snapshots) {
      if (snapshot.packageId !== this.id) {
        throw new ValidationError('SubmissionPackageSnapshot.packageId must match owning package id');
      }
      if (snapshot.versionNumber !== previousSnapshotVersion + 1) {
        throw new ValidationError('SubmissionPackageSnapshot.versionNumber must be contiguous and start at 1');
      }
      if (snapshotIds.has(snapshot.id)) {
        throw new ValidationError(`SubmissionPackageSnapshot.id must be unique within package: ${snapshot.id}`);
      }
      snapshotIds.add(snapshot.id);
      previousSnapshotVersion = snapshot.versionNumber;
    }

    if (this.status === submissionPackageStatus.FINALIZED) {
      if (!this.finalizedAt) {
        throw new ValidationError('SubmissionPackage.finalizedAt is required when status=finalized');
      }
      const latestSnapshot = this.latestSnapshot;
      if (!latestSnapshot || latestSnapshot.finalized !== true) {
        throw new ValidationError('SubmissionPackage.finalized requires a finalizing snapshot as the latest snapshot');
      }
    }
  }

  #assertNoDuplicateTarget(candidate) {
    const key = this.#targetKey(candidate);
    for (const item of this.items) {
      if (this.#targetKey(item) === key) {
        throw new ValidationError(
          `SubmissionPackage cannot contain duplicate target entries for ${candidate.targetType}:${candidate.targetId}`,
        );
      }
    }
  }

  #targetKey(item) {
    return `${item.itemType}|${item.targetType}|${item.targetId}`;
  }
}
