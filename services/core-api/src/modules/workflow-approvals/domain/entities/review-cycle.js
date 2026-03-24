import { assertRequired, assertString } from '../../../shared/kernel/assertions.js';
import { ValidationError } from '../../../shared/kernel/errors.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import { parseReviewCycleStatus, reviewCycleStatus } from '../value-objects/workflow-statuses.js';

const REVIEW_CYCLE_STATUS_TRANSITIONS = Object.freeze({
  [reviewCycleStatus.NOT_STARTED]: new Set([reviewCycleStatus.ACTIVE, reviewCycleStatus.ARCHIVED]),
  [reviewCycleStatus.ACTIVE]: new Set([reviewCycleStatus.COMPLETED]),
  [reviewCycleStatus.COMPLETED]: new Set([reviewCycleStatus.ARCHIVED]),
  [reviewCycleStatus.ARCHIVED]: new Set(),
});

function parseDateMillis(value, field) {
  const millis = new Date(value).getTime();
  if (Number.isNaN(millis)) {
    throw new ValidationError(`${field} must be a valid date`);
  }
  return millis;
}

function normalizeIdList(values = []) {
  const normalized = [...new Set(values.filter(Boolean).map((value) => `${value}`.trim()).filter(Boolean))];
  normalized.sort((left, right) => left.localeCompare(right));
  return normalized;
}

export function buildReviewCycleScopeKey(institutionId, programIds = [], organizationUnitIds = []) {
  const normalizedPrograms = normalizeIdList(programIds);
  const normalizedOrganizationUnits = normalizeIdList(organizationUnitIds);
  return `${institutionId}::programs=${normalizedPrograms.join(',')}::org-units=${normalizedOrganizationUnits.join(',')}`;
}

export class ReviewCycle {
  constructor(props) {
    assertRequired(props.id, 'ReviewCycle.id');
    assertRequired(props.institutionId, 'ReviewCycle.institutionId');
    assertString(props.name, 'ReviewCycle.name');
    assertRequired(props.startDate, 'ReviewCycle.startDate');
    assertRequired(props.endDate, 'ReviewCycle.endDate');
    parseReviewCycleStatus(props.status);

    const startMillis = parseDateMillis(props.startDate, 'ReviewCycle.startDate');
    const endMillis = parseDateMillis(props.endDate, 'ReviewCycle.endDate');
    if (startMillis >= endMillis) {
      throw new ValidationError('ReviewCycle.startDate must be earlier than ReviewCycle.endDate');
    }

    this.id = props.id;
    this.institutionId = props.institutionId;
    this.name = props.name;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.status = props.status;
    this.programIds = normalizeIdList(props.programIds ?? []);
    this.organizationUnitIds = normalizeIdList(props.organizationUnitIds ?? []);
    this.evidenceSetIds = normalizeIdList(props.evidenceSetIds ?? []);
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input) {
    const now = nowIso();
    return new ReviewCycle({
      id: input.id ?? createId('rev_cycle'),
      institutionId: input.institutionId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status ?? reviewCycleStatus.NOT_STARTED,
      programIds: input.programIds ?? [],
      organizationUnitIds: input.organizationUnitIds ?? [],
      evidenceSetIds: input.evidenceSetIds ?? [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(input) {
    return new ReviewCycle(input);
  }

  get scopeKey() {
    return buildReviewCycleScopeKey(this.institutionId, this.programIds, this.organizationUnitIds);
  }

  start() {
    this.#assertTransition(reviewCycleStatus.ACTIVE, 'start');
    this.status = reviewCycleStatus.ACTIVE;
    this.updatedAt = nowIso();
    return this;
  }

  complete() {
    this.#assertTransition(reviewCycleStatus.COMPLETED, 'complete');
    this.status = reviewCycleStatus.COMPLETED;
    this.updatedAt = nowIso();
    return this;
  }

  archive() {
    this.#assertTransition(reviewCycleStatus.ARCHIVED, 'archive');
    this.status = reviewCycleStatus.ARCHIVED;
    this.updatedAt = nowIso();
    return this;
  }

  #assertTransition(nextStatus, action) {
    const allowed = REVIEW_CYCLE_STATUS_TRANSITIONS[this.status] ?? new Set();
    if (!allowed.has(nextStatus)) {
      throw new ValidationError(`ReviewCycle cannot ${action} from status=${this.status} to status=${nextStatus}`);
    }
  }
}

