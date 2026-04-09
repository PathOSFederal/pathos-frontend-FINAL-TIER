import { describe, expect, it } from 'vitest';
import { createDefaultDraft } from '@pathos/core';
import type { ResumeDraft } from '@pathos/core';
import type { ResumeRevisionContentSnapshot } from '../stores/resumeWorkspaceStore';
import { buildResumeRevisionDiffSummary } from './resumeRevisionDiff';

function buildRevisionSnapshot(
  revisionId: string,
  draft: ResumeDraft
): ResumeRevisionContentSnapshot {
  return {
    revisionId: revisionId,
    variantId: 'resume-master-seed',
    savedAt: '2026-04-08T16:00:00.000Z',
    draft: draft,
  };
}

describe('resumeRevisionDiff', function () {
  it('classifies changed sections and added, removed, and edited items', function () {
    const previousDraft = createDefaultDraft();
    previousDraft.contact.fullName = 'Jordan Ellis';
    previousDraft.summary = 'Program analyst supporting delivery operations.';
    previousDraft.experience.push({
      id: 'exp-1',
      jobTitle: 'Program Analyst',
      employer: 'Agency',
      location: 'DC',
      startDate: '',
      endDate: '',
      hoursPerWeek: '',
      grade: '',
      duties: 'Built weekly reports.\nTracked milestone status.',
    });
    previousDraft.skills.push({ id: 'skill-1', name: 'Reporting' });

    const currentDraft = createDefaultDraft();
    currentDraft.contact.fullName = 'Jordan Ellis';
    currentDraft.contact.phone = '202-555-0184';
    currentDraft.summary = 'Program analyst supporting delivery operations and executive reporting.';
    currentDraft.experience.push({
      id: 'exp-1',
      jobTitle: 'Program Analyst',
      employer: 'Agency',
      location: 'DC',
      startDate: '',
      endDate: '',
      hoursPerWeek: '',
      grade: '',
      duties: 'Built weekly reports.\nReduced review time by 20%.',
    });
    currentDraft.skills.push({ id: 'skill-1', name: 'Executive reporting' });
    currentDraft.skills.push({ id: 'skill-2', name: 'Stakeholder coordination' });

    const diffSummary = buildResumeRevisionDiffSummary(
      buildRevisionSnapshot('revision-old', previousDraft),
      buildRevisionSnapshot('revision-new', currentDraft)
    );

    expect(diffSummary.changedSectionCount).toBeGreaterThanOrEqual(4);
    expect(diffSummary.editedItemCount).toBeGreaterThan(0);
    expect(diffSummary.addedItemCount).toBeGreaterThan(0);

    const experienceSection = diffSummary.sections.find(function (section) {
      return section.sectionId === 'experience';
    });
    expect(experienceSection !== undefined && experienceSection !== null).toBe(true);
    expect(
      experienceSection !== undefined &&
      experienceSection !== null &&
      experienceSection.items.some(function (item) {
        return item.changeType === 'edited';
      })
    ).toBe(true);
  });

  it('stays safe when both revisions are identical', function () {
    const draft = createDefaultDraft();
    draft.summary = 'Stable summary.';

    const diffSummary = buildResumeRevisionDiffSummary(
      buildRevisionSnapshot('revision-a', draft),
      buildRevisionSnapshot('revision-b', createDefaultDraft())
    );

    expect(diffSummary.sections.length).toBe(5);
    const changedSections = diffSummary.sections.filter(function (section) {
      return section.status === 'changed';
    });
    expect(changedSections.length).toBeGreaterThanOrEqual(1);
  });
});
