/**
 * ============================================================================
 * SCORE TIER COLORS — Shared deterministic color mapping for readiness and
 * match scores across all PathOS surfaces
 * ============================================================================
 *
 * PURPOSE: Provides a single, reusable function that maps numeric scores
 * (0–100) to PathOS theme color tokens. Used by Saved Jobs, Job Search,
 * Career Readiness, Resume Builder, and any future surface that needs
 * color-coded score indicators (readiness badges, match bars, progress
 * fills, score pills).
 *
 * WHY SHARED: The same score (e.g., readiness 75) must always appear in
 * the same color tier regardless of which page renders it. Duplicating
 * the mapping per-screen leads to visual drift and inconsistency. This
 * module is the single source of truth for score → color.
 *
 * TWO COLOR SCALES:
 *
 *   1) MATCH / GENERIC 3-TIER (scoreTierColor):
 *      Strong (>=80): --p-success (green)  — user is well-positioned
 *      Medium (>=60): --p-warning (amber)  — needs attention, addressable
 *      Weak   (<60):  --p-danger  (red)    — significant gap or risk
 *
 *   2) READINESS 5-TIER (readinessTierColor):
 *      81–100: --p-success (green)       — Strong
 *      61–80:  blended success           — Good
 *      41–60:  --p-warning (amber)       — Fair
 *      21–40:  --p-danger (red/amber)    — Needs work
 *      0–20:   --p-danger (red)          — Critical
 *
 *      The 5-tier scale is used for READINESS display so Resume Readiness
 *      and Career Readiness feel like siblings with the same color logic.
 *      The bands map 1:1 with the completion-colors.ts CompletionBand
 *      system. This is intentional — readiness and completion share the
 *      same 5-tier visual vocabulary even though the underlying numbers
 *      represent different things:
 *        - COMPLETION = are fields present? (field fill rate)
 *        - READINESS  = how submission-ready is the resume? (quality score)
 *      The color tells the user "how good is this number?" and the label
 *      tells them what it means. Same color logic, different semantics.
 *
 * WHY THIS SCALE: Green/amber/red is universally understood as a
 * traffic-light severity scale. Users can scan a column of color-coded
 * scores and immediately identify which items need attention without
 * reading the numbers.
 *
 * THRESHOLDS: Match uses 80/60 (simple, round, federal-aligned).
 * Readiness uses 81/61/41/21 (5-tier, aligned with completion-colors.ts
 * for cross-surface consistency).
 *
 * FALLBACKS: --p-warning and --p-danger include fallback hex values in
 * case a theme variant does not define them. These fallbacks match the
 * standard PathOS dark theme values.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

// ---------------------------------------------------------------------------
// Match / generic 3-tier threshold constants
// ---------------------------------------------------------------------------

/** Threshold at or above which a score is considered "strong" (green). */
export const SCORE_TIER_STRONG = 80;

/** Threshold at or above which a score is considered "medium" (amber). */
export const SCORE_TIER_MEDIUM = 60;

// ---------------------------------------------------------------------------
// Readiness 5-tier threshold constants — aligned with completion-colors.ts
// ---------------------------------------------------------------------------

/**
 * The readiness thresholds intentionally mirror the CompletionBand
 * thresholds in completion-colors.ts so all 5-tier displays across
 * the product use the same visual breakpoints.
 *
 *   81–100 → strong  (green)
 *   61–80  → good    (yellow-green)
 *   41–60  → fair    (amber)
 *   21–40  → poor    (red/amber)
 *   0–20   → critical (red)
 */
export const READINESS_TIER_STRONG = 81;
export const READINESS_TIER_GOOD = 61;
export const READINESS_TIER_FAIR = 41;
export const READINESS_TIER_POOR = 21;

// ---------------------------------------------------------------------------
// Score-to-color mapping function (3-tier — for match and generic scores)
// ---------------------------------------------------------------------------

/**
 * Map a numeric score (0–100) to a PathOS theme color token string.
 *
 * Returns a CSS custom property reference suitable for use in inline
 * `style` objects — e.g., `{ color: scoreTierColor(85) }`.
 *
 * Tiers:
 *   score >= 80 → var(--p-success)   green — strong
 *   score >= 60 → var(--p-warning)   amber — medium, needs attention
 *   score <  60 → var(--p-danger)    red   — weak, significant gap
 *
 * This function is deterministic, pure, and safe to call in render paths.
 * It uses only CSS custom property references (no runtime DOM access).
 */
export function scoreTierColor(score: number): string {
  if (score >= SCORE_TIER_STRONG) return 'var(--p-success)';
  if (score >= SCORE_TIER_MEDIUM) return 'var(--p-warning, #eab308)';
  return 'var(--p-danger, #ef4444)';
}

// ---------------------------------------------------------------------------
// Readiness-specific 5-tier color mapping
// ---------------------------------------------------------------------------

/**
 * Map a readiness score (0–100) to a PathOS theme color token using
 * the 5-tier readiness scale. This is the canonical color function for
 * Resume Readiness and any surface that displays readiness percentage.
 *
 * WHY 5-TIER INSTEAD OF 3-TIER: Readiness needs finer granularity than
 * match scores. A 65% readiness is meaningfully different from a 45%
 * readiness — both would show amber in the 3-tier system, but the user
 * experience should distinguish "getting close" (good/yellow-green) from
 * "needs significant work" (fair/amber).
 *
 * Color bands:
 *   81–100 → var(--p-success)           green        "Strong"
 *   61–80  → var(--p-success)           yellow-green "Good"
 *   41–60  → var(--p-warning)           amber        "Fair"
 *   21–40  → var(--p-danger)            red/amber    "Needs work"
 *   0–20   → var(--p-danger)            red          "Critical"
 *
 * NOTE: The "good" band (61–80) uses --p-success rather than a blend,
 * matching completionBandColor() for consistency. Both the 61–80 and
 * 81–100 ranges render green; the label provides the distinction.
 *
 * @param score - Readiness percentage, 0–100. Clamped internally.
 * @returns CSS custom property reference for inline style use.
 */
export function readinessTierColor(score: number): string {
  if (score >= READINESS_TIER_STRONG) return 'var(--p-success)';
  if (score >= READINESS_TIER_GOOD) return 'var(--p-success)';
  if (score >= READINESS_TIER_FAIR) return 'var(--p-warning, #eab308)';
  if (score >= READINESS_TIER_POOR) return 'var(--p-danger, #ef4444)';
  return 'var(--p-danger, #ef4444)';
}

// ---------------------------------------------------------------------------
// Readiness band label — human-readable interpretation of the percentage
// ---------------------------------------------------------------------------

/**
 * Map a readiness score (0–100) to a human-readable band label.
 *
 * These labels are the SECONDARY signal next to the percentage.
 * The percentage is always primary — these labels provide a quick
 * qualitative interpretation so users don't have to interpret the
 * number on their own.
 *
 * EXAMPLE DISPLAY:
 *   "87% Ready"           ← primary (the number)
 *   "Strong"              ← secondary (this label)
 *   "1 blocker remaining" ← optional tertiary (context-specific)
 *
 * Bands:
 *   81–100 → "Strong"      — resume is well-positioned for submission
 *   61–80  → "Good"        — resume is on track, minor improvements possible
 *   41–60  → "Fair"        — resume needs attention in several areas
 *   21–40  → "Needs work"  — significant gaps exist
 *   0–20   → "Critical"    — major sections incomplete or blocking issues
 *
 * @param score - Readiness percentage, 0–100.
 * @returns Human-readable band label string.
 */
export function readinessBandLabel(score: number): string {
  if (score >= READINESS_TIER_STRONG) return 'Strong';
  if (score >= READINESS_TIER_GOOD) return 'Good';
  if (score >= READINESS_TIER_FAIR) return 'Fair';
  if (score >= READINESS_TIER_POOR) return 'Needs work';
  return 'Critical';
}
