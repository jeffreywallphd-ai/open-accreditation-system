import assert from 'node:assert/strict';
import { ValidationError } from '../../src/modules/shared/kernel/errors.js';
import { EvidenceItem } from '../../src/modules/evidence-management/domain/entities/evidence-item.js';
import {
  evidenceSourceType,
  evidenceStatus,
  evidenceType,
} from '../../src/modules/evidence-management/domain/value-objects/evidence-classifications.js';

function createBaseEvidenceItemInput() {
  return {
    institutionId: 'inst_1',
    title: 'Program Review Narrative',
    description: 'Mapped narrative evidence for program review.',
    evidenceType: evidenceType.NARRATIVE,
    sourceType: evidenceSourceType.MANUAL,
    reportingPeriodId: 'period_2026',
  };
}

export async function runTests(): Promise<void> {
  assert.throws(
    () =>
      EvidenceItem.create({
        ...createBaseEvidenceItemInput(),
        evidenceType: 'pdf',
      }),
    ValidationError,
    'evidenceType validation should reject unknown values',
  );

  assert.throws(
    () =>
      EvidenceItem.create({
        ...createBaseEvidenceItemInput(),
        sourceType: 'email-dropbox',
      }),
    ValidationError,
    'sourceType validation should reject unknown values',
  );

  assert.throws(
    () =>
      EvidenceItem.create({
        ...createBaseEvidenceItemInput(),
        storageBucket: 'bucket-should-not-live-on-item',
      }),
    ValidationError,
    'EvidenceItem must stay separate from artifact storage fields',
  );

  const evidenceItem = EvidenceItem.create({
    ...createBaseEvidenceItemInput(),
    status: evidenceStatus.DRAFT,
  });

  assert.throws(() => evidenceItem.activateForUse(), ValidationError, 'draft evidence cannot activate until complete');
  assert.equal(evidenceItem.usability.isUsable, false);

  evidenceItem.registerArtifactMetadata({
    artifactName: 'Program Narrative.pdf',
    artifactType: 'primary',
    mimeType: 'application/pdf',
    storageBucket: 'evidence-bucket',
    storageKey: 'evidence/program-narrative.pdf',
  });
  evidenceItem.markReadyForUse();
  evidenceItem.activateForUse();

  assert.equal(evidenceItem.status, evidenceStatus.ACTIVE);
  assert.equal(evidenceItem.usability.isComplete, true);
  assert.equal(evidenceItem.usability.hasAvailableArtifact, true);
  assert.equal(evidenceItem.usability.requiresArtifactForActivation, false);
  assert.equal(evidenceItem.usability.isUsable, true);

  evidenceItem.markIncomplete();
  assert.equal(evidenceItem.status, evidenceStatus.INCOMPLETE);
  assert.equal(evidenceItem.usability.isUsable, false);
  assert.equal(evidenceItem.usability.currentArtifactId !== null, true);

  const successorId = 'ev_item_successor';
  evidenceItem.supersedeWith(successorId);
  assert.equal(evidenceItem.status, evidenceStatus.SUPERSEDED);
  assert.equal(evidenceItem.supersededByEvidenceItemId, successorId);

  assert.throws(
    () => evidenceItem.registerArtifactMetadata({
      artifactName: 'replacement.pdf',
      artifactType: 'primary',
      mimeType: 'application/pdf',
      storageBucket: 'evidence',
      storageKey: 'replacement.pdf',
    }),
    ValidationError,
    'superseded evidence cannot be modified',
  );

  assert.throws(
    () =>
      new EvidenceItem({
        id: 'ev_item_mismatch',
        institutionId: 'inst_1',
        title: 'Mismatch',
        evidenceType: evidenceType.DOCUMENT,
        sourceType: evidenceSourceType.UPLOAD,
        status: evidenceStatus.DRAFT,
        isComplete: false,
        artifacts: [
          {
            id: 'ev_art_wrong',
            evidenceItemId: 'different_item',
            artifactName: 'mismatch.pdf',
            artifactType: 'primary',
            mimeType: 'application/pdf',
            storageBucket: 'evidence',
            storageKey: 'mismatch.pdf',
            status: 'available',
            uploadedAt: '2026-01-01T00:00:00.000Z',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ValidationError,
    'artifact ownership must remain inside the EvidenceItem aggregate',
  );

  const archived = EvidenceItem.create({
    ...createBaseEvidenceItemInput(),
    evidenceType: evidenceType.DOCUMENT,
    sourceType: evidenceSourceType.UPLOAD,
  });
  archived.archive();
  assert.throws(() => archived.markReadyForUse(), ValidationError, 'archived evidence cannot be modified');

  const missingActivationMetadata = EvidenceItem.create({
    institutionId: 'inst_1',
    title: 'Upload Missing Metadata',
    evidenceType: evidenceType.DOCUMENT,
    sourceType: evidenceSourceType.UPLOAD,
  });
  missingActivationMetadata.markReadyForUse();
  missingActivationMetadata.registerArtifactMetadata({
    artifactName: 'doc.pdf',
    artifactType: 'primary',
    mimeType: 'application/pdf',
    storageBucket: 'evidence',
    storageKey: 'doc.pdf',
  });
  assert.throws(
    () => missingActivationMetadata.activateForUse(),
    ValidationError,
    'active evidence must satisfy core metadata requirements',
  );

  const uploadRequiresArtifact = EvidenceItem.create({
    institutionId: 'inst_1',
    title: 'Upload Needs Artifact',
    description: 'Evidence imported by upload.',
    evidenceType: evidenceType.METRIC,
    sourceType: evidenceSourceType.UPLOAD,
    reviewCycleId: 'cycle_2026',
  });
  uploadRequiresArtifact.markReadyForUse();
  assert.equal(uploadRequiresArtifact.requiresArtifactForActivation, true);
  assert.throws(
    () => uploadRequiresArtifact.activateForUse(),
    ValidationError,
    'upload evidence cannot activate without an available artifact',
  );

  const manualNarrativeWithoutArtifact = EvidenceItem.create({
    institutionId: 'inst_1',
    title: 'Manual Narrative',
    description: 'Narrative entered directly into system metadata.',
    evidenceType: evidenceType.NARRATIVE,
    sourceType: evidenceSourceType.MANUAL,
    reviewCycleId: 'cycle_2026',
  });
  manualNarrativeWithoutArtifact.markReadyForUse();
  manualNarrativeWithoutArtifact.activateForUse();
  assert.equal(manualNarrativeWithoutArtifact.usability.requiresArtifactForActivation, false);
  assert.equal(manualNarrativeWithoutArtifact.usability.hasAvailableArtifact, false);
  assert.equal(manualNarrativeWithoutArtifact.usability.isUsable, true);

  const archivedCannotBeSuperseded = EvidenceItem.create({
    ...createBaseEvidenceItemInput(),
    evidenceType: evidenceType.DATASET,
    sourceType: evidenceSourceType.INTEGRATION,
  });
  archivedCannotBeSuperseded.archive();
  assert.throws(
    () => archivedCannotBeSuperseded.supersedeWith('ev_item_newer'),
    ValidationError,
    'archived evidence cannot be superseded',
  );
}
