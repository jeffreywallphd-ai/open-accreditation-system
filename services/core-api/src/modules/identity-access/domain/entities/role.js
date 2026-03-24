import { assertRequired, assertString, assertOneOf } from '../../../shared/kernel/assertions.js';
import { recordStatus, roleScopeType } from '../../../shared/value-objects/statuses.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import { RolePermissionGrant } from './role-permission-grant.js';
import { ValidationError } from '../../../shared/kernel/errors.js';

export class Role {
  constructor(props) {
    assertRequired(props.id, 'Role.id');
    assertString(props.name, 'Role.name');
    assertOneOf(props.status, 'Role.status', Object.values(recordStatus));
    assertOneOf(props.scopeType, 'Role.scopeType', Object.values(roleScopeType));

    this.id = props.id;
    this.name = props.name;
    this.code = props.code ?? null;
    this.description = props.description ?? null;
    this.scopeType = props.scopeType;
    this.status = props.status;
    this.permissionGrants = (props.permissionGrants ?? []).map((item) =>
      item instanceof RolePermissionGrant ? item : new RolePermissionGrant(item),
    );
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new Role({
      id: input.id ?? createId('role'),
      name: input.name,
      code: input.code,
      description: input.description,
      scopeType: input.scopeType ?? roleScopeType.GLOBAL,
      status: input.status ?? recordStatus.ACTIVE,
      permissionGrants: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  update(patch) {
    const next = new Role({
      ...this,
      ...patch,
      permissionGrants: this.permissionGrants,
      updatedAt: nowIso(),
    });

    Object.assign(this, next);
    return this;
  }

  grantPermission(input) {
    const grant = RolePermissionGrant.create({
      ...input,
      roleId: this.id,
    });

    const alreadyActive = this.permissionGrants.some(
      (item) => item.permissionId === grant.permissionId && item.isEffective() && item.state === 'active',
    );

    if (alreadyActive) {
      throw new ValidationError('Role already has active grant for this permission');
    }

    this.permissionGrants.push(grant);
    this.updatedAt = nowIso();
    return grant;
  }

  revokePermission(permissionId, reason, revokedAt = nowIso()) {
    const activeGrant = this.permissionGrants.find(
      (item) => item.permissionId === permissionId && item.state === 'active',
    );

    if (!activeGrant) {
      throw new ValidationError('No active permission grant found to revoke');
    }

    activeGrant.revoke(reason, revokedAt);
    this.updatedAt = nowIso();
    return activeGrant;
  }
}
