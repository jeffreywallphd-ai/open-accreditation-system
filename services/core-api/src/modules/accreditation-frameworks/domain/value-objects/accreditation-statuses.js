export const frameworkVersionStatus = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  RETIRED: 'retired',
});

export const accreditationCycleStatus = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  SUBMITTED: 'submitted',
  DECISION_ISSUED: 'decision-issued',
  CLOSED: 'closed',
});

export const accreditationScopeStatus = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  EXCLUDED: 'excluded',
  CLOSED: 'closed',
});

export const cycleMilestoneStatus = Object.freeze({
  PLANNED: 'planned',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

export const reportingPeriodStatus = Object.freeze({
  OPEN: 'open',
  CLOSED: 'closed',
});

export const reviewEventStatus = Object.freeze({
  PLANNED: 'planned',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

export const decisionRecordStatus = Object.freeze({
  ISSUED: 'issued',
  SUPERSEDED: 'superseded',
});

export const reviewTeamStatus = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  CLOSED: 'closed',
});

export const reviewTeamMembershipState = Object.freeze({
  ACTIVE: 'active',
  SUPERSEDED: 'superseded',
  REMOVED: 'removed',
});

export const reviewTeamMembershipConflictStatus = Object.freeze({
  NONE: 'none',
  DISCLOSED: 'disclosed',
  CONFIRMED: 'confirmed',
});
