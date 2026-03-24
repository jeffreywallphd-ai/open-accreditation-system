import { assertDateOrder, assertRequired, assertString, assertOneOf } from '../../../shared/kernel/assertions.js';
import { personStatus } from '../../../shared/value-objects/statuses.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import { ValidationError } from '../../../shared/kernel/errors.js';

export class Person {
  constructor(props) {
    assertRequired(props.id, 'Person.id');
    assertRequired(props.institutionId, 'Person.institutionId');
    assertString(props.displayName, 'Person.displayName');
    assertOneOf(props.personStatus, 'Person.personStatus', Object.values(personStatus));
    assertDateOrder(props.effectiveStartDate, props.effectiveEndDate);

    if (!props.primaryEmail && !props.secondaryEmail) {
      throw new ValidationError('Person requires at least one email');
    }

    this.id = props.id;
    this.institutionId = props.institutionId;
    this.preferredName = props.preferredName ?? null;
    this.legalName = props.legalName ?? null;
    this.displayName = props.displayName;
    this.primaryEmail = props.primaryEmail ?? null;
    this.secondaryEmail = props.secondaryEmail ?? null;
    this.personStatus = props.personStatus;
    this.employeeLikeIndicator = props.employeeLikeIndicator ?? false;
    this.externalReferenceSummary = props.externalReferenceSummary ?? null;
    this.matchConfidenceNotes = props.matchConfidenceNotes ?? null;
    this.effectiveStartDate = props.effectiveStartDate ?? null;
    this.effectiveEndDate = props.effectiveEndDate ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new Person({
      id: input.id ?? createId('person'),
      institutionId: input.institutionId,
      preferredName: input.preferredName,
      legalName: input.legalName,
      displayName: input.displayName,
      primaryEmail: input.primaryEmail,
      secondaryEmail: input.secondaryEmail,
      personStatus: input.personStatus ?? personStatus.ACTIVE,
      employeeLikeIndicator: input.employeeLikeIndicator,
      externalReferenceSummary: input.externalReferenceSummary,
      matchConfidenceNotes: input.matchConfidenceNotes,
      effectiveStartDate: input.effectiveStartDate,
      effectiveEndDate: input.effectiveEndDate,
      createdAt: now,
      updatedAt: now,
    });
  }

  update(patch) {
    const next = new Person({
      ...this,
      ...patch,
      updatedAt: nowIso(),
    });

    Object.assign(this, next);
    return this;
  }
}
