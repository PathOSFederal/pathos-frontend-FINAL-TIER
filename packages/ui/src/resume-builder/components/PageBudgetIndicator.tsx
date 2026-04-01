/**
 * ============================================================================
 * PAGE BUDGET INDICATOR — Visual page count vs 2-page limit
 * ============================================================================
 *
 * PURPOSE: Compact indicator showing how close the resume is to the federal
 * 2-page limit. Appears in Slot 4 of the top bar. Uses a horizontal bar
 * fill with color coding:
 *   - Green: within budget (< 90% of limit)
 *   - Yellow: approaching limit (90-100%)
 *   - Red: over limit (> 100%)
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import { completionPctColor } from '../utils/completion-colors';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PageBudgetIndicatorProps {
  /** Current estimated page count (can be fractional, e.g. 1.4). */
  pageCount: number;
  /** Maximum page limit (typically 2 for federal resumes). */
  pageLimit: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PageBudgetIndicator renders a compact horizontal bar with a numeric
 * label showing pages used vs limit. The bar fill and text color change
 * based on how close the resume is to exceeding the limit.
 */
export function PageBudgetIndicator(props: PageBudgetIndicatorProps) {
  const ratio = props.pageLimit > 0 ? props.pageCount / props.pageLimit : 0;
  const fillPct = Math.min(ratio * 100, 100);

  /* Determine color using the shared completion color scale.
   * Invert ratio so that 100% budget remaining = 100% complete (green),
   * and 0% remaining (over budget) = 0% complete (red).
   * Over-budget is always critical red. */
  let overBudget = false;
  let completionEquivalent = Math.round((1 - ratio) * 100);

  if (ratio > 1) {
    overBudget = true;
    completionEquivalent = 0;
  }

  const barColor = completionPctColor(completionEquivalent);
  let textColor = 'var(--p-text-muted)';
  if (overBudget || ratio >= 0.9) {
    textColor = barColor;
  }

  /* Format the page count for display — round to 1 decimal */
  const displayCount = Math.round(props.pageCount * 10) / 10;

  return (
    <div
      className="flex items-center gap-2"
      data-testid="page-budget-indicator"
    >
      {/* Horizontal bar */}
      <div
        className="relative rounded-full overflow-hidden"
        style={{
          width: '60px',
          height: '6px',
          background: 'color-mix(in srgb, var(--p-text-dim) 20%, transparent)',
        }}
        role="progressbar"
        aria-valuenow={props.pageCount}
        aria-valuemin={0}
        aria-valuemax={props.pageLimit}
        aria-label={'Page budget: ' + displayCount + ' of ' + props.pageLimit + ' pages'}
      >
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            width: fillPct + '%',
            background: barColor,
            transition: 'width 0.3s ease, background 0.3s ease',
          }}
        />
      </div>

      {/* Numeric label */}
      <span
        className="text-[10px] font-medium whitespace-nowrap"
        style={{ color: textColor }}
      >
        {displayCount} / {props.pageLimit} pg
      </span>

      {/* Over-budget badge */}
      {overBudget && (
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{
            color: 'var(--p-danger, #ef4444)',
            background: 'color-mix(in srgb, var(--p-danger, #ef4444) 12%, transparent)',
          }}
        >
          Over limit
        </span>
      )}
    </div>
  );
}
