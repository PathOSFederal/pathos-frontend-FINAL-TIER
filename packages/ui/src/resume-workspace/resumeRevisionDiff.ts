/**
 * ============================================================================
 * RESUME REVISION DIFF HELPERS — Day 83 bounded content diffing
 * ============================================================================
 *
 * PURPOSE:
 * Compare two persisted resume revision content snapshots without turning the
 * workspace into a noisy line-by-line diff tool. The logic stays intentionally
 * bounded to:
 * - section changed / unchanged visibility
 * - added / removed / edited item counts
 * - calm item-level summaries for sections that already have structured data
 *
 * TRUST BOUNDARY:
 * This helper only compares saved revision content snapshots. It does not infer
 * resume-body changes from diagnostics snapshots and it does not attempt
 * semantic rewrite detection.
 */

import type {
  ResumeDraft,
  ResumeEducation,
  ResumeExperience,
  ResumeSkill,
} from '@pathos/core';
import type { ResumeRevisionContentSnapshot } from '../stores/resumeWorkspaceStore';

export type ResumeRevisionSectionId =
  | 'contact'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills';

export type ResumeRevisionItemChangeType = 'added' | 'removed' | 'edited';

export interface ResumeRevisionDiffItem {
  key: string;
  changeType: ResumeRevisionItemChangeType;
  label: string;
  previousText: string | null;
  currentText: string | null;
}

export interface ResumeRevisionSectionDiff {
  sectionId: ResumeRevisionSectionId;
  label: string;
  status: 'changed' | 'unchanged';
  addedCount: number;
  removedCount: number;
  editedCount: number;
  items: ResumeRevisionDiffItem[];
}

export interface ResumeRevisionDiffSummary {
  previousRevisionId: string;
  currentRevisionId: string;
  changedSectionCount: number;
  unchangedSectionCount: number;
  addedItemCount: number;
  removedItemCount: number;
  editedItemCount: number;
  sections: ResumeRevisionSectionDiff[];
}

function normalizeText(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\r\n/g, '\n').trim();
}

function normalizeWhitespace(value: string | null | undefined): string {
  return normalizeText(value).replace(/\s+/g, ' ');
}

function buildExperienceEntryLabel(experience: ResumeExperience): string {
  const title = normalizeWhitespace(experience.jobTitle);
  const employer = normalizeWhitespace(experience.employer);
  if (title.length > 0 && employer.length > 0) {
    return title + ' at ' + employer;
  }
  if (title.length > 0) {
    return title;
  }
  if (employer.length > 0) {
    return employer;
  }
  return 'Experience entry';
}

function buildEducationEntryLabel(education: ResumeEducation): string {
  const degree = normalizeWhitespace(education.degree);
  const institution = normalizeWhitespace(education.institution);
  if (degree.length > 0 && institution.length > 0) {
    return degree + ' at ' + institution;
  }
  if (institution.length > 0) {
    return institution;
  }
  if (degree.length > 0) {
    return degree;
  }
  return 'Education entry';
}

function splitExperienceBullets(experience: ResumeExperience): string[] {
  const rawLines = normalizeText(experience.duties).split('\n');
  const bullets: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const normalizedLine = normalizeWhitespace(rawLines[i]);
    if (normalizedLine.length > 0) {
      bullets.push(normalizedLine);
    }
  }
  return bullets;
}

function buildSectionDiff(
  sectionId: ResumeRevisionSectionId,
  label: string,
  items: ResumeRevisionDiffItem[]
): ResumeRevisionSectionDiff {
  let addedCount = 0;
  let removedCount = 0;
  let editedCount = 0;
  for (let i = 0; i < items.length; i++) {
    if (items[i].changeType === 'added') {
      addedCount += 1;
    } else if (items[i].changeType === 'removed') {
      removedCount += 1;
    } else {
      editedCount += 1;
    }
  }
  return {
    sectionId: sectionId,
    label: label,
    status: items.length > 0 ? 'changed' : 'unchanged',
    addedCount: addedCount,
    removedCount: removedCount,
    editedCount: editedCount,
    items: items,
  };
}

function buildContactDiff(previousDraft: ResumeDraft, currentDraft: ResumeDraft): ResumeRevisionSectionDiff {
  const items: ResumeRevisionDiffItem[] = [];
  const fields: Array<{ key: keyof ResumeContact; label: string }> = [
    { key: 'fullName', label: 'Full name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'citizenship', label: 'Citizenship' },
    { key: 'veteranStatus', label: 'Veteran status' },
  ];
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const previousValue = normalizeWhitespace(previousDraft.contact[field.key]);
    const currentValue = normalizeWhitespace(currentDraft.contact[field.key]);
    if (previousValue !== currentValue) {
      items.push({
        key: 'contact-' + field.key,
        changeType: 'edited',
        label: field.label,
        previousText: previousValue.length > 0 ? previousValue : null,
        currentText: currentValue.length > 0 ? currentValue : null,
      });
    }
  }
  return buildSectionDiff('contact', 'Contact', items);
}

function buildSummaryDiff(previousDraft: ResumeDraft, currentDraft: ResumeDraft): ResumeRevisionSectionDiff {
  const previousSummary = normalizeWhitespace(previousDraft.summary);
  const currentSummary = normalizeWhitespace(currentDraft.summary);
  const items: ResumeRevisionDiffItem[] = [];
  if (previousSummary !== currentSummary) {
    items.push({
      key: 'summary-main',
      changeType: 'edited',
      label: 'Summary text',
      previousText: previousSummary.length > 0 ? previousSummary : null,
      currentText: currentSummary.length > 0 ? currentSummary : null,
    });
  }
  return buildSectionDiff('summary', 'Summary', items);
}

function buildExperienceDiff(previousDraft: ResumeDraft, currentDraft: ResumeDraft): ResumeRevisionSectionDiff {
  const items: ResumeRevisionDiffItem[] = [];
  const previousById: Record<string, ResumeExperience> = {};
  for (let i = 0; i < previousDraft.experience.length; i++) {
    previousById[previousDraft.experience[i].id] = previousDraft.experience[i];
  }
  const currentById: Record<string, ResumeExperience> = {};
  for (let i = 0; i < currentDraft.experience.length; i++) {
    currentById[currentDraft.experience[i].id] = currentDraft.experience[i];
  }

  for (let i = 0; i < currentDraft.experience.length; i++) {
    const currentExperience = currentDraft.experience[i];
    const currentLabel = buildExperienceEntryLabel(currentExperience);
    if (!Object.prototype.hasOwnProperty.call(previousById, currentExperience.id)) {
      const currentBullets = splitExperienceBullets(currentExperience);
      for (let bulletIndex = 0; bulletIndex < currentBullets.length; bulletIndex++) {
        items.push({
          key: currentExperience.id + '-bullet-' + bulletIndex.toString(),
          changeType: 'added',
          label: currentLabel,
          previousText: null,
          currentText: currentBullets[bulletIndex],
        });
      }
      continue;
    }
    const previousExperience = previousById[currentExperience.id];
    const previousBullets = splitExperienceBullets(previousExperience);
    const currentBullets = splitExperienceBullets(currentExperience);
    const maxLength = previousBullets.length > currentBullets.length ? previousBullets.length : currentBullets.length;
    for (let bulletIndex = 0; bulletIndex < maxLength; bulletIndex++) {
      const previousBullet = bulletIndex < previousBullets.length ? previousBullets[bulletIndex] : '';
      const currentBullet = bulletIndex < currentBullets.length ? currentBullets[bulletIndex] : '';
      if (previousBullet.length === 0 && currentBullet.length > 0) {
        items.push({
          key: currentExperience.id + '-bullet-' + bulletIndex.toString(),
          changeType: 'added',
          label: currentLabel,
          previousText: null,
          currentText: currentBullet,
        });
      } else if (previousBullet.length > 0 && currentBullet.length === 0) {
        items.push({
          key: currentExperience.id + '-bullet-' + bulletIndex.toString(),
          changeType: 'removed',
          label: currentLabel,
          previousText: previousBullet,
          currentText: null,
        });
      } else if (previousBullet !== currentBullet) {
        items.push({
          key: currentExperience.id + '-bullet-' + bulletIndex.toString(),
          changeType: 'edited',
          label: currentLabel,
          previousText: previousBullet,
          currentText: currentBullet,
        });
      }
    }
  }

  for (let i = 0; i < previousDraft.experience.length; i++) {
    const previousExperience = previousDraft.experience[i];
    if (Object.prototype.hasOwnProperty.call(currentById, previousExperience.id)) {
      continue;
    }
    const previousLabel = buildExperienceEntryLabel(previousExperience);
    const previousBullets = splitExperienceBullets(previousExperience);
    for (let bulletIndex = 0; bulletIndex < previousBullets.length; bulletIndex++) {
      items.push({
        key: previousExperience.id + '-removed-bullet-' + bulletIndex.toString(),
        changeType: 'removed',
        label: previousLabel,
        previousText: previousBullets[bulletIndex],
        currentText: null,
      });
    }
  }

  return buildSectionDiff('experience', 'Experience', items);
}

function buildEducationDiff(previousDraft: ResumeDraft, currentDraft: ResumeDraft): ResumeRevisionSectionDiff {
  const items: ResumeRevisionDiffItem[] = [];
  const previousById: Record<string, ResumeEducation> = {};
  for (let i = 0; i < previousDraft.education.length; i++) {
    previousById[previousDraft.education[i].id] = previousDraft.education[i];
  }
  const currentById: Record<string, ResumeEducation> = {};
  for (let i = 0; i < currentDraft.education.length; i++) {
    currentById[currentDraft.education[i].id] = currentDraft.education[i];
  }

  for (let i = 0; i < currentDraft.education.length; i++) {
    const currentEducation = currentDraft.education[i];
    const currentLabel = buildEducationEntryLabel(currentEducation);
    const currentText = normalizeWhitespace(
      currentEducation.degree + ' ' + currentEducation.field + ' ' + currentEducation.institution
    );
    if (!Object.prototype.hasOwnProperty.call(previousById, currentEducation.id)) {
      items.push({
        key: currentEducation.id,
        changeType: 'added',
        label: currentLabel,
        previousText: null,
        currentText: currentText.length > 0 ? currentText : currentLabel,
      });
      continue;
    }
    const previousEducation = previousById[currentEducation.id];
    const previousText = normalizeWhitespace(
      previousEducation.degree + ' ' + previousEducation.field + ' ' + previousEducation.institution
    );
    if (previousText !== currentText) {
      items.push({
        key: currentEducation.id,
        changeType: 'edited',
        label: currentLabel,
        previousText: previousText.length > 0 ? previousText : null,
        currentText: currentText.length > 0 ? currentText : null,
      });
    }
  }

  for (let i = 0; i < previousDraft.education.length; i++) {
    const previousEducation = previousDraft.education[i];
    if (Object.prototype.hasOwnProperty.call(currentById, previousEducation.id)) {
      continue;
    }
    items.push({
      key: previousEducation.id,
      changeType: 'removed',
      label: buildEducationEntryLabel(previousEducation),
      previousText: buildEducationEntryLabel(previousEducation),
      currentText: null,
    });
  }

  return buildSectionDiff('education', 'Education', items);
}

function buildSkillsDiff(previousDraft: ResumeDraft, currentDraft: ResumeDraft): ResumeRevisionSectionDiff {
  const items: ResumeRevisionDiffItem[] = [];
  const previousById: Record<string, ResumeSkill> = {};
  for (let i = 0; i < previousDraft.skills.length; i++) {
    previousById[previousDraft.skills[i].id] = previousDraft.skills[i];
  }
  const currentById: Record<string, ResumeSkill> = {};
  for (let i = 0; i < currentDraft.skills.length; i++) {
    currentById[currentDraft.skills[i].id] = currentDraft.skills[i];
  }

  for (let i = 0; i < currentDraft.skills.length; i++) {
    const currentSkill = currentDraft.skills[i];
    const currentText = normalizeWhitespace(currentSkill.name);
    if (!Object.prototype.hasOwnProperty.call(previousById, currentSkill.id)) {
      items.push({
        key: currentSkill.id,
        changeType: 'added',
        label: 'Skill added',
        previousText: null,
        currentText: currentText.length > 0 ? currentText : null,
      });
      continue;
    }
    const previousSkill = previousById[currentSkill.id];
    const previousText = normalizeWhitespace(previousSkill.name);
    if (previousText !== currentText) {
      items.push({
        key: currentSkill.id,
        changeType: 'edited',
        label: 'Skill updated',
        previousText: previousText.length > 0 ? previousText : null,
        currentText: currentText.length > 0 ? currentText : null,
      });
    }
  }

  for (let i = 0; i < previousDraft.skills.length; i++) {
    const previousSkill = previousDraft.skills[i];
    if (Object.prototype.hasOwnProperty.call(currentById, previousSkill.id)) {
      continue;
    }
    items.push({
      key: previousSkill.id,
      changeType: 'removed',
      label: 'Skill removed',
      previousText: normalizeWhitespace(previousSkill.name),
      currentText: null,
    });
  }

  return buildSectionDiff('skills', 'Skills', items);
}

export function buildResumeRevisionDiffSummary(
  previousSnapshot: ResumeRevisionContentSnapshot,
  currentSnapshot: ResumeRevisionContentSnapshot
): ResumeRevisionDiffSummary {
  const sections: ResumeRevisionSectionDiff[] = [
    buildContactDiff(previousSnapshot.draft, currentSnapshot.draft),
    buildSummaryDiff(previousSnapshot.draft, currentSnapshot.draft),
    buildExperienceDiff(previousSnapshot.draft, currentSnapshot.draft),
    buildEducationDiff(previousSnapshot.draft, currentSnapshot.draft),
    buildSkillsDiff(previousSnapshot.draft, currentSnapshot.draft),
  ];

  let changedSectionCount = 0;
  let unchangedSectionCount = 0;
  let addedItemCount = 0;
  let removedItemCount = 0;
  let editedItemCount = 0;

  for (let i = 0; i < sections.length; i++) {
    if (sections[i].status === 'changed') {
      changedSectionCount += 1;
    } else {
      unchangedSectionCount += 1;
    }
    addedItemCount += sections[i].addedCount;
    removedItemCount += sections[i].removedCount;
    editedItemCount += sections[i].editedCount;
  }

  return {
    previousRevisionId: previousSnapshot.revisionId,
    currentRevisionId: currentSnapshot.revisionId,
    changedSectionCount: changedSectionCount,
    unchangedSectionCount: unchangedSectionCount,
    addedItemCount: addedItemCount,
    removedItemCount: removedItemCount,
    editedItemCount: editedItemCount,
    sections: sections,
  };
}
