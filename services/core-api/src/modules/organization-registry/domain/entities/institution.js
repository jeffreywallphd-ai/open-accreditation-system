import { assertDateOrder, assertRequired, assertString, assertOneOf } from '../../../shared/kernel/assertions.js';
import { recordStatus } from '../../../shared/value-objects/statuses.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';

export class Institution {
  constructor(props) {
    assertRequired(props.id, 'Institution.id');
    assertString(props.name, 'Institution.name');
    assertOneOf(props.status, 'Institution.status', Object.values(recordStatus));
    assertDateOrder(props.effectiveStartDate, props.effectiveEndDate);

    this.id = props.id;
    this.name = props.name;
    this.code = props.code ?? null;
    this.timezone = props.timezone ?? 'UTC';
    this.status = props.status;
    this.effectiveStartDate = props.effectiveStartDate ?? null;
    this.effectiveEndDate = props.effectiveEndDate ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new Institution({
      id: input.id ?? createId('inst'),
      name: input.name,
      code: input.code,
      timezone: input.timezone,
      status: input.status ?? recordStatus.ACTIVE,
      effectiveStartDate: input.effectiveStartDate,
      effectiveEndDate: input.effectiveEndDate,
      createdAt: now,
      updatedAt: now,
    });
  }

  update(patch) {
    const next = new Institution({
      ...this,
      ...patch,
      updatedAt: nowIso(),
    });

    Object.assign(this, next);
    return this;
  }
}
