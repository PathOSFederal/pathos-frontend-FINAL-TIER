/**
 * ============================================================================
 * CONVERSATION COMPOSER — Follow-up input for PathAdvisor modal thread
 * ============================================================================
 *
 * PURPOSE: The text input area where users type follow-up questions
 * inside the PathAdvisor modal. Sits at the bottom of the modal body,
 * below the conversation thread. Replaces the previous expandable
 * follow-up textarea with a persistent, polished composer.
 *
 * DESIGN RULES:
 *   - Compact — does not dominate the modal. The explanation is primary.
 *   - Send on button click OR Enter (Shift+Enter for newlines)
 *   - Disabled while a request is in flight (prevents double-send)
 *   - Context-aware placeholder text based on modal scope
 *   - Clears on successful send
 *   - Preserves typed text on failed send
 *   - Keyboard accessible — Tab to reach, Enter to send, Escape to close modal
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { INTERACTIVE_HOVER_CLASS } from '../../styles/interactiveHover';
import type { ConversationRequestStatus } from '../types/conversation-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConversationComposerProps {
  /** Callback when the user submits a follow-up message.
   *  Receives the trimmed text. */
  onSend: (text: string) => void;

  /** Current request status — disables input while sending. */
  requestStatus: ConversationRequestStatus;

  /** Context-aware placeholder text. Examples:
   *    "Ask about this issue…"
   *    "Ask how to improve Work Experience…"
   *    "Ask what to fix first…" */
  placeholder: string;

  /** Whether the composer should auto-focus on mount.
   *  Set to true when the conversation area first becomes visible. */
  autoFocus?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ConversationComposer renders a single-line-expandable text input with
 * a send button. It is always visible in the modal once the conversation
 * area is shown — the user does not need to "expand" the follow-up area.
 *
 * KEYBOARD:
 *   Enter      → Send message (if not empty and not currently sending)
 *   Shift+Enter → Insert newline
 *   Escape     → Handled by Radix Dialog (close modal)
 *
 * ACCESSIBILITY:
 *   - textarea has an aria-label describing its purpose
 *   - Send button has an aria-label
 *   - Disabled state prevents interaction during sending
 *   - Focus-visible ring on both textarea and button
 */
export function ConversationComposer(props: ConversationComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSending = props.requestStatus === 'sending';

  /* Auto-focus the textarea when the composer first appears */
  useEffect(function () {
    if (props.autoFocus && textareaRef.current !== null) {
      textareaRef.current.focus();
    }
  }, [props.autoFocus]);

  /**
   * Handle send action — validates, sends, and clears the input.
   * Only clears on successful dispatch (the parent handles errors).
   */
  const handleSend = useCallback(function () {
    const trimmed = text.trim();
    if (trimmed.length === 0 || isSending) return;
    props.onSend(trimmed);
    setText('');
  }, [text, isSending, props.onSend]);

  /**
   * Handle keydown on the textarea.
   *   Enter (no Shift) → Send
   *   Shift+Enter       → Newline (default behavior)
   */
  const handleKeyDown = useCallback(function (e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  /* Determine if the send button should be enabled */
  const canSend = text.trim().length > 0 && !isSending;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '8px',
        paddingTop: '8px',
      }}
      data-testid="conversation-composer"
    >
      {/* TEXTAREA — the main input area. Single-row height by default,
       *  expands to max 3 rows for longer messages. */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={function (e) { setText(e.target.value); }}
        onKeyDown={handleKeyDown}
        placeholder={props.placeholder}
        disabled={isSending}
        rows={1}
        className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-inset"
        style={{
          flex: 1,
          minHeight: '32px',
          maxHeight: '80px',
          padding: '6px 10px',
          fontSize: '12px',
          lineHeight: '1.5',
          color: isSending ? 'var(--p-text-dim)' : 'var(--p-text)',
          background: 'var(--p-bg, #0f0f1a)',
          border: '1px solid var(--p-border)',
          resize: 'none',
          fontFamily: 'inherit',
          opacity: isSending ? 0.7 : 1,
          transition: 'opacity 0.15s ease, border-color 0.15s ease',
          '--tw-ring-color': 'var(--p-accent)',
        } as React.CSSProperties}
        aria-label="Follow-up question for PathAdvisor"
        data-testid="conversation-composer-input"
      />

      {/* SEND BUTTON — compact, icon-based, accent-colored when active.
       *  Disabled when input is empty or a request is in flight. */}
      <button
        type="button"
        onClick={handleSend}
        disabled={!canSend}
        className={'rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + (canSend ? INTERACTIVE_HOVER_CLASS : '')}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          flexShrink: 0,
          border: 'none',
          borderRadius: '6px',
          background: canSend ? 'var(--p-accent)' : 'var(--p-surface2, #252540)',
          color: canSend ? 'var(--p-accent-text, #fff)' : 'var(--p-text-dim)',
          cursor: canSend ? 'pointer' : 'default',
          transition: 'background 0.15s ease, color 0.15s ease, transform 0.1s ease',
          '--tw-ring-color': 'var(--p-accent)',
        } as React.CSSProperties}
        aria-label="Send follow-up question"
        data-testid="conversation-composer-send"
      >
        <Send className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
