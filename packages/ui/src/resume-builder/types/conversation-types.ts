/**
 * ============================================================================
 * CONVERSATION TYPES — Message model for PathAdvisor modal thread
 * ============================================================================
 *
 * PURPOSE: Defines the local message model used inside the PathAdvisor
 * modal's conversation thread. This is the state contract for in-modal
 * follow-up conversations that happen BELOW the deterministic explanation.
 *
 * DESIGN SEPARATION:
 *   - The DETERMINISTIC EXPLANATION (What PathOS sees / Why it matters /
 *     What to do next / Suggested change) is rendered from FormattedExplanation
 *     and does NOT use these types.
 *   - The CONVERSATIONAL THREAD (user follow-ups + assistant replies) uses
 *     these types exclusively.
 *
 * This separation keeps the two concerns architecturally distinct:
 *   deterministic engine → explanation-formatter.ts → FormattedExplanation
 *   conversational layer → conversation-adapter.ts → ConversationMessage[]
 *
 * MESSAGE KINDS:
 *   deterministic_explainer: The initial structured explanation (rendered
 *                            separately, but can appear as a system message
 *                            in the thread for context continuity).
 *   followup_reply:         A standard conversational reply from PathAdvisor.
 *   suggestion:             A reply that carries an actionable suggestion
 *                           the user can apply, edit, or copy.
 *   error:                  An error message shown when the conversation
 *                           request fails.
 *
 * ACTION TYPES: When a message carries actions, the user can interact
 * with the response beyond just reading it. Actions reuse existing
 * builder plumbing (handleCalloutAction, inline edit, clipboard).
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

// ---------------------------------------------------------------------------
// Message role — who authored the message
// ---------------------------------------------------------------------------

/**
 * The author of a conversation message.
 *   user:      The human user asking a follow-up.
 *   assistant: PathAdvisor's response.
 *   system:    Internal system messages (context markers, errors).
 */
export type ConversationRole = 'user' | 'assistant' | 'system';

// ---------------------------------------------------------------------------
// Message kind — what type of content the message carries
// ---------------------------------------------------------------------------

/**
 * Classifies what a message contains so the thread renderer can apply
 * appropriate visual treatment and action buttons.
 *
 *   deterministic_explainer: The initial structured explanation block.
 *                            Not typically rendered in the thread (it has
 *                            its own dedicated UI above), but stored for
 *                            context continuity.
 *   followup_reply:          A standard conversational response.
 *   suggestion:              A response that includes a concrete text
 *                            suggestion the user can act on.
 *   error:                   An error indicator shown when a request fails.
 */
export type ConversationMessageKind =
  | 'deterministic_explainer'
  | 'followup_reply'
  | 'suggestion'
  | 'error';

// ---------------------------------------------------------------------------
// Message action — an action button attached to a message
// ---------------------------------------------------------------------------

/**
 * The type of action a message can carry. These map to existing builder
 * plumbing so the user can act directly from a conversation reply.
 *
 *   apply:    Apply a suggested text change to the resume field.
 *             Routes through handleCalloutAction('apply').
 *   edit:     Open inline edit for the relevant field.
 *             Routes through handleCalloutAction('edit-first').
 *   copy:     Copy text to the clipboard.
 *   rewrite:  Request a stronger rewrite (future — sends a follow-up).
 */
export type ConversationActionType = 'apply' | 'edit' | 'copy' | 'rewrite';

/**
 * A single action button attached to a conversation message. The thread
 * renderer shows these as small action buttons below the message content.
 */
export interface ConversationAction {
  /** Unique action ID within this message. */
  id: string;

  /** What kind of action this represents. */
  type: ConversationActionType;

  /** Human-readable label for the button (e.g. "Apply suggestion"). */
  label: string;

  /** The text payload for the action. For 'apply', this is the suggested
   *  replacement text. For 'copy', this is the text to copy. May be null
   *  for actions that do not carry text (e.g. 'edit' just opens the editor). */
  text: string | null;

  /** Optional annotation/callout ID to route through existing plumbing.
   *  When present, apply/edit actions use handleCalloutAction with this ID. */
  annotationId: string | null;
}

// ---------------------------------------------------------------------------
// Conversation message — a single turn in the thread
// ---------------------------------------------------------------------------

/**
 * A single message in the PathAdvisor modal conversation thread.
 * This is the primary data unit rendered in the ConversationThread
 * component.
 *
 * Messages are stored in an array in local component state. They persist
 * while the modal remains open and are cleared on close (or optionally
 * preserved for the session — see ConversationState).
 */
export interface ConversationMessage {
  /** Unique message ID. Generated at creation time. */
  id: string;

  /** Who authored this message. */
  role: ConversationRole;

  /** The message text content. For user messages, this is the raw input.
   *  For assistant messages, this is the formatted response text. */
  content: string;

  /** ISO timestamp string of when the message was created. Optional
   *  because display is compact — timestamps are not always shown. */
  timestamp: string;

  /** What kind of content this message carries. Drives visual treatment
   *  and action button visibility in the thread renderer. */
  messageKind: ConversationMessageKind;

  /** Optional action buttons attached to this message. Only assistant
   *  messages typically carry actions. Empty array means no actions. */
  actions: ConversationAction[];
}

// ---------------------------------------------------------------------------
// Conversation request status — loading/error tracking
// ---------------------------------------------------------------------------

/**
 * Tracks the status of the current conversation request so the UI can
 * show loading spinners and error states.
 *
 *   idle:     No request in flight. Ready for user input.
 *   sending:  A follow-up has been submitted and we are waiting for a reply.
 *   error:    The last request failed. The error message is stored separately.
 */
export type ConversationRequestStatus = 'idle' | 'sending' | 'error';

// ---------------------------------------------------------------------------
// Conversation state — full state model for the modal thread
// ---------------------------------------------------------------------------

/**
 * Complete state model for the PathAdvisor modal conversation. This
 * is the shape managed by the modal component's local state hooks.
 *
 * The modal owns this state. It is not stored in a global store because
 * the conversation is scoped to the modal lifecycle — when the modal
 * closes, the conversation can be cleared or preserved per UX policy.
 */
export interface ConversationState {
  /** All messages in the thread, in chronological order. */
  messages: ConversationMessage[];

  /** Current request status for loading/error UI. */
  requestStatus: ConversationRequestStatus;

  /** Error message from the last failed request. Null when status is
   *  not 'error'. */
  lastError: string | null;
}

// ---------------------------------------------------------------------------
// Conversation send payload — what gets sent to the adapter
// ---------------------------------------------------------------------------

/**
 * The payload sent to the conversation adapter when the user submits
 * a follow-up question. Contains the user's text plus all the grounded
 * context from the Resume Builder so the response is scoped and specific.
 */
export interface ConversationSendPayload {
  /** The user's follow-up question text. */
  userMessage: string;

  /** All prior messages in the thread for context continuity.
   *  The adapter uses these to maintain conversation coherence. */
  priorMessages: ConversationMessage[];

  /** The grounded Resume Builder context that was used to open the modal.
   *  This keeps every follow-up reply scoped to the same issue/section/overview. */
  resumeContext: {
    intent: string;
    mode: string;
    selectedSection: string | null;
    activeCalloutId: string | null;
    issueCategory: string | null;
    issueLabel: string | null;
    issueDescription: string | null;
    issueSeverity: string | null;
    suggestedFix: string | null;
    sectionHealthPct: number | null;
    overallReadiness: number | null;
    targetJobTitle: string | null;
    composedPrompt: string;
  };
}

// ---------------------------------------------------------------------------
// Factory helpers — create messages with consistent structure
// ---------------------------------------------------------------------------

/**
 * Counter for generating unique message IDs within a session.
 * Uses a module-level counter to avoid ID collisions across
 * multiple modal open/close cycles in the same page session.
 */
let messageIdCounter = 0;

/**
 * Generate a unique message ID. Uses a monotonic counter prefixed
 * with the role for debuggability.
 */
export function generateMessageId(role: ConversationRole): string {
  messageIdCounter = messageIdCounter + 1;
  return role + '-' + messageIdCounter + '-' + Date.now();
}

/**
 * Create a user message from the follow-up input text. Sets all fields
 * to appropriate defaults for a user-authored message.
 */
export function createUserMessage(content: string): ConversationMessage {
  return {
    id: generateMessageId('user'),
    role: 'user',
    content: content,
    timestamp: new Date().toISOString(),
    messageKind: 'followup_reply',
    actions: [],
  };
}

/**
 * Create an assistant reply message. The adapter populates the content
 * and optionally attaches actions based on the response.
 */
export function createAssistantMessage(
  content: string,
  kind: ConversationMessageKind,
  actions: ConversationAction[]
): ConversationMessage {
  return {
    id: generateMessageId('assistant'),
    role: 'assistant',
    content: content,
    timestamp: new Date().toISOString(),
    messageKind: kind,
    actions: actions,
  };
}

/**
 * Create an error message shown when a conversation request fails.
 * Displayed inline in the thread so the user sees what happened
 * without a separate error toast.
 */
export function createErrorMessage(errorText: string): ConversationMessage {
  return {
    id: generateMessageId('system'),
    role: 'system',
    content: errorText,
    timestamp: new Date().toISOString(),
    messageKind: 'error',
    actions: [],
  };
}

/**
 * Build the initial conversation state. Called when the modal opens
 * or when the conversation is reset.
 */
export function buildInitialConversationState(): ConversationState {
  return {
    messages: [],
    requestStatus: 'idle',
    lastError: null,
  };
}
