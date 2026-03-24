import { assertDateOrder, assertRequired, assertString, assertOneOf } from '../../../shared/kernel/assertions.js';
import { recordStatus } from '../../../shared/value-objects/statuses.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';

export class Committee {
  constructor(props) {
    assertRequired(props.id, 'Committee.id');
    assertRequired(props.institutionId, 'Committee.institutionId');
    assertString(props.name, 'Committee.name');
    assertOneOf(props.status, 'Committee.status', Object.values(recordStatus));
    assertDateOrder(props.effectiveStartDate, props.effectiveEndDate);

    this.id = props.id;
    this.institutionId = props.institutionId;
    this.name = props.name;
    this.code = props.code ?? null;
    this.sponsoringUnitId = props.sponsoringUnitId ?? null;
    this.charterSummary = props.charterSummary ?? null;
    this.status = props.status;
    this.effectiveStartDate = props.effectiveStartDate ?? null;
    this.effectiveEndDate = props.effectiveEndDate ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new Committee({
      id: input.id ?? createId('committee'),
      institutionId: input.institutionId,
      name: input.name,
      code: input.code,
      sponsoringUnitId: input.sponsoringUnitId,
      charterSummary: input.charterSummary,
      status: input.status ?? recordStatus.ACTIVE,
      effectiveStartDate: input.effectiveStartDate,
      effectiveEndDate: input.effectiveEndDate,
      createdAt: now,
      updatedAt: now,
    });
  }

  update(patch) {
    const next = new Committee({
      ...this,
      ...patch,
      updatedAt: nowIso(),
    });

    Object.assign(this, next);
    return this;
  }
}
