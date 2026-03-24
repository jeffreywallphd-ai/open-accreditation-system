import { ValidationError, NotFoundError } from '../../shared/kernel/errors.js';

function validateRequired(body, fields) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      throw new ValidationError(`${field} is required`);
    }
  }
}

function toResponse(data) {
  return { statusCode: 200, data };
}

function toCreatedResponse(data) {
  return { statusCode: 201, data };
}

function toErrorResponse(error) {
  if (error instanceof ValidationError) {
    return { statusCode: 400, error: error.message };
  }
  if (error instanceof NotFoundError) {
    return { statusCode: 404, error: error.message };
  }
  return { statusCode: 500, error: error.message };
}

function notFoundIfNull(entityName, id, data) {
  if (!data) {
    return { statusCode: 404, error: `${entityName} not found: ${id}` };
  }
  return toResponse(data);
}

export function createIdentityAccessApi(service) {
  return {
    createUser: async (body) => {
      try {
        validateRequired(body, ['personId', 'institutionId']);
        return toCreatedResponse(await service.createUser(body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    updateUser: async (id, body) => {
      try {
        return toResponse(await service.updateUser(id, body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    getUserById: async (id) => notFoundIfNull('User', id, await service.getUserById(id)),
    listUsers: async (query = {}) => toResponse(await service.listUsers(query)),

    createRole: async (body) => {
      try {
        validateRequired(body, ['name']);
        return toCreatedResponse(await service.createRole(body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    updateRole: async (id, body) => {
      try {
        return toResponse(await service.updateRole(id, body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    getRoleById: async (id) => notFoundIfNull('Role', id, await service.getRoleById(id)),
    listRoles: async (query = {}) => toResponse(await service.listRoles(query)),

    createPermission: async (body) => {
      try {
        validateRequired(body, ['key', 'name']);
        return toCreatedResponse(await service.createPermission(body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    updatePermission: async (id, body) => {
      try {
        return toResponse(await service.updatePermission(id, body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    getPermissionById: async (id) => notFoundIfNull('Permission', id, await service.getPermissionById(id)),

    grantPermissionToRole: async (body) => {
      try {
        validateRequired(body, ['roleId', 'permissionId']);
        return toResponse(await service.grantPermissionToRole(body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    revokePermissionFromRole: async (roleId, permissionId, reason) => {
      try {
        return toResponse(await service.revokePermissionFromRole(roleId, permissionId, reason));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    assignRoleToUser: async (body) => {
      try {
        validateRequired(body, ['userId', 'roleId', 'scopeType']);
        return toResponse(await service.assignRoleToUser(body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    revokeRoleAssignment: async (body) => {
      try {
        validateRequired(body, ['userId', 'assignmentId', 'effectiveEndDate']);
        return toResponse(
          await service.revokeRoleAssignment(body.userId, body.assignmentId, body.reason, body.effectiveEndDate),
        );
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    getEffectivePermissionsForUser: async (userId, atIso = undefined) => {
      try {
        return toResponse(await service.getEffectivePermissionsForUser(userId, atIso));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    registerServicePrincipal: async (body) => {
      try {
        validateRequired(body, ['name', 'principalType', 'clientId']);
        return toCreatedResponse(await service.registerServicePrincipal(body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    updateServicePrincipal: async (id, body) => {
      try {
        return toResponse(await service.updateServicePrincipal(id, body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    listServicePrincipals: async (query = {}) => toResponse(await service.listServicePrincipals(query)),
  };
}
