/**
 * ============================================================================
 * SAVED JOBS LIVE ADVISOR PANEL
 * ============================================================================
 *
 * PURPOSE:
 * Render one narrow, honest frontend surface for live backend advisor output.
 * This component is intentionally presentational: it receives already-normalized
 * evaluation state and shows loading, error, empty, partial-evidence, and
 * success states without inventing conclusions.
 */

'use client';

import type React from 'react';
import { AlertTriangle, LoaderCircle, RefreshCcw, ShieldAlert, Target } from 'lucide-react';

export interface SavedJobsLiveStoredJob {
  savedSearchId: string;
  jobId: string;
  title: string | null;
  organization: string | null;
  locations: string[];
  gradeMin: number | null;
  gradeMax: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  openDate: string | null;
  closeDate: string | null;
  applyUrl: string | null;
  sourceName: string | null;
  lastSeenAt: string | null;
}

export interface SavedJobsLiveEvidenceRef {
  label: string | null;
  sourceCategory: string | null;
  factStatus: string | null;
}

export interface SavedJobsLiveReasonLikeItem {
  code: string | null;
  ruleId: string | null;
  basis: string | null;
  text: string;
  severity: string | null;
  suggestion: string | null;
  importance: string | null;
  evidenceRefs: SavedJobsLiveEvidenceRef[];
}

export interface SavedJobsLiveNextAction {
  code: string | null;
  action: string;
  priority: number;
}

export interface SavedJobsLiveBlockingIssue {
  code: string | null;
  ruleId: string | null;
  sourceType: string | null;
  severity: string | null;
  text: string;
  evidenceRefs: SavedJobsLiveEvidenceRef[];
}

export interface SavedJobsLiveApplicationDecision {
  decisionBand: string;
  priorityLevel: string;
  alertImportance: string;
  rationaleSummary: string;
  blockingIssues: SavedJobsLiveBlockingIssue[];
  recommendedNextActions: SavedJobsLiveNextAction[];
  decisionRuleIds: string[];
  decisionVersion: string | null;
}

export interface SavedJobsLiveEvaluation {
  recommendation: string;
  decisionBand: string;
  confidenceBand: string;
  overallScore: number;
  reasons: SavedJobsLiveReasonLikeItem[];
  gaps: SavedJobsLiveReasonLikeItem[];
  warnings: SavedJobsLiveReasonLikeItem[];
  missingEvidence: SavedJobsLiveReasonLikeItem[];
  nextActions: SavedJobsLiveNextAction[];
  applicationDecision: SavedJobsLiveApplicationDecision | null;
  explainabilityVersion: string | null;
  engineVersion: string | null;
}

export interface SavedJobsLiveEvaluationState {
  status: 'idle' | 'loading' | 'error' | 'empty' | 'success';
  errorMessage: string | null;
  evaluation: SavedJobsLiveEvaluation | null;
}

function decisionLabel(value: string): string {
  if (value === 'apply_now') return 'Apply now';
  if (value === 'not_recommended') return 'Not recommended';
  if (value === 'low_priority') return 'Low priority';
  return value.replace(/_/g, ' ');
}

function scoreTone(score: number): string {
  if (score >= 80) return 'var(--p-success)';
  if (score >= 60) return 'var(--p-warning, #eab308)';
  return 'var(--p-danger, #ef4444)';
}

function renderEvidenceHints(items: SavedJobsLiveEvidenceRef[]): React.ReactNode {
  const labels: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.label !== null && item.label !== '') {
      labels.push(item.label);
    }
  }
  if (labels.length === 0) {
    return null;
  }

  return (
    <p className="text-[11px] mt-1" style={{ color: 'var(--p-text-dim)' }}>
      Based on: {labels.join(', ')}
    </p>
  );
}

function ReasonList(props: {
  title: string;
  emptyLabel: string;
  items: SavedJobsLiveReasonLikeItem[];
  accentColor: string;
}) {
  if (props.items.length === 0) {
    return (
      <div
        className="rounded-md px-3 py-3"
        style={{ background: 'var(--p-surface2)', border: '1px solid var(--p-border)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--p-text-dim)' }}>
          {props.title}
        </p>
        <p className="text-xs mt-2" style={{ color: 'var(--p-text-muted)' }}>
          {props.emptyLabel}
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-md px-3 py-3"
      style={{ background: 'var(--p-surface2)', border: '1px solid var(--p-border)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--p-text-dim)' }}>
        {props.title}
      </p>
      <ul className="list-none mt-2 space-y-2">
        {props.items.map(function (item, index) {
          return (
            <li key={props.title + '-' + index}>
              <p className="text-sm font-medium" style={{ color: props.accentColor }}>
                {item.text}
              </p>
              {item.suggestion !== null && item.suggestion !== '' ? (
                <p className="text-xs mt-1" style={{ color: 'var(--p-text-muted)' }}>
                  Next fix: {item.suggestion}
                </p>
              ) : null}
              {renderEvidenceHints(item.evidenceRefs)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NextActionsList(props: { actions: SavedJobsLiveNextAction[] }) {
  if (props.actions.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-md px-3 py-3"
      style={{ background: 'var(--p-surface2)', border: '1px solid var(--p-border)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--p-text-dim)' }}>
        Next Actions
      </p>
      <ol className="mt-2 space-y-2">
        {props.actions.map(function (item, index) {
          return (
            <li key={'action-' + index} className="text-sm" style={{ color: 'var(--p-text)' }}>
              {index + 1}. {item.action}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function SavedJobsLiveAdvisorPanel(props: {
  jobTitle: string;
  state: SavedJobsLiveEvaluationState;
  onRetry: (() => void) | null;
}) {
  if (props.state.status === 'loading' || props.state.status === 'idle') {
    return (
      <div
        className="rounded-md px-4 py-4 flex items-center gap-3"
        data-testid="saved-jobs-live-advisor-loading"
        style={{ background: 'var(--p-surface2)', border: '1px solid var(--p-border)' }}
      >
        <LoaderCircle className="w-4 h-4 animate-spin" style={{ color: 'var(--p-accent)' }} />
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--p-text)' }}>
            Loading live advisor evaluation
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--p-text-dim)' }}>
            PathOS is requesting the deterministic backend evaluation for {props.jobTitle}.
          </p>
        </div>
      </div>
    );
  }

  if (props.state.status === 'error') {
    return (
      <div
        className="rounded-md px-4 py-4"
        data-testid="saved-jobs-live-advisor-error"
        style={{ background: 'var(--p-surface2)', border: '1px solid var(--p-border)' }}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" style={{ color: 'var(--p-danger, #ef4444)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--p-text)' }}>
            Live advisor evaluation is unavailable
          </p>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--p-text-muted)' }}>
          {props.state.errorMessage !== null && props.state.errorMessage !== ''
            ? props.state.errorMessage
            : 'The backend did not return an evaluation for this stored job.'}
        </p>
        {props.onRetry !== null ? (
          <button
            type="button"
            onClick={props.onRetry}
            className="inline-flex items-center gap-2 text-xs mt-3 px-3 py-1.5 rounded"
            style={{
              background: 'var(--p-surface)',
              border: '1px solid var(--p-border)',
              color: 'var(--p-text-muted)',
            }}
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Retry evaluation
          </button>
        ) : null}
      </div>
    );
  }

  if (props.state.status === 'empty' || props.state.evaluation === null) {
    return (
      <div
        className="rounded-md px-4 py-4"
        data-testid="saved-jobs-live-advisor-empty"
        style={{ background: 'var(--p-surface2)', border: '1px solid var(--p-border)' }}
      >
        <p className="text-sm font-medium" style={{ color: 'var(--p-text)' }}>
          No live advisor output was returned
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--p-text-dim)' }}>
          This job is linked to the backend catalog, but no structured evaluation was available yet.
        </p>
      </div>
    );
  }

  const evaluation = props.state.evaluation;
  const applicationDecision = evaluation.applicationDecision;
  const hasPartialEvidence =
    evaluation.missingEvidence.length > 0 || evaluation.confidenceBand !== 'high';

  return (
    <div className="space-y-3" data-testid="saved-jobs-live-advisor-success">
      <div
        className="rounded-md px-4 py-4"
        style={{ background: 'var(--p-surface2)', border: '1px solid var(--p-border)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--p-text-dim)' }}>
              Live Advisor Decision
            </p>
            <p className="text-lg font-semibold mt-1" style={{ color: 'var(--p-text)' }}>
              {applicationDecision !== null
                ? decisionLabel(applicationDecision.decisionBand)
                : decisionLabel(evaluation.recommendation)}
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--p-text-muted)' }}>
              {applicationDecision !== null
                ? applicationDecision.rationaleSummary
                : 'This is the backend qualification result for the selected stored job.'}
            </p>
          </div>
          <div
            className="px-3 py-2 rounded-md text-right"
            style={{
              background: 'color-mix(in srgb, ' + scoreTone(evaluation.overallScore) + ' 10%, transparent)',
              border: '1px solid color-mix(in srgb, ' + scoreTone(evaluation.overallScore) + ' 20%, var(--p-border))',
            }}
          >
            <p className="text-xl font-bold leading-none" style={{ color: scoreTone(evaluation.overallScore) }}>
              {String(evaluation.overallScore)}
            </p>
            <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: 'var(--p-text-dim)' }}>
              Overall score
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--p-surface)', color: 'var(--p-text-muted)' }}>
            Recommendation: {decisionLabel(evaluation.recommendation)}
          </span>
          <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--p-surface)', color: 'var(--p-text-muted)' }}>
            Confidence: {decisionLabel(evaluation.confidenceBand)}
          </span>
          <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--p-surface)', color: 'var(--p-text-muted)' }}>
            Decision band: {decisionLabel(evaluation.decisionBand)}
          </span>
        </div>

        {hasPartialEvidence ? (
          <div
            className="mt-3 rounded-md px-3 py-2 flex items-start gap-2"
            style={{ background: 'color-mix(in srgb, var(--p-warning, #eab308) 10%, transparent)' }}
          >
            <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--p-warning, #eab308)' }} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--p-text-dim)' }}>
                Partial evidence
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--p-text-muted)' }}>
                The backend surfaced missing evidence or lowered confidence. Treat this as structured guidance, not certainty.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <ReasonList
        title="Grounded Reasons"
        emptyLabel="No positive reasons were returned."
        items={evaluation.reasons}
        accentColor="var(--p-text)"
      />

      <ReasonList
        title="Gaps"
        emptyLabel="No explicit gaps were returned."
        items={evaluation.gaps}
        accentColor="var(--p-warning, #eab308)"
      />

      <ReasonList
        title="Warnings"
        emptyLabel="No warnings were returned."
        items={evaluation.warnings}
        accentColor="var(--p-danger, #ef4444)"
      />

      <ReasonList
        title="Missing Evidence"
        emptyLabel="No missing-evidence items were returned."
        items={evaluation.missingEvidence}
        accentColor="var(--p-text)"
      />

      {applicationDecision !== null && applicationDecision.blockingIssues.length > 0 ? (
        <div
          className="rounded-md px-3 py-3"
          style={{ background: 'var(--p-surface2)', border: '1px solid var(--p-border)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--p-text-dim)' }}>
            Blocking Issues
          </p>
          <ul className="list-none mt-2 space-y-2">
            {applicationDecision.blockingIssues.map(function (item, index) {
              return (
                <li key={'blocking-' + index}>
                  <p className="text-sm font-medium" style={{ color: 'var(--p-danger, #ef4444)' }}>
                    {item.text}
                  </p>
                  {renderEvidenceHints(item.evidenceRefs)}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <NextActionsList
        actions={
          applicationDecision !== null && applicationDecision.recommendedNextActions.length > 0
            ? applicationDecision.recommendedNextActions
            : evaluation.nextActions
        }
      />

      <div
        className="rounded-md px-3 py-3 flex items-start gap-2"
        style={{ background: 'var(--p-surface2)', border: '1px solid var(--p-border)' }}
      >
        <Target className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--p-accent)' }} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--p-text-dim)' }}>
            Explainability metadata
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--p-text-muted)' }}>
            Engine {evaluation.engineVersion !== null && evaluation.engineVersion !== '' ? evaluation.engineVersion : 'unknown'}
            {' \u2022 '}
            Explainability {evaluation.explainabilityVersion !== null && evaluation.explainabilityVersion !== '' ? evaluation.explainabilityVersion : 'unknown'}
            {applicationDecision !== null && applicationDecision.decisionVersion !== null && applicationDecision.decisionVersion !== ''
              ? ' \u2022 Decision ' + applicationDecision.decisionVersion
              : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
