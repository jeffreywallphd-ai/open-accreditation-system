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
    evidenceType: evidenceType.NARRATIVE,
    sourceType: evidenceSourceType.MANUAL,
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

  assert.throws(() => evidenceItem.activate(), ValidationError, 'draft evidence cannot activate without completeness/artifact');
  assert.equal(evidenceItem.usability.isUsable, false);

  evidenceItem.addArtifact({
    artifactName: 'Program Narrative.pdf',
    artifactType: 'primary',
    mimeType: 'application/pdf',
    storageBucket: 'evidence-bucket',
    storageKey: 'evidence/program-narrative.pdf',
  });
  evidenceItem.markComplete();
  evidenceItem.activate();

  assert.equal(evidenceItem.status, evidenceStatus.ACTIVE);
  assert.equal(evidenceItem.usability.isComplete, true);
  assert.equal(evidenceItem.usability.hasAvailableArtifact, true);
  assert.equal(evidenceItem.usability.isUsable, true);

  evidenceItem.markIncomplete();
  assert.equal(evidenceItem.status, evidenceStatus.INCOMPLETE);
  assert.equal(evidenceItem.usability.isUsable, false);
  assert.equal(evidenceItem.usability.currentArtifactId !== null, true);

  const successorId = 'ev_item_successor';
  evidenceItem.supersedeBy(successorId);
  assert.equal(evidenceItem.status, evidenceStatus.SUPERSEDED);
  assert.equal(evidenceItem.supersededByEvidenceItemId, successorId);

  assert.throws(
    () => evidenceItem.addArtifact({
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
  assert.throws(() => archived.markComplete(), ValidationError, 'archived evidence cannot be modified');
}
