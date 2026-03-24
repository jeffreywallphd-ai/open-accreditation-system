import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCoreApiApp } from '../../src/bootstrap/create-core-api-app.js';

function createTempDbPath(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-api-afr-http-'));
  return path.join(root, 'core-api.sqlite');
}

export async function runTests(): Promise<void> {
  const app = await createCoreApiApp({ port: 0, databasePath: createTempDbPath() });

  try {
    const institutionResponse = await app.inject({
      method: 'POST',
      url: '/organization-registry/institutions',
      payload: { name: 'AFR HTTP University', code: 'AFRHU' },
    });
    const institution = institutionResponse.json().data;

    const personResponse = await app.inject({
      method: 'POST',
      url: '/organization-registry/people',
      payload: {
        institutionId: institution.id,
        displayName: 'Reviewer Http',
        primaryEmail: 'reviewer.http@afrhu.edu',
      },
    });
    const person = personResponse.json().data;
    const secondPersonResponse = await app.inject({
      method: 'POST',
      url: '/organization-registry/people',
      payload: {
        institutionId: institution.id,
        displayName: 'Reviewer Http Two',
        primaryEmail: 'reviewer.http.two@afrhu.edu',
      },
    });
    const secondPerson = secondPersonResponse.json().data;

    const unitResponse = await app.inject({
      method: 'POST',
      url: '/organization-registry/organization-units',
      payload: {
        institutionId: institution.id,
        name: 'School of Business',
        unitType: 'school',
      },
    });
    const unit = unitResponse.json().data;
    const programResponse = await app.inject({
      method: 'POST',
      url: '/curriculum-mapping/programs',
      payload: {
        institutionId: institution.id,
        name: 'BSE',
        code: 'BSE',
      },
    });
    assert.equal(programResponse.statusCode, 201);
    const program = programResponse.json().data;

    const accreditorResponse = await app.inject({
      method: 'POST',
      url: '/accreditation-frameworks/accreditors',
      payload: { code: 'ABET', name: 'ABET' },
    });
    assert.equal(accreditorResponse.statusCode, 201);
    const accreditor = accreditorResponse.json().data;

    const frameworkResponse = await app.inject({
      method: 'POST',
      url: '/accreditation-frameworks/frameworks',
      payload: {
        accreditorId: accreditor.id,
        code: 'ENG',
        name: 'Engineering Accreditation',
      },
    });
    assert.equal(frameworkResponse.statusCode, 201);
    const framework = frameworkResponse.json().data;

    const versionResponse = await app.inject({
      method: 'POST',
      url: '/accreditation-frameworks/framework-versions',
      payload: {
        frameworkId: framework.id,
        versionTag: '2026.1',
        effectiveStartDate: '2026-01-01',
      },
    });
    assert.equal(versionResponse.statusCode, 201);
    const version = versionResponse.json().data;

    const standardResponse = await app.inject({
      method: 'POST',
      url: `/accreditation-frameworks/framework-versions/${version.id}/standards`,
      payload: { code: 'S1', title: 'Students', sequence: 1 },
    });
    assert.equal(standardResponse.statusCode, 201);
    const standard = standardResponse.json().data.standards[0];

    const criterionResponse = await app.inject({
      method: 'POST',
      url: `/accreditation-frameworks/framework-versions/${version.id}/criteria`,
      payload: { standardId: standard.id, code: 'C1', title: 'Student Outcomes', sequence: 1 },
    });
    assert.equal(criterionResponse.statusCode, 201);
    const criterion = criterionResponse.json().data.criteria[0];

    const elementResponse = await app.inject({
      method: 'POST',
      url: `/accreditation-frameworks/framework-versions/${version.id}/criterion-elements`,
      payload: {
        criterionId: criterion.id,
        code: 'CE1',
        title: 'Outcome Attainment',
        statement: 'Outcomes are attained and assessed.',
      },
    });
    assert.equal(elementResponse.statusCode, 201);
    const element = elementResponse.json().data.criterionElements[0];

    const evidenceResponse = await app.inject({
      method: 'POST',
      url: `/accreditation-frameworks/framework-versions/${version.id}/evidence-requirements`,
      payload: {
        requirementCode: 'ER1',
        title: 'Outcome Evidence',
        requirementType: 'document',
        criterionId: criterion.id,
        criterionElementId: element.id,
      },
    });
    assert.equal(evidenceResponse.statusCode, 201);

    const publishResponse = await app.inject({
      method: 'POST',
      url: `/accreditation-frameworks/framework-versions/${version.id}/publish`,
    });
    assert.equal(publishResponse.statusCode, 201);

    const cycleResponse = await app.inject({
      method: 'POST',
      url: '/accreditation-frameworks/cycles',
      payload: {
        frameworkVersionId: version.id,
        institutionId: institution.id,
        name: '2026 ABET Review',
        cycleStartDate: '2026-01-01',
        cycleEndDate: '2026-12-31',
      },
    });
    assert.equal(cycleResponse.statusCode, 201);
    const cycle = cycleResponse.json().data;

    const activateResponse = await app.inject({
      method: 'POST',
      url: `/accreditation-frameworks/cycles/${cycle.id}/activate`,
    });
    assert.equal(activateResponse.statusCode, 201);

    const reviewerProfileResponse = await app.inject({
      method: 'POST',
      url: '/accreditation-frameworks/reviewer-profiles',
      payload: {
        personId: person.id,
        institutionId: institution.id,
        reviewerType: 'peer-reviewer',
      },
    });
    assert.equal(reviewerProfileResponse.statusCode, 201);
    const reviewerProfile = reviewerProfileResponse.json().data;
    const secondReviewerProfileResponse = await app.inject({
      method: 'POST',
      url: '/accreditation-frameworks/reviewer-profiles',
      payload: {
        personId: secondPerson.id,
        institutionId: institution.id,
        reviewerType: 'peer-reviewer',
      },
    });
    assert.equal(secondReviewerProfileResponse.statusCode, 201);
    const secondReviewerProfile = secondReviewerProfileResponse.json().data;

    const teamResponse = await app.inject({
      method: 'POST',
      url: '/accreditation-frameworks/review-teams',
      payload: {
        accreditationCycleId: cycle.id,
        institutionId: institution.id,
        name: 'ABET Team',
      },
    });
    assert.equal(teamResponse.statusCode, 201);
    const team = teamResponse.json().data;

    const membershipResponse = await app.inject({
      method: 'POST',
      url: `/accreditation-frameworks/review-teams/${team.id}/memberships`,
      payload: {
        personId: person.id,
        reviewerProfileId: reviewerProfile.id,
        role: 'chair',
        isPrimary: true,
      },
    });
    assert.equal(membershipResponse.statusCode, 201);
    const membership = membershipResponse.json().data.memberships[0];

    const membershipSupersedeResponse = await app.inject({
      method: 'POST',
      url: `/accreditation-frameworks/review-teams/${team.id}/memberships`,
      payload: {
        personId: person.id,
        reviewerProfileId: reviewerProfile.id,
        role: 'chair',
        isPrimary: true,
        effectiveStartDate: '2026-06-01',
        supersedesMembershipId: membership.id,
      },
    });
    assert.equal(membershipSupersedeResponse.statusCode, 201);

    const invalidConflictMembershipResponse = await app.inject({
      method: 'POST',
      url: `/accreditation-frameworks/review-teams/${team.id}/memberships`,
      payload: {
        personId: secondPerson.id,
        reviewerProfileId: secondReviewerProfile.id,
        role: 'observer',
        conflictStatus: 'confirmed',
        state: 'active',
      },
    });
    assert.equal(invalidConflictMembershipResponse.statusCode, 400);

    const scopeResponse = await app.inject({
      method: 'POST',
      url: `/accreditation-frameworks/cycles/${cycle.id}/scopes`,
      payload: {
        name: 'Engineering School',
        scopeType: 'program-and-unit',
        programIds: [program.id],
        organizationUnitIds: [unit.id],
        effectiveStartDate: '2026-01-01',
        effectiveEndDate: '2026-12-31',
      },
    });
    assert.equal(scopeResponse.statusCode, 201);
    const scope = scopeResponse.json().data.scopes[0];

    const milestoneResponse = await app.inject({
      method: 'POST',
      url: `/accreditation-frameworks/cycles/${cycle.id}/milestones`,
      payload: {
        name: 'Readiness Review',
        dueDate: '2026-03-01',
        scopeId: scope.id,
      },
    });
    assert.equal(milestoneResponse.statusCode, 201);

    const eventResponse = await app.inject({
      method: 'POST',
      url: `/accreditation-frameworks/cycles/${cycle.id}/review-events`,
      payload: {
        reviewTeamId: team.id,
        scopeId: scope.id,
        name: 'On-site Visit',
        eventType: 'site-visit',
        startDate: '2026-09-10',
        endDate: '2026-09-12',
      },
    });
    assert.equal(eventResponse.statusCode, 201);
    const reviewEvent = eventResponse.json().data.reviewEvents[0];

    const decisionResponse = await app.inject({
      method: 'POST',
      url: `/accreditation-frameworks/cycles/${cycle.id}/decision-records`,
      payload: {
        reviewEventId: reviewEvent.id,
        decisionType: 'commission',
        outcome: 'accredited',
        issuedAt: '2026-10-01T00:00:00.000Z',
      },
    });
    assert.equal(decisionResponse.statusCode, 201);
    const firstDecision = decisionResponse.json().data.decisionRecords[0];

    const supersedeResponse = await app.inject({
      method: 'POST',
      url: `/accreditation-frameworks/cycles/${cycle.id}/decision-records/${firstDecision.id}/supersede`,
      payload: {
        decisionType: 'commission-correction',
        outcome: 'accredited-with-conditions',
        issuedAt: '2026-10-15T00:00:00.000Z',
      },
    });
    assert.equal(supersedeResponse.statusCode, 201);
    assert.equal(supersedeResponse.json().data.decisionRecords.length, 2);
  } finally {
    await app.close();
  }
}
