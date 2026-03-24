import { assertDateOrder, assertRequired, assertString, assertOneOf } from '../../../shared/kernel/assertions.js';
import { recordStatus } from '../../../shared/value-objects/statuses.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import { ValidationError } from '../../../shared/kernel/errors.js';

export class OrganizationUnit {
  constructor(props) {
    assertRequired(props.id, 'OrganizationUnit.id');
    assertRequired(props.institutionId, 'OrganizationUnit.institutionId');
    assertString(props.name, 'OrganizationUnit.name');
    assertString(props.unitType, 'OrganizationUnit.unitType');
    assertOneOf(props.status, 'OrganizationUnit.status', Object.values(recordStatus));
    assertDateOrder(props.effectiveStartDate, props.effectiveEndDate);

    if (props.parentUnitId && props.parentUnitId === props.id) {
      throw new ValidationError('OrganizationUnit cannot be its own parent');
    }

    this.id = props.id;
    this.institutionId = props.institutionId;
    this.name = props.name;
    this.code = props.code ?? null;
    this.unitType = props.unitType;
    this.parentUnitId = props.parentUnitId ?? null;
    this.status = props.status;
    this.effectiveStartDate = props.effectiveStartDate ?? null;
    this.effectiveEndDate = props.effectiveEndDate ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new OrganizationUnit({
      id: input.id ?? createId('orgu'),
      institutionId: input.institutionId,
      name: input.name,
      code: input.code,
      unitType: input.unitType,
      parentUnitId: input.parentUnitId,
      status: input.status ?? recordStatus.ACTIVE,
      effectiveStartDate: input.effectiveStartDate,
      effectiveEndDate: input.effectiveEndDate,
      createdAt: now,
      updatedAt: now,
    });
  }

  update(patch) {
    const next = new OrganizationUnit({
      ...this,
      ...patch,
      updatedAt: nowIso(),
    });

    Object.assign(this, next);
    return this;
  }
}
