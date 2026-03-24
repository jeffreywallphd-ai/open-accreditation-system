import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCoreApiApp } from '../../src/bootstrap/create-core-api-app.js';
import { EVID_SERVICE } from '../../src/modules/evidence-management/evidence-management.module.js';
import { ORG_SERVICE } from '../../src/modules/organization-registry/organization-registry.module.js';
import { evidenceSourceType, evidenceType } from '../../src/modules/evidence-management/domain/value-objects/evidence-classifications.js';

function createTempDbPath(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-api-evidence-persistence-'));
  return path.join(root, 'core-api.sqlite');
}

export async function runTests(): Promise<void> {
  const databasePath = createTempDbPath();
  const app = await createCoreApiApp({ port: 0, databasePath });

  let institutionId = '';
  let evidenceItemId = '';
  try {
    const org = app.get(ORG_SERVICE);
    const evidenceService = app.get(EVID_SERVICE);

    const institution = await org.createInstitution({
      name: 'Evidence Persistence University',
      code: 'EPU',
    });
    institutionId = institution.id;

    const created = await evidenceService.createEvidenceItem({
      institutionId: institution.id,
      title: '2026 Program Learning Outcomes Narrative',
      description: 'Narrative evidence for outcomes alignment.',
      reportingPeriodId: 'period_2026',
      evidenceType: evidenceType.NARRATIVE,
      sourceType: evidenceSourceType.MANUAL,
    });
    evidenceItemId = created.id;

    await evidenceService.addEvidenceArtifact(created.id, {
      artifactName: 'outcomes-narrative.pdf',
      artifactType: 'primary',
      mimeType: 'application/pdf',
      fileExtension: 'pdf',
      byteSize: 1024,
      storageBucket: 'evidence',
      storageKey: '2026/outcomes-narrative.pdf',
      sourceChecksum: 'sha256:abc123',
    });
    await evidenceService.addEvidenceArtifact(created.id, {
      artifactName: 'outcomes-narrative-v2.pdf',
      artifactType: 'revision',
      mimeType: 'application/pdf',
      fileExtension: 'pdf',
      byteSize: 2048,
      storageBucket: 'evidence',
      storageKey: '2026/outcomes-narrative-v2.pdf',
      sourceChecksum: 'sha256:def456',
    });
    await evidenceService.markEvidenceComplete(created.id);
    await evidenceService.activateEvidenceItem(created.id);

    const activeItems = await evidenceService.listEvidenceItems({
      institutionId: institution.id,
      status: 'active',
    });
    assert.equal(activeItems.length, 1);
    assert.equal(activeItems[0].id, created.id);
    assert.equal(activeItems[0].artifacts.length, 2);
    assert.equal(activeItems[0].usability.isUsable, true);
    assert.equal(activeItems[0].usability.currentArtifactId, activeItems[0].artifacts[1].id);
  } finally {
    await app.close();
  }

  const secondApp = await createCoreApiApp({ port: 0, databasePath });
  try {
    const evidenceService = secondApp.get(EVID_SERVICE);
    const restored = await evidenceService.getEvidenceItemById(evidenceItemId);
    assert.ok(restored);
    assert.equal(restored?.institutionId, institutionId);
    assert.equal(restored?.artifacts.length, 2);
    assert.equal(restored?.artifacts[0].storageBucket, 'evidence');
    assert.equal(restored?.artifacts[1].storageKey, '2026/outcomes-narrative-v2.pdf');
    assert.equal(restored?.usability.isUsable, true);
    assert.equal(restored?.usability.currentArtifactId, restored?.artifacts[1].id);
  } finally {
    await secondApp.close();
  }
}
