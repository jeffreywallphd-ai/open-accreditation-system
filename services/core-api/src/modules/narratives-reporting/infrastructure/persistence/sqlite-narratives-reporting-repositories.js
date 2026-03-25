import { ValidationError } from '../../../shared/kernel/errors.js';
import { Narrative } from '../../domain/entities/narrative.js';
import { SubmissionPackageRepository, NarrativeRepository } from '../../domain/repositories/repositories.js';
import { SubmissionPackage } from '../../domain/entities/submission-package.js';
import { narrativeStatus } from '../../domain/value-objects/narrative-statuses.js';
import { submissionPackageStatus } from '../../domain/value-objects/submission-package-statuses.js';

function parseJsonList(raw) {
  if (!raw) {
    return [];
  }
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function parseJsonObject(raw) {
  if (!raw) {
    return null;
  }
  return JSON.parse(raw);
}

function toSnapshot(submissionPackage) {
  return {
    id: submissionPackage.id,
    institutionId: submissionPackage.institutionId,
    reviewCycleId: submissionPackage.reviewCycleId,
    scopeType: submissionPackage.scopeType,
    scopeId: submissionPackage.scopeId,
    name: submissionPackage.name,
    status: submissionPackage.status,
    finalizedAt: submissionPackage.finalizedAt,
    items: (submissionPackage.items ?? []).map((item) => ({
      id: item.id,
      packageId: item.packageId,
      sequence: item.sequence,
      itemType: item.itemType,
      assemblyRole: item.assemblyRole,
      targetType: item.targetType,
      targetId: item.targetId,
      workflowId: item.workflowId,
      sectionKey: item.sectionKey,
      sectionTitle: item.sectionTitle,
      parentSectionKey: item.parentSectionKey,
      sectionType: item.sectionType,
      evidenceItemIds: [...(item.evidenceItemIds ?? [])],
      label: item.label,
      rationale: item.rationale,
      metadata: item.metadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    snapshots: (submissionPackage.snapshots ?? []).map((snapshot) => ({
      id: snapshot.id,
      packageId: snapshot.packageId,
      versionNumber: snapshot.versionNumber,
      milestoneLabel: snapshot.milestoneLabel,
      actorId: snapshot.actorId,
      notes: snapshot.notes,
      finalized: snapshot.finalized,
      createdAt: snapshot.createdAt,
      items: (snapshot.items ?? []).map((item) => ({
        id: item.id,
        snapshotId: item.snapshotId,
        packageItemId: item.packageItemId,
        sequence: item.sequence,
        itemType: item.itemType,
        assemblyRole: item.assemblyRole,
        targetType: item.targetType,
        targetId: item.targetId,
        workflowId: item.workflowId,
        sectionKey: item.sectionKey,
        sectionTitle: item.sectionTitle,
        parentSectionKey: item.parentSectionKey,
        sectionType: item.sectionType,
        evidenceItemIds: [...(item.evidenceItemIds ?? [])],
        label: item.label,
        rationale: item.rationale,
        metadata: item.metadata,
        createdAt: item.createdAt,
      })),
    })),
    createdAt: submissionPackage.createdAt,
    updatedAt: submissionPackage.updatedAt,
  };
}

function toNarrativeSnapshot(narrative) {
  return {
    id: narrative.id,
    institutionId: narrative.institutionId,
    reviewCycleId: narrative.reviewCycleId,
    submissionPackageId: narrative.submissionPackageId,
    title: narrative.title,
    status: narrative.status,
    sections: (narrative.sections ?? []).map((section) => ({
      id: section.id,
      narrativeId: section.narrativeId,
      sequence: section.sequence,
      sectionType: section.sectionType,
      sectionKey: section.sectionKey,
      parentSectionKey: section.parentSectionKey,
      title: section.title,
      content: section.content,
      ownerId: section.ownerId,
      evidenceLinks: (section.evidenceLinks ?? []).map((link) => ({
        id: link.id,
        sectionId: link.sectionId,
        evidenceItemId: link.evidenceItemId,
        relationshipType: link.relationshipType,
        rationale: link.rationale,
        createdAt: link.createdAt,
      })),
      packageLinks: (section.packageLinks ?? []).map((link) => ({
        id: link.id,
        sectionId: link.sectionId,
        submissionPackageItemId: link.submissionPackageItemId,
        linkType: link.linkType,
        createdAt: link.createdAt,
      })),
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    })),
    createdAt: narrative.createdAt,
    updatedAt: narrative.updatedAt,
    submittedForReviewAt: narrative.submittedForReviewAt,
    finalizedAt: narrative.finalizedAt,
  };
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

export class SqliteSubmissionPackageRepository extends SubmissionPackageRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(submissionPackage) {
    if (!(submissionPackage instanceof SubmissionPackage)) {
      throw new ValidationError('SubmissionPackageRepository.save expects a SubmissionPackage aggregate instance');
    }

    const validated = SubmissionPackage.rehydrate(toSnapshot(submissionPackage));

    this.database.transaction(() => {
      const existing = this.database.get(
        'SELECT * FROM narratives_submission_packages WHERE id = @id',
        { id: validated.id },
      );
      if (existing) {
        this.#assertIdentityUnchanged(existing, validated);
        this.#assertSnapshotHistoryAppendOnly(validated);
        if (existing.status === submissionPackageStatus.FINALIZED) {
          this.#assertItemsUnchanged(validated);
        }
      }
      this.#assertScopeUniqueness(validated);

      this.database.run(
        `INSERT INTO narratives_submission_packages
          (id, institution_id, review_cycle_id, scope_type, scope_id, name, status, finalized_at, created_at, updated_at)
         VALUES
          (@id, @institutionId, @reviewCycleId, @scopeType, @scopeId, @name, @status, @finalizedAt, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           institution_id=excluded.institution_id,
           review_cycle_id=excluded.review_cycle_id,
           scope_type=excluded.scope_type,
           scope_id=excluded.scope_id,
           name=excluded.name,
           status=excluded.status,
           finalized_at=excluded.finalized_at,
           updated_at=excluded.updated_at`,
        {
          id: validated.id,
          institutionId: validated.institutionId,
          reviewCycleId: validated.reviewCycleId,
          scopeType: validated.scopeType,
          scopeId: validated.scopeId,
          name: validated.name,
          status: validated.status,
          finalizedAt: validated.finalizedAt,
          createdAt: validated.createdAt,
          updatedAt: validated.updatedAt,
        },
      );

      this.database.run(
        'DELETE FROM narratives_submission_package_items WHERE package_id = @packageId',
        { packageId: validated.id },
      );
      for (const item of validated.items) {
        this.database.run(
          `INSERT INTO narratives_submission_package_items
            (id, package_id, item_sequence, item_type, assembly_role, target_type, target_id, workflow_id, section_key, section_title, parent_section_key, section_type, evidence_item_ids_json, label, rationale, metadata_json, created_at, updated_at)
           VALUES
            (@id, @packageId, @sequence, @itemType, @assemblyRole, @targetType, @targetId, @workflowId, @sectionKey, @sectionTitle, @parentSectionKey, @sectionType, @evidenceItemIdsJson, @label, @rationale, @metadataJson, @createdAt, @updatedAt)`,
          {
            id: item.id,
            packageId: item.packageId,
            sequence: item.sequence,
            itemType: item.itemType,
            assemblyRole: item.assemblyRole,
            targetType: item.targetType,
            targetId: item.targetId,
            workflowId: item.workflowId,
            sectionKey: item.sectionKey,
            sectionTitle: item.sectionTitle,
            parentSectionKey: item.parentSectionKey,
            sectionType: item.sectionType,
            evidenceItemIdsJson: JSON.stringify(item.evidenceItemIds ?? []),
            label: item.label,
            rationale: item.rationale,
            metadataJson: item.metadata ? JSON.stringify(item.metadata) : null,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          },
        );
      }

      const persistedSnapshots = this.database.all(
        'SELECT * FROM narratives_submission_package_snapshots WHERE package_id = @packageId',
        { packageId: validated.id },
      );
      const persistedSnapshotById = new Map(persistedSnapshots.map((row) => [row.id, row]));

      for (const snapshot of validated.snapshots) {
        const existingSnapshot = persistedSnapshotById.get(snapshot.id);
        if (existingSnapshot) {
          this.#assertSnapshotUnchanged(existingSnapshot, snapshot);
          continue;
        }

        this.database.run(
          `INSERT INTO narratives_submission_package_snapshots
            (id, package_id, version_number, milestone_label, actor_id, notes, is_finalized, created_at)
           VALUES
            (@id, @packageId, @versionNumber, @milestoneLabel, @actorId, @notes, @isFinalized, @createdAt)`,
          {
            id: snapshot.id,
            packageId: snapshot.packageId,
            versionNumber: snapshot.versionNumber,
            milestoneLabel: snapshot.milestoneLabel,
            actorId: snapshot.actorId,
            notes: snapshot.notes,
            isFinalized: snapshot.finalized ? 1 : 0,
            createdAt: snapshot.createdAt,
          },
        );

        for (const item of snapshot.items) {
          this.database.run(
            `INSERT INTO narratives_submission_snapshot_items
              (id, snapshot_id, package_item_id, item_sequence, item_type, assembly_role, target_type, target_id, workflow_id, section_key, section_title, parent_section_key, section_type, evidence_item_ids_json, label, rationale, metadata_json, created_at)
             VALUES
              (@id, @snapshotId, @packageItemId, @sequence, @itemType, @assemblyRole, @targetType, @targetId, @workflowId, @sectionKey, @sectionTitle, @parentSectionKey, @sectionType, @evidenceItemIdsJson, @label, @rationale, @metadataJson, @createdAt)`,
            {
              id: item.id,
              snapshotId: item.snapshotId,
              packageItemId: item.packageItemId,
              sequence: item.sequence,
              itemType: item.itemType,
              assemblyRole: item.assemblyRole,
              targetType: item.targetType,
              targetId: item.targetId,
              workflowId: item.workflowId,
              sectionKey: item.sectionKey,
              sectionTitle: item.sectionTitle,
              parentSectionKey: item.parentSectionKey,
              sectionType: item.sectionType,
              evidenceItemIdsJson: JSON.stringify(item.evidenceItemIds ?? []),
              label: item.label,
              rationale: item.rationale,
              metadataJson: item.metadata ? JSON.stringify(item.metadata) : null,
              createdAt: item.createdAt,
            },
          );
        }
      }
    });

    return validated;
  }

  async getById(id) {
    const row = this.database.get('SELECT * FROM narratives_submission_packages WHERE id = @id', { id });
    if (!row) {
      return null;
    }
    return this.#rehydrate(row);
  }

  async findByFilter(filter = {}) {
    let sql = `SELECT p.* FROM narratives_submission_packages p`;
    const params = {};
    const where = [];

    const rootFilters = filterClause(filter, {
      id: 'p.id',
      institutionId: 'p.institution_id',
      reviewCycleId: 'p.review_cycle_id',
      scopeType: 'p.scope_type',
      scopeId: 'p.scope_id',
      status: 'p.status',
    });
    if (rootFilters.sql) {
      where.push(rootFilters.sql.replace(/^WHERE\s+/i, ''));
      Object.assign(params, rootFilters.params);
    }

    if (filter.assemblyRole) {
      where.push(
        `EXISTS (
          SELECT 1
          FROM narratives_submission_package_items i
          WHERE i.package_id = p.id
            AND i.assembly_role = @assemblyRole
        )`,
      );
      params.assemblyRole = filter.assemblyRole;
    }

    if (where.length > 0) {
      sql += ` WHERE ${where.join(' AND ')}`;
    }
    sql += ' ORDER BY p.created_at ASC';

    const rows = this.database.all(sql, params);
    return rows.map((row) => this.#rehydrate(row));
  }

  async getByCycleAndScope(reviewCycleId, scopeType, scopeId) {
    const row = this.database.get(
      `SELECT * FROM narratives_submission_packages
       WHERE review_cycle_id = @reviewCycleId
         AND scope_type = @scopeType
         AND scope_id = @scopeId
       LIMIT 1`,
      { reviewCycleId, scopeType, scopeId },
    );
    return row ? this.#rehydrate(row) : null;
  }

  #rehydrate(row) {
    const items = this.database.all(
      `SELECT * FROM narratives_submission_package_items
       WHERE package_id = @packageId
       ORDER BY item_sequence ASC`,
      { packageId: row.id },
    );
    const snapshots = this.database.all(
      `SELECT * FROM narratives_submission_package_snapshots
       WHERE package_id = @packageId
       ORDER BY version_number ASC`,
      { packageId: row.id },
    );

    return SubmissionPackage.rehydrate({
      id: row.id,
      institutionId: row.institution_id,
      reviewCycleId: row.review_cycle_id,
      scopeType: row.scope_type,
      scopeId: row.scope_id,
      name: row.name,
      status: row.status,
      finalizedAt: row.finalized_at,
      items: items.map((item) => ({
        id: item.id,
        packageId: item.package_id,
        sequence: item.item_sequence,
        itemType: item.item_type,
        assemblyRole: item.assembly_role,
        targetType: item.target_type,
        targetId: item.target_id,
        workflowId: item.workflow_id,
        sectionKey: item.section_key,
        sectionTitle: item.section_title,
        parentSectionKey: item.parent_section_key,
        sectionType: item.section_type,
        evidenceItemIds: parseJsonList(item.evidence_item_ids_json),
        label: item.label,
        rationale: item.rationale,
        metadata: parseJsonObject(item.metadata_json),
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
      snapshots: snapshots.map((snapshot) => ({
        id: snapshot.id,
        packageId: snapshot.package_id,
        versionNumber: snapshot.version_number,
        milestoneLabel: snapshot.milestone_label,
        actorId: snapshot.actor_id,
        notes: snapshot.notes,
        finalized: Boolean(snapshot.is_finalized),
        createdAt: snapshot.created_at,
        items: this.database.all(
          `SELECT * FROM narratives_submission_snapshot_items
           WHERE snapshot_id = @snapshotId
           ORDER BY item_sequence ASC`,
          { snapshotId: snapshot.id },
        ).map((item) => ({
          id: item.id,
          snapshotId: item.snapshot_id,
          packageItemId: item.package_item_id,
          sequence: item.item_sequence,
          itemType: item.item_type,
          assemblyRole: item.assembly_role,
          targetType: item.target_type,
          targetId: item.target_id,
          workflowId: item.workflow_id,
          sectionKey: item.section_key,
          sectionTitle: item.section_title,
          parentSectionKey: item.parent_section_key,
          sectionType: item.section_type,
          evidenceItemIds: parseJsonList(item.evidence_item_ids_json),
          label: item.label,
          rationale: item.rationale,
          metadata: parseJsonObject(item.metadata_json),
          createdAt: item.created_at,
        })),
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  #assertIdentityUnchanged(existing, next) {
    if (
      existing.institution_id !== next.institutionId ||
      existing.review_cycle_id !== next.reviewCycleId ||
      existing.scope_type !== next.scopeType ||
      existing.scope_id !== next.scopeId ||
      existing.created_at !== next.createdAt
    ) {
      throw new ValidationError('SubmissionPackage identity fields cannot be changed in-place');
    }
  }

  #assertScopeUniqueness(next) {
    const duplicate = this.database.get(
      `SELECT id FROM narratives_submission_packages
       WHERE review_cycle_id = @reviewCycleId
         AND scope_type = @scopeType
         AND scope_id = @scopeId
         AND id <> @id
       LIMIT 1`,
      {
        reviewCycleId: next.reviewCycleId,
        scopeType: next.scopeType,
        scopeId: next.scopeId,
        id: next.id,
      },
    );

    if (duplicate) {
      throw new ValidationError(
        `SubmissionPackage reviewCycle+scope must be unique (existing: ${duplicate.id})`,
      );
    }
  }

  #assertSnapshotHistoryAppendOnly(next) {
    const persistedSnapshots = this.database.all(
      'SELECT * FROM narratives_submission_package_snapshots WHERE package_id = @packageId',
      { packageId: next.id },
    );
    const nextById = new Map((next.snapshots ?? []).map((snapshot) => [snapshot.id, snapshot]));

    for (const persisted of persistedSnapshots) {
      const candidate = nextById.get(persisted.id);
      if (!candidate) {
        throw new ValidationError(`SubmissionPackage snapshots are append-only: missing ${persisted.id}`);
      }
      this.#assertSnapshotUnchanged(persisted, candidate);
    }
  }

  #assertSnapshotUnchanged(persisted, current) {
    if (
      persisted.package_id !== current.packageId ||
      persisted.version_number !== current.versionNumber ||
      persisted.milestone_label !== current.milestoneLabel ||
      (persisted.actor_id ?? null) !== (current.actorId ?? null) ||
      persisted.notes !== current.notes ||
      Boolean(persisted.is_finalized) !== Boolean(current.finalized) ||
      persisted.created_at !== current.createdAt
    ) {
      throw new ValidationError(`SubmissionPackage snapshots are append-only: ${persisted.id} cannot be modified`);
    }

    const persistedItems = this.database.all(
      'SELECT * FROM narratives_submission_snapshot_items WHERE snapshot_id = @snapshotId ORDER BY item_sequence ASC',
      { snapshotId: persisted.id },
    );
    const currentItemsById = new Map((current.items ?? []).map((item) => [item.id, item]));

    for (const persistedItem of persistedItems) {
      const currentItem = currentItemsById.get(persistedItem.id);
      if (!currentItem) {
        throw new ValidationError(
          `SubmissionPackage snapshot items are append-only: missing ${persistedItem.id}`,
        );
      }
      if (
        persistedItem.snapshot_id !== currentItem.snapshotId ||
        persistedItem.package_item_id !== currentItem.packageItemId ||
        persistedItem.item_sequence !== currentItem.sequence ||
        persistedItem.item_type !== currentItem.itemType ||
        persistedItem.assembly_role !== currentItem.assemblyRole ||
        persistedItem.target_type !== currentItem.targetType ||
        persistedItem.target_id !== currentItem.targetId ||
        (persistedItem.workflow_id ?? null) !== (currentItem.workflowId ?? null) ||
        (persistedItem.section_key ?? null) !== (currentItem.sectionKey ?? null) ||
        (persistedItem.section_title ?? null) !== (currentItem.sectionTitle ?? null) ||
        (persistedItem.parent_section_key ?? null) !== (currentItem.parentSectionKey ?? null) ||
        (persistedItem.section_type ?? null) !== (currentItem.sectionType ?? null) ||
        JSON.stringify(parseJsonList(persistedItem.evidence_item_ids_json)) !==
          JSON.stringify(currentItem.evidenceItemIds ?? []) ||
        persistedItem.label !== currentItem.label ||
        persistedItem.rationale !== currentItem.rationale ||
        JSON.stringify(parseJsonObject(persistedItem.metadata_json)) !== JSON.stringify(currentItem.metadata ?? null) ||
        persistedItem.created_at !== currentItem.createdAt
      ) {
        throw new ValidationError(
          `SubmissionPackage snapshot items are append-only: ${persistedItem.id} cannot be modified`,
        );
      }
    }
  }

  #assertItemsUnchanged(next) {
    const persistedItems = this.database.all(
      `SELECT * FROM narratives_submission_package_items
       WHERE package_id = @packageId
       ORDER BY item_sequence ASC`,
      { packageId: next.id },
    ).map((item) => ({
      id: item.id,
      packageId: item.package_id,
      sequence: item.item_sequence,
      itemType: item.item_type,
      assemblyRole: item.assembly_role,
      targetType: item.target_type,
      targetId: item.target_id,
      workflowId: item.workflow_id,
      sectionKey: item.section_key,
      sectionTitle: item.section_title,
      parentSectionKey: item.parent_section_key,
      sectionType: item.section_type,
      evidenceItemIds: parseJsonList(item.evidence_item_ids_json),
      label: item.label,
      rationale: item.rationale,
      metadata: parseJsonObject(item.metadata_json),
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));

    if (JSON.stringify(persistedItems) !== JSON.stringify(next.items ?? [])) {
      throw new ValidationError('SubmissionPackage items cannot be modified after finalization');
    }
  }
}

export class SqliteNarrativeRepository extends NarrativeRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(narrative) {
    if (!(narrative instanceof Narrative)) {
      throw new ValidationError('NarrativeRepository.save expects a Narrative aggregate instance');
    }

    const validated = Narrative.rehydrate(toNarrativeSnapshot(narrative));

    this.database.transaction(() => {
      const existing = this.database.get(
        'SELECT * FROM narratives_narratives WHERE id = @id',
        { id: validated.id },
      );
      if (existing) {
        this.#assertIdentityUnchanged(existing, validated);
        if (existing.status === narrativeStatus.FINALIZED) {
          this.#assertFinalizedNarrativeUnchanged(existing, validated);
        }
      }
      this.#assertSubmissionPackageUniqueness(validated);

      this.database.run(
        `INSERT INTO narratives_narratives
          (id, institution_id, review_cycle_id, submission_package_id, title, status, submitted_for_review_at, finalized_at, created_at, updated_at)
         VALUES
          (@id, @institutionId, @reviewCycleId, @submissionPackageId, @title, @status, @submittedForReviewAt, @finalizedAt, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           institution_id=excluded.institution_id,
           review_cycle_id=excluded.review_cycle_id,
           submission_package_id=excluded.submission_package_id,
           title=excluded.title,
           status=excluded.status,
           submitted_for_review_at=excluded.submitted_for_review_at,
           finalized_at=excluded.finalized_at,
           updated_at=excluded.updated_at`,
        {
          id: validated.id,
          institutionId: validated.institutionId,
          reviewCycleId: validated.reviewCycleId,
          submissionPackageId: validated.submissionPackageId,
          title: validated.title,
          status: validated.status,
          submittedForReviewAt: validated.submittedForReviewAt,
          finalizedAt: validated.finalizedAt,
          createdAt: validated.createdAt,
          updatedAt: validated.updatedAt,
        },
      );

      this.database.run('DELETE FROM narratives_narrative_sections WHERE narrative_id = @narrativeId', {
        narrativeId: validated.id,
      });

      for (const section of validated.sections) {
        this.database.run(
          `INSERT INTO narratives_narrative_sections
            (id, narrative_id, section_sequence, section_type, section_key, parent_section_key, title, content, owner_id, created_at, updated_at)
           VALUES
            (@id, @narrativeId, @sequence, @sectionType, @sectionKey, @parentSectionKey, @title, @content, @ownerId, @createdAt, @updatedAt)`,
          {
            id: section.id,
            narrativeId: section.narrativeId,
            sequence: section.sequence,
            sectionType: section.sectionType,
            sectionKey: section.sectionKey,
            parentSectionKey: section.parentSectionKey,
            title: section.title,
            content: section.content,
            ownerId: section.ownerId,
            createdAt: section.createdAt,
            updatedAt: section.updatedAt,
          },
        );

        for (const evidenceLink of section.evidenceLinks) {
          this.database.run(
            `INSERT INTO narratives_narrative_section_evidence_links
              (id, section_id, evidence_item_id, relationship_type, rationale, created_at)
             VALUES
              (@id, @sectionId, @evidenceItemId, @relationshipType, @rationale, @createdAt)`,
            {
              id: evidenceLink.id,
              sectionId: evidenceLink.sectionId,
              evidenceItemId: evidenceLink.evidenceItemId,
              relationshipType: evidenceLink.relationshipType,
              rationale: evidenceLink.rationale,
              createdAt: evidenceLink.createdAt,
            },
          );
        }

        for (const packageLink of section.packageLinks) {
          this.database.run(
            `INSERT INTO narratives_narrative_section_package_links
              (id, section_id, narrative_id, submission_package_item_id, link_type, created_at)
             VALUES
              (@id, @sectionId, @narrativeId, @submissionPackageItemId, @linkType, @createdAt)`,
            {
              id: packageLink.id,
              sectionId: packageLink.sectionId,
              narrativeId: section.narrativeId,
              submissionPackageItemId: packageLink.submissionPackageItemId,
              linkType: packageLink.linkType,
              createdAt: packageLink.createdAt,
            },
          );
        }
      }
    });

    return validated;
  }

  async getById(id) {
    const row = this.database.get('SELECT * FROM narratives_narratives WHERE id = @id', { id });
    if (!row) {
      return null;
    }
    return this.#rehydrate(row);
  }

  async findByFilter(filter = {}) {
    const rootFilters = filterClause(filter, {
      id: 'n.id',
      institutionId: 'n.institution_id',
      reviewCycleId: 'n.review_cycle_id',
      submissionPackageId: 'n.submission_package_id',
      status: 'n.status',
    });

    const sql = `
      SELECT n.*
      FROM narratives_narratives n
      ${rootFilters.sql}
      ORDER BY n.created_at ASC
    `;
    const rows = this.database.all(sql, rootFilters.params);
    return rows.map((row) => this.#rehydrate(row));
  }

  async getBySubmissionPackageId(submissionPackageId) {
    const row = this.database.get(
      `SELECT * FROM narratives_narratives
       WHERE submission_package_id = @submissionPackageId
       LIMIT 1`,
      { submissionPackageId },
    );
    return row ? this.#rehydrate(row) : null;
  }

  async getSectionById(sectionId) {
    const row = this.database.get(
      `SELECT
         s.*,
         n.institution_id AS narrative_institution_id,
         n.review_cycle_id AS narrative_review_cycle_id,
         n.submission_package_id AS narrative_submission_package_id
       FROM narratives_narrative_sections s
       JOIN narratives_narratives n
         ON n.id = s.narrative_id
       WHERE s.id = @sectionId
       LIMIT 1`,
      { sectionId },
    );
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      narrativeId: row.narrative_id,
      sequence: row.section_sequence,
      sectionType: row.section_type,
      sectionKey: row.section_key,
      parentSectionKey: row.parent_section_key,
      title: row.title,
      content: row.content,
      ownerId: row.owner_id,
      evidenceLinks: this.database.all(
        `SELECT * FROM narratives_narrative_section_evidence_links
         WHERE section_id = @sectionId
         ORDER BY created_at ASC`,
        { sectionId: row.id },
      ).map((link) => ({
        id: link.id,
        sectionId: link.section_id,
        evidenceItemId: link.evidence_item_id,
        relationshipType: link.relationship_type,
        rationale: link.rationale,
        createdAt: link.created_at,
      })),
      packageLinks: this.database.all(
        `SELECT * FROM narratives_narrative_section_package_links
         WHERE section_id = @sectionId
         ORDER BY created_at ASC`,
        { sectionId: row.id },
      ).map((link) => ({
        id: link.id,
        sectionId: link.section_id,
        submissionPackageItemId: link.submission_package_item_id,
        linkType: link.link_type,
        createdAt: link.created_at,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      institutionId: row.narrative_institution_id,
      reviewCycleId: row.narrative_review_cycle_id,
      submissionPackageId: row.narrative_submission_package_id,
    };
  }

  #rehydrate(row) {
    const sections = this.database.all(
      `SELECT * FROM narratives_narrative_sections
       WHERE narrative_id = @narrativeId
       ORDER BY section_sequence ASC`,
      { narrativeId: row.id },
    );

    return Narrative.rehydrate({
      id: row.id,
      institutionId: row.institution_id,
      reviewCycleId: row.review_cycle_id,
      submissionPackageId: row.submission_package_id,
      title: row.title,
      status: row.status,
      sections: sections.map((section) => ({
        id: section.id,
        narrativeId: section.narrative_id,
        sequence: section.section_sequence,
        sectionType: section.section_type,
        sectionKey: section.section_key,
        parentSectionKey: section.parent_section_key,
        title: section.title,
        content: section.content,
        ownerId: section.owner_id,
        evidenceLinks: this.database.all(
          `SELECT * FROM narratives_narrative_section_evidence_links
           WHERE section_id = @sectionId
           ORDER BY created_at ASC`,
          { sectionId: section.id },
        ).map((link) => ({
          id: link.id,
          sectionId: link.section_id,
          evidenceItemId: link.evidence_item_id,
          relationshipType: link.relationship_type,
          rationale: link.rationale,
          createdAt: link.created_at,
        })),
        packageLinks: this.database.all(
          `SELECT * FROM narratives_narrative_section_package_links
           WHERE section_id = @sectionId
           ORDER BY created_at ASC`,
          { sectionId: section.id },
        ).map((link) => ({
          id: link.id,
          sectionId: link.section_id,
          submissionPackageItemId: link.submission_package_item_id,
          linkType: link.link_type,
          createdAt: link.created_at,
        })),
        createdAt: section.created_at,
        updatedAt: section.updated_at,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      submittedForReviewAt: row.submitted_for_review_at,
      finalizedAt: row.finalized_at,
    });
  }

  #assertIdentityUnchanged(existing, next) {
    if (
      existing.institution_id !== next.institutionId ||
      existing.review_cycle_id !== next.reviewCycleId ||
      existing.submission_package_id !== next.submissionPackageId ||
      existing.created_at !== next.createdAt
    ) {
      throw new ValidationError('Narrative identity fields cannot be changed in-place');
    }
  }

  #assertSubmissionPackageUniqueness(next) {
    const duplicate = this.database.get(
      `SELECT id FROM narratives_narratives
       WHERE submission_package_id = @submissionPackageId
         AND id <> @id
       LIMIT 1`,
      { submissionPackageId: next.submissionPackageId, id: next.id },
    );
    if (duplicate) {
      throw new ValidationError(`Narrative submissionPackageId must be unique (existing: ${duplicate.id})`);
    }
  }

  #assertFinalizedNarrativeUnchanged(existing, next) {
    const persisted = this.#rehydrate(existing);
    if (JSON.stringify(toNarrativeSnapshot(persisted)) !== JSON.stringify(toNarrativeSnapshot(next))) {
      throw new ValidationError('Narrative cannot be modified after finalization');
    }
  }
}
