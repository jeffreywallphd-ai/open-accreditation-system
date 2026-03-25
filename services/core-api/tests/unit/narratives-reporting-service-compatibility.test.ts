import assert from 'node:assert/strict';
import { NarrativesReportingService } from '../../src/modules/narratives-reporting/application/narratives-reporting-service.js';
import { ValidationError } from '../../src/modules/shared/kernel/errors.js';

export async function runTests(): Promise<void> {
  const submissionPackageService = {
    createSubmissionPackage: async (input) => ({ ...input, from: 'submissionPackageService' }),
    getSubmissionPackageById: async (id) => ({ id, from: 'submissionPackageService' }),
  };

  const narrativeService = {
    createNarrative: async (input) => ({ ...input, from: 'narrativeService' }),
    getNarrativeById: async (id) => ({ id, from: 'narrativeService' }),
    getNarrativeSectionById: async (id) => ({ id, from: 'narrativeService' }),
  };

  const service = new NarrativesReportingService({
    submissionPackageService,
    narrativeService,
  });

  const createdPackage = await service.createSubmissionPackage({ reviewCycleId: 'cycle_1' });
  assert.equal(createdPackage.from, 'submissionPackageService');

  const loadedPackage = await service.getSubmissionPackageById('pkg_1');
  assert.equal(loadedPackage.from, 'submissionPackageService');

  const createdNarrative = await service.createNarrative({ submissionPackageId: 'pkg_1', title: 'Narrative' });
  assert.equal(createdNarrative.from, 'narrativeService');

  const loadedNarrative = await service.getNarrativeById('narr_1');
  assert.equal(loadedNarrative.from, 'narrativeService');

  const loadedSection = await service.getNarrativeSectionById('section_1');
  assert.equal(loadedSection.from, 'narrativeService');

  assert.throws(
    () => new NarrativesReportingService({ narrativeService }),
    ValidationError,
  );

  assert.throws(
    () => new NarrativesReportingService({ submissionPackageService }),
    ValidationError,
  );
}
