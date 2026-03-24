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

export function createOrganizationRegistryApi(service) {
  return {
    createInstitution: async (body) => {
      try {
        validateRequired(body, ['name']);
        return toCreatedResponse(await service.createInstitution(body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    updateInstitution: async (id, body) => {
      try {
        return toResponse(await service.updateInstitution(id, body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    getInstitutionById: async (id) => notFoundIfNull('Institution', id, await service.getInstitutionById(id)),
    listInstitutions: async (query = {}) => toResponse(await service.listInstitutions(query)),

    createPerson: async (body) => {
      try {
        validateRequired(body, ['institutionId', 'displayName']);
        return toCreatedResponse(await service.createPerson(body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    updatePerson: async (id, body) => {
      try {
        return toResponse(await service.updatePerson(id, body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    getPersonById: async (id) => notFoundIfNull('Person', id, await service.getPersonById(id)),
    listPeople: async (query = {}) => toResponse(await service.listPeople(query)),

    createOrganizationUnit: async (body) => {
      try {
        validateRequired(body, ['institutionId', 'name', 'unitType']);
        return toCreatedResponse(await service.createOrganizationUnit(body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    updateOrganizationUnit: async (id, body) => {
      try {
        return toResponse(await service.updateOrganizationUnit(id, body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    getOrganizationUnitById: async (id) => notFoundIfNull('OrganizationUnit', id, await service.getOrganizationUnitById(id)),
    listOrganizationUnits: async (query = {}) => toResponse(await service.listOrganizationUnits(query)),

    getOrganizationUnitHierarchy: async (institutionId, query = {}) => {
      try {
        return toResponse(await service.getOrganizationUnitHierarchy(institutionId, query.status));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    createCommittee: async (body) => {
      try {
        validateRequired(body, ['institutionId', 'name']);
        return toCreatedResponse(await service.createCommittee(body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    updateCommittee: async (id, body) => {
      try {
        return toResponse(await service.updateCommittee(id, body));
      } catch (error) {
        return toErrorResponse(error);
      }
    },

    getCommitteeById: async (id) => notFoundIfNull('Committee', id, await service.getCommitteeById(id)),
    listCommittees: async (query = {}) => toResponse(await service.listCommittees(query)),
  };
}
