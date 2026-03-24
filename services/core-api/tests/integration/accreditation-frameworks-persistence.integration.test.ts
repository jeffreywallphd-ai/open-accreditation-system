import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCoreApiApp } from '../../src/bootstrap/create-core-api-app.js';
import { DATABASE_CONNECTION } from '../../src/infrastructure/persistence/persistence.tokens.js';
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

  let institutionId = '';
  let cycleId = '';
  let secondaryCycleId = '';
  let reviewTeamId = '';
  let secondaryReviewTeamId = '';
  let reviewerProfileId = '';
  let initialDecisionId = '';
  let supersedingDecisionId = '';
  let frameworkId = '';
  let versionId = '';
  let secondVersionId = '';
  let secondVersionStandardId = '';

  try {
    const org = app.get(ORG_SERVICE);
    const afr = app.get(AFR_SERVICE);
    const curriculum = app.get(CURR_SERVICE);

    const institution = await org.createInstitution({ name: 'AFR Persistence University', code: 'AFRPU' });
    institutionId = institution.id;

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
    frameworkId = framework.id;

    const version = await afr.createFrameworkVersion({
      frameworkId: framework.id,
      versionTag: '2026.1',
      effectiveStartDate: '2026-01-01',
    });
    versionId = version.id;

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

    await assert.rejects(
      () =>
        afr.addStandard(version.id, {
          code: 'STD2',
          title: 'Post-publication mutation',
        }),
      /immutable unless status is draft/,
    );

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
    reviewerProfileId = profile.id;

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

    await afr.addReportingPeriod(cycle.id, {
      name: 'Spring 2026',
      periodType: 'semester',
      startDate: '2026-01-15',
      endDate: '2026-05-15',
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
    supersedingDecisionId = withSuperseded.decisionRecords[1].id;

    const secondaryCycle = await afr.createAccreditationCycle({
      frameworkVersionId: version.id,
      institutionId: institution.id,
      name: '2027 Review Cycle',
      cycleStartDate: '2027-01-01',
      cycleEndDate: '2027-12-31',
    });
    secondaryCycleId = secondaryCycle.id;
    await afr.activateAccreditationCycle(secondaryCycle.id);

    const secondaryReviewTeam = await afr.createReviewTeam({
      accreditationCycleId: secondaryCycle.id,
      institutionId: institution.id,
      name: 'Peer Team B',
    });
    secondaryReviewTeamId = secondaryReviewTeam.id;

    const secondVersion = await afr.createFrameworkVersion({
      frameworkId: framework.id,
      versionTag: '2026.2',
      effectiveStartDate: '2026-06-01',
    });
    secondVersionId = secondVersion.id;
    const secondVersionWithStandard = await afr.addStandard(secondVersion.id, {
      code: 'STD2',
      title: 'Engagement and Impact',
      sequence: 1,
    });
    secondVersionStandardId = secondVersionWithStandard.standards[0].id;
  } finally {
    await app.close();
  }

  const secondApp = await createCoreApiApp({ port: 0, databasePath });
  try {
    const afr = secondApp.get(AFR_SERVICE);
    const db = secondApp.get(DATABASE_CONNECTION);

    const restoredCycle = await afr.getAccreditationCycleById(cycleId);
    const restoredTeam = await afr.getReviewTeamById(reviewTeamId);
    assert.ok(restoredCycle);
    assert.ok(restoredTeam);
    assert.equal(restoredCycle?.decisionRecords.length, 2);
    assert.equal(restoredCycle?.reportingPeriods.length, 1);
    assert.equal(restoredCycle?.decisionRecords[0].id, initialDecisionId);
    assert.equal(restoredCycle?.scopes[0].scopePrograms.length, 1);
    assert.equal(restoredCycle?.scopes[0].scopeOrganizationUnits.length, 1);
    assert.equal(restoredTeam?.memberships.length, 2);

    const frameworkVersions = await afr.listFrameworkVersions({ frameworkId });
    assert.equal(frameworkVersions.length, 2);
    const cyclesByInstitution = await afr.listAccreditationCycles({ institutionId });
    assert.equal(cyclesByInstitution.length, 2);
    const reviewTeamsByCycle = await afr.listReviewTeams({ accreditationCycleId: cycleId });
    assert.equal(reviewTeamsByCycle.length, 1);
    const reviewerProfiles = await afr.listReviewerProfiles({ institutionId });
    assert.equal(reviewerProfiles.length, 1);
    assert.equal(reviewerProfiles[0].id, reviewerProfileId);

    db.run(
      `INSERT INTO accreditation_frameworks_criteria
       (id, framework_version_id, standard_id, code, title, statement, sequence, created_at, updated_at)
       VALUES (@id, @frameworkVersionId, @standardId, @code, @title, @statement, @sequence, @createdAt, @updatedAt)`,
      {
        id: 'crit_cross_version',
        frameworkVersionId: versionId,
        standardId: secondVersionStandardId,
        code: 'CRX',
        title: 'Cross-version criterion',
        statement: 'Invalid parent reference.',
        sequence: 99,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      },
    );

    await assert.rejects(() => afr.getFrameworkVersionById(versionId), /Criterion.standardId not found in FrameworkVersion/);

    db.run('DELETE FROM accreditation_frameworks_criteria WHERE id = @id', { id: 'crit_cross_version' });

    db.run(
      `INSERT INTO accreditation_frameworks_review_events
       (id, accreditation_cycle_id, review_team_id, scope_id, name, event_type, start_date, end_date, status, created_at, updated_at)
       VALUES (@id, @cycleId, @reviewTeamId, @scopeId, @name, @eventType, @startDate, @endDate, @status, @createdAt, @updatedAt)`,
      {
        id: 'rev_cross_cycle',
        cycleId,
        reviewTeamId: secondaryReviewTeamId,
        scopeId: null,
        name: 'Cross-cycle injected event',
        eventType: 'site-visit',
        startDate: '2026-11-01',
        endDate: '2026-11-02',
        status: 'planned',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      },
    );

    await assert.rejects(
      () => afr.getAccreditationCycleById(cycleId),
      /ReviewEvent\.reviewTeamId must reference a ReviewTeam in the same AccreditationCycle/,
    );

    db.run('DELETE FROM accreditation_frameworks_review_events WHERE id = @id', { id: 'rev_cross_cycle' });

    db.run(
      `UPDATE accreditation_frameworks_decision_records
       SET superseded_by_decision_record_id = @missing, updated_at = @updatedAt
       WHERE id = @id`,
      {
        id: initialDecisionId,
        missing: 'dec_missing',
        updatedAt: '2026-11-02T00:00:00.000Z',
      },
    );

    await assert.rejects(() => afr.getAccreditationCycleById(cycleId), /DecisionRecord\.supersededByDecisionRecordId not found/);

    db.run(
      `UPDATE accreditation_frameworks_decision_records
       SET superseded_by_decision_record_id = @supersedingId, updated_at = @updatedAt
       WHERE id = @id`,
      {
        id: initialDecisionId,
        supersedingId: supersedingDecisionId,
        updatedAt: '2026-11-02T00:00:00.000Z',
      },
    );

    db.run(
      `INSERT INTO accreditation_frameworks_review_team_memberships
       (id, review_team_id, person_id, reviewer_profile_id, role, responsibility_summary, is_primary, state,
        conflict_status, effective_start_date, effective_end_date, supersedes_membership_id, superseded_by_membership_id, created_at, updated_at)
       VALUES (@id, @reviewTeamId, @personId, @reviewerProfileId, @role, @responsibilitySummary, @isPrimary, @state,
        @conflictStatus, @effectiveStartDate, @effectiveEndDate, @supersedesMembershipId, @supersededByMembershipId, @createdAt, @updatedAt)`,
      {
        id: 'rtm_invalid_superseded',
        reviewTeamId,
        personId: reviewTeamsByCycle[0].memberships[0].personId,
        reviewerProfileId,
        role: 'observer',
        responsibilitySummary: null,
        isPrimary: 0,
        state: 'superseded',
        conflictStatus: 'none',
        effectiveStartDate: '2026-08-01',
        effectiveEndDate: '2026-09-01',
        supersedesMembershipId: null,
        supersededByMembershipId: null,
        createdAt: '2026-11-03T00:00:00.000Z',
        updatedAt: '2026-11-03T00:00:00.000Z',
      },
    );

    await assert.rejects(() => afr.getReviewTeamById(reviewTeamId), /Superseded ReviewTeamMembership must include supersededByMembershipId/);

    db.run('DELETE FROM accreditation_frameworks_review_team_memberships WHERE id = @id', { id: 'rtm_invalid_superseded' });

    const verifiedCycle = await afr.getAccreditationCycleById(cycleId);
    const verifiedTeam = await afr.getReviewTeamById(reviewTeamId);
    assert.ok(verifiedCycle);
    assert.ok(verifiedTeam);
    assert.ok(secondaryCycleId);
    assert.ok(secondVersionId);
  } finally {
    await secondApp.close();
  }
}
