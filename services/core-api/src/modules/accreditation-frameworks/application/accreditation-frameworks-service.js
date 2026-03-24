import { NotFoundError, ValidationError } from '../../shared/kernel/errors.js';
import { AccreditationCycle } from '../domain/entities/accreditation-cycle.js';
import { AccreditationFramework } from '../domain/entities/accreditation-framework.js';
import { Accreditor } from '../domain/entities/accreditor.js';
import { FrameworkVersion } from '../domain/entities/framework-version.js';
import { ReviewerProfile } from '../domain/entities/reviewer-profile.js';
import { ReviewTeam } from '../domain/entities/review-team.js';
import { frameworkVersionStatus } from '../domain/value-objects/accreditation-statuses.js';

export class AccreditationFrameworksService {
  constructor(deps) {
    this.accreditors = deps.accreditors;
    this.frameworks = deps.frameworks;
    this.frameworkVersions = deps.frameworkVersions;
    this.cycles = deps.cycles;
    this.reviewerProfiles = deps.reviewerProfiles;
    this.reviewTeams = deps.reviewTeams;
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
      await this.scopeReferences.ensureProgramsExistForInstitution(programIds, cycle.institutionId);
    }
    if (organizationUnitIds.length > 0) {
      await this.scopeReferences.ensureOrganizationUnitsExistForInstitution(organizationUnitIds, cycle.institutionId);
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
    if (input.reviewTeamId) {
      const reviewTeam = await this.#requireReviewTeam(input.reviewTeamId);
      if (reviewTeam.accreditationCycleId !== cycleId) {
        throw new ValidationError('ReviewEvent.reviewTeamId must reference a ReviewTeam in the same AccreditationCycle');
      }
    }
    cycle.addReviewEvent(input);
    return this.cycles.save(cycle);
  }

  async issueDecisionRecord(cycleId, input) {
    const cycle = await this.#requireCycle(cycleId);
    cycle.issueDecision(input);
    return this.cycles.save(cycle);
  }

  async supersedeDecisionRecord(cycleId, supersededDecisionRecordId, input) {
    const cycle = await this.#requireCycle(cycleId);
    cycle.supersedeDecision(supersededDecisionRecordId, input);
    return this.cycles.save(cycle);
  }

  async createReviewerProfile(input) {
    await this.scopeReferences.ensurePersonInInstitution(input.personId, input.institutionId);
    await this.scopeReferences.ensureInstitutionExists(input.institutionId);

    const existing = await this.reviewerProfiles.getByPersonId(input.personId);
    if (existing) {
      throw new ValidationError(`ReviewerProfile already exists for personId: ${input.personId}`);
    }

    const profile = ReviewerProfile.create(input);
    return this.reviewerProfiles.save(profile);
  }

  async createReviewTeam(input) {
    const cycle = await this.#requireCycle(input.accreditationCycleId);
    await this.scopeReferences.ensureInstitutionExists(input.institutionId);
    if (cycle.institutionId !== input.institutionId) {
      throw new ValidationError('ReviewTeam.institutionId must match AccreditationCycle.institutionId');
    }

    const team = ReviewTeam.create({
      ...input,
      status: input.status === 'active' ? 'draft' : input.status,
    });
    if (input.status === 'active') {
      team.activate();
    }
    return this.reviewTeams.save(team);
  }

  async addReviewTeamMembership(reviewTeamId, input) {
    const team = await this.#requireReviewTeam(reviewTeamId);
    const cycle = await this.#requireCycle(team.accreditationCycleId);
    await this.scopeReferences.ensurePersonInInstitution(input.personId, team.institutionId);

    if (input.reviewerProfileId) {
      const profile = await this.#requireReviewerProfile(input.reviewerProfileId);
      if (profile.personId !== input.personId) {
        throw new ValidationError('ReviewTeamMembership.personId must match ReviewerProfile.personId');
      }
      if (profile.institutionId !== team.institutionId) {
        throw new ValidationError('ReviewTeamMembership.reviewerProfileId must belong to ReviewTeam institution');
      }
    }

    if (cycle.institutionId !== team.institutionId) {
      throw new ValidationError('ReviewTeam.institutionId must match AccreditationCycle.institutionId');
    }

    team.addMembership(input);
    return this.reviewTeams.save(team);
  }

  async getFrameworkVersionById(id) {
    return this.frameworkVersions.getById(id);
  }

  async getAccreditationCycleById(id) {
    const cycle = await this.cycles.getById(id);
    if (!cycle) {
      return null;
    }
    await this.#assertCycleReviewEventTeamsBelongToCycle(cycle);
    return cycle;
  }

  async getReviewTeamById(id) {
    const team = await this.reviewTeams.getById(id);
    if (!team) {
      return null;
    }
    await this.#assertTeamMembershipsAlignToReviewerProfiles(team);
    return team;
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
    await this.#assertCycleReviewEventTeamsBelongToCycle(cycle);
    return cycle;
  }

  async #requireReviewerProfile(id) {
    const profile = await this.reviewerProfiles.getById(id);
    if (!profile) {
      throw new NotFoundError('ReviewerProfile', id);
    }
    return profile;
  }

  async #requireReviewTeam(id) {
    const team = await this.reviewTeams.getById(id);
    if (!team) {
      throw new NotFoundError('ReviewTeam', id);
    }
    await this.#assertTeamMembershipsAlignToReviewerProfiles(team);
    return team;
  }

  async #assertCycleReviewEventTeamsBelongToCycle(cycle) {
    for (const reviewEvent of cycle.reviewEvents) {
      if (!reviewEvent.reviewTeamId) {
        continue;
      }
      const reviewTeam = await this.reviewTeams.getById(reviewEvent.reviewTeamId);
      if (!reviewTeam) {
        throw new ValidationError(`ReviewEvent.reviewTeamId not found: ${reviewEvent.reviewTeamId}`);
      }
      if (reviewTeam.accreditationCycleId !== cycle.id) {
        throw new ValidationError('ReviewEvent.reviewTeamId must reference a ReviewTeam in the same AccreditationCycle');
      }
    }
  }

  async #assertTeamMembershipsAlignToReviewerProfiles(team) {
    for (const membership of team.memberships) {
      if (!membership.reviewerProfileId) {
        continue;
      }
      const profile = await this.reviewerProfiles.getById(membership.reviewerProfileId);
      if (!profile) {
        throw new ValidationError(`ReviewTeamMembership.reviewerProfileId not found: ${membership.reviewerProfileId}`);
      }
      if (profile.personId !== membership.personId) {
        throw new ValidationError('ReviewTeamMembership.personId must match ReviewerProfile.personId');
      }
      if (profile.institutionId !== team.institutionId) {
        throw new ValidationError('ReviewTeamMembership.reviewerProfileId must belong to ReviewTeam institution');
      }
    }
  }
}
