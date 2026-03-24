import { assertRequired, assertString, assertOneOf } from '../../../shared/kernel/assertions.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import { recordStatus } from '../../../shared/value-objects/statuses.js';

export class Accreditor {
  constructor(props) {
    assertRequired(props.id, 'Accreditor.id');
    assertString(props.name, 'Accreditor.name');
    assertString(props.code, 'Accreditor.code');
    assertOneOf(props.status, 'Accreditor.status', Object.values(recordStatus));

    this.id = props.id;
    this.name = props.name;
    this.code = props.code;
    this.description = props.description ?? null;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new Accreditor({
      id: input.id ?? createId('accr'),
      name: input.name,
      code: input.code,
      description: input.description,
      status: input.status ?? recordStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
  }

  update(patch) {
    const next = new Accreditor({
      ...this,
      ...patch,
      updatedAt: nowIso(),
    });

    Object.assign(this, next);
    return this;
  }
}
