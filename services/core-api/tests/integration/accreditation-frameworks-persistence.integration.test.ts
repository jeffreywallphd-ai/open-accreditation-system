import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCoreApiApp } from '../../src/bootstrap/create-core-api-app.js';
import { ORG_SERVICE } from '../../src/modules/organization-registry/organization-registry.module.js';
import { AFR_SERVICE } from '../../src/modules/accreditation-frameworks/accreditation-frameworks.module.js';
import { CURR_SERVICE } from '../../src/modules/curriculum-mapping/curriculum-mapping.module.js';

function createTempDbPath(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-api-afr-persistence-'));
  return path.join(root, 'core-api.sqlite');
}

export async function runTests(): Promise<void> {
  const databasePath = createTempDbPath();
  const app = await createCoreApiApp({ port: 0, databasePath });

  let cycleId = '';
  let reviewTeamId = '';
  let initialDecisionId = '';

  try {
    const org = app.get(ORG_SERVICE);
    const afr = app.get(AFR_SERVICE);
    const curriculum = app.get(CURR_SERVICE);

    const institution = await org.createInstitution({ name: 'AFR Persistence University', code: 'AFRPU' });
    const person = await org.createPerson({
      institutionId: institution.id,
      displayName: 'Reviewer One',
      primaryEmail: 'reviewer.one@afrpu.edu',
    });
    const unit = await org.createOrganizationUnit({
      institutionId: institution.id,
      name: 'College of Business',
      unitType: 'college',
    });
    const program = await curriculum.createProgram({
      institutionId: institution.id,
      name: 'MBA',
      code: 'MBA',
    });

    const accreditor = await afr.createAccreditor({ code: 'AACSB', name: 'AACSB' });
    const framework = await afr.createFramework({
      accreditorId: accreditor.id,
      code: 'BUS',
      name: 'Business Accreditation',
    });
    const version = await afr.createFrameworkVersion({
      frameworkId: framework.id,
      versionTag: '2026.1',
      effectiveStartDate: '2026-01-01',
    });

    const withStandard = await afr.addStandard(version.id, {
      code: 'STD1',
      title: 'Strategic Management and Innovation',
      sequence: 1,
    });
    const standardId = withStandard.standards[0].id;

    const withCriterion = await afr.addCriterion(version.id, {
      standardId,
      code: 'CR1',
      title: 'Mission and Strategy',
      sequence: 1,
    });
    const criterionId = withCriterion.criteria[0].id;

    const withElement = await afr.addCriterionElement(version.id, {
      criterionId,
      code: 'CE1',
      title: 'Mission Alignment',
      statement: 'Strategy aligns with mission.',
      sequence: 1,
    });
    const elementId = withElement.criterionElements[0].id;

    await afr.addEvidenceRequirement(version.id, {
      requirementCode: 'ER1',
      title: 'Mission Evidence',
      requirementType: 'document',
      criterionId,
      criterionElementId: elementId,
    });

    await afr.publishFrameworkVersion(version.id);

    const cycle = await afr.createAccreditationCycle({
      frameworkVersionId: version.id,
      institutionId: institution.id,
      name: '2026 Review Cycle',
      cycleStartDate: '2026-01-01',
      cycleEndDate: '2026-12-31',
    });
    cycleId = cycle.id;

    await afr.activateAccreditationCycle(cycle.id);

    const profile = await afr.createReviewerProfile({
      personId: person.id,
      institutionId: institution.id,
      reviewerType: 'peer-reviewer',
      expertiseAreas: ['strategy'],
    });

    const team = await afr.createReviewTeam({
      accreditationCycleId: cycle.id,
      institutionId: institution.id,
      name: 'Peer Team A',
    });
    reviewTeamId = team.id;

    const teamWithMembership = await afr.addReviewTeamMembership(team.id, {
      personId: person.id,
      reviewerProfileId: profile.id,
      role: 'chair',
      isPrimary: true,
    });
    assert.equal(teamWithMembership.memberships.length, 1);
    const supersededMembership = await afr.addReviewTeamMembership(team.id, {
      personId: person.id,
      reviewerProfileId: profile.id,
      role: 'chair',
      isPrimary: true,
      effectiveStartDate: '2026-07-01',
      supersedesMembershipId: teamWithMembership.memberships[0].id,
    });
    assert.equal(supersededMembership.memberships.length, 2);
    assert.equal(supersededMembership.memberships[0].state, 'superseded');

    const withScope = await afr.addAccreditationScope(cycle.id, {
      name: 'Business Unit Scope',
      scopeType: 'institutional',
      programIds: [program.id],
      organizationUnitIds: [unit.id],
      effectiveStartDate: '2026-01-01',
      effectiveEndDate: '2026-12-31',
    });
    const scopeId = withScope.scopes[0].id;

    await afr.addCycleMilestone(cycle.id, {
      name: 'Self-study complete',
      dueDate: '2026-04-15',
      scopeId,
    });

    const withEvent = await afr.addReviewEvent(cycle.id, {
      reviewTeamId: team.id,
      scopeId,
      name: 'Site Visit',
      eventType: 'site-visit',
      startDate: '2026-09-10',
      endDate: '2026-09-12',
    });
    const eventId = withEvent.reviewEvents[0].id;

    const withDecision = await afr.issueDecisionRecord(cycle.id, {
      reviewEventId: eventId,
      decisionType: 'commission',
      outcome: 'accredited',
      issuedAt: '2026-10-01T00:00:00.000Z',
    });
    initialDecisionId = withDecision.decisionRecords[0].id;

    const withSuperseded = await afr.supersedeDecisionRecord(cycle.id, initialDecisionId, {
      decisionType: 'commission-correction',
      outcome: 'accredited-with-conditions',
      issuedAt: '2026-10-15T00:00:00.000Z',
    });
    assert.equal(withSuperseded.decisionRecords.length, 2);
    assert.equal(withSuperseded.decisionRecords[0].status, 'superseded');
  } finally {
    await app.close();
  }

  const secondApp = await createCoreApiApp({ port: 0, databasePath });
  try {
    const afr = secondApp.get(AFR_SERVICE);
    const restoredCycle = await afr.getAccreditationCycleById(cycleId);
    const restoredTeam = await afr.getReviewTeamById(reviewTeamId);
    assert.ok(restoredCycle);
    assert.ok(restoredTeam);
    assert.equal(restoredCycle?.decisionRecords.length, 2);
    assert.equal(restoredCycle?.decisionRecords[0].id, initialDecisionId);
    assert.equal(restoredCycle?.scopes[0].scopePrograms.length, 1);
    assert.equal(restoredCycle?.scopes[0].scopeOrganizationUnits.length, 1);
    assert.equal(restoredTeam?.memberships.length, 2);
  } finally {
    await secondApp.close();
  }
}
