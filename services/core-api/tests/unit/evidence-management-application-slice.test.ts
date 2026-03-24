import assert from 'node:assert/strict';
import { EvidenceManagementService } from '../../src/modules/evidence-management/application/evidence-management-service.js';
import {
  ActivateEvidenceItemCommand,
  AttachEvidenceArtifactCommand,
  CreateEvidenceItemCommand,
  MarkEvidenceCompleteCommand,
} from '../../src/modules/evidence-management/application/commands/evidence-management-commands.js';
import { GetEvidenceItemByIdQuery } from '../../src/modules/evidence-management/application/queries/evidence-management-queries.js';
import { evidenceSourceType, evidenceStatus, evidenceType } from '../../src/modules/evidence-management/domain/value-objects/evidence-classifications.js';
import { InMemoryEvidenceItemRepository } from '../../src/modules/evidence-management/infrastructure/persistence/in-memory-evidence-management-repositories.js';
import { Institution } from '../../src/modules/organization-registry/domain/entities/institution.js';
import { InMemoryInstitutionRepository } from '../../src/modules/organization-registry/infrastructure/persistence/in-memory-organization-registry-repositories.js';
import { ValidationError } from '../../src/modules/shared/kernel/errors.js';

export async function runTests(): Promise<void> {
  const institutions = new InMemoryInstitutionRepository();
  const evidenceItems = new InMemoryEvidenceItemRepository();
  const service = new EvidenceManagementService({ institutions, evidenceItems });

  const institution = Institution.create({
    id: 'inst_application_slice',
    name: 'Application Slice University',
    code: 'ASU',
  });
  await institutions.save(institution);

  const createEvidenceItem = new CreateEvidenceItemCommand(service);
  const attachEvidenceArtifact = new AttachEvidenceArtifactCommand(service);
  const markEvidenceComplete = new MarkEvidenceCompleteCommand(service);
  const activateEvidenceItem = new ActivateEvidenceItemCommand(service);
  const getEvidenceItemById = new GetEvidenceItemByIdQuery(service);

  const evidenceItem = await createEvidenceItem.execute({
    institutionId: institution.id,
    title: 'Assessment Narrative 2026',
    evidenceType: evidenceType.NARRATIVE,
    sourceType: evidenceSourceType.MANUAL,
  });

  assert.equal(evidenceItem.status, evidenceStatus.DRAFT);
  assert.equal(evidenceItem.artifacts.length, 0);
  assert.equal(evidenceItem.usability.hasAvailableArtifact, false);

  await assert.rejects(
    () => activateEvidenceItem.execute(evidenceItem.id),
    ValidationError,
    'activation should fail until the item is complete and has an available artifact',
  );

  await attachEvidenceArtifact.execute(evidenceItem.id, {
    artifactName: 'assessment-narrative.pdf',
    artifactType: 'primary',
    mimeType: 'application/pdf',
    storageBucket: 'evidence-bucket',
    storageKey: 'assessments/2026/assessment-narrative.pdf',
  });

  await markEvidenceComplete.execute(evidenceItem.id);
  await activateEvidenceItem.execute(evidenceItem.id);

  const restored = await getEvidenceItemById.execute(evidenceItem.id);
  assert.ok(restored);
  assert.equal(restored?.status, evidenceStatus.ACTIVE);
  assert.equal(restored?.artifacts.length, 1);
  assert.equal(restored?.usability.isUsable, true);
  assert.equal(restored?.usability.currentArtifactId, restored?.artifacts[0].id);
}
