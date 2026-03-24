import assert from 'node:assert/strict';

import { OrganizationUnit } from '../../src/modules/organization-registry/domain/entities/organization-unit.js';
import { OrganizationHierarchyService } from '../../src/modules/organization-registry/domain/services/organization-hierarchy-service.js';
import { ValidationError } from '../../src/modules/shared/kernel/errors.js';
import { User } from '../../src/modules/identity-access/domain/entities/user.js';

export async function runTests(): Promise<void> {
  assert.throws(
    () =>
      OrganizationUnit.create({
        id: 'orgu_self',
        institutionId: 'inst_1',
        name: 'Self Unit',
        unitType: 'department',
        parentUnitId: 'orgu_self',
      }),
    ValidationError,
  );

  const unitsById = new Map([
    ['a', { id: 'a', parentUnitId: null }],
    ['b', { id: 'b', parentUnitId: 'a' }],
    ['c', { id: 'c', parentUnitId: 'b' }],
  ]);

  assert.throws(() => OrganizationHierarchyService.assertAcyclic(unitsById, 'a', 'c'), ValidationError);

  const user = User.create({
    id: 'user_1',
    personId: 'person_1',
    institutionId: 'inst_1',
    status: 'active',
  });

  const first = user.assignRole({
    roleId: 'role_1',
    scopeType: 'institution',
    institutionId: 'inst_1',
    effectiveStartDate: '2026-01-01',
  });

  const second = user.assignRole({
    roleId: 'role_1',
    scopeType: 'institution',
    institutionId: 'inst_1',
    effectiveStartDate: '2026-02-01',
  });

  assert.equal(user.roleAssignments.length, 2);
  assert.equal(first.state, 'superseded');
  assert.equal(first.supersededByAssignmentId, second.id);
  assert.equal(second.state, 'active');
}
