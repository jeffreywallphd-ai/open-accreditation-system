import { ValidationError } from '../../../shared/kernel/errors.js';
import { ReviewCycleRepository, ReviewWorkflowRepository } from '../../domain/repositories/repositories.js';
import { ReviewCycle } from '../../domain/entities/review-cycle.js';
import { ReviewWorkflow, WorkflowTransitionRecord } from '../../domain/entities/review-workflow.js';
import { reviewCycleStatus } from '../../domain/value-objects/workflow-statuses.js';

function parseJsonList(rawValue) {
  if (!rawValue) {
    return [];
  }
  const parsed = JSON.parse(rawValue);
  return Array.isArray(parsed) ? parsed : [];
}

function filterClause(filter = {}, keyMap = {}) {
  const where = [];
  const params = {};
  for (const [filterKey, column] of Object.entries(keyMap)) {
    const value = filter[filterKey];
    if (value === undefined || value === null) {
      continue;
    }
    where.push(`${column} = @${filterKey}`);
    params[filterKey] = value;
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

function toReviewCycleSnapshot(cycle) {
  return {
    id: cycle.id,
    institutionId: cycle.institutionId,
    scopeKey: cycle.scopeKey,
    name: cycle.name,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    status: cycle.status,
    programIds: [...(cycle.programIds ?? [])],
    organizationUnitIds: [...(cycle.organizationUnitIds ?? [])],
    evidenceSetIds: [...(cycle.evidenceSetIds ?? [])],
    createdAt: cycle.createdAt,
    updatedAt: cycle.updatedAt,
  };
}

function toReviewWorkflowSnapshot(workflow) {
  return {
    id: workflow.id,
    reviewCycleId: workflow.reviewCycleId,
    institutionId: workflow.institutionId,
    targetType: workflow.targetType,
    targetId: workflow.targetId,
    reportSectionId: workflow.reportSectionId,
    evidenceCollectionId: workflow.evidenceCollectionId,
    evidenceItemIds: [...(workflow.evidenceItemIds ?? [])],
    state: workflow.state,
    transitionHistory: (workflow.transitionHistory ?? []).map((item) => ({
      id: item.id,
      workflowId: item.workflowId,
      sequence: item.sequence,
      fromState: item.fromState,
      toState: item.toState,
      actorRole: item.actorRole,
      reason: item.reason,
      evidenceSummary: item.evidenceSummary ?? null,
      transitionedAt: item.transitionedAt,
      createdAt: item.createdAt,
    })),
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
  };
}

export class SqliteReviewCycleRepository extends ReviewCycleRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(cycle) {
    if (!(cycle instanceof ReviewCycle)) {
      throw new ValidationError('ReviewCycleRepository.save expects a ReviewCycle aggregate instance');
    }
    const validated = ReviewCycle.rehydrate(toReviewCycleSnapshot(cycle));

    this.database.transaction(() => {
      const existing = this.database.get(
        `SELECT * FROM workflow_review_cycles WHERE id = @id`,
        { id: validated.id },
      );
      if (existing) {
        this.#assertIdentityUnchanged(existing, validated);
      }
      this.#assertSingleActiveScope(validated);

      this.database.run(
        `INSERT INTO workflow_review_cycles
           (id, institution_id, scope_key, name, start_date, end_date, status, program_ids_json, organization_unit_ids_json, evidence_set_ids_json, created_at, updated_at)
         VALUES
           (@id, @institutionId, @scopeKey, @name, @startDate, @endDate, @status, @programIdsJson, @organizationUnitIdsJson, @evidenceSetIdsJson, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           institution_id=excluded.institution_id,
           scope_key=excluded.scope_key,
           name=excluded.name,
           start_date=excluded.start_date,
           end_date=excluded.end_date,
           status=excluded.status,
           program_ids_json=excluded.program_ids_json,
           organization_unit_ids_json=excluded.organization_unit_ids_json,
           evidence_set_ids_json=excluded.evidence_set_ids_json,
           updated_at=excluded.updated_at`,
        {
          id: validated.id,
          institutionId: validated.institutionId,
          scopeKey: validated.scopeKey,
          name: validated.name,
          startDate: validated.startDate,
          endDate: validated.endDate,
          status: validated.status,
          programIdsJson: JSON.stringify(validated.programIds ?? []),
          organizationUnitIdsJson: JSON.stringify(validated.organizationUnitIds ?? []),
          evidenceSetIdsJson: JSON.stringify(validated.evidenceSetIds ?? []),
          createdAt: validated.createdAt,
          updatedAt: validated.updatedAt,
        },
      );
    });

    return validated;
  }

  async getById(id) {
    const row = this.database.get('SELECT * FROM workflow_review_cycles WHERE id = @id', { id });
    return row ? this.#rehydrateCycle(row) : null;
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      institutionId: 'institution_id',
      status: 'status',
      scopeKey: 'scope_key',
    });
    const rows = this.database.all(
      `SELECT * FROM workflow_review_cycles ${sql} ORDER BY created_at ASC`,
      params,
    );
    return rows.map((row) => this.#rehydrateCycle(row));
  }

  async getActiveByScope(institutionId, scopeKey) {
    const row = this.database.get(
      `SELECT * FROM workflow_review_cycles
       WHERE institution_id = @institutionId
         AND scope_key = @scopeKey
         AND status = @activeStatus
       LIMIT 1`,
      { institutionId, scopeKey, activeStatus: reviewCycleStatus.ACTIVE },
    );
    return row ? this.#rehydrateCycle(row) : null;
  }

  #rehydrateCycle(row) {
    return ReviewCycle.rehydrate({
      id: row.id,
      institutionId: row.institution_id,
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      programIds: parseJsonList(row.program_ids_json),
      organizationUnitIds: parseJsonList(row.organization_unit_ids_json),
      evidenceSetIds: parseJsonList(row.evidence_set_ids_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  #assertIdentityUnchanged(existing, next) {
    if (existing.institution_id !== next.institutionId || existing.created_at !== next.createdAt) {
      throw new ValidationError('ReviewCycle identity fields cannot be changed in-place');
    }
  }

  #assertSingleActiveScope(next) {
    if (next.status !== reviewCycleStatus.ACTIVE) {
      return;
    }
    const activeCycle = this.database.get(
      `SELECT id FROM workflow_review_cycles
       WHERE institution_id = @institutionId
         AND scope_key = @scopeKey
         AND status = @activeStatus
         AND id <> @id
       LIMIT 1`,
      {
        institutionId: next.institutionId,
        scopeKey: next.scopeKey,
        activeStatus: reviewCycleStatus.ACTIVE,
        id: next.id,
      },
    );
    if (activeCycle) {
      throw new ValidationError(
        `Only one active ReviewCycle is allowed per scope (existing: ${activeCycle.id})`,
      );
    }
  }
}

export class SqliteReviewWorkflowRepository extends ReviewWorkflowRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(workflow) {
    if (!(workflow instanceof ReviewWorkflow)) {
      throw new ValidationError('ReviewWorkflowRepository.save expects a ReviewWorkflow aggregate instance');
    }
    const validated = ReviewWorkflow.rehydrate(toReviewWorkflowSnapshot(workflow));

    this.database.transaction(() => {
      const existing = this.database.get(
        `SELECT * FROM workflow_review_workflows WHERE id = @id`,
        { id: validated.id },
      );
      if (existing) {
        this.#assertIdentityUnchanged(existing, validated);
        this.#assertTransitionHistoryAppendOnly(validated);
      }
      this.#assertCycleTargetUnique(validated);

      this.database.run(
        `INSERT INTO workflow_review_workflows
           (id, review_cycle_id, institution_id, target_type, target_id, report_section_id, evidence_collection_id, evidence_item_ids_json, state, created_at, updated_at)
         VALUES
           (@id, @reviewCycleId, @institutionId, @targetType, @targetId, @reportSectionId, @evidenceCollectionId, @evidenceItemIdsJson, @state, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           review_cycle_id=excluded.review_cycle_id,
           institution_id=excluded.institution_id,
           target_type=excluded.target_type,
           target_id=excluded.target_id,
           report_section_id=excluded.report_section_id,
           evidence_collection_id=excluded.evidence_collection_id,
           evidence_item_ids_json=excluded.evidence_item_ids_json,
           state=excluded.state,
           updated_at=excluded.updated_at`,
        {
          id: validated.id,
          reviewCycleId: validated.reviewCycleId,
          institutionId: validated.institutionId,
          targetType: validated.targetType,
          targetId: validated.targetId,
          reportSectionId: validated.reportSectionId,
          evidenceCollectionId: validated.evidenceCollectionId,
          evidenceItemIdsJson: JSON.stringify(validated.evidenceItemIds ?? []),
          state: validated.state,
          createdAt: validated.createdAt,
          updatedAt: validated.updatedAt,
        },
      );

      const persistedRows = this.database.all(
        `SELECT * FROM workflow_review_workflow_transitions WHERE workflow_id = @workflowId ORDER BY transition_sequence ASC`,
        { workflowId: validated.id },
      );
      const persistedById = new Map(persistedRows.map((row) => [row.id, row]));

      for (const entry of validated.transitionHistory ?? []) {
        const existingEntry = persistedById.get(entry.id);
        if (existingEntry) {
          this.#assertTransitionUnchanged(entry, existingEntry);
          continue;
        }
        this.database.run(
          `INSERT INTO workflow_review_workflow_transitions
             (id, workflow_id, transition_sequence, from_state, to_state, actor_role, reason, evidence_summary_json, transitioned_at, created_at)
           VALUES
             (@id, @workflowId, @sequence, @fromState, @toState, @actorRole, @reason, @evidenceSummaryJson, @transitionedAt, @createdAt)`,
          {
            id: entry.id,
            workflowId: entry.workflowId,
            sequence: entry.sequence,
            fromState: entry.fromState,
            toState: entry.toState,
            actorRole: entry.actorRole,
            reason: entry.reason,
            evidenceSummaryJson: entry.evidenceSummary ? JSON.stringify(entry.evidenceSummary) : null,
            transitionedAt: entry.transitionedAt,
            createdAt: entry.createdAt,
          },
        );
      }
    });

    return validated;
  }

  async getById(id) {
    const row = this.database.get('SELECT * FROM workflow_review_workflows WHERE id = @id', { id });
    if (!row) {
      return null;
    }
    return this.#rehydrateWorkflow(row);
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      reviewCycleId: 'review_cycle_id',
      institutionId: 'institution_id',
      state: 'state',
      targetType: 'target_type',
      targetId: 'target_id',
      reportSectionId: 'report_section_id',
      evidenceCollectionId: 'evidence_collection_id',
    });
    const rows = this.database.all(
      `SELECT * FROM workflow_review_workflows ${sql} ORDER BY created_at ASC`,
      params,
    );
    return rows.map((row) => this.#rehydrateWorkflow(row));
  }

  async getByCycleAndTarget(reviewCycleId, targetType, targetId) {
    const row = this.database.get(
      `SELECT * FROM workflow_review_workflows
       WHERE review_cycle_id = @reviewCycleId
         AND target_type = @targetType
         AND target_id = @targetId
       LIMIT 1`,
      { reviewCycleId, targetType, targetId },
    );
    return row ? this.#rehydrateWorkflow(row) : null;
  }

  #rehydrateWorkflow(row) {
    const transitionRows = this.database.all(
      `SELECT * FROM workflow_review_workflow_transitions
       WHERE workflow_id = @workflowId
       ORDER BY transition_sequence ASC`,
      { workflowId: row.id },
    );
    return ReviewWorkflow.rehydrate({
      id: row.id,
      reviewCycleId: row.review_cycle_id,
      institutionId: row.institution_id,
      targetType: row.target_type,
      targetId: row.target_id,
      reportSectionId: row.report_section_id,
      evidenceCollectionId: row.evidence_collection_id,
      evidenceItemIds: parseJsonList(row.evidence_item_ids_json),
      state: row.state,
      transitionHistory: transitionRows.map(
        (item) =>
           new WorkflowTransitionRecord({
            id: item.id,
            workflowId: item.workflow_id,
            sequence: item.transition_sequence,
            fromState: item.from_state,
            toState: item.to_state,
            actorRole: item.actor_role,
            reason: item.reason,
            evidenceSummary: item.evidence_summary_json ? JSON.parse(item.evidence_summary_json) : null,
            transitionedAt: item.transitioned_at,
            createdAt: item.created_at,
          }),
      ),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  #assertIdentityUnchanged(existing, next) {
    if (
      existing.review_cycle_id !== next.reviewCycleId ||
      existing.institution_id !== next.institutionId ||
      existing.target_type !== next.targetType ||
      existing.target_id !== next.targetId ||
      existing.created_at !== next.createdAt
    ) {
      throw new ValidationError('ReviewWorkflow identity fields cannot be changed in-place');
    }
  }

  #assertTransitionHistoryAppendOnly(next) {
    const persistedRows = this.database.all(
      `SELECT * FROM workflow_review_workflow_transitions WHERE workflow_id = @workflowId`,
      { workflowId: next.id },
    );
    const nextById = new Map((next.transitionHistory ?? []).map((entry) => [entry.id, entry]));
    for (const persisted of persistedRows) {
      const candidate = nextById.get(persisted.id);
      if (!candidate) {
        throw new ValidationError(`Workflow transition history is append-only: missing ${persisted.id}`);
      }
      this.#assertTransitionUnchanged(candidate, persisted);
    }
  }

  #assertTransitionUnchanged(current, persistedRow) {
    const persistedSummary = persistedRow.evidence_summary_json ? JSON.parse(persistedRow.evidence_summary_json) : null;
    if (
      current.workflowId !== persistedRow.workflow_id ||
      current.sequence !== persistedRow.transition_sequence ||
      current.fromState !== persistedRow.from_state ||
      current.toState !== persistedRow.to_state ||
      current.actorRole !== persistedRow.actor_role ||
      current.reason !== persistedRow.reason ||
      JSON.stringify(current.evidenceSummary ?? null) !== JSON.stringify(persistedSummary) ||
      current.transitionedAt !== persistedRow.transitioned_at
    ) {
      throw new ValidationError(`Workflow transition history is append-only: ${persistedRow.id} cannot be modified`);
    }
  }

  #assertCycleTargetUnique(next) {
    const duplicate = this.database.get(
      `SELECT id FROM workflow_review_workflows
       WHERE review_cycle_id = @reviewCycleId
         AND target_type = @targetType
         AND target_id = @targetId
         AND id <> @id
       LIMIT 1`,
      {
        reviewCycleId: next.reviewCycleId,
        targetType: next.targetType,
        targetId: next.targetId,
        id: next.id,
      },
    );
    if (duplicate) {
      throw new ValidationError(
        `ReviewWorkflow cycle-target must be unique (existing: ${duplicate.id})`,
      );
    }
  }
}
