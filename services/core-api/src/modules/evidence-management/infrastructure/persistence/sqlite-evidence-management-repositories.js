import { ValidationError } from '../../../shared/kernel/errors.js';
import { EvidenceItem, EvidenceArtifact } from '../../domain/entities/evidence-item.js';
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
    this.database.transaction(() => {
      this.database.run(
        `INSERT INTO evidence_management_items
         (id, institution_id, title, description, evidence_type, source_type, status, is_complete,
          superseded_by_evidence_item_id, reporting_period_id, review_cycle_id, created_at, updated_at)
         VALUES (@id, @institutionId, @title, @description, @evidenceType, @sourceType, @status, @isComplete,
          @supersededByEvidenceItemId, @reportingPeriodId, @reviewCycleId, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
          institution_id=excluded.institution_id,
          title=excluded.title,
          description=excluded.description,
          evidence_type=excluded.evidence_type,
          source_type=excluded.source_type,
          status=excluded.status,
          is_complete=excluded.is_complete,
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
      supersededByEvidenceItemId: row.superseded_by_evidence_item_id,
      reportingPeriodId: row.reporting_period_id,
      reviewCycleId: row.review_cycle_id,
      artifacts,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async findByFilter(filter = {}) {
    const { sql, params } = filterClause(filter, {
      id: 'id',
      institutionId: 'institution_id',
      evidenceType: 'evidence_type',
      sourceType: 'source_type',
      status: 'status',
    });
    const rows = this.database.all(`SELECT * FROM evidence_management_items ${sql} ORDER BY created_at ASC`, params);
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
          supersededByEvidenceItemId: row.superseded_by_evidence_item_id,
          reportingPeriodId: row.reporting_period_id,
          reviewCycleId: row.review_cycle_id,
          artifacts: this.#listArtifactsByEvidenceItemId(row.id),
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
}
