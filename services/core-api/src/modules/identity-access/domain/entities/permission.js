import { assertRequired, assertString, assertOneOf } from '../../../shared/kernel/assertions.js';
import { recordStatus } from '../../../shared/value-objects/statuses.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';

export class Permission {
  constructor(props) {
    assertRequired(props.id, 'Permission.id');
    assertString(props.key, 'Permission.key');
    assertString(props.name, 'Permission.name');
    assertOneOf(props.status, 'Permission.status', Object.values(recordStatus));

    this.id = props.id;
    this.key = props.key;
    this.name = props.name;
    this.description = props.description ?? null;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new Permission({
      id: input.id ?? createId('perm'),
      key: input.key,
      name: input.name,
      description: input.description,
      status: input.status ?? recordStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
  }

  update(patch) {
    const next = new Permission({
      ...this,
      ...patch,
      updatedAt: nowIso(),
    });

    Object.assign(this, next);
    return this;
  }
}
