/**
 * ============================================================================
 * CONVERSATION ADAPTER — Request building + response mapping for modal thread
 * ============================================================================
 *
 * PURPOSE: Bridges the PathAdvisor modal conversation UI to the underlying
 * response generation layer. This adapter:
 *
 *   1. Builds grounded request payloads from user follow-ups + Resume Builder context
 *   2. Sends the request through the best available conversation path
 *   3. Maps the response into ConversationMessage format for the thread
 *   4. Attaches action buttons (apply, edit, copy) when appropriate
 *
 * CURRENT STATE: As of this pass, no fully-wired live PathAdvisor conversation
 * API exists on this route. The repo has:
 *   - AdvisorContext (UI orchestration, not chat threads)
 *   - PathAdvisor panel with local Message[] state and stub responses
 *   - /api/pathadvisor/insights (structured insights, not conversation)
 *   - /api/live-advisor/* (job evaluation proxy, not conversation)
 *
 * APPROACH: This adapter implements a DETERMINISTIC RESPONSE GENERATOR that
 * produces contextually grounded replies based on the Resume Builder state.
 * The responses are structured, practical, and action-oriented — not generic.
 *
 * FUTURE: When a real PathAdvisor conversation API is available, replace the
 * body of sendConversationRequest() with an actual fetch call. The adapter
 * boundary isolates the modal from the transport layer, so the modal
 * component will not need changes.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

import type {
  ConversationSendPayload,
  ConversationMessage,
  ConversationAction,
  ConversationMessageKind,
} from '../types/conversation-types';
import {
  createAssistantMessage,
  createErrorMessage,
} from '../types/conversation-types';

// ---------------------------------------------------------------------------
// Public API — send a follow-up and get a grounded response
// ---------------------------------------------------------------------------

/**
 * Send a conversation follow-up and return a grounded assistant response.
 *
 * CURRENT IMPLEMENTATION: Deterministic response generation based on
 * the resume context and user question. Simulates a short processing
 * delay (300–600ms) to feel natural without being sluggish.
 *
 * FUTURE: Replace with actual API call to PathAdvisor conversation
 * endpoint when available. The ConversationSendPayload contains all
 * grounded context needed for a real request.
 *
 * @param payload — The user message + prior thread + resume context.
 * @returns A ConversationMessage with the assistant's reply and any actions.
 * @throws Never — errors are caught and returned as error messages.
 */
export async function sendConversationRequest(
  payload: ConversationSendPayload
): Promise<ConversationMessage> {
  try {
    /* Simulate realistic processing delay so the loading state
     * is visible but not annoyingly long. Real API will have
     * natural latency. */
    await delay(350 + Math.floor(Math.random() * 250));

    /* Route to the appropriate response generator based on the
     * resume context intent and the user's question content. */
    const response = generateGroundedResponse(payload);
    return response;
  } catch (err) {
    /* Catch unexpected errors and return a graceful error message
     * that appears inline in the thread. */
    const errorText = (err !== null && err !== undefined && typeof err === 'object' && 'message' in err)
      ? (err as { message: string }).message
      : 'An unexpected error occurred. Please try again.';
    return createErrorMessage(errorText);
  }
}

// ---------------------------------------------------------------------------
// Deterministic response generator — grounded in resume context
// ---------------------------------------------------------------------------

/**
 * Generate a contextually grounded response based on the user's question
 * and the Resume Builder state. This is NOT a generic chatbot response —
 * it uses the specific issue, section, severity, and suggested fix context
 * to produce practical, actionable guidance.
 *
 * IMPORTANT: This is the deterministic fallback. When a real conversation
 * API is wired, this function can serve as a local fallback for offline
 * or degraded scenarios.
 *
 * Response selection logic:
 *   1. Check if the user's question matches known actionable patterns
 *   2. Check the intent type for context-appropriate guidance
 *   3. Build actions (apply, edit, copy) when applicable
 */
function generateGroundedResponse(
  payload: ConversationSendPayload
): ConversationMessage {
  const ctx = payload.resumeContext;
  const question = payload.userMessage.toLowerCase();

  /* Determine the response content and actions based on the question
   * pattern and the grounded resume context. */

  /* PATTERN: User asks about applying or fixing the issue */
  if (matchesApplyPattern(question)) {
    return buildApplyGuidanceResponse(payload);
  }

  /* PATTERN: User asks for an example or rewrite */
  if (matchesExamplePattern(question)) {
    return buildExampleResponse(payload);
  }

  /* PATTERN: User asks about requirements or why something matters */
  if (matchesRequirementPattern(question)) {
    return buildRequirementExplanationResponse(payload);
  }

  /* PATTERN: User asks what to do next or for prioritization */
  if (matchesPrioritizationPattern(question)) {
    return buildPrioritizationResponse(payload);
  }

  /* DEFAULT: Context-aware follow-up based on the current intent scope */
  return buildContextualFollowUpResponse(payload);
}

// ---------------------------------------------------------------------------
// Pattern matchers — detect user question intent
// ---------------------------------------------------------------------------

/**
 * Check if the user is asking about applying, fixing, or changing content.
 */
function matchesApplyPattern(question: string): boolean {
  const patterns = ['apply', 'fix', 'change', 'update', 'replace', 'how do i fix', 'how to fix'];
  for (let i = 0; i < patterns.length; i++) {
    if (question.indexOf(patterns[i]) !== -1) return true;
  }
  return false;
}

/**
 * Check if the user is asking for an example, sample, or rewrite.
 */
function matchesExamplePattern(question: string): boolean {
  const patterns = ['example', 'sample', 'rewrite', 'stronger', 'better', 'show me', 'write'];
  for (let i = 0; i < patterns.length; i++) {
    if (question.indexOf(patterns[i]) !== -1) return true;
  }
  return false;
}

/**
 * Check if the user is asking about requirements or importance.
 */
function matchesRequirementPattern(question: string): boolean {
  const patterns = ['require', 'why', 'important', 'matter', 'need', 'must', 'mandatory'];
  for (let i = 0; i < patterns.length; i++) {
    if (question.indexOf(patterns[i]) !== -1) return true;
  }
  return false;
}

/**
 * Check if the user is asking about prioritization or next steps.
 */
function matchesPrioritizationPattern(question: string): boolean {
  const patterns = ['priorit', 'first', 'next', 'start', 'order', 'which one', 'most important'];
  for (let i = 0; i < patterns.length; i++) {
    if (question.indexOf(patterns[i]) !== -1) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Response builders — produce grounded, actionable replies
// ---------------------------------------------------------------------------

/**
 * Build a response guiding the user on how to apply a fix.
 * Includes an "Apply suggestion" action when a suggested fix exists.
 */
function buildApplyGuidanceResponse(
  payload: ConversationSendPayload
): ConversationMessage {
  const ctx = payload.resumeContext;
  const actions: ConversationAction[] = [];
  let content = '';

  if (ctx.suggestedFix !== null && ctx.suggestedFix.length > 0) {
    /* A concrete suggestion exists — offer to apply it */
    content = 'PathOS has a suggested change ready for this issue.';

    if (ctx.selectedSection !== null) {
      content = content + ' It targets the ' + formatSectionLabel(ctx.selectedSection) + ' section.';
    }

    content = content + ' You can apply it directly, or edit it first to customize the wording.';

    /* Build apply action */
    actions.push({
      id: 'action-apply-1',
      type: 'apply',
      label: 'Apply suggestion',
      text: ctx.suggestedFix,
      annotationId: ctx.activeCalloutId,
    });

    /* Build edit-first action */
    if (ctx.activeCalloutId !== null) {
      actions.push({
        id: 'action-edit-1',
        type: 'edit',
        label: 'Edit first',
        text: null,
        annotationId: ctx.activeCalloutId,
      });
    }

    /* Build copy action for the suggestion text */
    actions.push({
      id: 'action-copy-1',
      type: 'copy',
      label: 'Copy text',
      text: ctx.suggestedFix,
      annotationId: null,
    });

    return createAssistantMessage(content, 'suggestion', actions);
  }

  /* No concrete suggestion — give guidance on manual fixing */
  content = 'There is no pre-built suggestion for this issue yet.';

  if (ctx.issueCategory === 'missing_field' || ctx.issueCategory === 'federal_requirement') {
    content = content + ' This is a required field — add the missing information directly in the resume document.';
    if (ctx.issueLabel !== null) {
      content = content + ' The issue is: "' + ctx.issueLabel + '".';
    }
    content = content + ' Click on the highlighted area in the document to edit it.';
  } else if (ctx.issueCategory === 'weak_evidence') {
    content = content + ' To strengthen this content, add specific metrics, quantities, or measurable outcomes.';
    content = content + ' For example, replace "managed projects" with "managed 12 concurrent IT modernization projects with a combined budget of $2.4M."';
  } else {
    content = content + ' Review the callout in the document and edit the content directly.';
    if (ctx.issueLabel !== null) {
      content = content + ' Focus on: "' + ctx.issueLabel + '".';
    }
  }

  /* Offer edit action if we have a callout to route to */
  if (ctx.activeCalloutId !== null) {
    actions.push({
      id: 'action-edit-1',
      type: 'edit',
      label: 'Edit in document',
      text: null,
      annotationId: ctx.activeCalloutId,
    });
  }

  return createAssistantMessage(content, 'followup_reply', actions);
}

/**
 * Build a response with an example or rewrite suggestion.
 * Generates context-appropriate example text based on the issue category.
 */
function buildExampleResponse(
  payload: ConversationSendPayload
): ConversationMessage {
  const ctx = payload.resumeContext;
  const actions: ConversationAction[] = [];
  let content = '';

  if (ctx.issueCategory === 'weak_evidence') {
    content = 'Here is a stronger approach for evidence-based content:';
    content = content + '\n\nInstead of vague statements, use the CAR format (Challenge → Action → Result):';
    content = content + '\n• Challenge: What problem or situation did you face?';
    content = content + '\n• Action: What specific steps did you take?';
    content = content + '\n• Result: What measurable outcome did you achieve?';
    content = content + '\n\nExample: "Led the migration of 340 user accounts from legacy Active Directory to Azure AD,';
    content = content + ' completing the project 2 weeks ahead of schedule with zero service interruptions."';
  } else if (ctx.issueCategory === 'keyword_gap') {
    content = 'To close this keyword gap, mirror the language from the target job announcement.';
    if (ctx.targetJobTitle !== null && ctx.targetJobTitle.length > 0) {
      content = content + ' For "' + ctx.targetJobTitle + '", ';
      content = content + 'review the "Duties" and "Qualifications" sections of the announcement.';
    }
    content = content + '\n\nUse the exact terms from the announcement — federal HR screening often matches keywords literally.';
    content = content + ' Include both acronyms and spelled-out forms (e.g. "FISMA / Federal Information Security Modernization Act").';
  } else if (ctx.issueCategory === 'missing_field') {
    content = 'This field is expected for federal resume completeness.';
    if (ctx.issueLabel !== null) {
      content = content + ' The missing item is: "' + ctx.issueLabel + '".';
    }
    content = content + '\n\nFor federal resumes, include: full position title, employer name,';
    content = content + ' start/end dates (month/year), hours per week, salary/grade, and supervisor contact.';
  } else {
    content = 'Here is some guidance for improving this area of your resume:';
    if (ctx.selectedSection !== null) {
      content = content + '\n\nIn the ' + formatSectionLabel(ctx.selectedSection) + ' section,';
      content = content + ' focus on specificity and relevance to the target position.';
    }
    content = content + ' Federal resumes should be detailed and evidence-based — more specific than private-sector resumes.';
  }

  /* If a suggested fix exists, offer it as a copyable action */
  if (ctx.suggestedFix !== null && ctx.suggestedFix.length > 0) {
    actions.push({
      id: 'action-copy-example',
      type: 'copy',
      label: 'Copy suggestion',
      text: ctx.suggestedFix,
      annotationId: null,
    });
  }

  return createAssistantMessage(content, 'followup_reply', actions);
}

/**
 * Build a response explaining requirements and why something matters.
 * Uses the issue category and severity for targeted reasoning.
 */
function buildRequirementExplanationResponse(
  payload: ConversationSendPayload
): ConversationMessage {
  const ctx = payload.resumeContext;
  let content = '';

  if (ctx.issueCategory === 'federal_requirement') {
    content = 'This is a federal hiring requirement — not a suggestion.';
    content = content + ' Federal HR specialists verify these fields during initial screening.';
    content = content + ' Missing federal-specific information can result in your application being';
    content = content + ' marked "ineligible" before a hiring manager sees your resume.';
    if (ctx.issueLabel !== null) {
      content = content + '\n\nSpecifically: "' + ctx.issueLabel + '" must be present and accurate.';
    }
  } else if (ctx.issueCategory === 'missing_field') {
    content = 'This field is expected for a complete federal resume.';
    content = content + ' While not all fields cause immediate disqualification,';
    content = content + ' missing expected information signals an incomplete application';
    content = content + ' and may reduce your score during structured evaluation.';
  } else if (ctx.issueSeverity === 'high' || ctx.issueSeverity === 'critical') {
    content = 'This is flagged as a high-priority issue because it directly affects';
    content = content + ' how HR evaluates your qualifications.';
    if (ctx.targetJobTitle !== null && ctx.targetJobTitle.length > 0) {
      content = content + ' For "' + ctx.targetJobTitle + '",';
      content = content + ' resolving this before submission is strongly recommended.';
    }
  } else {
    content = 'This issue affects the overall quality of your resume.';
    if (ctx.issueSeverity === 'medium') {
      content = content + ' It is not immediately disqualifying but addressing it';
      content = content + ' will strengthen your application.';
    } else {
      content = content + ' Consider addressing it after resolving higher-priority items.';
    }
  }

  if (ctx.sectionHealthPct !== null) {
    content = content + '\n\nSection health is currently at ' + ctx.sectionHealthPct + '%.';
    if (ctx.sectionHealthPct < 60) {
      content = content + ' This section needs significant attention.';
    } else if (ctx.sectionHealthPct < 80) {
      content = content + ' A few targeted fixes will move this to strong.';
    }
  }

  return createAssistantMessage(content, 'followup_reply', []);
}

/**
 * Build a prioritization response — what to fix first and in what order.
 */
function buildPrioritizationResponse(
  payload: ConversationSendPayload
): ConversationMessage {
  const ctx = payload.resumeContext;
  let content = '';

  if (ctx.mode === 'overview') {
    content = 'Here is the recommended fix order for your resume:';
    content = content + '\n\n1. Federal requirements first — missing required fields';
    content = content + ' (hours/week, series/grade, dates) can cause automatic rejection.';
    content = content + '\n2. Missing fields — fill any gaps in expected content.';
    content = content + '\n3. Keyword alignment — mirror the job announcement language.';
    content = content + '\n4. Evidence strength — add metrics and outcomes to existing bullets.';
    content = content + '\n5. Optional enhancements — polish and refinement.';
    if (ctx.overallReadiness !== null) {
      content = content + '\n\nYour overall readiness is ' + ctx.overallReadiness + '%.';
      if (ctx.overallReadiness < 60) {
        content = content + ' Focus on items 1–2 to make the biggest impact.';
      } else if (ctx.overallReadiness < 80) {
        content = content + ' Items 1–3 will push you into the strong range.';
      } else {
        content = content + ' You are in good shape — focus on items 4–5 for final polish.';
      }
    }
  } else {
    /* Section-specific prioritization */
    if (ctx.selectedSection !== null) {
      content = 'In the ' + formatSectionLabel(ctx.selectedSection) + ' section:';
    } else {
      content = 'For this section:';
    }
    content = content + '\n\n1. Resolve any critical or high-severity issues first.';
    content = content + '\n2. Fill missing required fields.';
    content = content + '\n3. Strengthen weak evidence with metrics and outcomes.';
    if (ctx.sectionHealthPct !== null) {
      content = content + '\n\nSection health: ' + ctx.sectionHealthPct + '%.';
    }
    if (ctx.issueLabel !== null) {
      content = content + '\n\nCurrent focus: "' + ctx.issueLabel + '"';
      if (ctx.issueSeverity !== null) {
        content = content + ' (' + ctx.issueSeverity + ' severity).';
      }
    }
  }

  return createAssistantMessage(content, 'followup_reply', []);
}

/**
 * Build a contextual follow-up response when the question does not match
 * a specific pattern. Uses the intent and context to provide relevant
 * guidance rather than a generic "I don't understand" response.
 */
function buildContextualFollowUpResponse(
  payload: ConversationSendPayload
): ConversationMessage {
  const ctx = payload.resumeContext;
  const actions: ConversationAction[] = [];
  let content = '';

  if (ctx.intent === 'why_this_matters' || ctx.intent === 'explain_issue') {
    /* Issue-focused context — give specific issue guidance */
    if (ctx.issueLabel !== null) {
      content = 'Regarding "' + ctx.issueLabel + '"';
      if (ctx.selectedSection !== null) {
        content = content + ' in ' + formatSectionLabel(ctx.selectedSection);
      }
      content = content + ':';
    } else {
      content = 'For this issue:';
    }

    content = content + '\n\nThis is something you can address directly in the resume document.';

    if (ctx.suggestedFix !== null && ctx.suggestedFix.length > 0) {
      content = content + ' PathOS has a suggested change you can review and apply.';
      actions.push({
        id: 'action-apply-ctx',
        type: 'apply',
        label: 'Apply suggestion',
        text: ctx.suggestedFix,
        annotationId: ctx.activeCalloutId,
      });
    } else {
      content = content + ' Click on the callout point in the document to see the exact location.';
      if (ctx.activeCalloutId !== null) {
        actions.push({
          id: 'action-edit-ctx',
          type: 'edit',
          label: 'Edit in document',
          text: null,
          annotationId: ctx.activeCalloutId,
        });
      }
    }

  } else if (ctx.intent === 'explain_section') {
    /* Section-focused context */
    const sectionLabel = ctx.selectedSection !== null
      ? formatSectionLabel(ctx.selectedSection)
      : 'this section';

    content = 'For the ' + sectionLabel + ' section';
    if (ctx.sectionHealthPct !== null) {
      content = content + ' (currently at ' + ctx.sectionHealthPct + '% health)';
    }
    content = content + ':';
    content = content + '\n\nReview the callout points on the document to see specific issues.';
    content = content + ' Each callout can be clicked to expand guidance and apply suggestions.';
    if (ctx.sectionHealthPct !== null && ctx.sectionHealthPct < 60) {
      content = content + '\n\nThis section needs significant work — start with the highest-severity issues.';
    } else if (ctx.sectionHealthPct !== null && ctx.sectionHealthPct < 80) {
      content = content + '\n\nA few targeted improvements will push this section to strong.';
    }

  } else {
    /* Overview or generic context */
    content = 'Here is what I can help with in the Resume Builder:';
    content = content + '\n\n• Ask about a specific issue to understand why it matters';
    content = content + '\n• Ask for examples of stronger content';
    content = content + '\n• Ask what to fix first for prioritization guidance';
    content = content + '\n• Ask how to apply a suggestion';
    if (ctx.overallReadiness !== null) {
      content = content + '\n\nYour resume is currently at ' + ctx.overallReadiness + '% readiness.';
    }
    if (ctx.targetJobTitle !== null && ctx.targetJobTitle.length > 0) {
      content = content + ' Targeting: "' + ctx.targetJobTitle + '".';
    }
  }

  const kind: ConversationMessageKind = actions.length > 0 ? 'suggestion' : 'followup_reply';
  return createAssistantMessage(content, kind, actions);
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Simple delay utility for simulating processing time.
 * Returns a promise that resolves after the specified milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

/**
 * Format a section ID into a human-readable label.
 * Mirrors the logic in explanation-formatter.ts for consistency.
 */
function formatSectionLabel(sectionId: string): string {
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

  /* Fallback: capitalize words separated by hyphens */
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
 * Build a context-appropriate placeholder for the composer based on
 * the current modal scope. Gives the user a hint about what to ask.
 */
export function buildComposerPlaceholder(
  intent: string | null,
  selectedSection: string | null
): string {
  if (intent === 'why_this_matters' || intent === 'explain_issue') {
    return 'Ask about this issue\u2026';
  }
  if (intent === 'explain_section') {
    if (selectedSection !== null) {
      return 'Ask how to improve ' + formatSectionLabel(selectedSection) + '\u2026';
    }
    return 'Ask about this section\u2026';
  }
  if (intent === 'what_to_fix_first') {
    return 'Ask what to fix first\u2026';
  }
  return 'Ask PathAdvisor a question\u2026';
}
