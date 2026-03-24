import { ValidationError } from '../../../shared/kernel/errors.js';
import { EvidenceItem, EvidenceArtifact, EvidenceReference } from '../../domain/entities/evidence-item.js';
import { EvidenceItemRepository } from '../../domain/repositories/repositories.js';

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

export class SqliteEvidenceItemRepository extends EvidenceItemRepository {
  constructor(database) {
    super();
    this.database = database;
  }

  async save(evidenceItem) {
    if (!(evidenceItem instanceof EvidenceItem)) {
      throw new ValidationError('EvidenceItemRepository.save expects an EvidenceItem aggregate instance');
    }

    this.database.transaction(() => {
      const existingItem = this.database.get(
        `SELECT * FROM evidence_management_items WHERE id = @id`,
        { id: evidenceItem.id },
      );
      if (existingItem) {
        this.#assertItemIdentityUnchanged(existingItem, evidenceItem);
        this.#assertVersionIdentityUnchanged(existingItem, evidenceItem);
      } else {
        this.#assertValidVersionInsert(evidenceItem);
      }

      if (evidenceItem.supersededByEvidenceItemId) {
        this.#assertValidSupersededByLink(evidenceItem);
      }

      this.database.run(
        `INSERT INTO evidence_management_items
         (id, institution_id, title, description, evidence_type, source_type, status, is_complete,
          evidence_lineage_id, version_number, supersedes_evidence_item_id,
          superseded_by_evidence_item_id, reporting_period_id, review_cycle_id, created_at, updated_at)
         VALUES (@id, @institutionId, @title, @description, @evidenceType, @sourceType, @status, @isComplete,
          @evidenceLineageId, @versionNumber, @supersedesEvidenceItemId,
          @supersededByEvidenceItemId, @reportingPeriodId, @reviewCycleId, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
          institution_id=excluded.institution_id,
          title=excluded.title,
          description=excluded.description,
          evidence_type=excluded.evidence_type,
          source_type=excluded.source_type,
          status=excluded.status,
          is_complete=excluded.is_complete,
          evidence_lineage_id=excluded.evidence_lineage_id,
          version_number=excluded.version_number,
          supersedes_evidence_item_id=excluded.supersedes_evidence_item_id,
          superseded_by_evidence_item_id=excluded.superseded_by_evidence_item_id,
          reporting_period_id=excluded.reporting_period_id,
          review_cycle_id=excluded.review_cycle_id,
          updated_at=excluded.updated_at`,
        {
          id: evidenceItem.id,
          institutionId: evidenceItem.institutionId,
          title: evidenceItem.title,
          description: evidenceItem.description,
          evidenceType: evidenceItem.evidenceType,
          sourceType: evidenceItem.sourceType,
          status: evidenceItem.status,
          isComplete: evidenceItem.isComplete ? 1 : 0,
          evidenceLineageId: evidenceItem.evidenceLineageId,
          versionNumber: evidenceItem.versionNumber,
          supersedesEvidenceItemId: evidenceItem.supersedesEvidenceItemId,
          supersededByEvidenceItemId: evidenceItem.supersededByEvidenceItemId,
          reportingPeriodId: evidenceItem.reportingPeriodId,
          reviewCycleId: evidenceItem.reviewCycleId,
          createdAt: evidenceItem.createdAt,
          updatedAt: evidenceItem.updatedAt,
        },
      );

      const persistedArtifacts = this.database.all(
        `SELECT * FROM evidence_management_artifacts WHERE evidence_item_id = @evidenceItemId`,
        { evidenceItemId: evidenceItem.id },
      );
      const persistedById = new Map(persistedArtifacts.map((artifact) => [artifact.id, artifact]));

      for (const artifact of evidenceItem.artifacts) {
        const persisted = persistedById.get(artifact.id);
        if (persisted) {
          this.#assertArtifactUnchanged(artifact, persisted);
          continue;
        }

        this.database.run(
          `INSERT INTO evidence_management_artifacts
           (id, evidence_item_id, artifact_name, artifact_type, mime_type, file_extension, byte_size,
            storage_bucket, storage_key, artifact_status, source_checksum, uploaded_at, created_at, updated_at)
           VALUES (@id, @evidenceItemId, @artifactName, @artifactType, @mimeType, @fileExtension, @byteSize,
            @storageBucket, @storageKey, @status, @sourceChecksum, @uploadedAt, @createdAt, @updatedAt)`,
          {
            id: artifact.id,
            evidenceItemId: artifact.evidenceItemId,
            artifactName: artifact.artifactName,
            artifactType: artifact.artifactType,
            mimeType: artifact.mimeType,
            fileExtension: artifact.fileExtension,
            byteSize: artifact.byteSize,
            storageBucket: artifact.storageBucket,
            storageKey: artifact.storageKey,
            status: artifact.status,
            sourceChecksum: artifact.sourceChecksum,
            uploadedAt: artifact.uploadedAt,
            createdAt: artifact.createdAt,
            updatedAt: artifact.updatedAt,
          },
        );
      }

      const persistedReferences = this.database.all(
        `SELECT * FROM evidence_management_references WHERE evidence_item_id = @evidenceItemId`,
        { evidenceItemId: evidenceItem.id },
      );
      const persistedReferencesById = new Map(persistedReferences.map((reference) => [reference.id, reference]));

      for (const reference of evidenceItem.references ?? []) {
        const persistedReference = persistedReferencesById.get(reference.id);
        if (persistedReference) {
          this.#assertReferenceUnchanged(reference, persistedReference);
          continue;
        }

        this.database.run(
          `INSERT INTO evidence_management_references
           (id, evidence_item_id, target_type, target_entity_id, relationship_type, rationale, anchor_path, created_at, updated_at)
           VALUES (@id, @evidenceItemId, @targetType, @targetEntityId, @relationshipType, @rationale, @anchorPath, @createdAt, @updatedAt)`,
          {
            id: reference.id,
            evidenceItemId: reference.evidenceItemId,
            targetType: reference.targetType,
            targetEntityId: reference.targetEntityId,
            relationshipType: reference.relationshipType,
            rationale: reference.rationale,
            anchorPath: reference.anchorPath,
            createdAt: reference.createdAt,
            updatedAt: reference.updatedAt,
          },
        );
      }
    });

    return evidenceItem;
  }

  async getById(id) {
    const row = this.database.get('SELECT * FROM evidence_management_items WHERE id = @id', { id });
    if (!row) {
      return null;
    }

    const artifacts = this.#listArtifactsByEvidenceItemId(id);
    return EvidenceItem.rehydrate({
      id: row.id,
      institutionId: row.institution_id,
      title: row.title,
      description: row.description,
      evidenceType: row.evidence_type,
      sourceType: row.source_type,
      status: row.status,
      isComplete: Boolean(row.is_complete),
      evidenceLineageId: row.evidence_lineage_id,
      versionNumber: row.version_number,
      supersedesEvidenceItemId: row.supersedes_evidence_item_id,
      supersededByEvidenceItemId: row.superseded_by_evidence_item_id,
      reportingPeriodId: row.reporting_period_id,
      reviewCycleId: row.review_cycle_id,
      artifacts,
      references: this.#listReferencesByEvidenceItemId(id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async getCurrentByLineageId(evidenceLineageId) {
    const row = this.database.get(
      `SELECT * FROM evidence_management_items
       WHERE evidence_lineage_id = @evidenceLineageId
         AND superseded_by_evidence_item_id IS NULL
       ORDER BY version_number DESC
       LIMIT 1`,
      { evidenceLineageId },
    );
    if (!row) {
      return null;
    }

    return EvidenceItem.rehydrate({
      id: row.id,
      institutionId: row.institution_id,
      title: row.title,
      description: row.description,
      evidenceType: row.evidence_type,
      sourceType: row.source_type,
      status: row.status,
      isComplete: Boolean(row.is_complete),
      evidenceLineageId: row.evidence_lineage_id,
      versionNumber: row.version_number,
      supersedesEvidenceItemId: row.supersedes_evidence_item_id,
      supersededByEvidenceItemId: row.superseded_by_evidence_item_id,
      reportingPeriodId: row.reporting_period_id,
      reviewCycleId: row.review_cycle_id,
      artifacts: this.#listArtifactsByEvidenceItemId(row.id),
      references: this.#listReferencesByEvidenceItemId(row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async listByLineageId(evidenceLineageId) {
    const rows = this.database.all(
      `SELECT * FROM evidence_management_items
       WHERE evidence_lineage_id = @evidenceLineageId
       ORDER BY version_number ASC`,
      { evidenceLineageId },
    );
    return rows.map((row) =>
      EvidenceItem.rehydrate({
        id: row.id,
        institutionId: row.institution_id,
        title: row.title,
        description: row.description,
        evidenceType: row.evidence_type,
        sourceType: row.source_type,
        status: row.status,
        isComplete: Boolean(row.is_complete),
        evidenceLineageId: row.evidence_lineage_id,
        versionNumber: row.version_number,
        supersedesEvidenceItemId: row.supersedes_evidence_item_id,
        supersededByEvidenceItemId: row.superseded_by_evidence_item_id,
        reportingPeriodId: row.reporting_period_id,
        reviewCycleId: row.review_cycle_id,
        artifacts: this.#listArtifactsByEvidenceItemId(row.id),
        references: this.#listReferencesByEvidenceItemId(row.id),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    );
  }

  async findByFilter(filter = {}) {
    const { currentOnly, targetType, targetEntityId, relationshipType } = filter ?? {};
    const { sql, params } = filterClause(filter, {
      id: 'id',
      institutionId: 'institution_id',
      evidenceType: 'evidence_type',
      sourceType: 'source_type',
      status: 'status',
      evidenceLineageId: 'evidence_lineage_id',
      versionNumber: 'version_number',
      supersedesEvidenceItemId: 'supersedes_evidence_item_id',
      supersededByEvidenceItemId: 'superseded_by_evidence_item_id',
    });

    const whereClauses = [];
    if (sql) {
      whereClauses.push(sql.replace(/^WHERE\s+/i, ''));
    }
    if (currentOnly) {
      whereClauses.push('evidence_management_items.superseded_by_evidence_item_id IS NULL');
    }
    if (targetType || targetEntityId || relationshipType) {
      whereClauses.push(
        `EXISTS (
           SELECT 1
           FROM evidence_management_references refs
           WHERE refs.evidence_item_id = evidence_management_items.id
             ${targetType ? 'AND refs.target_type = @targetType' : ''}
             ${targetEntityId ? 'AND refs.target_entity_id = @targetEntityId' : ''}
             ${relationshipType ? 'AND refs.relationship_type = @relationshipType' : ''}
         )`,
      );
      if (targetType) {
        params.targetType = targetType;
      }
      if (targetEntityId) {
        params.targetEntityId = targetEntityId;
      }
      if (relationshipType) {
        params.relationshipType = relationshipType;
      }
    }
    const composedWhereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const rows = this.database.all(
      `SELECT * FROM evidence_management_items ${composedWhereSql} ORDER BY version_number ASC, created_at ASC`,
      params,
    );
    return rows.map(
      (row) =>
        EvidenceItem.rehydrate({
          id: row.id,
          institutionId: row.institution_id,
          title: row.title,
          description: row.description,
          evidenceType: row.evidence_type,
          sourceType: row.source_type,
          status: row.status,
          isComplete: Boolean(row.is_complete),
          evidenceLineageId: row.evidence_lineage_id,
          versionNumber: row.version_number,
          supersedesEvidenceItemId: row.supersedes_evidence_item_id,
          supersededByEvidenceItemId: row.superseded_by_evidence_item_id,
          reportingPeriodId: row.reporting_period_id,
          reviewCycleId: row.review_cycle_id,
          artifacts: this.#listArtifactsByEvidenceItemId(row.id),
          references: this.#listReferencesByEvidenceItemId(row.id),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }),
    );
  }

  #listArtifactsByEvidenceItemId(evidenceItemId) {
    const rows = this.database.all(
      `SELECT * FROM evidence_management_artifacts
       WHERE evidence_item_id = @evidenceItemId
       ORDER BY created_at ASC`,
      { evidenceItemId },
    );
    return rows.map(
      (row) =>
        EvidenceArtifact.rehydrate({
          id: row.id,
          evidenceItemId: row.evidence_item_id,
          artifactName: row.artifact_name,
          artifactType: row.artifact_type,
          mimeType: row.mime_type,
          fileExtension: row.file_extension,
          byteSize: row.byte_size,
          storageBucket: row.storage_bucket,
          storageKey: row.storage_key,
          sourceChecksum: row.source_checksum,
          status: row.artifact_status,
          uploadedAt: row.uploaded_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }),
    );
  }

  #listReferencesByEvidenceItemId(evidenceItemId) {
    const rows = this.database.all(
      `SELECT * FROM evidence_management_references
       WHERE evidence_item_id = @evidenceItemId
       ORDER BY created_at ASC`,
      { evidenceItemId },
    );
    return rows.map((row) =>
      EvidenceReference.rehydrate({
        id: row.id,
        evidenceItemId: row.evidence_item_id,
        targetType: row.target_type,
        targetEntityId: row.target_entity_id,
        relationshipType: row.relationship_type,
        rationale: row.rationale,
        anchorPath: row.anchor_path,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    );
  }

  #assertArtifactUnchanged(currentArtifact, persistedRow) {
    const persisted = {
      evidenceItemId: persistedRow.evidence_item_id,
      artifactName: persistedRow.artifact_name,
      artifactType: persistedRow.artifact_type,
      mimeType: persistedRow.mime_type,
      fileExtension: persistedRow.file_extension,
      byteSize: persistedRow.byte_size,
      storageBucket: persistedRow.storage_bucket,
      storageKey: persistedRow.storage_key,
      status: persistedRow.artifact_status,
      sourceChecksum: persistedRow.source_checksum,
      uploadedAt: persistedRow.uploaded_at,
    };

    if (
      currentArtifact.evidenceItemId !== persisted.evidenceItemId ||
      currentArtifact.artifactName !== persisted.artifactName ||
      currentArtifact.artifactType !== persisted.artifactType ||
      currentArtifact.mimeType !== persisted.mimeType ||
      currentArtifact.fileExtension !== persisted.fileExtension ||
      currentArtifact.byteSize !== persisted.byteSize ||
      currentArtifact.storageBucket !== persisted.storageBucket ||
      currentArtifact.storageKey !== persisted.storageKey ||
      currentArtifact.status !== persisted.status ||
      currentArtifact.sourceChecksum !== persisted.sourceChecksum ||
      currentArtifact.uploadedAt !== persisted.uploadedAt
    ) {
      throw new ValidationError(
        `EvidenceArtifact ${currentArtifact.id} is append-only and cannot be updated in-place`,
      );
    }
  }

  #assertReferenceUnchanged(currentReference, persistedRow) {
    const persisted = {
      evidenceItemId: persistedRow.evidence_item_id,
      targetType: persistedRow.target_type,
      targetEntityId: persistedRow.target_entity_id,
      relationshipType: persistedRow.relationship_type,
      rationale: persistedRow.rationale,
      anchorPath: persistedRow.anchor_path,
    };

    if (
      currentReference.evidenceItemId !== persisted.evidenceItemId ||
      currentReference.targetType !== persisted.targetType ||
      currentReference.targetEntityId !== persisted.targetEntityId ||
      currentReference.relationshipType !== persisted.relationshipType ||
      currentReference.rationale !== persisted.rationale ||
      currentReference.anchorPath !== persisted.anchorPath
    ) {
      throw new ValidationError(
        `EvidenceReference ${currentReference.id} is append-only and cannot be updated in-place`,
      );
    }
  }

  #assertItemIdentityUnchanged(existingRow, evidenceItem) {
    if (
      existingRow.institution_id !== evidenceItem.institutionId ||
      existingRow.evidence_type !== evidenceItem.evidenceType ||
      existingRow.source_type !== evidenceItem.sourceType ||
      existingRow.created_at !== evidenceItem.createdAt
    ) {
      throw new ValidationError('EvidenceItem identity fields cannot be changed in-place');
    }
  }

  #assertVersionIdentityUnchanged(existingRow, evidenceItem) {
    if (
      existingRow.evidence_lineage_id !== evidenceItem.evidenceLineageId ||
      existingRow.version_number !== evidenceItem.versionNumber ||
      existingRow.supersedes_evidence_item_id !== evidenceItem.supersedesEvidenceItemId
    ) {
      throw new ValidationError('EvidenceItem version identity fields cannot be changed in-place');
    }
  }

  #assertValidVersionInsert(evidenceItem) {
    if (!evidenceItem.supersedesEvidenceItemId) {
      return;
    }

    const predecessor = this.database.get(
      `SELECT * FROM evidence_management_items WHERE id = @id`,
      { id: evidenceItem.supersedesEvidenceItemId },
    );
    if (!predecessor) {
      throw new ValidationError(
        `EvidenceItem.supersedesEvidenceItemId must reference an existing EvidenceItem: ${evidenceItem.supersedesEvidenceItemId}`,
      );
    }
    if (predecessor.evidence_lineage_id !== evidenceItem.evidenceLineageId) {
      throw new ValidationError('EvidenceItem predecessor and successor must share evidenceLineageId');
    }
    if (predecessor.version_number + 1 !== evidenceItem.versionNumber) {
      throw new ValidationError('EvidenceItem successor versionNumber must be predecessor.versionNumber + 1');
    }

    const existingSuccessor = this.database.get(
      `SELECT id FROM evidence_management_items WHERE supersedes_evidence_item_id = @supersedesEvidenceItemId`,
      { supersedesEvidenceItemId: evidenceItem.supersedesEvidenceItemId },
    );
    if (existingSuccessor) {
      throw new ValidationError(
        `EvidenceItem predecessor already has a successor: ${evidenceItem.supersedesEvidenceItemId}`,
      );
    }
  }

  #assertValidSupersededByLink(evidenceItem) {
    const successor = this.database.get(
      `SELECT * FROM evidence_management_items WHERE id = @id`,
      { id: evidenceItem.supersededByEvidenceItemId },
    );
    if (!successor) {
      throw new ValidationError(
        `EvidenceItem.supersededByEvidenceItemId must reference an existing EvidenceItem: ${evidenceItem.supersededByEvidenceItemId}`,
      );
    }
    if (successor.evidence_lineage_id === evidenceItem.evidenceLineageId) {
      if (successor.supersedes_evidence_item_id !== evidenceItem.id) {
        throw new ValidationError('EvidenceItem successor must reference predecessor via supersedesEvidenceItemId');
      }
      if (successor.version_number !== evidenceItem.versionNumber + 1) {
        throw new ValidationError('EvidenceItem lineage successor must increment versionNumber by exactly 1');
      }
      return;
    }

    const isLegacyStandaloneSuccessor =
      successor.evidence_lineage_id === successor.id &&
      successor.version_number === 1 &&
      successor.supersedes_evidence_item_id === null;

    if (!isLegacyStandaloneSuccessor) {
      throw new ValidationError('EvidenceItem supersededByEvidenceItemId must point to a valid successor evidence item');
    }
  }
}
