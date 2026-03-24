import { assertDateOrder, assertOneOf, assertRequired, assertString } from '../../../shared/kernel/assertions.js';
import { ValidationError } from '../../../shared/kernel/errors.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import {
  accreditationCycleStatus,
  accreditationScopeStatus,
  cycleMilestoneStatus,
  decisionRecordStatus,
  reportingPeriodStatus,
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

export class AccreditationScopeProgram {
  constructor(props) {
    assertRequired(props.id, 'AccreditationScopeProgram.id');
    assertRequired(props.accreditationScopeId, 'AccreditationScopeProgram.accreditationScopeId');
    assertRequired(props.programId, 'AccreditationScopeProgram.programId');

    this.id = props.id;
    this.accreditationScopeId = props.accreditationScopeId;
    this.programId = props.programId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new AccreditationScopeProgram({
      id: input.id ?? createId('scope_prog'),
      accreditationScopeId: input.accreditationScopeId,
      programId: input.programId,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export class AccreditationScopeOrganizationUnit {
  constructor(props) {
    assertRequired(props.id, 'AccreditationScopeOrganizationUnit.id');
    assertRequired(props.accreditationScopeId, 'AccreditationScopeOrganizationUnit.accreditationScopeId');
    assertRequired(props.organizationUnitId, 'AccreditationScopeOrganizationUnit.organizationUnitId');

    this.id = props.id;
    this.accreditationScopeId = props.accreditationScopeId;
    this.organizationUnitId = props.organizationUnitId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new AccreditationScopeOrganizationUnit({
      id: input.id ?? createId('scope_org'),
      accreditationScopeId: input.accreditationScopeId,
      organizationUnitId: input.organizationUnitId,
      createdAt: now,
      updatedAt: now,
    });
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
    this.scopePrograms = (props.scopePrograms ?? []).map((item) =>
      item instanceof AccreditationScopeProgram ? item : new AccreditationScopeProgram(item),
    );
    this.scopeOrganizationUnits = (props.scopeOrganizationUnits ?? []).map((item) =>
      item instanceof AccreditationScopeOrganizationUnit ? item : new AccreditationScopeOrganizationUnit(item),
    );
    this.effectiveStartDate = props.effectiveStartDate ?? null;
    this.effectiveEndDate = props.effectiveEndDate ?? null;
    this.scopeOrder = props.scopeOrder ?? 0;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;

    if (this.scopePrograms.length === 0 && this.scopeOrganizationUnits.length === 0) {
      const legacyProgramIds = [...(props.programIds ?? [])];
      const legacyOrganizationUnitIds = [...(props.organizationUnitIds ?? [])];
      this.scopePrograms = legacyProgramIds.map((programId) =>
        AccreditationScopeProgram.create({
          accreditationScopeId: this.id,
          programId,
        }),
      );
      this.scopeOrganizationUnits = legacyOrganizationUnitIds.map((organizationUnitId) =>
        AccreditationScopeOrganizationUnit.create({
          accreditationScopeId: this.id,
          organizationUnitId,
        }),
      );
    }

    this.#assertIntegrity();
  }

  static create(input) {
    const now = nowIso();
    const id = input.id ?? createId('scope');
    const programIds = [...(input.programIds ?? [])];
    const organizationUnitIds = [...(input.organizationUnitIds ?? [])];
    if (programIds.length === 0 && organizationUnitIds.length === 0) {
      throw new ValidationError('AccreditationScope must include at least one programId or organizationUnitId');
    }
    ensureUnique(programIds, 'AccreditationScope programIds must be unique');
    ensureUnique(organizationUnitIds, 'AccreditationScope organizationUnitIds must be unique');

    return new AccreditationScope({
      id,
      accreditationCycleId: input.accreditationCycleId,
      name: input.name,
      scopeType: input.scopeType,
      description: input.description,
      status: input.status ?? accreditationScopeStatus.DRAFT,
      scopePrograms: programIds.map((programId) =>
        AccreditationScopeProgram.create({
          accreditationScopeId: id,
          programId,
        }),
      ),
      scopeOrganizationUnits: organizationUnitIds.map((organizationUnitId) =>
        AccreditationScopeOrganizationUnit.create({
          accreditationScopeId: id,
          organizationUnitId,
        }),
      ),
      effectiveStartDate: input.effectiveStartDate,
      effectiveEndDate: input.effectiveEndDate,
      scopeOrder: input.scopeOrder,
      createdAt: now,
      updatedAt: now,
    });
  }

  get programIds() {
    return this.scopePrograms.map((item) => item.programId);
  }

  get organizationUnitIds() {
    return this.scopeOrganizationUnits.map((item) => item.organizationUnitId);
  }

  #assertIntegrity() {
    const programIds = this.programIds;
    const organizationUnitIds = this.organizationUnitIds;

    if (programIds.length === 0 && organizationUnitIds.length === 0) {
      throw new ValidationError('AccreditationScope must include at least one programId or organizationUnitId');
    }

    ensureUnique(programIds, 'AccreditationScope programIds must be unique');
    ensureUnique(organizationUnitIds, 'AccreditationScope organizationUnitIds must be unique');

    for (const scopeProgram of this.scopePrograms) {
      if (scopeProgram.accreditationScopeId !== this.id) {
        throw new ValidationError(
          `AccreditationScopeProgram.accreditationScopeId must match AccreditationScope.id: ${scopeProgram.id}`,
        );
      }
    }

    for (const scopeOrganizationUnit of this.scopeOrganizationUnits) {
      if (scopeOrganizationUnit.accreditationScopeId !== this.id) {
        throw new ValidationError(
          `AccreditationScopeOrganizationUnit.accreditationScopeId must match AccreditationScope.id: ${scopeOrganizationUnit.id}`,
        );
      }
    }
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

export class ReportingPeriod {
  constructor(props) {
    assertRequired(props.id, 'ReportingPeriod.id');
    assertRequired(props.accreditationCycleId, 'ReportingPeriod.accreditationCycleId');
    assertString(props.name, 'ReportingPeriod.name');
    assertRequired(props.startDate, 'ReportingPeriod.startDate');
    assertRequired(props.endDate, 'ReportingPeriod.endDate');
    assertDateOrder(props.startDate, props.endDate, 'ReportingPeriod.startDate', 'ReportingPeriod.endDate');
    assertOneOf(props.status, 'ReportingPeriod.status', Object.values(reportingPeriodStatus));

    this.id = props.id;
    this.accreditationCycleId = props.accreditationCycleId;
    this.name = props.name;
    this.periodType = props.periodType ?? 'cycle-window';
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.status = props.status;
    this.scopeId = props.scopeId ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new ReportingPeriod({
      id: input.id ?? createId('period'),
      accreditationCycleId: input.accreditationCycleId,
      name: input.name,
      periodType: input.periodType,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status ?? reportingPeriodStatus.OPEN,
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
    this.reportingPeriods = (props.reportingPeriods ?? []).map((item) =>
      item instanceof ReportingPeriod ? item : new ReportingPeriod(item),
    );
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
      reportingPeriods: [],
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

  addReportingPeriod(input) {
    const reportingPeriod = ReportingPeriod.create({
      ...input,
      accreditationCycleId: this.id,
    });

    if (!isDateInRange(reportingPeriod.startDate, this.cycleStartDate, this.cycleEndDate)) {
      throw new ValidationError('ReportingPeriod.startDate must be within AccreditationCycle dates');
    }
    if (!isDateInRange(reportingPeriod.endDate, this.cycleStartDate, this.cycleEndDate)) {
      throw new ValidationError('ReportingPeriod.endDate must be within AccreditationCycle dates');
    }
    if (reportingPeriod.scopeId && !this.scopes.some((item) => item.id === reportingPeriod.scopeId)) {
      throw new ValidationError(`ReportingPeriod.scopeId not found in AccreditationCycle: ${reportingPeriod.scopeId}`);
    }

    const duplicate = this.reportingPeriods.find(
      (item) =>
        item.name === reportingPeriod.name &&
        item.startDate === reportingPeriod.startDate &&
        item.endDate === reportingPeriod.endDate &&
        item.scopeId === reportingPeriod.scopeId,
    );
    if (duplicate) {
      throw new ValidationError('Duplicate ReportingPeriod for the same AccreditationCycle');
    }

    this.reportingPeriods.push(reportingPeriod);
    this.updatedAt = nowIso();
    this.#assertAggregateIntegrity();
    return reportingPeriod;
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

  supersedeDecision(supersededDecisionRecordId, input) {
    return this.issueDecision({
      ...input,
      supersedesDecisionRecordId: supersededDecisionRecordId,
    });
  }

  #assertAggregateIntegrity() {
    const decisionById = new Map(this.decisionRecords.map((item) => [item.id, item]));

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

    for (const reportingPeriod of this.reportingPeriods) {
      if (reportingPeriod.accreditationCycleId !== this.id) {
        throw new ValidationError(
          `ReportingPeriod.accreditationCycleId must match AccreditationCycle.id: ${reportingPeriod.id}`,
        );
      }
      if (!isDateInRange(reportingPeriod.startDate, this.cycleStartDate, this.cycleEndDate)) {
        throw new ValidationError('ReportingPeriod.startDate must be within AccreditationCycle dates');
      }
      if (!isDateInRange(reportingPeriod.endDate, this.cycleStartDate, this.cycleEndDate)) {
        throw new ValidationError('ReportingPeriod.endDate must be within AccreditationCycle dates');
      }
      if (reportingPeriod.scopeId && !this.scopes.some((item) => item.id === reportingPeriod.scopeId)) {
        throw new ValidationError(`ReportingPeriod.scopeId not found in AccreditationCycle: ${reportingPeriod.scopeId}`);
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
        if (decision.supersedesDecisionRecordId === decision.id) {
          throw new ValidationError('DecisionRecord cannot supersede itself');
        }
        const superseded = decisionById.get(decision.supersedesDecisionRecordId);
        if (!superseded) {
          throw new ValidationError(
            `DecisionRecord.supersedesDecisionRecordId not found: ${decision.supersedesDecisionRecordId}`,
          );
        }
        if (supersededIds.has(decision.supersedesDecisionRecordId)) {
          throw new ValidationError('DecisionRecord already superseded and cannot be superseded twice');
        }
        if (superseded.supersededByDecisionRecordId !== decision.id) {
          throw new ValidationError('DecisionRecord supersession link must include reciprocal supersededByDecisionRecordId');
        }
        supersededIds.add(decision.supersedesDecisionRecordId);
      }

      if (decision.supersededByDecisionRecordId) {
        if (decision.supersededByDecisionRecordId === decision.id) {
          throw new ValidationError('DecisionRecord cannot be superseded by itself');
        }
        const superseding = decisionById.get(decision.supersededByDecisionRecordId);
        if (!superseding) {
          throw new ValidationError(
            `DecisionRecord.supersededByDecisionRecordId not found: ${decision.supersededByDecisionRecordId}`,
          );
        }
        if (superseding.supersedesDecisionRecordId !== decision.id) {
          throw new ValidationError('DecisionRecord supersededBy link must match superseding record reference');
        }
      }

      if (decision.status === decisionRecordStatus.SUPERSEDED && !decision.supersededByDecisionRecordId) {
        throw new ValidationError('Superseded DecisionRecord must include supersededByDecisionRecordId');
      }
      if (decision.status !== decisionRecordStatus.SUPERSEDED && decision.supersededByDecisionRecordId) {
        throw new ValidationError('Only superseded DecisionRecord can set supersededByDecisionRecordId');
      }
    }
  }
}
