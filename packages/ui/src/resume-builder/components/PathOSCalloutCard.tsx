/**
 * ============================================================================
 * PATHOS CALLOUT CARD — Clickable guidance card for section-scoped callouts
 * ============================================================================
 *
 * PURPOSE: Individual callout card that appears near an anchor point on the
 * resume canvas. Shows a brief guidance message with the annotation class
 * badge (evidence / alignment / compression) and a connector line to the
 * corresponding resume region.
 *
 * DESIGN: Cards are compact, restrained, and PathOS-styled. They do not
 * feel like generic alert badges. The card structure supports:
 *   - Annotation class badge with color coding
 *   - Short headline
 *   - Brief description (1-2 sentences)
 *   - Click to expand/interact (future enhancement)
 *   - Keyboard reachability (tabIndex, focus-visible)
 *
 * Future animation can be layered in by adding CSS transitions to the
 * card and connector elements without changing the rendering structure.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import { useState } from 'react';
import type { TailoringAnnotationClass } from '../types/annotation-types';
import { ANNOTATION_DISPLAY_CONFIGS } from '../types/annotation-types';
import {
  completionPctColor,
  completionPctLabel,
  issueSeverityColor,
  issueSeverityToCompletionBand,
  completionBandColorAtIntensity,
  completionBandLabel,
  severityStateColor,
} from '../utils/completion-colors';
import type { IssueSeverity } from '../utils/completion-colors';
import { PathAdvisorExplainTrigger } from './PathAdvisorExplainTrigger';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PathOSCalloutCardProps {
  /** Unique identifier for this callout. */
  calloutId: string;
  /** The annotation class (evidence / alignment / compression). */
  annotationClass: TailoringAnnotationClass;
  /** Short headline for the callout. */
  headline: string;
  /** Brief explanation (1-2 sentences). */
  description: string;
  /** Callback when the card is clicked. */
  onClick: (calloutId: string) => void;
  /** Whether this callout is currently expanded/active. */
  isActive: boolean;
  /** Optional primary action label (e.g., "Fix now", "Add keywords"). */
  primaryActionLabel?: string;
  /** Optional primary action callback. */
  onPrimaryAction?: (calloutId: string) => void;
  /** Optional secondary action label (e.g., "Dismiss", "Later"). */
  secondaryActionLabel?: string;
  /** Optional secondary action callback. */
  onSecondaryAction?: (calloutId: string) => void;
  /** Optional section completion percentage (0–100). When provided,
   *  a SECONDARY section health indicator appears as a small badge
   *  inside the card, using the section health color (not the issue
   *  severity color). This shows overall section status alongside
   *  the active issue severity without visual contradiction. */
  sectionCompletionPct?: number;
  /** Optional section label for the health indicator. */
  sectionLabel?: string;
  /** Issue severity level for the active callout. When provided, drives
   *  the PRIMARY accent color (border, shadow) so the card matches the
   *  callout endpoint color. This is the key reconciliation: endpoint
   *  and card share one severity source instead of using different
   *  color mappings (the old bug where annotation class drove card color
   *  but severity drove endpoint color, causing contradictions).
   *
   *  When NOT provided, falls back to the annotation class color for
   *  backward compatibility. */
  issueSeverity?: IssueSeverity;
  /** Section health severity state (from SectionProgress.severity).
   *  When provided alongside sectionCompletionPct, the secondary health
   *  badge uses this reconciled health state for color instead of raw
   *  completionPct. This ensures the badge color reflects health
   *  (completion + issues) not just field fill rate. */
  sectionHealthSeverity?: 'complete' | 'needs_work' | 'critical' | 'missing';
  /** Optional issue category label (e.g. "Missing Field", "Weak Evidence").
   *  When provided, shown as a small category badge alongside the
   *  annotation class badge. This makes the issue TYPE visually
   *  self-evident without requiring the user to read a paragraph. */
  issueCategoryLabel?: string;
  /** Optional callback when the user clicks the PathAdvisor "Why this
   *  matters" trigger inside the card. When not provided, the trigger
   *  is not shown — the card remains as-is for backward compatibility. */
  onExplainClick?: (calloutId: string) => void;
}

// ---------------------------------------------------------------------------
// Description truncation helper
// ---------------------------------------------------------------------------

/**
 * Truncate a description string to a maximum character count, breaking
 * at the nearest word boundary. Appends an ellipsis when truncated.
 *
 * WHY: The default card state should be calm and scannable. Full
 * descriptions are moved behind PathAdvisor explain triggers so
 * the user sees signal first, then depth on demand.
 */
function truncateDescription(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  /* Find the last space before maxLength to avoid breaking mid-word */
  let cutoff = maxLength;
  const lastSpace = text.lastIndexOf(' ', maxLength);
  if (lastSpace > maxLength * 0.6) {
    cutoff = lastSpace;
  }

  return text.substring(0, cutoff) + '\u2026';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PathOSCalloutCard renders a single guidance callout card. The card
 * is styled with PathOS theme tokens and shows the annotation class
 * as a compact color-coded badge.
 *
 * The card is focusable for keyboard navigation and uses
 * INTERACTIVE_HOVER_CLASS for consistent hover treatment.
 */
export function PathOSCalloutCard(props: PathOSCalloutCardProps) {
  const displayConfig = ANNOTATION_DISPLAY_CONFIGS[props.annotationClass];
  const [isCardHovered, setIsCardHovered] = useState(false);

  /* PRIMARY ACCENT COLOR RECONCILIATION:
   * When issueSeverity is provided, use it for border/shadow color.
   * This ensures the card's primary accent matches the callout endpoint
   * color — both now use the same issueSeverity → CompletionBand mapping
   * from completion-colors.ts.
   *
   * Previously, the card used annotationClass colors (evidence=amber,
   * alignment=red, compression=blue) while the endpoint used severity
   * colors (high=red, medium=amber, low=green). This caused contradictions
   * like a red card border next to an amber endpoint.
   *
   * When issueSeverity is NOT provided, fall back to the annotation class
   * color for backward compatibility with any call site that hasn't
   * been updated yet. */
  let primaryAccentColor: string;
  if (props.issueSeverity !== undefined) {
    primaryAccentColor = issueSeverityColor(props.issueSeverity);
  } else {
    primaryAccentColor = displayConfig.color;
  }

  /* Compute card border and shadow based on hover + active state.
   * Active cards get the issue-severity-informed accent color; hovered
   * cards get a slightly intensified border; default is standard border. */
  let cardBorder = '1px solid var(--p-border)';
  let cardShadow = '0 1px 2px rgba(0,0,0,0.04)';
  if (props.isActive) {
    cardBorder = '1px solid ' + primaryAccentColor;
    cardShadow = '0 2px 6px rgba(0,0,0,0.08)';
  } else if (isCardHovered) {
    cardBorder = '1px solid color-mix(in srgb, ' + primaryAccentColor + ' 50%, var(--p-border))';
    cardShadow = '0 2px 4px rgba(0,0,0,0.06)';
  }

  return (
    <div
      className="rounded-lg p-3 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset"
      style={{
        background: 'var(--p-surface)',
        border: cardBorder,
        boxShadow: cardShadow,
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        maxWidth: '260px',
        '--tw-ring-color': 'var(--p-accent)',
      } as React.CSSProperties}
      onClick={function () { props.onClick(props.calloutId); }}
      onKeyDown={function (e: React.KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onClick(props.calloutId);
        }
      }}
      onMouseEnter={function () { setIsCardHovered(true); }}
      onMouseLeave={function () { setIsCardHovered(false); }}
      tabIndex={0}
      role="button"
      aria-label={displayConfig.classLabel + ': ' + props.headline}
      data-testid={'callout-card-' + props.calloutId}
    >
      {/* SECONDARY SECTION HEALTH INDICATOR — shows overall section health
       * as a SECONDARY signal inside the card. This is intentionally small
       * and subdued so it does not compete with the primary issue severity
       * accent (border, annotation badge). The user sees:
       *   PRIMARY:   "this issue is high-severity" (red border + badge)
       *   SECONDARY: "but the section overall is 80% / Good" (green dot)
       *
       * The dot color uses sectionHealthSeverity when provided (the
       * reconciled health state from deriveSectionHealth that considers
       * both completion AND unresolved issues). Falls back to raw
       * completionPctColor when sectionHealthSeverity is not provided. */}
      {props.sectionCompletionPct !== undefined && (
        <div
          className="flex items-center gap-1.5 mb-1.5 pb-1.5"
          style={{ borderBottom: '1px solid var(--p-border)' }}
          data-testid="callout-card-section-health"
        >
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: props.sectionHealthSeverity !== undefined
                ? severityStateColor(props.sectionHealthSeverity)
                : completionPctColor(props.sectionCompletionPct),
            }}
            aria-hidden="true"
          />
          <span
            className="text-[9px]"
            style={{ color: 'var(--p-text-dim)' }}
          >
            {props.sectionLabel ? props.sectionLabel + ': ' : ''}
            {props.sectionCompletionPct}% — {props.sectionHealthSeverity !== undefined
              ? completionBandLabel(
                  props.sectionHealthSeverity === 'complete' ? 'strong'
                  : props.sectionHealthSeverity === 'needs_work' ? 'fair'
                  : props.sectionHealthSeverity === 'critical' ? 'critical'
                  : 'critical'
                )
              : completionPctLabel(props.sectionCompletionPct)}
          </span>
        </div>
      )}

      {/* BADGE ROW — annotation class badge + optional issue category badge.
       * The annotation class (Evidence / Alignment / Compression) conveys the
       * visual treatment. The issue category (Missing Field / Keyword Gap / etc.)
       * conveys the structural nature of the problem. Together they let the user
       * understand the issue type at a glance without reading prose. */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        <span
          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{
            color: displayConfig.color,
            background: displayConfig.background,
          }}
        >
          {displayConfig.classLabel}
        </span>
        {props.issueCategoryLabel !== undefined && props.issueCategoryLabel.length > 0 && (
          <span
            className="text-[8px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded"
            style={{
              color: 'var(--p-text-dim)',
              background: 'color-mix(in srgb, var(--p-text-dim) 10%, transparent)',
            }}
            data-testid={'issue-category-badge-' + props.calloutId}
          >
            {props.issueCategoryLabel}
          </span>
        )}
      </div>

      {/* Headline — short issue title, the primary text signal */}
      <h4
        className="text-xs font-semibold mb-0.5"
        style={{ color: 'var(--p-text)' }}
      >
        {props.headline}
      </h4>

      {/* REDUCED DESCRIPTION — shows a concise one-line summary by default.
       * The full description is truncated to ~120 characters to keep the
       * default card state calm and scannable. Deeper explanation is available
       * via the PathAdvisor "Why this matters" trigger below. */}
      <p
        className="text-[10px] leading-relaxed"
        style={{ color: 'var(--p-text-muted)' }}
      >
        {truncateDescription(props.description, 120)}
      </p>

      {/* ACTION ROW — primary/secondary action buttons + optional PathAdvisor
       *  explain trigger. The trigger is intentionally placed AFTER the action
       *  buttons so it reads as a secondary depth option, not a primary CTA.
       *
       *  Layout: [Apply] [Dismiss]   then on a second line: [✨ Why this matters]
       *  This ensures actions are prominent and explanations are available
       *  but subordinate. */}
      {(props.primaryActionLabel || props.secondaryActionLabel || props.onExplainClick) && (
        <div className="mt-2 pt-1.5" style={{ borderTop: '1px solid var(--p-border)' }}>
          {/* Primary + secondary action buttons */}
          {(props.primaryActionLabel || props.secondaryActionLabel) && (
            <div className="flex items-center gap-2">
              {props.primaryActionLabel && props.onPrimaryAction && (
                <CalloutActionButton
                  label={props.primaryActionLabel}
                  variant="primary"
                  accentColor={primaryAccentColor}
                  accentBg={props.issueSeverity !== undefined
                    ? completionBandColorAtIntensity(
                        issueSeverityToCompletionBand(props.issueSeverity),
                        'moderate'
                      )
                    : displayConfig.background}
                  onClick={function (e: React.MouseEvent) {
                    e.stopPropagation();
                    if (props.onPrimaryAction) {
                      props.onPrimaryAction(props.calloutId);
                    }
                  }}
                />
              )}
              {props.secondaryActionLabel && props.onSecondaryAction && (
                <CalloutActionButton
                  label={props.secondaryActionLabel}
                  variant="secondary"
                  accentColor={primaryAccentColor}
                  accentBg={props.issueSeverity !== undefined
                    ? completionBandColorAtIntensity(
                        issueSeverityToCompletionBand(props.issueSeverity),
                        'moderate'
                      )
                    : displayConfig.background}
                  onClick={function (e: React.MouseEvent) {
                    e.stopPropagation();
                    if (props.onSecondaryAction) {
                      props.onSecondaryAction(props.calloutId);
                    }
                  }}
                />
              )}
            </div>
          )}

          {/* PATHADVISOR EXPLAIN TRIGGER — secondary depth trigger.
           *  Only rendered when onExplainClick is provided. Appears on
           *  its own line below the action buttons so it does not
           *  compete visually with primary actions. */}
          {props.onExplainClick && (
            <div className="mt-1.5" data-testid={'explain-trigger-row-' + props.calloutId}>
              <PathAdvisorExplainTrigger
                intent="why_this_matters"
                onClick={function () {
                  if (props.onExplainClick) {
                    props.onExplainClick(props.calloutId);
                  }
                }}
                testIdSuffix={'issue-' + props.calloutId}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Callout action button with hover/active/pressed states
// ---------------------------------------------------------------------------

/**
 * Action button used inside PathOSCalloutCard. Provides explicit hover and
 * active/pressed feedback. Two variants:
 *   primary:   uses annotation class color for text and background
 *   secondary: muted text, transparent background
 *
 * INTERACTION STATES:
 *   hover:         intensified background
 *   focus-visible: ring-2 ring accent
 *   active/pressed: scale reduction + opacity shift
 *   pointer:       cursor: pointer always
 */
function CalloutActionButton(props: {
  label: string;
  variant: 'primary' | 'secondary';
  accentColor: string;
  accentBg: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const isPrimary = props.variant === 'primary';

  let bgColor: string;
  let textColor: string;

  if (isPrimary) {
    textColor = props.accentColor;
    bgColor = props.accentBg;
    if (isPressed) {
      bgColor = 'color-mix(in srgb, ' + props.accentColor + ' 22%, transparent)';
    } else if (isHovered) {
      bgColor = 'color-mix(in srgb, ' + props.accentColor + ' 18%, transparent)';
    }
  } else {
    textColor = 'var(--p-text-dim)';
    bgColor = 'transparent';
    if (isPressed) {
      bgColor = 'color-mix(in srgb, var(--p-text-dim) 12%, transparent)';
      textColor = 'var(--p-text-muted)';
    } else if (isHovered) {
      bgColor = 'color-mix(in srgb, var(--p-text-dim) 8%, transparent)';
      textColor = 'var(--p-text-muted)';
    }
  }

  return (
    <button
      type="button"
      className="text-[10px] font-semibold px-2.5 py-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-inset"
      style={{
        color: textColor,
        background: bgColor,
        border: 'none',
        cursor: 'pointer',
        transform: isPressed ? 'scale(0.96)' : 'scale(1)',
        transition: 'background 0.12s ease, color 0.12s ease, transform 0.1s ease',
        '--tw-ring-color': 'var(--p-accent)',
      } as React.CSSProperties}
      onClick={props.onClick}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={function () { setIsPressed(true); }}
      onMouseUp={function () { setIsPressed(false); }}
      onKeyDown={function (e: React.KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onClick(e as unknown as React.MouseEvent);
        }
      }}
      aria-label={props.label}
    >
      {props.label}
    </button>
  );
}
