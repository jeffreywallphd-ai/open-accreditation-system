import { UserRepository, RoleRepository, PermissionRepository, ServicePrincipalRepository } from '../../domain/repositories/repositories.js';

function matchesFilter(item, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (value === undefined || value === null) {
      return true;
    }
    return item[key] === value;
  });
}

export class InMemoryUserRepository extends UserRepository {
  constructor() {
    super();
    this.items = new Map();
  }

  async save(user) {
    this.items.set(user.id, user);
    return user;
  }

  async getById(id) {
    return this.items.get(id) ?? null;
  }

  async getByPersonId(personId) {
    return [...this.items.values()].find((item) => item.personId === personId) ?? null;
  }

  async findByFilter(filter = {}) {
    return [...this.items.values()].filter((item) => matchesFilter(item, filter));
  }
}

export class InMemoryRoleRepository extends RoleRepository {
  constructor() {
    super();
    this.items = new Map();
  }

  async save(role) {
    this.items.set(role.id, role);
    return role;
  }

  async getById(id) {
    return this.items.get(id) ?? null;
  }

  async findByFilter(filter = {}) {
    return [...this.items.values()].filter((item) => matchesFilter(item, filter));
  }
}

export class InMemoryPermissionRepository extends PermissionRepository {
  constructor() {
    super();
    this.items = new Map();
  }

  async save(permission) {
    this.items.set(permission.id, permission);
    return permission;
  }

  async getById(id) {
    return this.items.get(id) ?? null;
  }

  async getByKey(key) {
    return [...this.items.values()].find((item) => item.key === key) ?? null;
  }

  async findByFilter(filter = {}) {
    return [...this.items.values()].filter((item) => matchesFilter(item, filter));
  }
}

export class InMemoryServicePrincipalRepository extends ServicePrincipalRepository {
  constructor() {
    super();
    this.items = new Map();
  }

  async save(principal) {
    this.items.set(principal.id, principal);
    return principal;
  }

  async getById(id) {
    return this.items.get(id) ?? null;
  }

  async findByFilter(filter = {}) {
    return [...this.items.values()].filter((item) => matchesFilter(item, filter));
  }
}
