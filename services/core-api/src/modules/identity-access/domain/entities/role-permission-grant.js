import { assertRequired, assertString, assertOneOf, assertDateOrder } from '../../../shared/kernel/assertions.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import { ValidationError } from '../../../shared/kernel/errors.js';

const grantState = Object.freeze({
  ACTIVE: 'active',
  REVOKED: 'revoked',
});

export class RolePermissionGrant {
  constructor(props) {
    assertRequired(props.id, 'RolePermissionGrant.id');
    assertRequired(props.roleId, 'RolePermissionGrant.roleId');
    assertRequired(props.permissionId, 'RolePermissionGrant.permissionId');
    assertOneOf(props.state, 'RolePermissionGrant.state', Object.values(grantState));
    assertDateOrder(props.effectiveStartDate, props.effectiveEndDate);

    this.id = props.id;
    this.roleId = props.roleId;
    this.permissionId = props.permissionId;
    this.state = props.state;
    this.reason = props.reason ?? null;
    this.effectiveStartDate = props.effectiveStartDate ?? null;
    this.effectiveEndDate = props.effectiveEndDate ?? null;
    this.revokedAt = props.revokedAt ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new RolePermissionGrant({
      id: input.id ?? createId('rpg'),
      roleId: input.roleId,
      permissionId: input.permissionId,
      state: grantState.ACTIVE,
      reason: input.reason,
      effectiveStartDate: input.effectiveStartDate,
      effectiveEndDate: input.effectiveEndDate,
      createdAt: now,
      updatedAt: now,
    });
  }

  revoke(reason, revokedAt = nowIso()) {
    if (this.state === grantState.REVOKED) {
      throw new ValidationError('RolePermissionGrant is already revoked');
    }

    this.state = grantState.REVOKED;
    this.reason = reason ?? this.reason;
    this.revokedAt = revokedAt;
    this.effectiveEndDate = this.effectiveEndDate ?? revokedAt.slice(0, 10);
    this.updatedAt = nowIso();
  }

  isEffective(atIso = nowIso()) {
    if (this.state !== grantState.ACTIVE) {
      return false;
    }

    const atMs = new Date(atIso).getTime();
    const startOk = !this.effectiveStartDate || new Date(this.effectiveStartDate).getTime() <= atMs;
    const endOk = !this.effectiveEndDate || new Date(this.effectiveEndDate).getTime() >= atMs;

    return startOk && endOk;
  }
}

export { grantState };
