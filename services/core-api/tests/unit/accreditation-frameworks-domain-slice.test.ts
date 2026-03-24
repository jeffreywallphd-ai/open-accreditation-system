import assert from 'node:assert/strict';
import { AccreditationFrameworksService } from '../../src/modules/accreditation-frameworks/application/accreditation-frameworks-service.js';
import {
  InMemoryAccreditationCycleRepository,
  InMemoryAccreditationFrameworkRepository,
  InMemoryAccreditorRepository,
  InMemoryFrameworkVersionRepository,
  InMemoryScopeReferenceAdapter,
} from '../../src/modules/accreditation-frameworks/infrastructure/persistence/in-memory-accreditation-frameworks-repositories.js';
import { ValidationError } from '../../src/modules/shared/kernel/errors.js';
import { FrameworkVersion } from '../../src/modules/accreditation-frameworks/domain/entities/framework-version.js';
import { AccreditationCycle } from '../../src/modules/accreditation-frameworks/domain/entities/accreditation-cycle.js';
import {
  accreditationCycleStatus,
  frameworkVersionStatus,
} from '../../src/modules/accreditation-frameworks/domain/value-objects/accreditation-statuses.js';

function createService() {
  return new AccreditationFrameworksService({
    accreditors: new InMemoryAccreditorRepository(),
    frameworks: new InMemoryAccreditationFrameworkRepository(),
    frameworkVersions: new InMemoryFrameworkVersionRepository(),
    cycles: new InMemoryAccreditationCycleRepository(),
    scopeReferences: new InMemoryScopeReferenceAdapter({
      institutionIds: ['inst_1'],
      programIds: ['prog_1', 'prog_2'],
      organizationUnitIds: ['org_1', 'org_2'],
    }),
  });
}

export async function runTests(): Promise<void> {
  const service = createService();

  const accreditor = await service.createAccreditor({
    code: 'AACSB',
    name: 'AACSB',
  });

  const framework = await service.createFramework({
    accreditorId: accreditor.id,
    code: 'BUSINESS',
    name: 'Business Accreditation',
  });

  const version = await service.createFrameworkVersion({
    frameworkId: framework.id,
    versionTag: '2026.1',
    effectiveStartDate: '2026-01-01',
  });

  const withStandard = await service.addStandard(version.id, {
    code: 'STD1',
    title: 'Strategic Management and Innovation',
    sequence: 1,
  });
  const standard = withStandard.standards[0];

  const withCriterion = await service.addCriterion(version.id, {
    standardId: standard.id,
    code: 'CR1',
    title: 'Mission and Strategy',
    sequence: 1,
  });
  const criterion = withCriterion.criteria[0];

  await assert.rejects(
    () =>
      service.addEvidenceRequirement(version.id, {
        requirementCode: 'ER-BAD',
        title: 'Bad Target',
        requirementType: 'document',
        criterionId: 'missing',
      }),
    ValidationError,
  );

  const withElement = await service.addCriterionElement(version.id, {
    criterionId: criterion.id,
    code: 'CE1',
    title: 'Mission Alignment',
    statement: 'The institution aligns strategy with mission.',
  });
  const element = withElement.criterionElements[0];

  const withSecondCriterion = await service.addCriterion(version.id, {
    standardId: standard.id,
    code: 'CR2',
    title: 'Resource Strategy',
    sequence: 2,
  });
  const secondCriterion = withSecondCriterion.criteria.find((item) => item.code === 'CR2');
  if (!secondCriterion) {
    throw new Error('expected second criterion');
  }

  const withSecondElement = await service.addCriterionElement(version.id, {
    criterionId: secondCriterion.id,
    code: 'CE2',
    title: 'Resource Alignment',
    statement: 'Resources align with strategy.',
  });
  const secondElement = withSecondElement.criterionElements.find((item) => item.code === 'CE2');
  if (!secondElement) {
    throw new Error('expected second criterion element');
  }

  await assert.rejects(
    () =>
      service.addEvidenceRequirement(version.id, {
        requirementCode: 'ER-MISMATCH',
        title: 'Mismatched Target',
        requirementType: 'document',
        criterionId: criterion.id,
        criterionElementId: 'unknown-element',
      }),
    ValidationError,
  );

  const withRequirement = await service.addEvidenceRequirement(version.id, {
    requirementCode: 'ER1',
    title: 'Mission Artifacts',
    requirementType: 'document',
    criterionElementId: element.id,
    cardinalityRule: 'one-per-cycle',
  });

  assert.equal(withRequirement.evidenceRequirements.length, 1);

  const published = await service.publishFrameworkVersion(version.id);
  assert.equal(published.status, 'published');

  await assert.rejects(
    () =>
      service.addStandard(version.id, {
        code: 'STD2',
        title: 'Post-publication update',
      }),
    ValidationError,
  );

  const cycle = await service.createAccreditationCycle({
    frameworkVersionId: version.id,
    institutionId: 'inst_1',
    name: '2026 Continuous Review',
    cycleStartDate: '2026-01-01',
    cycleEndDate: '2026-12-31',
  });

  await assert.rejects(
    () =>
      service.addAccreditationScope(cycle.id, {
        name: 'Invalid Scope',
        scopeType: 'program-cluster',
      }),
    ValidationError,
  );

  await assert.rejects(
    () =>
      service.addAccreditationScope(cycle.id, {
        name: 'Missing Program Scope',
        scopeType: 'program-cluster',
        programIds: ['prog_missing'],
      }),
    ValidationError,
  );

  const activated = await service.activateAccreditationCycle(cycle.id);
  assert.equal(activated.status, 'active');

  const withScope = await service.addAccreditationScope(cycle.id, {
    name: 'Primary Program Scope',
    scopeType: 'program-cluster',
    programIds: ['prog_1'],
    organizationUnitIds: ['org_1'],
    effectiveStartDate: '2026-01-01',
    effectiveEndDate: '2026-12-31',
  });

  const scope = withScope.scopes[0];

  await assert.rejects(
    () =>
      service.addCycleMilestone(cycle.id, {
        name: 'Out of range milestone',
        dueDate: '2027-01-10',
      }),
    ValidationError,
  );

  const withMilestone = await service.addCycleMilestone(cycle.id, {
    name: 'Self-study completion',
    dueDate: '2026-05-01',
    scopeId: scope.id,
  });
  assert.equal(withMilestone.milestones.length, 1);

  await assert.rejects(
    () =>
      service.addReviewEvent(cycle.id, {
        name: 'Invalid range event',
        eventType: 'site-visit',
        startDate: '2026-09-10',
        endDate: '2026-09-01',
        scopeId: scope.id,
      }),
    ValidationError,
  );

  const withEvent = await service.addReviewEvent(cycle.id, {
    name: 'Site Visit',
    eventType: 'site-visit',
    startDate: '2026-09-10',
    endDate: '2026-09-12',
    scopeId: scope.id,
  });
  const reviewEvent = withEvent.reviewEvents[0];

  const withDecision = await service.issueDecisionRecord(cycle.id, {
    decisionType: 'commission',
    outcome: 'accredited',
    reviewEventId: reviewEvent.id,
    rationale: 'Criteria satisfied.',
    issuedAt: '2026-10-01T00:00:00.000Z',
  });
  assert.equal(withDecision.decisionRecords.length, 1);
  assert.equal(withDecision.status, 'decision-issued');

  const firstDecision = withDecision.decisionRecords[0];

  const withSupersedingDecision = await service.issueDecisionRecord(cycle.id, {
    decisionType: 'commission-correction',
    outcome: 'accredited-with-conditions',
    supersedesDecisionRecordId: firstDecision.id,
    issuedAt: '2026-10-10T00:00:00.000Z',
  });

  assert.equal(withSupersedingDecision.decisionRecords.length, 2);
  assert.equal(withSupersedingDecision.decisionRecords[0].status, 'superseded');
  assert.equal(
    withSupersedingDecision.decisionRecords[0].supersededByDecisionRecordId,
    withSupersedingDecision.decisionRecords[1].id,
  );

  await assert.rejects(
    () =>
      service.issueDecisionRecord(cycle.id, {
        decisionType: 'invalid-double-supersede',
        outcome: 'denied',
        supersedesDecisionRecordId: firstDecision.id,
      }),
    ValidationError,
  );

  await assert.rejects(
    () =>
      service.addEvidenceRequirement(version.id, {
        requirementCode: 'ER-CROSS',
        title: 'Cross Parent Target',
        requirementType: 'document',
        criterionId: criterion.id,
        criterionElementId: secondElement.id,
      }),
    ValidationError,
  );

  await assert.rejects(
    () =>
      new FrameworkVersion({
        id: 'fwv_integrity',
        frameworkId: 'fw_a',
        versionTag: '2026.2',
        status: frameworkVersionStatus.DRAFT,
        standards: [
          {
            id: 'std_integrity',
            frameworkVersionId: 'fwv_integrity',
            code: 'S1',
            title: 'Standard 1',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        criteria: [
          {
            id: 'crit_cross',
            frameworkVersionId: 'fwv_integrity',
            standardId: 'std_other',
            code: 'C1',
            title: 'Criterion 1',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        criterionElements: [],
        evidenceRequirements: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ValidationError,
  );

  await assert.rejects(
    () =>
      new AccreditationCycle({
        id: 'cycle_integrity',
        frameworkVersionId: version.id,
        institutionId: 'inst_1',
        name: 'Invalid Rehydrated Cycle',
        cycleStartDate: '2026-01-01',
        cycleEndDate: '2026-12-31',
        status: accreditationCycleStatus.ACTIVE,
        scopes: [
          {
            id: 'scope_cross',
            accreditationCycleId: 'cycle_other',
            name: 'Cross Cycle Scope',
            scopeType: 'program-cluster',
            status: 'draft',
            programIds: ['prog_1'],
            organizationUnitIds: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        milestones: [],
        reviewEvents: [],
        decisionRecords: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ValidationError,
  );

  const mutableVersion = await service.createFrameworkVersion({
    frameworkId: framework.id,
    versionTag: '2026.3',
  });
  const readOne = await service.getFrameworkVersionById(mutableVersion.id);
  if (!readOne) {
    throw new Error('expected framework version');
  }
  readOne.versionTag = 'tampered';
  const readTwo = await service.getFrameworkVersionById(mutableVersion.id);
  assert.equal(readTwo?.versionTag, '2026.3');
}
