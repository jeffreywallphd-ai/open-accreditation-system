import assert from 'node:assert/strict';
import { ValidationError } from '../../src/modules/shared/kernel/errors.js';
import { Narrative } from '../../src/modules/narratives-reporting/domain/entities/narrative.js';
import {
  narrativeEvidenceLinkType,
  narrativePackageLinkType,
  narrativeSectionType,
  narrativeStatus,
} from '../../src/modules/narratives-reporting/domain/value-objects/narrative-statuses.js';

export async function runTests(): Promise<void> {
  const narrative = Narrative.create({
    institutionId: 'inst_narr_dom',
    reviewCycleId: 'cycle_narr_dom',
    submissionPackageId: 'sub_pkg_narr_dom',
    title: 'Program narrative',
  });

  assert.equal(narrative.status, narrativeStatus.DRAFT);
  assert.equal(narrative.sections.length, 0);

  const mission = narrative.addSection({
    sectionType: narrativeSectionType.REPORT_SECTION,
    sectionKey: 'mission',
    title: 'Mission',
    content: 'Mission summary',
  });
  const faculty = narrative.addSection({
    sectionType: narrativeSectionType.NARRATIVE_SECTION,
    sectionKey: 'faculty',
    parentSectionKey: 'mission',
    title: 'Faculty sufficiency',
  });
  const assurance = narrative.addSection({
    sectionType: narrativeSectionType.REPORT_SECTION,
    sectionKey: 'assurance',
    title: 'Assurance of learning',
  });

  assert.equal(mission.sequence, 1);
  assert.equal(faculty.sequence, 2);
  assert.equal(assurance.sequence, 3);

  const evidenceLink = narrative.linkSectionEvidence(mission.id, {
    evidenceItemId: 'ev_1',
    relationshipType: narrativeEvidenceLinkType.PRIMARY_SUPPORT,
  });
  assert.equal(mission.evidenceLinks.length, 1);
  assert.equal(evidenceLink.evidenceItemId, 'ev_1');

  narrative.linkSectionToPackageItem(mission.id, {
    submissionPackageItemId: 'pkg_item_1',
    linkType: narrativePackageLinkType.GOVERNING_SECTION,
  });
  assert.equal(mission.packageLinks.length, 1);

  assert.throws(
    () =>
      narrative.linkSectionToPackageItem(mission.id, {
        submissionPackageItemId: 'pkg_item_2',
        linkType: narrativePackageLinkType.GOVERNING_SECTION,
      }),
    ValidationError,
    'section should allow only one governing-section link',
  );

  narrative.reorderSection(assurance.id, 2);
  assert.equal(narrative.sections[1].id, assurance.id);

  assert.throws(
    () =>
      narrative.reorderSection(faculty.id, 1),
    ValidationError,
    'parent section should remain before child section',
  );

  assert.throws(
    () =>
      narrative.linkSectionEvidence(mission.id, {
        evidenceItemId: 'ev_1',
        relationshipType: narrativeEvidenceLinkType.PRIMARY_SUPPORT,
      }),
    ValidationError,
    'duplicate evidence links should be rejected',
  );

  assert.throws(
    () => narrative.removeSection(mission.id),
    ValidationError,
    'parent section with children should not be removable',
  );

  narrative.submitForReview();
  assert.equal(narrative.status, narrativeStatus.IN_REVIEW);
  assert.ok(narrative.submittedForReviewAt);

  narrative.returnToDraft();
  assert.equal(narrative.status, narrativeStatus.DRAFT);

  narrative.submitForReview();
  narrative.finalize();
  assert.equal(narrative.status, narrativeStatus.FINALIZED);
  assert.ok(narrative.finalizedAt);

  assert.throws(
    () => narrative.updateSection(mission.id, { title: 'Locked' }),
    ValidationError,
    'finalized narrative should reject section edits',
  );
}
