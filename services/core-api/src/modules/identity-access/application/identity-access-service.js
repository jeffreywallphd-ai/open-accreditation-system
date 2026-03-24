import { User } from '../domain/entities/user.js';
import { Role } from '../domain/entities/role.js';
import { Permission } from '../domain/entities/permission.js';
import { ServicePrincipal } from '../domain/entities/service-principal.js';
import { NotFoundError, ValidationError } from '../../shared/kernel/errors.js';
import { roleScopeType } from '../../shared/value-objects/statuses.js';

export class IdentityAccessService {
  constructor(deps) {
    this.users = deps.users;
    this.roles = deps.roles;
    this.permissions = deps.permissions;
    this.servicePrincipals = deps.servicePrincipals;
    this.scopeReferences = deps.scopeReferences;
  }

  async createUser(input) {
    await this.scopeReferences.ensurePersonExists(input.personId);
    await this.scopeReferences.ensureInstitutionExists(input.institutionId);

    const person = await this.scopeReferences.getPerson(input.personId);
    if (person.institutionId !== input.institutionId) {
      throw new ValidationError('User.institutionId must match Person.institutionId');
    }

    const existing = await this.users.getByPersonId(input.personId);
    if (existing) {
      throw new ValidationError(`User already exists for personId: ${input.personId}`);
    }

    const user = User.create(input);
    const saved = await this.users.save(user);
    await this.scopeReferences.trackPersonReference(input.personId);
    return saved;
  }

  async updateUser(id, patch) {
    const user = await this.users.getById(id);
    if (!user) {
      throw new NotFoundError('User', id);
    }

    if (patch.personId && patch.personId !== user.personId) {
      throw new ValidationError('User.personId is immutable once created');
    }

    user.update(patch);
    return this.users.save(user);
  }

  async getUserById(id) {
    return this.users.getById(id);
  }

  async listUsers(filter = {}) {
    return this.users.findByFilter(filter);
  }

  async createRole(input) {
    const role = Role.create(input);
    return this.roles.save(role);
  }

  async updateRole(id, patch) {
    const role = await this.roles.getById(id);
    if (!role) {
      throw new NotFoundError('Role', id);
    }

    role.update(patch);
    return this.roles.save(role);
  }

  async getRoleById(id) {
    return this.roles.getById(id);
  }

  async listRoles(filter = {}) {
    return this.roles.findByFilter(filter);
  }

  async createPermission(input) {
    const existing = await this.permissions.getByKey(input.key);
    if (existing) {
      throw new ValidationError(`Permission key already exists: ${input.key}`);
    }

    const permission = Permission.create(input);
    return this.permissions.save(permission);
  }

  async updatePermission(id, patch) {
    const permission = await this.permissions.getById(id);
    if (!permission) {
      throw new NotFoundError('Permission', id);
    }

    permission.update(patch);
    return this.permissions.save(permission);
  }

  async getPermissionById(id) {
    return this.permissions.getById(id);
  }

  async listPermissions(filter = {}) {
    return this.permissions.findByFilter(filter);
  }

  async grantPermissionToRole(input) {
    const role = await this.roles.getById(input.roleId);
    if (!role) {
      throw new NotFoundError('Role', input.roleId);
    }

    const permission = await this.permissions.getById(input.permissionId);
    if (!permission) {
      throw new NotFoundError('Permission', input.permissionId);
    }

    role.grantPermission(input);
    return this.roles.save(role);
  }

  async revokePermissionFromRole(roleId, permissionId, reason) {
    const role = await this.roles.getById(roleId);
    if (!role) {
      throw new NotFoundError('Role', roleId);
    }

    role.revokePermission(permissionId, reason);
    return this.roles.save(role);
  }

  async assignRoleToUser(input) {
    const user = await this.users.getById(input.userId);
    if (!user) {
      throw new NotFoundError('User', input.userId);
    }

    const role = await this.roles.getById(input.roleId);
    if (!role) {
      throw new NotFoundError('Role', input.roleId);
    }

    await this.#validateScopeReferences(input.scopeType, input, user);

    if (role.scopeType !== input.scopeType) {
      throw new ValidationError(`Role scopeType ${role.scopeType} does not match assignment scopeType ${input.scopeType}`);
    }

    user.assignRole(input);
    return this.users.save(user);
  }

  async revokeRoleAssignment(userId, assignmentId, reason, effectiveEndDate) {
    const user = await this.users.getById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    user.revokeRoleAssignment(assignmentId, reason, effectiveEndDate);
    return this.users.save(user);
  }

  async getEffectivePermissionsForUser(userId, atIso = undefined) {
    const user = await this.users.getById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const effectiveAssignments = user.roleAssignments.filter((item) => item.isEffective(atIso));
    const uniquePermissions = new Map();

    for (const assignment of effectiveAssignments) {
      const role = await this.roles.getById(assignment.roleId);
      if (!role) {
        continue;
      }
      for (const grant of role.permissionGrants) {
        if (grant.isEffective(atIso)) {
          const permission = await this.permissions.getById(grant.permissionId);
          if (permission && permission.status === 'active') {
            uniquePermissions.set(permission.key, permission);
          }
        }
      }
    }

    return [...uniquePermissions.values()];
  }

  async registerServicePrincipal(input) {
    const principal = ServicePrincipal.create(input);
    return this.servicePrincipals.save(principal);
  }

  async updateServicePrincipal(id, patch) {
    const principal = await this.servicePrincipals.getById(id);
    if (!principal) {
      throw new NotFoundError('ServicePrincipal', id);
    }

    principal.update(patch);
    return this.servicePrincipals.save(principal);
  }

  async listServicePrincipals(filter = {}) {
    return this.servicePrincipals.findByFilter(filter);
  }

  async #validateScopeReferences(scopeType, scope, user) {
    switch (scopeType) {
      case roleScopeType.GLOBAL:
        return;
      case roleScopeType.INSTITUTION:
        await this.scopeReferences.ensureInstitutionExists(scope.institutionId);
        if (scope.institutionId !== user.institutionId) {
          throw new ValidationError('Institution scope assignment must match user institution');
        }
        return;
      case roleScopeType.ORGANIZATION_UNIT:
        await this.scopeReferences.ensureOrganizationUnitExists(scope.organizationUnitId);
        return;
      case roleScopeType.COMMITTEE:
        await this.scopeReferences.ensureCommitteeExists(scope.committeeId);
        return;
      case roleScopeType.ACCREDITATION_CYCLE:
      case roleScopeType.REVIEW_TEAM:
        return;
      default:
        throw new ValidationError(`Unsupported scopeType: ${scopeType}`);
    }
  }
}
