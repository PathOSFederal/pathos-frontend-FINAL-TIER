import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { ResumeDiagnosticsEvaluateResponse } from './resumeDiagnostics';
import type { ResumeDiagnosticsSnapshot } from '../stores/resumeWorkspaceStore';
import { buildResumeSnapshotCompareSummary } from './resumeSnapshotCompare';
import {
  ResumeSnapshotComparePanel,
  ResumeSnapshotHistoryPanel,
} from './ResumeSnapshotPanels';

function buildResponse(
  diagnosticsId: string,
  readinessBand: ResumeDiagnosticsEvaluateResponse['overall']['readiness_band'],
  summary: string,
  issueCodes: ResumeDiagnosticsEvaluateResponse['issues'][number]['code'][],
  recommendationCodes: ResumeDiagnosticsEvaluateResponse['recommendations'][number]['code'][],
  headline: string | null,
  topPriority: string | null
): ResumeDiagnosticsEvaluateResponse {
  const issues: ResumeDiagnosticsEvaluateResponse['issues'] = [];
  for (let i = 0; i < issueCodes.length; i++) {
    issues.push({
      issue_id: 'issue-' + i.toString(),
      code: issueCodes[i],
      category: 'clarity',
      severity: 'medium',
      title: issueCodes[i],
      detail: issueCodes[i] + ' detail',
      target_refs: [
        {
          section_id: 'experience',
          bullet_id: 'exp-seed-1-bullet-0',
        },
      ],
      why_it_matters: 'It matters.',
      evidence_refs: [],
    });
  }

  const recommendations: ResumeDiagnosticsEvaluateResponse['recommendations'] = [];
  for (let i = 0; i < recommendationCodes.length; i++) {
    recommendations.push({
      code: recommendationCodes[i],
      priority: i + 1,
      title: recommendationCodes[i],
      detail: recommendationCodes[i] + ' detail',
      target_refs: [
        {
          section_id: 'experience',
          bullet_id: 'exp-seed-1-bullet-0',
        },
      ],
    });
  }

  return {
    response_state: 'evaluated',
    diagnostics_id: diagnosticsId,
    resume_id: 'resume-master-seed',
    revision_id: diagnosticsId + '-revision',
    scope: {
      evaluation_mode: 'full_document',
      evaluated_section_ids: ['summary', 'experience'],
    },
    target_context: {
      mode: 'role',
      target_role: 'Program Analyst',
      canonical_job_id: null,
    },
    overall: {
      readiness_band: readinessBand,
      score: readinessBand === 'workable' ? 74 : 58,
      summary: summary,
    },
    category_scores: [
      {
        code: 'clarity',
        label: 'Clarity',
        score: readinessBand === 'workable' ? 78 : 60,
        max_score: 100,
      },
      {
        code: 'alignment',
        label: 'Alignment',
        score: readinessBand === 'workable' ? 76 : 52,
        max_score: 100,
      },
    ],
    issues: issues,
    recommendations: recommendations,
    warnings: [],
    missing_evidence: [],
    explanations: {
      overall_summary: {
        headline: headline,
        detail: summary,
        top_priority: topPriority,
      },
      key_takeaways: [],
      section_explanations: [],
      recommendation_explanations: [],
      warning_explanations: [],
    },
    meta: {
      engine_version: 'engine-1',
      ruleset_version: 'rules-1',
      explainability_version: 'exp-1',
      knowledge_pack_version: null,
      input_hash: diagnosticsId + '-hash',
    },
  };
}

function buildSnapshot(
  snapshotId: string,
  evaluatedAt: string,
  response: ResumeDiagnosticsEvaluateResponse
): ResumeDiagnosticsSnapshot {
  return {
    snapshotId: snapshotId,
    variantId: 'resume-master-seed',
    revisionId: response.revision_id,
    diagnosticsId: response.diagnostics_id,
    inputHash: response.meta.input_hash,
    responseState: response.response_state,
    readinessBand: response.overall.readiness_band,
    overallSummary: response.overall.summary,
    response: response,
    evaluatedAt: evaluatedAt,
    meta: {
      engineVersion: response.meta.engine_version,
      rulesetVersion: response.meta.ruleset_version,
      explainabilityVersion: response.meta.explainability_version,
      knowledgePackVersion: null,
    },
  };
}

describe('ResumeSnapshotPanels', function () {
  it('renders a saved snapshot history list with selection and compare affordances', function () {
    const currentSnapshot = buildSnapshot(
      'snapshot-new-1234567890',
      '2026-04-08T15:00:00.000Z',
      buildResponse(
        'diag-new',
        'workable',
        'Newer backend summary.',
        ['SKILLS_TOO_GENERIC'],
        ['EXPAND_RELEVANT_SKILLS'],
        'Progress is visible.',
        'Expand the role-specific skills section.'
      )
    );
    const previousSnapshot = buildSnapshot(
      'snapshot-old-0987654321',
      '2026-04-07T15:00:00.000Z',
      buildResponse(
        'diag-old',
        'needs_revision',
        'Older backend summary.',
        ['MISSING_QUANTIFIED_OUTCOME', 'SKILLS_TOO_GENERIC'],
        ['ADD_RESULT_METRIC', 'EXPAND_RELEVANT_SKILLS'],
        'The resume still needs work.',
        'Rewrite the top experience bullet.'
      )
    );

    const output = renderToString(
      <ResumeSnapshotHistoryPanel
        snapshots={[currentSnapshot, previousSnapshot]}
        selectedSnapshotId={currentSnapshot.snapshotId}
        compareSnapshotId={previousSnapshot.snapshotId}
        isCompareMode={true}
        onSelectSnapshot={vi.fn()}
        onCompareSnapshot={vi.fn()}
        onToggleCompareMode={vi.fn()}
      />
    );

    expect(output).toContain('Snapshot history');
    expect(output).toContain('Newer backend summary.');
    expect(output).toContain('Older backend summary.');
    expect(output).toContain('Compare baseline');
    expect(output).toContain('View snapshot');
  });

  it('renders a bounded compare summary from saved backend snapshot values', function () {
    const previousSnapshot = buildSnapshot(
      'snapshot-old-0987654321',
      '',
      buildResponse(
        'diag-old',
        'needs_revision',
        'Older backend summary.',
        ['MISSING_QUANTIFIED_OUTCOME', 'SKILLS_TOO_GENERIC'],
        ['ADD_RESULT_METRIC', 'EXPAND_RELEVANT_SKILLS'],
        'The resume still needs work.',
        null
      )
    );
    const currentSnapshot = buildSnapshot(
      'snapshot-new-1234567890',
      '',
      buildResponse(
        'diag-new',
        'workable',
        'Newer backend summary.',
        ['SKILLS_TOO_GENERIC'],
        ['EXPAND_RELEVANT_SKILLS'],
        'Progress is visible.',
        'Expand the role-specific skills section.'
      )
    );

    const output = renderToString(
      <ResumeSnapshotComparePanel
        currentSnapshot={currentSnapshot}
        compareSnapshot={previousSnapshot}
        compareSummary={buildResumeSnapshotCompareSummary(previousSnapshot, currentSnapshot)}
      />
    );

    expect(output).toContain('Snapshot compare');
    expect(output).toContain('Improved');
    expect(output).toContain('Older backend summary.');
    expect(output).toContain('Newer backend summary.');
    expect(output).toContain('MISSING_QUANTIFIED_OUTCOME');
    expect(output).toContain('ADD_RESULT_METRIC');
  });
});
