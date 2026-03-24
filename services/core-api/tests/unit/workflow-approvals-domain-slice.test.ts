import assert from 'node:assert/strict';
import { ValidationError } from '../../src/modules/shared/kernel/errors.js';
import { ReviewCycle } from '../../src/modules/workflow-approvals/domain/entities/review-cycle.js';
import { ReviewWorkflow } from '../../src/modules/workflow-approvals/domain/entities/review-workflow.js';
import {
  reviewCycleStatus,
  reviewWorkflowState,
  workflowActorRole,
} from '../../src/modules/workflow-approvals/domain/value-objects/workflow-statuses.js';

export async function runTests(): Promise<void> {
  assert.throws(
    () =>
      ReviewCycle.create({
        institutionId: 'inst_1',
        name: 'Invalid Date Cycle',
        startDate: '2026-09-01',
        endDate: '2026-09-01',
        programIds: ['program_1'],
      }),
    ValidationError,
    'ReviewCycle should require startDate earlier than endDate',
  );

  const cycle = ReviewCycle.create({
    institutionId: 'inst_1',
    name: '2026 Program Review Cycle',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    programIds: ['program_1'],
    organizationUnitIds: ['org_1'],
    evidenceSetIds: ['set_1'],
  });
  assert.equal(cycle.status, reviewCycleStatus.NOT_STARTED);

  cycle.start();
  assert.equal(cycle.status, reviewCycleStatus.ACTIVE);
  cycle.complete();
  assert.equal(cycle.status, reviewCycleStatus.COMPLETED);
  cycle.archive();
  assert.equal(cycle.status, reviewCycleStatus.ARCHIVED);
  assert.throws(() => cycle.start(), ValidationError, 'archived cycle is terminal');

  const workflow = ReviewWorkflow.create({
    reviewCycleId: 'cycle_1',
    institutionId: 'inst_1',
    targetType: 'report-section',
    targetId: 'section_2_1',
    reportSectionId: 'section_2_1',
    evidenceItemIds: ['evidence_1'],
  });
  assert.equal(workflow.state, reviewWorkflowState.DRAFT);
  assert.equal(workflow.transitionHistory.length, 0);

  workflow.transitionTo(reviewWorkflowState.IN_REVIEW, workflowActorRole.FACULTY, {
    reason: 'Ready for formal review',
  });
  assert.equal(workflow.state, reviewWorkflowState.IN_REVIEW);
  assert.equal(workflow.transitionHistory.length, 1);

  workflow.transitionTo(reviewWorkflowState.REVISION_REQUIRED, workflowActorRole.REVIEWER, {
    reason: 'Need stronger evidence alignment',
  });
  assert.equal(workflow.state, reviewWorkflowState.REVISION_REQUIRED);
  workflow.transitionTo(reviewWorkflowState.DRAFT, workflowActorRole.FACULTY, {
    reason: 'Preparing revision',
  });
  workflow.transitionTo(reviewWorkflowState.IN_REVIEW, workflowActorRole.FACULTY);

  assert.throws(
    () => workflow.transitionTo(reviewWorkflowState.SUBMITTED, workflowActorRole.ADMIN),
    ValidationError,
    'workflow should reject invalid state jumps',
  );

  assert.throws(
    () => workflow.transitionTo(reviewWorkflowState.APPROVED, workflowActorRole.FACULTY),
    ValidationError,
    'role policy should reject unauthorized transitions',
  );

  assert.throws(
    () => workflow.transitionTo(reviewWorkflowState.APPROVED, workflowActorRole.REVIEWER),
    ValidationError,
    'approval should fail when required evidence is insufficient',
  );

  workflow.transitionTo(reviewWorkflowState.APPROVED, workflowActorRole.REVIEWER, {
    evidenceSummary: {
      requiredCount: 1,
      foundCount: 1,
      missingEvidenceItemIds: [],
      incompleteEvidenceItemIds: [],
      inactiveEvidenceItemIds: [],
      unusableEvidenceItemIds: [],
      isSufficient: true,
    },
  });
  assert.equal(workflow.state, reviewWorkflowState.APPROVED);

  assert.throws(
    () => workflow.transitionTo(reviewWorkflowState.SUBMITTED, workflowActorRole.REVIEWER),
    ValidationError,
    'submitted transition is restricted to admin role',
  );

  workflow.transitionTo(reviewWorkflowState.SUBMITTED, workflowActorRole.ADMIN, {
    evidenceSummary: {
      requiredCount: 1,
      foundCount: 1,
      missingEvidenceItemIds: [],
      incompleteEvidenceItemIds: [],
      inactiveEvidenceItemIds: [],
      unusableEvidenceItemIds: [],
      isSufficient: true,
    },
  });
  assert.equal(workflow.state, reviewWorkflowState.SUBMITTED);
}

