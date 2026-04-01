/**
 * ============================================================================
 * EXPLANATION FORMATTER — Deterministic context-to-modal-section mapper
 * ============================================================================
 *
 * PURPOSE: Maps a grounded PathAdvisorResumeContext into the four structured
 * explanation sections that the PathAdvisor modal renders:
 *
 *   1. whatPathOSSees   — what was detected in the resume
 *   2. whyItMatters     — why this matters for the target job
 *   3. whatToDoNext     — concrete next step
 *   4. suggestedAction  — optional pre-built suggestion if available
 *
 * DESIGN PRINCIPLE: This formatter is DETERMINISTIC. It does not call an LLM.
 * It maps existing context fields into concise, structured blocks using
 * conditional logic. The output is short, practical, and decision-focused —
 * not long prose paragraphs.
 *
 * The modal consumes the formatted output directly. A future pass can replace
 * or augment individual sections with AI-generated content without changing
 * the modal's rendering contract.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

import type { PathAdvisorResumeContext, PathAdvisorTriggerIntent } from '../types/pathadvisor-context';

// ---------------------------------------------------------------------------
// Formatted explanation — output contract for the modal body
// ---------------------------------------------------------------------------

/**
 * Structured explanation output consumed by the PathAdvisor modal.
 * Each field maps to a visible section in the modal body. All fields
 * are always present (never null) so the modal does not need null-checking.
 *
 * Short strings are intentional — the modal should feel concise and
 * decision-focused, not chatty.
 */
export interface FormattedExplanation {
  /** Short heading summarizing the context — displayed at the top of
   *  the modal body before the structured sections. */
  contextHeading: string;

  /** What PathOS detected in the resume. Describes the finding without
   *  judgment. Example: "The Work Experience section is missing
   *  hours-per-week for entry 1." */
  whatPathOSSees: string;

  /** Why this finding matters for the target job / federal hiring.
   *  Example: "Federal HR screens require hours/week to verify
   *  qualifying experience." */
  whyItMatters: string;

  /** Concrete next step the user should take. Example: "Add hours/week
   *  to each experience entry. Full-time is 40 hours/week." */
  whatToDoNext: string;

  /** Optional pre-built suggestion text. When non-empty, the modal
   *  shows an "Apply suggestion" action. Empty string when no
   *  suggestion is available. */
  suggestedAction: string;

  /** Whether a concrete suggestion is available for direct application.
   *  Drives the visibility of Apply / Edit First buttons. */
  hasSuggestion: boolean;
}

// ---------------------------------------------------------------------------
// Modal header context — label shown in the modal header
// ---------------------------------------------------------------------------

/**
 * Build the context label for the modal header. This tells the user
 * what scope the explanation covers. Examples:
 *   "Resume Builder / Work Experience"
 *   "Resume Builder / Resume Overview"
 *   "Resume Builder / Summary"
 */
export function buildModalContextLabel(ctx: PathAdvisorResumeContext): string {
  if (ctx.mode === 'overview') {
    return 'Resume Builder / Resume Overview';
  }
  if (ctx.selectedSection !== null && ctx.selectedSection.length > 0) {
    /* Convert section IDs like "federal-details" to "Federal Details" */
    const formatted = formatSectionName(ctx.selectedSection);
    return 'Resume Builder / ' + formatted;
  }
  return 'Resume Builder';
}

// ---------------------------------------------------------------------------
// Main formatter — maps context to structured explanation sections
// ---------------------------------------------------------------------------

/**
 * Format a PathAdvisorResumeContext into structured explanation sections.
 * This is the primary entry point consumed by the modal component.
 *
 * DETERMINISTIC: Output is built entirely from the context fields using
 * conditional logic. No randomness, no external calls.
 *
 * Each intent type produces different emphasis:
 *   - why_this_matters / explain_issue: focus on the specific issue
 *   - explain_section: focus on section health and improvement areas
 *   - what_to_fix_first: focus on prioritization across the resume
 */
export function formatExplanation(ctx: PathAdvisorResumeContext): FormattedExplanation {
  const intent = ctx.intent;

  if (intent === 'why_this_matters' || intent === 'explain_issue') {
    return formatIssueExplanation(ctx);
  }
  if (intent === 'explain_section') {
    return formatSectionExplanation(ctx);
  }
  if (intent === 'what_to_fix_first') {
    return formatOverviewExplanation(ctx);
  }

  /* Fallback for unknown intents — should not happen with typed intents */
  return formatFallbackExplanation(ctx);
}

// ---------------------------------------------------------------------------
// Issue-level explanation (why_this_matters / explain_issue)
// ---------------------------------------------------------------------------

/**
 * Format an issue-level explanation. The user clicked "Why this matters"
 * or "Explain this" on a specific guidance card or callout.
 *
 * Focus: what the specific issue is, why it matters, what to do about it.
 */
function formatIssueExplanation(ctx: PathAdvisorResumeContext): FormattedExplanation {
  /* Build "What PathOS Sees" — describe the detected issue */
  let whatSees = '';
  if (ctx.issueLabel !== null && ctx.issueLabel.length > 0) {
    whatSees = ctx.issueLabel;
    if (ctx.issueDescription !== null && ctx.issueDescription.length > 0) {
      whatSees = whatSees + '. ' + ctx.issueDescription;
    }
  } else {
    whatSees = 'An issue was detected in this section.';
  }

  /* Prepend section context if we have it */
  if (ctx.selectedSection !== null && ctx.selectedSection.length > 0) {
    const sectionName = formatSectionName(ctx.selectedSection);
    whatSees = 'In ' + sectionName + ': ' + whatSees;
  }

  /* Build "Why It Matters" — explain significance */
  let whyMatters = buildWhyItMatters(ctx);

  /* Build "What To Do Next" — concrete action */
  let nextStep = buildNextStep(ctx);

  /* Suggestion */
  const hasSuggestion = ctx.suggestedFix !== null && ctx.suggestedFix.length > 0;
  const suggestedAction = hasSuggestion ? ctx.suggestedFix as string : '';

  /* Context heading */
  let heading = 'Issue Detail';
  if (ctx.issueCategory !== null && ctx.issueCategory.length > 0) {
    heading = formatSubTypeName(ctx.issueCategory);
  }

  return {
    contextHeading: heading,
    whatPathOSSees: whatSees,
    whyItMatters: whyMatters,
    whatToDoNext: nextStep,
    suggestedAction: suggestedAction,
    hasSuggestion: hasSuggestion,
  };
}

// ---------------------------------------------------------------------------
// Section-level explanation (explain_section)
// ---------------------------------------------------------------------------

/**
 * Format a section-level explanation. The user clicked "Ask PathAdvisor
 * about this section" on a section summary.
 *
 * Focus: overall section health, what needs improvement, where to start.
 */
function formatSectionExplanation(ctx: PathAdvisorResumeContext): FormattedExplanation {
  const sectionName = ctx.selectedSection !== null && ctx.selectedSection.length > 0
    ? formatSectionName(ctx.selectedSection)
    : 'this section';

  /* What PathOS Sees — section health summary */
  let whatSees = sectionName + ' section';
  if (ctx.sectionHealthPct !== null) {
    whatSees = whatSees + ' is at ' + ctx.sectionHealthPct + '% completion';
    if (ctx.sectionHealthPct >= 80) {
      whatSees = whatSees + ' — looking strong.';
    } else if (ctx.sectionHealthPct >= 60) {
      whatSees = whatSees + ' — needs some refinement.';
    } else {
      whatSees = whatSees + ' — needs significant work.';
    }
  } else {
    whatSees = whatSees + ' has items that need attention.';
  }

  /* Why It Matters */
  let whyMatters = '';
  if (ctx.targetJobTitle !== null && ctx.targetJobTitle.length > 0) {
    whyMatters = 'For "' + ctx.targetJobTitle + '", ';
  } else {
    whyMatters = 'For federal resume screening, ';
  }
  whyMatters = whyMatters + buildSectionRelevance(ctx.selectedSection);

  /* What To Do Next */
  let nextStep = 'Click on the callout points in the document to see specific issues. ';
  if (ctx.sectionHealthPct !== null && ctx.sectionHealthPct < 60) {
    nextStep = nextStep + 'Focus on resolving high-severity items first.';
  } else if (ctx.sectionHealthPct !== null && ctx.sectionHealthPct < 80) {
    nextStep = nextStep + 'A few targeted improvements will push this section to strong.';
  } else {
    nextStep = nextStep + 'Review any remaining callouts for final polish.';
  }

  return {
    contextHeading: sectionName + ' Overview',
    whatPathOSSees: whatSees,
    whyItMatters: whyMatters,
    whatToDoNext: nextStep,
    suggestedAction: '',
    hasSuggestion: false,
  };
}

// ---------------------------------------------------------------------------
// Overview-level explanation (what_to_fix_first)
// ---------------------------------------------------------------------------

/**
 * Format an overview-level explanation. The user clicked "What should
 * I fix first?" from the resume overview.
 *
 * Focus: cross-section prioritization, overall readiness, top action.
 */
function formatOverviewExplanation(ctx: PathAdvisorResumeContext): FormattedExplanation {
  /* What PathOS Sees — overall readiness */
  let whatSees = 'Your resume';
  if (ctx.overallReadiness !== null) {
    whatSees = whatSees + ' is at ' + ctx.overallReadiness + '% readiness';
    if (ctx.targetJobTitle !== null && ctx.targetJobTitle.length > 0) {
      whatSees = whatSees + ' for "' + ctx.targetJobTitle + '"';
    }
    whatSees = whatSees + '.';
    if (ctx.overallReadiness >= 80) {
      whatSees = whatSees + ' This is a strong starting point.';
    } else if (ctx.overallReadiness >= 60) {
      whatSees = whatSees + ' There are improvement opportunities.';
    } else {
      whatSees = whatSees + ' Several areas need work before submission.';
    }
  } else {
    whatSees = whatSees + ' is being analyzed. Review the callout points on each section.';
  }

  /* Why It Matters — prioritization rationale */
  let whyMatters = 'Federal HR reviewers screen resumes quickly. ';
  whyMatters = whyMatters + 'Missing required fields can disqualify a resume before content quality is evaluated. ';
  whyMatters = whyMatters + 'Fix structural issues first, then strengthen evidence.';

  /* What To Do Next — prioritized guidance */
  let nextStep = 'Start with sections that show critical or high-severity issues. ';
  nextStep = nextStep + 'Required federal fields (hours/week, series/grade, dates) ';
  nextStep = nextStep + 'should be resolved before refining bullet quality.';

  return {
    contextHeading: 'Resume Prioritization',
    whatPathOSSees: whatSees,
    whyItMatters: whyMatters,
    whatToDoNext: nextStep,
    suggestedAction: '',
    hasSuggestion: false,
  };
}

// ---------------------------------------------------------------------------
// Fallback explanation — generic when intent is unrecognized
// ---------------------------------------------------------------------------

/**
 * Fallback explanation for unrecognized intents. Should not normally
 * be reached with typed intents, but provides a safe default.
 */
function formatFallbackExplanation(ctx: PathAdvisorResumeContext): FormattedExplanation {
  return {
    contextHeading: 'PathAdvisor',
    whatPathOSSees: 'PathOS is analyzing your resume for improvement opportunities.',
    whyItMatters: 'Federal resumes require specific content and formatting to pass HR screening.',
    whatToDoNext: 'Review the callout points on the resume document to see specific issues.',
    suggestedAction: '',
    hasSuggestion: false,
  };
}

// ---------------------------------------------------------------------------
// Helper: build "Why It Matters" text from context
// ---------------------------------------------------------------------------

/**
 * Build the "Why It Matters" block based on issue annotation class,
 * severity, and target job context. Uses the annotation class to
 * give class-appropriate reasoning.
 */
function buildWhyItMatters(ctx: PathAdvisorResumeContext): string {
  let result = '';

  /* Start with target job context */
  if (ctx.targetJobTitle !== null && ctx.targetJobTitle.length > 0) {
    result = 'For "' + ctx.targetJobTitle + '": ';
  }

  /* Add class-specific reasoning */
  const annotationClass = ctx.issueAnnotationClass;
  if (annotationClass === 'evidence') {
    result = result + 'Federal HR reviewers look for quantified outcomes and specific scope. ';
    result = result + 'Vague or unsubstantiated claims are less likely to demonstrate qualifying experience.';
  } else if (annotationClass === 'alignment') {
    result = result + 'This content may not clearly match the target job requirements. ';
    result = result + 'HR may not credit experience that is not explicitly aligned to the announcement.';
  } else if (annotationClass === 'compression') {
    result = result + 'Resume length affects readability and page budget. ';
    result = result + 'Tightening this content creates room for higher-priority information.';
  } else {
    /* No annotation class available — use severity-based reasoning */
    if (ctx.issueSeverity === 'high') {
      result = result + 'This is a high-severity issue that could affect HR screening. ';
      result = result + 'Resolving it should be a priority before submission.';
    } else if (ctx.issueSeverity === 'medium') {
      result = result + 'This issue may weaken the resume but is not immediately disqualifying. ';
      result = result + 'Addressing it will strengthen the overall application.';
    } else {
      result = result + 'This is a lower-priority refinement that can improve resume quality. ';
      result = result + 'Consider addressing it after resolving more critical issues.';
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helper: build "What To Do Next" text from context
// ---------------------------------------------------------------------------

/**
 * Build the "What To Do Next" block. When a suggested fix exists,
 * directs the user toward applying it. Otherwise gives a general
 * action step based on the annotation class.
 */
function buildNextStep(ctx: PathAdvisorResumeContext): string {
  /* If there's a concrete suggestion, point to it */
  if (ctx.suggestedFix !== null && ctx.suggestedFix.length > 0) {
    return 'PathOS has a suggested change you can apply directly or edit first. Review the suggestion below.';
  }

  /* Class-specific next steps */
  const annotationClass = ctx.issueAnnotationClass;
  if (annotationClass === 'evidence') {
    return 'Add specific metrics, numbers, or outcomes. Replace vague phrases with quantified results. Example: "Managed a team" → "Managed a team of 12 across 3 locations."';
  }
  if (annotationClass === 'alignment') {
    return 'Review the target job announcement for required keywords and qualifications. Mirror the language used in the announcement.';
  }
  if (annotationClass === 'compression') {
    return 'Tighten this content by removing filler phrases, combining overlapping bullets, or removing low-priority entries.';
  }

  /* Generic fallback */
  return 'Click on the callout point in the document to see the specific location, then edit the content directly.';
}

// ---------------------------------------------------------------------------
// Helper: build section relevance text
// ---------------------------------------------------------------------------

/**
 * Build a relevance statement for a given section. Describes why the
 * section matters for federal hiring without being generic.
 */
function buildSectionRelevance(sectionId: string | null): string {
  if (sectionId === null) {
    return 'this section contributes to overall resume effectiveness.';
  }

  if (sectionId === 'summary' || sectionId === 'identity-summary') {
    return 'the professional summary is often the first thing reviewers read. A strong opening creates a positive first impression.';
  }
  if (sectionId === 'experience') {
    return 'work experience is the primary evidence of qualifying experience. Each bullet should demonstrate relevant scope, impact, and quantified outcomes.';
  }
  if (sectionId === 'education') {
    return 'education requirements are often minimum qualifications. Missing or incomplete entries can disqualify an application.';
  }
  if (sectionId === 'skills') {
    return 'the skills section helps with keyword matching. Include specific tools, technologies, and competencies from the job announcement.';
  }
  if (sectionId === 'federal-details') {
    return 'federal detail fields (series, grade, hours/week, dates) are required for eligibility determination. Missing fields can result in disqualification.';
  }
  if (sectionId === 'certifications') {
    return 'certifications validate specialized qualifications. Include relevant licenses, clearances, and professional certifications.';
  }
  if (sectionId === 'supporting-evidence') {
    return 'supporting evidence strengthens claims made elsewhere in the resume. Awards, publications, and volunteer work add credibility.';
  }

  return 'this section contributes to overall resume quality and HR screening readiness.';
}

// ---------------------------------------------------------------------------
// Helper: format section ID into display name
// ---------------------------------------------------------------------------

/**
 * Convert a section ID like "federal-details" into a display name
 * like "Federal Details". Handles known section IDs explicitly and
 * falls back to capitalizing words separated by hyphens.
 */
function formatSectionName(sectionId: string): string {
  /* Known section IDs with their preferred display names */
  if (sectionId === 'contact') return 'Contact Information';
  if (sectionId === 'summary') return 'Professional Summary';
  if (sectionId === 'identity-summary') return 'Identity Summary';
  if (sectionId === 'experience') return 'Work Experience';
  if (sectionId === 'education') return 'Education';
  if (sectionId === 'skills') return 'Skills';
  if (sectionId === 'federal-details') return 'Federal Details';
  if (sectionId === 'certifications') return 'Certifications';
  if (sectionId === 'supporting-evidence') return 'Supporting Evidence';
  if (sectionId === 'resume-overview') return 'Resume Overview';

  /* Fallback: capitalize each word separated by hyphens */
  const parts = sectionId.split('-');
  const capitalized: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.length > 0) {
      capitalized.push(part.charAt(0).toUpperCase() + part.slice(1));
    }
  }
  return capitalized.join(' ');
}

/**
 * Convert an annotation sub-type like "missing-metrics" into a
 * display name like "Missing Metrics". Uses the same word-splitting
 * logic as formatSectionName.
 */
function formatSubTypeName(subType: string): string {
  const parts = subType.split('-');
  const capitalized: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.length > 0) {
      capitalized.push(part.charAt(0).toUpperCase() + part.slice(1));
    }
  }
  if (capitalized.length === 0) return 'Issue Detail';
  return capitalized.join(' ');
}
