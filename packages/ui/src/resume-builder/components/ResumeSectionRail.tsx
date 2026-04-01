/**
 * ============================================================================
 * RESUME SECTION RAIL — Compact left rail with section status
 * ============================================================================
 *
 * PURPOSE: Lightweight vertical rail showing section progress at a glance.
 * Each section gets a small row with a circular progress badge, the section
 * name, and a severity indicator. The rail remains compact — it is NOT a
 * section manager or a dashboard. It only surfaces status and enables
 * section selection.
 *
 * DESIGN: The rail stays narrow (48-56px for icons-only mode, expandable
 * to ~180px for labels). Selected section is highlighted with an accent
 * indicator. Clicking a section scrolls the canvas to that section.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import type { SectionProgress } from '../types/section-progress-types';
import { severityToLabel, completionLabel, fitLabel, issueCountLabel } from '../types/section-progress-types';
import { severityStateColor } from '../utils/completion-colors';
import { SectionProgressBadge } from './SectionProgressBadge';
import { INTERACTIVE_HOVER_CLASS } from '../../styles/interactiveHover';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * The special section ID used to represent the Resume Overview mode.
 * When this ID is selected, the full resume is visible and only the
 * highest-priority cross-section callouts appear.
 */
export const RESUME_OVERVIEW_ID = 'resume-overview';

export interface ResumeSectionRailProps {
  /** Progress data for all sections, in display order. */
  sections: SectionProgress[];
  /** Currently selected section ID, or null if none.
   *  When set to RESUME_OVERVIEW_ID, the overview mode is active. */
  selectedSectionId: string | null;
  /** Callback when the user clicks a section in the rail. */
  onSectionSelect: (sectionId: string) => void;
  /** Whether to show labels alongside badges (expanded mode). */
  expanded?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ResumeSectionRail renders a compact vertical list of section progress
 * indicators. Each row is clickable and scrolls the canvas to that section.
 *
 * In collapsed mode (default), only the circular badge is shown.
 * In expanded mode, the section label and severity are also visible.
 */
export function ResumeSectionRail(props: ResumeSectionRailProps) {
  const isExpanded = props.expanded !== undefined ? props.expanded : true;

  return (
    <nav
      className="flex flex-col gap-0.5 py-2"
      style={{
        /* SUBORDINATE TO DOCUMENT: Rail is narrower (160px) and uses
         * a transparent-ish background so it does not compete with the
         * resume document for visual weight. The rail is a navigation
         * aid, not a primary surface. */
        width: isExpanded ? '160px' : '48px',
        borderRight: '1px solid var(--p-border)',
        background: 'var(--p-bg)',
        transition: 'width 0.2s ease',
        flexShrink: 0,
      }}
      role="navigation"
      aria-label="Resume sections"
      data-testid="resume-section-rail"
    >
      {/* ---- RESUME OVERVIEW — first item, visually distinct from sections.
       * When selected, the full resume is visible with cross-section callouts.
       * Uses a different visual treatment (no progress badge, wider label)
       * so it reads as a mode selector rather than a section picker. ---- */}
      <OverviewRailItem
        isSelected={props.selectedSectionId === RESUME_OVERVIEW_ID}
        isExpanded={isExpanded}
        onClick={function () { props.onSectionSelect(RESUME_OVERVIEW_ID); }}
      />

      {/* Thin separator between overview and section items */}
      <div
        style={{
          height: '1px',
          background: 'var(--p-border)',
          margin: '2px 8px',
        }}
        role="separator"
      />

      {/* ---- SECTION ITEMS — one per resume section, with progress badges ---- */}
      {props.sections.map(function (section) {
        const isSelected = props.selectedSectionId === section.sectionId;
        /* SEVERITY/HEALTH RECONCILIATION: The % text color now uses the
         * section health state (severity) instead of raw completionPct.
         * This ensures the % text color matches the badge ring color,
         * both driven by the same reconciled health signal from
         * deriveSectionHealth. */
        const color = severityStateColor(section.severity);

        return (
          <button
            key={section.sectionId}
            type="button"
            onClick={function () { props.onSectionSelect(section.sectionId); }}
            className={'flex items-center gap-2 px-2 py-1.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
            style={{
              background: isSelected
                ? 'color-mix(in srgb, var(--p-accent) 10%, transparent)'
                : 'transparent',
              borderLeft: isSelected
                ? '2px solid var(--p-accent)'
                : '2px solid transparent',
              color: isSelected ? 'var(--p-text)' : 'var(--p-text-muted)',
              transition: 'background 0.15s ease, border-color 0.15s ease',
              '--tw-ring-color': 'var(--p-accent)',
            } as React.CSSProperties}
            aria-label={section.label + ': ' + completionLabel(section.completionPct) + (fitLabel(section.severity) ? ', ' + fitLabel(section.severity) : '') + (issueCountLabel(section.activeCalloutCount) ? ', ' + issueCountLabel(section.activeCalloutCount) : '')}
            aria-current={isSelected ? 'true' : undefined}
            data-testid={'section-rail-' + section.sectionId}
          >
            <SectionProgressBadge
              completionPct={section.completionPct}
              severity={section.severity}
              activeCalloutCount={section.activeCalloutCount}
              size={24}
            />

            {isExpanded && (
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span
                  className="text-[11px] font-medium truncate w-full text-left"
                  style={{ color: isSelected ? 'var(--p-text)' : 'var(--p-text-muted)' }}
                >
                  {section.label}
                </span>
                {/* THREE-LINE EXPLICIT STATUS: The user should never have to
                 * infer what a label means. Each line answers one question:
                 *   Line 1: completion state (Not started / Partial / Complete)
                 *   Line 2: quality state (Strong / Fair / Weak)
                 *   Line 3: issue count (1 issue, 2 issues, etc.)
                 * Lines are only shown when they carry real information. */}
                <span
                  className="text-[9px]"
                  style={{ color: color }}
                >
                  {completionLabel(section.completionPct)}
                </span>
                {section.completionPct > 0 && fitLabel(section.severity) !== '' && (
                  <span
                    className="text-[9px]"
                    style={{ color: color }}
                  >
                    {fitLabel(section.severity)}
                  </span>
                )}
                {issueCountLabel(section.activeCalloutCount) !== null && (
                  <span
                    className="text-[9px]"
                    style={{ color: 'var(--p-text-dim)' }}
                  >
                    {issueCountLabel(section.activeCalloutCount)}
                  </span>
                )}
              </div>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Resume Overview item — visually distinct first row
// ---------------------------------------------------------------------------

/**
 * OverviewRailItem renders the "Resume Overview" row at the top of the
 * section rail. It uses a document icon instead of a progress badge
 * to clearly distinguish it from the per-section items below.
 *
 * When selected, the user sees the full resume with cross-section
 * callouts highlighting the most important issues.
 */
function OverviewRailItem(props: {
  isSelected: boolean;
  isExpanded: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={props.onClick}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); }}
      className={'flex items-center gap-2 px-2 py-1.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
      style={{
        background: props.isSelected
          ? 'color-mix(in srgb, var(--p-accent) 10%, transparent)'
          : isHovered
            ? 'color-mix(in srgb, var(--p-text-dim) 6%, transparent)'
            : 'transparent',
        borderLeft: props.isSelected
          ? '2px solid var(--p-accent)'
          : '2px solid transparent',
        color: props.isSelected ? 'var(--p-accent)' : 'var(--p-text-muted)',
        transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
        '--tw-ring-color': 'var(--p-accent)',
      } as React.CSSProperties}
      aria-label="Resume Overview: full document view with top issues"
      aria-current={props.isSelected ? 'true' : undefined}
      data-testid="section-rail-resume-overview"
    >
      {/* Document icon — visually distinct from the circular progress
       * badges used by section items, signaling that this is a different
       * kind of selection (whole-document view, not a single section). */}
      <div
        className="flex items-center justify-center"
        style={{
          width: '24px',
          height: '24px',
          flexShrink: 0,
        }}
      >
        <FileText
          className="w-4 h-4"
          style={{
            color: props.isSelected ? 'var(--p-accent)' : 'var(--p-text-dim)',
            transition: 'color 0.15s ease',
          }}
        />
      </div>

      {props.isExpanded && (
        <div className="flex flex-col items-start min-w-0 flex-1">
          <span
            className="text-[11px] font-semibold truncate w-full text-left"
            style={{
              color: props.isSelected ? 'var(--p-accent)' : 'var(--p-text-muted)',
            }}
          >
            Resume Overview
          </span>
          <span
            className="text-[9px]"
            style={{ color: 'var(--p-text-dim)' }}
          >
            Full document
          </span>
        </div>
      )}
    </button>
  );
}
