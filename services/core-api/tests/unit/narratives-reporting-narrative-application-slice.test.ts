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
import {
  InMemoryNarrativeRepository,
  InMemorySubmissionPackageRepository,
} from '../../src/modules/narratives-reporting/infrastructure/persistence/in-memory-narratives-reporting-repositories.js';
import {
  narrativeEvidenceLinkType,
  narrativePackageLinkType,
  narrativeSectionType,
  narrativeStatus,
} from '../../src/modules/narratives-reporting/domain/value-objects/narrative-statuses.js';
import { ValidationError } from '../../src/modules/shared/kernel/errors.js';

export async function runTests(): Promise<void> {
  const institutions = new InMemoryInstitutionRepository();
  const evidenceItems = new InMemoryEvidenceItemRepository();
  const cycles = new InMemoryReviewCycleRepository();
  const workflows = new InMemoryReviewWorkflowRepository();
  const submissionPackages = new InMemorySubmissionPackageRepository();
  const narratives = new InMemoryNarrativeRepository();

  const institution = Institution.create({
    id: 'inst_narrative_app',
    name: 'Narrative Application University',
    code: 'NAU2',
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
    name: '2026 Narrative App Cycle',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    programIds: ['program_narrative_1'],
    organizationUnitIds: ['org_narrative_1'],
  });
  await workflowApprovals.startReviewCycle(reviewCycle.id);

  const evidence = await evidenceManagement.createEvidenceItem({
    id: 'ev_narrative_app_1',
    institutionId: institution.id,
    title: 'Narrative evidence',
    description: 'Evidence for narrative link validation',
    reviewCycleId: reviewCycle.id,
    evidenceType: evidenceType.NARRATIVE,
    sourceType: evidenceSourceType.MANUAL,
  });
  await evidenceManagement.markEvidenceComplete(evidence.id);
  await evidenceManagement.activateEvidenceItem(evidence.id);

  const sectionWorkflow = await workflowApprovals.createWorkflowInstance({
    reviewCycleId: reviewCycle.id,
    targetType: 'report-section',
    targetId: 'report_sec_1',
    reportSectionId: 'report_sec_1',
    evidenceItemIds: [evidence.id],
  });
  await workflowApprovals.transitionWorkflowState(sectionWorkflow.id, reviewWorkflowState.IN_REVIEW, workflowActorRole.FACULTY);
  await workflowApprovals.transitionWorkflowState(sectionWorkflow.id, reviewWorkflowState.APPROVED, workflowActorRole.REVIEWER);

  const service = new NarrativesReportingService({
    submissionPackages,
    narratives,
    reviewCycles: workflowApprovals,
    workflowTargets: workflowApprovals,
    evidenceReadiness,
  });

  const submissionPackage = await service.createSubmissionPackage({
    reviewCycleId: reviewCycle.id,
    scopeType: 'report-bundle',
    scopeId: 'narrative-phase5',
    name: 'Narrative package',
  });
  const withSection = await service.addSubmissionPackageItem(submissionPackage.id, {
    itemType: 'report-section',
    targetType: 'report-section',
    targetId: 'report_sec_1',
    sectionKey: 'report-sec-1',
    sectionTitle: 'Report section one',
    evidenceItemIds: [evidence.id],
  });
  const packageSectionItemId = withSection.items[0].id;

  const narrative = await service.createNarrative({
    submissionPackageId: submissionPackage.id,
    title: 'Program self-study narrative',
  });
  assert.equal(narrative.status, narrativeStatus.DRAFT);
  assert.equal(narrative.submissionPackageId, submissionPackage.id);

  await assert.rejects(
    () =>
      service.createNarrative({
        submissionPackageId: submissionPackage.id,
        title: 'Duplicate',
      }),
    ValidationError,
    'one narrative per submission package should be enforced',
  );

  const withNarrativeSection = await service.addNarrativeSection(narrative.id, {
    sectionType: narrativeSectionType.REPORT_SECTION,
    sectionKey: 'report-sec-1',
    title: 'Mission and strategic context',
    content: 'Draft narrative text',
  });
  const sectionId = withNarrativeSection.sections[0].id;
  const withMismatchedSection = await service.addNarrativeSection(narrative.id, {
    sectionType: narrativeSectionType.REPORT_SECTION,
    sectionKey: 'report-sec-mismatch',
    title: 'Mismatched section',
  });
  const mismatchSectionId = withMismatchedSection.sections[1].id;

  const withEvidence = await service.linkNarrativeSectionEvidence(narrative.id, sectionId, {
    evidenceItemId: evidence.id,
    relationshipType: narrativeEvidenceLinkType.PRIMARY_SUPPORT,
  });
  assert.equal(withEvidence.sections[0].evidenceLinks.length, 1);

  const withPackageLink = await service.linkNarrativeSectionToPackageItem(narrative.id, sectionId, {
    submissionPackageItemId: packageSectionItemId,
    linkType: narrativePackageLinkType.GOVERNING_SECTION,
  });
  assert.equal(withPackageLink.sections[0].packageLinks.length, 1);

  await assert.rejects(
    () =>
      service.linkNarrativeSectionToPackageItem(narrative.id, mismatchSectionId, {
        submissionPackageItemId: packageSectionItemId,
        linkType: narrativePackageLinkType.GOVERNING_SECTION,
      }),
    ValidationError,
    'governing-section links should enforce sectionKey alignment',
  );

  await assert.rejects(
    () =>
      service.linkNarrativeSectionToPackageItem(narrative.id, sectionId, {
        submissionPackageItemId: packageSectionItemId,
        linkType: narrativePackageLinkType.INCLUDED_ITEM,
      }),
    ValidationError,
    'included-item links should reject governed-section package targets',
  );

  await assert.rejects(
    () =>
      service.linkNarrativeSectionToPackageItem(narrative.id, sectionId, {
        submissionPackageItemId: 'missing_pkg_item',
        linkType: narrativePackageLinkType.INCLUDED_ITEM,
      }),
    ValidationError,
    'package item links should require existing package item ids',
  );

  const inReview = await service.submitNarrativeForReview(narrative.id);
  assert.equal(inReview.status, narrativeStatus.IN_REVIEW);

  const finalized = await service.finalizeNarrative(narrative.id);
  assert.equal(finalized.status, narrativeStatus.FINALIZED);

  await assert.rejects(
    () => service.addNarrativeSection(narrative.id, {
      sectionType: narrativeSectionType.NARRATIVE_SECTION,
      sectionKey: 'post-finalize',
      title: 'Locked',
    }),
    ValidationError,
    'finalized narratives should reject section mutation',
  );
}
