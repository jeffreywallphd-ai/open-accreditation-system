import { assertRequired, assertString } from '../../../shared/kernel/assertions.js';
import { ValidationError } from '../../../shared/kernel/errors.js';
import { createId, nowIso } from '../../../shared/kernel/identity.js';
import {
  narrativePackageLinkType,
  narrativeStatus,
  parseNarrativeEvidenceLinkType,
  parseNarrativePackageLinkType,
  parseNarrativeSectionType,
  parseNarrativeStatus,
} from '../value-objects/narrative-statuses.js';

function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = `${value}`.trim();
  return normalized.length > 0 ? normalized : null;
}

function assertSectionKey(value, fieldName) {
  if (!value) {
    throw new ValidationError(`${fieldName} is required`);
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw new ValidationError(`${fieldName} must contain only letters, numbers, dot, underscore, colon, or dash`);
  }
}

function resequence(sections = [], options = {}) {
  const touchUpdatedAt = options.touchUpdatedAt === true;
  return sections.map((section, index) => {
    section.sequence = index + 1;
    if (touchUpdatedAt) {
      section.updatedAt = nowIso();
    }
    return section;
  });
}

export class NarrativeSectionEvidenceLink {
  constructor(props) {
    assertRequired(props.id, 'NarrativeSectionEvidenceLink.id');
    assertRequired(props.sectionId, 'NarrativeSectionEvidenceLink.sectionId');
    assertRequired(props.evidenceItemId, 'NarrativeSectionEvidenceLink.evidenceItemId');
    parseNarrativeEvidenceLinkType(props.relationshipType);
    assertRequired(props.createdAt, 'NarrativeSectionEvidenceLink.createdAt');

    this.id = props.id;
    this.sectionId = props.sectionId;
    this.evidenceItemId = props.evidenceItemId;
    this.relationshipType = props.relationshipType;
    this.rationale = normalizeOptionalString(props.rationale);
    this.createdAt = props.createdAt;
  }

  static create(input) {
    return new NarrativeSectionEvidenceLink({
      id: input.id ?? createId('narr_sec_evid_link'),
      sectionId: input.sectionId,
      evidenceItemId: input.evidenceItemId,
      relationshipType: input.relationshipType,
      rationale: input.rationale,
      createdAt: input.createdAt ?? nowIso(),
    });
  }
}

export class NarrativeSectionPackageLink {
  constructor(props) {
    assertRequired(props.id, 'NarrativeSectionPackageLink.id');
    assertRequired(props.sectionId, 'NarrativeSectionPackageLink.sectionId');
    assertRequired(props.submissionPackageItemId, 'NarrativeSectionPackageLink.submissionPackageItemId');
    parseNarrativePackageLinkType(props.linkType);
    assertRequired(props.createdAt, 'NarrativeSectionPackageLink.createdAt');

    this.id = props.id;
    this.sectionId = props.sectionId;
    this.submissionPackageItemId = props.submissionPackageItemId;
    this.linkType = props.linkType;
    this.createdAt = props.createdAt;
  }

  static create(input) {
    return new NarrativeSectionPackageLink({
      id: input.id ?? createId('narr_sec_pkg_link'),
      sectionId: input.sectionId,
      submissionPackageItemId: input.submissionPackageItemId,
      linkType: input.linkType,
      createdAt: input.createdAt ?? nowIso(),
    });
  }
}

export class NarrativeSection {
  constructor(props) {
    assertRequired(props.id, 'NarrativeSection.id');
    assertRequired(props.narrativeId, 'NarrativeSection.narrativeId');
    if (!Number.isInteger(props.sequence) || props.sequence < 1) {
      throw new ValidationError('NarrativeSection.sequence must be an integer >= 1');
    }
    parseNarrativeSectionType(props.sectionType);
    assertSectionKey(props.sectionKey, 'NarrativeSection.sectionKey');
    assertString(props.title, 'NarrativeSection.title');

    this.id = props.id;
    this.narrativeId = props.narrativeId;
    this.sequence = props.sequence;
    this.sectionType = props.sectionType;
    this.sectionKey = props.sectionKey;
    this.parentSectionKey = normalizeOptionalString(props.parentSectionKey);
    this.title = props.title.trim();
    this.content = normalizeOptionalString(props.content);
    this.ownerId = normalizeOptionalString(props.ownerId);
    this.evidenceLinks = (props.evidenceLinks ?? []).map((link) =>
      link instanceof NarrativeSectionEvidenceLink ? link : NarrativeSectionEvidenceLink.create(link),
    );
    this.packageLinks = (props.packageLinks ?? []).map((link) =>
      link instanceof NarrativeSectionPackageLink ? link : NarrativeSectionPackageLink.create(link),
    );
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;

    if (this.parentSectionKey && this.parentSectionKey === this.sectionKey) {
      throw new ValidationError('NarrativeSection.parentSectionKey must differ from sectionKey');
    }

    this.#assertLinkIntegrity();
  }

  static create(input) {
    const now = nowIso();
    return new NarrativeSection({
      id: input.id ?? createId('narr_sec'),
      narrativeId: input.narrativeId,
      sequence: input.sequence,
      sectionType: input.sectionType,
      sectionKey: input.sectionKey,
      parentSectionKey: input.parentSectionKey,
      title: input.title,
      content: input.content,
      ownerId: input.ownerId,
      evidenceLinks: [],
      packageLinks: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  update(input = {}) {
    if (input.sectionType !== undefined) {
      parseNarrativeSectionType(input.sectionType);
      this.sectionType = input.sectionType;
    }
    if (input.sectionKey !== undefined) {
      assertSectionKey(input.sectionKey, 'NarrativeSection.sectionKey');
      this.sectionKey = input.sectionKey;
    }
    if (input.parentSectionKey !== undefined) {
      this.parentSectionKey = normalizeOptionalString(input.parentSectionKey);
      if (this.parentSectionKey && this.parentSectionKey === this.sectionKey) {
        throw new ValidationError('NarrativeSection.parentSectionKey must differ from sectionKey');
      }
    }
    if (input.title !== undefined) {
      assertString(input.title, 'NarrativeSection.title');
      this.title = input.title.trim();
    }
    if (input.content !== undefined) {
      this.content = normalizeOptionalString(input.content);
    }
    if (input.ownerId !== undefined) {
      this.ownerId = normalizeOptionalString(input.ownerId);
    }
    this.updatedAt = nowIso();
    return this;
  }

  linkEvidence(input) {
    const link = NarrativeSectionEvidenceLink.create({
      sectionId: this.id,
      evidenceItemId: input.evidenceItemId,
      relationshipType: input.relationshipType,
      rationale: input.rationale,
    });
    const duplicate = this.evidenceLinks.find(
      (entry) =>
        entry.evidenceItemId === link.evidenceItemId && entry.relationshipType === link.relationshipType,
    );
    if (duplicate) {
      throw new ValidationError(
        `NarrativeSection evidence link already exists for evidence ${link.evidenceItemId} and relationship ${link.relationshipType}`,
      );
    }
    this.evidenceLinks.push(link);
    this.updatedAt = nowIso();
    this.#assertLinkIntegrity();
    return link;
  }

  unlinkEvidenceById(linkId) {
    const index = this.evidenceLinks.findIndex((entry) => entry.id === linkId);
    if (index < 0) {
      throw new ValidationError(`NarrativeSection evidence link not found: ${linkId}`);
    }
    this.evidenceLinks.splice(index, 1);
    this.updatedAt = nowIso();
    return this;
  }

  linkSubmissionPackageItem(input) {
    const link = NarrativeSectionPackageLink.create({
      sectionId: this.id,
      submissionPackageItemId: input.submissionPackageItemId,
      linkType: input.linkType,
    });
    const duplicate = this.packageLinks.find(
      (entry) => entry.submissionPackageItemId === link.submissionPackageItemId,
    );
    if (duplicate) {
      throw new ValidationError(
        `NarrativeSection package link already exists for submissionPackageItemId ${link.submissionPackageItemId}`,
      );
    }
    if (
      link.linkType === narrativePackageLinkType.GOVERNING_SECTION &&
      this.packageLinks.some((entry) => entry.linkType === narrativePackageLinkType.GOVERNING_SECTION)
    ) {
      throw new ValidationError('NarrativeSection may have at most one governing-section package link');
    }
    this.packageLinks.push(link);
    this.updatedAt = nowIso();
    this.#assertLinkIntegrity();
    return link;
  }

  unlinkSubmissionPackageItem(submissionPackageItemId) {
    const index = this.packageLinks.findIndex(
      (entry) => entry.submissionPackageItemId === submissionPackageItemId,
    );
    if (index < 0) {
      throw new ValidationError(
        `NarrativeSection package link not found for submissionPackageItemId: ${submissionPackageItemId}`,
      );
    }
    this.packageLinks.splice(index, 1);
    this.updatedAt = nowIso();
    return this;
  }

  #assertLinkIntegrity() {
    const evidenceLinkIds = new Set();
    for (const link of this.evidenceLinks) {
      if (link.sectionId !== this.id) {
        throw new ValidationError('NarrativeSectionEvidenceLink.sectionId must match owning section id');
      }
      if (evidenceLinkIds.has(link.id)) {
        throw new ValidationError(`NarrativeSectionEvidenceLink.id must be unique within section: ${link.id}`);
      }
      evidenceLinkIds.add(link.id);
    }

    const packageLinkIds = new Set();
    let governingLinkCount = 0;
    for (const link of this.packageLinks) {
      if (link.sectionId !== this.id) {
        throw new ValidationError('NarrativeSectionPackageLink.sectionId must match owning section id');
      }
      if (packageLinkIds.has(link.id)) {
        throw new ValidationError(`NarrativeSectionPackageLink.id must be unique within section: ${link.id}`);
      }
      if (link.linkType === narrativePackageLinkType.GOVERNING_SECTION) {
        governingLinkCount += 1;
      }
      packageLinkIds.add(link.id);
    }
    if (governingLinkCount > 1) {
      throw new ValidationError('NarrativeSection may have at most one governing-section package link');
    }
  }
}

export class Narrative {
  constructor(props) {
    assertRequired(props.id, 'Narrative.id');
    assertRequired(props.institutionId, 'Narrative.institutionId');
    assertRequired(props.reviewCycleId, 'Narrative.reviewCycleId');
    assertRequired(props.submissionPackageId, 'Narrative.submissionPackageId');
    assertString(props.title, 'Narrative.title');
    parseNarrativeStatus(props.status);

    this.id = props.id;
    this.institutionId = props.institutionId;
    this.reviewCycleId = props.reviewCycleId;
    this.submissionPackageId = props.submissionPackageId;
    this.title = props.title.trim();
    this.status = props.status;
    this.sections = resequence(
      (props.sections ?? []).map((section) =>
        section instanceof NarrativeSection ? section : new NarrativeSection(section),
      ),
    );
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.submittedForReviewAt = props.submittedForReviewAt ?? null;
    this.finalizedAt = props.finalizedAt ?? null;

    this.#assertIntegrity();
  }

  static create(input) {
    const now = nowIso();
    return new Narrative({
      id: input.id ?? createId('narrative'),
      institutionId: input.institutionId,
      reviewCycleId: input.reviewCycleId,
      submissionPackageId: input.submissionPackageId,
      title: input.title,
      status: narrativeStatus.DRAFT,
      sections: [],
      createdAt: now,
      updatedAt: now,
      submittedForReviewAt: null,
      finalizedAt: null,
    });
  }

  static rehydrate(input) {
    return new Narrative(input);
  }

  rename(title) {
    this.#assertDraft('rename');
    assertString(title, 'Narrative.title');
    this.title = title.trim();
    this.updatedAt = nowIso();
    return this;
  }

  addSection(input) {
    this.#assertDraft('add section');
    const section = NarrativeSection.create({
      ...input,
      narrativeId: this.id,
      sequence: this.sections.length + 1,
    });
    this.sections.push(section);
    this.#assertIntegrity();
    this.updatedAt = nowIso();
    return section;
  }

  updateSection(sectionId, input) {
    this.#assertDraft('update section');
    const section = this.#requireSection(sectionId);
    section.update(input);
    this.#assertIntegrity();
    this.updatedAt = nowIso();
    return section;
  }

  removeSection(sectionId) {
    this.#assertDraft('remove section');
    const section = this.#requireSection(sectionId);
    const hasChildren = this.sections.some((entry) => entry.parentSectionKey === section.sectionKey);
    if (hasChildren) {
      throw new ValidationError(`NarrativeSection cannot be removed while child sections reference ${section.sectionKey}`);
    }
    const index = this.sections.findIndex((entry) => entry.id === sectionId);
    this.sections.splice(index, 1);
    resequence(this.sections, { touchUpdatedAt: true });
    this.#assertIntegrity();
    this.updatedAt = nowIso();
    return this;
  }

  reorderSection(sectionId, newPosition) {
    this.#assertDraft('reorder section');
    if (!Number.isInteger(newPosition) || newPosition < 1 || newPosition > this.sections.length) {
      throw new ValidationError('Narrative.reorderSection newPosition must be within current section range');
    }
    const currentIndex = this.sections.findIndex((section) => section.id === sectionId);
    if (currentIndex < 0) {
      throw new ValidationError(`Narrative section not found: ${sectionId}`);
    }
    const [section] = this.sections.splice(currentIndex, 1);
    this.sections.splice(newPosition - 1, 0, section);
    resequence(this.sections, { touchUpdatedAt: true });
    this.#assertIntegrity();
    this.updatedAt = nowIso();
    return this;
  }

  linkSectionEvidence(sectionId, input) {
    this.#assertDraft('link section evidence');
    const section = this.#requireSection(sectionId);
    const link = section.linkEvidence(input);
    this.#assertIntegrity();
    this.updatedAt = nowIso();
    return link;
  }

  unlinkSectionEvidence(sectionId, linkId) {
    this.#assertDraft('unlink section evidence');
    const section = this.#requireSection(sectionId);
    section.unlinkEvidenceById(linkId);
    this.updatedAt = nowIso();
    return this;
  }

  linkSectionToPackageItem(sectionId, input) {
    this.#assertDraft('link section to submission package item');
    const section = this.#requireSection(sectionId);
    const link = section.linkSubmissionPackageItem(input);
    this.#assertIntegrity();
    this.updatedAt = nowIso();
    return link;
  }

  unlinkSectionFromPackageItem(sectionId, submissionPackageItemId) {
    this.#assertDraft('unlink section from submission package item');
    const section = this.#requireSection(sectionId);
    section.unlinkSubmissionPackageItem(submissionPackageItemId);
    this.updatedAt = nowIso();
    return this;
  }

  submitForReview() {
    if (this.status !== narrativeStatus.DRAFT) {
      throw new ValidationError(`Narrative cannot submit for review while status is ${this.status}`);
    }
    if (this.sections.length === 0) {
      throw new ValidationError('Narrative requires at least one section before submit-for-review');
    }
    this.status = narrativeStatus.IN_REVIEW;
    this.submittedForReviewAt = nowIso();
    this.updatedAt = this.submittedForReviewAt;
    this.#assertIntegrity();
    return this;
  }

  returnToDraft() {
    if (this.status !== narrativeStatus.IN_REVIEW) {
      throw new ValidationError(`Narrative can return to draft only from in-review status (received ${this.status})`);
    }
    this.status = narrativeStatus.DRAFT;
    this.updatedAt = nowIso();
    return this;
  }

  finalize() {
    if (this.status !== narrativeStatus.IN_REVIEW) {
      throw new ValidationError(`Narrative can finalize only from in-review status (received ${this.status})`);
    }
    this.status = narrativeStatus.FINALIZED;
    this.finalizedAt = nowIso();
    this.updatedAt = this.finalizedAt;
    this.#assertIntegrity();
    return this;
  }

  getSectionById(sectionId) {
    return this.sections.find((section) => section.id === sectionId) ?? null;
  }

  #requireSection(sectionId) {
    const section = this.getSectionById(sectionId);
    if (!section) {
      throw new ValidationError(`Narrative section not found: ${sectionId}`);
    }
    return section;
  }

  #assertDraft(action) {
    if (this.status !== narrativeStatus.DRAFT) {
      throw new ValidationError(`Narrative cannot ${action} while status is ${this.status}`);
    }
  }

  #assertIntegrity() {
    const sectionIds = new Set();
    const sectionKeys = new Set();
    const sectionByKey = new Map();
    let previousSequence = 0;

    for (const section of this.sections) {
      if (section.narrativeId !== this.id) {
        throw new ValidationError('NarrativeSection.narrativeId must match owning narrative id');
      }
      if (section.sequence !== previousSequence + 1) {
        throw new ValidationError('NarrativeSection.sequence must be contiguous and start at 1');
      }
      if (sectionIds.has(section.id)) {
        throw new ValidationError(`NarrativeSection.id must be unique within narrative: ${section.id}`);
      }
      if (sectionKeys.has(section.sectionKey)) {
        throw new ValidationError(`NarrativeSection.sectionKey must be unique within narrative: ${section.sectionKey}`);
      }
      previousSequence = section.sequence;
      sectionIds.add(section.id);
      sectionKeys.add(section.sectionKey);
      sectionByKey.set(section.sectionKey, section);
    }

    const packageItemToSection = new Map();
    for (const section of this.sections) {
      if (section.parentSectionKey) {
        const parent = sectionByKey.get(section.parentSectionKey);
        if (!parent) {
          throw new ValidationError(
            `NarrativeSection.parentSectionKey does not exist in narrative: ${section.parentSectionKey}`,
          );
        }
        if (parent.sequence >= section.sequence) {
          throw new ValidationError(
            `NarrativeSection.parentSectionKey must appear before child section: ${section.parentSectionKey}`,
          );
        }
      }

      for (const packageLink of section.packageLinks) {
        const existingSectionId = packageItemToSection.get(packageLink.submissionPackageItemId);
        if (existingSectionId && existingSectionId !== section.id) {
          throw new ValidationError(
            `NarrativeSection submission package item link must be unique within narrative: ${packageLink.submissionPackageItemId}`,
          );
        }
        packageItemToSection.set(packageLink.submissionPackageItemId, section.id);
      }
    }

    if (this.status === narrativeStatus.DRAFT) {
      if (this.finalizedAt) {
        throw new ValidationError('Narrative.finalizedAt must be null while status=draft');
      }
      return;
    }

    if (this.status === narrativeStatus.IN_REVIEW) {
      if (!this.submittedForReviewAt) {
        throw new ValidationError('Narrative.submittedForReviewAt is required while status=in-review');
      }
      if (this.finalizedAt) {
        throw new ValidationError('Narrative.finalizedAt must be null while status=in-review');
      }
      return;
    }

    if (this.status === narrativeStatus.FINALIZED) {
      if (!this.submittedForReviewAt) {
        throw new ValidationError('Narrative.submittedForReviewAt is required while status=finalized');
      }
      if (!this.finalizedAt) {
        throw new ValidationError('Narrative.finalizedAt is required while status=finalized');
      }
    }
  }
}
