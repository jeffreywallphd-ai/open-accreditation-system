import {
  UserRepository,
  RoleRepository,
  PermissionRepository,
  ServicePrincipalRepository,
} from '../../domain/repositories/repositories.js';
import { User } from '../../domain/entities/user.js';
import { Role } from '../../domain/entities/role.js';
import { Permission } from '../../domain/entities/permission.js';
import { ServicePrincipal } from '../../domain/entities/service-principal.js';

function parseJson(text, fallback = {}) {
  if (!text) {
    return fallback;
  }

  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function filterClause(filter = {}, keyMap = {}) {
  const where = [];
  const params = {};

  for (const [filterKey, column] of Object.entries(keyMap)) {
    const value = filter[filterKey];
    if (value === undefined || value === null) {
      continue;
    }

    where.push(`${column} = @${filterKey}`);
    params[filterKey] = value;
  }

  return {
    sql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

export class SqliteUserRepository extends UserRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(user) {
    this.database.transaction(() => {
      this.database.run(
        `
          INSERT INTO identity_access_users (
            id, person_id, institution_id, external_subject_id, email,
            status, last_login_at, access_attributes_json, created_at, updated_at
          )
          VALUES (
            @id, @personId, @institutionId, @externalSubjectId, @email,
            @status, @lastLoginAt, @accessAttributesJson, @createdAt, @updatedAt
          )
          ON CONFLICT(id) DO UPDATE SET
            person_id = excluded.person_id,
            institution_id = excluded.institution_id,
            external_subject_id = excluded.external_subject_id,
            email = excluded.email,
            status = excluded.status,
            last_login_at = excluded.last_login_at,
            access_attributes_json = excluded.access_attributes_json,
            updated_at = excluded.updated_at
        `,
        {
          id: user.id,
          personId: user.personId,
          institutionId: user.institutionId,
          externalSubjectId: user.externalSubjectId,
          email: user.email,
          status: user.status,
          lastLoginAt: user.lastLoginAt,
          accessAttributesJson: JSON.stringify(user.accessAttributes ?? {}),
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      );

      for (const assignment of user.roleAssignments) {
        this.database.run(
          `
            INSERT INTO identity_access_user_role_assignments (
              id, user_id, role_id, scope_type, institution_id, organization_unit_id,
              committee_id, accreditation_cycle_id, review_team_id, state,
              reason, superseded_by_assignment_id, effective_start_date, effective_end_date,
              created_at, updated_at
            )
            VALUES (
              @id, @userId, @roleId, @scopeType, @institutionId, @organizationUnitId,
              @committeeId, @accreditationCycleId, @reviewTeamId, @state,
              @reason, @supersededByAssignmentId, @effectiveStartDate, @effectiveEndDate,
              @createdAt, @updatedAt
            )
            ON CONFLICT(id) DO UPDATE SET
              user_id = excluded.user_id,
              role_id = excluded.role_id,
              scope_type = excluded.scope_type,
              institution_id = excluded.institution_id,
              organization_unit_id = excluded.organization_unit_id,
              committee_id = excluded.committee_id,
              accreditation_cycle_id = excluded.accreditation_cycle_id,
              review_team_id = excluded.review_team_id,
              state = excluded.state,
              reason = excluded.reason,
              superseded_by_assignment_id = excluded.superseded_by_assignment_id,
              effective_start_date = excluded.effective_start_date,
              effective_end_date = excluded.effective_end_date,
              updated_at = excluded.updated_at
          `,
          {
            id: assignment.id,
            userId: assignment.userId,
            roleId: assignment.roleId,
            scopeType: assignment.scopeType,
            institutionId: assignment.institutionId,
            organizationUnitId: assignment.organizationUnitId,
            committeeId: assignment.committeeId,
            accreditationCycleId: assignment.accreditationCycleId,
            reviewTeamId: assignment.reviewTeamId,
            state: assignment.state,
            reason: assignment.reason,
            supersededByAssignmentId: assignment.supersededByAssignmentId,
            effectiveStartDate: assignment.effectiveStartDate,
            effectiveEndDate: assignment.effectiveEndDate,
            createdAt: assignment.createdAt,
            updatedAt: assignment.updatedAt,
          },
        );
      }
    });

    return user;
  }

  async getById(id) {
    const row = this.database.get(
      `
        SELECT *
        FROM identity_access_users
        WHERE id = @id
      `,
      { id },
    );

    return row ? this.#map(row) : null;
  }

  async getByPersonId(personId) {
    const row = this.database.get(
      `
        SELECT *
        FROM identity_access_users
        WHERE person_id = @personId
      `,
      { personId },
    );

    return row ? this.#map(row) : null;
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      personId: 'person_id',
      institutionId: 'institution_id',
      status: 'status',
      email: 'email',
    });

    const rows = this.database.all(
      `
        SELECT *
        FROM identity_access_users
        ${sql}
        ORDER BY created_at ASC
      `,
      params,
    );

    return rows.map((row) => this.#map(row));
  }

  #map(row) {
    const assignments = this.database.all(
      `
        SELECT *
        FROM identity_access_user_role_assignments
        WHERE user_id = @userId
        ORDER BY created_at ASC
      `,
      { userId: row.id },
    );

    return new User({
      id: row.id,
      personId: row.person_id,
      institutionId: row.institution_id,
      externalSubjectId: row.external_subject_id,
      email: row.email,
      status: row.status,
      lastLoginAt: row.last_login_at,
      accessAttributes: parseJson(row.access_attributes_json, {}),
      roleAssignments: assignments.map((assignment) => ({
        id: assignment.id,
        userId: assignment.user_id,
        roleId: assignment.role_id,
        scopeType: assignment.scope_type,
        institutionId: assignment.institution_id,
        organizationUnitId: assignment.organization_unit_id,
        committeeId: assignment.committee_id,
        accreditationCycleId: assignment.accreditation_cycle_id,
        reviewTeamId: assignment.review_team_id,
        state: assignment.state,
        reason: assignment.reason,
        supersededByAssignmentId: assignment.superseded_by_assignment_id,
        effectiveStartDate: assignment.effective_start_date,
        effectiveEndDate: assignment.effective_end_date,
        createdAt: assignment.created_at,
        updatedAt: assignment.updated_at,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

export class SqliteRoleRepository extends RoleRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(role) {
    this.database.transaction(() => {
      this.database.run(
        `
          INSERT INTO identity_access_roles (
            id, name, code, description, scope_type,
            status, created_at, updated_at
          )
          VALUES (
            @id, @name, @code, @description, @scopeType,
            @status, @createdAt, @updatedAt
          )
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            code = excluded.code,
            description = excluded.description,
            scope_type = excluded.scope_type,
            status = excluded.status,
            updated_at = excluded.updated_at
        `,
        {
          id: role.id,
          name: role.name,
          code: role.code,
          description: role.description,
          scopeType: role.scopeType,
          status: role.status,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        },
      );

      for (const grant of role.permissionGrants) {
        this.database.run(
          `
            INSERT INTO identity_access_role_permission_grants (
              id, role_id, permission_id, state, reason,
              effective_start_date, effective_end_date, revoked_at, created_at, updated_at
            )
            VALUES (
              @id, @roleId, @permissionId, @state, @reason,
              @effectiveStartDate, @effectiveEndDate, @revokedAt, @createdAt, @updatedAt
            )
            ON CONFLICT(id) DO UPDATE SET
              role_id = excluded.role_id,
              permission_id = excluded.permission_id,
              state = excluded.state,
              reason = excluded.reason,
              effective_start_date = excluded.effective_start_date,
              effective_end_date = excluded.effective_end_date,
              revoked_at = excluded.revoked_at,
              updated_at = excluded.updated_at
          `,
          {
            id: grant.id,
            roleId: grant.roleId,
            permissionId: grant.permissionId,
            state: grant.state,
            reason: grant.reason,
            effectiveStartDate: grant.effectiveStartDate,
            effectiveEndDate: grant.effectiveEndDate,
            revokedAt: grant.revokedAt,
            createdAt: grant.createdAt,
            updatedAt: grant.updatedAt,
          },
        );
      }
    });

    return role;
  }

  async getById(id) {
    const row = this.database.get(
      `
        SELECT *
        FROM identity_access_roles
        WHERE id = @id
      `,
      { id },
    );

    return row ? this.#map(row) : null;
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      name: 'name',
      code: 'code',
      scopeType: 'scope_type',
      status: 'status',
    });

    const rows = this.database.all(
      `
        SELECT *
        FROM identity_access_roles
        ${sql}
        ORDER BY created_at ASC
      `,
      params,
    );

    return rows.map((row) => this.#map(row));
  }

  #map(row) {
    const grants = this.database.all(
      `
        SELECT *
        FROM identity_access_role_permission_grants
        WHERE role_id = @roleId
        ORDER BY created_at ASC
      `,
      { roleId: row.id },
    );

    return new Role({
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description,
      scopeType: row.scope_type,
      status: row.status,
      permissionGrants: grants.map((grant) => ({
        id: grant.id,
        roleId: grant.role_id,
        permissionId: grant.permission_id,
        state: grant.state,
        reason: grant.reason,
        effectiveStartDate: grant.effective_start_date,
        effectiveEndDate: grant.effective_end_date,
        revokedAt: grant.revoked_at,
        createdAt: grant.created_at,
        updatedAt: grant.updated_at,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

export class SqlitePermissionRepository extends PermissionRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(permission) {
    this.database.run(
      `
        INSERT INTO identity_access_permissions (
          id, key, name, description, status, created_at, updated_at
        )
        VALUES (
          @id, @key, @name, @description, @status, @createdAt, @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          key = excluded.key,
          name = excluded.name,
          description = excluded.description,
          status = excluded.status,
          updated_at = excluded.updated_at
      `,
      {
        id: permission.id,
        key: permission.key,
        name: permission.name,
        description: permission.description,
        status: permission.status,
        createdAt: permission.createdAt,
        updatedAt: permission.updatedAt,
      },
    );

    return permission;
  }

  async getById(id) {
    const row = this.database.get(
      `
        SELECT *
        FROM identity_access_permissions
        WHERE id = @id
      `,
      { id },
    );

    return row ? this.#map(row) : null;
  }

  async getByKey(key) {
    const row = this.database.get(
      `
        SELECT *
        FROM identity_access_permissions
        WHERE key = @key
      `,
      { key },
    );

    return row ? this.#map(row) : null;
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      key: 'key',
      name: 'name',
      status: 'status',
    });

    const rows = this.database.all(
      `
        SELECT *
        FROM identity_access_permissions
        ${sql}
        ORDER BY created_at ASC
      `,
      params,
    );

    return rows.map((row) => this.#map(row));
  }

  #map(row) {
    return new Permission({
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

export class SqliteServicePrincipalRepository extends ServicePrincipalRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(principal) {
    this.database.run(
      `
        INSERT INTO identity_access_service_principals (
          id, name, description, principal_type, client_id,
          credential_metadata_json, status, human_person_id, created_at, updated_at
        )
        VALUES (
          @id, @name, @description, @principalType, @clientId,
          @credentialMetadataJson, @status, NULL, @createdAt, @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          principal_type = excluded.principal_type,
          client_id = excluded.client_id,
          credential_metadata_json = excluded.credential_metadata_json,
          status = excluded.status,
          updated_at = excluded.updated_at
      `,
      {
        id: principal.id,
        name: principal.name,
        description: principal.description,
        principalType: principal.principalType,
        clientId: principal.clientId,
        credentialMetadataJson: JSON.stringify(principal.credentialMetadata ?? {}),
        status: principal.status,
        createdAt: principal.createdAt,
        updatedAt: principal.updatedAt,
      },
    );

    return principal;
  }

  async getById(id) {
    const row = this.database.get(
      `
        SELECT *
        FROM identity_access_service_principals
        WHERE id = @id
      `,
      { id },
    );

    return row ? this.#map(row) : null;
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      principalType: 'principal_type',
      status: 'status',
      clientId: 'client_id',
      name: 'name',
    });

    const rows = this.database.all(
      `
        SELECT *
        FROM identity_access_service_principals
        ${sql}
        ORDER BY created_at ASC
      `,
      params,
    );

    return rows.map((row) => this.#map(row));
  }

  #map(row) {
    return new ServicePrincipal({
      id: row.id,
      name: row.name,
      description: row.description,
      principalType: row.principal_type,
      clientId: row.client_id,
      credentialMetadata: parseJson(row.credential_metadata_json, {}),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
