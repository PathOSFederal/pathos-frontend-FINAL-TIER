/**
 * ============================================================================
 * SECTION PROGRESS BADGE — Circular progress indicator for the left rail
 * ============================================================================
 *
 * PURPOSE: Compact circular progress ring with color-coded severity state.
 * Used in the left rail to give an at-a-glance view of each section's
 * health without requiring full-width cards or large displays.
 *
 * VISUAL MODEL:
 *   - SVG circle with a progress arc stroke
 *   - Color determined by severity: green/yellow/red/gray
 *   - Optional callout count badge overlaid on the circle
 *   - Size is compact (24-32px diameter) for rail use
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import type { SeverityState } from '../types/section-progress-types';
import { severityStateColor } from '../utils/completion-colors';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SectionProgressBadgeProps {
  /** Completion percentage (0-100). Drives the arc fill. */
  completionPct: number;
  /** Severity state. Determines the color of the progress ring. */
  severity: SeverityState;
  /** Number of active callouts. Shown as a small badge if > 0. */
  activeCalloutCount: number;
  /** Size of the badge in pixels. Default 28. */
  size?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SectionProgressBadge renders a small circular progress indicator.
 * The ring fills clockwise from the top based on completionPct.
 * The ring color is determined by the severity state.
 *
 * SVG approach: a background circle (track) and a foreground circle
 * (fill) with strokeDasharray/strokeDashoffset to create the arc.
 */
export function SectionProgressBadge(props: SectionProgressBadgeProps) {
  const size = props.size !== undefined ? props.size : 28;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillLength = (props.completionPct / 100) * circumference;
  const dashOffset = circumference - fillLength;
  /* SEVERITY/HEALTH RECONCILIATION: The ring color now uses the section
   * HEALTH state (severity prop) instead of raw completionPct. This
   * prevents the contradiction where a 100%-filled section shows green
   * when it has unresolved high-severity issues. The severity prop is
   * derived from deriveSectionHealth which considers completion, callout
   * count, AND high-severity issue count together. */
  const color = severityStateColor(props.severity);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size + 'px', height: size + 'px' }}
      data-testid="section-progress-badge"
      aria-label={props.completionPct + '% complete'}
    >
      <svg
        width={size}
        height={size}
        viewBox={'0 0 ' + size + ' ' + size}
        className="transform -rotate-90"
      >
        {/* Track circle (background) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="color-mix(in srgb, var(--p-text-dim) 20%, transparent)"
          strokeWidth={strokeWidth}
        />
        {/* Fill circle (progress arc) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s ease' }}
        />
      </svg>

      {/* Center content: callout count badge or empty */}
      {props.activeCalloutCount > 0 && (
        <span
          className="absolute text-[8px] font-bold"
          style={{ color: color }}
        >
          {props.activeCalloutCount}
        </span>
      )}
    </div>
  );
}
