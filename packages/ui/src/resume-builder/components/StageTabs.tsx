/**
 * ============================================================================
 * STAGE TABS — Partial | Tailoring | Validation tab strip
 * ============================================================================
 *
 * PURPOSE: Renders the 3-stage tab selector that appears in Slot 3 of the
 * top bar. Each tab represents one phase of the federal resume workflow.
 * Disabled tabs are still visible but not clickable, maintaining layout
 * stability.
 *
 * ARCHITECTURE: This is a controlled component — the active stage is
 * passed in via props and changes are communicated via onStageChange.
 * Tab enablement is determined by workflow prerequisites:
 *   - Partial:    always enabled
 *   - Tailoring:  requires a target job
 *   - Validation: requires target job + sufficient tailoring progress
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import { useState } from 'react';
import type { BuilderStage } from '../types/stage-types';
import { buildStageTabDefs } from '../types/stage-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StageTabsProps {
  /** The currently active stage. */
  activeStage: BuilderStage;
  /** Callback when the user selects a different stage. */
  onStageChange: (stage: BuilderStage) => void;
  /** Whether a target job is currently selected. */
  hasTargetJob: boolean;
  /** Whether tailoring is sufficiently complete for validation. */
  tailoringComplete: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * StageTabs renders the 3-stage tab strip (Partial / Tailoring / Validation).
 * Uses a segmented control appearance with explicit hover tracking per
 * the interaction-state standard. Hover shows a subtle surface tint on
 * non-active, non-disabled tabs to provide "alive" feedback.
 */
export function StageTabs(props: StageTabsProps) {
  const tabs = buildStageTabDefs(props.hasTargetJob, props.tailoringComplete);
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);

  return (
    <div
      className="flex items-center gap-1 rounded px-1 py-0.5"
      style={{
        background: 'color-mix(in srgb, var(--p-surface2) 50%, transparent)',
        border: '1px solid var(--p-border)',
      }}
      role="tablist"
      aria-label="Builder stage"
      data-testid="stage-tabs"
    >
      {tabs.map(function (tab) {
        const isActive = props.activeStage === tab.stage;
        const isDisabled = !tab.enabled;

        return (
          <button
            key={tab.stage}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={isDisabled}
            tabIndex={isActive ? 0 : -1}
            onClick={function () {
              if (tab.enabled && !isActive) {
                props.onStageChange(tab.stage);
              }
            }}
            onMouseEnter={function () {
              if (!isDisabled) setHoveredStage(tab.stage);
            }}
            onMouseLeave={function () { setHoveredStage(null); }}
            className="px-3.5 py-1 text-xs font-medium rounded outline-none focus-visible:ring-2 focus-visible:ring-inset"
            style={{
              background: isActive
                ? 'var(--p-surface)'
                : (!isDisabled && hoveredStage === tab.stage)
                  ? 'color-mix(in srgb, var(--p-surface2) 80%, transparent)'
                  : 'transparent',
              color: isDisabled
                ? 'var(--p-text-dim)'
                : isActive
                  ? 'var(--p-accent)'
                  : (!isDisabled && hoveredStage === tab.stage)
                    ? 'var(--p-text)'
                    : 'var(--p-text-muted)',
              cursor: isDisabled
                ? 'not-allowed'
                : 'pointer',
              opacity: isDisabled ? 0.5 : 1,
              boxShadow: isActive
                ? '0 1px 2px rgba(0,0,0,0.06)'
                : 'none',
              transition: 'background 0.15s ease, color 0.15s ease',
              '--tw-ring-color': 'var(--p-accent)',
            } as React.CSSProperties}
            data-testid={'stage-tab-' + tab.stage}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
