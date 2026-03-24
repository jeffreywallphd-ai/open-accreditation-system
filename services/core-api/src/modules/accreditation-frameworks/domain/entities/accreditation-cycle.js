import { assertDateOrder, assertOneOf, assertRequired, assertString } from '../../../shared/kernel/assertions.js';
import { ValidationError } from '../../../shared/kernel/errors.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import {
  accreditationCycleStatus,
  accreditationScopeStatus,
  cycleMilestoneStatus,
  decisionRecordStatus,
  reviewEventStatus,
} from '../value-objects/accreditation-statuses.js';

function isDateInRange(dateValue, startDate, endDate) {
  if (!dateValue) {
    return true;
  }
  const value = new Date(dateValue).getTime();
  const start = startDate ? new Date(startDate).getTime() : null;
  const end = endDate ? new Date(endDate).getTime() : null;
  if (start !== null && value < start) {
    return false;
  }
  if (end !== null && value > end) {
    return false;
  }
  return true;
}

function ensureUnique(values, message) {
  if (new Set(values).size !== values.length) {
    throw new ValidationError(message);
  }
}

export class AccreditationScope {
  constructor(props) {
    assertRequired(props.id, 'AccreditationScope.id');
    assertRequired(props.accreditationCycleId, 'AccreditationScope.accreditationCycleId');
    assertString(props.name, 'AccreditationScope.name');
    assertString(props.scopeType, 'AccreditationScope.scopeType');
    assertOneOf(props.status, 'AccreditationScope.status', Object.values(accreditationScopeStatus));
    assertDateOrder(props.effectiveStartDate, props.effectiveEndDate);

    this.id = props.id;
    this.accreditationCycleId = props.accreditationCycleId;
    this.name = props.name;
    this.scopeType = props.scopeType;
    this.description = props.description ?? null;
    this.status = props.status;
    this.programIds = props.programIds ?? [];
    this.organizationUnitIds = props.organizationUnitIds ?? [];
    this.effectiveStartDate = props.effectiveStartDate ?? null;
    this.effectiveEndDate = props.effectiveEndDate ?? null;
    this.scopeOrder = props.scopeOrder ?? 0;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    const programIds = [...(input.programIds ?? [])];
    const organizationUnitIds = [...(input.organizationUnitIds ?? [])];
    if (programIds.length === 0 && organizationUnitIds.length === 0) {
      throw new ValidationError('AccreditationScope must include at least one programId or organizationUnitId');
    }
    ensureUnique(programIds, 'AccreditationScope programIds must be unique');
    ensureUnique(organizationUnitIds, 'AccreditationScope organizationUnitIds must be unique');

    return new AccreditationScope({
      id: input.id ?? createId('scope'),
      accreditationCycleId: input.accreditationCycleId,
      name: input.name,
      scopeType: input.scopeType,
      description: input.description,
      status: input.status ?? accreditationScopeStatus.DRAFT,
      programIds,
      organizationUnitIds,
      effectiveStartDate: input.effectiveStartDate,
      effectiveEndDate: input.effectiveEndDate,
      scopeOrder: input.scopeOrder,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export class CycleMilestone {
  constructor(props) {
    assertRequired(props.id, 'CycleMilestone.id');
    assertRequired(props.accreditationCycleId, 'CycleMilestone.accreditationCycleId');
    assertString(props.name, 'CycleMilestone.name');
    assertRequired(props.dueDate, 'CycleMilestone.dueDate');
    assertOneOf(props.status, 'CycleMilestone.status', Object.values(cycleMilestoneStatus));

    this.id = props.id;
    this.accreditationCycleId = props.accreditationCycleId;
    this.name = props.name;
    this.milestoneType = props.milestoneType ?? 'cycle';
    this.dueDate = props.dueDate;
    this.status = props.status;
    this.scopeId = props.scopeId ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new CycleMilestone({
      id: input.id ?? createId('mile'),
      accreditationCycleId: input.accreditationCycleId,
      name: input.name,
      milestoneType: input.milestoneType,
      dueDate: input.dueDate,
      status: input.status ?? cycleMilestoneStatus.PLANNED,
      scopeId: input.scopeId,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export class ReviewEvent {
  constructor(props) {
    assertRequired(props.id, 'ReviewEvent.id');
    assertRequired(props.accreditationCycleId, 'ReviewEvent.accreditationCycleId');
    assertString(props.name, 'ReviewEvent.name');
    assertString(props.eventType, 'ReviewEvent.eventType');
    assertRequired(props.startDate, 'ReviewEvent.startDate');
    assertRequired(props.endDate, 'ReviewEvent.endDate');
    assertDateOrder(props.startDate, props.endDate, 'ReviewEvent.startDate', 'ReviewEvent.endDate');
    assertOneOf(props.status, 'ReviewEvent.status', Object.values(reviewEventStatus));

    this.id = props.id;
    this.accreditationCycleId = props.accreditationCycleId;
    this.reviewTeamId = props.reviewTeamId ?? null;
    this.scopeId = props.scopeId ?? null;
    this.name = props.name;
    this.eventType = props.eventType;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new ReviewEvent({
      id: input.id ?? createId('rev'),
      accreditationCycleId: input.accreditationCycleId,
      reviewTeamId: input.reviewTeamId,
      scopeId: input.scopeId,
      name: input.name,
      eventType: input.eventType,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status ?? reviewEventStatus.PLANNED,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export class DecisionRecord {
  constructor(props) {
    assertRequired(props.id, 'DecisionRecord.id');
    assertRequired(props.accreditationCycleId, 'DecisionRecord.accreditationCycleId');
    assertString(props.decisionType, 'DecisionRecord.decisionType');
    assertString(props.outcome, 'DecisionRecord.outcome');
    assertRequired(props.issuedAt, 'DecisionRecord.issuedAt');
    assertOneOf(props.status, 'DecisionRecord.status', Object.values(decisionRecordStatus));

    this.id = props.id;
    this.accreditationCycleId = props.accreditationCycleId;
    this.reviewEventId = props.reviewEventId ?? null;
    this.decisionType = props.decisionType;
    this.outcome = props.outcome;
    this.rationale = props.rationale ?? null;
    this.issuedAt = props.issuedAt;
    this.status = props.status;
    this.supersedesDecisionRecordId = props.supersedesDecisionRecordId ?? null;
    this.supersededByDecisionRecordId = props.supersededByDecisionRecordId ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new DecisionRecord({
      id: input.id ?? createId('dec'),
      accreditationCycleId: input.accreditationCycleId,
      reviewEventId: input.reviewEventId,
      decisionType: input.decisionType,
      outcome: input.outcome,
      rationale: input.rationale,
      issuedAt: input.issuedAt ?? now,
      status: input.status ?? decisionRecordStatus.ISSUED,
      supersedesDecisionRecordId: input.supersedesDecisionRecordId,
      supersededByDecisionRecordId: input.supersededByDecisionRecordId,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export class AccreditationCycle {
  constructor(props) {
    assertRequired(props.id, 'AccreditationCycle.id');
    assertRequired(props.frameworkVersionId, 'AccreditationCycle.frameworkVersionId');
    assertRequired(props.institutionId, 'AccreditationCycle.institutionId');
    assertString(props.name, 'AccreditationCycle.name');
    assertRequired(props.cycleStartDate, 'AccreditationCycle.cycleStartDate');
    assertRequired(props.cycleEndDate, 'AccreditationCycle.cycleEndDate');
    assertDateOrder(props.cycleStartDate, props.cycleEndDate, 'AccreditationCycle.cycleStartDate', 'AccreditationCycle.cycleEndDate');
    assertOneOf(props.status, 'AccreditationCycle.status', Object.values(accreditationCycleStatus));

    this.id = props.id;
    this.frameworkVersionId = props.frameworkVersionId;
    this.institutionId = props.institutionId;
    this.name = props.name;
    this.cycleStartDate = props.cycleStartDate;
    this.cycleEndDate = props.cycleEndDate;
    this.status = props.status;
    this.scopes = (props.scopes ?? []).map((item) => (item instanceof AccreditationScope ? item : new AccreditationScope(item)));
    this.milestones = (props.milestones ?? []).map((item) => (item instanceof CycleMilestone ? item : new CycleMilestone(item)));
    this.reviewEvents = (props.reviewEvents ?? []).map((item) => (item instanceof ReviewEvent ? item : new ReviewEvent(item)));
    this.decisionRecords = (props.decisionRecords ?? []).map((item) =>
      item instanceof DecisionRecord ? item : new DecisionRecord(item),
    );
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;

    this.#assertAggregateIntegrity();
  }

  static create(input) {
    const now = nowIso();
    return new AccreditationCycle({
      id: input.id ?? createId('cycle'),
      frameworkVersionId: input.frameworkVersionId,
      institutionId: input.institutionId,
      name: input.name,
      cycleStartDate: input.cycleStartDate,
      cycleEndDate: input.cycleEndDate,
      status: input.status ?? accreditationCycleStatus.DRAFT,
      scopes: [],
      milestones: [],
      reviewEvents: [],
      decisionRecords: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  activate() {
    if (this.status !== accreditationCycleStatus.DRAFT) {
      throw new ValidationError('AccreditationCycle can only move to active from draft');
    }
    this.status = accreditationCycleStatus.ACTIVE;
    this.updatedAt = nowIso();
    this.#assertAggregateIntegrity();
    return this;
  }

  addScope(input) {
    const scope = AccreditationScope.create({
      ...input,
      accreditationCycleId: this.id,
    });

    if (!isDateInRange(scope.effectiveStartDate, this.cycleStartDate, this.cycleEndDate)) {
      throw new ValidationError('AccreditationScope.effectiveStartDate must be within AccreditationCycle dates');
    }
    if (!isDateInRange(scope.effectiveEndDate, this.cycleStartDate, this.cycleEndDate)) {
      throw new ValidationError('AccreditationScope.effectiveEndDate must be within AccreditationCycle dates');
    }

    const duplicate = this.scopes.find(
      (item) =>
        item.scopeType === scope.scopeType &&
        item.name === scope.name &&
        JSON.stringify(item.programIds) === JSON.stringify(scope.programIds) &&
        JSON.stringify(item.organizationUnitIds) === JSON.stringify(scope.organizationUnitIds),
    );
    if (duplicate) {
      throw new ValidationError('Duplicate AccreditationScope for the same cycle');
    }

    this.scopes.push(scope);
    this.updatedAt = nowIso();
    this.#assertAggregateIntegrity();
    return scope;
  }

  addMilestone(input) {
    const milestone = CycleMilestone.create({
      ...input,
      accreditationCycleId: this.id,
    });

    if (!isDateInRange(milestone.dueDate, this.cycleStartDate, this.cycleEndDate)) {
      throw new ValidationError('CycleMilestone.dueDate must be within AccreditationCycle dates');
    }

    if (milestone.scopeId && !this.scopes.some((item) => item.id === milestone.scopeId)) {
      throw new ValidationError(`CycleMilestone.scopeId not found in AccreditationCycle: ${milestone.scopeId}`);
    }

    this.milestones.push(milestone);
    this.updatedAt = nowIso();
    this.#assertAggregateIntegrity();
    return milestone;
  }

  addReviewEvent(input) {
    const reviewEvent = ReviewEvent.create({
      ...input,
      accreditationCycleId: this.id,
    });

    if (!isDateInRange(reviewEvent.startDate, this.cycleStartDate, this.cycleEndDate)) {
      throw new ValidationError('ReviewEvent.startDate must be within AccreditationCycle dates');
    }
    if (!isDateInRange(reviewEvent.endDate, this.cycleStartDate, this.cycleEndDate)) {
      throw new ValidationError('ReviewEvent.endDate must be within AccreditationCycle dates');
    }

    if (reviewEvent.scopeId && !this.scopes.some((item) => item.id === reviewEvent.scopeId)) {
      throw new ValidationError(`ReviewEvent.scopeId not found in AccreditationCycle: ${reviewEvent.scopeId}`);
    }

    this.reviewEvents.push(reviewEvent);
    this.updatedAt = nowIso();
    this.#assertAggregateIntegrity();
    return reviewEvent;
  }

  issueDecision(input) {
    if (this.status === accreditationCycleStatus.DRAFT) {
      throw new ValidationError('Cannot issue DecisionRecord while AccreditationCycle is draft');
    }

    const decision = DecisionRecord.create({
      ...input,
      accreditationCycleId: this.id,
    });

    if (decision.reviewEventId && !this.reviewEvents.some((item) => item.id === decision.reviewEventId)) {
      throw new ValidationError(`DecisionRecord.reviewEventId not found in AccreditationCycle: ${decision.reviewEventId}`);
    }

    if (decision.supersedesDecisionRecordId) {
      const superseded = this.decisionRecords.find((item) => item.id === decision.supersedesDecisionRecordId);
      if (!superseded) {
        throw new ValidationError(`DecisionRecord.supersedesDecisionRecordId not found: ${decision.supersedesDecisionRecordId}`);
      }
      if (superseded.supersededByDecisionRecordId) {
        throw new ValidationError('DecisionRecord already superseded and cannot be superseded twice');
      }
      superseded.status = decisionRecordStatus.SUPERSEDED;
      superseded.supersededByDecisionRecordId = decision.id;
      superseded.updatedAt = nowIso();
    }

    this.decisionRecords.push(decision);
    this.status = accreditationCycleStatus.DECISION_ISSUED;
    this.updatedAt = nowIso();
    this.#assertAggregateIntegrity();
    return decision;
  }

  #assertAggregateIntegrity() {
    for (const scope of this.scopes) {
      if (scope.accreditationCycleId !== this.id) {
        throw new ValidationError(`AccreditationScope.accreditationCycleId must match AccreditationCycle.id: ${scope.id}`);
      }
      if (!isDateInRange(scope.effectiveStartDate, this.cycleStartDate, this.cycleEndDate)) {
        throw new ValidationError('AccreditationScope.effectiveStartDate must be within AccreditationCycle dates');
      }
      if (!isDateInRange(scope.effectiveEndDate, this.cycleStartDate, this.cycleEndDate)) {
        throw new ValidationError('AccreditationScope.effectiveEndDate must be within AccreditationCycle dates');
      }
    }

    for (const milestone of this.milestones) {
      if (milestone.accreditationCycleId !== this.id) {
        throw new ValidationError(`CycleMilestone.accreditationCycleId must match AccreditationCycle.id: ${milestone.id}`);
      }
      if (!isDateInRange(milestone.dueDate, this.cycleStartDate, this.cycleEndDate)) {
        throw new ValidationError('CycleMilestone.dueDate must be within AccreditationCycle dates');
      }
      if (milestone.scopeId && !this.scopes.some((item) => item.id === milestone.scopeId)) {
        throw new ValidationError(`CycleMilestone.scopeId not found in AccreditationCycle: ${milestone.scopeId}`);
      }
    }

    for (const reviewEvent of this.reviewEvents) {
      if (reviewEvent.accreditationCycleId !== this.id) {
        throw new ValidationError(`ReviewEvent.accreditationCycleId must match AccreditationCycle.id: ${reviewEvent.id}`);
      }
      if (!isDateInRange(reviewEvent.startDate, this.cycleStartDate, this.cycleEndDate)) {
        throw new ValidationError('ReviewEvent.startDate must be within AccreditationCycle dates');
      }
      if (!isDateInRange(reviewEvent.endDate, this.cycleStartDate, this.cycleEndDate)) {
        throw new ValidationError('ReviewEvent.endDate must be within AccreditationCycle dates');
      }
      if (reviewEvent.scopeId && !this.scopes.some((item) => item.id === reviewEvent.scopeId)) {
        throw new ValidationError(`ReviewEvent.scopeId not found in AccreditationCycle: ${reviewEvent.scopeId}`);
      }
    }

    const supersededIds = new Set();
    for (const decision of this.decisionRecords) {
      if (decision.accreditationCycleId !== this.id) {
        throw new ValidationError(`DecisionRecord.accreditationCycleId must match AccreditationCycle.id: ${decision.id}`);
      }
      if (decision.reviewEventId && !this.reviewEvents.some((item) => item.id === decision.reviewEventId)) {
        throw new ValidationError(`DecisionRecord.reviewEventId not found in AccreditationCycle: ${decision.reviewEventId}`);
      }
      if (decision.supersedesDecisionRecordId) {
        if (!this.decisionRecords.some((item) => item.id === decision.supersedesDecisionRecordId)) {
          throw new ValidationError(
            `DecisionRecord.supersedesDecisionRecordId not found: ${decision.supersedesDecisionRecordId}`,
          );
        }
        if (supersededIds.has(decision.supersedesDecisionRecordId)) {
          throw new ValidationError('DecisionRecord already superseded and cannot be superseded twice');
        }
        supersededIds.add(decision.supersedesDecisionRecordId);
      }
    }
  }
}
