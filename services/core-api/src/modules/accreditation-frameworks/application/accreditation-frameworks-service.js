import { NotFoundError, ValidationError } from '../../shared/kernel/errors.js';
import { AccreditationCycle } from '../domain/entities/accreditation-cycle.js';
import { AccreditationFramework } from '../domain/entities/accreditation-framework.js';
import { Accreditor } from '../domain/entities/accreditor.js';
import { FrameworkVersion } from '../domain/entities/framework-version.js';
import { frameworkVersionStatus } from '../domain/value-objects/accreditation-statuses.js';

export class AccreditationFrameworksService {
  constructor(deps) {
    this.accreditors = deps.accreditors;
    this.frameworks = deps.frameworks;
    this.frameworkVersions = deps.frameworkVersions;
    this.cycles = deps.cycles;
    this.scopeReferences = deps.scopeReferences;
  }

  async createAccreditor(input) {
    const accreditor = Accreditor.create(input);
    return this.accreditors.save(accreditor);
  }

  async createFramework(input) {
    const accreditor = await this.accreditors.getById(input.accreditorId);
    if (!accreditor) {
      throw new ValidationError(`Accreditor not found: ${input.accreditorId}`);
    }
    const framework = AccreditationFramework.create(input);
    return this.frameworks.save(framework);
  }

  async createFrameworkVersion(input) {
    const framework = await this.frameworks.getById(input.frameworkId);
    if (!framework) {
      throw new ValidationError(`AccreditationFramework not found: ${input.frameworkId}`);
    }

    const existingVersion = await this.frameworkVersions.getByFrameworkIdAndVersionTag(input.frameworkId, input.versionTag);
    if (existingVersion) {
      throw new ValidationError(`FrameworkVersion versionTag already exists for framework: ${input.versionTag}`);
    }

    const version = FrameworkVersion.create(input);
    return this.frameworkVersions.save(version);
  }

  async addStandard(frameworkVersionId, input) {
    const version = await this.#requireFrameworkVersion(frameworkVersionId);
    version.addStandard(input);
    return this.frameworkVersions.save(version);
  }

  async addCriterion(frameworkVersionId, input) {
    const version = await this.#requireFrameworkVersion(frameworkVersionId);
    version.addCriterion(input);
    return this.frameworkVersions.save(version);
  }

  async addCriterionElement(frameworkVersionId, input) {
    const version = await this.#requireFrameworkVersion(frameworkVersionId);
    version.addCriterionElement(input);
    return this.frameworkVersions.save(version);
  }

  async addEvidenceRequirement(frameworkVersionId, input) {
    const version = await this.#requireFrameworkVersion(frameworkVersionId);
    version.addEvidenceRequirement(input);
    return this.frameworkVersions.save(version);
  }

  async publishFrameworkVersion(frameworkVersionId) {
    const version = await this.#requireFrameworkVersion(frameworkVersionId);
    version.publish();
    return this.frameworkVersions.save(version);
  }

  async createAccreditationCycle(input) {
    const frameworkVersion = await this.#requireFrameworkVersion(input.frameworkVersionId);
    if (frameworkVersion.status !== frameworkVersionStatus.PUBLISHED) {
      throw new ValidationError('AccreditationCycle requires a published FrameworkVersion');
    }

    await this.scopeReferences.ensureInstitutionExists(input.institutionId);
    const cycle = AccreditationCycle.create(input);
    return this.cycles.save(cycle);
  }

  async activateAccreditationCycle(cycleId) {
    const cycle = await this.#requireCycle(cycleId);
    cycle.activate();
    return this.cycles.save(cycle);
  }

  async addAccreditationScope(cycleId, input) {
    const cycle = await this.#requireCycle(cycleId);

    const programIds = input.programIds ?? [];
    const organizationUnitIds = input.organizationUnitIds ?? [];
    if (programIds.length > 0) {
      await this.scopeReferences.ensureProgramsExist(programIds);
    }
    if (organizationUnitIds.length > 0) {
      await this.scopeReferences.ensureOrganizationUnitsExist(organizationUnitIds);
    }

    cycle.addScope(input);
    return this.cycles.save(cycle);
  }

  async addCycleMilestone(cycleId, input) {
    const cycle = await this.#requireCycle(cycleId);
    cycle.addMilestone(input);
    return this.cycles.save(cycle);
  }

  async addReviewEvent(cycleId, input) {
    const cycle = await this.#requireCycle(cycleId);
    cycle.addReviewEvent(input);
    return this.cycles.save(cycle);
  }

  async issueDecisionRecord(cycleId, input) {
    const cycle = await this.#requireCycle(cycleId);
    cycle.issueDecision(input);
    return this.cycles.save(cycle);
  }

  async getFrameworkVersionById(id) {
    return this.frameworkVersions.getById(id);
  }

  async getAccreditationCycleById(id) {
    return this.cycles.getById(id);
  }

  async #requireFrameworkVersion(id) {
    const version = await this.frameworkVersions.getById(id);
    if (!version) {
      throw new NotFoundError('FrameworkVersion', id);
    }
    return version;
  }

  async #requireCycle(id) {
    const cycle = await this.cycles.getById(id);
    if (!cycle) {
      throw new NotFoundError('AccreditationCycle', id);
    }
    return cycle;
  }
}
