import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCoreApiApp } from '../../src/bootstrap/create-core-api-app.js';
import { ORG_SERVICE } from '../../src/modules/organization-registry/organization-registry.module.js';
import { IAM_SERVICE } from '../../src/modules/identity-access/identity-access.module.js';
import { ValidationError } from '../../src/modules/shared/kernel/errors.js';

function createTempDbPath(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'core-api-foundation-'));
  return path.join(root, 'core-api.sqlite');
}

export async function runTests(): Promise<void> {
  const databasePath = createTempDbPath();

  const app1 = await createCoreApiApp({ port: 0, databasePath });
  try {
    const org = app1.get(ORG_SERVICE);
    const iam = app1.get(IAM_SERVICE);

    const institution = await org.createInstitution({
      name: 'Persistence University',
      code: 'PERSIST',
      timezone: 'America/New_York',
    });

    const person = await org.createPerson({
      institutionId: institution.id,
      displayName: 'Ada Lovelace',
      primaryEmail: 'ada@persist.edu',
    });

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

    await assert.rejects(
      () =>
        org.updateOrganizationUnit(rootUnit.id, {
          parentUnitId: childUnit.id,
        }),
      ValidationError,
    );

    await assert.rejects(
      () =>
        iam.createUser({
          personId: 'missing-person',
          institutionId: institution.id,
        }),
      ValidationError,
    );

    await assert.rejects(
      () =>
        iam.createUser({
          personId: person.id,
          institutionId: 'missing-institution',
        }),
      ValidationError,
    );

    const user = await iam.createUser({
      personId: person.id,
      institutionId: institution.id,
      email: 'ada.user@persist.edu',
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

    await iam.assignRoleToUser({
      userId: user.id,
      roleId: role.id,
      scopeType: 'organization-unit',
      organizationUnitId: rootUnit.id,
      effectiveStartDate: '2026-01-01',
    });

    const userAfterSecond = await iam.assignRoleToUser({
      userId: user.id,
      roleId: role.id,
      scopeType: 'organization-unit',
      organizationUnitId: rootUnit.id,
      effectiveStartDate: '2026-02-01',
    });

    assert.equal(userAfterSecond.roleAssignments.length, 2);
    assert.equal(userAfterSecond.roleAssignments[0].state, 'superseded');
    assert.equal(userAfterSecond.roleAssignments[1].state, 'active');

    const effectivePermissions = await iam.getEffectivePermissionsForUser(user.id, '2026-03-01T00:00:00.000Z');
    assert.equal(effectivePermissions.length, 1);
    assert.equal(effectivePermissions[0].key, 'submission.approve');
  } finally {
    await app1.close();
  }

  const app2 = await createCoreApiApp({ port: 0, databasePath });
  try {
    const org = app2.get(ORG_SERVICE);
    const iam = app2.get(IAM_SERVICE);

    const institutions = await org.listInstitutions({ code: 'PERSIST' });
    assert.equal(institutions.length, 1);

    const people = await org.listPeople({ institutionId: institutions[0].id });
    assert.equal(people.length, 1);

    const users = await iam.listUsers({ institutionId: institutions[0].id });
    assert.equal(users.length, 1);

    const effectivePermissions = await iam.getEffectivePermissionsForUser(users[0].id, '2026-03-01T00:00:00.000Z');
    assert.equal(effectivePermissions.length, 1);
    assert.equal(effectivePermissions[0].key, 'submission.approve');
  } finally {
    await app2.close();
  }
}
