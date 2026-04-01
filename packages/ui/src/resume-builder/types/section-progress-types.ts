/**
 * ============================================================================
 * SECTION PROGRESS TYPES — Completion, severity, and circular progress model
 * ============================================================================
 *
 * PURPOSE: Defines the section progress model that drives the compact left
 * rail section status indicators. Each resume section has a completion
 * percentage, a severity state, and callout counts that determine the
 * color-coded circular progress badge.
 *
 * COLOR SYSTEM:
 *   green  (--p-success) → complete / strong
 *   yellow (--p-warning) → needs work
 *   red    (--p-danger)  → critical / blocking
 *   gray   (--p-text-dim) → missing / not started
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

// ---------------------------------------------------------------------------
// Severity state — the 4 possible states for a section's health
// ---------------------------------------------------------------------------

/**
 * Severity classification for a resume section's progress.
 *
 *   complete:   Section is fully populated with no outstanding issues.
 *               Green indicator. No callouts needed.
 *
 *   needs_work: Section has content but needs improvement — missing
 *               keywords, weak bullets, incomplete fields, etc.
 *               Yellow indicator. Shows active callout count.
 *
 *   missing:    Section has no content at all. Gray indicator.
 *               The user has not started this section yet.
 *
 *   critical:   Section has blocking issues that would prevent export
 *               or cause automatic screening rejection. Red indicator.
 *               Highest-priority for user attention.
 */
export type SeverityState = 'complete' | 'needs_work' | 'missing' | 'critical';

// ---------------------------------------------------------------------------
// Section progress — full progress model for one resume section
// ---------------------------------------------------------------------------

/**
 * Complete progress information for a single resume section.
 * Drives the circular progress badge in the left rail and the
 * section status indicators throughout the builder.
 *
 * SEMANTIC MODEL (severity/health reconciliation):
 *   completionPct:          are expected fields present? (0–100 field fill rate)
 *   severity:               overall section HEALTH — rolls up completion,
 *                           callout count, AND unresolved high-severity issues.
 *                           This drives the LEFT RAIL badge color.
 *   highSeverityIssueCount: how many unresolved high-severity issues exist.
 *                           Used to downgrade section health even when
 *                           completionPct is high — a 100% complete section
 *                           with a blocking issue is NOT healthy.
 *
 * The old model used deriveSeverity which ignored issue severity. The new
 * model uses deriveSectionHealth which considers it. See deriveSectionHealth
 * for the full rule set.
 */
export interface SectionProgress {
  /** Section identifier matching the SectionId type used elsewhere. */
  sectionId: string;

  /** Human-readable section label. */
  label: string;

  /** Completion percentage (0-100). Drives the circular progress arc FILL
   *  amount. This is raw field fill rate — it answers "are fields present?"
   *  but NOT "is the section healthy?" */
  completionPct: number;

  /** Current section health state. Determines the COLOR of the progress ring.
   *  Derived from completionPct + activeCalloutCount + highSeverityIssueCount
   *  via deriveSectionHealth. This is the reconciled health signal that
   *  considers both completion AND unresolved critical issues. */
  severity: SeverityState;

  /** Number of active (unresolved) callouts/annotations for this section. */
  activeCalloutCount: number;

  /** Number of resolved callouts for this section. Useful for showing
   *  improvement progress over time. */
  resolvedCalloutCount: number;

  /** Number of unresolved HIGH-severity issues in this section. Used by
   *  deriveSectionHealth to downgrade section health even when completionPct
   *  is high. A section with 100% field fill but a critical federal-required
   *  field issue should NOT display as green/complete. */
  highSeverityIssueCount: number;
}

// ---------------------------------------------------------------------------
// Section progress list — all sections together
// ---------------------------------------------------------------------------

/**
 * All section progress entries for the resume. Used by the left rail
 * to render the complete section status overview.
 */
export type SectionProgressList = SectionProgress[];

// ---------------------------------------------------------------------------
// Color mapping — severity state to PathOS theme tokens
// ---------------------------------------------------------------------------

/**
 * Map a severity state to a PathOS theme color token.
 * Used for the circular progress ring, badge background, and text.
 */
export function severityToColor(severity: SeverityState): string {
  if (severity === 'complete') return 'var(--p-success)';
  if (severity === 'needs_work') return 'var(--p-warning, #eab308)';
  if (severity === 'critical') return 'var(--p-danger, #ef4444)';
  return 'var(--p-text-dim)';
}

/**
 * Map a severity state to a human-readable label.
 */
export function severityToLabel(severity: SeverityState): string {
  if (severity === 'complete') return 'Complete';
  if (severity === 'needs_work') return 'Needs work';
  if (severity === 'critical') return 'Critical';
  return 'Not started';
}

// ---------------------------------------------------------------------------
// Derivation: compute severity from completion + callout counts (legacy)
// ---------------------------------------------------------------------------

/**
 * Derive the severity state from a section's completion percentage
 * and active callout count. This is the LEGACY rule set that does NOT
 * consider issue severity. Preserved for backward compatibility with
 * existing tests and call sites.
 *
 * For new code, prefer deriveSectionHealth which also considers
 * high-severity unresolved issues.
 *
 * Rules (applied in order):
 *   1. completionPct === 0                        → missing
 *   2. completionPct < 30 or activeCallouts >= 4  → critical
 *   3. activeCallouts > 0 or completionPct < 60   → needs_work
 *   4. completionPct >= 80                        → complete
 *   5. everything else                            → needs_work
 */
export function deriveSeverity(
  completionPct: number,
  activeCalloutCount: number
): SeverityState {
  if (completionPct === 0) return 'missing';
  if (completionPct < 30 || activeCalloutCount >= 4) return 'critical';
  if (activeCalloutCount > 0 || completionPct < 60) return 'needs_work';
  if (completionPct >= 80) return 'complete';
  return 'needs_work';
}

// ---------------------------------------------------------------------------
// Derivation: compute section HEALTH from completion + callouts + severity
// ---------------------------------------------------------------------------

/**
 * Derive the section HEALTH state considering completion percentage,
 * active callout count, AND the number of unresolved high-severity issues.
 *
 * This is the reconciled health derivation that prevents contradictions
 * like "100% complete + green badge" when a critical federal-required
 * field issue exists. The key insight: field fill rate alone does not
 * make a section healthy if real issues remain.
 *
 * Rules (applied in priority order):
 *   1. completionPct === 0                                  → missing
 *   2. highSeverityIssueCount >= 2                          → critical
 *      (Multiple blocking issues = section is in bad shape)
 *   3. completionPct < 30 || activeCalloutCount >= 4        → critical
 *      (Very low fill or overwhelming issue volume)
 *   4. highSeverityIssueCount > 0                           → needs_work
 *      (Any blocking issue caps section at amber, even at 100% fill)
 *   5. activeCalloutCount > 0 || completionPct < 60         → needs_work
 *      (Unresolved issues or mediocre fill)
 *   6. completionPct >= 80                                  → complete
 *      (High fill, no issues = truly healthy)
 *   7. everything else                                      → needs_work
 *
 * CONTACT / ELIGIBILITY FIX: When the contact section shows 100%
 * completion but has unresolved high-severity issues (e.g. missing
 * eligibility, citizenship, or employment authorization), rule 4
 * prevents it from displaying as green. The user sees amber, which
 * correctly signals "look at these issues" even though fields are filled.
 */
export function deriveSectionHealth(
  completionPct: number,
  activeCalloutCount: number,
  highSeverityIssueCount: number
): SeverityState {
  /* Rule 1: No content at all → missing (gray) */
  if (completionPct === 0) return 'missing';

  /* Rule 2: Multiple blocking issues → critical (red) regardless of fill */
  if (highSeverityIssueCount >= 2) return 'critical';

  /* Rule 3: Very low fill or overwhelming issue volume → critical */
  if (completionPct < 30 || activeCalloutCount >= 4) return 'critical';

  /* Rule 4: ANY high-severity issue caps health at needs_work (amber).
   * This is the key reconciliation rule — a section can be 100% filled
   * but still show amber when a critical issue exists. */
  if (highSeverityIssueCount > 0) return 'needs_work';

  /* Rule 5: Some issues or mediocre fill → needs_work */
  if (activeCalloutCount > 0 || completionPct < 60) return 'needs_work';

  /* Rule 6: High fill, no issues → truly healthy */
  if (completionPct >= 80) return 'complete';

  /* Rule 7: Everything else → needs_work */
  return 'needs_work';
}

// ---------------------------------------------------------------------------
// Explicit completion + fit labels — replaces ambiguous raw percentage
// ---------------------------------------------------------------------------

/**
 * Derive a plain-language completion label from field fill percentage.
 * Answers "are the expected fields present?" without implying quality.
 *
 * Used in the section rail and anywhere the user needs to understand
 * whether fields are filled vs whether content is good enough.
 */
export function completionLabel(completionPct: number): string {
  if (completionPct === 0) return 'Not started';
  if (completionPct >= 100) return 'Fields complete';
  if (completionPct >= 60) return 'Mostly filled';
  return 'Incomplete';
}

/**
 * Derive a plain-language quality/readiness/fit label from the section
 * health severity state. Answers "how ready is this section?" after
 * considering both completion and unresolved issues.
 *
 * SEPARATION OF CONCERNS: completionLabel tells the user about field
 * fill; fitLabel tells the user about quality/readiness. Together they
 * replace the old ambiguous "100% / Fair" pattern.
 */
export function fitLabel(severity: SeverityState): string {
  if (severity === 'complete') return 'Strong';
  if (severity === 'needs_work') return 'Fair';
  if (severity === 'critical') return 'Needs work';
  /* missing → no content to evaluate fit for */
  return '';
}

/**
 * Build a combined status string for compact display contexts.
 * Merges completion and fit into one concise line. Handles the
 * special case where completion is high but fit is not strong
 * (the key disambiguation this refactor addresses).
 */
export function combinedStatusLabel(completionPct: number, severity: SeverityState): string {
  if (severity === 'missing' || completionPct === 0) return 'Not started';
  const fit = fitLabel(severity);
  if (completionPct >= 100 && severity === 'complete') {
    /* Fully filled, fully healthy — one word is enough */
    return 'Strong';
  }
  if (completionPct >= 100) {
    /* All fields present but issues remain — explain the disconnect */
    return 'Filled \u00B7 ' + fit;
  }
  /* Partially filled — show completion state plus fit when available */
  const completion = completionLabel(completionPct);
  if (fit) {
    return completion + ' \u00B7 ' + fit;
  }
  return completion;
}

// ---------------------------------------------------------------------------
// Issue count label — explicit "N issues" string for the section rail
// ---------------------------------------------------------------------------

/**
 * Build a human-readable issue count label for section rail display.
 * Returns null when there are no active issues (no label needed).
 *
 * EXPLICIT SEMANTICS: The user should not have to infer what a number
 * means. "2 issues" is unambiguous; a bare "2" next to a section
 * name is not.
 */
export function issueCountLabel(activeCalloutCount: number): string | null {
  if (activeCalloutCount <= 0) return null;
  if (activeCalloutCount === 1) return '1 issue';
  return activeCalloutCount + ' issues';
}

// ---------------------------------------------------------------------------
// Readiness derivation from section progress — coherent with visible states
// ---------------------------------------------------------------------------

/**
 * Derive an overall readiness score (0–100) from the section progress
 * list. This replaces the old heuristic-based readiness score that
 * was derived from coverage dimensions + an arbitrary boost.
 *
 * COHERENCE PRINCIPLE: The readiness score must feel plausibly consistent
 * with the visible section statuses in the rail. If three sections show
 * "Complete / Strong" and five show "Partial / Fair", the overall score
 * should land somewhere in the middle — not at 90%.
 *
 * ALGORITHM:
 *   1. Each section contributes a weighted readiness value:
 *      - completionPct contributes 60% (field presence)
 *      - severity health contributes 40% (quality/issue state)
 *   2. Severity health maps:
 *      complete → 100, needs_work → 55, critical → 20, missing → 0
 *   3. The overall score is the average across all sections, rounded.
 *
 * Sections with 0% completion (not started) pull the score down
 * significantly, which matches the user's expectation when they see
 * gray "Not started" badges in the rail.
 */
export function deriveOverallReadiness(sections: SectionProgress[]): number {
  if (sections.length === 0) return 0;

  const COMPLETION_WEIGHT = 0.6;
  const HEALTH_WEIGHT = 0.4;

  let totalReadiness = 0;
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    /* Map severity to a 0–100 health score */
    let healthScore = 0;
    if (section.severity === 'complete') {
      healthScore = 100;
    } else if (section.severity === 'needs_work') {
      healthScore = 55;
    } else if (section.severity === 'critical') {
      healthScore = 20;
    }
    /* 'missing' stays at 0 */

    const sectionReadiness = (section.completionPct * COMPLETION_WEIGHT) + (healthScore * HEALTH_WEIGHT);
    totalReadiness = totalReadiness + sectionReadiness;
  }

  return Math.round(totalReadiness / sections.length);
}

// ---------------------------------------------------------------------------
// Builder: build SectionProgress from raw inputs
// ---------------------------------------------------------------------------

/**
 * Build a SectionProgress from raw inputs. Computes section health
 * using the enhanced deriveSectionHealth rule set that considers
 * completion, callout count, AND high-severity issue count.
 *
 * The optional highSeverityIssueCount parameter defaults to 0 for
 * backward compatibility with existing call sites that do not yet
 * track per-section severity data.
 */
export function buildSectionProgress(
  sectionId: string,
  label: string,
  completionPct: number,
  activeCalloutCount: number,
  resolvedCalloutCount: number,
  highSeverityIssueCount?: number
): SectionProgress {
  const highCount = highSeverityIssueCount !== undefined ? highSeverityIssueCount : 0;
  return {
    sectionId: sectionId,
    label: label,
    completionPct: completionPct,
    severity: deriveSectionHealth(completionPct, activeCalloutCount, highCount),
    activeCalloutCount: activeCalloutCount,
    resolvedCalloutCount: resolvedCalloutCount,
    highSeverityIssueCount: highCount,
  };
}
