function matchesExact(value, expected) {
  if (expected === undefined || expected === null) {
    return true;
  }
  return value === expected;
}

function matchesStatus(item, filter = {}) {
  if (filter.status !== undefined && filter.status !== null) {
    return item.status === filter.status;
  }
  if (Array.isArray(filter.statuses) && filter.statuses.length > 0) {
    return filter.statuses.includes(item.status);
  }
  return true;
}

function matchesVersionState(item, filter = {}) {
  const versionState = filter.versionState ?? (filter.currentOnly === true ? 'current' : 'all');
  if (versionState === 'all' || versionState === undefined || versionState === null) {
    return true;
  }
  if (versionState === 'current') {
    return item.supersededByEvidenceItemId === null;
  }
  if (versionState === 'historical') {
    return item.supersededByEvidenceItemId !== null;
  }
  return false;
}

function referenceMatches(reference, filter = {}) {
  if (!matchesExact(reference.targetType, filter.targetType)) {
    return false;
  }
  if (!matchesExact(reference.targetEntityId, filter.targetEntityId)) {
    return false;
  }
  if (!matchesExact(reference.relationshipType, filter.relationshipType)) {
    return false;
  }

  if (filter.hasRationale !== undefined) {
    const hasRationale = Boolean(reference.rationale && reference.rationale.trim() !== '');
    if (filter.hasRationale !== hasRationale) {
      return false;
    }
  }

  return true;
}

export function selectMatchingReferences(item, filter = {}) {
  const references = item.references ?? [];
  const hasReferenceFilter =
    filter.targetType !== undefined ||
    filter.targetEntityId !== undefined ||
    filter.relationshipType !== undefined ||
    filter.hasRationale !== undefined;

  if (!hasReferenceFilter) {
    return references;
  }

  return references.filter((reference) => referenceMatches(reference, filter));
}

function matchesUsability(item, filter = {}) {
  if (filter.isUsable !== undefined && item.usability.isUsable !== filter.isUsable) {
    return false;
  }
  if (
    filter.requiresArtifactForActivation !== undefined &&
    item.usability.requiresArtifactForActivation !== filter.requiresArtifactForActivation
  ) {
    return false;
  }
  if (filter.hasAvailableArtifact !== undefined && item.usability.hasAvailableArtifact !== filter.hasAvailableArtifact) {
    return false;
  }
  return true;
}

export function evidenceItemMatchesFilter(item, filter = {}) {
  if (!matchesExact(item.id, filter.id)) {
    return false;
  }
  if (!matchesExact(item.institutionId, filter.institutionId)) {
    return false;
  }
  if (!matchesExact(item.evidenceType, filter.evidenceType)) {
    return false;
  }
  if (!matchesExact(item.sourceType, filter.sourceType)) {
    return false;
  }
  if (!matchesStatus(item, filter)) {
    return false;
  }
  if (!matchesExact(item.evidenceLineageId, filter.evidenceLineageId)) {
    return false;
  }
  if (!matchesExact(item.versionNumber, filter.versionNumber)) {
    return false;
  }
  if (!matchesExact(item.supersedesEvidenceItemId, filter.supersedesEvidenceItemId)) {
    return false;
  }
  if (!matchesExact(item.supersededByEvidenceItemId, filter.supersededByEvidenceItemId)) {
    return false;
  }
  if (!matchesExact(item.reviewCycleId, filter.reviewCycleId)) {
    return false;
  }
  if (!matchesExact(item.reportingPeriodId, filter.reportingPeriodId)) {
    return false;
  }
  if (filter.evidenceSetId !== undefined && filter.evidenceSetId !== null) {
    if (!(item.evidenceSetIds ?? []).includes(filter.evidenceSetId)) {
      return false;
    }
  }
  if (!matchesVersionState(item, filter)) {
    return false;
  }
  if (!matchesUsability(item, filter)) {
    return false;
  }

  const matchingReferences = selectMatchingReferences(item, filter);
  const hasReferenceFilter =
    filter.targetType !== undefined ||
    filter.targetEntityId !== undefined ||
    filter.relationshipType !== undefined ||
    filter.hasRationale !== undefined;

  if (hasReferenceFilter && matchingReferences.length === 0) {
    return false;
  }

  return true;
}
