/**
 * ============================================================================
 * RESUME BUILDER STAGE TYPES — Workflow state and top-bar slot architecture
 * ============================================================================
 *
 * PURPOSE: Defines the builder's workflow stages and the stable top-bar slot
 * system. The top bar has 7 fixed positional slots that never reflow across
 * states — only the content inside each slot changes.
 *
 * ARCHITECTURE: The federal resume workflow follows a linear progression:
 *   Default Resume → Target Job → Tailor/Compress → Validate → Export
 *
 * Each stage activates different behaviors inside the top bar slots while
 * maintaining structural stability. Slot positions are fixed in CSS grid
 * so controls never jump around as the user progresses.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

// ---------------------------------------------------------------------------
// Builder stage — the primary workflow state of the resume builder
// ---------------------------------------------------------------------------

/**
 * The three primary stages of the federal resume builder workflow.
 *
 *   partial:    Building/editing the master resume. No target job yet,
 *               or target job is optional. Focus is on content completeness.
 *
 *   tailoring:  A target job is active. The builder shows alignment
 *               annotations (evidence, alignment, compression) and helps
 *               the user tailor their resume to the specific announcement.
 *
 *   validation: Final preflight before export. Shows a calm checklist
 *               confirming page length, required sections, federal details,
 *               evidence coverage, and no blocking issues.
 */
export type BuilderStage = 'partial' | 'tailoring' | 'validation';

// ---------------------------------------------------------------------------
// Top-bar slot identifiers — stable positional slots that never move
// ---------------------------------------------------------------------------

/**
 * The 7 structural slots in the Resume Builder top bar.
 * These map to fixed CSS grid columns so layout never shifts.
 *
 *   resume-selector:     Slot 1 — Default Resume / version picker
 *   target-job-selector: Slot 2 — Target job picker (empty in partial)
 *   stage-tabs:          Slot 3 — Partial | Tailoring | Validation
 *   page-budget:         Slot 4 — Page count vs 2-page limit
 *   readiness:           Slot 5 — Readiness score or validation state
 *   utility-actions:     Slot 6 — Preview, Versions, settings
 *   primary-cta:         Slot 7 — Context-dependent primary action
 */
export type TopBarSlotId =
  | 'resume-selector'
  | 'target-job-selector'
  | 'stage-tabs'
  | 'page-budget'
  | 'readiness'
  | 'utility-actions'
  | 'primary-cta';

/**
 * Configuration for a single top-bar slot. Describes what content
 * appears in the slot for a given builder stage. The slot position
 * is determined by the slot ID; only the content changes.
 */
export interface TopBarSlotConfig {
  /** Which slot this configuration targets. */
  slotId: TopBarSlotId;

  /** Whether the slot is visible in this stage. Hidden slots still
   *  occupy their grid position to prevent layout shift. */
  visible: boolean;

  /** Human-readable label for the slot content (used for aria-label). */
  label: string;

  /** Whether the slot is interactive (clickable/focusable) in this stage. */
  interactive: boolean;
}

/**
 * Full top-bar state for a given builder stage. Contains the current
 * stage plus the configuration for all 7 slots.
 */
export interface TopBarState {
  /** The active builder stage driving slot content. */
  stage: BuilderStage;

  /** Configuration for each slot, keyed by slot ID. */
  slots: Record<TopBarSlotId, TopBarSlotConfig>;
}

// ---------------------------------------------------------------------------
// Stage tab definition — drives the stage tab strip (Slot 3)
// ---------------------------------------------------------------------------

/**
 * A single tab in the stage selector (Partial / Tailoring / Validation).
 * The tab strip appears in Slot 3 and lets the user navigate between
 * workflow stages. The active tab determines which stage's content
 * fills the other slots.
 */
export interface StageTabDef {
  /** Stage this tab activates. */
  stage: BuilderStage;

  /** Display label for the tab. */
  label: string;

  /** Whether this tab is currently reachable. Tailoring requires a
   *  target job; Validation requires tailoring to be sufficiently complete. */
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Primary CTA configuration — drives Slot 7
// ---------------------------------------------------------------------------

/**
 * The primary call-to-action button changes label and behavior based
 * on the current stage:
 *   partial    → "Tailor to Job" (encourages selecting a target)
 *   tailoring  → "Apply Suggestions" (batch-apply pending proposals)
 *   validation → "Export" (generate final resume document)
 */
export interface PrimaryCtaConfig {
  /** Button label text. */
  label: string;

  /** Whether the button is enabled (disabled if prerequisites are unmet). */
  enabled: boolean;

  /** Visual variant for the button. */
  variant: 'default' | 'success' | 'accent';

  /** Which stage this CTA belongs to. */
  stage: BuilderStage;
}

// ---------------------------------------------------------------------------
// Factory: default top-bar slot configurations per stage
// ---------------------------------------------------------------------------

/**
 * Build the default TopBarSlotConfig set for a given builder stage.
 * All 7 slots always exist in the layout; only their visibility,
 * labels, and interactivity change per stage.
 */
export function buildDefaultTopBarState(stage: BuilderStage): TopBarState {
  const slots: Record<TopBarSlotId, TopBarSlotConfig> = {
    'resume-selector': {
      slotId: 'resume-selector',
      visible: true,
      label: 'Default Resume',
      interactive: true,
    },
    'target-job-selector': {
      slotId: 'target-job-selector',
      visible: true,
      label: stage === 'partial' ? 'Select target job' : 'Target Job',
      interactive: true,
    },
    'stage-tabs': {
      slotId: 'stage-tabs',
      visible: true,
      label: 'Builder stage',
      interactive: true,
    },
    'page-budget': {
      slotId: 'page-budget',
      visible: true,
      label: 'Page budget',
      interactive: false,
    },
    'readiness': {
      slotId: 'readiness',
      visible: true,
      label: stage === 'validation' ? 'Validation status' : 'Readiness score',
      interactive: stage === 'validation',
    },
    'utility-actions': {
      slotId: 'utility-actions',
      visible: true,
      label: 'Utility actions',
      interactive: true,
    },
    'primary-cta': {
      slotId: 'primary-cta',
      visible: true,
      label: stage === 'partial'
        ? 'Tailor to Job'
        : stage === 'tailoring'
          ? 'Apply Suggestions'
          : 'Export',
      interactive: true,
    },
  };

  return { stage, slots };
}

/**
 * Build the default stage tab definitions. Tailoring and Validation
 * tabs are enabled/disabled based on whether a target job is selected
 * and whether tailoring is sufficiently complete.
 */
export function buildStageTabDefs(
  hasTargetJob: boolean,
  tailoringComplete: boolean
): StageTabDef[] {
  return [
    { stage: 'partial', label: 'Partial', enabled: true },
    { stage: 'tailoring', label: 'Tailoring', enabled: hasTargetJob },
    { stage: 'validation', label: 'Validation', enabled: hasTargetJob && tailoringComplete },
  ];
}

/**
 * Build the primary CTA config for a given stage.
 */
export function buildPrimaryCtaConfig(
  stage: BuilderStage,
  hasTargetJob: boolean,
  hasPendingSuggestions: boolean
): PrimaryCtaConfig {
  if (stage === 'validation') {
    return {
      label: 'Export',
      enabled: true,
      variant: 'success',
      stage: stage,
    };
  }
  if (stage === 'tailoring') {
    return {
      label: 'Apply Suggestions',
      enabled: hasPendingSuggestions,
      variant: 'accent',
      stage: stage,
    };
  }
  return {
    label: 'Tailor to Job',
    enabled: hasTargetJob,
    variant: 'default',
    stage: stage,
  };
}
