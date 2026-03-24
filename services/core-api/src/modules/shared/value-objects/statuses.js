export const recordStatus = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  HISTORICAL: 'historical',
});

export const personStatus = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SEPARATED: 'separated',
  RETIRED: 'retired',
  PROSPECT: 'prospect',
  EXTERNAL_REVIEWER: 'external-reviewer',
  HISTORICAL_ONLY: 'historical-only',
});

export const userStatus = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DISABLED: 'disabled',
});

export const roleScopeType = Object.freeze({
  GLOBAL: 'global',
  INSTITUTION: 'institution',
  ORGANIZATION_UNIT: 'organization-unit',
  COMMITTEE: 'committee',
  ACCREDITATION_CYCLE: 'accreditation-cycle',
  REVIEW_TEAM: 'review-team',
});

export const servicePrincipalType = Object.freeze({
  INTEGRATION: 'integration',
  AI: 'ai',
  BACKGROUND: 'background',
  SEARCH: 'search',
  NOTIFICATION: 'notification',
});
