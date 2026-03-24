import { assertOneOf, assertRequired, assertString } from '../../../shared/kernel/assertions.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import { recordStatus } from '../../../shared/value-objects/statuses.js';

export class Course {
  constructor(props) {
    assertRequired(props.id, 'Course.id');
    assertRequired(props.institutionId, 'Course.institutionId');
    assertString(props.name, 'Course.name');
    assertString(props.code, 'Course.code');
    assertOneOf(props.status, 'Course.status', Object.values(recordStatus));

    this.id = props.id;
    this.institutionId = props.institutionId;
    this.programId = props.programId ?? null;
    this.owningOrganizationUnitId = props.owningOrganizationUnitId ?? null;
    this.name = props.name;
    this.code = props.code;
    this.description = props.description ?? null;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new Course({
      id: input.id ?? createId('course'),
      institutionId: input.institutionId,
      programId: input.programId,
      owningOrganizationUnitId: input.owningOrganizationUnitId,
      name: input.name,
      code: input.code,
      description: input.description,
      status: input.status ?? recordStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });
  }
}
