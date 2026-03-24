import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCoreApiApp } from '../../src/bootstrap/create-core-api-app.js';
import { EVID_SERVICE } from '../../src/modules/evidence-management/evidence-management.module.js';
import { AFR_SERVICE } from '../../src/modules/accreditation-frameworks/accreditation-frameworks.module.js';
import { CURR_SERVICE } from '../../src/modules/curriculum-mapping/curriculum-mapping.module.js';
import { ORG_SERVICE } from '../../src/modules/organization-registry/organization-registry.module.js';
import { ValidationError } from '../../src/modules/shared/kernel/errors.js';
import {
  evidenceReferenceRelationshipType,
  evidenceReferenceTargetType,
  evidenceSourceType,
  evidenceType,
} from '../../src/modules/evidence-management/domain/value-objects/evidence-classifications.js';

function createTempDbPath(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-api-evidence-persistence-'));
  return path.join(root, 'core-api.sqlite');
}

export async function runTests(): Promise<void> {
  const databasePath = createTempDbPath();
  const app = await createCoreApiApp({ port: 0, databasePath });

  let institutionId = '';
  let evidenceItemId = '';
  let evidenceLineageId = '';
  let criterionId = '';
  let criterionElementId = '';
  let outcomeId = '';
  let successorId = '';
  try {
    const org = app.get(ORG_SERVICE);
    const evidenceService = app.get(EVID_SERVICE);
    const accreditation = app.get(AFR_SERVICE);
    const curriculum = app.get(CURR_SERVICE);

    const institution = await org.createInstitution({
      name: 'Evidence Persistence University',
      code: 'EPU',
    });
    institutionId = institution.id;

    const accreditor = await accreditation.createAccreditor({
      name: 'Higher Learning Council',
      code: 'HLC',
      description: 'HLC accreditor baseline for evidence integration tests.',
    });
    const framework = await accreditation.createFramework({
      accreditorId: accreditor.id,
      name: 'Institutional Quality Framework',
      code: 'IQF',
      description: 'Framework for integration evidence references.',
    });
    const version = await accreditation.createFrameworkVersion({
      frameworkId: framework.id,
      versionTag: 'v1.0',
    });
    const versionWithStandard = await accreditation.addStandard(version.id, {
      code: 'S1',
      title: 'Mission and Integrity',
      sequence: 1,
    });
    const standard = versionWithStandard.standards.find((item) => item.code === 'S1');
    assert.ok(standard);

    const versionWithCriterion = await accreditation.addCriterion(version.id, {
      standardId: standard.id,
      code: 'C1',
      title: 'Evidence and Outcomes',
      sequence: 1,
    });
    const criterion = versionWithCriterion.criteria.find((item) => item.code === 'C1');
    assert.ok(criterion);
    criterionId = criterion.id;

    const versionWithCriterionElement = await accreditation.addCriterionElement(version.id, {
      criterionId: criterion.id,
      code: 'C1.1',
      title: 'Outcome evidence',
      statement: 'Institution provides direct evidence of outcomes.',
      elementType: 'subcriterion',
      requiredFlag: true,
      sequence: 1,
    });
    const criterionElement = versionWithCriterionElement.criterionElements.find((item) => item.code === 'C1.1');
    assert.ok(criterionElement);
    criterionElementId = criterionElement.id;

    const program = await curriculum.createProgram({
      institutionId: institution.id,
      name: 'BS Computer Science',
      code: 'BSCS',
    });
    const learningOutcome = await curriculum.createLearningOutcome({
      institutionId: institution.id,
      code: 'LO-1',
      title: 'Analyze complex computing problems',
      statement: 'Graduates analyze complex computing problems and apply principles of computing.',
      scopeType: 'program',
      programId: program.id,
    });
    outcomeId = learningOutcome.id;

    const created = await evidenceService.createEvidenceItem({
      institutionId: institution.id,
      title: '2026 Program Learning Outcomes Narrative',
      description: 'Narrative evidence for outcomes alignment.',
      reportingPeriodId: 'period_2026',
      evidenceType: evidenceType.NARRATIVE,
      sourceType: evidenceSourceType.MANUAL,
    });
    evidenceItemId = created.id;
    evidenceLineageId = created.evidenceLineageId;

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
    await evidenceService.addEvidenceReference(created.id, {
      targetType: evidenceReferenceTargetType.CRITERION,
      targetEntityId: criterionId,
      relationshipType: evidenceReferenceRelationshipType.SUPPORTS,
    });
    await evidenceService.addEvidenceReference(created.id, {
      targetType: evidenceReferenceTargetType.CRITERION_ELEMENT,
      targetEntityId: criterionElementId,
      relationshipType: evidenceReferenceRelationshipType.RESPONDS_TO,
    });
    await evidenceService.addEvidenceReference(created.id, {
      targetType: evidenceReferenceTargetType.LEARNING_OUTCOME,
      targetEntityId: outcomeId,
      relationshipType: evidenceReferenceRelationshipType.DEMONSTRATES,
    });
    await assert.rejects(
      () =>
        evidenceService.addEvidenceReference(created.id, {
          targetType: evidenceReferenceTargetType.NARRATIVE_SECTION,
          targetEntityId: 'narrative_section_1',
          relationshipType: evidenceReferenceRelationshipType.INCLUDED_IN,
          anchorPath: 'section://1.1',
        }),
      ValidationError,
      'narrative-section linkage requires a target validation contract in the current deployment',
    );
    await evidenceService.markEvidenceComplete(created.id);
    await evidenceService.activateEvidenceItem(created.id);

    const successor = await evidenceService.createSupersedingEvidenceVersion(created.id, {
      title: '2026 Program Learning Outcomes Narrative - Revised',
      description: 'Revised narrative evidence for outcomes alignment.',
      reviewCycleId: 'cycle_2027',
    });
    successorId = successor.id;

    await evidenceService.addEvidenceArtifact(successor.id, {
      artifactName: 'outcomes-narrative-v3.pdf',
      artifactType: 'primary',
      mimeType: 'application/pdf',
      fileExtension: 'pdf',
      byteSize: 4096,
      storageBucket: 'evidence',
      storageKey: '2026/outcomes-narrative-v3.pdf',
      sourceChecksum: 'sha256:ghi789',
    });
    await evidenceService.addEvidenceReference(successor.id, {
      targetType: evidenceReferenceTargetType.CRITERION_ELEMENT,
      targetEntityId: criterionElementId,
      relationshipType: evidenceReferenceRelationshipType.SUPPORTS,
      rationale: 'Updated version maps to same criterion element with revised alignment details.',
    });
    await evidenceService.markEvidenceComplete(successor.id);
    await evidenceService.activateEvidenceItem(successor.id);

    const activeItems = await evidenceService.listEvidenceItems({
      institutionId: institution.id,
      status: 'active',
    });
    assert.equal(activeItems.length, 1);
    assert.notEqual(activeItems[0].id, created.id);
    assert.equal(activeItems[0].evidenceLineageId, evidenceLineageId);
    assert.equal(activeItems[0].versionNumber, 2);
    assert.equal(activeItems[0].artifacts.length, 1);
    assert.equal(activeItems[0].references.length, 1);
    assert.equal(activeItems[0].usability.isUsable, true);
    assert.equal(activeItems[0].usability.currentArtifactId, activeItems[0].artifacts[0].id);

    const criterionReferences = await evidenceService.listEvidenceByReference(
      evidenceReferenceTargetType.CRITERION_ELEMENT,
      criterionElementId,
      { institutionId: institution.id },
    );
    assert.equal(criterionReferences.length, 2);

    const withLinkageContext = await evidenceService.listEvidenceWithLinkageContext({
      institutionId: institution.id,
      targetType: evidenceReferenceTargetType.CRITERION_ELEMENT,
      targetEntityId: criterionElementId,
      hasRationale: true,
    });
    assert.equal(withLinkageContext.length, 1);
    assert.equal(withLinkageContext[0].evidenceItem.id, successor.id);
    assert.equal(withLinkageContext[0].linkageContext.matchingReferenceCount, 1);
    assert.equal(
      withLinkageContext[0].linkageContext.matchingReferences[0].rationale,
      'Updated version maps to same criterion element with revised alignment details.',
    );
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
    assert.equal(restored?.references.length, 3);
    assert.equal(restored?.versionNumber, 1);
    assert.equal(restored?.supersededByEvidenceItemId !== null, true);
    assert.equal(restored?.artifacts[0].storageBucket, 'evidence');
    assert.equal(restored?.artifacts[1].storageKey, '2026/outcomes-narrative-v2.pdf');
    assert.equal(restored?.usability.isUsable, false);
    assert.equal(restored?.usability.currentArtifactId, restored?.artifacts[1].id);

    await assert.rejects(
      () =>
        evidenceService.addEvidenceArtifact(evidenceItemId, {
          artifactName: 'outcomes-narrative-v3.pdf',
          artifactType: 'revision',
          mimeType: 'application/pdf',
          fileExtension: 'pdf',
          byteSize: 4096,
          storageBucket: 'evidence',
          storageKey: '2026/outcomes-narrative-v3.pdf',
          sourceChecksum: 'sha256:ghi789',
        }),
      ValidationError,
      'historical evidence should remain artifact-immutable after rehydration',
    );

    const versions = await evidenceService.listEvidenceVersions(evidenceLineageId, { includeHistorical: true });
    assert.equal(versions.length, 2);
    assert.deepEqual(
      versions.map((item) => item.versionNumber),
      [1, 2],
    );

    const current = await evidenceService.getCurrentEvidenceVersion(evidenceLineageId);
    assert.ok(current);
    assert.equal(current?.versionNumber, 2);
    assert.equal(current?.status, 'active');
    assert.equal(current?.id, successorId);

    const outcomeLinked = await evidenceService.listEvidenceByReference(
      evidenceReferenceTargetType.LEARNING_OUTCOME,
      outcomeId,
      { institutionId, currentOnly: false },
    );
    assert.equal(outcomeLinked.length, 1);
    assert.equal(outcomeLinked[0].id, evidenceItemId);

    const historical = await evidenceService.listHistoricalEvidence({ institutionId });
    assert.equal(historical.length, 1);
    assert.equal(historical[0].id, evidenceItemId);

    const currentOnly = await evidenceService.listCurrentEvidence({ institutionId });
    assert.equal(currentOnly.length, 1);
    assert.equal(currentOnly[0].id, successorId);

    const cycleReadiness = await evidenceService.getEvidenceLineageCycleReadiness(evidenceLineageId);
    assert.equal(cycleReadiness.versionCount, 2);
    assert.equal(cycleReadiness.reviewCycleIds.length, 1);
    assert.equal(cycleReadiness.reviewCycleIds[0], 'cycle_2027');
    assert.equal(cycleReadiness.reportingPeriodIds.length, 1);
    assert.equal(cycleReadiness.reportingPeriodIds[0], 'period_2026');

    await assert.rejects(
      () =>
        evidenceService.addEvidenceArtifact(evidenceItemId, {
          artifactName: 'outcomes-narrative-v4.pdf',
          artifactType: 'revision',
          mimeType: 'application/pdf',
          fileExtension: 'pdf',
          byteSize: 8192,
          storageBucket: 'evidence',
          storageKey: '2026/outcomes-narrative-v4.pdf',
          sourceChecksum: 'sha256:jkl012',
        }),
      ValidationError,
      'superseded historical version remains artifact-immutable after persistence round-trip',
    );
  } finally {
    await secondApp.close();
  }
}
