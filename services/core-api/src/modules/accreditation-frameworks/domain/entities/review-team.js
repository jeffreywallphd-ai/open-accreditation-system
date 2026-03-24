import { assertDateOrder, assertOneOf, assertRequired, assertString } from '../../../shared/kernel/assertions.js';
import { ValidationError } from '../../../shared/kernel/errors.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import {
  reviewTeamMembershipConflictStatus,
  reviewTeamMembershipState,
  reviewTeamStatus,
} from '../value-objects/accreditation-statuses.js';

function assertUnique(values, message) {
  if (new Set(values).size !== values.length) {
    throw new ValidationError(message);
  }
}

export class ReviewTeamMembership {
  constructor(props) {
    assertRequired(props.id, 'ReviewTeamMembership.id');
    assertRequired(props.reviewTeamId, 'ReviewTeamMembership.reviewTeamId');
    assertRequired(props.personId, 'ReviewTeamMembership.personId');
    assertString(props.role, 'ReviewTeamMembership.role');
    assertOneOf(props.state, 'ReviewTeamMembership.state', Object.values(reviewTeamMembershipState));
    assertOneOf(
      props.conflictStatus,
      'ReviewTeamMembership.conflictStatus',
      Object.values(reviewTeamMembershipConflictStatus),
    );
    assertDateOrder(props.effectiveStartDate, props.effectiveEndDate);

    this.id = props.id;
    this.reviewTeamId = props.reviewTeamId;
    this.personId = props.personId;
    this.reviewerProfileId = props.reviewerProfileId ?? null;
    this.role = props.role;
    this.responsibilitySummary = props.responsibilitySummary ?? null;
    this.isPrimary = props.isPrimary ?? false;
    this.state = props.state;
    this.conflictStatus = props.conflictStatus;
    this.effectiveStartDate = props.effectiveStartDate ?? null;
    this.effectiveEndDate = props.effectiveEndDate ?? null;
    this.supersedesMembershipId = props.supersedesMembershipId ?? null;
    this.supersededByMembershipId = props.supersededByMembershipId ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new ReviewTeamMembership({
      id: input.id ?? createId('rtm'),
      reviewTeamId: input.reviewTeamId,
      personId: input.personId,
      reviewerProfileId: input.reviewerProfileId,
      role: input.role,
      responsibilitySummary: input.responsibilitySummary,
      isPrimary: input.isPrimary ?? false,
      state: input.state ?? reviewTeamMembershipState.ACTIVE,
      conflictStatus: input.conflictStatus ?? reviewTeamMembershipConflictStatus.NONE,
      effectiveStartDate: input.effectiveStartDate,
      effectiveEndDate: input.effectiveEndDate,
      supersedesMembershipId: input.supersedesMembershipId,
      supersededByMembershipId: input.supersededByMembershipId,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export class ReviewTeam {
  constructor(props) {
    assertRequired(props.id, 'ReviewTeam.id');
    assertRequired(props.accreditationCycleId, 'ReviewTeam.accreditationCycleId');
    assertRequired(props.institutionId, 'ReviewTeam.institutionId');
    assertString(props.name, 'ReviewTeam.name');
    assertOneOf(props.status, 'ReviewTeam.status', Object.values(reviewTeamStatus));

    this.id = props.id;
    this.accreditationCycleId = props.accreditationCycleId;
    this.institutionId = props.institutionId;
    this.name = props.name;
    this.description = props.description ?? null;
    this.status = props.status;
    this.memberships = (props.memberships ?? []).map((item) =>
      item instanceof ReviewTeamMembership ? item : new ReviewTeamMembership(item),
    );
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;

    this.#assertIntegrity();
  }

  static create(input) {
    const now = nowIso();
    return new ReviewTeam({
      id: input.id ?? createId('rt'),
      accreditationCycleId: input.accreditationCycleId,
      institutionId: input.institutionId,
      name: input.name,
      description: input.description,
      status: input.status ?? reviewTeamStatus.DRAFT,
      memberships: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  activate() {
    if (this.status !== reviewTeamStatus.DRAFT) {
      throw new ValidationError('ReviewTeam can only move to active from draft');
    }
    this.status = reviewTeamStatus.ACTIVE;
    this.updatedAt = nowIso();
    return this;
  }

  addMembership(input) {
    const membership = ReviewTeamMembership.create({
      ...input,
      reviewTeamId: this.id,
    });

    const activeForPerson = this.memberships.find(
      (item) => item.personId === membership.personId && item.state === reviewTeamMembershipState.ACTIVE,
    );
    if (membership.state === reviewTeamMembershipState.ACTIVE && activeForPerson && !membership.supersedesMembershipId) {
      throw new ValidationError(`Active ReviewTeamMembership already exists for personId: ${membership.personId}`);
    }

    if (membership.supersedesMembershipId) {
      const superseded = this.memberships.find((item) => item.id === membership.supersedesMembershipId);
      if (!superseded) {
        throw new ValidationError(`ReviewTeamMembership.supersedesMembershipId not found: ${membership.supersedesMembershipId}`);
      }
      if (superseded.supersededByMembershipId) {
        throw new ValidationError('ReviewTeamMembership already superseded and cannot be superseded twice');
      }
      if (superseded.personId !== membership.personId) {
        throw new ValidationError('Superseding membership must keep the same personId');
      }
      if (!membership.effectiveStartDate) {
        throw new ValidationError('Superseding membership requires effectiveStartDate');
      }
      if (
        superseded.effectiveStartDate &&
        new Date(membership.effectiveStartDate).getTime() < new Date(superseded.effectiveStartDate).getTime()
      ) {
        throw new ValidationError('Superseding membership effectiveStartDate cannot be before superseded membership start');
      }
      if (
        superseded.effectiveEndDate &&
        new Date(superseded.effectiveEndDate).getTime() > new Date(membership.effectiveStartDate).getTime()
      ) {
        throw new ValidationError('Superseding membership effectiveStartDate must be on/after superseded membership end');
      }
      superseded.state = reviewTeamMembershipState.SUPERSEDED;
      superseded.supersededByMembershipId = membership.id;
      if (!superseded.effectiveEndDate) {
        superseded.effectiveEndDate = membership.effectiveStartDate;
      }
      superseded.updatedAt = nowIso();
    }

    this.memberships.push(membership);
    this.updatedAt = nowIso();
    this.#assertIntegrity();
    return membership;
  }

  #assertIntegrity() {
    const membershipsById = new Map(this.memberships.map((membership) => [membership.id, membership]));

    const primaryMemberships = this.memberships.filter(
      (membership) => membership.state === reviewTeamMembershipState.ACTIVE && membership.isPrimary,
    );
    if (primaryMemberships.length > 1) {
      throw new ValidationError('ReviewTeam allows only one active primary membership');
    }

    for (const membership of this.memberships) {
      if (membership.reviewTeamId !== this.id) {
        throw new ValidationError(
          `ReviewTeamMembership.reviewTeamId must match ReviewTeam.id: ${membership.id}`,
        );
      }
      if (membership.isPrimary && membership.state !== reviewTeamMembershipState.ACTIVE) {
        throw new ValidationError('ReviewTeamMembership.isPrimary requires active state');
      }
      if (membership.conflictStatus === reviewTeamMembershipConflictStatus.CONFIRMED) {
        if (membership.state === reviewTeamMembershipState.ACTIVE) {
          throw new ValidationError('ReviewTeamMembership with confirmed conflict cannot be active');
        }
        if (membership.isPrimary) {
          throw new ValidationError('ReviewTeamMembership with confirmed conflict cannot be primary');
        }
      }
      if (
        membership.effectiveStartDate &&
        membership.effectiveEndDate &&
        new Date(membership.effectiveEndDate).getTime() < new Date(membership.effectiveStartDate).getTime()
      ) {
        throw new ValidationError('ReviewTeamMembership effective dates are invalid');
      }

      if (membership.supersedesMembershipId) {
        if (membership.supersedesMembershipId === membership.id) {
          throw new ValidationError('ReviewTeamMembership cannot supersede itself');
        }
        const superseded = membershipsById.get(membership.supersedesMembershipId);
        if (!superseded) {
          throw new ValidationError(`ReviewTeamMembership.supersedesMembershipId not found: ${membership.supersedesMembershipId}`);
        }
        if (superseded.personId !== membership.personId) {
          throw new ValidationError('Superseding membership must keep the same personId');
        }
        if (superseded.supersededByMembershipId !== membership.id) {
          throw new ValidationError('ReviewTeamMembership supersession link must include reciprocal supersededByMembershipId');
        }
      }

      if (membership.supersededByMembershipId) {
        if (membership.supersededByMembershipId === membership.id) {
          throw new ValidationError('ReviewTeamMembership cannot be superseded by itself');
        }
        const superseding = membershipsById.get(membership.supersededByMembershipId);
        if (!superseding) {
          throw new ValidationError(
            `ReviewTeamMembership.supersededByMembershipId not found: ${membership.supersededByMembershipId}`,
          );
        }
        if (superseding.supersedesMembershipId !== membership.id) {
          throw new ValidationError('ReviewTeamMembership supersededBy link must match superseding record reference');
        }
      }

      if (membership.state === reviewTeamMembershipState.SUPERSEDED && !membership.supersededByMembershipId) {
        throw new ValidationError('Superseded ReviewTeamMembership must include supersededByMembershipId');
      }
      if (membership.state === reviewTeamMembershipState.ACTIVE && membership.supersededByMembershipId) {
        throw new ValidationError('Active ReviewTeamMembership cannot include supersededByMembershipId');
      }
    }

    const supersededIds = this.memberships
      .filter((membership) => membership.supersedesMembershipId)
      .map((membership) => membership.supersedesMembershipId);
    assertUnique(supersededIds, 'ReviewTeamMembership cannot supersede the same membership twice');
  }
}
