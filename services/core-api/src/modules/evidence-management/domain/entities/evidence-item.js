import { assertRequired, assertString } from '../../../shared/kernel/assertions.js';
import { ValidationError } from '../../../shared/kernel/errors.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import {
  evidenceArtifactStatus,
  evidenceStatus,
  parseEvidenceArtifactStatus,
  parseEvidenceSourceType,
  parseEvidenceStatus,
  parseEvidenceType,
  requiresArtifactForActivation,
} from '../value-objects/evidence-classifications.js';

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
    this.supersededByEvidenceItemId = props.supersededByEvidenceItemId ?? null;
    this.reportingPeriodId = props.reportingPeriodId ?? null;
    this.reviewCycleId = props.reviewCycleId ?? null;
    this.artifacts = (props.artifacts ?? []).map((item) =>
      item instanceof EvidenceArtifact ? item : EvidenceArtifact.rehydrate(item),
    );
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;

    this.#assertArtifactOwnershipIntegrity();
    this.#assertUsabilityIntegrity();
    this.#assertSupersessionIntegrity();
  }

  static create(input) {
    const now = nowIso();
    return new EvidenceItem({
      id: input.id ?? createId('ev_item'),
      institutionId: input.institutionId,
      title: input.title,
      description: input.description,
      evidenceType: input.evidenceType,
      sourceType: input.sourceType,
      status: input.status ?? evidenceStatus.DRAFT,
      isComplete: input.isComplete ?? false,
      supersededByEvidenceItemId: input.supersededByEvidenceItemId,
      reportingPeriodId: input.reportingPeriodId,
      reviewCycleId: input.reviewCycleId,
      artifacts: input.artifacts ?? [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(input) {
    return new EvidenceItem(input);
  }

  registerArtifactMetadata(input) {
    this.#assertMutableForMetadataChanges('register artifact metadata');

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

  markReadyForUse() {
    this.#assertMutableForMetadataChanges('mark complete');
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
    this.#assertMutableForMetadataChanges('mark incomplete');
    this.isComplete = false;
    this.status = evidenceStatus.INCOMPLETE;
    this.updatedAt = nowIso();
    return this;
  }

  activateForUse() {
    this.#assertMutableForMetadataChanges('activate');
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
    if (this.status === evidenceStatus.ARCHIVED) {
      throw new ValidationError('Archived EvidenceItem cannot be superseded');
    }
    if (this.status === evidenceStatus.SUPERSEDED) {
      throw new ValidationError('Superseded EvidenceItem cannot be superseded again');
    }
    this.status = evidenceStatus.SUPERSEDED;
    this.supersededByEvidenceItemId = successorEvidenceItemId;
    this.updatedAt = nowIso();
    return this;
  }

  supersedeWith(successorEvidenceItemId) {
    return this.supersedeBy(successorEvidenceItemId);
  }

  archive() {
    this.#assertMutableForMetadataChanges('archive');
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

  #assertMutableForMetadataChanges(action) {
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
}
