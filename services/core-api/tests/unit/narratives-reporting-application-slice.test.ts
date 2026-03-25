import assert from 'node:assert/strict';
import { Institution } from '../../src/modules/organization-registry/domain/entities/institution.js';
import { InMemoryInstitutionRepository } from '../../src/modules/organization-registry/infrastructure/persistence/in-memory-organization-registry-repositories.js';
import { EvidenceManagementService } from '../../src/modules/evidence-management/application/evidence-management-service.js';
import { WorkflowEvidenceReadinessService } from '../../src/modules/evidence-management/application/workflow-evidence-readiness-service.js';
import { InMemoryEvidenceItemRepository } from '../../src/modules/evidence-management/infrastructure/persistence/in-memory-evidence-management-repositories.js';
import {
  evidenceSourceType,
  evidenceType,
} from '../../src/modules/evidence-management/domain/value-objects/evidence-classifications.js';
import { WorkflowApprovalsService } from '../../src/modules/workflow-approvals/application/workflow-approvals-service.js';
import {
  reviewWorkflowState,
  workflowActorRole,
} from '../../src/modules/workflow-approvals/domain/value-objects/workflow-statuses.js';
import {
  InMemoryReviewCycleRepository,
  InMemoryReviewWorkflowRepository,
} from '../../src/modules/workflow-approvals/infrastructure/persistence/in-memory-workflow-approvals-repositories.js';
import { NarrativesReportingService } from '../../src/modules/narratives-reporting/application/narratives-reporting-service.js';
import { InMemorySubmissionPackageRepository } from '../../src/modules/narratives-reporting/infrastructure/persistence/in-memory-narratives-reporting-repositories.js';
import {
  submissionPackageItemAssemblyRole,
  submissionPackageItemType,
} from '../../src/modules/narratives-reporting/domain/value-objects/submission-package-statuses.js';
import { ValidationError } from '../../src/modules/shared/kernel/errors.js';

export async function runTests(): Promise<void> {
  const institutions = new InMemoryInstitutionRepository();
  const evidenceItems = new InMemoryEvidenceItemRepository();
  const cycles = new InMemoryReviewCycleRepository();
  const workflows = new InMemoryReviewWorkflowRepository();
  const submissionPackages = new InMemorySubmissionPackageRepository();

  const institution = Institution.create({
    id: 'inst_narratives_app',
    name: 'Narratives Application University',
    code: 'NAU',
  });
  await institutions.save(institution);

  const evidenceManagement = new EvidenceManagementService({
    institutions,
    evidenceItems,
    accreditationFrameworks: {},
    curriculumMapping: {},
  });
  const evidenceReadiness = new WorkflowEvidenceReadinessService({ evidenceManagement });

  const workflowApprovals = new WorkflowApprovalsService({
    cycles,
    workflows,
    institutions,
    evidenceReadiness,
  });

  const reviewCycle = await workflowApprovals.createReviewCycle({
    institutionId: institution.id,
    name: '2026 Phase 4 Cycle',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    programIds: ['program_1'],
    organizationUnitIds: ['org_1'],
  });
  await workflowApprovals.startReviewCycle(reviewCycle.id);

  const evidence = await evidenceManagement.createEvidenceItem({
    id: 'ev_narr_1',
    institutionId: institution.id,
    title: 'Section Evidence',
    description: 'Evidence for report section assembly',
    reviewCycleId: reviewCycle.id,
    evidenceType: evidenceType.NARRATIVE,
    sourceType: evidenceSourceType.MANUAL,
  });
  await evidenceManagement.markEvidenceComplete(evidence.id);
  await evidenceManagement.activateEvidenceItem(evidence.id);

  const sectionWorkflow = await workflowApprovals.createWorkflowInstance({
    reviewCycleId: reviewCycle.id,
    targetType: 'report-section',
    targetId: 'section_2_1',
    reportSectionId: 'section_2_1',
    evidenceItemIds: [evidence.id],
  });

  await workflowApprovals.transitionWorkflowState(
    sectionWorkflow.id,
    reviewWorkflowState.IN_REVIEW,
    workflowActorRole.FACULTY,
  );
  await workflowApprovals.transitionWorkflowState(
    sectionWorkflow.id,
    reviewWorkflowState.APPROVED,
    workflowActorRole.REVIEWER,
  );

  const service = new NarrativesReportingService({
    submissionPackages,
    reviewCycles: workflowApprovals,
    workflowTargets: workflowApprovals,
    evidenceReadiness,
  });

  const submissionPackage = await service.createSubmissionPackage({
    reviewCycleId: reviewCycle.id,
    scopeType: 'report-bundle',
    scopeId: 'phase4-package',
    name: 'Phase 4 submission package',
  });
  assert.equal(submissionPackage.institutionId, institution.id);

  await assert.rejects(
    () =>
      service.createSubmissionPackage({
        reviewCycleId: reviewCycle.id,
        scopeType: 'report-bundle',
        scopeId: 'phase4-package',
      }),
    ValidationError,
    'reviewCycle+scope should be unique',
  );

  const withSection = await service.addSubmissionPackageItem(submissionPackage.id, {
    targetType: 'report-section',
    targetId: 'section_2_1',
    itemType: submissionPackageItemType.REPORT_SECTION,
    assemblyRole: submissionPackageItemAssemblyRole.GOVERNED_SECTION,
    sectionKey: 'sec-2-1',
    sectionTitle: 'Strategic alignment',
    evidenceItemIds: [evidence.id],
  });
  assert.equal(withSection.items.length, 1);
  assert.equal(withSection.items[0].workflowId, sectionWorkflow.id);

  const withEvidenceInclusion = await service.addSubmissionPackageItem(submissionPackage.id, {
    targetType: 'evidence-item',
    targetId: evidence.id,
    itemType: submissionPackageItemType.EVIDENCE_ITEM,
    assemblyRole: submissionPackageItemAssemblyRole.EVIDENCE_INCLUSION,
    sectionKey: 'sec-2-1',
  });
  assert.equal(withEvidenceInclusion.items.length, 2);
  assert.equal(withEvidenceInclusion.items[1].workflowId, null);
  assert.deepEqual(withEvidenceInclusion.items[1].evidenceItemIds, [evidence.id]);

  await assert.rejects(
    () =>
      service.addSubmissionPackageItem(submissionPackage.id, {
        targetType: 'report-section',
        targetId: 'section_9_9',
        itemType: 'report-section',
        sectionKey: 'sec-9-9',
        sectionTitle: 'Missing workflow',
      }),
    ValidationError,
    'section items should require eligible workflow target',
  );

  const snapshot = await service.snapshotSubmissionPackage(submissionPackage.id, {
    milestoneLabel: 'review-ready',
    actorId: 'person_reviewer_1',
  });
  assert.equal(snapshot.versionNumber, 1);
  assert.equal(snapshot.items.length, 2);

  await workflowApprovals.transitionWorkflowState(
    sectionWorkflow.id,
    reviewWorkflowState.SUBMITTED,
    workflowActorRole.ADMIN,
  );

  const finalSnapshot = await service.snapshotSubmissionPackage(submissionPackage.id, {
    milestoneLabel: 'final-submission',
    actorId: 'person_admin_1',
    finalize: true,
  });
  assert.equal(finalSnapshot.finalized, true);

  const finalizedPackage = await service.getSubmissionPackageById(submissionPackage.id);
  assert.equal(finalizedPackage?.status, 'finalized');

  await assert.rejects(
    () => service.removeSubmissionPackageItem(submissionPackage.id, finalizedPackage!.items[0].id),
    ValidationError,
    'finalized package should reject item mutation use cases',
  );

  const context = await service.getSubmissionPackageWithItemContext(submissionPackage.id);
  assert.equal(context.itemContext.length, 2);
  assert.equal(context.itemContext[0].workflowState, 'submitted');
  assert.equal(context.itemContext[0].evidenceSummary?.missingEvidenceItemIds.length, 0);
  assert.equal(context.assembly.sections.length, 1);
  assert.equal(context.assembly.sections[0].includedItemIds.length, 1);
}
