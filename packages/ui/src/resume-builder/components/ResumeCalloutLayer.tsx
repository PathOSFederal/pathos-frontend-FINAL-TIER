/**
 * ============================================================================
 * RESUME CALLOUT LAYER — Callout-interaction-driven guidance surface
 * ============================================================================
 *
 * PURPOSE: Renders the guidance surface for the resume builder's right side.
 * Guidance cards are NOT always-on detached boxes. Instead:
 *   - Default: a compact summary showing the count of active callouts
 *     for the selected section (minimal, calm).
 *   - On callout endpoint click: the corresponding guidance card opens
 *     with full detail, annotation class badge, and action buttons.
 *   - Only 1 active card at a time — clicking a different endpoint
 *     switches the active card.
 *   - Changing section clears the active card.
 *
 * This ensures guidance belongs to the callout interaction model, not
 * a competing always-on panel.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import { useRef, useState } from 'react';
import type { TailoringAnnotation } from '../types/annotation-types';
import type { CalloutLineDef } from '../types/callout-line-types';
import type { SectionProgressList } from '../types/section-progress-types';
import type { SectionIssue } from '../types/issue-categories';
import { PathOSCalloutCard } from './PathOSCalloutCard';
import { PathAdvisorExplainTrigger } from './PathAdvisorExplainTrigger';
import { TopFixBanner } from './TopFixBanner';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ResumeCalloutLayerProps {
  /** Annotations for the current scope. In section mode, filtered to the
   *  selected section. In overview mode, all unresolved annotations sorted
   *  by severity. */
  sectionAnnotations: TailoringAnnotation[];

  /** Maximum number of callout issues to summarize. Default 2. */
  maxVisible?: number;

  /** Currently active/expanded callout ID, or null. Driven by endpoint
   *  click in the callout line overlay. */
  activeCalloutId: string | null;

  /** Callback when a callout card is clicked. */
  onCalloutClick: (calloutId: string) => void;

  /** The selected section ID, for labeling. In overview mode this is
   *  'resume-overview', not a real section. */
  selectedSectionId: string | null;

  /**
   * Callout line definitions for the current scope. Used to match
   * the active callout ID to a specific guidance card with full detail.
   */
  calloutLineDefs?: CalloutLineDef[];

  /**
   * Callback when a callout action is triggered (e.g., "Fix now").
   * The parent screen can use this to open the appropriate inline
   * editor or trigger PathOS guidance.
   */
  onCalloutAction?: (annotationId: string, action: string) => void;

  /**
   * Whether the layer is in overview mode. In overview mode, the
   * compact summary uses different labeling (whole-document scope
   * rather than a single section).
   */
  isOverviewMode?: boolean;

  /**
   * Section progress data. When provided, the guidance card can show
   * the selected section's completion health alongside the issue-level
   * severity. This reconciles section health vs active issue severity
   * so the UI does not feel contradictory.
   */
  sectionProgressList?: SectionProgressList;

  /**
   * Callback when the user clicks a PathAdvisor explain trigger at any
   * level (issue, section, or overview). The callback receives the
   * trigger intent and the callout/annotation ID when available.
   *
   * The parent screen (ResumeBuilderScreen) uses this to build a
   * grounded context payload and dispatch it to PathAdvisor.
   */
  onExplainRequest?: (intent: string, annotationId: string | null) => void;

  /**
   * Scored issues for the current scope. Used by TopFixBanner to
   * highlight the single most impactful next action. When not provided,
   * the top-fix banner is not shown.
   */
  scopeIssues?: SectionIssue[];

  /**
   * Callback when the user clicks the top fix banner. Navigates to
   * the relevant section or opens the corresponding callout.
   */
  onTopFixClick?: (issue: SectionIssue) => void;
}

// ---------------------------------------------------------------------------
// Action label helpers
// ---------------------------------------------------------------------------

/**
 * Get the primary action label for a given annotation class.
 * When the annotation has a suggested text, the primary action becomes
 * "Apply Suggestion" to indicate a concrete, actionable change.
 */
function getPrimaryActionLabel(annotationClass: string, hasSuggestedText: boolean): string {
  if (hasSuggestedText) return 'Apply';
  if (annotationClass === 'evidence') return 'Strengthen';
  if (annotationClass === 'alignment') return 'Add keywords';
  if (annotationClass === 'compression') return 'Compress';
  return 'Fix';
}

/**
 * Get the secondary action label. When suggested text is available,
 * the secondary action is "Edit First" (load suggestion into editor
 * for refinement). Otherwise "Dismiss" (close the card without action).
 */
function getSecondaryActionLabel(hasSuggestedText: boolean): string {
  return hasSuggestedText ? 'Edit first' : 'Dismiss';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ResumeCalloutLayer provides the callout-interaction-driven guidance
 * surface on the right side of the resume workspace.
 *
 * INTERACTION MODEL:
 *   - Default: compact summary showing issue count for the section
 *   - Endpoint click: opens the corresponding guidance card
 *   - Only 1 card open at a time
 *   - Changing section or clicking the same endpoint again closes the card
 *
 * The layer does NOT show large always-on guidance cards. Guidance is
 * triggered by the callout system — the endpoint circles are the
 * interaction trigger, and this layer is the detail surface.
 */
export function ResumeCalloutLayer(props: ResumeCalloutLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);

  /* Count unresolved annotations for the compact summary */
  let unresolvedCount = 0;
  for (let i = 0; i < props.sectionAnnotations.length; i++) {
    if (!props.sectionAnnotations[i].resolved) {
      unresolvedCount = unresolvedCount + 1;
    }
  }

  /**
   * Find the active annotation to show as the guidance card.
   * Matches the activeCalloutId against annotation IDs or callout
   * line IDs (stripping the "cl-" prefix).
   */
  let activeAnnotation: TailoringAnnotation | null = null;
  let activeLineDef: CalloutLineDef | null = null;

  if (props.activeCalloutId) {
    /* Try direct annotation ID match first */
    for (let i = 0; i < props.sectionAnnotations.length; i++) {
      if (props.sectionAnnotations[i].id === props.activeCalloutId) {
        activeAnnotation = props.sectionAnnotations[i];
        break;
      }
    }

    /* Try matching via callout line defs (endpoint click passes line ID
     * stripped of "cl-" prefix, or the annotation ID directly). */
    if (props.calloutLineDefs) {
      for (let i = 0; i < props.calloutLineDefs.length; i++) {
        const lineDef = props.calloutLineDefs[i];
        const annotationId = lineDef.id.replace('cl-', '').replace('canon-', '');
        if (annotationId === props.activeCalloutId || lineDef.id === 'cl-' + props.activeCalloutId) {
          activeLineDef = lineDef;
          /* If we didn't find the annotation yet, use lineDef data */
          if (!activeAnnotation) {
            break;
          }
        }
      }
    }
  }

  /* If no section is selected or no annotations exist, render nothing */
  if (!props.selectedSectionId) return null;
  if (unresolvedCount === 0 && !activeAnnotation && !activeLineDef) return null;

  /* Look up section progress for the active section. Used to pass
   * section-level health into the guidance card so it can show
   * both section health (secondary badge) and issue severity (primary
   * accent) without contradiction.
   *
   * Also resolves the active issue severity from the callout line def
   * or annotation — this is the SINGLE severity source that drives
   * both the endpoint circle color and the guidance card accent color. */
  let activeSectionCompletionPct: number | undefined = undefined;
  let activeSectionLabel: string | undefined = undefined;
  let activeSectionHealthSeverity: 'complete' | 'needs_work' | 'critical' | 'missing' | undefined = undefined;
  let activeIssueSeverity: 'high' | 'medium' | 'low' | undefined = undefined;

  /* Resolve issue severity from the active callout source.
   * The lineDef's severity field is the canonical source that the
   * endpoint circle also uses, so sharing it here guarantees that
   * endpoint and card show the same severity color. */
  if (activeLineDef) {
    activeIssueSeverity = activeLineDef.severity;
  }
  if (activeAnnotation && activeIssueSeverity === undefined) {
    activeIssueSeverity = activeAnnotation.severity;
  }

  /* Look up section progress for the section that owns the active callout */
  if (props.sectionProgressList && activeLineDef) {
    const sectionId = activeLineDef.anchor.sectionId;
    for (let i = 0; i < props.sectionProgressList.length; i++) {
      if (props.sectionProgressList[i].sectionId === sectionId) {
        activeSectionCompletionPct = props.sectionProgressList[i].completionPct;
        activeSectionLabel = props.sectionProgressList[i].label;
        activeSectionHealthSeverity = props.sectionProgressList[i].severity;
        break;
      }
    }
  }
  if (props.sectionProgressList && activeAnnotation) {
    /* Try to match annotation anchorId prefix to a section */
    for (let i = 0; i < props.sectionProgressList.length; i++) {
      const sp = props.sectionProgressList[i];
      const sid = sp.sectionId;
      const anchorId = activeAnnotation.anchorId;
      let matches = false;
      if (sid === 'federal-details') {
        matches = anchorId.startsWith('federal-details-') || anchorId.startsWith('federal-');
      } else if (sid === 'supporting-evidence') {
        matches = anchorId.startsWith('supporting-evidence-');
      } else {
        matches = anchorId.startsWith(sid);
      }
      if (matches) {
        activeSectionCompletionPct = sp.completionPct;
        activeSectionLabel = sp.label;
        activeSectionHealthSeverity = sp.severity;
        break;
      }
    }
  }

  const isOverview = props.isOverviewMode === true;
  const ariaLabel = isOverview
    ? 'Resume overview guidance — top issues across the document'
    : 'Guidance for ' + (props.selectedSectionId || 'selected section');

  return (
    <div
      ref={layerRef}
      className="flex flex-col gap-3 py-4 px-3"
      style={{
        width: '280px',
        pointerEvents: 'auto',
      }}
      data-testid="resume-callout-layer"
      aria-label={ariaLabel}
      aria-live="polite"
    >
      {/* TOP FIX BANNER — when the scope has issues and the user has NOT
       * yet expanded a specific callout card, show the single most
       * impactful next action. This is directive and concise — it tells
       * the user WHAT to fix without explanation prose. */}
      {props.scopeIssues && props.scopeIssues.length > 0 && !activeAnnotation && !activeLineDef && (
        <TopFixBanner
          issues={props.scopeIssues}
          onTopFixClick={props.onTopFixClick}
          onAskPathAdvisor={props.onExplainRequest ? function (issue) {
            if (props.onExplainRequest) {
              props.onExplainRequest('why_this_matters', issue.id);
            }
          } : undefined}
        />
      )}

      {/* ACTIVE GUIDANCE CARD — shown only when a callout endpoint is
       * clicked/focused. This is the primary guidance detail surface.
       * Only 1 card is shown at a time. */}
      {activeAnnotation ? (
        <ActiveGuidanceCard
          annotation={activeAnnotation}
          onCalloutClick={props.onCalloutClick}
          onCalloutAction={props.onCalloutAction || null}
          sectionCompletionPct={activeSectionCompletionPct}
          sectionLabel={activeSectionLabel}
          issueSeverity={activeIssueSeverity}
          sectionHealthSeverity={activeSectionHealthSeverity}
          onExplainRequest={props.onExplainRequest}
        />
      ) : activeLineDef ? (
        /* Fallback: show card from callout line def when no matching
         * annotation exists (canonical targets). */
        <ActiveGuidanceCardFromLineDef
          lineDef={activeLineDef}
          activeCalloutId={props.activeCalloutId || ''}
          onCalloutClick={props.onCalloutClick}
          onCalloutAction={props.onCalloutAction || null}
          sectionCompletionPct={activeSectionCompletionPct}
          sectionLabel={activeSectionLabel}
          issueSeverity={activeIssueSeverity}
          sectionHealthSeverity={activeSectionHealthSeverity}
          onExplainRequest={props.onExplainRequest}
        />
      ) : null}

      {/* COMPACT ISSUE SUMMARY — always visible when the scope has
       * unresolved issues. Shows a calm count indicator. When no card
       * is active, this is the only visible element. In overview mode,
       * the label references the whole document, not a single section. */}
      {unresolvedCount > 0 && (
        <CompactIssueSummary
          count={unresolvedCount}
          sectionId={props.selectedSectionId}
          hasActiveCard={activeAnnotation !== null || activeLineDef !== null}
          isOverviewMode={isOverview}
          onExplainRequest={props.onExplainRequest}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Active guidance card from annotation
// ---------------------------------------------------------------------------

/**
 * The active guidance card shown when a callout endpoint is clicked.
 * Wraps PathOSCalloutCard with action buttons and connector indicator.
 *
 * SEVERITY/HEALTH RECONCILIATION: Passes issueSeverity so the card's
 * primary accent matches the endpoint color, and sectionHealthSeverity
 * so the secondary health badge reflects reconciled health state.
 */
function ActiveGuidanceCard(props: {
  annotation: TailoringAnnotation;
  onCalloutClick: (calloutId: string) => void;
  onCalloutAction: ((annotationId: string, action: string) => void) | null;
  sectionCompletionPct?: number;
  sectionLabel?: string;
  issueSeverity?: 'high' | 'medium' | 'low';
  sectionHealthSeverity?: 'complete' | 'needs_work' | 'critical' | 'missing';
  onExplainRequest?: (intent: string, annotationId: string | null) => void;
}) {
  const annotation = props.annotation;
  const hasSuggestion = annotation.suggestedText !== undefined && annotation.suggestedText.length > 0;
  const primaryLabel = getPrimaryActionLabel(annotation.annotationClass, hasSuggestion);
  const secondaryLabel = getSecondaryActionLabel(hasSuggestion);

  /* Derive an issue category label from the annotation sub-type.
   * This maps the structural annotation sub-type to one of the
   * user-facing issue category labels so the badge is meaningful. */
  const categoryLabel = deriveIssueCategoryFromSubType(annotation.subType);

  return (
    <div className="relative" data-testid={'active-guidance-card-' + annotation.id}>
      {/* SUGGESTION PREVIEW: When the annotation carries suggested text,
       * show a compact preview so the user knows what "Apply" will do.
       * Truncated to avoid overwhelming the card. */}
      {hasSuggestion && (
        <div
          className="mb-2 rounded-md px-2.5 py-2 text-[10px] leading-relaxed"
          style={{
            background: 'color-mix(in srgb, var(--p-accent) 5%, var(--p-surface))',
            border: '1px solid color-mix(in srgb, var(--p-accent) 20%, var(--p-border))',
            color: 'var(--p-text-muted)',
          }}
          data-testid={'suggestion-preview-' + annotation.id}
        >
          <div
            className="text-[9px] font-semibold uppercase tracking-wider mb-1"
            style={{ color: 'var(--p-accent)' }}
          >
            Suggested
          </div>
          {annotation.suggestedText}
        </div>
      )}
      <PathOSCalloutCard
        calloutId={annotation.id}
        annotationClass={annotation.annotationClass}
        headline={annotation.label}
        description={annotation.description}
        onClick={props.onCalloutClick}
        isActive={true}
        primaryActionLabel={primaryLabel}
        onPrimaryAction={
          props.onCalloutAction
            ? function (calloutId: string) {
                if (props.onCalloutAction) {
                  props.onCalloutAction(calloutId, hasSuggestion ? 'apply' : 'primary');
                }
              }
            : undefined
        }
        secondaryActionLabel={secondaryLabel}
        onSecondaryAction={
          props.onCalloutAction
            ? function (calloutId: string) {
                if (props.onCalloutAction) {
                  props.onCalloutAction(calloutId, hasSuggestion ? 'edit-first' : 'dismiss');
                }
              }
            : undefined
        }
        sectionCompletionPct={props.sectionCompletionPct}
        sectionLabel={props.sectionLabel}
        issueSeverity={props.issueSeverity}
        sectionHealthSeverity={props.sectionHealthSeverity}
        issueCategoryLabel={categoryLabel}
        onExplainClick={props.onExplainRequest ? function (calloutId: string) {
          if (props.onExplainRequest) {
            props.onExplainRequest('why_this_matters', calloutId);
          }
        } : undefined}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Active guidance card from callout line def (canonical)
// ---------------------------------------------------------------------------

/**
 * Fallback guidance card when the active callout comes from the canonical
 * registry rather than a tailoring annotation. Uses the line def's
 * headline and description to render a guidance card.
 *
 * SEVERITY/HEALTH RECONCILIATION: Passes issueSeverity from the line def
 * so the card's primary accent matches the endpoint color.
 */
function ActiveGuidanceCardFromLineDef(props: {
  lineDef: CalloutLineDef;
  activeCalloutId: string;
  onCalloutClick: (calloutId: string) => void;
  onCalloutAction: ((annotationId: string, action: string) => void) | null;
  sectionCompletionPct?: number;
  sectionLabel?: string;
  issueSeverity?: 'high' | 'medium' | 'low';
  sectionHealthSeverity?: 'complete' | 'needs_work' | 'critical' | 'missing';
  onExplainRequest?: (intent: string, annotationId: string | null) => void;
}) {
  const lineDef = props.lineDef;
  const primaryLabel = getPrimaryActionLabel(lineDef.anchor.annotationClass, false);

  return (
    <div className="relative" data-testid={'active-guidance-card-canon-' + lineDef.id}>
      <PathOSCalloutCard
        calloutId={props.activeCalloutId}
        annotationClass={lineDef.anchor.annotationClass}
        headline={lineDef.headline}
        description={lineDef.description}
        onClick={props.onCalloutClick}
        isActive={true}
        primaryActionLabel={primaryLabel}
        onPrimaryAction={
          props.onCalloutAction
            ? function (calloutId: string) {
                if (props.onCalloutAction) {
                  props.onCalloutAction(calloutId, 'primary');
                }
              }
            : undefined
        }
        secondaryActionLabel="Dismiss"
        onSecondaryAction={
          props.onCalloutAction
            ? function (calloutId: string) {
                if (props.onCalloutAction) {
                  props.onCalloutAction(calloutId, 'dismiss');
                }
              }
            : undefined
        }
        sectionCompletionPct={props.sectionCompletionPct}
        sectionLabel={props.sectionLabel}
        issueSeverity={props.issueSeverity}
        sectionHealthSeverity={props.sectionHealthSeverity}
        onExplainClick={props.onExplainRequest ? function (calloutId: string) {
          if (props.onExplainRequest) {
            props.onExplainRequest('why_this_matters', calloutId);
          }
        } : undefined}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: derive issue category label from annotation sub-type
// ---------------------------------------------------------------------------

/**
 * Maps annotation sub-types to user-facing issue category labels.
 * This bridges the annotation system (visual) with the issue category
 * system (structural) so guidance cards show both dimensions.
 *
 * Returns a short category label or an empty string when the sub-type
 * does not map to a clear category.
 */
function deriveIssueCategoryFromSubType(subType: string): string {
  /* Evidence sub-types → Weak Evidence */
  if (subType === 'missing-metrics' || subType === 'weak-evidence' ||
      subType === 'unquantified-claim' || subType === 'vague-scope') {
    return 'Weak Evidence';
  }

  /* Alignment sub-types → either Missing Field or Keyword Gap */
  if (subType === 'requirement-gap' || subType === 'experience-gap') {
    return 'Missing Field';
  }
  if (subType === 'missing-keyword' || subType === 'skills-mismatch') {
    return 'Keyword Gap';
  }

  /* Compression sub-types → Enhancement */
  if (subType === 'too-long' || subType === 'low-priority' ||
      subType === 'redundant' || subType === 'compress') {
    return 'Compression';
  }

  return '';
}

// ---------------------------------------------------------------------------
// Sub-component: Compact issue summary — calm count indicator
// ---------------------------------------------------------------------------

/**
 * Compact summary showing the number of active callout issues for the
 * selected section. This is the default state when no guidance card is
 * open — a calm, non-intrusive signal that issues exist.
 *
 * When a card IS active, this shrinks to a minimal "+N more" line.
 *
 * PATHADVISOR TRIGGERS: In overview mode, shows "What should I fix first?"
 * In section mode, shows "Ask PathAdvisor about this section". These
 * are the section-level and overview-level explanation triggers.
 */
function CompactIssueSummary(props: {
  count: number;
  sectionId: string;
  hasActiveCard: boolean;
  isOverviewMode?: boolean;
  onExplainRequest?: (intent: string, annotationId: string | null) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  /* When a card is already active, show the remaining count minus 1 */
  const displayCount = props.hasActiveCard ? props.count - 1 : props.count;
  if (displayCount <= 0) return null;

  /* Overview mode uses different labeling to reflect cross-document scope */
  const isOverview = props.isOverviewMode === true;

  let label = '';
  if (props.hasActiveCard) {
    label = '+' + displayCount + ' more issue' + (displayCount === 1 ? '' : 's');
  } else if (isOverview) {
    label = displayCount + ' issue' + (displayCount === 1 ? '' : 's') + ' found';
  } else {
    label = displayCount + ' issue' + (displayCount === 1 ? '' : 's') + ' found';
  }

  /* Sublabel is reduced — a short directional hint, not an instruction
   * paragraph. The PathAdvisor trigger below provides the depth path. */
  let sublabel = '';
  if (!props.hasActiveCard) {
    sublabel = 'Click a callout point for details';
  }

  return (
    <div
      className="rounded-md px-3 py-2"
      style={{
        background: isHovered
          ? 'color-mix(in srgb, var(--p-text-dim) 8%, transparent)'
          : 'color-mix(in srgb, var(--p-text-dim) 4%, transparent)',
        border: '1px solid var(--p-border)',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); }}
      data-testid="callout-issue-summary"
    >
      <div
        className="text-[11px] font-medium"
        style={{ color: 'var(--p-text-muted)' }}
      >
        {label}
      </div>
      {sublabel && (
        <div
          className="text-[9px] mt-0.5"
          style={{ color: 'var(--p-text-dim)' }}
        >
          {sublabel}
        </div>
      )}

      {/* PATHADVISOR SECTION / OVERVIEW TRIGGERS — secondary depth triggers.
       * Overview mode: "What should I fix first?" for cross-resume guidance.
       * Section mode: "Ask PathAdvisor" for section-specific explanation.
       * Only shown when the compact summary is the primary visible element
       * (no active card open) to avoid cluttering the expanded card state. */}
      {!props.hasActiveCard && props.onExplainRequest && (
        <div className="mt-1.5" data-testid={isOverview ? 'pathadvisor-trigger-overview' : 'pathadvisor-trigger-section'}>
          <PathAdvisorExplainTrigger
            intent={isOverview ? 'what_to_fix_first' : 'explain_section'}
            label={isOverview ? 'What should I fix first?' : 'Ask PathAdvisor about this section'}
            onClick={function () {
              if (props.onExplainRequest) {
                props.onExplainRequest(
                  isOverview ? 'what_to_fix_first' : 'explain_section',
                  null
                );
              }
            }}
            testIdSuffix={isOverview ? 'overview' : 'section-' + props.sectionId}
          />
        </div>
      )}
    </div>
  );
}
