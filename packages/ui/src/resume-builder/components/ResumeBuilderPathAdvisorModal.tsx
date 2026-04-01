/**
 * ============================================================================
 * RESUME BUILDER PATHADVISOR MODAL — Explanation-first conversational surface
 * ============================================================================
 *
 * PURPOSE: This modal provides a focused, structured explanation when the
 * user asks for deeper reasoning from PathAdvisor within the Resume Builder.
 * It is the explanation companion to the document-first builder — the builder
 * diagnoses visually, and this modal explains verbally.
 *
 * MODAL STRUCTURE (updated for conversational support):
 *   Header:      "PathAdvisor" title + context label (section / overview)
 *   Body:        Two architecturally distinct layers:
 *                LAYER 1 — Deterministic explanation (always first):
 *                  1. What PathOS sees
 *                  2. Why it matters
 *                  3. What to do next
 *                  4. Suggested change (when available)
 *                LAYER 2 — Conversational thread (appears after first follow-up):
 *                  - User follow-up messages
 *                  - PathAdvisor contextual replies with actions
 *                  - Loading and error states
 *   Composer:    Always-visible follow-up input (below the body)
 *   Footer:      Actions: Apply suggestion / Edit first / Close
 *
 * ENTRY POINTS: Invoked from 3 trigger levels:
 *   A. Issue-level:    "Why this matters" / callout card triggers
 *   B. Section-level:  "Ask PathAdvisor about this section"
 *   C. Overview-level: "What should I fix first?"
 *
 * All three share one modal with different starting context.
 *
 * CONVERSATION FLOW:
 *   1. Modal opens → deterministic explanation renders immediately
 *   2. User types a follow-up → message appears in thread
 *   3. Adapter sends grounded request → loading indicator shows
 *   4. Response arrives → assistant message renders with actions
 *   5. User can continue asking — turns persist while modal is open
 *   6. On close, conversation state resets
 *
 * ARCHITECTURAL SEPARATION:
 *   - Deterministic explanation: formatExplanation() → FormattedExplanation
 *   - Conversational replies: sendConversationRequest() → ConversationMessage
 *   These are deliberately separate codepaths.
 *
 * DIALOG SEMANTICS: Uses Radix Dialog for accessible modal behavior —
 * focus trap, escape-to-close, overlay click-to-close, ARIA title/description.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Sparkles, X, Lightbulb, Target, ArrowRight, CheckCircle2, Pencil } from 'lucide-react';
import { OVERLAY_ROOT_ID, Z_DIALOG } from '../../styles/zIndex';
import { INTERACTIVE_HOVER_CLASS } from '../../styles/interactiveHover';
import type { PathAdvisorResumeContext } from '../types/pathadvisor-context';
import { formatExplanation, buildModalContextLabel } from '../utils/explanation-formatter';
import type { FormattedExplanation } from '../utils/explanation-formatter';
import type {
  ConversationMessage,
  ConversationAction,
  ConversationState,
  ConversationSendPayload,
} from '../types/conversation-types';
import {
  buildInitialConversationState,
  createUserMessage,
  createErrorMessage,
} from '../types/conversation-types';
import { sendConversationRequest, buildComposerPlaceholder } from '../utils/conversation-adapter';
import { ConversationThread } from './ConversationThread';
import { ConversationComposer } from './ConversationComposer';

// ---------------------------------------------------------------------------
// SSR-safe overlay container lookup (same pattern as FilterGuideDrawer)
// ---------------------------------------------------------------------------

/**
 * Get the DOM element to portal the modal into. Uses the shared
 * overlay root managed by AppShell if available, falling back to
 * document.body. Returns undefined during SSR.
 */
function getOverlayContainer(): HTMLElement | undefined {
  if (typeof document === 'undefined') return undefined;
  const el = document.getElementById(OVERLAY_ROOT_ID);
  return el !== null ? el : document.body;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ResumeBuilderPathAdvisorModalProps {
  /** Controlled open state. When true the modal is visible. */
  open: boolean;

  /** Called when the modal should close. The parent owns the open state. */
  onOpenChange: (open: boolean) => void;

  /** Grounded context from the Resume Builder. Contains everything
   *  needed to render the structured explanation — intent, section,
   *  issue details, suggested fix, readiness score, target job, etc.
   *  When null the modal renders a loading/empty state. */
  context: PathAdvisorResumeContext | null;

  /** Callback when the user clicks "Apply suggestion". The parent
   *  routes this through the existing suggestion application plumbing
   *  (handleCalloutAction with 'apply'). Receives the active callout
   *  ID from the context. */
  onApplySuggestion?: (annotationId: string) => void;

  /** Callback when the user clicks "Edit first". Routes to the inline
   *  editor for the relevant field. Receives the active callout ID. */
  onEditFirst?: (annotationId: string) => void;

  /** Callback when a conversation action is triggered (apply, edit, copy)
   *  from within the conversation thread. Routes through existing builder
   *  plumbing. */
  onConversationAction?: (action: ConversationAction) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ResumeBuilderPathAdvisorModal renders a focused, structured explanation
 * when the user asks PathAdvisor for deeper reasoning about a specific
 * issue, section, or the whole resume. Below the explanation, a
 * conversational thread allows the user to ask follow-up questions
 * and receive grounded, actionable replies.
 *
 * ACCESSIBILITY:
 *   - Uses Radix Dialog which provides native focus trap and escape-close
 *   - ARIA title via Dialog.Title — "PathAdvisor"
 *   - ARIA description via Dialog.Description — the context label
 *   - Close button is keyboard-reachable and labeled
 *   - All action buttons are keyboard-reachable (Tab order)
 *   - Conversation thread is a live region for screen reader announcements
 *   - Composer textarea is keyboard-reachable with Enter to send
 *   - Focus returns to trigger on close (Radix default)
 *
 * VISUAL DESIGN:
 *   - Medium-to-large dialog (max-width ~600px)
 *   - Dark surface using PathOS theme tokens
 *   - Clean section dividers
 *   - Actions clearly separated from reasoning
 *   - Conversation thread is visually secondary to the explanation
 *   - Does not overwhelm with too much copy
 */
export function ResumeBuilderPathAdvisorModal(props: ResumeBuilderPathAdvisorModalProps) {
  /* -----------------------------------------------------------------------
   * CONVERSATION STATE — local to the modal lifecycle.
   * Messages persist while the modal is open and reset on close.
   * This state is SEPARATE from the deterministic explanation above.
   * ----------------------------------------------------------------------- */
  const [conversationState, setConversationState] = useState<ConversationState>(
    buildInitialConversationState()
  );

  /* Reset conversation state when modal closes or context changes.
   * This ensures each modal open starts fresh — the deterministic
   * explanation is always the first thing the user sees. */
  useEffect(function () {
    if (!props.open) {
      setConversationState(buildInitialConversationState());
    }
  }, [props.open]);

  /* Build formatted explanation from context (deterministic layer) */
  let explanation: FormattedExplanation | null = null;
  let contextLabel = 'Resume Builder';
  if (props.context !== null) {
    explanation = formatExplanation(props.context);
    contextLabel = buildModalContextLabel(props.context);
  }

  /* Determine if suggestion actions are available */
  const hasSuggestion = explanation !== null && explanation.hasSuggestion;
  const activeCalloutId = props.context !== null ? props.context.activeCalloutId : null;

  /* Build the composer placeholder based on current context scope */
  const composerPlaceholder = props.context !== null
    ? buildComposerPlaceholder(props.context.intent, props.context.selectedSection)
    : 'Ask PathAdvisor a question\u2026';

  /* -----------------------------------------------------------------------
   * HANDLERS — Apply suggestion, Edit first, Follow-up send
   * ----------------------------------------------------------------------- */

  /** Handle apply suggestion — route through parent callback */
  const handleApply = useCallback(function () {
    if (activeCalloutId !== null && props.onApplySuggestion) {
      props.onApplySuggestion(activeCalloutId);
      props.onOpenChange(false);
    }
  }, [activeCalloutId, props.onApplySuggestion, props.onOpenChange]);

  /** Handle edit first — route through parent callback */
  const handleEditFirst = useCallback(function () {
    if (activeCalloutId !== null && props.onEditFirst) {
      props.onEditFirst(activeCalloutId);
      props.onOpenChange(false);
    }
  }, [activeCalloutId, props.onEditFirst, props.onOpenChange]);

  /**
   * Handle follow-up message send from the composer.
   *
   * FLOW:
   *   1. Create user message → add to thread immediately (optimistic)
   *   2. Build grounded payload from resume context
   *   3. Set requestStatus to 'sending' → loading indicator appears
   *   4. Call conversation adapter → get assistant response
   *   5. Add assistant response to thread → or add error message
   *   6. Set requestStatus back to 'idle' or 'error'
   */
  const handleSendFollowUp = useCallback(function (text: string) {
    if (props.context === null) return;

    /* Step 1: Create user message and add to thread immediately */
    const userMsg = createUserMessage(text);

    /* Step 2: Update state — add user message + set sending status.
     * Use functional update to ensure we get the latest state. */
    setConversationState(function (prev) {
      const updatedMessages: ConversationMessage[] = [];
      for (let i = 0; i < prev.messages.length; i++) {
        updatedMessages.push(prev.messages[i]);
      }
      updatedMessages.push(userMsg);
      return {
        messages: updatedMessages,
        requestStatus: 'sending',
        lastError: null,
      };
    });

    /* Step 3: Build the grounded payload for the conversation adapter.
     * This carries the full resume context + all prior messages so the
     * response remains scoped and specific. */
    const payload: ConversationSendPayload = {
      userMessage: text,
      priorMessages: [],
      resumeContext: {
        intent: props.context.intent,
        mode: props.context.mode,
        selectedSection: props.context.selectedSection,
        activeCalloutId: props.context.activeCalloutId,
        issueCategory: props.context.issueCategory,
        issueLabel: props.context.issueLabel,
        issueDescription: props.context.issueDescription,
        issueSeverity: props.context.issueSeverity,
        suggestedFix: props.context.suggestedFix,
        sectionHealthPct: props.context.sectionHealthPct,
        overallReadiness: props.context.overallReadiness,
        targetJobTitle: props.context.targetJobTitle,
        composedPrompt: props.context.composedPrompt,
      },
    };

    /* We need to capture the current messages for the payload, but we
     * already started the state update. Read from the captured userMsg
     * and build the prior messages array manually. */
    setConversationState(function (prev) {
      /* Attach prior messages to the payload for context continuity */
      const priorMsgs: ConversationMessage[] = [];
      for (let i = 0; i < prev.messages.length; i++) {
        priorMsgs.push(prev.messages[i]);
      }
      payload.priorMessages = priorMsgs;

      /* Return unchanged state — we only needed to read it */
      return prev;
    });

    /* Step 4: Send through the conversation adapter (async) */
    sendConversationRequest(payload).then(function (assistantMsg) {
      /* Step 5: Add assistant response to thread */
      setConversationState(function (prev) {
        const updatedMessages: ConversationMessage[] = [];
        for (let i = 0; i < prev.messages.length; i++) {
          updatedMessages.push(prev.messages[i]);
        }
        updatedMessages.push(assistantMsg);

        /* Check if the response was an error message */
        const isError = assistantMsg.messageKind === 'error';

        return {
          messages: updatedMessages,
          requestStatus: isError ? 'error' : 'idle',
          lastError: isError ? assistantMsg.content : null,
        };
      });
    }).catch(function (err) {
      /* Step 6: Handle unexpected errors */
      const errorText = (err !== null && err !== undefined && typeof err === 'object' && 'message' in err)
        ? (err as { message: string }).message
        : 'Something went wrong. Please try again.';
      const errorMsg = createErrorMessage(errorText);
      setConversationState(function (prev) {
        const updatedMessages: ConversationMessage[] = [];
        for (let i = 0; i < prev.messages.length; i++) {
          updatedMessages.push(prev.messages[i]);
        }
        updatedMessages.push(errorMsg);
        return {
          messages: updatedMessages,
          requestStatus: 'error',
          lastError: errorText,
        };
      });
    });
  }, [props.context]);

  /**
   * Handle action clicks from conversation thread messages.
   * Routes apply/edit through the parent callbacks (same plumbing
   * as the footer buttons). Copy is handled by the thread component.
   */
  const handleConversationAction = useCallback(function (action: ConversationAction) {
    /* Route to parent callback if provided */
    if (props.onConversationAction) {
      props.onConversationAction(action);
    }

    /* Also route apply/edit through the existing modal callbacks
     * so they use the same plumbing as the footer buttons. */
    if (action.type === 'apply' && action.annotationId !== null && props.onApplySuggestion) {
      props.onApplySuggestion(action.annotationId);
      props.onOpenChange(false);
    } else if (action.type === 'edit' && action.annotationId !== null && props.onEditFirst) {
      props.onEditFirst(action.annotationId);
      props.onOpenChange(false);
    }
  }, [props.onConversationAction, props.onApplySuggestion, props.onEditFirst, props.onOpenChange]);

  /* Determine if the conversation thread has content to show */
  const hasConversation = conversationState.messages.length > 0
    || conversationState.requestStatus === 'sending';

  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal container={getOverlayContainer()}>
        {/* OVERLAY — semi-transparent backdrop, click to close.
         *  Uses PathOS consistent dark overlay. */}
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: Z_DIALOG,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(2px)',
            animation: 'fadeIn 0.15s ease',
          }}
          data-testid="pathadvisor-modal-overlay"
        />

        {/* CONTENT — the modal dialog itself. Medium-to-large, centered,
         *  with enough room for explanation + conversation without overwhelming. */}
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: Z_DIALOG + 1,
            width: '92vw',
            maxWidth: '600px',
            maxHeight: '85vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--p-surface, #1a1a2e)',
            border: '1px solid var(--p-border, #2d2d44)',
            borderRadius: 'var(--p-radius-lg, 12px)',
            boxShadow: 'var(--p-shadow-lg, 0 16px 48px rgba(0,0,0,0.3))',
            animation: 'fadeIn 0.2s ease, scaleIn 0.2s ease',
          }}
          onEscapeKeyDown={function () {
            props.onOpenChange(false);
          }}
          data-testid="pathadvisor-modal"
          aria-describedby="pathadvisor-modal-description"
        >
          {/* ============================================================
           *  HEADER — PathAdvisor branding + context label + close button
           * ============================================================ */}
          <div
            style={{
              padding: '16px 20px 12px 20px',
              borderBottom: '1px solid var(--p-border, #2d2d44)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div>
              {/* Title — PathAdvisor branding with Sparkles icon */}
              <Dialog.Title
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--p-text, #e8e8f0)',
                  lineHeight: '1.3',
                }}
              >
                <Sparkles
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: 'var(--p-accent)' }}
                  aria-hidden="true"
                />
                PathAdvisor
              </Dialog.Title>

              {/* Description — context label showing scope.
               *  This serves as the scoped header/context indicator for the thread. */}
              <Dialog.Description
                id="pathadvisor-modal-description"
                style={{
                  margin: '4px 0 0 0',
                  fontSize: '11px',
                  color: 'var(--p-text-dim, #8888aa)',
                  lineHeight: '1.4',
                }}
              >
                {contextLabel}
              </Dialog.Description>
            </div>

            {/* Close button — keyboard reachable, labeled for a11y */}
            <Dialog.Close asChild>
              <button
                type="button"
                className={'rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--p-text-dim, #8888aa)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  '--tw-ring-color': 'var(--p-accent)',
                } as React.CSSProperties}
                aria-label="Close PathAdvisor explanation"
                data-testid="pathadvisor-modal-close"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* ============================================================
           *  BODY — Structured explanation + conversation thread (scrollable)
           * ============================================================ */}
          <div
            style={{
              padding: '16px 20px',
              overflowY: 'auto',
              flex: 1,
            }}
            data-testid="pathadvisor-modal-body"
          >
            {explanation !== null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* =======================================================
                 *  LAYER 1: DETERMINISTIC EXPLANATION (always first)
                 *  This is the structured explainer built from grounded
                 *  context. It renders immediately when the modal opens.
                 *  It does NOT use the conversation types or adapter.
                 * ======================================================= */}

                {/* Context heading — short label above the explanation */}
                {explanation.contextHeading.length > 0 && (
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--p-accent)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                    data-testid="pathadvisor-modal-heading"
                  >
                    {explanation.contextHeading}
                  </div>
                )}

                {/* SECTION 1: What PathOS Sees */}
                <ExplanationSection
                  icon={<Target className="w-3.5 h-3.5" style={{ color: 'var(--p-accent)' }} aria-hidden="true" />}
                  title="What PathOS sees"
                  content={explanation.whatPathOSSees}
                  testId="explanation-what-sees"
                />

                {/* SECTION 2: Why It Matters */}
                <ExplanationSection
                  icon={<Lightbulb className="w-3.5 h-3.5" style={{ color: 'var(--p-warning, #eab308)' }} aria-hidden="true" />}
                  title="Why it matters"
                  content={explanation.whyItMatters}
                  testId="explanation-why-matters"
                />

                {/* SECTION 3: What To Do Next */}
                <ExplanationSection
                  icon={<ArrowRight className="w-3.5 h-3.5" style={{ color: 'var(--p-success, #22c55e)' }} aria-hidden="true" />}
                  title="What to do next"
                  content={explanation.whatToDoNext}
                  testId="explanation-what-next"
                />

                {/* SECTION 4: Suggested Change (conditional) */}
                {hasSuggestion && (
                  <div
                    className="rounded-md"
                    style={{
                      padding: '12px 14px',
                      background: 'color-mix(in srgb, var(--p-accent) 6%, var(--p-surface))',
                      border: '1px solid color-mix(in srgb, var(--p-accent) 20%, var(--p-border))',
                    }}
                    data-testid="explanation-suggested-action"
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '6px',
                      }}
                    >
                      <CheckCircle2
                        className="w-3.5 h-3.5 flex-shrink-0"
                        style={{ color: 'var(--p-accent)' }}
                        aria-hidden="true"
                      />
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--p-accent)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        Suggested change
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        lineHeight: '1.6',
                        color: 'var(--p-text-muted, #b0b0cc)',
                      }}
                    >
                      {explanation.suggestedAction}
                    </div>
                  </div>
                )}

                {/* =======================================================
                 *  LAYER 2: CONVERSATIONAL THREAD (appears after first follow-up)
                 *  This is architecturally separate from the deterministic
                 *  explanation above. It uses ConversationMessage types and
                 *  the conversation adapter for response generation.
                 * ======================================================= */}
                {hasConversation && (
                  <div
                    style={{
                      borderTop: '1px solid var(--p-border, #2d2d44)',
                      paddingTop: '12px',
                    }}
                    data-testid="pathadvisor-conversation-area"
                  >
                    <ConversationThread
                      messages={conversationState.messages}
                      requestStatus={conversationState.requestStatus}
                      onAction={handleConversationAction}
                    />
                  </div>
                )}
              </div>
            ) : (
              /* Empty/loading state when no context is available */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  padding: '32px 0',
                  color: 'var(--p-text-dim)',
                }}
                data-testid="pathadvisor-modal-empty"
              >
                <Sparkles
                  className="w-6 h-6"
                  style={{ color: 'var(--p-text-dim)', opacity: 0.5 }}
                  aria-hidden="true"
                />
                <span style={{ fontSize: '12px' }}>No context available.</span>
              </div>
            )}
          </div>

          {/* ============================================================
           *  COMPOSER — Always-visible follow-up input area
           *  Sits between the scrollable body and the footer.
           *  Only shown when there is context to converse about.
           * ============================================================ */}
          {explanation !== null && (
            <div
              style={{
                padding: '0 20px 8px 20px',
                borderTop: hasConversation ? 'none' : '1px solid var(--p-border, #2d2d44)',
                flexShrink: 0,
              }}
              data-testid="pathadvisor-composer-area"
            >
              <ConversationComposer
                onSend={handleSendFollowUp}
                requestStatus={conversationState.requestStatus}
                placeholder={composerPlaceholder}
                autoFocus={false}
              />
            </div>
          )}

          {/* ============================================================
           *  FOOTER — Action buttons clearly separated from reasoning
           * ============================================================ */}
          <div
            style={{
              padding: '8px 20px 12px 20px',
              borderTop: '1px solid var(--p-border, #2d2d44)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              flexShrink: 0,
              gap: '8px',
            }}
            data-testid="pathadvisor-modal-footer"
          >
            {/* Apply Suggestion — shown only when suggestion exists
             *  and a callout ID is available for routing */}
            {hasSuggestion && activeCalloutId !== null && props.onApplySuggestion && (
              <ModalActionButton
                label="Apply suggestion"
                variant="primary"
                icon={<CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />}
                onClick={handleApply}
                testId="pathadvisor-modal-apply"
              />
            )}

            {/* Edit First — shown only when suggestion exists */}
            {hasSuggestion && activeCalloutId !== null && props.onEditFirst && (
              <ModalActionButton
                label="Edit first"
                variant="secondary"
                icon={<Pencil className="w-3 h-3" aria-hidden="true" />}
                onClick={handleEditFirst}
                testId="pathadvisor-modal-edit-first"
              />
            )}

            {/* Close — always available */}
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded outline-none focus-visible:ring-2 focus-visible:ring-inset"
                style={{
                  padding: '5px 14px',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'var(--p-text-muted)',
                  background: 'var(--p-surface2, #252540)',
                  border: '1px solid var(--p-border)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  '--tw-ring-color': 'var(--p-accent)',
                } as React.CSSProperties}
                data-testid="pathadvisor-modal-close-footer"
              >
                Close
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: ExplanationSection — one structured block in the body
// ---------------------------------------------------------------------------

/**
 * Renders a single explanation section with an icon, title, and content.
 * Consistent visual treatment across all four sections. Compact and
 * readable — not a wall of text.
 */
function ExplanationSection(props: {
  icon: React.ReactNode;
  title: string;
  content: string;
  testId: string;
}) {
  return (
    <div data-testid={props.testId}>
      {/* Section header — icon + title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '4px',
        }}
      >
        {props.icon}
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--p-text-muted, #b0b0cc)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {props.title}
        </span>
      </div>
      {/* Section content — concise reasoning text */}
      <div
        style={{
          fontSize: '12px',
          lineHeight: '1.65',
          color: 'var(--p-text, #e8e8f0)',
          paddingLeft: '22px',
        }}
      >
        {props.content}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: ModalActionButton — primary/secondary action buttons
// ---------------------------------------------------------------------------

/**
 * Action button for the modal footer. Supports two variants:
 *   primary:   accent-colored, visually prominent (Apply suggestion)
 *   secondary: muted, less prominent (Edit first)
 *
 * Both have hover, focus-visible, and active interaction states per
 * the Interaction-State Standard.
 */
function ModalActionButton(props: {
  label: string;
  variant: 'primary' | 'secondary';
  icon?: React.ReactNode;
  onClick: () => void;
  testId: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const isPrimary = props.variant === 'primary';

  /* Compute background based on variant + interaction state */
  let bgColor = isPrimary ? 'var(--p-accent)' : 'transparent';
  let textColor = isPrimary ? 'var(--p-accent-text, #fff)' : 'var(--p-text-muted)';
  let borderColor = isPrimary ? 'var(--p-accent)' : 'var(--p-border)';

  if (isPressed) {
    bgColor = isPrimary
      ? 'color-mix(in srgb, var(--p-accent) 85%, black)'
      : 'color-mix(in srgb, var(--p-accent) 8%, transparent)';
  } else if (isHovered) {
    bgColor = isPrimary
      ? 'color-mix(in srgb, var(--p-accent) 90%, black)'
      : 'color-mix(in srgb, var(--p-accent) 5%, transparent)';
    if (!isPrimary) {
      textColor = 'var(--p-accent)';
      borderColor = 'var(--p-accent)';
    }
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={function () { setIsPressed(true); }}
      onMouseUp={function () { setIsPressed(false); }}
      className="inline-flex items-center gap-1.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-inset"
      style={{
        padding: '5px 12px',
        fontSize: '11px',
        fontWeight: 500,
        color: textColor,
        background: bgColor,
        border: '1px solid ' + borderColor,
        cursor: 'pointer',
        transition: 'color 0.15s ease, background 0.15s ease, border-color 0.15s ease, transform 0.1s ease',
        transform: isPressed ? 'scale(0.97)' : 'scale(1)',
        '--tw-ring-color': 'var(--p-accent)',
      } as React.CSSProperties}
      data-testid={props.testId}
    >
      {props.icon}
      <span>{props.label}</span>
    </button>
  );
}
