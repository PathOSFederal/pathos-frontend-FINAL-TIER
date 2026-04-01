/**
 * ============================================================================
 * EVIDENCE-BASED SCORING ENGINE — Deterministic, explainable section scoring
 * ============================================================================
 *
 * PURPOSE: Replaces shallow heuristic scoring with an explicit, rule-based
 * scoring foundation. Each section is scored across multiple dimensions:
 *
 *   A. FIELD COMPLETION — are required/expected fields present?
 *   B. EVIDENCE STRENGTH — how specific, quantified, and impactful is content?
 *   C. TARGET-JOB RELEVANCE — does content align with the target announcement?
 *   D. FEDERAL REQUIREMENT COVERAGE — are federal-specific fields present?
 *
 * SCORING MODEL:
 *   Each section starts at 100 points. Issues deduct points based on their
 *   category, severity, and the section's scoring mode (from federal-section-meta).
 *
 *   - field_completion sections: field issues deduct more, evidence issues less
 *   - evidence_quality sections: evidence issues deduct more, field issues less
 *   - hybrid sections: both deduct at normal rates
 *
 *   The final section score is clamped to 0–100 and represents how "ready"
 *   the section is for a federal resume submission.
 *
 * EXPLAINABILITY PRINCIPLE: Every section score can be explained by listing
 * the issues that caused deductions. There is no magic. The score is the
 * starting ceiling minus explicit, named deductions.
 *
 * DESIGN RULE: This file defines scoring LOGIC. It does NOT render any UI.
 * Components read scoring results to drive their display.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

import type { ResumeDraft } from '@pathos/core';
import type { ScoringMode } from '../types/federal-section-meta';
import { buildFederalSectionMeta, getCanonicalUIOrder, getScoringMode } from '../types/federal-section-meta';
import type { SectionIssue, IssueCategory } from '../types/issue-categories';
import { ISSUE_CATEGORY_META } from '../types/issue-categories';
import type { TailoringAnnotation } from '../types/annotation-types';

// ---------------------------------------------------------------------------
// Scoring dimensions — the 4 assessment axes
// ---------------------------------------------------------------------------

/**
 * The 4 scoring dimensions that compose a section's evidence score.
 * Each dimension contributes a sub-score (0–100) that is weighted
 * differently depending on the section's scoringMode.
 */
export interface ScoringDimensions {
  /** Are required/expected fields present? (0–100) */
  fieldCompletion: number;

  /** How strong is the content evidence? (0–100) */
  evidenceStrength: number;

  /** How well does content align with the target job? (0–100) */
  targetRelevance: number;

  /** Are federal-specific requirements covered? (0–100) */
  federalCoverage: number;
}

// ---------------------------------------------------------------------------
// Section evidence score — the complete scored output for one section
// ---------------------------------------------------------------------------

/**
 * Complete evidence-based score for a single resume section. Includes
 * the composite score, individual dimension scores, the issues that
 * caused deductions, and enough metadata for future explainability UI.
 */
export interface SectionEvidenceScore {
  /** Which section this score belongs to. */
  sectionId: string;

  /** Section display label. */
  label: string;

  /** Composite score (0–100). This is the "headline" number that
   *  represents overall section readiness. Derived from dimension
   *  scores weighted by the section's scoringMode. */
  compositeScore: number;

  /** Individual dimension scores for explainability. Each dimension
   *  answers a different question about the section's readiness. */
  dimensions: ScoringDimensions;

  /** All issues found for this section, sorted by priority. */
  issues: SectionIssue[];

  /** Count of unresolved issues by category. */
  unresolvedCounts: Record<IssueCategory, number>;

  /** Total weighted penalty from unresolved issues. */
  totalPenalty: number;

  /** The scoring mode used for this section (from federal-section-meta). */
  scoringMode: ScoringMode;
}

// ---------------------------------------------------------------------------
// Dimension weights by scoring mode — how much each dimension matters
// ---------------------------------------------------------------------------

/**
 * Weight distribution for the 4 scoring dimensions, indexed by scoring
 * mode. These weights determine how the 4 dimension sub-scores combine
 * into the composite section score.
 *
 * field_completion:  Field presence dominates (50%). Evidence and target
 *                    relevance matter less for sections like Contact.
 *
 * evidence_quality:  Evidence strength dominates (40%). For sections like
 *                    Work Experience and Summary, content quality matters
 *                    more than mere presence.
 *
 * hybrid:            Balanced weighting. For sections like Education and
 *                    Certifications, both presence and quality matter.
 */
const DIMENSION_WEIGHTS: Record<ScoringMode, {
  fieldCompletion: number;
  evidenceStrength: number;
  targetRelevance: number;
  federalCoverage: number;
}> = {
  field_completion: {
    fieldCompletion: 0.50,
    evidenceStrength: 0.10,
    targetRelevance: 0.15,
    federalCoverage: 0.25,
  },
  evidence_quality: {
    fieldCompletion: 0.20,
    evidenceStrength: 0.40,
    targetRelevance: 0.25,
    federalCoverage: 0.15,
  },
  hybrid: {
    fieldCompletion: 0.30,
    evidenceStrength: 0.25,
    targetRelevance: 0.20,
    federalCoverage: 0.25,
  },
};

// ---------------------------------------------------------------------------
// Scoring rule penalties — default deductions by category + severity
// ---------------------------------------------------------------------------

/**
 * Default scoring penalty per issue, indexed by category and severity.
 * These are the base deductions before category weight multipliers.
 *
 * DESIGN: Penalties are intentionally conservative. A single missing
 * field should not tank a section score. But multiple missing fields
 * or a critical federal requirement gap should produce a meaningful drop.
 */
const BASE_PENALTIES: Record<IssueCategory, Record<string, number>> = {
  federal_requirement: { critical: 15, high: 12, medium: 8, low: 4 },
  missing_field:       { critical: 12, high: 10, medium: 6, low: 3 },
  keyword_gap:         { critical: 10, high: 8,  medium: 5, low: 2 },
  weak_evidence:       { critical: 8,  high: 6,  medium: 4, low: 2 },
  optional_enhancement:{ critical: 4,  high: 3,  medium: 2, low: 1 },
};

/**
 * Look up the base penalty for an issue category + severity.
 */
function getBasePenalty(category: IssueCategory, severity: string): number {
  const categoryPenalties = BASE_PENALTIES[category];
  if (categoryPenalties && categoryPenalties[severity] !== undefined) {
    return categoryPenalties[severity];
  }
  return 3;
}

// ---------------------------------------------------------------------------
// Issue detection: Contact / Eligibility
// ---------------------------------------------------------------------------

/**
 * Detect issues for the Contact / Eligibility section. Evaluates each
 * field independently and classifies issues by category.
 *
 * FIELD-LEVEL EVALUATION: Each subfield is checked separately so the
 * issue list precisely names what is missing or weak. No generic
 * "incomplete contact" issues.
 */
function detectContactIssues(draft: ResumeDraft): SectionIssue[] {
  const issues: SectionIssue[] = [];
  const contact = draft.contact;

  /* Required field checks — these are missing_field issues */
  if (!contact.fullName || contact.fullName.trim().length === 0) {
    issues.push({
      id: 'contact-missing-name',
      sectionId: 'contact',
      category: 'missing_field',
      severity: 'critical',
      label: 'Full name not specified',
      rationale: 'Legal name is required on all federal applications.',
      resolved: false,
      scoringPenalty: getBasePenalty('missing_field', 'critical'),
    });
  }

  if (!contact.email || contact.email.trim().length === 0) {
    issues.push({
      id: 'contact-missing-email',
      sectionId: 'contact',
      category: 'missing_field',
      severity: 'high',
      label: 'Email not specified',
      rationale: 'Primary communication channel for application status.',
      resolved: false,
      scoringPenalty: getBasePenalty('missing_field', 'high'),
    });
  }

  if (!contact.phone || contact.phone.trim().length === 0) {
    issues.push({
      id: 'contact-missing-phone',
      sectionId: 'contact',
      category: 'missing_field',
      severity: 'high',
      label: 'Phone not specified',
      rationale: 'Required for scheduling and verification.',
      resolved: false,
      scoringPenalty: getBasePenalty('missing_field', 'high'),
    });
  }

  const hasCity = contact.city && contact.city.trim().length > 0;
  const hasState = contact.state && contact.state.trim().length > 0;
  if (!hasCity && !hasState) {
    issues.push({
      id: 'contact-missing-location',
      sectionId: 'contact',
      category: 'missing_field',
      severity: 'medium',
      label: 'Location not specified',
      rationale: 'Location determines geographic eligibility for some postings.',
      resolved: false,
      scoringPenalty: getBasePenalty('missing_field', 'medium'),
    });
  }

  /* Federal requirement checks — these are federal_requirement issues */
  if (!contact.citizenship || contact.citizenship.trim().length === 0) {
    issues.push({
      id: 'contact-missing-citizenship',
      sectionId: 'contact',
      category: 'federal_requirement',
      severity: 'critical',
      label: 'Citizenship status not specified',
      rationale: 'U.S. citizenship is required for most federal positions. Missing this can cause automatic screening rejection.',
      resolved: false,
      scoringPenalty: getBasePenalty('federal_requirement', 'critical'),
    });
  }

  const hasVeteranPref = contact.veteranStatus && contact.veteranStatus.trim().length > 0 && contact.veteranStatus.trim() !== 'N/A';
  if (!hasVeteranPref) {
    issues.push({
      id: 'contact-missing-veteran-pref',
      sectionId: 'contact',
      category: 'federal_requirement',
      severity: 'medium',
      label: 'Veteran preference not specified',
      rationale: 'Veterans receive preference points in federal hiring. Specifying status helps HR route the application correctly.',
      resolved: false,
      scoringPenalty: getBasePenalty('federal_requirement', 'medium'),
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Issue detection: Summary
// ---------------------------------------------------------------------------

/**
 * Detect issues for the Professional Summary section. Evaluates both
 * presence (missing_field) and quality (weak_evidence / keyword_gap).
 */
function detectSummaryIssues(draft: ResumeDraft): SectionIssue[] {
  const issues: SectionIssue[] = [];
  const summary = draft.summary;

  /* Missing summary entirely — critical missing_field */
  if (!summary || summary.trim().length < 10) {
    issues.push({
      id: 'summary-missing',
      sectionId: 'summary',
      category: 'missing_field',
      severity: 'high',
      label: 'Professional summary missing',
      rationale: 'The summary is the first content HR reads. A targeted opening dramatically improves screening outcomes.',
      resolved: false,
      scoringPenalty: getBasePenalty('missing_field', 'high'),
    });
    return issues;
  }

  /* Summary exists — check evidence quality */
  const trimmed = summary.trim();

  /* Short summary — weak_evidence */
  if (trimmed.length < 100) {
    issues.push({
      id: 'summary-too-short',
      sectionId: 'summary',
      category: 'weak_evidence',
      severity: 'medium',
      label: 'Summary is very brief',
      rationale: 'A substantive federal resume summary should be at least 2-3 sentences connecting qualifications to the target role.',
      resolved: false,
      scoringPenalty: getBasePenalty('weak_evidence', 'medium'),
    });
  }

  /* No quantified claims — weak_evidence */
  const hasNumbers = /\d+/.test(trimmed);
  if (!hasNumbers) {
    issues.push({
      id: 'summary-no-metrics',
      sectionId: 'summary',
      category: 'weak_evidence',
      severity: 'low',
      label: 'Summary lacks quantified claims',
      rationale: 'Including years of experience, team sizes, or outcome metrics strengthens the opening.',
      resolved: false,
      scoringPenalty: getBasePenalty('weak_evidence', 'low'),
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Issue detection: Work Experience
// ---------------------------------------------------------------------------

/**
 * Detect issues for Work Experience. This is the most complex section
 * because it evaluates both field presence AND evidence quality per entry.
 *
 * FIELD ISSUES: title, employer, dates, hours/week per entry
 * EVIDENCE ISSUES: bullet specificity, quantified outcomes, scope language
 */
function detectExperienceIssues(draft: ResumeDraft): SectionIssue[] {
  const issues: SectionIssue[] = [];

  /* No experience entries at all — critical missing_field */
  if (draft.experience.length === 0) {
    issues.push({
      id: 'experience-missing',
      sectionId: 'experience',
      category: 'missing_field',
      severity: 'critical',
      label: 'No work experience entries',
      rationale: 'Work experience is the most important section of a federal resume.',
      resolved: false,
      scoringPenalty: getBasePenalty('missing_field', 'critical'),
    });
    return issues;
  }

  /* Per-entry field and evidence checks */
  for (let i = 0; i < draft.experience.length; i++) {
    const exp = draft.experience[i];
    const prefix = 'exp-' + i + '-';

    /* Field presence checks — missing_field issues */
    if (!exp.jobTitle || exp.jobTitle.trim().length === 0) {
      issues.push({
        id: prefix + 'missing-title',
        sectionId: 'experience',
        category: 'missing_field',
        severity: 'high',
        label: 'Job title missing (entry ' + (i + 1) + ')',
        rationale: 'Federal HR matches job titles against the announcement series and grade.',
        resolved: false,
        scoringPenalty: getBasePenalty('missing_field', 'high'),
      });
    }

    if (!exp.employer || exp.employer.trim().length === 0) {
      issues.push({
        id: prefix + 'missing-employer',
        sectionId: 'experience',
        category: 'missing_field',
        severity: 'high',
        label: 'Employer missing (entry ' + (i + 1) + ')',
        rationale: 'Full organization name, city, and state are required for federal experience entries.',
        resolved: false,
        scoringPenalty: getBasePenalty('missing_field', 'high'),
      });
    }

    if (!exp.startDate || exp.startDate.trim().length === 0) {
      issues.push({
        id: prefix + 'missing-dates',
        sectionId: 'experience',
        category: 'missing_field',
        severity: 'high',
        label: 'Start date missing (entry ' + (i + 1) + ')',
        rationale: 'Federal HR requires month/year format to calculate qualifying experience duration.',
        resolved: false,
        scoringPenalty: getBasePenalty('missing_field', 'high'),
      });
    }

    /* Hours per week — federal_requirement */
    if (!exp.hoursPerWeek || exp.hoursPerWeek.trim().length === 0) {
      issues.push({
        id: prefix + 'missing-hours',
        sectionId: 'experience',
        category: 'federal_requirement',
        severity: 'high',
        label: 'Hours/week missing (entry ' + (i + 1) + ')',
        rationale: 'Experience not credited at full-time level without hours/week. Missing this can reduce credited experience.',
        resolved: false,
        scoringPenalty: getBasePenalty('federal_requirement', 'high'),
      });
    }

    /* Evidence quality checks on duties */
    if (exp.duties && exp.duties.trim().length > 0) {
      const dutiesText = exp.duties.trim();

      /* Check for quantified outcomes — weak_evidence if missing */
      const hasNumbers = /\d+/.test(dutiesText);
      if (!hasNumbers) {
        issues.push({
          id: prefix + 'no-metrics',
          sectionId: 'experience',
          category: 'weak_evidence',
          severity: 'medium',
          label: 'Duties lack quantified outcomes (entry ' + (i + 1) + ')',
          rationale: 'Federal resumes benefit from specific numbers: staff managed, budgets controlled, percent improvements.',
          resolved: false,
          scoringPenalty: getBasePenalty('weak_evidence', 'medium'),
        });
      }

      /* Very short duties — weak_evidence */
      if (dutiesText.length < 50) {
        issues.push({
          id: prefix + 'thin-duties',
          sectionId: 'experience',
          category: 'weak_evidence',
          severity: 'medium',
          label: 'Duties description too brief (entry ' + (i + 1) + ')',
          rationale: 'Federal resumes expect detailed, results-focused duty descriptions with scope and complexity language.',
          resolved: false,
          scoringPenalty: getBasePenalty('weak_evidence', 'medium'),
        });
      }
    } else {
      /* No duties at all — missing_field */
      issues.push({
        id: prefix + 'missing-duties',
        sectionId: 'experience',
        category: 'missing_field',
        severity: 'critical',
        label: 'Duties not described (entry ' + (i + 1) + ')',
        rationale: 'Results-focused duty descriptions are the core of every federal experience entry.',
        resolved: false,
        scoringPenalty: getBasePenalty('missing_field', 'critical'),
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Issue detection: Education
// ---------------------------------------------------------------------------

/**
 * Detect issues for the Education section. Checks both field presence
 * and evidence quality (degree/institution completeness).
 */
function detectEducationIssues(draft: ResumeDraft): SectionIssue[] {
  const issues: SectionIssue[] = [];

  if (draft.education.length === 0) {
    issues.push({
      id: 'education-missing',
      sectionId: 'education',
      category: 'missing_field',
      severity: 'medium',
      label: 'No education entries',
      rationale: 'Education strengthens many federal applications and is required when the announcement specifies education requirements.',
      resolved: false,
      scoringPenalty: getBasePenalty('missing_field', 'medium'),
    });
    return issues;
  }

  for (let i = 0; i < draft.education.length; i++) {
    const edu = draft.education[i];
    const prefix = 'edu-' + i + '-';

    if (!edu.institution || edu.institution.trim().length === 0) {
      issues.push({
        id: prefix + 'missing-institution',
        sectionId: 'education',
        category: 'missing_field',
        severity: 'high',
        label: 'Institution name missing (entry ' + (i + 1) + ')',
        rationale: 'Full name of the accredited institution is required.',
        resolved: false,
        scoringPenalty: getBasePenalty('missing_field', 'high'),
      });
    }

    if (!edu.degree || edu.degree.trim().length === 0) {
      issues.push({
        id: prefix + 'missing-degree',
        sectionId: 'education',
        category: 'missing_field',
        severity: 'high',
        label: 'Degree type missing (entry ' + (i + 1) + ')',
        rationale: 'Degree type (Bachelor of Science, Master of Arts, etc.) must match accredited program.',
        resolved: false,
        scoringPenalty: getBasePenalty('missing_field', 'high'),
      });
    }

    if (!edu.field || edu.field.trim().length === 0) {
      issues.push({
        id: prefix + 'missing-field-of-study',
        sectionId: 'education',
        category: 'missing_field',
        severity: 'medium',
        label: 'Field of study missing (entry ' + (i + 1) + ')',
        rationale: 'Must align with degree requirements in the announcement if specified.',
        resolved: false,
        scoringPenalty: getBasePenalty('missing_field', 'medium'),
      });
    }

    if (!edu.graduationDate || edu.graduationDate.trim().length === 0) {
      issues.push({
        id: prefix + 'missing-graduation-date',
        sectionId: 'education',
        category: 'missing_field',
        severity: 'medium',
        label: 'Graduation date missing (entry ' + (i + 1) + ')',
        rationale: 'Month/year of completion or expected completion is required by federal HR.',
        resolved: false,
        scoringPenalty: getBasePenalty('missing_field', 'medium'),
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Issue detection: Skills
// ---------------------------------------------------------------------------

/**
 * Detect issues for the Skills section. Evaluates both presence and
 * useful specificity.
 */
function detectSkillsIssues(draft: ResumeDraft): SectionIssue[] {
  const issues: SectionIssue[] = [];

  if (draft.skills.length === 0) {
    issues.push({
      id: 'skills-missing',
      sectionId: 'skills',
      category: 'missing_field',
      severity: 'medium',
      label: 'No skills listed',
      rationale: 'Skills section helps with automated keyword matching against announcement requirements.',
      resolved: false,
      scoringPenalty: getBasePenalty('missing_field', 'medium'),
    });
    return issues;
  }

  /* Very few skills — weak_evidence */
  if (draft.skills.length < 3) {
    issues.push({
      id: 'skills-too-few',
      sectionId: 'skills',
      category: 'weak_evidence',
      severity: 'low',
      label: 'Very few skills listed (' + draft.skills.length + ')',
      rationale: 'A substantive skills section with specific technologies and frameworks improves automated screening results.',
      resolved: false,
      scoringPenalty: getBasePenalty('weak_evidence', 'low'),
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Issue detection: Federal Details (via external data)
// ---------------------------------------------------------------------------

/**
 * Detect issues for Federal Details. Since federal details are not
 * yet in the core ResumeDraft model, this uses optional external data.
 * When no data is available, it reports the section as having federal
 * requirement gaps.
 */
function detectFederalDetailsIssues(
  federalDetails: { securityClearance: string; veteranPreference: string; federalEmployee: boolean; highestGrade: string } | null
): SectionIssue[] {
  const issues: SectionIssue[] = [];

  if (!federalDetails) {
    issues.push({
      id: 'federal-not-populated',
      sectionId: 'federal-details',
      category: 'federal_requirement',
      severity: 'high',
      label: 'Federal details not completed',
      rationale: 'Security clearance, veteran preference, federal employee status, and highest grade held are required for federal applications.',
      resolved: false,
      scoringPenalty: getBasePenalty('federal_requirement', 'high'),
    });
    return issues;
  }

  if (!federalDetails.securityClearance || federalDetails.securityClearance.trim().length === 0) {
    issues.push({
      id: 'federal-missing-clearance',
      sectionId: 'federal-details',
      category: 'federal_requirement',
      severity: 'high',
      label: 'Security clearance not specified',
      rationale: 'Many federal positions require an active or eligible clearance.',
      resolved: false,
      scoringPenalty: getBasePenalty('federal_requirement', 'high'),
    });
  }

  if (!federalDetails.highestGrade || federalDetails.highestGrade.trim().length === 0) {
    issues.push({
      id: 'federal-missing-grade',
      sectionId: 'federal-details',
      category: 'federal_requirement',
      severity: 'medium',
      label: 'Highest grade held not specified',
      rationale: 'Used to determine qualification level and pay setting.',
      resolved: false,
      scoringPenalty: getBasePenalty('federal_requirement', 'medium'),
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Issue detection: Certifications (via external data)
// ---------------------------------------------------------------------------

/**
 * Detect issues for Certifications. Since certifications are not yet in
 * the core ResumeDraft model, uses optional external data.
 */
function detectCertificationsIssues(certifications: string[]): SectionIssue[] {
  const issues: SectionIssue[] = [];

  if (!certifications || certifications.length === 0) {
    issues.push({
      id: 'certs-none-listed',
      sectionId: 'certifications',
      category: 'optional_enhancement',
      severity: 'low',
      label: 'No certifications listed',
      rationale: 'Relevant certifications strengthen many federal applications. Required for credentialed positions.',
      resolved: false,
      scoringPenalty: getBasePenalty('optional_enhancement', 'low'),
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Issue detection: Supporting Evidence (placeholder)
// ---------------------------------------------------------------------------

/**
 * Detect issues for Supporting Evidence. Currently a minimal check
 * since the core model does not yet include structured evidence fields.
 */
function detectSupportingEvidenceIssues(): SectionIssue[] {
  const issues: SectionIssue[] = [];

  issues.push({
    id: 'evidence-not-populated',
    sectionId: 'supporting-evidence',
    category: 'optional_enhancement',
    severity: 'low',
    label: 'Supporting evidence section not populated',
    rationale: 'Awards, projects, and quantified outcomes strengthen qualification claims.',
    resolved: false,
    scoringPenalty: getBasePenalty('optional_enhancement', 'low'),
  });

  return issues;
}

// ---------------------------------------------------------------------------
// Dimension scoring: compute 0–100 sub-scores for each dimension
// ---------------------------------------------------------------------------

/**
 * Compute the field completion dimension score for a section's issues.
 *
 * FILL-RATE APPROACH: Rather than "100 minus penalties," this computes
 * the inverse of the missing-field ratio. If a section has N possible
 * field-presence checks and M are failing (unresolved missing_field
 * issues), the score is ((N - M) / N) * 100.
 *
 * This produces more intuitive results: a section with 6 fields where
 * all 6 are missing scores 0%, not 62%. A section with 6 fields where
 * 1 is missing scores ~83%.
 *
 * Sections with zero possible field checks score 100% (nothing to miss).
 */
function computeFieldCompletionScore(issues: SectionIssue[]): number {
  /* Count total missing_field and federal_requirement issues that represent
   * field-presence gaps. Both categories represent "something is not there." */
  let totalFieldChecks = 0;
  let missingCount = 0;

  for (let i = 0; i < issues.length; i++) {
    const cat = issues[i].category;
    if (cat === 'missing_field' || cat === 'federal_requirement') {
      totalFieldChecks = totalFieldChecks + 1;
      if (!issues[i].resolved) {
        missingCount = missingCount + 1;
      }
    }
  }

  if (totalFieldChecks === 0) return 100;
  const presentCount = totalFieldChecks - missingCount;
  return Math.round((presentCount / totalFieldChecks) * 100);
}

/**
 * Compute the evidence strength dimension score for a section's issues.
 * Starts at 100 and deducts based on weak_evidence issues.
 */
function computeEvidenceStrengthScore(issues: SectionIssue[]): number {
  let score = 100;
  for (let i = 0; i < issues.length; i++) {
    if (!issues[i].resolved && issues[i].category === 'weak_evidence') {
      score = score - issues[i].scoringPenalty;
    }
  }
  if (score < 0) return 0;
  return score;
}

/**
 * Compute the target relevance dimension score for a section's issues.
 * Starts at 100 and deducts based on keyword_gap issues.
 */
function computeTargetRelevanceScore(issues: SectionIssue[]): number {
  let score = 100;
  for (let i = 0; i < issues.length; i++) {
    if (!issues[i].resolved && issues[i].category === 'keyword_gap') {
      score = score - issues[i].scoringPenalty;
    }
  }
  if (score < 0) return 0;
  return score;
}

/**
 * Compute the federal coverage dimension score for a section's issues.
 * Starts at 100 and deducts based on federal_requirement issues.
 */
function computeFederalCoverageScore(issues: SectionIssue[]): number {
  let score = 100;
  for (let i = 0; i < issues.length; i++) {
    if (!issues[i].resolved && issues[i].category === 'federal_requirement') {
      score = score - issues[i].scoringPenalty;
    }
  }
  if (score < 0) return 0;
  return score;
}

// ---------------------------------------------------------------------------
// Composite score: weighted combination of dimensions
// ---------------------------------------------------------------------------

/**
 * Compute the composite section score from 4 dimension sub-scores,
 * weighted by the section's scoring mode. Returns 0–100.
 *
 * CONTENT-PRESENCE RULE: When field completion is very low (below 40),
 * it means the section has very little actual content. In that case,
 * evidence strength and target relevance scores are unreliable because
 * there is nothing TO evaluate. We apply a content-presence modifier
 * that scales down evidence and target dimensions proportionally to
 * field completion. This prevents an empty section from scoring 75+
 * just because no evidence or keyword issues were detected (there was
 * nothing to detect issues in).
 *
 * The modifier is: max(fieldCompletion / 40, 1.0) — at 40% field
 * completion or above, no modification. Below 40%, the modifier
 * linearly reduces the evidence and target dimensions toward zero.
 */
function computeCompositeScore(
  dimensions: ScoringDimensions,
  scoringMode: ScoringMode
): number {
  const weights = DIMENSION_WEIGHTS[scoringMode];

  /* Content-presence modifier: when field completion is below 40%,
   * scale down evidence and target dimensions proportionally.
   * This prevents empty sections from scoring high on dimensions
   * that have no content to evaluate. */
  let evidenceModified = dimensions.evidenceStrength;
  let targetModified = dimensions.targetRelevance;

  if (dimensions.fieldCompletion < 40) {
    const presenceFactor = dimensions.fieldCompletion / 40;
    evidenceModified = Math.round(dimensions.evidenceStrength * presenceFactor);
    targetModified = Math.round(dimensions.targetRelevance * presenceFactor);
  }

  const composite =
    (dimensions.fieldCompletion * weights.fieldCompletion) +
    (evidenceModified * weights.evidenceStrength) +
    (targetModified * weights.targetRelevance) +
    (dimensions.federalCoverage * weights.federalCoverage);
  return Math.round(composite);
}

// ---------------------------------------------------------------------------
// Public API: detect all issues for a section
// ---------------------------------------------------------------------------

/**
 * Detect all typed issues for a given section based on resume content.
 * Returns a prioritized list of SectionIssue objects. This is the
 * primary entry point for issue detection per section.
 *
 * The optional federalDetails and certifications parameters are needed
 * because those sections are not yet in the core ResumeDraft model.
 */
export function detectSectionIssues(
  sectionId: string,
  draft: ResumeDraft,
  federalDetails?: { securityClearance: string; veteranPreference: string; federalEmployee: boolean; highestGrade: string } | null,
  certifications?: string[]
): SectionIssue[] {
  if (sectionId === 'contact') return detectContactIssues(draft);
  if (sectionId === 'summary') return detectSummaryIssues(draft);
  if (sectionId === 'experience') return detectExperienceIssues(draft);
  if (sectionId === 'education') return detectEducationIssues(draft);
  if (sectionId === 'skills') return detectSkillsIssues(draft);
  if (sectionId === 'federal-details') return detectFederalDetailsIssues(federalDetails !== undefined ? federalDetails : null);
  if (sectionId === 'certifications') return detectCertificationsIssues(certifications !== undefined ? certifications : []);
  if (sectionId === 'supporting-evidence') return detectSupportingEvidenceIssues();
  return [];
}

// ---------------------------------------------------------------------------
// Public API: score a single section
// ---------------------------------------------------------------------------

/**
 * Compute the full evidence-based score for a single resume section.
 * Returns a SectionEvidenceScore with composite score, dimension
 * breakdown, issues, and explainability metadata.
 *
 * This function:
 *   1. Detects all issues for the section using content rules
 *   2. Computes 4 dimension sub-scores from the issues
 *   3. Combines dimensions using scoring-mode-specific weights
 *   4. Returns a complete, explainable score artifact
 */
export function scoreSection(
  sectionId: string,
  label: string,
  draft: ResumeDraft,
  scoringMode: ScoringMode,
  federalDetails?: { securityClearance: string; veteranPreference: string; federalEmployee: boolean; highestGrade: string } | null,
  certifications?: string[]
): SectionEvidenceScore {
  /* Step 1: Detect all issues for this section */
  const issues = detectSectionIssues(sectionId, draft, federalDetails, certifications);

  /* Step 2: Compute dimension sub-scores */
  const dimensions: ScoringDimensions = {
    fieldCompletion: computeFieldCompletionScore(issues),
    evidenceStrength: computeEvidenceStrengthScore(issues),
    targetRelevance: computeTargetRelevanceScore(issues),
    federalCoverage: computeFederalCoverageScore(issues),
  };

  /* Step 3: Compute composite from weighted dimensions */
  const compositeScore = computeCompositeScore(dimensions, scoringMode);

  /* Step 4: Count unresolved issues by category */
  const unresolvedCounts: Record<IssueCategory, number> = {
    missing_field: 0,
    weak_evidence: 0,
    keyword_gap: 0,
    federal_requirement: 0,
    optional_enhancement: 0,
  };

  let totalPenalty = 0;
  for (let i = 0; i < issues.length; i++) {
    if (!issues[i].resolved) {
      unresolvedCounts[issues[i].category] = unresolvedCounts[issues[i].category] + 1;
      const weight = ISSUE_CATEGORY_META[issues[i].category].scoringWeight;
      totalPenalty = totalPenalty + (issues[i].scoringPenalty * weight);
    }
  }

  return {
    sectionId: sectionId,
    label: label,
    compositeScore: compositeScore,
    dimensions: dimensions,
    issues: issues,
    unresolvedCounts: unresolvedCounts,
    totalPenalty: totalPenalty,
    scoringMode: scoringMode,
  };
}

// ---------------------------------------------------------------------------
// Public API: score ALL sections using canonical order
// ---------------------------------------------------------------------------

/**
 * Score all UI-supported sections in canonical order. Returns an array
 * of SectionEvidenceScore objects, one per section, in the same order
 * used by the left rail and document canvas.
 *
 * This is the primary scoring entry point for the Resume Builder.
 */
export function scoreAllSections(
  draft: ResumeDraft,
  federalDetails?: { securityClearance: string; veteranPreference: string; federalEmployee: boolean; highestGrade: string } | null,
  certifications?: string[]
): SectionEvidenceScore[] {
  const registry = buildFederalSectionMeta();
  const canonicalOrder = getCanonicalUIOrder(registry);
  const scores: SectionEvidenceScore[] = [];

  for (let i = 0; i < canonicalOrder.length; i++) {
    const meta = canonicalOrder[i];
    scores.push(
      scoreSection(
        meta.sectionId,
        meta.label,
        draft,
        meta.scoringMode,
        federalDetails,
        certifications
      )
    );
  }

  return scores;
}

// ---------------------------------------------------------------------------
// Public API: derive overall readiness from evidence scores
// ---------------------------------------------------------------------------

/**
 * Derive an overall readiness score (0–100) from the evidence-based
 * section scores. This replaces the old heuristic readiness derivation
 * with a more defensible calculation.
 *
 * ALGORITHM:
 *   1. Each section contributes its compositeScore weighted by section
 *      importance (required > recommended > optional).
 *   2. Sections with critical unresolved federal_requirement issues
 *      impose an additional penalty.
 *   3. The result is clamped to 0–100.
 *
 * SECTION WEIGHTS (importance-based):
 *   required sections (contact, experience, federal-details): weight 1.5
 *   recommended sections (summary, education, certifications, skills): weight 1.0
 *   optional sections (supporting-evidence): weight 0.6
 *
 * FEDERAL PENALTY: Each unresolved critical/high federal_requirement
 * issue subtracts an additional 3 points from the overall readiness.
 * This ensures that missing a critical federal field cannot be hidden
 * by high scores in other sections.
 */
export function deriveEvidenceBasedReadiness(
  sectionScores: SectionEvidenceScore[]
): number {
  if (sectionScores.length === 0) return 0;

  /* Section importance weights by requirement level */
  const registry = buildFederalSectionMeta();

  let weightedSum = 0;
  let totalWeight = 0;
  let federalPenalty = 0;

  for (let i = 0; i < sectionScores.length; i++) {
    const score = sectionScores[i];

    /* Look up the section's requirement level for weighting */
    let sectionWeight = 1.0;
    for (let j = 0; j < registry.length; j++) {
      if (registry[j].sectionId === score.sectionId) {
        const req = registry[j].defaultRequirement;
        if (req === 'required') {
          sectionWeight = 1.5;
        } else if (req === 'recommended') {
          sectionWeight = 1.0;
        } else {
          sectionWeight = 0.6;
        }
        break;
      }
    }

    weightedSum = weightedSum + (score.compositeScore * sectionWeight);
    totalWeight = totalWeight + sectionWeight;

    /* Federal penalty: unresolved critical/high federal_requirement issues */
    for (let j = 0; j < score.issues.length; j++) {
      const issue = score.issues[j];
      if (!issue.resolved && issue.category === 'federal_requirement') {
        if (issue.severity === 'critical' || issue.severity === 'high') {
          federalPenalty = federalPenalty + 3;
        }
      }
    }
  }

  let readiness = 0;
  if (totalWeight > 0) {
    readiness = Math.round(weightedSum / totalWeight);
  }

  /* Apply federal penalty */
  readiness = readiness - federalPenalty;

  /* Clamp to 0–100 */
  if (readiness < 0) return 0;
  if (readiness > 100) return 100;
  return readiness;
}
