import { assertRequired, assertString } from '../../../shared/kernel/assertions.js';
import { ValidationError } from '../../../shared/kernel/errors.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import {
  evidenceArtifactStatus,
  evidenceReferenceRelationshipType,
  evidenceReferenceTargetType,
  evidenceStatus,
  parseEvidenceArtifactStatus,
  parseEvidenceReferenceRelationshipType,
  parseEvidenceReferenceTargetType,
  parseEvidenceSourceType,
  parseEvidenceStatus,
  parseEvidenceType,
  requiresArtifactForActivation,
} from '../value-objects/evidence-classifications.js';

const EDITABLE_EVIDENCE_STATUSES = Object.freeze(new Set([evidenceStatus.DRAFT, evidenceStatus.INCOMPLETE]));
const EVIDENCE_STATUS_TRANSITIONS = Object.freeze({
  [evidenceStatus.DRAFT]: new Set([evidenceStatus.INCOMPLETE, evidenceStatus.ACTIVE, evidenceStatus.ARCHIVED]),
  [evidenceStatus.INCOMPLETE]: new Set([evidenceStatus.DRAFT, evidenceStatus.ARCHIVED]),
  [evidenceStatus.ACTIVE]: new Set([evidenceStatus.INCOMPLETE, evidenceStatus.SUPERSEDED, evidenceStatus.ARCHIVED]),
  [evidenceStatus.SUPERSEDED]: new Set(),
  [evidenceStatus.ARCHIVED]: new Set(),
});

export class EvidenceArtifact {
  constructor(props) {
    assertRequired(props.id, 'EvidenceArtifact.id');
    assertRequired(props.evidenceItemId, 'EvidenceArtifact.evidenceItemId');
    assertString(props.artifactName, 'EvidenceArtifact.artifactName');
    assertString(props.artifactType, 'EvidenceArtifact.artifactType');
    assertString(props.mimeType, 'EvidenceArtifact.mimeType');
    assertString(props.storageBucket, 'EvidenceArtifact.storageBucket');
    assertString(props.storageKey, 'EvidenceArtifact.storageKey');
    parseEvidenceArtifactStatus(props.status);

    if (props.byteSize !== undefined && props.byteSize !== null && (!Number.isInteger(props.byteSize) || props.byteSize < 0)) {
      throw new ValidationError('EvidenceArtifact.byteSize must be a non-negative integer');
    }

    this.id = props.id;
    this.evidenceItemId = props.evidenceItemId;
    this.artifactName = props.artifactName;
    this.artifactType = props.artifactType;
    this.mimeType = props.mimeType;
    this.fileExtension = props.fileExtension ?? null;
    this.byteSize = props.byteSize ?? null;
    this.storageBucket = props.storageBucket;
    this.storageKey = props.storageKey;
    this.sourceChecksum = props.sourceChecksum ?? null;
    this.status = props.status;
    this.uploadedAt = props.uploadedAt ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    if (input.status === evidenceArtifactStatus.REMOVED) {
      throw new ValidationError('EvidenceArtifact.status=removed cannot be registered as a new artifact');
    }

    const now = nowIso();
    return new EvidenceArtifact({
      id: input.id ?? createId('ev_art'),
      evidenceItemId: input.evidenceItemId,
      artifactName: input.artifactName,
      artifactType: input.artifactType ?? 'primary',
      mimeType: input.mimeType,
      fileExtension: input.fileExtension,
      byteSize: input.byteSize,
      storageBucket: input.storageBucket,
      storageKey: input.storageKey,
      sourceChecksum: input.sourceChecksum,
      status: input.status ?? evidenceArtifactStatus.AVAILABLE,
      uploadedAt: input.uploadedAt ?? now,
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(input) {
    return new EvidenceArtifact(input);
  }
}

export class EvidenceReference {
  constructor(props) {
    assertRequired(props.id, 'EvidenceReference.id');
    assertRequired(props.evidenceItemId, 'EvidenceReference.evidenceItemId');
    parseEvidenceReferenceTargetType(props.targetType);
    assertRequired(props.targetEntityId, 'EvidenceReference.targetEntityId');
    parseEvidenceReferenceRelationshipType(props.relationshipType);

    if (props.rationale !== undefined && props.rationale !== null && typeof props.rationale !== 'string') {
      throw new ValidationError('EvidenceReference.rationale must be a string when provided');
    }
    if (props.anchorPath !== undefined && props.anchorPath !== null && typeof props.anchorPath !== 'string') {
      throw new ValidationError('EvidenceReference.anchorPath must be a string when provided');
    }

    this.id = props.id;
    this.evidenceItemId = props.evidenceItemId;
    this.targetType = props.targetType;
    this.targetEntityId = props.targetEntityId;
    this.relationshipType = props.relationshipType;
    this.rationale = props.rationale ?? null;
    this.anchorPath = props.anchorPath ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new EvidenceReference({
      id: input.id ?? createId('ev_ref'),
      evidenceItemId: input.evidenceItemId,
      targetType: input.targetType,
      targetEntityId: input.targetEntityId,
      relationshipType: input.relationshipType ?? evidenceReferenceRelationshipType.SUPPORTS,
      rationale: input.rationale,
      anchorPath: input.anchorPath,
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(input) {
    return new EvidenceReference(input);
  }
}

export class EvidenceItem {
  constructor(props) {
    assertRequired(props.id, 'EvidenceItem.id');
    assertRequired(props.institutionId, 'EvidenceItem.institutionId');
    assertString(props.title, 'EvidenceItem.title');
    parseEvidenceType(props.evidenceType);
    parseEvidenceSourceType(props.sourceType);
    parseEvidenceStatus(props.status);

    this.#assertNoArtifactStorageFields(props);

    this.id = props.id;
    this.institutionId = props.institutionId;
    this.title = props.title;
    this.description = props.description ?? null;
    this.evidenceType = props.evidenceType;
    this.sourceType = props.sourceType;
    this.status = props.status;
    this.isComplete = props.isComplete ?? false;
    this.evidenceLineageId = props.evidenceLineageId ?? this.id;
    this.versionNumber = props.versionNumber ?? 1;
    this.supersedesEvidenceItemId = props.supersedesEvidenceItemId ?? null;
    this.supersededByEvidenceItemId = props.supersededByEvidenceItemId ?? null;
    this.reportingPeriodId = props.reportingPeriodId ?? null;
    this.reviewCycleId = props.reviewCycleId ?? null;
    this.artifacts = (props.artifacts ?? []).map((item) =>
      item instanceof EvidenceArtifact ? item : EvidenceArtifact.rehydrate(item),
    );
    this.references = (props.references ?? []).map((item) =>
      item instanceof EvidenceReference ? item : EvidenceReference.rehydrate(item),
    );
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;

    this.#assertArtifactOwnershipIntegrity();
    this.#assertReferenceOwnershipIntegrity();
    this.#assertReferenceUniquenessIntegrity();
    this.#assertUsabilityIntegrity();
    this.#assertVersionIntegrity();
    this.#assertSupersessionIntegrity();
  }

  static create(input) {
    if (input.status !== undefined && input.status !== evidenceStatus.DRAFT) {
      throw new ValidationError('EvidenceItem.create only supports initial status=draft');
    }
    if (input.isComplete !== undefined && input.isComplete !== false) {
      throw new ValidationError('EvidenceItem.create only supports initial isComplete=false');
    }
    if (input.supersededByEvidenceItemId !== undefined && input.supersededByEvidenceItemId !== null) {
      throw new ValidationError('EvidenceItem.create cannot set supersededByEvidenceItemId');
    }

    const now = nowIso();
    return new EvidenceItem({
      id: input.id ?? createId('ev_item'),
      institutionId: input.institutionId,
      title: input.title,
      description: input.description,
      evidenceType: input.evidenceType,
      sourceType: input.sourceType,
      status: evidenceStatus.DRAFT,
      isComplete: false,
      evidenceLineageId: input.evidenceLineageId ?? input.id ?? null,
      versionNumber: input.versionNumber ?? 1,
      supersedesEvidenceItemId: input.supersedesEvidenceItemId ?? null,
      supersededByEvidenceItemId: null,
      reportingPeriodId: input.reportingPeriodId,
      reviewCycleId: input.reviewCycleId,
      artifacts: input.artifacts ?? [],
      references: input.references ?? [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(input) {
    return new EvidenceItem(input);
  }

  registerArtifactMetadata(input) {
    this.#assertArtifactMutationAllowed('register artifact metadata');

    const artifact = EvidenceArtifact.create({
      ...input,
      evidenceItemId: this.id,
    });
    this.artifacts.push(artifact);
    this.updatedAt = nowIso();
    return artifact;
  }

  addArtifact(input) {
    return this.registerArtifactMetadata(input);
  }

  addReference(input) {
    this.#assertReferenceMutationAllowed('add evidence reference');
    const reference = EvidenceReference.create({
      ...input,
      evidenceItemId: this.id,
    });
    this.#assertNoDuplicateReference(reference);
    this.references.push(reference);
    this.updatedAt = nowIso();
    return reference;
  }

  createSupersedingVersion(input = {}) {
    if (this.status !== evidenceStatus.ACTIVE) {
      throw new ValidationError('Only active EvidenceItem can create a superseding version');
    }

    return EvidenceItem.create({
      ...input,
      institutionId: this.institutionId,
      title: input.title ?? this.title,
      description: input.description ?? this.description ?? undefined,
      evidenceType: this.evidenceType,
      sourceType: this.sourceType,
      reportingPeriodId: input.reportingPeriodId ?? this.reportingPeriodId ?? undefined,
      reviewCycleId: input.reviewCycleId ?? this.reviewCycleId ?? undefined,
      evidenceLineageId: this.evidenceLineageId,
      versionNumber: this.versionNumber + 1,
      supersedesEvidenceItemId: this.id,
    });
  }

  markReadyForUse() {
    this.#assertCanMarkReady();
    this.isComplete = true;
    if (this.status === evidenceStatus.INCOMPLETE) {
      this.status = evidenceStatus.DRAFT;
    }
    this.updatedAt = nowIso();
    return this;
  }

  markComplete() {
    return this.markReadyForUse();
  }

  markIncomplete() {
    this.#assertCanMarkIncomplete();
    this.isComplete = false;
    this.status = evidenceStatus.INCOMPLETE;
    this.updatedAt = nowIso();
    return this;
  }

  activateForUse() {
    this.#assertTransition(evidenceStatus.ACTIVE, 'activate');
    this.#assertCanActivate();
    this.status = evidenceStatus.ACTIVE;
    this.updatedAt = nowIso();
    return this;
  }

  activate() {
    return this.activateForUse();
  }

  supersedeBy(successorEvidenceItemId) {
    assertRequired(successorEvidenceItemId, 'EvidenceItem.supersededByEvidenceItemId');
    if (successorEvidenceItemId === this.id) {
      throw new ValidationError('EvidenceItem cannot supersede itself');
    }
    this.#assertTransition(evidenceStatus.SUPERSEDED, 'supersede');
    this.status = evidenceStatus.SUPERSEDED;
    this.supersededByEvidenceItemId = successorEvidenceItemId;
    this.updatedAt = nowIso();
    return this;
  }

  supersedeWith(successorEvidenceItemId) {
    return this.supersedeBy(successorEvidenceItemId);
  }

  archive() {
    this.#assertTransition(evidenceStatus.ARCHIVED, 'archive');
    this.status = evidenceStatus.ARCHIVED;
    this.updatedAt = nowIso();
    return this;
  }

  get requiresArtifactForActivation() {
    return requiresArtifactForActivation({
      evidenceType: this.evidenceType,
      sourceType: this.sourceType,
    });
  }

  get usability() {
    const hasAvailableArtifact = this.currentArtifact !== null;
    const hasRequiredArtifact = this.requiresArtifactForActivation ? hasAvailableArtifact : true;
    const isUsable = this.status === evidenceStatus.ACTIVE && this.isComplete && hasRequiredArtifact;
    return {
      isComplete: this.isComplete,
      hasAvailableArtifact,
      requiresArtifactForActivation: this.requiresArtifactForActivation,
      currentArtifactId: this.currentArtifact?.id ?? null,
      isUsable,
    };
  }

  get currentArtifact() {
    for (let index = this.artifacts.length - 1; index >= 0; index -= 1) {
      if (this.artifacts[index].status === evidenceArtifactStatus.AVAILABLE) {
        return this.artifacts[index];
      }
    }
    return null;
  }

  #assertArtifactOwnershipIntegrity() {
    for (const artifact of this.artifacts) {
      if (artifact.evidenceItemId !== this.id) {
        throw new ValidationError('EvidenceArtifact.evidenceItemId must match owning EvidenceItem.id');
      }
    }
  }

  #assertReferenceOwnershipIntegrity() {
    for (const reference of this.references) {
      if (reference.evidenceItemId !== this.id) {
        throw new ValidationError('EvidenceReference.evidenceItemId must match owning EvidenceItem.id');
      }
    }
  }

  #assertReferenceUniquenessIntegrity() {
    const keys = new Set();
    for (const reference of this.references) {
      const key = this.#referenceKey(reference);
      if (keys.has(key)) {
        throw new ValidationError(
          `EvidenceReference duplicate association is not allowed for target=${reference.targetType}:${reference.targetEntityId}`,
        );
      }
      keys.add(key);
    }
  }

  #assertUsabilityIntegrity() {
    if (this.status === evidenceStatus.INCOMPLETE && this.isComplete) {
      throw new ValidationError('EvidenceItem.status=incomplete requires isComplete=false');
    }

    if (this.status === evidenceStatus.ACTIVE) {
      this.#assertCanActivate();
    }
  }

  #assertSupersessionIntegrity() {
    if (this.status === evidenceStatus.SUPERSEDED && !this.supersededByEvidenceItemId) {
      throw new ValidationError('EvidenceItem.status=superseded requires supersededByEvidenceItemId');
    }
    if (this.status !== evidenceStatus.SUPERSEDED && this.supersededByEvidenceItemId) {
      throw new ValidationError('EvidenceItem.supersededByEvidenceItemId is only valid when status is superseded');
    }
  }

  #assertVersionIntegrity() {
    assertRequired(this.evidenceLineageId, 'EvidenceItem.evidenceLineageId');
    if (!Number.isInteger(this.versionNumber) || this.versionNumber < 1) {
      throw new ValidationError('EvidenceItem.versionNumber must be an integer >= 1');
    }

    if (this.versionNumber === 1 && this.supersedesEvidenceItemId) {
      throw new ValidationError('EvidenceItem.versionNumber=1 cannot set supersedesEvidenceItemId');
    }
    if (this.versionNumber > 1 && !this.supersedesEvidenceItemId) {
      throw new ValidationError('EvidenceItem.versionNumber>1 requires supersedesEvidenceItemId');
    }
  }

  #assertTransition(nextStatus, action) {
    const allowed = EVIDENCE_STATUS_TRANSITIONS[this.status] ?? new Set();
    if (!allowed.has(nextStatus)) {
      throw new ValidationError(
        `EvidenceItem cannot ${action} from status=${this.status} to status=${nextStatus}`,
      );
    }
  }

  #assertCanMarkReady() {
    if (this.status !== evidenceStatus.DRAFT && this.status !== evidenceStatus.INCOMPLETE) {
      throw new ValidationError(`EvidenceItem cannot mark complete while status is ${this.status}`);
    }
  }

  #assertCanMarkIncomplete() {
    if (this.status !== evidenceStatus.DRAFT && this.status !== evidenceStatus.ACTIVE && this.status !== evidenceStatus.INCOMPLETE) {
      throw new ValidationError(`EvidenceItem cannot mark incomplete while status is ${this.status}`);
    }
  }

  #assertNoArtifactStorageFields(props) {
    if (
      props.storageBucket !== undefined ||
      props.storageKey !== undefined ||
      props.mimeType !== undefined ||
      props.byteSize !== undefined
    ) {
      throw new ValidationError(
        'EvidenceItem must not embed artifact storage metadata; use EvidenceArtifact child records instead',
      );
    }
  }

  #assertArtifactMutationAllowed(action) {
    if (!EDITABLE_EVIDENCE_STATUSES.has(this.status)) {
      throw new ValidationError(`EvidenceItem cannot ${action} while status is ${this.status}`);
    }
  }

  #assertReferenceMutationAllowed(action) {
    if (this.status === evidenceStatus.SUPERSEDED || this.status === evidenceStatus.ARCHIVED) {
      throw new ValidationError(`EvidenceItem cannot ${action} while status is ${this.status}`);
    }
  }

  #assertActivationMetadata() {
    if (!this.description || typeof this.description !== 'string' || this.description.trim() === '') {
      throw new ValidationError('EvidenceItem.status=active requires non-empty description');
    }
    if (!this.reportingPeriodId && !this.reviewCycleId) {
      throw new ValidationError('EvidenceItem.status=active requires reportingPeriodId or reviewCycleId');
    }
  }

  #assertCanActivate() {
    this.#assertActivationMetadata();

    if (!this.isComplete) {
      throw new ValidationError('EvidenceItem.status=active requires isComplete=true');
    }

    if (this.requiresArtifactForActivation && !this.usability.hasAvailableArtifact) {
      throw new ValidationError(
        'EvidenceItem.status=active requires at least one available EvidenceArtifact for the current evidenceType/sourceType',
      );
    }
  }

  #assertNoDuplicateReference(candidate) {
    const candidateKey = this.#referenceKey(candidate);
    for (const reference of this.references) {
      if (this.#referenceKey(reference) === candidateKey) {
        throw new ValidationError(
          `EvidenceReference duplicate association is not allowed for target=${candidate.targetType}:${candidate.targetEntityId}`,
        );
      }
    }
  }

  #referenceKey(reference) {
    return `${reference.targetType}|${reference.targetEntityId}|${reference.relationshipType}|${reference.anchorPath ?? ''}`;
  }
}
