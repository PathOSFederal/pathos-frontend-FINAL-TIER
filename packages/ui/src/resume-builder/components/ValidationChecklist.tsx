/**
 * ============================================================================
 * VALIDATION CHECKLIST — Calm preflight before export
 * ============================================================================
 *
 * PURPOSE: Renders the validation preflight checklist as a compact,
 * professional overlay on the resume document. Each check item shows
 * pass/fail/warn status with a brief explanation.
 *
 * DESIGN: This feels like airline preflight, not a generic success banner.
 * The checklist is structured, calm, and document-first — the resume
 * canvas remains visible behind the checklist overlay so the user never
 * loses context.
 *
 * CHECKS:
 *   1. Page length within 2-page limit
 *   2. All required sections present
 *   3. Federal details complete
 *   4. Target-job evidence coverage acceptable
 *   5. No critical issues blocking export
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import { CheckCircle2, AlertTriangle, X, Circle } from 'lucide-react';
import type { PreflightCheck, PreflightState, PreflightCheckStatus } from '../types/validation-types';
import { preflightStatusColor } from '../utils/completion-colors';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ValidationChecklistProps {
  /** The complete preflight state with all checks and summary. */
  preflightState: PreflightState;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ValidationChecklist renders the preflight check items as a compact,
 * calm list with icons indicating pass/fail/warn status. The overall
 * summary appears at the top with a clear readiness indicator.
 */
export function ValidationChecklist(props: ValidationChecklistProps) {
  const state = props.preflightState;

  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: 'var(--p-surface)',
        border: '1px solid var(--p-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
      data-testid="validation-checklist"
      role="region"
      aria-label="Preflight validation checklist"
    >
      {/* Summary header */}
      <div className="flex items-center gap-2 mb-4">
        {state.allPassed ? (
          <CheckCircle2
            className="w-5 h-5 flex-shrink-0"
            style={{ color: 'var(--p-success)' }}
          />
        ) : (
          <AlertTriangle
            className="w-5 h-5 flex-shrink-0"
            style={{ color: 'var(--p-warning, #eab308)' }}
          />
        )}
        <div>
          <h3
            className="text-sm font-bold"
            style={{
              color: state.allPassed ? 'var(--p-success)' : 'var(--p-text)',
            }}
          >
            Preflight Validation
          </h3>
          <p
            className="text-xs"
            style={{
              color: state.allPassed
                ? 'var(--p-success)'
                : 'var(--p-text-muted)',
            }}
          >
            {state.summaryLabel}
          </p>
        </div>

        {/* Ready badge — only when all checks pass */}
        {state.allPassed && (
          <span
            className="ml-auto text-[10px] font-bold px-2 py-1 rounded"
            style={{
              color: 'var(--p-success)',
              background: 'color-mix(in srgb, var(--p-success) 12%, transparent)',
            }}
            data-testid="preflight-ready-badge"
          >
            Ready to Export
          </span>
        )}
      </div>

      {/* Check items */}
      <div className="flex flex-col gap-2">
        {state.checks.map(function (check) {
          return (
            <CheckItem
              key={check.id}
              check={check}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Individual check item
// ---------------------------------------------------------------------------

/**
 * A single check item in the preflight list. Shows an icon, the check
 * label, and an optional detail message for fail/warn states.
 */
function CheckItem(props: { check: PreflightCheck }) {
  const check = props.check;
  const icon = getStatusIcon(check.status);
  const color = getStatusColor(check.status);

  return (
    <div
      className="flex items-start gap-2 py-1"
      data-testid={'preflight-check-' + check.id}
    >
      {/* Status icon */}
      <span className="flex-shrink-0 mt-0.5">
        {icon}
      </span>

      {/* Label and detail */}
      <div className="flex-1 min-w-0">
        <span
          className="text-xs font-medium"
          style={{ color: color }}
        >
          {check.label}
        </span>
        {check.detail && check.status !== 'pass' && (
          <p
            className="text-[10px] mt-0.5"
            style={{ color: 'var(--p-text-dim)' }}
          >
            {check.detail}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers: status icon and color
// ---------------------------------------------------------------------------

/**
 * Get the icon element for a preflight check status.
 * Uses the shared completion color scale for consistent color mapping.
 */
function getStatusIcon(status: PreflightCheckStatus): React.ReactNode {
  const color = preflightStatusColor(status as 'pass' | 'fail' | 'warn' | 'pending');
  if (status === 'pass') {
    return <CheckCircle2 className="w-4 h-4" style={{ color: color }} />;
  }
  if (status === 'fail') {
    return <X className="w-4 h-4" style={{ color: color }} />;
  }
  if (status === 'warn') {
    return <AlertTriangle className="w-4 h-4" style={{ color: color }} />;
  }
  return <Circle className="w-4 h-4" style={{ color: color }} />;
}

/**
 * Get the text color for a preflight check status.
 * Delegates to the shared completion color scale so validation
 * status colors match the same semantic meaning as other surfaces.
 */
function getStatusColor(status: PreflightCheckStatus): string {
  return preflightStatusColor(status as 'pass' | 'fail' | 'warn' | 'pending');
}
