import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ResumeExportReadinessCard } from './ResumeExportReadinessCard';

describe('ResumeExportReadinessCard', function () {
  it('renders blockers and caution items clearly', function () {
    const output = renderToString(
      <ResumeExportReadinessCard
        readinessSummary={{
          state: 'not_ready',
          headline: 'This variant is not ready to export yet.',
          detail: 'Blocking issues remain.',
          nextAction: 'Fix blocking issues',
          isEvaluationCurrent: true,
          hasResumeChangedSinceEvaluation: false,
          lastEvaluatedAt: '2026-04-08T16:00:00.000Z',
          latestSnapshotId: 'snapshot-latest',
          latestSnapshotRevisionId: 'revision-current',
          currentRevisionId: 'revision-current',
          blockers: [
            {
              itemKey: 'BLOCKER_1-blocking-issue',
              code: 'BLOCKER_1',
              title: 'Blocking issue',
              detail: 'A blocking detail.',
            },
          ],
          cautionItems: [
            {
              itemKey: 'CAUTION_1-caution-issue',
              code: 'CAUTION_1',
              title: 'Caution issue',
              detail: 'A caution detail.',
            },
          ],
        }}
      />
    );

    expect(output).toContain('Export readiness');
    expect(output).toContain('Not ready');
    expect(output).toContain('Blocking before export');
    expect(output).toContain('Caution items');
    expect(output).toContain('Blocking issue');
    expect(output).toContain('Caution issue');
  });

  it('renders safely when optional snapshot timing is missing', function () {
    const output = renderToString(
      <ResumeExportReadinessCard
        readinessSummary={{
          state: 'not_evaluated',
          headline: 'No current export-readiness evaluation is available.',
          detail: 'Run diagnostics before export.',
          nextAction: 'Run diagnostics',
          isEvaluationCurrent: false,
          hasResumeChangedSinceEvaluation: false,
          lastEvaluatedAt: null,
          latestSnapshotId: null,
          latestSnapshotRevisionId: null,
          currentRevisionId: 'revision-current',
          blockers: [],
          cautionItems: [],
        }}
      />
    );

    expect(output).toContain('No saved evaluation');
    expect(output).toContain('Not evaluated');
  });
});
