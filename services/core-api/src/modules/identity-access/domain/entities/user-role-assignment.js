import { assertRequired, assertOneOf, assertDateOrder } from '../../../shared/kernel/assertions.js';
import { roleScopeType } from '../../../shared/value-objects/statuses.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import { ValidationError } from '../../../shared/kernel/errors.js';

const assignmentState = Object.freeze({
  ACTIVE: 'active',
  SUPERSEDED: 'superseded',
  REVOKED: 'revoked',
});

function countScopeRefs(scope) {
  return ['institutionId', 'organizationUnitId', 'committeeId', 'accreditationCycleId', 'reviewTeamId']
    .filter((field) => scope[field])
    .length;
}

function assertScopeCompatibility(scopeType, scope) {
  const scopeRefCount = countScopeRefs(scope);

  if (scopeType === roleScopeType.GLOBAL && scopeRefCount > 0) {
    throw new ValidationError('Global scope assignment cannot include scope reference IDs');
  }

  if (scopeType !== roleScopeType.GLOBAL && scopeRefCount === 0) {
    throw new ValidationError(`Scope ${scopeType} requires one scope reference`);
  }

  const allowedByType = {
    [roleScopeType.INSTITUTION]: 'institutionId',
    [roleScopeType.ORGANIZATION_UNIT]: 'organizationUnitId',
    [roleScopeType.COMMITTEE]: 'committeeId',
    [roleScopeType.ACCREDITATION_CYCLE]: 'accreditationCycleId',
    [roleScopeType.REVIEW_TEAM]: 'reviewTeamId',
  };

  const expectedField = allowedByType[scopeType];
  if (expectedField) {
    for (const field of ['institutionId', 'organizationUnitId', 'committeeId', 'accreditationCycleId', 'reviewTeamId']) {
      if (field === expectedField) {
        continue;
      }
      if (scope[field]) {
        throw new ValidationError(`Scope ${scopeType} may only use ${expectedField}`);
      }
    }
    if (!scope[expectedField]) {
      throw new ValidationError(`Scope ${scopeType} requires ${expectedField}`);
    }
  }
}

export class UserRoleAssignment {
  constructor(props) {
    assertRequired(props.id, 'UserRoleAssignment.id');
    assertRequired(props.userId, 'UserRoleAssignment.userId');
    assertRequired(props.roleId, 'UserRoleAssignment.roleId');
    assertOneOf(props.scopeType, 'UserRoleAssignment.scopeType', Object.values(roleScopeType));
    assertOneOf(props.state, 'UserRoleAssignment.state', Object.values(assignmentState));
    assertDateOrder(props.effectiveStartDate, props.effectiveEndDate);

    assertScopeCompatibility(props.scopeType, props);

    this.id = props.id;
    this.userId = props.userId;
    this.roleId = props.roleId;
    this.scopeType = props.scopeType;
    this.institutionId = props.institutionId ?? null;
    this.organizationUnitId = props.organizationUnitId ?? null;
    this.committeeId = props.committeeId ?? null;
    this.accreditationCycleId = props.accreditationCycleId ?? null;
    this.reviewTeamId = props.reviewTeamId ?? null;
    this.state = props.state;
    this.reason = props.reason ?? null;
    this.supersededByAssignmentId = props.supersededByAssignmentId ?? null;
    this.effectiveStartDate = props.effectiveStartDate ?? null;
    this.effectiveEndDate = props.effectiveEndDate ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new UserRoleAssignment({
      id: input.id ?? createId('ura'),
      userId: input.userId,
      roleId: input.roleId,
      scopeType: input.scopeType,
      institutionId: input.institutionId,
      organizationUnitId: input.organizationUnitId,
      committeeId: input.committeeId,
      accreditationCycleId: input.accreditationCycleId,
      reviewTeamId: input.reviewTeamId,
      state: assignmentState.ACTIVE,
      reason: input.reason,
      effectiveStartDate: input.effectiveStartDate,
      effectiveEndDate: input.effectiveEndDate,
      createdAt: now,
      updatedAt: now,
    });
  }

  supersede(newAssignmentId, effectiveEndDate, reason) {
    if (this.state !== assignmentState.ACTIVE) {
      throw new ValidationError('Only active assignments can be superseded');
    }

    this.state = assignmentState.SUPERSEDED;
    this.supersededByAssignmentId = newAssignmentId;
    this.reason = reason ?? this.reason;
    this.effectiveEndDate = effectiveEndDate;
    this.updatedAt = nowIso();
  }

  revoke(reason, effectiveEndDate) {
    if (this.state !== assignmentState.ACTIVE) {
      throw new ValidationError('Only active assignments can be revoked');
    }

    this.state = assignmentState.REVOKED;
    this.reason = reason ?? this.reason;
    this.effectiveEndDate = effectiveEndDate;
    this.updatedAt = nowIso();
  }

  isEffective(atIso = nowIso()) {
    if (this.state !== assignmentState.ACTIVE) {
      return false;
    }

    const atMs = new Date(atIso).getTime();
    const startOk = !this.effectiveStartDate || new Date(this.effectiveStartDate).getTime() <= atMs;
    const endOk = !this.effectiveEndDate || new Date(this.effectiveEndDate).getTime() >= atMs;

    return startOk && endOk;
  }

  isSameBinding(other) {
    return (
      this.userId === other.userId &&
      this.roleId === other.roleId &&
      this.scopeType === other.scopeType &&
      this.institutionId === other.institutionId &&
      this.organizationUnitId === other.organizationUnitId &&
      this.committeeId === other.committeeId &&
      this.accreditationCycleId === other.accreditationCycleId &&
      this.reviewTeamId === other.reviewTeamId
    );
  }
}

export { assignmentState };
