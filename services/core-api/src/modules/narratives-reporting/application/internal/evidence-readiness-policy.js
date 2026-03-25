export function buildPresenceOnlyReadinessPolicy(overrides = {}) {
  return {
    requiredReadinessLevel: 'present',
    requireAnyEvidenceForDecision: false,
    requireCurrentReferencedEvidence: false,
    requireCollectionScopedUsableEvidence: false,
    minimumReferencedUsableEvidenceCount: 0,
    minimumCollectionUsableEvidenceCount: 0,
    ...overrides,
  };
}

