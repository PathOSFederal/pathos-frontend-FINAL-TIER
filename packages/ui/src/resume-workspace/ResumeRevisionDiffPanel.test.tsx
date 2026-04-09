import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createDefaultDraft } from '@pathos/core';
import type { ResumeRevisionContentSnapshot } from '../stores/resumeWorkspaceStore';
import { buildResumeRevisionDiffSummary } from './resumeRevisionDiff';
import { ResumeRevisionDiffPanel } from './ResumeRevisionDiffPanel';

function buildRevisionSnapshot(
  revisionId: string,
  summary: string,
  duties: string
): ResumeRevisionContentSnapshot {
  const draft = createDefaultDraft();
  draft.summary = summary;
  draft.experience.push({
    id: 'exp-1',
    jobTitle: 'Program Analyst',
    employer: 'Agency',
    location: 'DC',
    startDate: '',
    endDate: '',
    hoursPerWeek: '',
    grade: '',
    duties: duties,
  });
  return {
    revisionId: revisionId,
    variantId: 'resume-master-seed',
    savedAt: '2026-04-08T16:00:00.000Z',
    draft: draft,
  };
}

describe('ResumeRevisionDiffPanel', function () {
  it('renders a calm revision diff summary and changed section cards', function () {
    const previousSnapshot = buildRevisionSnapshot(
      'revision-old',
      'Original summary',
      'Built weekly reports.'
    );
    const currentSnapshot = buildRevisionSnapshot(
      'revision-new',
      'Updated summary',
      'Built weekly reports.\nReduced review time by 20%.'
    );

    const output = renderToString(
      <ResumeRevisionDiffPanel
        currentRevisionSnapshot={currentSnapshot}
        compareRevisionSnapshot={previousSnapshot}
        diffSummary={buildResumeRevisionDiffSummary(previousSnapshot, currentSnapshot)}
      />
    );

    expect(output).toContain('Revision diff');
    expect(output).toContain('Sections changed');
    expect(output).toContain('Summary');
    expect(output).toContain('Experience');
    expect(output).toContain('Added');
  });

  it('renders a safe empty-state message when a baseline revision is missing', function () {
    const currentSnapshot = buildRevisionSnapshot(
      'revision-new',
      'Updated summary',
      'Built weekly reports.'
    );

    const output = renderToString(
      <ResumeRevisionDiffPanel
        currentRevisionSnapshot={currentSnapshot}
        compareRevisionSnapshot={null}
        diffSummary={null}
      />
    );

    expect(output).toContain('Select two saved revisions');
  });
});
