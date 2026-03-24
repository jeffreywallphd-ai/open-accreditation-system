import { AccreditationCycleRepository } from '../../domain/repositories/repositories.js';
import { AccreditationCycle } from '../../domain/entities/accreditation-cycle.js';

function parseJson(value) {
  if (!value) {
    return [];
  }
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
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

export class SqliteAccreditationCycleRepository extends AccreditationCycleRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(cycle) {
    this.database.transaction(() => {
      this.database.run(
        `INSERT INTO accreditation_frameworks_cycles
         (id, framework_version_id, institution_id, name, cycle_start_date, cycle_end_date, status, created_at, updated_at)
         VALUES (@id, @frameworkVersionId, @institutionId, @name, @cycleStartDate, @cycleEndDate, @status, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           framework_version_id=excluded.framework_version_id, institution_id=excluded.institution_id, name=excluded.name,
           cycle_start_date=excluded.cycle_start_date, cycle_end_date=excluded.cycle_end_date, status=excluded.status, updated_at=excluded.updated_at`,
        {
          id: cycle.id,
          frameworkVersionId: cycle.frameworkVersionId,
          institutionId: cycle.institutionId,
          name: cycle.name,
          cycleStartDate: cycle.cycleStartDate,
          cycleEndDate: cycle.cycleEndDate,
          status: cycle.status,
          createdAt: cycle.createdAt,
          updatedAt: cycle.updatedAt,
        },
      );

      for (const scope of cycle.scopes) {
        this.database.run(
          `INSERT INTO accreditation_frameworks_scopes
           (id, accreditation_cycle_id, name, scope_type, description, status, program_ids_json, organization_unit_ids_json,
            effective_start_date, effective_end_date, scope_order, created_at, updated_at)
           VALUES (@id, @accreditationCycleId, @name, @scopeType, @description, @status, @programIdsJson, @organizationUnitIdsJson,
            @effectiveStartDate, @effectiveEndDate, @scopeOrder, @createdAt, @updatedAt)
           ON CONFLICT(id) DO UPDATE SET
             accreditation_cycle_id=excluded.accreditation_cycle_id, name=excluded.name, scope_type=excluded.scope_type,
             description=excluded.description, status=excluded.status, program_ids_json=excluded.program_ids_json,
             organization_unit_ids_json=excluded.organization_unit_ids_json, effective_start_date=excluded.effective_start_date,
             effective_end_date=excluded.effective_end_date, scope_order=excluded.scope_order, updated_at=excluded.updated_at`,
          {
            id: scope.id,
            accreditationCycleId: scope.accreditationCycleId,
            name: scope.name,
            scopeType: scope.scopeType,
            description: scope.description,
            status: scope.status,
            programIdsJson: JSON.stringify(scope.programIds),
            organizationUnitIdsJson: JSON.stringify(scope.organizationUnitIds),
            effectiveStartDate: scope.effectiveStartDate,
            effectiveEndDate: scope.effectiveEndDate,
            scopeOrder: scope.scopeOrder,
            createdAt: scope.createdAt,
            updatedAt: scope.updatedAt,
          },
        );

        for (const scopeProgram of scope.scopePrograms ?? []) {
          this.database.run(
            `INSERT INTO accreditation_frameworks_scope_programs
             (id, accreditation_scope_id, program_id, created_at, updated_at)
             VALUES (@id, @accreditationScopeId, @programId, @createdAt, @updatedAt)
             ON CONFLICT(id) DO UPDATE SET
               accreditation_scope_id=excluded.accreditation_scope_id, program_id=excluded.program_id, updated_at=excluded.updated_at`,
            {
              id: scopeProgram.id,
              accreditationScopeId: scopeProgram.accreditationScopeId,
              programId: scopeProgram.programId,
              createdAt: scopeProgram.createdAt,
              updatedAt: scopeProgram.updatedAt,
            },
          );
        }

        for (const scopeOrganizationUnit of scope.scopeOrganizationUnits ?? []) {
          this.database.run(
            `INSERT INTO accreditation_frameworks_scope_organization_units
             (id, accreditation_scope_id, organization_unit_id, created_at, updated_at)
             VALUES (@id, @accreditationScopeId, @organizationUnitId, @createdAt, @updatedAt)
             ON CONFLICT(id) DO UPDATE SET
               accreditation_scope_id=excluded.accreditation_scope_id, organization_unit_id=excluded.organization_unit_id, updated_at=excluded.updated_at`,
            {
              id: scopeOrganizationUnit.id,
              accreditationScopeId: scopeOrganizationUnit.accreditationScopeId,
              organizationUnitId: scopeOrganizationUnit.organizationUnitId,
              createdAt: scopeOrganizationUnit.createdAt,
              updatedAt: scopeOrganizationUnit.updatedAt,
            },
          );
        }
      }

      for (const milestone of cycle.milestones) {
        this.database.run(
          `INSERT INTO accreditation_frameworks_cycle_milestones
           (id, accreditation_cycle_id, name, milestone_type, due_date, status, scope_id, created_at, updated_at)
           VALUES (@id, @accreditationCycleId, @name, @milestoneType, @dueDate, @status, @scopeId, @createdAt, @updatedAt)
           ON CONFLICT(id) DO UPDATE SET
             accreditation_cycle_id=excluded.accreditation_cycle_id, name=excluded.name, milestone_type=excluded.milestone_type,
             due_date=excluded.due_date, status=excluded.status, scope_id=excluded.scope_id, updated_at=excluded.updated_at`,
          {
            id: milestone.id,
            accreditationCycleId: milestone.accreditationCycleId,
            name: milestone.name,
            milestoneType: milestone.milestoneType,
            dueDate: milestone.dueDate,
            status: milestone.status,
            scopeId: milestone.scopeId,
            createdAt: milestone.createdAt,
            updatedAt: milestone.updatedAt,
          },
        );
      }

      for (const reportingPeriod of cycle.reportingPeriods ?? []) {
        this.database.run(
          `INSERT INTO accreditation_frameworks_reporting_periods
           (id, accreditation_cycle_id, name, period_type, start_date, end_date, status, scope_id, created_at, updated_at)
           VALUES (@id, @accreditationCycleId, @name, @periodType, @startDate, @endDate, @status, @scopeId, @createdAt, @updatedAt)
           ON CONFLICT(id) DO UPDATE SET
             accreditation_cycle_id=excluded.accreditation_cycle_id, name=excluded.name, period_type=excluded.period_type,
             start_date=excluded.start_date, end_date=excluded.end_date, status=excluded.status, scope_id=excluded.scope_id,
             updated_at=excluded.updated_at`,
          {
            id: reportingPeriod.id,
            accreditationCycleId: reportingPeriod.accreditationCycleId,
            name: reportingPeriod.name,
            periodType: reportingPeriod.periodType,
            startDate: reportingPeriod.startDate,
            endDate: reportingPeriod.endDate,
            status: reportingPeriod.status,
            scopeId: reportingPeriod.scopeId,
            createdAt: reportingPeriod.createdAt,
            updatedAt: reportingPeriod.updatedAt,
          },
        );
      }

      for (const reviewEvent of cycle.reviewEvents) {
        this.database.run(
          `INSERT INTO accreditation_frameworks_review_events
           (id, accreditation_cycle_id, review_team_id, scope_id, name, event_type, start_date, end_date, status, created_at, updated_at)
           VALUES (@id, @accreditationCycleId, @reviewTeamId, @scopeId, @name, @eventType, @startDate, @endDate, @status, @createdAt, @updatedAt)
           ON CONFLICT(id) DO UPDATE SET
             accreditation_cycle_id=excluded.accreditation_cycle_id, review_team_id=excluded.review_team_id, scope_id=excluded.scope_id,
             name=excluded.name, event_type=excluded.event_type, start_date=excluded.start_date, end_date=excluded.end_date,
             status=excluded.status, updated_at=excluded.updated_at`,
          {
            id: reviewEvent.id,
            accreditationCycleId: reviewEvent.accreditationCycleId,
            reviewTeamId: reviewEvent.reviewTeamId,
            scopeId: reviewEvent.scopeId,
            name: reviewEvent.name,
            eventType: reviewEvent.eventType,
            startDate: reviewEvent.startDate,
            endDate: reviewEvent.endDate,
            status: reviewEvent.status,
            createdAt: reviewEvent.createdAt,
            updatedAt: reviewEvent.updatedAt,
          },
        );
      }

      for (const decision of cycle.decisionRecords) {
        this.database.run(
          `INSERT INTO accreditation_frameworks_decision_records
           (id, accreditation_cycle_id, review_event_id, decision_type, outcome, rationale, issued_at, status,
            supersedes_decision_record_id, superseded_by_decision_record_id, created_at, updated_at)
           VALUES (@id, @accreditationCycleId, @reviewEventId, @decisionType, @outcome, @rationale, @issuedAt, @status,
            @supersedesDecisionRecordId, @supersededByDecisionRecordId, @createdAt, @updatedAt)
           ON CONFLICT(id) DO UPDATE SET
             accreditation_cycle_id=excluded.accreditation_cycle_id, review_event_id=excluded.review_event_id,
             decision_type=excluded.decision_type, outcome=excluded.outcome, rationale=excluded.rationale,
             issued_at=excluded.issued_at, status=excluded.status,
             supersedes_decision_record_id=excluded.supersedes_decision_record_id,
             superseded_by_decision_record_id=excluded.superseded_by_decision_record_id, updated_at=excluded.updated_at`,
          {
            id: decision.id,
            accreditationCycleId: decision.accreditationCycleId,
            reviewEventId: decision.reviewEventId,
            decisionType: decision.decisionType,
            outcome: decision.outcome,
            rationale: decision.rationale,
            issuedAt: decision.issuedAt,
            status: decision.status,
            supersedesDecisionRecordId: decision.supersedesDecisionRecordId,
            supersededByDecisionRecordId: decision.supersededByDecisionRecordId,
            createdAt: decision.createdAt,
            updatedAt: decision.updatedAt,
          },
        );
      }
    });
    return cycle;
  }

  async getById(id) {
    const row = this.database.get('SELECT * FROM accreditation_frameworks_cycles WHERE id = @id', { id });
    return row ? this.#map(row) : null;
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      frameworkVersionId: 'framework_version_id',
      institutionId: 'institution_id',
      status: 'status',
      name: 'name',
    });
    const rows = this.database.all(`SELECT * FROM accreditation_frameworks_cycles ${sql} ORDER BY created_at ASC`, params);
    return rows.map((row) => this.#map(row));
  }

  #map(row) {
    const scopes = this.database.all(
      'SELECT * FROM accreditation_frameworks_scopes WHERE accreditation_cycle_id = @id ORDER BY scope_order ASC, created_at ASC',
      { id: row.id },
    );
    const milestones = this.database.all(
      'SELECT * FROM accreditation_frameworks_cycle_milestones WHERE accreditation_cycle_id = @id ORDER BY due_date ASC, created_at ASC',
      { id: row.id },
    );
    const reportingPeriods = this.database.all(
      'SELECT * FROM accreditation_frameworks_reporting_periods WHERE accreditation_cycle_id = @id ORDER BY start_date ASC, created_at ASC',
      { id: row.id },
    );
    const events = this.database.all(
      'SELECT * FROM accreditation_frameworks_review_events WHERE accreditation_cycle_id = @id ORDER BY start_date ASC, created_at ASC',
      { id: row.id },
    );
    const decisions = this.database.all(
      'SELECT * FROM accreditation_frameworks_decision_records WHERE accreditation_cycle_id = @id ORDER BY issued_at ASC, created_at ASC',
      { id: row.id },
    );

    return new AccreditationCycle({
      id: row.id,
      frameworkVersionId: row.framework_version_id,
      institutionId: row.institution_id,
      name: row.name,
      cycleStartDate: row.cycle_start_date,
      cycleEndDate: row.cycle_end_date,
      status: row.status,
      scopes: scopes.map((item) => {
        const scopePrograms = this.database.all(
          `SELECT * FROM accreditation_frameworks_scope_programs
           WHERE accreditation_scope_id = @scopeId
           ORDER BY created_at ASC`,
          { scopeId: item.id },
        );
        const scopeOrganizationUnits = this.database.all(
          `SELECT * FROM accreditation_frameworks_scope_organization_units
           WHERE accreditation_scope_id = @scopeId
           ORDER BY created_at ASC`,
          { scopeId: item.id },
        );

        return {
          id: item.id,
          accreditationCycleId: item.accreditation_cycle_id,
          name: item.name,
          scopeType: item.scope_type,
          description: item.description,
          status: item.status,
          scopePrograms: scopePrograms.map((scopeProgram) => ({
            id: scopeProgram.id,
            accreditationScopeId: scopeProgram.accreditation_scope_id,
            programId: scopeProgram.program_id,
            createdAt: scopeProgram.created_at,
            updatedAt: scopeProgram.updated_at,
          })),
          scopeOrganizationUnits: scopeOrganizationUnits.map((scopeOrganizationUnit) => ({
            id: scopeOrganizationUnit.id,
            accreditationScopeId: scopeOrganizationUnit.accreditation_scope_id,
            organizationUnitId: scopeOrganizationUnit.organization_unit_id,
            createdAt: scopeOrganizationUnit.created_at,
            updatedAt: scopeOrganizationUnit.updated_at,
          })),
          programIds: parseJson(item.program_ids_json),
          organizationUnitIds: parseJson(item.organization_unit_ids_json),
          effectiveStartDate: item.effective_start_date,
          effectiveEndDate: item.effective_end_date,
          scopeOrder: item.scope_order,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        };
      }),
      milestones: milestones.map((item) => ({
        id: item.id,
        accreditationCycleId: item.accreditation_cycle_id,
        name: item.name,
        milestoneType: item.milestone_type,
        dueDate: item.due_date,
        status: item.status,
        scopeId: item.scope_id,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
      reportingPeriods: reportingPeriods.map((item) => ({
        id: item.id,
        accreditationCycleId: item.accreditation_cycle_id,
        name: item.name,
        periodType: item.period_type,
        startDate: item.start_date,
        endDate: item.end_date,
        status: item.status,
        scopeId: item.scope_id,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
      reviewEvents: events.map((item) => ({
        id: item.id,
        accreditationCycleId: item.accreditation_cycle_id,
        reviewTeamId: item.review_team_id,
        scopeId: item.scope_id,
        name: item.name,
        eventType: item.event_type,
        startDate: item.start_date,
        endDate: item.end_date,
        status: item.status,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
      decisionRecords: decisions.map((item) => ({
        id: item.id,
        accreditationCycleId: item.accreditation_cycle_id,
        reviewEventId: item.review_event_id,
        decisionType: item.decision_type,
        outcome: item.outcome,
        rationale: item.rationale,
        issuedAt: item.issued_at,
        status: item.status,
        supersedesDecisionRecordId: item.supersedes_decision_record_id,
        supersededByDecisionRecordId: item.superseded_by_decision_record_id,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
