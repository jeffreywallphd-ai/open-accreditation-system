import assert from 'node:assert/strict';
import { WorkflowEvidenceReadinessService } from '../../src/modules/evidence-management/application/workflow-evidence-readiness-service.js';

export async function runTests(): Promise<void> {
  const evidenceById = new Map<string, any>([
    [
      'ev_complete_usable',
      {
        id: 'ev_complete_usable',
        institutionId: 'inst_1',
        isComplete: true,
        status: 'active',
        usability: { isUsable: true },
      },
    ],
    [
      'ev_incomplete',
      {
        id: 'ev_incomplete',
        institutionId: 'inst_1',
        isComplete: false,
        status: 'incomplete',
        usability: { isUsable: false },
      },
    ],
    [
      'ev_present_unusable',
      {
        id: 'ev_present_unusable',
        institutionId: 'inst_1',
        isComplete: true,
        status: 'active',
        usability: { isUsable: false },
      },
    ],
    [
      'ev_superseded',
      {
        id: 'ev_superseded',
        institutionId: 'inst_1',
        isComplete: true,
        status: 'superseded',
        supersededByEvidenceItemId: 'ev_current_successor',
        usability: { isUsable: false },
      },
    ],
    [
      'ev_current_successor',
      {
        id: 'ev_current_successor',
        institutionId: 'inst_1',
        isComplete: true,
        status: 'active',
        supersededByEvidenceItemId: null,
        usability: { isUsable: true },
      },
    ],
  ]);

  const targetScopedEvidence = new Map<string, any[]>([
    ['narrative-section:section_1', [evidenceById.get('ev_complete_usable')]],
    ['narrative-section:section_empty', []],
  ]);

  const service = new WorkflowEvidenceReadinessService({
    evidenceManagement: {
      async getEvidenceItemById(id: string) {
        return evidenceById.get(id) ?? null;
      },
      async listEvidenceItems(filter: any) {
        if (filter.reviewCycleId === 'cycle_with_usable') {
          return [evidenceById.get('ev_complete_usable')];
        }
        return [];
      },
      async listEvidenceByNarrativeSection(sectionId: string) {
        return targetScopedEvidence.get(`narrative-section:${sectionId}`) ?? [];
      },
      async listEvidenceByCriterion() {
        return [];
      },
      async listEvidenceByCriterionElement() {
        return [];
      },
      async listEvidenceByLearningOutcome() {
        return [];
      },
    },
  });

  const missingSummary = await service.evaluateWorkflowEvidenceReadiness({
    institutionId: 'inst_1',
    reviewCycleId: 'cycle_1',
    evidenceItemIds: ['ev_missing'],
  });
  assert.equal(missingSummary.missingEvidenceItemIds.length, 1);
  assert.equal(missingSummary.isSufficient, false);

  const incompleteSummary = await service.evaluateWorkflowEvidenceReadiness({
    institutionId: 'inst_1',
    reviewCycleId: 'cycle_1',
    evidenceItemIds: ['ev_incomplete'],
  });
  assert.equal(incompleteSummary.incompleteEvidenceItemIds.length, 1);
  assert.equal(incompleteSummary.inactiveEvidenceItemIds.length, 1);
  assert.equal(incompleteSummary.unusableEvidenceItemIds.length, 1);
  assert.equal(incompleteSummary.isSufficient, false);

  const unusableSummary = await service.evaluateWorkflowEvidenceReadiness({
    institutionId: 'inst_1',
    reviewCycleId: 'cycle_1',
    evidenceItemIds: ['ev_present_unusable'],
  });
  assert.equal(unusableSummary.unusableEvidenceItemIds.length, 1);
  assert.equal(unusableSummary.incompleteEvidenceItemIds.length, 0);
  assert.equal(unusableSummary.inactiveEvidenceItemIds.length, 0);
  assert.equal(unusableSummary.isSufficient, false);

  const supersededSummary = await service.evaluateWorkflowEvidenceReadiness({
    institutionId: 'inst_1',
    reviewCycleId: 'cycle_1',
    evidenceItemIds: ['ev_superseded'],
    readinessPolicy: {
      requiredReadinessLevel: 'usable',
      requireCurrentReferencedEvidence: true,
      minimumReferencedUsableEvidenceCount: 1,
    },
  });
  assert.equal(supersededSummary.supersededEvidenceItemIds.length, 1);
  assert.equal(supersededSummary.nonCurrentEvidenceItemIds.length, 1);
  assert.equal(supersededSummary.referencedEvidenceRequirementSatisfied, false);
  assert.equal(supersededSummary.isSufficient, false);

  const sufficientSummary = await service.evaluateWorkflowEvidenceReadiness({
    institutionId: 'inst_1',
    reviewCycleId: 'cycle_with_usable',
    evidenceCollectionId: 'collection_1',
    targetType: 'report-section',
    targetId: 'section_1',
    reportSectionId: 'section_1',
    evidenceItemIds: ['ev_complete_usable'],
    readinessPolicy: {
      requiredReadinessLevel: 'usable',
      requireCurrentReferencedEvidence: true,
      minimumReferencedUsableEvidenceCount: 1,
      requireCollectionScopedUsableEvidence: true,
      minimumCollectionUsableEvidenceCount: 1,
    },
  });
  assert.equal(sufficientSummary.collectionRequirementSatisfied, true);
  assert.equal(sufficientSummary.collectionUsableEvidenceCount, 1);
  assert.equal(sufficientSummary.isSufficient, true);

  const emptyTargetCollectionSummary = await service.evaluateWorkflowEvidenceReadiness({
    institutionId: 'inst_1',
    reviewCycleId: 'cycle_with_usable',
    evidenceCollectionId: 'collection_1',
    targetType: 'report-section',
    targetId: 'section_empty',
    reportSectionId: 'section_empty',
    evidenceItemIds: ['ev_current_successor'],
    readinessPolicy: {
      requiredReadinessLevel: 'usable',
      requireCurrentReferencedEvidence: true,
      minimumReferencedUsableEvidenceCount: 1,
      requireCollectionScopedUsableEvidence: true,
      minimumCollectionUsableEvidenceCount: 1,
    },
  });
  assert.equal(emptyTargetCollectionSummary.collectionRequirementSatisfied, false);
  assert.equal(emptyTargetCollectionSummary.collectionContextStatus, 'empty');
  assert.equal(emptyTargetCollectionSummary.isSufficient, false);
}

