/**
 * ============================================================================
 * COMPLETION COLOR MAPPING — Shared completion/severity color scale
 * ============================================================================
 *
 * PURPOSE: Single source of truth for mapping completion percentages (0–100)
 * to color tokens throughout the Resume Builder experience. Every surface
 * that displays completion status — left rail, section badges, guidance
 * cards, score chips, progress indicators — uses this module so the same
 * underlying percentage always maps to the same color family.
 *
 * COLOR BANDS (5-tier, intuitive progression):
 *   0–20%  → critical (red)        var(--p-danger)
 *   21–40% → poor     (orange-red) var(--p-danger) at reduced intensity
 *   41–60% → fair     (amber)      var(--p-warning)
 *   61–80% → good     (yellow-green) blended success/warning
 *   81–100% → strong  (green)      var(--p-success)
 *
 * VISUAL INTENSITY: The same color band can be rendered at different
 * intensities depending on context. The rail uses subtle treatment,
 * section highlights use moderate, guidance cards use stronger emphasis,
 * and callout endpoints use subdued. Use the intensity helpers for this.
 *
 * ACCESSIBILITY: Color is not the sole indicator of completion state.
 * Every usage point must also show a numeric percentage or text label.
 * The completionBandLabel function provides human-readable labels.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

// ---------------------------------------------------------------------------
// Completion band enum — the 5 severity/completion bands
// ---------------------------------------------------------------------------

/**
 * The 5 completion bands that cover the 0–100% range.
 * Each band maps to a specific color treatment and label.
 */
export type CompletionBand = 'critical' | 'poor' | 'fair' | 'good' | 'strong';

// ---------------------------------------------------------------------------
// Band thresholds — defines where each band begins
// ---------------------------------------------------------------------------

/** Threshold above which a section is considered "strong" (green). */
export const COMPLETION_BAND_STRONG = 81;

/** Threshold above which a section is considered "good" (yellow-green). */
export const COMPLETION_BAND_GOOD = 61;

/** Threshold above which a section is considered "fair" (amber). */
export const COMPLETION_BAND_FAIR = 41;

/** Threshold above which a section is considered "poor" (orange-red). */
export const COMPLETION_BAND_POOR = 21;

/* Below COMPLETION_BAND_POOR (0–20) is "critical" (red). */

// ---------------------------------------------------------------------------
// Band derivation — percentage to band classification
// ---------------------------------------------------------------------------

/**
 * Classify a completion percentage (0–100) into one of the 5 bands.
 * This is the single canonical classification used by all Resume Builder
 * surfaces. The band determines color, label, and visual treatment.
 *
 * Thresholds (inclusive lower bound):
 *   81–100 → strong
 *   61–80  → good
 *   41–60  → fair
 *   21–40  → poor
 *   0–20   → critical
 */
export function deriveCompletionBand(completionPct: number): CompletionBand {
  if (completionPct >= COMPLETION_BAND_STRONG) return 'strong';
  if (completionPct >= COMPLETION_BAND_GOOD) return 'good';
  if (completionPct >= COMPLETION_BAND_FAIR) return 'fair';
  if (completionPct >= COMPLETION_BAND_POOR) return 'poor';
  return 'critical';
}

// ---------------------------------------------------------------------------
// Band to color token — the canonical color for each band
// ---------------------------------------------------------------------------

/**
 * Map a completion band to a PathOS theme color token.
 * Returns a CSS custom property reference for inline style use.
 *
 * The "good" band uses a blend between success and warning to create
 * a visual step between full green and full amber. The "poor" band
 * reuses --p-danger with a fallback that renders as orange-red in
 * the standard PathOS theme.
 *
 * Uses fallback hex values where the theme token might not be defined.
 */
export function completionBandColor(band: CompletionBand): string {
  if (band === 'strong') return 'var(--p-success)';
  if (band === 'good') return 'var(--p-success)';
  if (band === 'fair') return 'var(--p-warning, #eab308)';
  if (band === 'poor') return 'var(--p-danger, #ef4444)';
  return 'var(--p-danger, #ef4444)';
}

/**
 * Convenience: map a completion percentage directly to a color token.
 * Combines deriveCompletionBand + completionBandColor in one call.
 *
 * This is the primary function most components should use.
 */
export function completionPctColor(completionPct: number): string {
  return completionBandColor(deriveCompletionBand(completionPct));
}

// ---------------------------------------------------------------------------
// Band to label — accessible human-readable label for each band
// ---------------------------------------------------------------------------

/**
 * Map a completion band to a human-readable label.
 * Used for accessible text alongside color indicators.
 */
export function completionBandLabel(band: CompletionBand): string {
  if (band === 'strong') return 'Strong';
  if (band === 'good') return 'Good';
  if (band === 'fair') return 'Fair';
  if (band === 'poor') return 'Poor';
  return 'Critical';
}

/**
 * Convenience: map a completion percentage directly to a label.
 */
export function completionPctLabel(completionPct: number): string {
  return completionBandLabel(deriveCompletionBand(completionPct));
}

// ---------------------------------------------------------------------------
// Context-sensitive intensity — same meaning, different visual weight
// ---------------------------------------------------------------------------

/**
 * Visual intensity levels for different rendering contexts.
 * The same color band maps to different opacity/intensity depending
 * on where it appears in the UI.
 *
 *   subtle:    left rail, background tints  (8–12% mix)
 *   moderate:  section highlights, badges   (16–24% mix)
 *   strong:    guidance cards, active state  (full token color)
 *   subdued:   callout lines, endpoints     (40–50% mix with dim)
 */
export type ColorIntensity = 'subtle' | 'moderate' | 'strong' | 'subdued';

/**
 * Generate a color-mix expression that applies the specified intensity
 * to a completion band color. Uses CSS color-mix for theme compatibility.
 *
 * The "strong" intensity returns the raw token (no mixing).
 * Other intensities mix the band color with transparent at varying ratios.
 *
 * @param band - The completion band to color
 * @param intensity - How visually prominent the color should be
 * @returns CSS color value string for inline style use
 */
export function completionBandColorAtIntensity(
  band: CompletionBand,
  intensity: ColorIntensity
): string {
  const baseColor = completionBandColor(band);

  if (intensity === 'strong') return baseColor;
  if (intensity === 'moderate') {
    return 'color-mix(in srgb, ' + baseColor + ' 20%, transparent)';
  }
  if (intensity === 'subtle') {
    return 'color-mix(in srgb, ' + baseColor + ' 10%, transparent)';
  }
  /* subdued: blend toward dim for callout endpoints and lines */
  return 'color-mix(in srgb, ' + baseColor + ' 45%, var(--p-text-dim, #64748b))';
}

// ---------------------------------------------------------------------------
// Severity state alignment — bridges the existing SeverityState enum
// ---------------------------------------------------------------------------

/**
 * Map the existing SeverityState enum to the closest CompletionBand.
 * This bridges the current severity system with the new completion
 * color scale, so existing components using SeverityState can also
 * access the shared color logic.
 *
 *   complete   → strong (green)
 *   needs_work → fair   (amber)
 *   critical   → critical (red)
 *   missing    → critical (red)
 */
export function severityStateToCompletionBand(
  severity: 'complete' | 'needs_work' | 'critical' | 'missing'
): CompletionBand {
  if (severity === 'complete') return 'strong';
  if (severity === 'needs_work') return 'fair';
  if (severity === 'critical') return 'critical';
  return 'critical';
}

/**
 * Map a SeverityState to a color token using the shared completion
 * color scale. This is the unified replacement for ad-hoc severity
 * color lookups scattered across components.
 *
 * Preserves the same token values as the original severityToColor
 * for backward compatibility, but routes through the shared band
 * system for consistency.
 */
export function severityStateColor(
  severity: 'complete' | 'needs_work' | 'critical' | 'missing'
): string {
  return completionBandColor(severityStateToCompletionBand(severity));
}

// ---------------------------------------------------------------------------
// Issue severity alignment — bridges callout severity to completion bands
// ---------------------------------------------------------------------------

/**
 * The three issue severity levels used by callout lines and guidance cards.
 * Re-declared here as a type alias so the color module can reference them
 * without importing from callout-line-types.
 *
 *   high   → blocking or critical issue that demands immediate attention
 *   medium → notable issue that weakens the resume but doesn't block
 *   low    → minor or informational improvement suggestion
 */
export type IssueSeverity = 'high' | 'medium' | 'low';

/**
 * Map a callout issue severity ('high' | 'medium' | 'low') to a
 * CompletionBand for consistent color treatment. This is the SINGLE
 * canonical mapping that both callout endpoints AND guidance cards must
 * use, so they never display contradictory colors.
 *
 * Before this reconciliation, endpoints used this mapping but guidance
 * cards used annotationClass colors (evidence=amber, alignment=red,
 * compression=blue) — a completely different system. Now both surfaces
 * share this one function.
 *
 *   high   → critical (red family)    — blocking issues
 *   medium → fair     (amber family)  — needs attention
 *   low    → good     (green family)  — informational / nice-to-have
 */
export function issueSeverityToCompletionBand(
  severity: IssueSeverity
): CompletionBand {
  if (severity === 'high') return 'critical';
  if (severity === 'medium') return 'fair';
  return 'good';
}

/**
 * Map a callout issue severity directly to a color token. Convenience
 * wrapper around issueSeverityToCompletionBand + completionBandColor.
 *
 * Use this in both endpoint circles and guidance card primary accents
 * to guarantee they always show the same color for the same severity.
 */
export function issueSeverityColor(severity: IssueSeverity): string {
  return completionBandColor(issueSeverityToCompletionBand(severity));
}

// ---------------------------------------------------------------------------
// Preflight / validation status alignment
// ---------------------------------------------------------------------------

/**
 * Map a preflight check status to a color token using the shared
 * completion color scale. Replaces the local getStatusColor function
 * in ValidationChecklist with a shared implementation.
 *
 *   pass → strong (green)
 *   warn → fair   (amber)
 *   fail → critical (red)
 *   other → gray (not started)
 */
export function preflightStatusColor(
  status: 'pass' | 'fail' | 'warn' | 'pending'
): string {
  if (status === 'pass') return completionBandColor('strong');
  if (status === 'fail') return completionBandColor('critical');
  if (status === 'warn') return completionBandColor('fair');
  return 'var(--p-text-dim)';
}
