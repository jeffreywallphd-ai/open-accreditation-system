import assert from 'node:assert/strict';

import { createCoreApiModules } from '../../src/composition-root.js';

export async function runTests() {
  {
    const modules = createCoreApiModules();
    const org = modules.organizationRegistry.service;

    const institution = await org.createInstitution({
      name: 'Foundational University',
      code: 'FU',
      timezone: 'America/New_York',
    });

    const person = await org.createPerson({
      institutionId: institution.id,
      displayName: 'Ada Lovelace',
      primaryEmail: 'ada@example.edu',
    });

    await org.updatePerson(person.id, { preferredName: 'Ada' });

    const rootUnit = await org.createOrganizationUnit({
      institutionId: institution.id,
      name: 'College of Science',
      unitType: 'college',
    });

    const childUnit = await org.createOrganizationUnit({
      institutionId: institution.id,
      name: 'Department of Computing',
      unitType: 'department',
      parentUnitId: rootUnit.id,
    });

    const committee = await org.createCommittee({
      institutionId: institution.id,
      name: 'Accreditation Steering Committee',
      sponsoringUnitId: rootUnit.id,
    });

    await org.updateCommittee(committee.id, { charterSummary: 'Coordinates institutional accreditation governance.' });

    const hierarchy = await org.getOrganizationUnitHierarchy(institution.id);
    assert.equal(hierarchy.length, 1);
    assert.equal(hierarchy[0].id, rootUnit.id);
    assert.equal(hierarchy[0].children[0].id, childUnit.id);

    const people = await org.listPeople({ institutionId: institution.id });
    assert.equal(people.length, 1);
    assert.equal(people[0].preferredName, 'Ada');

    const committees = await org.listCommittees({ institutionId: institution.id });
    assert.equal(committees.length, 1);
  }

  {
    const modules = createCoreApiModules();
    const org = modules.organizationRegistry.service;
    const iam = modules.identityAccess.service;

    const institution = await org.createInstitution({ name: 'Coastal State', code: 'CS' });
    const unit = await org.createOrganizationUnit({
      institutionId: institution.id,
      name: 'Department of Engineering',
      unitType: 'department',
    });
    await org.createCommittee({
      institutionId: institution.id,
      name: 'Engineering Curriculum Committee',
      sponsoringUnitId: unit.id,
    });

    const person = await org.createPerson({
      institutionId: institution.id,
      displayName: 'Grace Hopper',
      primaryEmail: 'grace@example.edu',
    });

    const user = await iam.createUser({
      personId: person.id,
      institutionId: institution.id,
      email: 'grace.user@example.edu',
      status: 'active',
    });

    const role = await iam.createRole({
      name: 'Department Reviewer',
      scopeType: 'organization-unit',
      status: 'active',
    });

    const permission = await iam.createPermission({
      key: 'submission.approve',
      name: 'Approve submissions',
      status: 'active',
    });

    await iam.grantPermissionToRole({ roleId: role.id, permissionId: permission.id });

    const updatedUser = await iam.assignRoleToUser({
      userId: user.id,
      roleId: role.id,
      scopeType: 'organization-unit',
      organizationUnitId: unit.id,
      effectiveStartDate: '2026-01-15',
    });

    assert.equal(updatedUser.roleAssignments.length, 1);

    const effectivePermissions = await iam.getEffectivePermissionsForUser(user.id, '2026-02-01T00:00:00.000Z');
    assert.equal(effectivePermissions.length, 1);
    assert.equal(effectivePermissions[0].key, 'submission.approve');

    const assignmentId = updatedUser.roleAssignments[0].id;
    await iam.revokeRoleAssignment(user.id, assignmentId, 'rotation', '2026-03-01');

    const noneffective = await iam.getEffectivePermissionsForUser(user.id, '2026-03-15T00:00:00.000Z');
    assert.equal(noneffective.length, 0);
  }
}
