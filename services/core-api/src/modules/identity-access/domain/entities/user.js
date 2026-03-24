import { assertRequired, assertOneOf } from '../../../shared/kernel/assertions.js';
import { userStatus } from '../../../shared/value-objects/statuses.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import { UserRoleAssignment } from './user-role-assignment.js';
import { ValidationError } from '../../../shared/kernel/errors.js';

export class User {
  constructor(props) {
    assertRequired(props.id, 'User.id');
    assertRequired(props.personId, 'User.personId');
    assertRequired(props.institutionId, 'User.institutionId');
    assertOneOf(props.status, 'User.status', Object.values(userStatus));

    this.id = props.id;
    this.personId = props.personId;
    this.institutionId = props.institutionId;
    this.externalSubjectId = props.externalSubjectId ?? null;
    this.email = props.email ?? null;
    this.status = props.status;
    this.lastLoginAt = props.lastLoginAt ?? null;
    this.accessAttributes = props.accessAttributes ?? {};
    this.roleAssignments = (props.roleAssignments ?? []).map((item) =>
      item instanceof UserRoleAssignment ? item : new UserRoleAssignment(item),
    );
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new User({
      id: input.id ?? createId('user'),
      personId: input.personId,
      institutionId: input.institutionId,
      externalSubjectId: input.externalSubjectId,
      email: input.email,
      status: input.status ?? userStatus.PENDING,
      lastLoginAt: input.lastLoginAt,
      accessAttributes: input.accessAttributes,
      roleAssignments: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  update(patch) {
    const next = new User({
      ...this,
      ...patch,
      roleAssignments: this.roleAssignments,
      updatedAt: nowIso(),
    });

    Object.assign(this, next);
    return this;
  }

  assignRole(input) {
    const assignment = UserRoleAssignment.create({
      ...input,
      userId: this.id,
    });

    const conflicting = this.roleAssignments.find(
      (item) => item.state === 'active' && item.isSameBinding(assignment),
    );

    if (conflicting) {
      throw new ValidationError('User already has an active assignment for this role and scope');
    }

    const superseded = this.roleAssignments.filter(
      (item) => item.state === 'active' && item.roleId === assignment.roleId && item.scopeType === assignment.scopeType,
    );

    for (const previous of superseded) {
      previous.supersede(assignment.id, assignment.effectiveStartDate ?? nowIso().slice(0, 10), 'superseded-by-new-assignment');
    }

    this.roleAssignments.push(assignment);
    this.updatedAt = nowIso();
    return assignment;
  }

  revokeRoleAssignment(assignmentId, reason, effectiveEndDate) {
    const assignment = this.roleAssignments.find((item) => item.id === assignmentId);
    if (!assignment) {
      throw new ValidationError(`Assignment not found: ${assignmentId}`);
    }

    assignment.revoke(reason, effectiveEndDate);
    this.updatedAt = nowIso();
    return assignment;
  }
}
