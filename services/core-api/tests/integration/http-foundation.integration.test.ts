import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCoreApiApp } from '../../src/bootstrap/create-core-api-app.js';

function createTempDbPath(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-api-http-'));
  return path.join(root, 'core-api.sqlite');
}

export async function runTests(): Promise<void> {
  const app = await createCoreApiApp({
    port: 0,
    databasePath: createTempDbPath(),
  });

  try {
    const createInstitution = await app.inject({
      method: 'POST',
      url: '/organization-registry/institutions',
      payload: {
        name: 'API University',
        code: 'APIU',
      },
    });

    assert.equal(createInstitution.statusCode, 201);
    const institution = createInstitution.json().data;

    const createPerson = await app.inject({
      method: 'POST',
      url: '/organization-registry/people',
      payload: {
        institutionId: institution.id,
        displayName: 'Katherine Johnson',
        primaryEmail: 'katherine@api.edu',
      },
    });

    assert.equal(createPerson.statusCode, 201);
    const person = createPerson.json().data;

    const createUnit = await app.inject({
      method: 'POST',
      url: '/organization-registry/organization-units',
      payload: {
        institutionId: institution.id,
        name: 'School of Computing',
        unitType: 'school',
      },
    });

    assert.equal(createUnit.statusCode, 201);
    const unit = createUnit.json().data;

    const createCommittee = await app.inject({
      method: 'POST',
      url: '/organization-registry/committees',
      payload: {
        institutionId: institution.id,
        name: 'Accreditation Council',
        sponsoringUnitId: unit.id,
      },
    });

    assert.equal(createCommittee.statusCode, 201);

    const createProgram = await app.inject({
      method: 'POST',
      url: '/curriculum-mapping/programs',
      payload: {
        institutionId: institution.id,
        name: 'BS Data Science',
        code: 'BSDS',
      },
    });
    assert.equal(createProgram.statusCode, 201);
    const program = createProgram.json().data;

    const createCourse = await app.inject({
      method: 'POST',
      url: '/curriculum-mapping/courses',
      payload: {
        institutionId: institution.id,
        programId: program.id,
        owningOrganizationUnitId: unit.id,
        name: 'Applied Data Analysis',
        code: 'DS310',
      },
    });
    assert.equal(createCourse.statusCode, 201);
    const course = createCourse.json().data;

    const createOutcome = await app.inject({
      method: 'POST',
      url: '/curriculum-mapping/learning-outcomes',
      payload: {
        institutionId: institution.id,
        code: 'PLO-DS-1',
        title: 'Analyze Data',
        statement: 'Students analyze data using statistical methods.',
        scopeType: 'program',
        programId: program.id,
      },
    });
    assert.equal(createOutcome.statusCode, 201);
    const outcome = createOutcome.json().data;

    const createCourseOutcomeMap = await app.inject({
      method: 'POST',
      url: '/curriculum-mapping/course-outcome-maps',
      payload: {
        courseId: course.id,
        learningOutcomeId: outcome.id,
      },
    });
    assert.equal(createCourseOutcomeMap.statusCode, 201);

    const createAssessment = await app.inject({
      method: 'POST',
      url: '/curriculum-mapping/assessments',
      payload: {
        institutionId: institution.id,
        programId: program.id,
        courseId: course.id,
        name: 'DS310 Final Project Review',
        assessmentType: 'direct',
      },
    });
    assert.equal(createAssessment.statusCode, 201);
    const assessment = createAssessment.json().data;

    const createAssessmentOutcomeLink = await app.inject({
      method: 'POST',
      url: '/curriculum-mapping/assessment-outcome-links',
      payload: {
        assessmentId: assessment.id,
        learningOutcomeId: outcome.id,
      },
    });
    assert.equal(createAssessmentOutcomeLink.statusCode, 201);

    const createAssessmentArtifact = await app.inject({
      method: 'POST',
      url: '/curriculum-mapping/assessment-artifacts',
      payload: {
        institutionId: institution.id,
        assessmentId: assessment.id,
        learningOutcomeId: outcome.id,
        scopeType: 'course',
        scopeEntityId: course.id,
        name: 'Project scoring rubric',
        artifactType: 'rubric',
      },
    });
    assert.equal(createAssessmentArtifact.statusCode, 201);

    const listPeople = await app.inject({
      method: 'GET',
      url: `/organization-registry/people?institutionId=${institution.id}`,
    });

    assert.equal(listPeople.statusCode, 200);
    assert.equal(listPeople.json().data.length, 1);

    const hierarchy = await app.inject({
      method: 'GET',
      url: `/organization-registry/institutions/${institution.id}/hierarchy`,
    });

    assert.equal(hierarchy.statusCode, 200);
    assert.equal(hierarchy.json().data.length, 1);

    const createUser = await app.inject({
      method: 'POST',
      url: '/identity-access/users',
      payload: {
        personId: person.id,
        institutionId: institution.id,
        status: 'active',
      },
    });

    assert.equal(createUser.statusCode, 201);
    const user = createUser.json().data;

    const createRole = await app.inject({
      method: 'POST',
      url: '/identity-access/roles',
      payload: {
        name: 'School Reviewer',
        scopeType: 'organization-unit',
        status: 'active',
      },
    });

    assert.equal(createRole.statusCode, 201);
    const role = createRole.json().data;

    const createPermission = await app.inject({
      method: 'POST',
      url: '/identity-access/permissions',
      payload: {
        key: 'evidence.review',
        name: 'Review Evidence',
        status: 'active',
      },
    });

    assert.equal(createPermission.statusCode, 201);
    const permission = createPermission.json().data;

    const grantPermission = await app.inject({
      method: 'POST',
      url: '/identity-access/role-permission-grants',
      payload: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });

    assert.equal(grantPermission.statusCode, 200);

    const assignRole = await app.inject({
      method: 'POST',
      url: '/identity-access/user-role-assignments',
      payload: {
        userId: user.id,
        roleId: role.id,
        scopeType: 'organization-unit',
        organizationUnitId: unit.id,
        effectiveStartDate: '2026-01-01',
      },
    });

    assert.equal(assignRole.statusCode, 200);
    const firstAssignmentId = assignRole.json().data.roleAssignments[0].id;

    const revokeAssignment = await app.inject({
      method: 'POST',
      url: `/identity-access/user-role-assignments/${firstAssignmentId}/revoke`,
      payload: {
        userId: user.id,
        reason: 'rotation',
        effectiveEndDate: '2026-02-01',
      },
    });

    assert.equal(revokeAssignment.statusCode, 200);

    const effectivePermissions = await app.inject({
      method: 'GET',
      url: `/identity-access/users/${user.id}/effective-permissions?at=2026-03-01T00:00:00.000Z`,
    });

    assert.equal(effectivePermissions.statusCode, 200);
    assert.equal(effectivePermissions.json().data.length, 0);

    const servicePrincipal = await app.inject({
      method: 'POST',
      url: '/identity-access/service-principals',
      payload: {
        name: 'Integration Worker',
        principalType: 'integration',
        clientId: 'integration-worker-1',
      },
    });

    assert.equal(servicePrincipal.statusCode, 201);

    const invalidUser = await app.inject({
      method: 'POST',
      url: '/identity-access/users',
      payload: {
        personId: 'unknown',
        institutionId: institution.id,
      },
    });

    assert.equal(invalidUser.statusCode, 400);
  } finally {
    await app.close();
  }
}
