/**
 * ============================================================================
 * RESUME EXPORT READINESS CARD — Day 84 review-shell gate
 * ============================================================================
 *
 * PURPOSE:
 * Give the user one explicit, calm answer to "can I export this variant right
 * now?" using only saved backend diagnostics plus revision freshness.
 */

import type React from 'react';
import type {
  ResumeExportReadinessItem,
  ResumeExportReadinessSummary,
} from './resumeExportReadiness';

function stateLabel(state: ResumeExportReadinessSummary['state']): string {
  if (state === 'ready') {
    return 'Ready';
  }
  if (state === 'caution') {
    return 'Caution';
  }
  if (state === 'not_ready') {
    return 'Not ready';
  }
  if (state === 'stale_evaluation') {
    return 'Stale evaluation';
  }
  return 'Not evaluated';
}

function stateTone(state: ResumeExportReadinessSummary['state']): string {
  if (state === 'ready') {
    return 'var(--p-success)';
  }
  if (state === 'caution') {
    return 'var(--p-warning)';
  }
  if (state === 'not_ready' || state === 'stale_evaluation' || state === 'not_evaluated') {
    return 'var(--p-danger)';
  }
  return 'var(--p-text-muted)';
}

function formatEvaluatedAtLabel(value: string | null): string {
  if (value === null || value.trim().length === 0) {
    return 'No saved evaluation';
  }
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Saved time unavailable';
  }
  return parsedDate.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ResumeExportReadinessItemList(props: {
  title: string;
  items: ResumeExportReadinessItem[];
}) {
  if (props.items.length === 0) {
    return null;
  }
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
      <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
        {props.title}
      </div>
      <div className="mt-3 space-y-3">
        {props.items.map(function (item) {
          return (
            <div
              key={item.itemKey}
              className="rounded-lg border p-3"
              style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface)' }}
            >
              <div className="text-sm font-medium" style={{ color: 'var(--p-text)' }}>
                {item.title}
              </div>
              <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
                {item.detail}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface ResumeExportReadinessCardProps {
  readinessSummary: ResumeExportReadinessSummary;
}

export function ResumeExportReadinessCard(
  props: ResumeExportReadinessCardProps
) {
  return (
    <section
      className="rounded-xl border p-5"
      style={{
        background: 'var(--p-surface)',
        borderColor: 'var(--p-border)',
      }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--p-text)' }}>
            Export readiness
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
            This gate uses the latest saved backend diagnostics plus current revision freshness. It does not re-run diagnostics or guess at current confidence.
          </p>
        </div>
        <span
          className="rounded-full border px-3 py-1 text-sm font-semibold"
          style={{
            borderColor: stateTone(props.readinessSummary.state),
            color: stateTone(props.readinessSummary.state),
          }}
        >
          {stateLabel(props.readinessSummary.state)}
        </span>
      </div>

      <div className="mt-4 rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'color-mix(in srgb, var(--p-accent) 6%, var(--p-surface))' }}>
        <div className="text-lg font-semibold" style={{ color: 'var(--p-text)' }}>
          {props.readinessSummary.headline}
        </div>
        <p className="mt-2 text-sm" style={{ color: 'var(--p-text-muted)' }}>
          {props.readinessSummary.detail}
        </p>
        <div className="mt-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
            Next action
          </div>
          <div className="mt-1" style={{ color: 'var(--p-text)' }}>
            {props.readinessSummary.nextAction}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
            Latest evaluation
          </div>
          <div className="mt-2 text-sm" style={{ color: 'var(--p-text)' }}>
            {formatEvaluatedAtLabel(props.readinessSummary.lastEvaluatedAt)}
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
            Evaluation freshness
          </div>
          <div className="mt-2 text-sm" style={{ color: 'var(--p-text)' }}>
            {props.readinessSummary.isEvaluationCurrent ? 'Current' : 'Stale'}
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
            Revision linkage
          </div>
          <div className="mt-2 text-xs" style={{ color: 'var(--p-text-muted)' }}>
            Latest diagnostics revision {props.readinessSummary.latestSnapshotRevisionId !== null ? props.readinessSummary.latestSnapshotRevisionId : 'Unavailable'}
          </div>
          <div className="mt-1 text-xs" style={{ color: 'var(--p-text)' }}>
            Current draft revision {props.readinessSummary.currentRevisionId}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ResumeExportReadinessItemList title="Blocking before export" items={props.readinessSummary.blockers} />
        <ResumeExportReadinessItemList title="Caution items" items={props.readinessSummary.cautionItems} />
      </div>
    </section>
  );
}
