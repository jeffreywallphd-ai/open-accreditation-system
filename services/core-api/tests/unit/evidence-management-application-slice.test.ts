import assert from 'node:assert/strict';
import { EvidenceManagementService } from '../../src/modules/evidence-management/application/evidence-management-service.js';
import {
  ActivateEvidenceItemCommand,
  AttachEvidenceReferenceCommand,
  AttachEvidenceArtifactCommand,
  CreateSupersedingEvidenceVersionCommand,
  CreateEvidenceItemCommand,
  MarkEvidenceCompleteCommand,
  UpdateEvidenceItemStatusCommand,
} from '../../src/modules/evidence-management/application/commands/evidence-management-commands.js';
import {
  GetCurrentEvidenceVersionQuery,
  GetEvidenceItemByIdQuery,
  ListEvidenceByReferenceQuery,
  ListEvidenceVersionsQuery,
} from '../../src/modules/evidence-management/application/queries/evidence-management-queries.js';
import {
  evidenceReferenceRelationshipType,
  evidenceReferenceTargetType,
  evidenceSourceType,
  evidenceStatus,
  evidenceType,
} from '../../src/modules/evidence-management/domain/value-objects/evidence-classifications.js';
import { InMemoryEvidenceItemRepository } from '../../src/modules/evidence-management/infrastructure/persistence/in-memory-evidence-management-repositories.js';
import { Institution } from '../../src/modules/organization-registry/domain/entities/institution.js';
import { InMemoryInstitutionRepository } from '../../src/modules/organization-registry/infrastructure/persistence/in-memory-organization-registry-repositories.js';
import { NotFoundError, ValidationError } from '../../src/modules/shared/kernel/errors.js';
import { evidenceLifecycleAction } from '../../src/modules/evidence-management/application/evidence-management-service.js';
import { EvidenceItem } from '../../src/modules/evidence-management/domain/entities/evidence-item.js';

export async function runTests(): Promise<void> {
  const institutions = new InMemoryInstitutionRepository();
  const evidenceItems = new InMemoryEvidenceItemRepository();
  const institutionId = 'inst_application_slice';
  const knownCriterionId = 'criterion_known';
  const knownCriterionElementId = 'criterion_element_known';
  const knownOutcomeId = 'outcome_known';

  const accreditationFrameworks = {
    async getCriterionById(id: string) {
      return id === knownCriterionId ? { id } : null;
    },
    async getCriterionElementById(id: string) {
      return id === knownCriterionElementId ? { id } : null;
    },
  };
  const curriculumMapping = {
    async getLearningOutcomeById(id: string) {
      if (id !== knownOutcomeId) {
        return null;
      }
      return {
        id,
        institutionId,
      };
    },
  };
  const service = new EvidenceManagementService({ institutions, evidenceItems, accreditationFrameworks, curriculumMapping });

  const institution = Institution.create({
    id: institutionId,
    name: 'Application Slice University',
    code: 'ASU',
  });
  await institutions.save(institution);
  const otherInstitution = Institution.create({
    id: 'inst_other_application_slice',
    name: 'Other Application Slice University',
    code: 'OASU',
  });
  await institutions.save(otherInstitution);

  const createEvidenceItem = new CreateEvidenceItemCommand(service);
  const attachEvidenceArtifact = new AttachEvidenceArtifactCommand(service);
  const attachEvidenceReference = new AttachEvidenceReferenceCommand(service);
  const createSupersedingEvidenceVersion = new CreateSupersedingEvidenceVersionCommand(service);
  const markEvidenceComplete = new MarkEvidenceCompleteCommand(service);
  const activateEvidenceItem = new ActivateEvidenceItemCommand(service);
  const updateEvidenceItemStatus = new UpdateEvidenceItemStatusCommand(service);
  const getEvidenceItemById = new GetEvidenceItemByIdQuery(service);
  const getCurrentEvidenceVersion = new GetCurrentEvidenceVersionQuery(service);
  const listEvidenceVersions = new ListEvidenceVersionsQuery(service);
  const listEvidenceByReference = new ListEvidenceByReferenceQuery(service);

  const evidenceItem = await createEvidenceItem.execute({
    institutionId: institution.id,
    title: 'Assessment Narrative 2026',
    description: 'Narrative evidence covering assessment outcomes.',
    reviewCycleId: 'cycle_2026',
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
  await attachEvidenceReference.execute(evidenceItem.id, {
    targetType: evidenceReferenceTargetType.CRITERION,
    targetEntityId: knownCriterionId,
    relationshipType: evidenceReferenceRelationshipType.SUPPORTS,
    rationale: 'Supports criterion argumentation.',
  });

  await attachEvidenceReference.execute(evidenceItem.id, {
    targetType: evidenceReferenceTargetType.LEARNING_OUTCOME,
    targetEntityId: knownOutcomeId,
    relationshipType: evidenceReferenceRelationshipType.DEMONSTRATES,
  });

  const restored = await getEvidenceItemById.execute(evidenceItem.id);
  assert.ok(restored);
  assert.equal(restored?.status, evidenceStatus.ACTIVE);
  assert.equal(restored?.artifacts.length, 1);
  assert.equal(restored?.usability.isUsable, true);
  assert.equal(restored?.usability.currentArtifactId, restored?.artifacts[0].id);
  assert.equal(restored?.references.length, 2);
  await assert.rejects(
    () =>
      attachEvidenceArtifact.execute(evidenceItem.id, {
        artifactName: 'assessment-narrative-v2.pdf',
        artifactType: 'revision',
        mimeType: 'application/pdf',
        storageBucket: 'evidence-bucket',
        storageKey: 'assessments/2026/assessment-narrative-v2.pdf',
      }),
    ValidationError,
    'active evidence cannot accept post-activation artifact registration',
  );

  const uploadMetric = await createEvidenceItem.execute({
    institutionId: institution.id,
    title: 'Integration Metric Upload',
    description: 'Metric evidence uploaded from assessment export.',
    reportingPeriodId: 'period_2026',
    evidenceType: evidenceType.METRIC,
    sourceType: evidenceSourceType.UPLOAD,
  });

  await updateEvidenceItemStatus.execute(uploadMetric.id, evidenceLifecycleAction.COMPLETE);
  await assert.rejects(
    () => updateEvidenceItemStatus.execute(uploadMetric.id, evidenceLifecycleAction.ACTIVATE),
    ValidationError,
    'upload-sourced evidence requires an artifact before activation',
  );

  await attachEvidenceArtifact.execute(uploadMetric.id, {
    artifactName: 'metrics.csv',
    artifactType: 'primary',
    mimeType: 'text/csv',
    storageBucket: 'evidence-bucket',
    storageKey: 'assessments/2026/metrics.csv',
  });
  await updateEvidenceItemStatus.execute(uploadMetric.id, evidenceLifecycleAction.ACTIVATE);
  await attachEvidenceReference.execute(uploadMetric.id, {
    targetType: evidenceReferenceTargetType.CRITERION_ELEMENT,
    targetEntityId: knownCriterionElementId,
    relationshipType: evidenceReferenceRelationshipType.RESPONDS_TO,
  });

  await assert.rejects(
    () =>
      updateEvidenceItemStatus.execute(uploadMetric.id, evidenceLifecycleAction.SUPERSEDE, {
        successorEvidenceItemId: 'missing-successor',
      }),
    NotFoundError,
    'supersede action should require successor evidence item to exist',
  );

  const successor = await createEvidenceItem.execute({
    institutionId: institution.id,
    title: 'Integration Metric Upload - Successor',
    description: 'Superseding metric evidence item.',
    reportingPeriodId: 'period_2026',
    evidenceType: evidenceType.METRIC,
    sourceType: evidenceSourceType.UPLOAD,
  });

  const terminalSuccessor = await createEvidenceItem.execute({
    institutionId: institution.id,
    title: 'Terminal Successor',
    description: 'Archived evidence cannot be a supersession target.',
    reviewCycleId: 'cycle_2026',
    evidenceType: evidenceType.NARRATIVE,
    sourceType: evidenceSourceType.MANUAL,
  });
  await updateEvidenceItemStatus.execute(terminalSuccessor.id, evidenceLifecycleAction.ARCHIVE);

  await assert.rejects(
    () =>
      updateEvidenceItemStatus.execute(uploadMetric.id, evidenceLifecycleAction.SUPERSEDE, {
        successorEvidenceItemId: terminalSuccessor.id,
      }),
    ValidationError,
    'terminal successors are invalid supersession targets',
  );

  await attachEvidenceArtifact.execute(successor.id, {
    artifactName: 'metrics-v2.csv',
    artifactType: 'primary',
    mimeType: 'text/csv',
    storageBucket: 'evidence-bucket',
    storageKey: 'assessments/2026/metrics-v2.csv',
  });
  await updateEvidenceItemStatus.execute(successor.id, evidenceLifecycleAction.COMPLETE);
  await updateEvidenceItemStatus.execute(successor.id, evidenceLifecycleAction.ACTIVATE);

  const crossInstitutionSuccessor = await createEvidenceItem.execute({
    institutionId: otherInstitution.id,
    title: 'Cross Institution Successor',
    description: 'Should be rejected for supersession due to institution mismatch.',
    reviewCycleId: 'cycle_2026',
    evidenceType: evidenceType.NARRATIVE,
    sourceType: evidenceSourceType.MANUAL,
  });
  await assert.rejects(
    () =>
      updateEvidenceItemStatus.execute(uploadMetric.id, evidenceLifecycleAction.SUPERSEDE, {
        successorEvidenceItemId: crossInstitutionSuccessor.id,
      }),
    ValidationError,
    'supersession successor must belong to the same institution',
  );

  const superseded = await updateEvidenceItemStatus.execute(uploadMetric.id, evidenceLifecycleAction.SUPERSEDE, {
    successorEvidenceItemId: successor.id,
  });
  assert.equal(superseded.status, evidenceStatus.SUPERSEDED);

  const supersedingDraft = await createSupersedingEvidenceVersion.execute(successor.id, {
    title: 'Integration Metric Upload - Successor v3 Draft',
  });
  assert.equal(supersedingDraft.status, evidenceStatus.DRAFT);
  assert.equal(supersedingDraft.evidenceLineageId, successor.evidenceLineageId);
  assert.equal(supersedingDraft.versionNumber, successor.versionNumber + 1);
  assert.equal(supersedingDraft.supersedesEvidenceItemId, successor.id);

  const currentByLineage = await getCurrentEvidenceVersion.execute(successor.evidenceLineageId);
  assert.ok(currentByLineage);
  assert.equal(currentByLineage?.id, supersedingDraft.id);

  const allVersions = await listEvidenceVersions.execute(successor.evidenceLineageId, { includeHistorical: true });
  assert.equal(allVersions.length, 3);
  assert.deepEqual(
    allVersions.map((item) => item.versionNumber),
    [1, 2, 3],
  );

  const criterionEvidence = await listEvidenceByReference.execute(
    evidenceReferenceTargetType.CRITERION,
    knownCriterionId,
    { currentOnly: true },
  );
  assert.equal(criterionEvidence.length, 1);
  assert.equal(criterionEvidence[0].id, evidenceItem.id);

  await assert.rejects(
    () =>
      updateEvidenceItemStatus.execute(uploadMetric.id, evidenceLifecycleAction.ARCHIVE),
    ValidationError,
    'superseded evidence remains terminal and cannot be archived later',
  );

  await assert.rejects(
    () =>
      attachEvidenceReference.execute(evidenceItem.id, {
        targetType: evidenceReferenceTargetType.LEARNING_OUTCOME,
        targetEntityId: 'missing_outcome',
        relationshipType: evidenceReferenceRelationshipType.SUPPORTS,
      }),
    ValidationError,
    'reference targets should be validated against owning context contracts',
  );

  const tamperedType = await evidenceItems.getById(evidenceItem.id);
  assert.ok(tamperedType);
  tamperedType.evidenceType = evidenceType.DOCUMENT;
  await assert.rejects(
    () => evidenceItems.save(tamperedType),
    ValidationError,
    'repository should reject in-place mutation of EvidenceItem identity fields',
  );

  const tamperedArtifact = await evidenceItems.getById(evidenceItem.id);
  assert.ok(tamperedArtifact);
  tamperedArtifact.artifacts[0].storageKey = 'tampered/path.pdf';
  await assert.rejects(
    () => evidenceItems.save(tamperedArtifact),
    ValidationError,
    'repository should reject in-place mutation of existing artifact records',
  );

  const tamperedReference = await evidenceItems.getById(evidenceItem.id);
  assert.ok(tamperedReference);
  tamperedReference.references[0].targetEntityId = 'criterion_tampered';
  await assert.rejects(
    () => evidenceItems.save(tamperedReference),
    ValidationError,
    'repository should reject in-place mutation of existing reference records',
  );

  const invalidSuccessor = EvidenceItem.create({
    institutionId: institution.id,
    title: 'Invalid Successor',
    description: 'Invalid version linkage should be rejected by repository boundary checks.',
    reviewCycleId: 'cycle_2026',
    evidenceType: evidenceType.NARRATIVE,
    sourceType: evidenceSourceType.MANUAL,
    evidenceLineageId: successor.evidenceLineageId,
    versionNumber: 99,
    supersedesEvidenceItemId: successor.id,
  });
  await assert.rejects(
    () => evidenceItems.save(invalidSuccessor),
    ValidationError,
    'repository should enforce predecessor-successor version increments on insert',
  );
}
