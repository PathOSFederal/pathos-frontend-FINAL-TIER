/**
 * ============================================================================
 * PATHADVISOR CONTEXT — Grounded context for on-demand explanations
 * ============================================================================
 *
 * PURPOSE: Defines the payload structure that Resume Builder sends to
 * PathAdvisor when a user clicks an "explain" trigger. This context tells
 * PathAdvisor WHAT the user is looking at so the explanation is specific
 * and grounded, not generic.
 *
 * DESIGN PRINCIPLE: The builder diagnoses visually; PathAdvisor explains
 * verbally. When the user wants deeper reasoning, these triggers carry
 * enough context for PathAdvisor to understand what the user is asking
 * about without forcing the user to re-describe their situation.
 *
 * TRIGGER LEVELS: There are 3 levels of PathAdvisor triggers in the
 * Resume Builder, each carrying progressively broader context:
 *
 *   1. ISSUE-LEVEL:   "Why this matters" on a specific guidance card.
 *      Context includes the exact annotation, its section, and
 *      any suggested fix.
 *
 *   2. SECTION-LEVEL:  "Ask PathAdvisor about this section" on a
 *      section header or rail item. Context includes the section's
 *      health, issue counts, and active callout if any.
 *
 *   3. OVERVIEW-LEVEL: "What should I fix first?" on the Resume
 *      Overview. Context includes overall readiness, top issues
 *      across sections, and the target job.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

// ---------------------------------------------------------------------------
// PathAdvisor trigger intent — what kind of question is the user asking
// ---------------------------------------------------------------------------

/**
 * The kind of explanation the user is requesting. Determines how
 * PathAdvisor frames its response.
 *
 *   why_this_matters:     User wants to understand why a specific
 *                         issue is important for their resume.
 *
 *   explain_section:      User wants a summary of what needs work
 *                         in a specific section.
 *
 *   what_to_fix_first:    User wants prioritization guidance across
 *                         the whole resume.
 *
 *   explain_issue:        User wants deeper detail on a specific
 *                         issue or callout.
 */
export type PathAdvisorTriggerIntent =
  | 'why_this_matters'
  | 'explain_section'
  | 'what_to_fix_first'
  | 'explain_issue';

// ---------------------------------------------------------------------------
// PathAdvisor context payload — everything PathAdvisor needs to respond
// ---------------------------------------------------------------------------

/**
 * The grounded context payload sent to PathAdvisor when a user clicks
 * an explanation trigger. Contains enough information for PathAdvisor
 * to give a specific, contextual response.
 *
 * All fields are optional because different trigger levels carry
 * different amounts of context. An overview-level trigger may not
 * have an active issue, while an issue-level trigger will.
 */
export interface PathAdvisorResumeContext {
  /** Always 'resume-builder' for this screen. */
  screen: 'resume-builder';

  /** What the user is asking PathAdvisor to do. */
  intent: PathAdvisorTriggerIntent;

  /** Current mode: 'overview' or 'section'. */
  mode: 'overview' | 'section';

  /** Selected section ID when in section mode. Null in overview. */
  selectedSection: string | null;

  /** Active issue/callout ID if a specific callout is expanded. */
  activeCalloutId: string | null;

  /** Issue type: the annotation class of the active issue. */
  issueAnnotationClass: string | null;

  /** Issue category from the scoring system (e.g. 'missing_field'). */
  issueCategory: string | null;

  /** Short issue label for context (e.g. "Hours/week missing"). */
  issueLabel: string | null;

  /** Brief issue description for deeper context. */
  issueDescription: string | null;

  /** Issue severity level. */
  issueSeverity: string | null;

  /** Suggested fix text if the annotation carries one. */
  suggestedFix: string | null;

  /** Section health/completion percentage (0–100) for the active section. */
  sectionHealthPct: number | null;

  /** Overall resume readiness score (0–100). */
  overallReadiness: number | null;

  /** Target job title for context (e.g. "IT Specialist GS-12"). */
  targetJobTitle: string | null;

  /** Target job ID for reference. */
  targetJobId: string | null;

  /** A pre-composed prompt string that PathAdvisor can use directly.
   *  Built from the context fields above to give PathAdvisor a
   *  head start on understanding the question. */
  composedPrompt: string;
}

// ---------------------------------------------------------------------------
// Context builder helpers
// ---------------------------------------------------------------------------

/**
 * Build the composed prompt string from context fields. This gives
 * PathAdvisor a natural-language summary of what the user is looking
 * at so it can respond specifically.
 *
 * EXAMPLES:
 *   Issue-level:   "In the Resume Builder, I'm looking at the Work
 *                   Experience section. There's an issue: 'Hours/week
 *                   missing (entry 1)' (Federal Requirement, high
 *                   severity). Why does this matter?"
 *
 *   Section-level: "In the Resume Builder, tell me about the
 *                   Professional Summary section. It's at 60%
 *                   completion."
 *
 *   Overview:      "In the Resume Builder, my resume is at 72%
 *                   readiness for IT Specialist GS-12. What should
 *                   I fix first?"
 */
export function buildPathAdvisorPrompt(ctx: PathAdvisorResumeContext): string {
  const parts: string[] = [];
  parts.push('In the Resume Builder');

  /* Add target job context if available */
  if (ctx.targetJobTitle !== null && ctx.targetJobTitle.length > 0) {
    parts.push('targeting "' + ctx.targetJobTitle + '"');
  }

  /* Add mode/section context */
  if (ctx.mode === 'section' && ctx.selectedSection !== null) {
    parts.push('I\'m in the ' + ctx.selectedSection + ' section');
  } else {
    parts.push('I\'m viewing the full resume overview');
  }

  /* Add section health if available */
  if (ctx.sectionHealthPct !== null) {
    parts.push('(section is at ' + ctx.sectionHealthPct + '% health)');
  }

  /* Add overall readiness if available */
  if (ctx.overallReadiness !== null) {
    parts.push('(overall readiness: ' + ctx.overallReadiness + '%)');
  }

  /* Add issue context if present */
  if (ctx.issueLabel !== null && ctx.issueLabel.length > 0) {
    let issuePart = 'There\'s an issue: "' + ctx.issueLabel + '"';
    if (ctx.issueCategory !== null) {
      issuePart = issuePart + ' (' + ctx.issueCategory + ')';
    }
    if (ctx.issueSeverity !== null) {
      issuePart = issuePart + ' [' + ctx.issueSeverity + ' severity]';
    }
    parts.push(issuePart);
  }

  /* Add suggested fix context */
  if (ctx.suggestedFix !== null && ctx.suggestedFix.length > 0) {
    parts.push('Suggested fix: "' + ctx.suggestedFix.substring(0, 120) + '"');
  }

  /* Add the intent-specific question */
  if (ctx.intent === 'why_this_matters') {
    parts.push('— Why does this matter for my federal resume?');
  } else if (ctx.intent === 'explain_section') {
    parts.push('— What should I focus on in this section?');
  } else if (ctx.intent === 'what_to_fix_first') {
    parts.push('— What should I fix first?');
  } else if (ctx.intent === 'explain_issue') {
    parts.push('— Explain this issue in more detail.');
  }

  return parts.join('. ').replace(/\.\s*\./g, '.').replace(/\.\s*—/g, ' —');
}

// ---------------------------------------------------------------------------
// Trigger label helpers — context-appropriate button labels
// ---------------------------------------------------------------------------

/**
 * Get the appropriate trigger label for a given intent. Labels are
 * short, consistent, and restrained — they are secondary depth
 * triggers, not primary CTAs.
 */
export function getTriggerLabel(intent: PathAdvisorTriggerIntent): string {
  if (intent === 'why_this_matters') return 'Why this matters';
  if (intent === 'explain_section') return 'Ask PathAdvisor';
  if (intent === 'what_to_fix_first') return 'What should I fix first?';
  if (intent === 'explain_issue') return 'Explain this';
  return 'Ask PathAdvisor';
}
