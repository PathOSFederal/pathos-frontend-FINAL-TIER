/**
 * ============================================================================
 * ISSUE CATEGORIES — Typed issue classification for Resume Builder scoring
 * ============================================================================
 *
 * PURPOSE: Defines a typed issue category system that explicitly distinguishes
 * between different KINDS of resume problems. The Resume Builder must never
 * treat "Veteran preference not specified" (a missing required field) and
 * "Bullet lacks quantified impact" (weak evidence) as the same kind of issue.
 *
 * ISSUE CATEGORIES:
 *   missing_field:          A required or expected field has no content.
 *                           Example: "Hours per week not specified"
 *
 *   weak_evidence:          Content exists but lacks strength — missing
 *                           metrics, vague scope, unquantified claims.
 *                           Example: "Bullet lacks quantified outcome"
 *
 *   keyword_gap:            Target job language is missing from the resume.
 *                           Example: "Target keyword 'CISSP' not found in skills"
 *
 *   federal_requirement:    A federal-specific field or convention is missing.
 *                           Example: "Security clearance level not specified"
 *
 *   optional_enhancement:   A nice-to-have improvement that would strengthen
 *                           the resume but is not blocking or required.
 *                           Example: "Consider adding relevant publications"
 *
 * DESIGN RULE: These categories influence scoring weights, issue labels,
 * prioritization, and future PathAdvisor explanations. They are structural
 * metadata, not display-only labels.
 *
 * RELATIONSHIP TO ANNOTATION CLASSES: The existing TailoringAnnotation
 * system uses 3 classes (evidence / alignment / compression) for visual
 * treatment. Issue categories are ORTHOGONAL — they describe the nature
 * of the problem, not its visual color. A "missing_field" issue might be
 * an "alignment" annotation (red) while a "weak_evidence" issue might be
 * an "evidence" annotation (amber). The two systems compose, not replace.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

// ---------------------------------------------------------------------------
// Issue category — the 5 structural categories
// ---------------------------------------------------------------------------

/**
 * The five issue categories used throughout the Resume Builder scoring
 * and guidance system. Each issue belongs to exactly one category.
 *
 *   missing_field:       Required or expected field is absent.
 *   weak_evidence:       Content exists but lacks quality/strength.
 *   keyword_gap:         Target job terminology not present in resume.
 *   federal_requirement: Federal-specific convention or field missing.
 *   optional_enhancement: Nice-to-have improvement, not blocking.
 */
export type IssueCategory =
  | 'missing_field'
  | 'weak_evidence'
  | 'keyword_gap'
  | 'federal_requirement'
  | 'optional_enhancement';

// ---------------------------------------------------------------------------
// Issue severity — how urgent is this issue
// ---------------------------------------------------------------------------

/**
 * Issue severity level. Determines prioritization and scoring weight.
 * Re-declared here (also exists in annotation-types) so the issue
 * category system can reference it without circular imports.
 *
 *   critical:  Blocking issue that could cause screening rejection.
 *              Must be resolved before submission.
 *   high:      Important issue that significantly weakens the resume.
 *   medium:    Notable issue that should be addressed but not blocking.
 *   low:       Minor or informational suggestion.
 */
export type IssueSeverityLevel = 'critical' | 'high' | 'medium' | 'low';

// ---------------------------------------------------------------------------
// Section issue — a single typed issue for scoring and guidance
// ---------------------------------------------------------------------------

/**
 * A single typed issue attached to a resume section. Carries enough
 * metadata for scoring, prioritization, labeling, and future
 * PathAdvisor explanations.
 *
 * SectionIssue is the scored/categorized counterpart to TailoringAnnotation.
 * Annotations drive visual callout lines. Issues drive scoring logic.
 * Both can coexist for the same underlying problem.
 */
export interface SectionIssue {
  /** Unique issue identifier. */
  id: string;

  /** Which section this issue belongs to. */
  sectionId: string;

  /** Structural category — what KIND of problem this is. */
  category: IssueCategory;

  /** How severe the issue is for scoring and prioritization. */
  severity: IssueSeverityLevel;

  /** Short human-readable label for the issue.
   *  Example: "Hours per week not specified" */
  label: string;

  /** Brief explanation of why this matters for federal resumes. */
  rationale: string;

  /** Whether this issue has been resolved (field filled, content improved). */
  resolved: boolean;

  /** Scoring penalty points when unresolved. Higher = more impact on
   *  section score. Typical range: 2–15 depending on severity. */
  scoringPenalty: number;
}

// ---------------------------------------------------------------------------
// Issue category metadata — display and scoring configuration
// ---------------------------------------------------------------------------

/**
 * Display and scoring metadata for each issue category. Used by the
 * UI to show category-appropriate labels/icons and by the scoring
 * engine to apply category-specific weights.
 */
export interface IssueCategoryMeta {
  /** The category this metadata applies to. */
  category: IssueCategory;

  /** Human-readable category label. */
  label: string;

  /** Short description of what this category means. */
  description: string;

  /** Base scoring weight multiplier for issues in this category.
   *  Higher weight = more impact on section and overall scores.
   *  Range: 0.5 – 2.0 */
  scoringWeight: number;

  /** Default priority tier for sorting. Lower = shown first.
   *  0 = highest priority, 4 = lowest. */
  defaultPriorityTier: number;
}

/**
 * The canonical metadata for all 5 issue categories. This drives
 * both scoring weight calculations and display priority ordering.
 *
 * PRIORITY ORDER (highest to lowest):
 *   1. federal_requirement — can cause automatic rejection
 *   2. missing_field — blocking gaps in required data
 *   3. keyword_gap — target job alignment failures
 *   4. weak_evidence — content quality issues
 *   5. optional_enhancement — nice-to-have improvements
 */
export const ISSUE_CATEGORY_META: Record<IssueCategory, IssueCategoryMeta> = {
  federal_requirement: {
    category: 'federal_requirement',
    label: 'Federal Requirement',
    description: 'A federal-specific field or convention required for the application.',
    scoringWeight: 2.0,
    defaultPriorityTier: 0,
  },
  missing_field: {
    category: 'missing_field',
    label: 'Missing Field',
    description: 'A required or expected field has no content.',
    scoringWeight: 1.5,
    defaultPriorityTier: 1,
  },
  keyword_gap: {
    category: 'keyword_gap',
    label: 'Keyword Gap',
    description: 'Target job language is missing from the resume content.',
    scoringWeight: 1.2,
    defaultPriorityTier: 2,
  },
  weak_evidence: {
    category: 'weak_evidence',
    label: 'Weak Evidence',
    description: 'Content exists but lacks specificity, metrics, or quantified outcomes.',
    scoringWeight: 1.0,
    defaultPriorityTier: 3,
  },
  optional_enhancement: {
    category: 'optional_enhancement',
    label: 'Enhancement',
    description: 'A nice-to-have improvement that would strengthen the resume.',
    scoringWeight: 0.5,
    defaultPriorityTier: 4,
  },
};

// ---------------------------------------------------------------------------
// Helpers — issue category utilities
// ---------------------------------------------------------------------------

/**
 * Get the display label for an issue category.
 */
export function issueCategoryLabel(category: IssueCategory): string {
  return ISSUE_CATEGORY_META[category].label;
}

/**
 * Get the scoring weight for an issue category.
 */
export function issueCategoryScoringWeight(category: IssueCategory): number {
  return ISSUE_CATEGORY_META[category].scoringWeight;
}

/**
 * Get the priority tier for an issue category (lower = higher priority).
 */
export function issueCategoryPriorityTier(category: IssueCategory): number {
  return ISSUE_CATEGORY_META[category].defaultPriorityTier;
}

/**
 * Sort issues by priority: federal_requirement first, then missing_field,
 * keyword_gap, weak_evidence, optional_enhancement. Within the same
 * category, higher severity sorts first.
 */
export function sortIssuesByPriority(issues: SectionIssue[]): SectionIssue[] {
  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  /* Build a new sorted array without mutating the input */
  const sorted: SectionIssue[] = [];
  for (let i = 0; i < issues.length; i++) {
    sorted.push(issues[i]);
  }

  sorted.sort(function (a, b) {
    /* Primary sort: category priority tier */
    const aTier = ISSUE_CATEGORY_META[a.category].defaultPriorityTier;
    const bTier = ISSUE_CATEGORY_META[b.category].defaultPriorityTier;
    if (aTier !== bTier) return aTier - bTier;

    /* Secondary sort: severity within same category */
    const aSev = severityOrder[a.severity] !== undefined ? severityOrder[a.severity] : 3;
    const bSev = severityOrder[b.severity] !== undefined ? severityOrder[b.severity] : 3;
    return aSev - bSev;
  });

  return sorted;
}

/**
 * Count unresolved issues per category for a list of section issues.
 * Returns a record with counts for each of the 5 categories.
 */
export function countUnresolvedByCategory(
  issues: SectionIssue[]
): Record<IssueCategory, number> {
  const counts: Record<IssueCategory, number> = {
    missing_field: 0,
    weak_evidence: 0,
    keyword_gap: 0,
    federal_requirement: 0,
    optional_enhancement: 0,
  };

  for (let i = 0; i < issues.length; i++) {
    if (!issues[i].resolved) {
      counts[issues[i].category] = counts[issues[i].category] + 1;
    }
  }

  return counts;
}

/**
 * Compute the total weighted scoring penalty for a list of unresolved
 * issues. Each issue's scoringPenalty is multiplied by its category's
 * scoring weight. This produces a single number that represents how
 * much these issues drag down the section score.
 *
 * Only counts unresolved issues. Resolved issues have no penalty.
 */
export function computeWeightedPenalty(issues: SectionIssue[]): number {
  let total = 0;
  for (let i = 0; i < issues.length; i++) {
    if (!issues[i].resolved) {
      const weight = ISSUE_CATEGORY_META[issues[i].category].scoringWeight;
      total = total + (issues[i].scoringPenalty * weight);
    }
  }
  return total;
}
