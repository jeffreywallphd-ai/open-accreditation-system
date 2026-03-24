import {
  InstitutionRepository,
  PersonRepository,
  OrganizationUnitRepository,
  CommitteeRepository,
} from '../../domain/repositories/repositories.js';
import { Institution } from '../../domain/entities/institution.js';
import { Person } from '../../domain/entities/person.js';
import { OrganizationUnit } from '../../domain/entities/organization-unit.js';
import { Committee } from '../../domain/entities/committee.js';

function toBoolean(value) {
  return value === 1;
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

  return {
    sql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

export class SqliteInstitutionRepository extends InstitutionRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(institution) {
    this.database.run(
      `
        INSERT INTO organization_registry_institutions (
          id, name, code, timezone, status,
          effective_start_date, effective_end_date, created_at, updated_at
        )
        VALUES (
          @id, @name, @code, @timezone, @status,
          @effectiveStartDate, @effectiveEndDate, @createdAt, @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          code = excluded.code,
          timezone = excluded.timezone,
          status = excluded.status,
          effective_start_date = excluded.effective_start_date,
          effective_end_date = excluded.effective_end_date,
          updated_at = excluded.updated_at
      `,
      {
        id: institution.id,
        name: institution.name,
        code: institution.code,
        timezone: institution.timezone,
        status: institution.status,
        effectiveStartDate: institution.effectiveStartDate,
        effectiveEndDate: institution.effectiveEndDate,
        createdAt: institution.createdAt,
        updatedAt: institution.updatedAt,
      },
    );

    return institution;
  }

  async getById(id) {
    const row = this.database.get(
      `
        SELECT *
        FROM organization_registry_institutions
        WHERE id = @id
      `,
      { id },
    );

    return row ? this.#map(row) : null;
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      name: 'name',
      code: 'code',
      status: 'status',
    });

    const rows = this.database.all(
      `
        SELECT *
        FROM organization_registry_institutions
        ${sql}
        ORDER BY created_at ASC
      `,
      params,
    );

    return rows.map((row) => this.#map(row));
  }

  #map(row) {
    return new Institution({
      id: row.id,
      name: row.name,
      code: row.code,
      timezone: row.timezone,
      status: row.status,
      effectiveStartDate: row.effective_start_date,
      effectiveEndDate: row.effective_end_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

export class SqlitePersonRepository extends PersonRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(person) {
    this.database.run(
      `
        INSERT INTO organization_registry_people (
          id, institution_id, preferred_name, legal_name, display_name,
          primary_email, secondary_email, person_status, employee_like_indicator,
          external_reference_summary, match_confidence_notes,
          effective_start_date, effective_end_date, created_at, updated_at
        )
        VALUES (
          @id, @institutionId, @preferredName, @legalName, @displayName,
          @primaryEmail, @secondaryEmail, @personStatus, @employeeLikeIndicator,
          @externalReferenceSummary, @matchConfidenceNotes,
          @effectiveStartDate, @effectiveEndDate, @createdAt, @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          institution_id = excluded.institution_id,
          preferred_name = excluded.preferred_name,
          legal_name = excluded.legal_name,
          display_name = excluded.display_name,
          primary_email = excluded.primary_email,
          secondary_email = excluded.secondary_email,
          person_status = excluded.person_status,
          employee_like_indicator = excluded.employee_like_indicator,
          external_reference_summary = excluded.external_reference_summary,
          match_confidence_notes = excluded.match_confidence_notes,
          effective_start_date = excluded.effective_start_date,
          effective_end_date = excluded.effective_end_date,
          updated_at = excluded.updated_at
      `,
      {
        id: person.id,
        institutionId: person.institutionId,
        preferredName: person.preferredName,
        legalName: person.legalName,
        displayName: person.displayName,
        primaryEmail: person.primaryEmail,
        secondaryEmail: person.secondaryEmail,
        personStatus: person.personStatus,
        employeeLikeIndicator: person.employeeLikeIndicator ? 1 : 0,
        externalReferenceSummary: person.externalReferenceSummary,
        matchConfidenceNotes: person.matchConfidenceNotes,
        effectiveStartDate: person.effectiveStartDate,
        effectiveEndDate: person.effectiveEndDate,
        createdAt: person.createdAt,
        updatedAt: person.updatedAt,
      },
    );

    return person;
  }

  async getById(id) {
    const row = this.database.get(
      `
        SELECT *
        FROM organization_registry_people
        WHERE id = @id
      `,
      { id },
    );

    return row ? this.#map(row) : null;
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      institutionId: 'institution_id',
      displayName: 'display_name',
      personStatus: 'person_status',
      primaryEmail: 'primary_email',
    });

    const rows = this.database.all(
      `
        SELECT *
        FROM organization_registry_people
        ${sql}
        ORDER BY created_at ASC
      `,
      params,
    );

    return rows.map((row) => this.#map(row));
  }

  async isReferenced(id) {
    const row = this.database.get(
      `
        SELECT person_id
        FROM organization_registry_person_references
        WHERE person_id = @id
      `,
      { id },
    );

    return !!row;
  }

  async trackReference(id) {
    this.database.run(
      `
        INSERT INTO organization_registry_person_references (person_id, created_at)
        VALUES (@id, @createdAt)
        ON CONFLICT(person_id) DO NOTHING
      `,
      {
        id,
        createdAt: new Date().toISOString(),
      },
    );
  }

  #map(row) {
    return new Person({
      id: row.id,
      institutionId: row.institution_id,
      preferredName: row.preferred_name,
      legalName: row.legal_name,
      displayName: row.display_name,
      primaryEmail: row.primary_email,
      secondaryEmail: row.secondary_email,
      personStatus: row.person_status,
      employeeLikeIndicator: toBoolean(row.employee_like_indicator),
      externalReferenceSummary: row.external_reference_summary,
      matchConfidenceNotes: row.match_confidence_notes,
      effectiveStartDate: row.effective_start_date,
      effectiveEndDate: row.effective_end_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

export class SqliteOrganizationUnitRepository extends OrganizationUnitRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(unit) {
    this.database.run(
      `
        INSERT INTO organization_registry_organization_units (
          id, institution_id, name, code, unit_type, parent_unit_id,
          status, effective_start_date, effective_end_date, created_at, updated_at
        )
        VALUES (
          @id, @institutionId, @name, @code, @unitType, @parentUnitId,
          @status, @effectiveStartDate, @effectiveEndDate, @createdAt, @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          institution_id = excluded.institution_id,
          name = excluded.name,
          code = excluded.code,
          unit_type = excluded.unit_type,
          parent_unit_id = excluded.parent_unit_id,
          status = excluded.status,
          effective_start_date = excluded.effective_start_date,
          effective_end_date = excluded.effective_end_date,
          updated_at = excluded.updated_at
      `,
      {
        id: unit.id,
        institutionId: unit.institutionId,
        name: unit.name,
        code: unit.code,
        unitType: unit.unitType,
        parentUnitId: unit.parentUnitId,
        status: unit.status,
        effectiveStartDate: unit.effectiveStartDate,
        effectiveEndDate: unit.effectiveEndDate,
        createdAt: unit.createdAt,
        updatedAt: unit.updatedAt,
      },
    );

    return unit;
  }

  async getById(id) {
    const row = this.database.get(
      `
        SELECT *
        FROM organization_registry_organization_units
        WHERE id = @id
      `,
      { id },
    );

    return row ? this.#map(row) : null;
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      institutionId: 'institution_id',
      unitType: 'unit_type',
      parentUnitId: 'parent_unit_id',
      status: 'status',
      name: 'name',
    });

    const rows = this.database.all(
      `
        SELECT *
        FROM organization_registry_organization_units
        ${sql}
        ORDER BY created_at ASC
      `,
      params,
    );

    return rows.map((row) => this.#map(row));
  }

  async findByInstitutionId(institutionId) {
    const rows = this.database.all(
      `
        SELECT *
        FROM organization_registry_organization_units
        WHERE institution_id = @institutionId
        ORDER BY created_at ASC
      `,
      { institutionId },
    );

    return rows.map((row) => this.#map(row));
  }

  #map(row) {
    return new OrganizationUnit({
      id: row.id,
      institutionId: row.institution_id,
      name: row.name,
      code: row.code,
      unitType: row.unit_type,
      parentUnitId: row.parent_unit_id,
      status: row.status,
      effectiveStartDate: row.effective_start_date,
      effectiveEndDate: row.effective_end_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}

export class SqliteCommitteeRepository extends CommitteeRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(committee) {
    this.database.run(
      `
        INSERT INTO organization_registry_committees (
          id, institution_id, name, code, sponsoring_unit_id,
          charter_summary, status, effective_start_date, effective_end_date,
          created_at, updated_at
        )
        VALUES (
          @id, @institutionId, @name, @code, @sponsoringUnitId,
          @charterSummary, @status, @effectiveStartDate, @effectiveEndDate,
          @createdAt, @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          institution_id = excluded.institution_id,
          name = excluded.name,
          code = excluded.code,
          sponsoring_unit_id = excluded.sponsoring_unit_id,
          charter_summary = excluded.charter_summary,
          status = excluded.status,
          effective_start_date = excluded.effective_start_date,
          effective_end_date = excluded.effective_end_date,
          updated_at = excluded.updated_at
      `,
      {
        id: committee.id,
        institutionId: committee.institutionId,
        name: committee.name,
        code: committee.code,
        sponsoringUnitId: committee.sponsoringUnitId,
        charterSummary: committee.charterSummary,
        status: committee.status,
        effectiveStartDate: committee.effectiveStartDate,
        effectiveEndDate: committee.effectiveEndDate,
        createdAt: committee.createdAt,
        updatedAt: committee.updatedAt,
      },
    );

    return committee;
  }

  async getById(id) {
    const row = this.database.get(
      `
        SELECT *
        FROM organization_registry_committees
        WHERE id = @id
      `,
      { id },
    );

    return row ? this.#map(row) : null;
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      institutionId: 'institution_id',
      sponsoringUnitId: 'sponsoring_unit_id',
      status: 'status',
      name: 'name',
    });

    const rows = this.database.all(
      `
        SELECT *
        FROM organization_registry_committees
        ${sql}
        ORDER BY created_at ASC
      `,
      params,
    );

    return rows.map((row) => this.#map(row));
  }

  #map(row) {
    return new Committee({
      id: row.id,
      institutionId: row.institution_id,
      name: row.name,
      code: row.code,
      sponsoringUnitId: row.sponsoring_unit_id,
      charterSummary: row.charter_summary,
      status: row.status,
      effectiveStartDate: row.effective_start_date,
      effectiveEndDate: row.effective_end_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
