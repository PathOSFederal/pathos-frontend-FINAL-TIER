/**
 * ============================================================================
 * PATHADVISOR EXPLAIN TRIGGER — Compact on-demand explanation button
 * ============================================================================
 *
 * PURPOSE: A small, restrained button that invites the user to ask
 * PathAdvisor for a deeper explanation. These triggers appear at three
 * levels in the Resume Builder:
 *
 *   1. ISSUE-LEVEL:   Inside guidance cards — "Why this matters"
 *   2. SECTION-LEVEL:  Near section controls — "Ask PathAdvisor"
 *   3. OVERVIEW-LEVEL: In the overview summary — "What should I fix first?"
 *
 * DESIGN RULE: These are SECONDARY depth triggers, not primary CTAs.
 * They should be visually subdued — small text, muted color, Sparkles
 * icon. They invite without demanding. The builder diagnoses visually;
 * PathAdvisor explains verbally on demand.
 *
 * INTERACTION STATES: hover, focus-visible, active/pressed — all
 * required by the Interaction-State Standard in cursor-house-rules.md.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { PathAdvisorTriggerIntent } from '../types/pathadvisor-context';
import { getTriggerLabel } from '../types/pathadvisor-context';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PathAdvisorExplainTriggerProps {
  /** The intent of this trigger — determines the label shown. */
  intent: PathAdvisorTriggerIntent;

  /** Callback when the user clicks the trigger. The parent component
   *  is responsible for building and dispatching the grounded context
   *  payload to PathAdvisor. */
  onClick: () => void;

  /** Optional custom label override. When not provided, the label
   *  is derived from the intent via getTriggerLabel(). */
  label?: string;

  /** Optional aria-describedby id for screen reader context. */
  ariaDescribedBy?: string;

  /** Optional test ID suffix for targeting in tests. */
  testIdSuffix?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PathAdvisorExplainTrigger renders a compact, secondary-styled button
 * with a Sparkles icon and a short label. It looks like a lightweight
 * text link with an icon, not a full button — intentionally subdued
 * so it does not compete with primary actions (Apply, Strengthen, etc.).
 *
 * KEYBOARD ACCESSIBLE: Reachable via Tab, activatable via Enter/Space.
 * FOCUS-VISIBLE: Uses ring-2 ring accent per the Interaction-State
 * Standard.
 */
export function PathAdvisorExplainTrigger(props: PathAdvisorExplainTriggerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  /* Determine the display label: custom override or intent-derived */
  const displayLabel = props.label !== undefined && props.label.length > 0
    ? props.label
    : getTriggerLabel(props.intent);

  /* Build the test ID from the intent and optional suffix */
  const testId = 'pathadvisor-trigger'
    + (props.testIdSuffix !== undefined && props.testIdSuffix.length > 0
      ? '-' + props.testIdSuffix
      : '-' + props.intent.replace(/_/g, '-'));

  /* Compute visual state — muted by default, accent-tinted on hover,
   * slightly pressed on active. All states use theme tokens. */
  let textColor = 'var(--p-text-dim)';
  let bgColor = 'transparent';

  if (isPressed) {
    textColor = 'var(--p-accent)';
    bgColor = 'color-mix(in srgb, var(--p-accent) 10%, transparent)';
  } else if (isHovered) {
    textColor = 'var(--p-accent)';
    bgColor = 'color-mix(in srgb, var(--p-accent) 6%, transparent)';
  }

  return (
    <button
      type="button"
      onClick={function (e) {
        e.stopPropagation();
        props.onClick();
      }}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={function () { setIsPressed(true); }}
      onMouseUp={function () { setIsPressed(false); }}
      onKeyDown={function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onClick();
        }
      }}
      className="inline-flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-inset px-1.5 py-0.5"
      style={{
        color: textColor,
        background: bgColor,
        border: 'none',
        cursor: 'pointer',
        fontSize: '10px',
        fontWeight: 500,
        lineHeight: '1.4',
        transition: 'color 0.15s ease, background 0.15s ease, transform 0.1s ease',
        transform: isPressed ? 'scale(0.97)' : 'scale(1)',
        '--tw-ring-color': 'var(--p-accent)',
      } as React.CSSProperties}
      aria-label={displayLabel + ' — opens PathAdvisor explanation'}
      aria-describedby={props.ariaDescribedBy}
      data-testid={testId}
    >
      {/* Sparkles icon — PathAdvisor brand mark, small and muted.
       * aria-hidden because the button label is sufficient for
       * screen readers. */}
      <Sparkles
        className="w-3 h-3 flex-shrink-0"
        style={{
          color: isHovered || isPressed ? 'var(--p-accent)' : 'var(--p-text-dim)',
          transition: 'color 0.15s ease',
        }}
        aria-hidden="true"
      />
      <span>{displayLabel}</span>
    </button>
  );
}
