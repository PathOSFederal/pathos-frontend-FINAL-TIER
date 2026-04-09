/**
 * ============================================================================
 * RESUME REVISION DIFF PANEL — Day 83 calm content-change UX
 * ============================================================================
 *
 * PURPOSE:
 * Show a bounded, section-oriented diff between two saved resume revision
 * content snapshots. This is intentionally not a raw text diff. It highlights
 * where the user should look first by summarizing changed sections and the
 * specific items that were added, removed, or edited.
 */

import type React from 'react';
import type {
  ResumeRevisionContentSnapshot,
} from '../stores/resumeWorkspaceStore';
import type {
  ResumeRevisionDiffItem,
  ResumeRevisionDiffSummary,
} from './resumeRevisionDiff';

function changeTypeLabel(changeType: 'added' | 'removed' | 'edited'): string {
  if (changeType === 'added') {
    return 'Added';
  }
  if (changeType === 'removed') {
    return 'Removed';
  }
  return 'Edited';
}

function changeTypeTone(changeType: 'added' | 'removed' | 'edited'): string {
  if (changeType === 'added') {
    return 'var(--p-success)';
  }
  if (changeType === 'removed') {
    return 'var(--p-danger)';
  }
  return 'var(--p-accent)';
}

function renderDiffValue(value: string | null): string {
  if (value === null || value.trim().length === 0) {
    return 'None';
  }
  return value;
}

function ResumeRevisionDiffItemRow(props: {
  item: ResumeRevisionDiffItem;
}) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{
        borderColor: 'var(--p-border)',
        background: 'var(--p-surface)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium" style={{ color: 'var(--p-text)' }}>
            {props.item.label}
          </div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wide" style={{ color: changeTypeTone(props.item.changeType) }}>
            {changeTypeLabel(props.item.changeType)}
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
            Previous
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
            {renderDiffValue(props.item.previousText)}
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
            Current
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--p-text)' }}>
            {renderDiffValue(props.item.currentText)}
          </p>
        </div>
      </div>
    </div>
  );
}

export interface ResumeRevisionDiffPanelProps {
  currentRevisionSnapshot: ResumeRevisionContentSnapshot | null;
  compareRevisionSnapshot: ResumeRevisionContentSnapshot | null;
  diffSummary: ResumeRevisionDiffSummary | null;
}

export function ResumeRevisionDiffPanel(
  props: ResumeRevisionDiffPanelProps
) {
  if (
    props.currentRevisionSnapshot === null ||
    props.compareRevisionSnapshot === null ||
    props.diffSummary === null
  ) {
    return (
      <section
        className="rounded-xl border p-5"
        style={{
          background: 'var(--p-surface)',
          borderColor: 'var(--p-border)',
        }}
      >
        <h2 className="text-lg font-semibold" style={{ color: 'var(--p-text)' }}>
          Revision diff
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
          Select two saved revisions with preserved resume content to see which sections and bullets changed.
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
            Revision diff
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
            Comparing saved revision content snapshots only. This highlights content changes without trying to act like a raw text diff viewer.
          </p>
        </div>
        <div className="space-y-1 text-xs" style={{ color: 'var(--p-text-dim)' }}>
          <div>Current {props.currentRevisionSnapshot.revisionId}</div>
          <div>Baseline {props.compareRevisionSnapshot.revisionId}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
            Sections changed
          </div>
          <div className="mt-2 text-lg font-semibold" style={{ color: 'var(--p-text)' }}>
            {props.diffSummary.changedSectionCount.toString()}
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--p-text-muted)' }}>
            {props.diffSummary.unchangedSectionCount.toString()} unchanged
          </p>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
            Added items
          </div>
          <div className="mt-2 text-lg font-semibold" style={{ color: 'var(--p-success)' }}>
            {props.diffSummary.addedItemCount.toString()}
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
            Removed items
          </div>
          <div className="mt-2 text-lg font-semibold" style={{ color: 'var(--p-danger)' }}>
            {props.diffSummary.removedItemCount.toString()}
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
            Edited items
          </div>
          <div className="mt-2 text-lg font-semibold" style={{ color: 'var(--p-accent)' }}>
            {props.diffSummary.editedItemCount.toString()}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {props.diffSummary.sections.map(function (section) {
          return (
            <div
              key={section.sectionId}
              className="rounded-xl border p-4"
              style={{
                borderColor: section.status === 'changed' ? 'var(--p-accent)' : 'var(--p-border)',
                background: section.status === 'changed'
                  ? 'color-mix(in srgb, var(--p-accent) 6%, var(--p-surface))'
                  : 'var(--p-surface2)',
              }}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
                      {section.label}
                    </h3>
                    <span
                      className="rounded-full border px-2 py-1 text-xs font-medium"
                      style={{
                        borderColor: section.status === 'changed' ? 'var(--p-accent)' : 'var(--p-border)',
                        color: section.status === 'changed' ? 'var(--p-accent)' : 'var(--p-text-muted)',
                      }}
                    >
                      {section.status === 'changed' ? 'Changed' : 'Unchanged'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs" style={{ color: 'var(--p-text-dim)' }}>
                    {section.addedCount.toString()} added · {section.removedCount.toString()} removed · {section.editedCount.toString()} edited
                  </p>
                </div>
              </div>

              {section.items.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {section.items.map(function (item) {
                    return (
                      <ResumeRevisionDiffItemRow key={item.key} item={item} />
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm" style={{ color: 'var(--p-text-muted)' }}>
                  No content changes were detected in this section.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
