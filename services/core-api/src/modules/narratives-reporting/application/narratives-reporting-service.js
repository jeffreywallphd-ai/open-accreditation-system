import { ValidationError } from '../../shared/kernel/errors.js';
import { NarrativeApplicationService } from './narrative-application-service.js';
import { SubmissionPackageApplicationService } from './submission-package-application-service.js';

export class NarrativesReportingService {
  constructor(deps) {
    this.submissionPackageService =
      deps.submissionPackageService ??
      new SubmissionPackageApplicationService({
        submissionPackages: deps.submissionPackages,
        reviewCycles: deps.reviewCycles,
        workflowTargets: deps.workflowTargets,
        evidenceReadiness: deps.evidenceReadiness,
      });

    this.narrativeService =
      deps.narrativeService ??
      new NarrativeApplicationService({
        narratives: deps.narratives,
        submissionPackages: deps.submissionPackages,
        evidenceReadiness: deps.evidenceReadiness,
      });

    if (!this.submissionPackageService || !this.narrativeService) {
      throw new ValidationError('NarrativesReportingService requires submissionPackageService and narrativeService');
    }

    // Compatibility for existing integration tests and cross-context consumers.
    this.narratives = this.narrativeService.narratives;
  }

  async createSubmissionPackage(input) {
    return this.submissionPackageService.createSubmissionPackage(input);
  }

  async addSubmissionPackageItem(submissionPackageId, input) {
    return this.submissionPackageService.addSubmissionPackageItem(submissionPackageId, input);
  }

  async removeSubmissionPackageItem(submissionPackageId, itemId) {
    return this.submissionPackageService.removeSubmissionPackageItem(submissionPackageId, itemId);
  }

  async reorderSubmissionPackageItem(submissionPackageId, itemId, newPosition) {
    return this.submissionPackageService.reorderSubmissionPackageItem(submissionPackageId, itemId, newPosition);
  }

  async snapshotSubmissionPackage(submissionPackageId, options = {}) {
    return this.submissionPackageService.snapshotSubmissionPackage(submissionPackageId, options);
  }

  async getSubmissionPackageById(id) {
    return this.submissionPackageService.getSubmissionPackageById(id);
  }

  async listSubmissionPackages(filter = {}) {
    return this.submissionPackageService.listSubmissionPackages(filter);
  }

  async getSubmissionPackageWithItemContext(id) {
    return this.submissionPackageService.getSubmissionPackageWithItemContext(id);
  }

  async createNarrative(input) {
    return this.narrativeService.createNarrative(input);
  }

  async addNarrativeSection(narrativeId, input) {
    return this.narrativeService.addNarrativeSection(narrativeId, input);
  }

  async updateNarrativeSection(narrativeId, sectionId, input) {
    return this.narrativeService.updateNarrativeSection(narrativeId, sectionId, input);
  }

  async removeNarrativeSection(narrativeId, sectionId) {
    return this.narrativeService.removeNarrativeSection(narrativeId, sectionId);
  }

  async reorderNarrativeSection(narrativeId, sectionId, newPosition) {
    return this.narrativeService.reorderNarrativeSection(narrativeId, sectionId, newPosition);
  }

  async linkNarrativeSectionEvidence(narrativeId, sectionId, input) {
    return this.narrativeService.linkNarrativeSectionEvidence(narrativeId, sectionId, input);
  }

  async unlinkNarrativeSectionEvidence(narrativeId, sectionId, linkId) {
    return this.narrativeService.unlinkNarrativeSectionEvidence(narrativeId, sectionId, linkId);
  }

  async linkNarrativeSectionToPackageItem(narrativeId, sectionId, input) {
    return this.narrativeService.linkNarrativeSectionToPackageItem(narrativeId, sectionId, input);
  }

  async unlinkNarrativeSectionFromPackageItem(narrativeId, sectionId, submissionPackageItemId) {
    return this.narrativeService.unlinkNarrativeSectionFromPackageItem(narrativeId, sectionId, submissionPackageItemId);
  }

  async submitNarrativeForReview(narrativeId) {
    return this.narrativeService.submitNarrativeForReview(narrativeId);
  }

  async returnNarrativeToDraft(narrativeId) {
    return this.narrativeService.returnNarrativeToDraft(narrativeId);
  }

  async finalizeNarrative(narrativeId) {
    return this.narrativeService.finalizeNarrative(narrativeId);
  }

  async getNarrativeById(id) {
    return this.narrativeService.getNarrativeById(id);
  }

  async listNarratives(filter = {}) {
    return this.narrativeService.listNarratives(filter);
  }

  async getNarrativeWithSectionContext(narrativeId) {
    return this.narrativeService.getNarrativeWithSectionContext(narrativeId);
  }

  async getNarrativeSectionById(sectionId) {
    return this.narrativeService.getNarrativeSectionById(sectionId);
  }
}
