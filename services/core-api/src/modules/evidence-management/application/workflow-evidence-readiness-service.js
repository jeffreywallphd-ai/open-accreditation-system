import { WorkflowEvidenceReadinessContract } from './contracts/workflow-evidence-readiness-contract.js';

function normalizeIdList(values = []) {
  const normalized = [...new Set((values ?? []).filter(Boolean).map((value) => `${value}`.trim()).filter(Boolean)];
  normalized.sort((left, right) => left.localeCompare(right));
  return normalized;
}

function normalizeReadinessPolicy(input = {}, evidenceItemIds = []) {
  const defaults = {
    requiredReadinessLevel: 'usable',
    requireAnyEvidenceForDecision: false,
    requireCurrentReferencedEvidence: true,
    requireCollectionScopedUsableEvidence: false,
    minimumReferencedUsableEvidenceCount: Number.isInteger(input.minimumUsableEvidenceCount)
      ? input.minimumUsableEvidenceCount
      : evidenceItemIds.length,
    minimumCollectionUsableEvidenceCount: input.evidenceCollectionId ? 1 : 0,
  };
  const policy = {
    ...defaults,
    ...(input.readinessPolicy ?? {}),
  };
  policy.requiredReadinessLevel =
    policy.requiredReadinessLevel === 'present' || policy.requiredReadinessLevel === 'usable'
      ? policy.requiredReadinessLevel
      : defaults.requiredReadinessLevel;
  policy.requireAnyEvidenceForDecision = Boolean(policy.requireAnyEvidenceForDecision);
  policy.requireCurrentReferencedEvidence = policy.requireCurrentReferencedEvidence !== false;
  policy.requireCollectionScopedUsableEvidence = Boolean(policy.requireCollectionScopedUsableEvidence);
  policy.minimumReferencedUsableEvidenceCount = Math.max(
    0,
    Number.isInteger(policy.minimumReferencedUsableEvidenceCount)
      ? policy.minimumReferencedUsableEvidenceCount
      : defaults.minimumReferencedUsableEvidenceCount,
  );
  policy.minimumCollectionUsableEvidenceCount = Math.max(
    0,
    Number.isInteger(policy.minimumCollectionUsableEvidenceCount)
      ? policy.minimumCollectionUsableEvidenceCount
      : defaults.minimumCollectionUsableEvidenceCount,
  );
  return policy;
}

async function listTargetScopedUsableEvidence(evidenceManagement, input) {
  const commonFilter = {
    institutionId: input.institutionId,
    reviewCycleId: input.reviewCycleId,
    evidenceSetId: input.evidenceCollectionId,
    versionState: 'current',
    status: 'active',
    isUsable: true,
  };

  if (input.targetType === 'criterion') {
    return evidenceManagement.listEvidenceByCriterion(input.targetId, commonFilter);
  }
  if (input.targetType === 'criterion-element') {
    return evidenceManagement.listEvidenceByCriterionElement(input.targetId, commonFilter);
  }
  if (input.targetType === 'learning-outcome') {
    return evidenceManagement.listEvidenceByLearningOutcome(input.targetId, commonFilter);
  }
  if (input.targetType === 'narrative-section' || input.targetType === 'report-section') {
    const narrativeSectionId = input.reportSectionId ?? input.targetId;
    return evidenceManagement.listEvidenceByNarrativeSection(narrativeSectionId, commonFilter);
  }

  return evidenceManagement.listEvidenceItems(commonFilter);
}

export class WorkflowEvidenceReadinessService extends WorkflowEvidenceReadinessContract {
  constructor(deps) {
    super();
    this.evidenceManagement = deps.evidenceManagement;
  }

  async evaluateWorkflowEvidenceReadiness(input) {
    const evidenceItemIds = normalizeIdList(input.evidenceItemIds ?? []);
    const readinessPolicy = normalizeReadinessPolicy(input, evidenceItemIds);
    const missingEvidenceItemIds = [];
    const outOfInstitutionScopeEvidenceItemIds = [];
    const incompleteEvidenceItemIds = [];
    const inactiveEvidenceItemIds = [];
    const unusableEvidenceItemIds = [];
    const nonCurrentEvidenceItemIds = [];
    const supersededEvidenceItemIds = [];
    let usableEvidenceItemCount = 0;

    for (const evidenceItemId of evidenceItemIds) {
      const evidenceItem = await this.evidenceManagement.getEvidenceItemById(evidenceItemId);
      if (!evidenceItem) {
        missingEvidenceItemIds.push(evidenceItemId);
        continue;
      }
      if (evidenceItem.institutionId !== input.institutionId) {
        outOfInstitutionScopeEvidenceItemIds.push(evidenceItemId);
        continue;
      }
      if (evidenceItem.isComplete !== true) {
        incompleteEvidenceItemIds.push(evidenceItemId);
      }
      if (evidenceItem.status !== 'active') {
        inactiveEvidenceItemIds.push(evidenceItemId);
        if (evidenceItem.status === 'superseded') {
          supersededEvidenceItemIds.push(evidenceItemId);
        }
      }
      if (evidenceItem.supersededByEvidenceItemId) {
        nonCurrentEvidenceItemIds.push(evidenceItemId);
      }
      if (evidenceItem.usability?.isUsable !== true) {
        unusableEvidenceItemIds.push(evidenceItemId);
      } else {
        usableEvidenceItemCount += 1;
      }
    }

    const requiredUsableEvidenceCount = readinessPolicy.minimumReferencedUsableEvidenceCount;
    const referencedReadinessSatisfied =
      readinessPolicy.requiredReadinessLevel === 'present'
        ? missingEvidenceItemIds.length === 0 && outOfInstitutionScopeEvidenceItemIds.length === 0
        : missingEvidenceItemIds.length === 0 &&
          outOfInstitutionScopeEvidenceItemIds.length === 0 &&
          incompleteEvidenceItemIds.length === 0 &&
          inactiveEvidenceItemIds.length === 0 &&
          unusableEvidenceItemIds.length === 0 &&
          usableEvidenceItemCount >= requiredUsableEvidenceCount;

    const currentEvidenceSatisfied = readinessPolicy.requireCurrentReferencedEvidence
      ? nonCurrentEvidenceItemIds.length === 0
      : true;
    const referencedEvidenceRequirementSatisfied =
      referencedReadinessSatisfied && currentEvidenceSatisfied;

    let collectionRequirementSatisfied = true;
    let collectionContextStatus = 'not-applicable';
    let collectionUsableEvidenceCount = 0;
    if (input.evidenceCollectionId) {
      if (!input.reviewCycleId) {
        collectionRequirementSatisfied = false;
        collectionContextStatus = 'missing-review-cycle';
      } else {
        const usableCycleEvidence = await listTargetScopedUsableEvidence(this.evidenceManagement, input);
        collectionUsableEvidenceCount = usableCycleEvidence.length;
        collectionRequirementSatisfied =
          !readinessPolicy.requireCollectionScopedUsableEvidence ||
          collectionUsableEvidenceCount >= readinessPolicy.minimumCollectionUsableEvidenceCount;
        collectionContextStatus = collectionRequirementSatisfied ? 'satisfied' : 'empty';
      }
    }

    const hasAnyReferencedEvidence = evidenceItemIds.length > 0 && missingEvidenceItemIds.length < evidenceItemIds.length;
    const hasAnyCollectionEvidence = collectionUsableEvidenceCount > 0;
    const hasAnyEvidence = hasAnyReferencedEvidence || hasAnyCollectionEvidence;
    const anyEvidenceRequirementSatisfied = readinessPolicy.requireAnyEvidenceForDecision ? hasAnyEvidence : true;

    return {
      requiredCount: evidenceItemIds.length,
      foundCount: evidenceItemIds.length - missingEvidenceItemIds.length,
      requiredUsableEvidenceCount,
      usableEvidenceItemCount,
      missingEvidenceItemIds,
      outOfInstitutionScopeEvidenceItemIds,
      incompleteEvidenceItemIds,
      inactiveEvidenceItemIds,
      unusableEvidenceItemIds,
      nonCurrentEvidenceItemIds,
      supersededEvidenceItemIds,
      evidenceCollectionId: input.evidenceCollectionId ?? null,
      collectionContextStatus,
      collectionUsableEvidenceCount,
      hasAnyEvidence,
      anyEvidenceRequirementSatisfied,
      collectionRequirementSatisfied,
      referencedEvidenceRequirementSatisfied,
      readinessPolicy,
      isSufficient:
        referencedEvidenceRequirementSatisfied &&
        collectionRequirementSatisfied &&
        anyEvidenceRequirementSatisfied,
    };
  }
}

