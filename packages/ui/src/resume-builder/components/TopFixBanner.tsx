/**
 * ============================================================================
 * TOP FIX BANNER — Highlights the single most impactful next action
 * ============================================================================
 *
 * PURPOSE: Shows one concise, directive line identifying the top fix the
 * user should address next. Appears in the callout layer when in overview
 * mode or when a section is selected and has unresolved issues.
 *
 * DESIGN: Short and directive — not a paragraph of explanation. The user
 * should immediately see WHAT to do without reading prose. If they want
 * to know WHY, they click the PathAdvisor trigger.
 *
 * EXAMPLES:
 *   "Top fix: Add hours/week to entry 1"
 *   "Top fix: Add a professional summary"
 *   "Top fix: Specify citizenship status"
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import type { SectionIssue } from '../types/issue-categories';
import { sortIssuesByPriority, ISSUE_CATEGORY_META } from '../types/issue-categories';
import { issueSeverityColor } from '../utils/completion-colors';
import type { IssueSeverity } from '../utils/completion-colors';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TopFixBannerProps {
  /** All unresolved issues to pick the top fix from. The component
   *  sorts by priority and picks the highest-priority one. */
  issues: SectionIssue[];

  /** Optional callback when the user clicks the top fix banner.
   *  Typically navigates to the relevant section or opens the
   *  corresponding callout. */
  onTopFixClick?: (issue: SectionIssue) => void;

  /** Optional callback for the "Ask PathAdvisor why" trigger. */
  onAskPathAdvisor?: (issue: SectionIssue) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TopFixBanner shows the single highest-priority unresolved issue as a
 * compact, directive banner. It uses the issue severity color for the
 * accent line and a Zap icon to signal urgency without verbosity.
 */
export function TopFixBanner(props: TopFixBannerProps) {
  const [isHovered, setIsHovered] = useState(false);

  /* Filter to unresolved issues, then sort by priority */
  const unresolved: SectionIssue[] = [];
  for (let i = 0; i < props.issues.length; i++) {
    if (!props.issues[i].resolved) {
      unresolved.push(props.issues[i]);
    }
  }

  if (unresolved.length === 0) return null;

  const sorted = sortIssuesByPriority(unresolved);
  const topIssue = sorted[0];

  /* Map issue severity to the completion-colors IssueSeverity type.
   * SectionIssue uses 'critical' | 'high' | 'medium' | 'low' but
   * issueSeverityColor uses 'high' | 'medium' | 'low'. Map critical
   * to high for color purposes. */
  let colorSeverity: IssueSeverity = 'medium';
  if (topIssue.severity === 'critical' || topIssue.severity === 'high') {
    colorSeverity = 'high';
  } else if (topIssue.severity === 'medium') {
    colorSeverity = 'medium';
  } else {
    colorSeverity = 'low';
  }
  const accentColor = issueSeverityColor(colorSeverity);

  /* Get the category label for the badge */
  const categoryLabel = ISSUE_CATEGORY_META[topIssue.category].label;

  return (
    <div
      className="rounded-md px-2.5 py-2"
      style={{
        background: isHovered
          ? 'color-mix(in srgb, ' + accentColor + ' 8%, var(--p-surface))'
          : 'color-mix(in srgb, ' + accentColor + ' 4%, var(--p-surface))',
        borderTop: '1px solid var(--p-border)',
        borderRight: '1px solid var(--p-border)',
        borderBottom: '1px solid var(--p-border)',
        borderLeft: '2px solid ' + accentColor,
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); }}
      data-testid="top-fix-banner"
    >
      {/* TOP FIX HEADER — small icon + "Top fix" label to clearly signal
       * that this is THE most important thing to do next. */}
      <div className="flex items-center gap-1.5 mb-1">
        <Zap
          className="w-3 h-3 flex-shrink-0"
          style={{ color: accentColor }}
          aria-hidden="true"
        />
        <span
          className="text-[9px] font-bold uppercase tracking-wider"
          style={{ color: accentColor }}
        >
          Top fix
        </span>
        {/* Issue category badge — small, visually self-evident */}
        <span
          className="text-[8px] font-semibold uppercase tracking-wider px-1 py-0 rounded"
          style={{
            color: accentColor,
            background: 'color-mix(in srgb, ' + accentColor + ' 12%, transparent)',
          }}
        >
          {categoryLabel}
        </span>
      </div>

      {/* DIRECTIVE LABEL — the actual fix instruction. Short and actionable.
       * Clickable to navigate to the relevant section/field. */}
      <button
        type="button"
        className="text-left w-full text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset rounded-sm"
        style={{
          color: 'var(--p-text)',
          cursor: props.onTopFixClick ? 'pointer' : 'default',
          background: 'transparent',
          border: 'none',
          padding: 0,
          '--tw-ring-color': 'var(--p-accent)',
        } as React.CSSProperties}
        onClick={function () {
          if (props.onTopFixClick) {
            props.onTopFixClick(topIssue);
          }
        }}
        aria-label={'Top fix: ' + topIssue.label}
        data-testid="top-fix-label"
      >
        {topIssue.label}
      </button>
    </div>
  );
}
