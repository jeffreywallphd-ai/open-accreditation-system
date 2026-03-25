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
  GetEvidenceLineageCycleReadinessQuery,
  GetCurrentEvidenceVersionQuery,
  GetEvidenceItemByIdQuery,
  ListCurrentEvidenceQuery,
  ListEvidenceByReferenceQuery,
  ListEvidenceByCriterionQuery,
  ListEvidenceByCriterionElementQuery,
  ListEvidenceByLearningOutcomeQuery,
  ListEvidenceByNarrativeSectionQuery,
  ListEvidenceWithLinkageContextQuery,
  ListHistoricalEvidenceQuery,
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
  const knownNarrativeSectionId = 'narrative_section_known';

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
  const narrativesReporting = {
    async getNarrativeSectionById(id: string) {
      if (id !== knownNarrativeSectionId) {
        return null;
      }
      return {
        id,
        institutionId,
      };
    },
  };
  const service = new EvidenceManagementService({
    institutions,
    evidenceItems,
    accreditationFrameworks,
    curriculumMapping,
    narrativesReporting,
  });

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
  const listEvidenceByCriterion = new ListEvidenceByCriterionQuery(service);
  const listEvidenceByCriterionElement = new ListEvidenceByCriterionElementQuery(service);
  const listEvidenceByLearningOutcome = new ListEvidenceByLearningOutcomeQuery(service);
  const listEvidenceByNarrativeSection = new ListEvidenceByNarrativeSectionQuery(service);
  const listCurrentEvidence = new ListCurrentEvidenceQuery(service);
  const listHistoricalEvidence = new ListHistoricalEvidenceQuery(service);
  const listEvidenceWithLinkageContext = new ListEvidenceWithLinkageContextQuery(service);
  const getEvidenceLineageCycleReadiness = new GetEvidenceLineageCycleReadinessQuery(service);

  const evidenceItem = await createEvidenceItem.execute({
    institutionId: institution.id,
    title: 'Assessment Narrative 2026',
    description: 'Narrative evidence covering assessment outcomes.',
    reviewCycleId: 'cycle_2026',
    evidenceSetIds: ['set_main'],
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
  await attachEvidenceReference.execute(evidenceItem.id, {
    targetType: evidenceReferenceTargetType.NARRATIVE_SECTION,
    targetEntityId: knownNarrativeSectionId,
    relationshipType: evidenceReferenceRelationshipType.INCLUDED_IN,
    anchorPath: 'section://2.1',
    rationale: 'Supports this narrative section with direct outcomes evidence.',
  });

  const restored = await getEvidenceItemById.execute(evidenceItem.id);
  assert.ok(restored);
  assert.equal(restored?.status, evidenceStatus.ACTIVE);
  assert.equal(restored?.artifacts.length, 1);
  assert.equal(restored?.usability.isUsable, true);
  assert.equal(restored?.usability.currentArtifactId, restored?.artifacts[0].id);
  assert.equal(restored?.references.length, 3);
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
    evidenceSetIds: ['set_main'],
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

  const lineageMismatchedSuccessor = await createEvidenceItem.execute({
    institutionId: institution.id,
    title: 'Integration Metric Upload - Unrelated Successor',
    description: 'Different lineage item should be rejected as supersession target.',
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

  await assert.rejects(
    () =>
      updateEvidenceItemStatus.execute(uploadMetric.id, evidenceLifecycleAction.SUPERSEDE, {
        successorEvidenceItemId: lineageMismatchedSuccessor.id,
      }),
    ValidationError,
    'supersession successor must share lineage and explicit predecessor linkage',
  );

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

  const successor = await createSupersedingEvidenceVersion.execute(uploadMetric.id, {
    title: 'Integration Metric Upload - Successor v2',
    description: 'Superseding metric evidence item.',
    reviewCycleId: 'cycle_2027',
    evidenceSetIds: ['set_main'],
  });
  await attachEvidenceArtifact.execute(successor.id, {
    artifactName: 'metrics-v2.csv',
    artifactType: 'primary',
    mimeType: 'text/csv',
    storageBucket: 'evidence-bucket',
    storageKey: 'assessments/2027/metrics-v2.csv',
  });
  await updateEvidenceItemStatus.execute(successor.id, evidenceLifecycleAction.COMPLETE);
  await updateEvidenceItemStatus.execute(successor.id, evidenceLifecycleAction.ACTIVATE);

  await assert.rejects(
    () =>
      updateEvidenceItemStatus.execute(uploadMetric.id, evidenceLifecycleAction.SUPERSEDE, {
        successorEvidenceItemId: successor.id,
      }),
    ValidationError,
    'superseding again should fail because predecessor already superseded',
  );

  const supersededUploadMetric = await getEvidenceItemById.execute(uploadMetric.id);
  assert.ok(supersededUploadMetric);
  assert.equal(supersededUploadMetric?.status, evidenceStatus.SUPERSEDED);
  assert.equal(supersededUploadMetric?.supersededByEvidenceItemId, successor.id);

  const supersedingDraft = await createSupersedingEvidenceVersion.execute(successor.id, {
    title: 'Integration Metric Upload - Successor v3 Draft',
    reviewCycleId: 'cycle_2027',
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

  const criterionEvidenceExplicit = await listEvidenceByCriterion.execute(knownCriterionId, { currentOnly: true });
  assert.equal(criterionEvidenceExplicit.length, 1);
  assert.equal(criterionEvidenceExplicit[0].id, evidenceItem.id);

  const criterionElementEvidence = await listEvidenceByCriterionElement.execute(knownCriterionElementId, {
    currentOnly: false,
  });
  assert.equal(criterionElementEvidence.length, 1);
  assert.equal(criterionElementEvidence[0].id, uploadMetric.id);

  const outcomeEvidence = await listEvidenceByLearningOutcome.execute(knownOutcomeId, {
    currentOnly: true,
    institutionId,
  });
  assert.equal(outcomeEvidence.length, 1);
  assert.equal(outcomeEvidence[0].id, evidenceItem.id);

  const narrativeSectionEvidence = await listEvidenceByNarrativeSection.execute(knownNarrativeSectionId, {
    institutionId,
    hasRationale: true,
  });
  assert.equal(narrativeSectionEvidence.length, 1);
  assert.equal(narrativeSectionEvidence[0].id, evidenceItem.id);

  const linkageContext = await listEvidenceWithLinkageContext.execute({
    targetType: evidenceReferenceTargetType.NARRATIVE_SECTION,
    targetEntityId: knownNarrativeSectionId,
    hasRationale: true,
    institutionId,
  });
  assert.equal(linkageContext.length, 1);
  assert.equal(linkageContext[0].evidenceItem.id, evidenceItem.id);
  assert.equal(linkageContext[0].linkageContext.matchingReferenceCount, 1);
  assert.equal(linkageContext[0].linkageContext.matchingReferences[0].anchorPath, 'section://2.1');
  assert.equal(
    linkageContext[0].linkageContext.matchingReferences[0].rationale,
    'Supports this narrative section with direct outcomes evidence.',
  );

  const currentEvidence = await listCurrentEvidence.execute({ institutionId });
  assert.equal(currentEvidence.length, 4);

  const historicalEvidence = await listHistoricalEvidence.execute({ institutionId });
  assert.equal(historicalEvidence.length, 2);
  assert.ok(historicalEvidence.some((item) => item.id === uploadMetric.id));
  assert.ok(historicalEvidence.some((item) => item.id === successor.id));

  const usableEvidence = await service.listEvidenceItems({ institutionId, isUsable: true, versionState: 'current' });
  assert.ok(usableEvidence.length >= 2);
  assert.ok(usableEvidence.every((item) => item.usability.isUsable === true));
  assert.ok(usableEvidence.every((item) => item.evidenceSetIds.includes('set_main')));

  const filteredBySet = await service.listEvidenceItems({
    institutionId,
    evidenceSetId: 'set_main',
    versionState: 'all',
  });
  assert.ok(filteredBySet.length >= 3);
  assert.ok(filteredBySet.every((item) => item.evidenceSetIds.includes('set_main')));

  await assert.rejects(
    () =>
      updateEvidenceItemStatus.execute(uploadMetric.id, evidenceLifecycleAction.ARCHIVE),
    ValidationError,
    'superseded evidence remains terminal and cannot be archived later',
  );

  await assert.rejects(
    () =>
      attachEvidenceReference.execute(evidenceItem.id, {
        targetType: 'criterion-v2' as unknown as typeof evidenceReferenceTargetType.CRITERION,
        targetEntityId: knownCriterionId,
        relationshipType: evidenceReferenceRelationshipType.SUPPORTS,
      }),
    ValidationError,
    'disallowed targetType values should fail centrally',
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

  const tamperedInvalidState = await evidenceItems.getById(lineageMismatchedSuccessor.id);
  assert.ok(tamperedInvalidState);
  tamperedInvalidState.status = evidenceStatus.ACTIVE;
  tamperedInvalidState.isComplete = true;
  await assert.rejects(
    () => evidenceItems.save(tamperedInvalidState),
    ValidationError,
    'repository should revalidate aggregate invariants and reject invalid lifecycle state',
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

  const inactivePredecessor = await createEvidenceItem.execute({
    institutionId: institution.id,
    title: 'Inactive Predecessor',
    description: 'Draft evidence that should not allow successor insert.',
    reviewCycleId: 'cycle_2028',
    evidenceType: evidenceType.NARRATIVE,
    sourceType: evidenceSourceType.MANUAL,
  });
  const successorOfInactivePredecessor = EvidenceItem.create({
    institutionId: institution.id,
    title: 'Successor Of Inactive Predecessor',
    description: 'Should be rejected because predecessor is not active.',
    reviewCycleId: 'cycle_2028',
    evidenceType: evidenceType.NARRATIVE,
    sourceType: evidenceSourceType.MANUAL,
    evidenceLineageId: inactivePredecessor.evidenceLineageId,
    versionNumber: 2,
    supersedesEvidenceItemId: inactivePredecessor.id,
  });
  await assert.rejects(
    () => evidenceItems.save(successorOfInactivePredecessor),
    ValidationError,
    'repository should reject successor insertion when predecessor is not active',
  );

  const cycleReadySummary = await getEvidenceLineageCycleReadiness.execute(successor.evidenceLineageId);
  assert.equal(cycleReadySummary.evidenceLineageId, successor.evidenceLineageId);
  assert.equal(cycleReadySummary.versionCount, 3);
  assert.equal(cycleReadySummary.createdInReportingPeriodId, 'period_2026');
  assert.equal(cycleReadySummary.createdInReviewCycleId, null);
  assert.equal(cycleReadySummary.hasCrossCycleReuse, true);
  assert.equal(cycleReadySummary.hasCrossCycleSupersession, true);
  assert.equal(cycleReadySummary.hasWithinCycleSupersession, true);
  assert.equal(cycleReadySummary.crossCycleSupersessionCount, 1);
  assert.equal(cycleReadySummary.withinCycleSupersessionCount, 1);
  assert.equal(cycleReadySummary.reviewCycleIds.length, 1);
  assert.equal(cycleReadySummary.reviewCycleIds[0], 'cycle_2027');
  assert.equal(cycleReadySummary.versions[0].supersessionScope, 'none');
  assert.equal(cycleReadySummary.versions[1].supersessionScope, 'cross-cycle');
  assert.equal(cycleReadySummary.versions[2].supersessionScope, 'within-cycle');

  await assert.rejects(
    () =>
      attachEvidenceReference.execute(evidenceItem.id, {
        targetType: evidenceReferenceTargetType.NARRATIVE_SECTION,
        targetEntityId: knownNarrativeSectionId,
        relationshipType: evidenceReferenceRelationshipType.SUPPORTS,
      }),
    ValidationError,
    'narrative-section references should require anchorPath',
  );
}
