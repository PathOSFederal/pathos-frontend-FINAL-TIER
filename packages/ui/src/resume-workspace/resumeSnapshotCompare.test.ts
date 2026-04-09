import { describe, expect, it } from 'vitest';
import type { ResumeDiagnosticsEvaluateResponse } from './resumeDiagnostics';
import type { ResumeDiagnosticsSnapshot } from '../stores/resumeWorkspaceStore';
import {
  buildResumeSnapshotCompareSummary,
  getSnapshotDisplayId,
} from './resumeSnapshotCompare';

function buildResponse(
  readinessBand: ResumeDiagnosticsEvaluateResponse['overall']['readiness_band'],
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
      detail: 'Detail for ' + issueCodes[i],
      target_refs: [
        {
          section_id: 'summary',
          bullet_id: null,
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
      detail: 'Detail for ' + recommendationCodes[i],
      target_refs: [
        {
          section_id: 'summary',
          bullet_id: null,
        },
      ],
    });
  }

  return {
    response_state: 'evaluated',
    diagnostics_id: 'diag-' + readinessBand,
    resume_id: 'resume-master-seed',
    revision_id: 'revision-' + readinessBand,
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
      score: readinessBand === 'workable' ? 72 : 54,
      summary: 'Summary for ' + readinessBand,
    },
    category_scores: [
      {
        code: 'clarity',
        label: 'Clarity',
        score: readinessBand === 'workable' ? 78 : 61,
        max_score: 100,
      },
      {
        code: 'alignment',
        label: 'Alignment',
        score: readinessBand === 'workable' ? 75 : 49,
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
        detail: 'Detail',
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
      input_hash: 'hash-' + readinessBand,
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

describe('resumeSnapshotCompare', function () {
  it('builds an improved compare summary from saved backend snapshots', function () {
    const previousSnapshot = buildSnapshot(
      'snapshot-old-abcdef1234',
      '2026-04-07T15:00:00.000Z',
      buildResponse(
        'needs_revision',
        ['MISSING_QUANTIFIED_OUTCOME', 'SKILLS_TOO_GENERIC'],
        ['ADD_RESULT_METRIC', 'EXPAND_RELEVANT_SKILLS'],
        'The resume needs revision.',
        'Start by strengthening the experience bullets.'
      )
    );
    const currentSnapshot = buildSnapshot(
      'snapshot-new-uvwxyz9876',
      '2026-04-08T15:00:00.000Z',
      buildResponse(
        'workable',
        ['SKILLS_TOO_GENERIC'],
        ['EXPAND_RELEVANT_SKILLS'],
        'The resume is more workable now.',
        'Expand the role-specific skills section.'
      )
    );

    const summary = buildResumeSnapshotCompareSummary(previousSnapshot, currentSnapshot);

    expect(summary.readinessStatus).toBe('improved');
    expect(summary.issueDelta.resolved).toContain('MISSING_QUANTIFIED_OUTCOME');
    expect(summary.recommendationDelta.resolved).toContain('ADD_RESULT_METRIC');
    expect(summary.explanationDelta.headlineChanged).toBe(true);
    expect(summary.categoryDeltas[0].status).toBe('improved');
  });

  it('handles missing explanation values and short snapshot labels safely', function () {
    const previousSnapshot = buildSnapshot(
      'snap-1',
      '',
      buildResponse('needs_revision', [], [], null, null)
    );
    const currentSnapshot = buildSnapshot(
      'snap-2',
      '',
      buildResponse('needs_revision', [], [], null, null)
    );

    const summary = buildResumeSnapshotCompareSummary(previousSnapshot, currentSnapshot);

    expect(summary.readinessStatus).toBe('unchanged');
    expect(summary.explanationDelta.previousHeadline).toBeNull();
    expect(summary.explanationDelta.currentTopPriority).toBeNull();
    expect(getSnapshotDisplayId('snap-1')).toBe('snap-1');
  });
});
