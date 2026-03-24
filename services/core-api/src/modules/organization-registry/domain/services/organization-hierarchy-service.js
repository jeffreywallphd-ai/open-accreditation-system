import { ValidationError } from '../../../shared/kernel/errors.js';

export class OrganizationHierarchyService {
  static assertAcyclic(unitsById, unitId, proposedParentId) {
    if (!proposedParentId) {
      return;
    }

    let current = proposedParentId;
    while (current) {
      if (current === unitId) {
        throw new ValidationError('OrganizationUnit hierarchy must remain acyclic');
      }
      const candidate = unitsById.get(current);
      current = candidate?.parentUnitId ?? null;
    }
  }

  static buildHierarchy(units) {
    const nodeMap = new Map();
    for (const unit of units) {
      nodeMap.set(unit.id, { ...unit, children: [] });
    }

    const roots = [];
    for (const unit of units) {
      const node = nodeMap.get(unit.id);
      if (unit.parentUnitId && nodeMap.has(unit.parentUnitId)) {
        nodeMap.get(unit.parentUnitId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
