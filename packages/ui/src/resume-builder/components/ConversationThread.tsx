/**
 * ============================================================================
 * CONVERSATION THREAD — Message list renderer for PathAdvisor modal
 * ============================================================================
 *
 * PURPOSE: Renders the list of user follow-up messages and PathAdvisor
 * assistant replies inside the PathAdvisor modal. This is the CONVERSATIONAL
 * layer that appears BELOW the deterministic structured explanation.
 *
 * DESIGN RULES:
 *   - Compact and professional — not a consumer chat bubble UI
 *   - User messages are right-aligned with subtle background
 *   - Assistant messages are left-aligned with no background (inline)
 *   - Action buttons (Apply, Edit, Copy) appear below assistant messages
 *   - Error messages show a warning-colored indicator
 *   - Loading state shows a small animated indicator
 *   - The thread auto-scrolls to newest messages
 *
 * VISUAL HIERARCHY: The conversation thread is SECONDARY to the
 * deterministic explanation above. It should feel like an expansion
 * of the explanation, not a replacement. Small text, muted styling,
 * no flashy decorations.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import { useRef, useEffect, useState } from 'react';
import { User, Sparkles, AlertCircle, Copy, Check, Pencil, CheckCircle2, RefreshCw } from 'lucide-react';
import { INTERACTIVE_HOVER_CLASS } from '../../styles/interactiveHover';
import type {
  ConversationMessage,
  ConversationAction,
  ConversationRequestStatus,
} from '../types/conversation-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConversationThreadProps {
  /** All messages in the conversation thread, chronological order. */
  messages: ConversationMessage[];

  /** Current request status — drives loading indicator visibility. */
  requestStatus: ConversationRequestStatus;

  /** Callback when the user clicks an action button on a message.
   *  The parent routes this through existing builder plumbing. */
  onAction: (action: ConversationAction) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ConversationThread renders the message list inside the PathAdvisor modal.
 * It sits below the deterministic explanation and above the composer.
 *
 * SCROLL BEHAVIOR: Auto-scrolls to the bottom when new messages arrive
 * so the user always sees the latest reply. Uses a ref on the scroll
 * container and scrolls after each message list change.
 *
 * ACCESSIBILITY: Messages use appropriate roles. The thread container
 * is a live region so screen readers announce new messages.
 */
export function ConversationThread(props: ConversationThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll to bottom when messages change or loading state changes */
  useEffect(function () {
    if (scrollRef.current !== null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [props.messages.length, props.requestStatus]);

  /* If no messages and not loading, render nothing — the thread area
   * only appears once the user starts a conversation. */
  if (props.messages.length === 0 && props.requestStatus === 'idle') {
    return null;
  }

  return (
    <div
      ref={scrollRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxHeight: '240px',
        overflowY: 'auto',
        paddingTop: '4px',
      }}
      role="log"
      aria-label="PathAdvisor conversation"
      aria-live="polite"
      data-testid="conversation-thread"
    >
      {/* Render each message in chronological order */}
      {renderMessages(props.messages, props.onAction)}

      {/* Loading indicator — shown when waiting for assistant reply */}
      {props.requestStatus === 'sending' && (
        <LoadingIndicator />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message list renderer
// ---------------------------------------------------------------------------

/**
 * Render the list of messages. Uses an explicit for loop per repo
 * convention (no spread, no for...of in hot paths).
 */
function renderMessages(
  messages: ConversationMessage[],
  onAction: (action: ConversationAction) => void
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'user') {
      nodes.push(<UserMessageBubble key={msg.id} message={msg} />);
    } else if (msg.role === 'assistant') {
      nodes.push(<AssistantMessageBlock key={msg.id} message={msg} onAction={onAction} />);
    } else if (msg.role === 'system' && msg.messageKind === 'error') {
      nodes.push(<ErrorMessageBlock key={msg.id} message={msg} />);
    }
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// User message — compact right-aligned bubble
// ---------------------------------------------------------------------------

/**
 * Renders a user's follow-up question. Compact, right-aligned, with
 * a subtle background to distinguish it from assistant replies.
 * Styled to feel professional — no chat app bubbles with tails.
 */
function UserMessageBubble(props: { message: ConversationMessage }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      data-testid={'conversation-msg-user-' + props.message.id}
    >
      <div
        className="rounded-md"
        style={{
          maxWidth: '85%',
          padding: '8px 12px',
          background: 'color-mix(in srgb, var(--p-accent) 10%, var(--p-surface))',
          border: '1px solid color-mix(in srgb, var(--p-accent) 15%, var(--p-border))',
        }}
      >
        {/* Small role label — "You" with user icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '3px',
          }}
        >
          <User
            className="w-3 h-3 flex-shrink-0"
            style={{ color: 'var(--p-text-dim)' }}
            aria-hidden="true"
          />
          <span
            style={{
              fontSize: '9px',
              fontWeight: 600,
              color: 'var(--p-text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            You
          </span>
        </div>
        {/* Message content */}
        <div
          style={{
            fontSize: '12px',
            lineHeight: '1.55',
            color: 'var(--p-text)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {props.message.content}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assistant message — left-aligned with optional action buttons
// ---------------------------------------------------------------------------

/**
 * Renders a PathAdvisor assistant reply. Left-aligned, no background
 * (or very subtle), with the PathAdvisor Sparkles icon. When the
 * message carries actions, renders small action buttons below the content.
 */
function AssistantMessageBlock(props: {
  message: ConversationMessage;
  onAction: (action: ConversationAction) => void;
}) {
  const msg = props.message;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
      data-testid={'conversation-msg-assistant-' + msg.id}
    >
      {/* Role label — "PathAdvisor" with Sparkles */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <Sparkles
          className="w-3 h-3 flex-shrink-0"
          style={{ color: 'var(--p-accent)' }}
          aria-hidden="true"
        />
        <span
          style={{
            fontSize: '9px',
            fontWeight: 600,
            color: 'var(--p-accent)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          PathAdvisor
        </span>
      </div>

      {/* Message content — supports newlines via pre-wrap */}
      <div
        style={{
          fontSize: '12px',
          lineHeight: '1.65',
          color: 'var(--p-text)',
          paddingLeft: '16px',
          whiteSpace: 'pre-wrap',
        }}
        data-testid="conversation-msg-content"
      >
        {msg.content}
      </div>

      {/* Action buttons — shown when the message carries actionable items */}
      {msg.actions.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            paddingLeft: '16px',
            paddingTop: '2px',
          }}
          data-testid="conversation-msg-actions"
        >
          {renderActionButtons(msg.actions, props.onAction)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error message — inline error indicator
// ---------------------------------------------------------------------------

/**
 * Renders an error message inline in the thread when a conversation
 * request fails. Styled with the danger color to signal the issue
 * without being aggressive.
 */
function ErrorMessageBlock(props: { message: ConversationMessage }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '6px',
        padding: '8px 10px',
        borderRadius: '6px',
        background: 'color-mix(in srgb, var(--p-danger, #ef4444) 6%, var(--p-surface))',
        border: '1px solid color-mix(in srgb, var(--p-danger, #ef4444) 20%, var(--p-border))',
      }}
      data-testid="conversation-msg-error"
      role="alert"
    >
      <AlertCircle
        className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
        style={{ color: 'var(--p-danger, #ef4444)' }}
        aria-hidden="true"
      />
      <div
        style={{
          fontSize: '11px',
          lineHeight: '1.5',
          color: 'var(--p-text-muted)',
        }}
      >
        {props.message.content}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading indicator — shown while waiting for assistant reply
// ---------------------------------------------------------------------------

/**
 * A small, calm loading indicator shown at the bottom of the thread
 * while waiting for PathAdvisor's response. Three pulsing dots to
 * signal activity without being distracting.
 */
function LoadingIndicator() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        paddingLeft: '16px',
      }}
      data-testid="conversation-loading"
      role="status"
      aria-label="PathAdvisor is thinking"
    >
      <Sparkles
        className="w-3 h-3 flex-shrink-0"
        style={{ color: 'var(--p-accent)', opacity: 0.6 }}
        aria-hidden="true"
      />
      <span
        style={{
          fontSize: '11px',
          color: 'var(--p-text-dim)',
          fontStyle: 'italic',
        }}
      >
        PathAdvisor is thinking
      </span>
      <span
        style={{
          display: 'inline-flex',
          gap: '2px',
          marginLeft: '2px',
        }}
      >
        {/* Three pulsing dots */}
        <PulsingDot delay={0} />
        <PulsingDot delay={150} />
        <PulsingDot delay={300} />
      </span>
    </div>
  );
}

/**
 * A single pulsing dot for the loading indicator. Uses CSS animation
 * via inline keyframes fallback (opacity pulse).
 */
function PulsingDot(props: { delay: number }) {
  /* Use a simple opacity toggle on an interval for the pulse effect.
   * This avoids injecting keyframe CSS and keeps the component self-contained. */
  const [visible, setVisible] = useState(true);

  useEffect(function () {
    const interval = setInterval(function () {
      setVisible(function (prev) { return !prev; });
    }, 500);
    /* Offset the initial toggle by the delay */
    const timeout = setTimeout(function () {
      setVisible(false);
    }, props.delay);
    return function () {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [props.delay]);

  return (
    <span
      style={{
        width: '3px',
        height: '3px',
        borderRadius: '50%',
        background: 'var(--p-accent)',
        opacity: visible ? 0.7 : 0.2,
        transition: 'opacity 0.3s ease',
      }}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Action buttons renderer
// ---------------------------------------------------------------------------

/**
 * Render action buttons for a message. Each action gets a small,
 * restrained button styled consistently with the modal's footer buttons.
 * Uses explicit for loop per repo convention.
 */
function renderActionButtons(
  actions: ConversationAction[],
  onAction: (action: ConversationAction) => void
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    nodes.push(
      <ThreadActionButton key={action.id} action={action} onAction={onAction} />
    );
  }
  return nodes;
}

/**
 * A single action button inside a conversation message. Small, compact,
 * with hover and focus-visible states per the Interaction-State Standard.
 *
 * For 'copy' actions, shows a brief "Copied!" confirmation on click.
 */
function ThreadActionButton(props: {
  action: ConversationAction;
  onAction: (action: ConversationAction) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleClick = function () {
    /* For copy actions, also write to clipboard directly */
    if (props.action.type === 'copy' && props.action.text !== null) {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(props.action.text).catch(function () {
          /* Silently fail clipboard write — action callback still fires */
        });
      }
      setCopied(true);
      setTimeout(function () { setCopied(false); }, 1500);
    }
    props.onAction(props.action);
  };

  /* Select the appropriate icon based on action type */
  let icon: React.ReactNode = null;
  if (props.action.type === 'apply') {
    icon = <CheckCircle2 className="w-3 h-3" aria-hidden="true" />;
  } else if (props.action.type === 'edit') {
    icon = <Pencil className="w-3 h-3" aria-hidden="true" />;
  } else if (props.action.type === 'copy') {
    icon = copied
      ? <Check className="w-3 h-3" aria-hidden="true" />
      : <Copy className="w-3 h-3" aria-hidden="true" />;
  } else if (props.action.type === 'rewrite') {
    icon = <RefreshCw className="w-3 h-3" aria-hidden="true" />;
  }

  const label = copied ? 'Copied!' : props.action.label;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={'inline-flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
      style={{
        padding: '3px 8px',
        fontSize: '10px',
        fontWeight: 500,
        color: copied ? 'var(--p-success, #22c55e)' : 'var(--p-text-dim)',
        background: 'transparent',
        border: '1px solid var(--p-border)',
        cursor: 'pointer',
        transition: 'color 0.15s ease, border-color 0.15s ease',
        '--tw-ring-color': 'var(--p-accent)',
      } as React.CSSProperties}
      aria-label={props.action.label}
      data-testid={'conversation-action-' + props.action.type}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
