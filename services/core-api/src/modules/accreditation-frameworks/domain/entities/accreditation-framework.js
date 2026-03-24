import { assertRequired, assertString, assertOneOf } from '../../../shared/kernel/assertions.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import { recordStatus } from '../../../shared/value-objects/statuses.js';

export class AccreditationFramework {
  constructor(props) {
    assertRequired(props.id, 'AccreditationFramework.id');
    assertRequired(props.accreditorId, 'AccreditationFramework.accreditorId');
    assertString(props.name, 'AccreditationFramework.name');
    assertString(props.code, 'AccreditationFramework.code');
    assertOneOf(props.status, 'AccreditationFramework.status', Object.values(recordStatus));

    this.id = props.id;
    this.accreditorId = props.accreditorId;
    this.name = props.name;
    this.code = props.code;
    this.description = props.description ?? null;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new AccreditationFramework({
      id: input.id ?? createId('afw'),
      accreditorId: input.accreditorId,
      name: input.name,
      code: input.code,
      description: input.description,
      status: input.status ?? recordStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
  }

  update(patch) {
    const next = new AccreditationFramework({
      ...this,
      ...patch,
      updatedAt: nowIso(),
    });

    Object.assign(this, next);
    return this;
  }
}
