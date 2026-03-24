import assert from 'node:assert/strict';

import { createCoreApiModules } from '../../src/composition-root.js';

export async function runTests() {
  {
    const modules = createCoreApiModules();
    const api = modules.organizationRegistry.api;

    const invalid = await api.createInstitution({});
    assert.equal(invalid.statusCode, 400);

    const createdInstitution = await api.createInstitution({ name: 'API University' });
    assert.equal(createdInstitution.statusCode, 201);

    const createdPerson = await api.createPerson({
      institutionId: createdInstitution.data.id,
      displayName: 'Katherine Johnson',
      primaryEmail: 'katherine@example.edu',
    });

    assert.equal(createdPerson.statusCode, 201);

    const people = await api.listPeople({ institutionId: createdInstitution.data.id });
    assert.equal(people.statusCode, 200);
    assert.equal(people.data.length, 1);
  }

  {
    const modules = createCoreApiModules();
    const orgApi = modules.organizationRegistry.api;
    const iamApi = modules.identityAccess.api;

    const institution = (await orgApi.createInstitution({ name: 'API Coastal Institute' })).data;
    const unit = (
      await orgApi.createOrganizationUnit({
        institutionId: institution.id,
        name: 'School of Computing',
        unitType: 'school',
      })
    ).data;
    const person = (
      await orgApi.createPerson({
        institutionId: institution.id,
        displayName: 'Alan Turing',
        primaryEmail: 'alan@example.edu',
      })
    ).data;

    const user = (
      await iamApi.createUser({
        personId: person.id,
        institutionId: institution.id,
        status: 'active',
      })
    ).data;

    const role = (
      await iamApi.createRole({
        name: 'School Reviewer',
        scopeType: 'organization-unit',
        status: 'active',
      })
    ).data;

    const permission = (
      await iamApi.createPermission({
        key: 'evidence.review',
        name: 'Review Evidence',
        status: 'active',
      })
    ).data;

    const grant = await iamApi.grantPermissionToRole({
      roleId: role.id,
      permissionId: permission.id,
    });
    assert.equal(grant.statusCode, 200);

    const assignment = await iamApi.assignRoleToUser({
      userId: user.id,
      roleId: role.id,
      scopeType: 'organization-unit',
      organizationUnitId: unit.id,
      effectiveStartDate: '2026-01-01',
    });
    assert.equal(assignment.statusCode, 200);

    const effective = await iamApi.getEffectivePermissionsForUser(user.id, '2026-02-01T00:00:00.000Z');
    assert.equal(effective.statusCode, 200);
    assert.equal(effective.data.length, 1);
    assert.equal(effective.data[0].key, 'evidence.review');
  }
}
