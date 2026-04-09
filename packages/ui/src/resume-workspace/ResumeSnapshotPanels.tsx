/**
 * ============================================================================
 * RESUME SNAPSHOT HISTORY + COMPARE PANELS — Day 82 review-shell additions
 * ============================================================================
 *
 * PURPOSE:
 * These panels surface saved diagnostics history for the active variant and let
 * the user compare two persisted backend snapshots without turning the UI into
 * a raw engineering diff tool.
 *
 * DESIGN RULE:
 * The components stay intentionally dumb. They receive already-saved snapshot
 * objects and already-computed compare summaries. They do not derive new
 * diagnostics meaning and they do not call the backend.
 */

import type React from 'react';
import { formatReadinessBandLabel } from './resumeDiagnostics';
import type { ResumeDiagnosticsSnapshot } from '../stores/resumeWorkspaceStore';
import type { ResumeSnapshotCompareSummary } from './resumeSnapshotCompare';
import { getSnapshotDisplayId } from './resumeSnapshotCompare';

function formatEvaluatedAtLabel(value: string | null | undefined): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'Saved time unavailable';
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

function compareStatusLabel(status: 'improved' | 'unchanged' | 'regressed'): string {
  if (status === 'improved') {
    return 'Improved';
  }
  if (status === 'regressed') {
    return 'Regressed';
  }
  return 'Unchanged';
}

function compareStatusTone(status: 'improved' | 'unchanged' | 'regressed'): string {
  if (status === 'improved') {
    return 'var(--p-success)';
  }
  if (status === 'regressed') {
    return 'var(--p-danger)';
  }
  return 'var(--p-text-muted)';
}

export interface ResumeSnapshotHistoryPanelProps {
  snapshots: ResumeDiagnosticsSnapshot[];
  selectedSnapshotId: string | null;
  compareSnapshotId: string | null;
  isCompareMode: boolean;
  onSelectSnapshot: (snapshotId: string) => void;
  onCompareSnapshot: (snapshotId: string | null) => void;
  onToggleCompareMode: (isCompareMode: boolean) => void;
}

export function ResumeSnapshotHistoryPanel(
  props: ResumeSnapshotHistoryPanelProps
) {
  const hasSnapshots = props.snapshots.length > 0;
  return (
    <section
      className="rounded-xl border p-5"
      style={{
        background: 'var(--p-surface)',
        borderColor: 'var(--p-border)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--p-text)' }}>
            Snapshot history
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
            Review saved backend snapshots for this variant and compare changes without re-running diagnostics.
          </p>
        </div>
        <button
          type="button"
          onClick={function () {
            props.onToggleCompareMode(!props.isCompareMode);
          }}
          disabled={props.snapshots.length < 2}
          className="rounded-md border px-3 py-2 text-xs font-medium transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
          style={{
            borderColor: props.isCompareMode ? 'var(--p-accent)' : 'var(--p-border)',
            color: props.isCompareMode ? 'var(--p-accent)' : 'var(--p-text-muted)',
            background: props.isCompareMode ? 'color-mix(in srgb, var(--p-accent) 8%, var(--p-surface))' : 'var(--p-surface2)',
          }}
        >
          {props.isCompareMode ? 'Exit compare' : 'Compare snapshots'}
        </button>
      </div>

      {!hasSnapshots ? (
        <div
          className="mt-4 rounded-xl border p-4 text-sm"
          style={{
            borderColor: 'var(--p-border)',
            background: 'var(--p-surface2)',
            color: 'var(--p-text-muted)',
          }}
        >
          No saved snapshots yet. Run diagnostics to create the first saved history entry for this variant.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {props.snapshots.map(function (snapshot) {
            const isSelected = snapshot.snapshotId === props.selectedSnapshotId;
            const isCompareTarget = snapshot.snapshotId === props.compareSnapshotId;
            return (
              <div
                key={snapshot.snapshotId}
                className="rounded-xl border p-4"
                style={{
                  borderColor: isSelected ? 'var(--p-accent)' : 'var(--p-border)',
                  background: isSelected ? 'color-mix(in srgb, var(--p-accent) 8%, var(--p-surface))' : 'var(--p-surface2)',
                }}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full border px-2 py-1 text-xs font-medium"
                        style={{
                          borderColor: 'var(--p-border)',
                          color: 'var(--p-text-muted)',
                        }}
                      >
                        {getSnapshotDisplayId(snapshot.snapshotId)}
                      </span>
                      <span
                        className="rounded-full border px-2 py-1 text-xs font-medium"
                        style={{
                          borderColor: 'var(--p-border)',
                          color: 'var(--p-text-muted)',
                        }}
                      >
                        {formatReadinessBandLabel(snapshot.readinessBand)}
                      </span>
                      {isCompareTarget ? (
                        <span
                          className="rounded-full border px-2 py-1 text-xs font-medium"
                          style={{
                            borderColor: 'var(--p-accent)',
                            color: 'var(--p-accent)',
                          }}
                        >
                          Compare baseline
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-medium" style={{ color: 'var(--p-text)' }}>
                      {snapshot.overallSummary}
                    </p>
                    <div className="mt-2 space-y-1 text-xs" style={{ color: 'var(--p-text-dim)' }}>
                      <div>Saved {formatEvaluatedAtLabel(snapshot.evaluatedAt)}</div>
                      <div>
                        Revision {typeof snapshot.revisionId === 'string' && snapshot.revisionId.length > 0 ? snapshot.revisionId : 'Unavailable'}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={function () {
                        props.onSelectSnapshot(snapshot.snapshotId);
                      }}
                      className="rounded-md border px-3 py-2 text-xs font-medium transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
                      style={{
                        borderColor: isSelected ? 'var(--p-accent)' : 'var(--p-border)',
                        color: isSelected ? 'var(--p-accent)' : 'var(--p-text-muted)',
                        background: isSelected ? 'color-mix(in srgb, var(--p-accent) 8%, var(--p-surface))' : 'var(--p-surface)',
                      }}
                    >
                      {isSelected ? 'Viewing' : 'View snapshot'}
                    </button>
                    <button
                      type="button"
                      onClick={function () {
                        if (isCompareTarget) {
                          props.onCompareSnapshot(null);
                          return;
                        }
                        props.onCompareSnapshot(snapshot.snapshotId);
                      }}
                      disabled={props.snapshots.length < 2 || snapshot.snapshotId === props.selectedSnapshotId}
                      className="rounded-md border px-3 py-2 text-xs font-medium transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
                      style={{
                        borderColor: isCompareTarget ? 'var(--p-accent)' : 'var(--p-border)',
                        color: isCompareTarget ? 'var(--p-accent)' : 'var(--p-text-muted)',
                        background: isCompareTarget ? 'color-mix(in srgb, var(--p-accent) 8%, var(--p-surface))' : 'var(--p-surface)',
                      }}
                    >
                      {isCompareTarget ? 'Clear baseline' : 'Compare against'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export interface ResumeSnapshotComparePanelProps {
  currentSnapshot: ResumeDiagnosticsSnapshot | null;
  compareSnapshot: ResumeDiagnosticsSnapshot | null;
  compareSummary: ResumeSnapshotCompareSummary | null;
}

export function ResumeSnapshotComparePanel(
  props: ResumeSnapshotComparePanelProps
) {
  if (props.currentSnapshot === null || props.compareSnapshot === null || props.compareSummary === null) {
    return (
      <section
        className="rounded-xl border p-5"
        style={{
          background: 'var(--p-surface)',
          borderColor: 'var(--p-border)',
        }}
      >
        <h2 className="text-lg font-semibold" style={{ color: 'var(--p-text)' }}>
          Snapshot compare
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
          Select a saved baseline snapshot to compare changes in readiness, issues, recommendations, and explanation focus.
        </p>
      </section>
    );
  }

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
            Snapshot compare
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
            Comparing saved backend outputs only. No live diagnostics were re-run for this view.
          </p>
        </div>
        <div className="space-y-1 text-xs" style={{ color: 'var(--p-text-dim)' }}>
          <div>Current {getSnapshotDisplayId(props.currentSnapshot.snapshotId)}</div>
          <div>Baseline {getSnapshotDisplayId(props.compareSnapshot.snapshotId)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
            Readiness
          </div>
          <div className="mt-2 text-lg font-semibold" style={{ color: compareStatusTone(props.compareSummary.readinessStatus) }}>
            {compareStatusLabel(props.compareSummary.readinessStatus)}
          </div>
          <p className="mt-2 text-sm" style={{ color: 'var(--p-text-muted)' }}>
            {formatReadinessBandLabel(props.compareSummary.previousReadinessBand)} → {formatReadinessBandLabel(props.compareSummary.currentReadinessBand)}
          </p>
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
            Issues
          </div>
          <div className="mt-2 text-sm" style={{ color: 'var(--p-text)' }}>
            {props.compareSummary.issueDelta.added.length.toString()} added · {props.compareSummary.issueDelta.resolved.length.toString()} resolved
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--p-text-muted)' }}>
            Persistent issue codes: {props.compareSummary.issueDelta.persistent.length.toString()}
          </p>
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
            Recommendations
          </div>
          <div className="mt-2 text-sm" style={{ color: 'var(--p-text)' }}>
            {props.compareSummary.recommendationDelta.added.length.toString()} added · {props.compareSummary.recommendationDelta.resolved.length.toString()} resolved
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--p-text-muted)' }}>
            Persistent recommendation codes: {props.compareSummary.recommendationDelta.persistent.length.toString()}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
          <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
            Category score changes
          </div>
          <div className="mt-3 space-y-2">
            {props.compareSummary.categoryDeltas.map(function (delta) {
              return (
                <div
                  key={delta.code}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                  style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface)' }}
                >
                  <span className="text-sm" style={{ color: 'var(--p-text)' }}>
                    {delta.label}
                  </span>
                  <span className="text-xs font-medium" style={{ color: compareStatusTone(delta.status) }}>
                    {delta.previousScore !== null ? delta.previousScore.toString() : '—'} → {delta.currentScore !== null ? delta.currentScore.toString() : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
          <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
            Explanation continuity
          </div>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
                Overall summary
              </div>
              <p className="mt-1" style={{ color: 'var(--p-text-muted)' }}>
                {props.compareSummary.previousOverallSummary !== null ? props.compareSummary.previousOverallSummary : 'No prior summary saved.'}
              </p>
              <p className="mt-2" style={{ color: 'var(--p-text)' }}>
                {props.compareSummary.currentOverallSummary !== null ? props.compareSummary.currentOverallSummary : 'No current summary saved.'}
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
                PathAdvisor headline
              </div>
              <p className="mt-1" style={{ color: 'var(--p-text-muted)' }}>
                {props.compareSummary.explanationDelta.previousHeadline !== null ? props.compareSummary.explanationDelta.previousHeadline : 'No prior headline saved.'}
              </p>
              <p className="mt-2" style={{ color: 'var(--p-text)' }}>
                {props.compareSummary.explanationDelta.currentHeadline !== null ? props.compareSummary.explanationDelta.currentHeadline : 'No current headline saved.'}
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
                Top priority
              </div>
              <p className="mt-1" style={{ color: 'var(--p-text-muted)' }}>
                {props.compareSummary.explanationDelta.previousTopPriority !== null ? props.compareSummary.explanationDelta.previousTopPriority : 'No prior priority saved.'}
              </p>
              <p className="mt-2" style={{ color: 'var(--p-text)' }}>
                {props.compareSummary.explanationDelta.currentTopPriority !== null ? props.compareSummary.explanationDelta.currentTopPriority : 'No current priority saved.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
          <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
            Added or resolved issues
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
                Added
              </div>
              <div className="mt-2 space-y-2">
                {props.compareSummary.issueDelta.added.length > 0 ? props.compareSummary.issueDelta.added.map(function (code) {
                  return (
                    <div
                      key={'issue-added-' + code}
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface)', color: 'var(--p-text)' }}
                    >
                      {code}
                    </div>
                  );
                }) : (
                  <div className="text-xs" style={{ color: 'var(--p-text-muted)' }}>
                    No added issue codes.
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
                Resolved
              </div>
              <div className="mt-2 space-y-2">
                {props.compareSummary.issueDelta.resolved.length > 0 ? props.compareSummary.issueDelta.resolved.map(function (code) {
                  return (
                    <div
                      key={'issue-resolved-' + code}
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface)', color: 'var(--p-text)' }}
                    >
                      {code}
                    </div>
                  );
                }) : (
                  <div className="text-xs" style={{ color: 'var(--p-text-muted)' }}>
                    No resolved issue codes.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
          <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
            Added or resolved recommendations
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
                Added
              </div>
              <div className="mt-2 space-y-2">
                {props.compareSummary.recommendationDelta.added.length > 0 ? props.compareSummary.recommendationDelta.added.map(function (code) {
                  return (
                    <div
                      key={'recommendation-added-' + code}
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface)', color: 'var(--p-text)' }}
                    >
                      {code}
                    </div>
                  );
                }) : (
                  <div className="text-xs" style={{ color: 'var(--p-text-muted)' }}>
                    No added recommendation codes.
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
                Resolved
              </div>
              <div className="mt-2 space-y-2">
                {props.compareSummary.recommendationDelta.resolved.length > 0 ? props.compareSummary.recommendationDelta.resolved.map(function (code) {
                  return (
                    <div
                      key={'recommendation-resolved-' + code}
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface)', color: 'var(--p-text)' }}
                    >
                      {code}
                    </div>
                  );
                }) : (
                  <div className="text-xs" style={{ color: 'var(--p-text-muted)' }}>
                    No resolved recommendation codes.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
