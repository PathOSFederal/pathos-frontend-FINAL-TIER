import { describe, expect, it } from 'vitest';
import type { ResumeDiagnosticsEvaluateResponse } from './resumeDiagnostics';
import type {
  ResumeDiagnosticsSnapshot,
  ResumeDraftSummary,
} from '../stores/resumeWorkspaceStore';
import { getResumeExportReadiness } from './resumeExportReadiness';

function buildSummary(currentRevisionId: string): ResumeDraftSummary {
  return {
    id: 'resume-master-seed',
    variantId: 'resume-master-seed',
    name: 'Master Resume',
    mode: 'master',
    status: 'needs-review',
    updatedAt: '2026-04-08T17:00:00.000Z',
    targetContext: {
      targetRoleTitle: '',
      seriesGrade: '',
      agencyDomain: '',
      jobAnnouncementText: '',
      plainLanguageGoal: '',
      linkedJobId: null,
    },
    linkedToResumeId: null,
    sourceVariantId: null,
    currentRevisionId: currentRevisionId,
    latestSnapshotId: 'snapshot-latest',
  };
}

function buildResponse(
  readinessBand: ResumeDiagnosticsEvaluateResponse['overall']['readiness_band'],
  responseState: ResumeDiagnosticsEvaluateResponse['response_state'],
  issueSeverity: 'low' | 'medium' | 'high' | null
): ResumeDiagnosticsEvaluateResponse {
  const issues: ResumeDiagnosticsEvaluateResponse['issues'] = [];
  if (issueSeverity !== null) {
    issues.push({
      issue_id: 'issue-1',
      code: 'MISSING_QUANTIFIED_OUTCOME',
      category: 'metrics',
      severity: issueSeverity,
      title: 'Missing quantified outcome',
      detail: 'No clear measurable result is shown.',
      target_refs: [],
      why_it_matters: 'It matters.',
      evidence_refs: [],
    });
  }
  return {
    response_state: responseState,
    diagnostics_id: 'diag-1',
    resume_id: 'resume-master-seed',
    revision_id: 'revision-current',
    scope: {
      evaluation_mode: 'full_document',
      evaluated_section_ids: ['summary', 'experience'],
    },
    target_context: {
      mode: 'none',
    },
    overall: {
      readiness_band: readinessBand,
      score: readinessBand === 'strong' ? 88 : 65,
      summary: 'Backend summary',
    },
    category_scores: [],
    issues: issues,
    recommendations: [],
    warnings: [],
    missing_evidence: [],
    explanations: null,
    meta: {
      engine_version: 'engine-1',
      ruleset_version: 'rules-1',
      explainability_version: 'exp-1',
      knowledge_pack_version: null,
      input_hash: 'hash-1',
    },
  };
}

function buildSnapshot(
  revisionId: string,
  response: ResumeDiagnosticsEvaluateResponse
): ResumeDiagnosticsSnapshot {
  return {
    snapshotId: 'snapshot-latest',
    variantId: 'resume-master-seed',
    revisionId: revisionId,
    diagnosticsId: response.diagnostics_id,
    inputHash: response.meta.input_hash,
    responseState: response.response_state,
    readinessBand: response.overall.readiness_band,
    overallSummary: response.overall.summary,
    response: response,
    evaluatedAt: '2026-04-08T16:00:00.000Z',
    meta: {
      engineVersion: response.meta.engine_version,
      rulesetVersion: response.meta.ruleset_version,
      explainabilityVersion: response.meta.explainability_version,
      knowledgePackVersion: null,
    },
  };
}

describe('resumeExportReadiness', function () {
  it('returns ready when the latest evaluation is current and there are no blockers or caution items', function () {
    const summary = buildSummary('revision-current');
    const readiness = getResumeExportReadiness(
      summary,
      buildSnapshot('revision-current', buildResponse('strong', 'evaluated', null))
    );

    expect(readiness.state).toBe('ready');
    expect(readiness.blockers.length).toBe(0);
    expect(readiness.cautionItems.length).toBe(0);
    expect(readiness.isEvaluationCurrent).toBe(true);
  });

  it('returns caution when the latest evaluation is current but medium-severity issues remain', function () {
    const summary = buildSummary('revision-current');
    const readiness = getResumeExportReadiness(
      summary,
      buildSnapshot('revision-current', buildResponse('workable', 'evaluated', 'medium'))
    );

    expect(readiness.state).toBe('caution');
    expect(readiness.blockers.length).toBe(0);
    expect(readiness.cautionItems.length).toBeGreaterThan(0);
    expect(readiness.cautionItems[0].itemKey).toBe('issue-1');
  });

  it('returns not_ready when blocking issues remain', function () {
    const summary = buildSummary('revision-current');
    const readiness = getResumeExportReadiness(
      summary,
      buildSnapshot('revision-current', buildResponse('needs_revision', 'evaluated', 'high'))
    );

    expect(readiness.state).toBe('not_ready');
    expect(readiness.blockers.length).toBeGreaterThan(0);
    expect(readiness.blockers[0].itemKey).toBe('issue-1');
  });

  it('returns stale_evaluation when the current revision differs from the latest snapshot revision', function () {
    const summary = buildSummary('revision-current');
    const readiness = getResumeExportReadiness(
      summary,
      buildSnapshot('revision-older', buildResponse('strong', 'evaluated', null))
    );

    expect(readiness.state).toBe('stale_evaluation');
    expect(readiness.isEvaluationCurrent).toBe(false);
    expect(readiness.blockers[0].code).toBe('STALE_EVALUATION');
    expect(readiness.blockers[0].itemKey).toBe('STALE_EVALUATION-current-revision-mismatch');
  });

  it('returns not_evaluated when no snapshot exists', function () {
    const summary = buildSummary('revision-current');
    const readiness = getResumeExportReadiness(summary, null);

    expect(readiness.state).toBe('not_evaluated');
    expect(readiness.blockers[0].code).toBe('NO_EVALUATION');
    expect(readiness.blockers[0].itemKey).toBe('NO_EVALUATION-no-saved-evaluation');
  });

  it('preserves distinct keys for duplicate issue codes when backend issue ids differ', function () {
    const summary = buildSummary('revision-current');
    const response = buildResponse('workable', 'evaluated', null);
    response.issues = [
      {
        issue_id: 'issue-1',
        code: 'MISSING_QUANTIFIED_OUTCOME',
        category: 'metrics',
        severity: 'medium',
        title: 'Bullet lacks a quantified outcome',
        detail: 'First bullet needs an outcome.',
        target_refs: [{ section_id: 'experience', bullet_id: 'exp-1-b1' }],
        why_it_matters: 'It matters.',
        evidence_refs: [],
      },
      {
        issue_id: 'issue-2',
        code: 'MISSING_QUANTIFIED_OUTCOME',
        category: 'metrics',
        severity: 'medium',
        title: 'Bullet lacks a quantified outcome',
        detail: 'Second bullet needs an outcome.',
        target_refs: [{ section_id: 'experience', bullet_id: 'exp-1-b2' }],
        why_it_matters: 'It matters.',
        evidence_refs: [],
      },
    ];

    const readiness = getResumeExportReadiness(
      summary,
      buildSnapshot('revision-current', response)
    );

    expect(readiness.cautionItems.length).toBe(2);
    expect(readiness.cautionItems[0].itemKey).toBe('issue-1');
    expect(readiness.cautionItems[1].itemKey).toBe('issue-2');
  });
});
