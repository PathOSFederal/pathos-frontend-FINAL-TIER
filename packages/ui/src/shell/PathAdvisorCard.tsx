/**
 * ============================================================================
 * PATH ADVISOR CARD — Single dedicated card for PathAdvisor conversation
 * ============================================================================
 *
 * All messages to/from PathAdvisor render inside this card. Layout:
 * Header -> Context pills -> Conversation window (scroll) -> Composer (pinned).
 * Suggested prompts render as chips above the message list inside the same card.
 * Composer (input + send) is pinned to the bottom of the card.
 *
 * GOVERNED ARCHITECTURE NOTE:
 * The shared dashboard rail has two responsibilities at once:
 * 1. let the user speak to PathAdvisor conversationally
 * 2. keep the governed evidence surface visible and structured
 *
 * This file owns the shell around those two layers. It should feel friendly,
 * but it must never make the conversation itself look like a source of truth.
 * The governed panel remains the evidence surface underneath the conversation.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Sparkles, Eye, Send, Trash2, Settings2, X, Lightbulb, ChevronRight, ChevronDown, MessageSquare } from 'lucide-react';
import { ModuleCard } from '../components/ModuleCard';
import { Tooltip } from '../components/Tooltip';
import { Z_POPOVER } from '../styles/zIndex';
import { usePathAdvisorBriefingStore, isFitBriefing } from '../stores/pathAdvisorBriefingStore';
import { useDashboardHeroDoNowStore } from '../stores/dashboardHeroDoNowStore';
import { PathAdvisorGovernedPanel } from './PathAdvisorGovernedPanel';
import {
  usePathAdvisorContextLogStore,
  getAnchorKeysForScreen,
  getEntriesForAnchor,
  type PathAdvisorContextEntry,
} from '../stores/pathAdvisorContextLogStore';
import { useNav } from '@pathos/adapters';
import type {
  PathAdvisorConversationRequestState,
  PathAdvisorGovernedDraft,
  PathAdvisorGovernedResultState,
} from './pathadvisor-governed-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Single message in the PathAdvisor conversation. */
export interface PathAdvisorMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PathAdvisorCardProps {
  /** Conversation messages (user and assistant) to show in the scroll area. */
  messages: PathAdvisorMessage[];
  /** Suggested prompt strings rendered as chips above the message list. */
  suggestedPrompts: string[];
  /** Called when the user submits the composer (send button or Enter). */
  onSend: (text: string) => void;
  /** Called when the user confirms clearing all visible chat messages. */
  onClearMessages?: () => void;
  /** Whether chat history should be kept on this device. */
  keepHistoryOnDevice?: boolean;
  /** Called when the user toggles local chat history preference. */
  onToggleStorage?: (enabled: boolean) => void;
  /** Optional export action surfaced in the settings menu. */
  onExportMessages?: () => void;
  /** Optional chip label for current view (default "Dashboard"). */
  viewingLabel?: string;
  /** Current screen id for Context Log scope (e.g. 'job-search'). When set, card shows context log entries for this screen and Clear screen. */
  currentScreen?: string;
  /** Optional label above the Do now block (e.g. "From Career & Resume"). When unset, shows "From Today's Focus". */
  briefingLabel?: string;
  /** Optional one-line helper under briefingLabel (e.g. "Select a saved job to get personalized guidance."). */
  briefingHelperText?: string;
  /** Optional rail content: INSIGHT card + NEXT BEST ACTION card (e.g. Career Readiness). When set, these render instead of hero Do now. */
  railContent?: {
    insightBullets: string[];
    nextBestAction: {
      text: string;
      /** Optional bold title shown above the body text. */
      title?: string;
      ctaLabel: string;
      /** When set, renders a secondary skip/dismiss button next to the primary CTA. */
      skipLabel?: string;
    };
    collapsedSectionLabels?: string[];
    /** When true, style NEXT BEST ACTION box with orange outline and accent-tinted background (mockup). */
    highlightNextBestAction?: boolean;
  };
  /** Optional: when user clicks the rail NEXT BEST ACTION button (e.g. Job Search Fix gap CTA). */
  onRailNextBestActionClick?: () => void;
  /** Optional: when user clicks the Skip button on the NEXT BEST ACTION card. */
  onRailSkipClick?: () => void;
  /** Optional: composer input placeholder (e.g. "Ask about saved jobs..."). When unset, default "Ask PathAdvisor...". */
  composerPlaceholder?: string;
  /** Optional: bounded governed PathAdvisor request draft shown in the shared rail. */
  governedDraft?: PathAdvisorGovernedDraft;
  /** Optional: latest governed request state for the shared rail response surface. */
  governedResult?: PathAdvisorGovernedResultState;
  /** Optional: latest conversation request state for the shared governed shell. */
  governedConversationState?: PathAdvisorConversationRequestState;
  /** Optional: called when the bounded governed draft changes. */
  onGovernedDraftChange?: (draft: PathAdvisorGovernedDraft) => void;
  /** Optional: called when the user submits the bounded governed request. */
  onGovernedSubmit?: () => void;
}

// ---------------------------------------------------------------------------
// Context Log entry block (single entry: title, subtitle, sections, CTAs)
// ---------------------------------------------------------------------------

function ContextLogEntryBlock(props: {
  entry: PathAdvisorContextEntry;
  nav: { push: (route: string) => void };
}) {
  const entry = props.entry;
  const nav = props.nav;
  return (
    <div
      className="rounded-[var(--p-radius)] border p-2 text-[11px]"
      style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}
    >
      <p className="font-semibold mb-0.5" style={{ color: 'var(--p-text)' }}>
        {entry.title}
      </p>
      {entry.subtitle !== undefined && entry.subtitle !== '' ? (
        <p className="mb-1.5" style={{ color: 'var(--p-text-muted)' }}>
          {entry.subtitle}
        </p>
      ) : null}
      {entry.sections.map(function (sec, idx) {
        if (sec.title !== undefined && sec.title !== '') {
          return (
            <div key={idx} className="mb-1.5">
              <p className="font-medium mb-0.5" style={{ color: 'var(--p-text-muted)' }}>
                {sec.title}
              </p>
              {sec.lines !== undefined && sec.lines.length > 0
                ? sec.lines.map(function (line, i) {
                    return (
                      <p key={i} className="mb-0.5" style={{ color: 'var(--p-text-dim)' }}>
                        {line}
                      </p>
                    );
                  })
                : null}
              {sec.bullets !== undefined && sec.bullets.length > 0 ? (
                <ul className="list-disc list-inside mt-0.5" style={{ color: 'var(--p-text-dim)' }}>
                  {sec.bullets.map(function (b, i) {
                    return <li key={i}>{b}</li>;
                  })}
                </ul>
              ) : null}
            </div>
          );
        }
        if (sec.lines !== undefined && sec.lines.length > 0) {
          return (
            <div key={idx} className="mb-1.5">
              {sec.lines.map(function (line, i) {
                return (
                  <p key={i} className="mb-0.5" style={{ color: 'var(--p-text-dim)' }}>
                    {line}
                  </p>
                );
              })}
            </div>
          );
        }
        if (sec.bullets !== undefined && sec.bullets.length > 0) {
          return (
            <ul key={idx} className="list-disc list-inside mb-1.5" style={{ color: 'var(--p-text-dim)' }}>
              {sec.bullets.map(function (b, i) {
                return <li key={i}>{b}</li>;
              })}
            </ul>
          );
        }
        return null;
      })}
      {entry.ctas !== undefined && entry.ctas.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2" style={{ borderTop: '1px solid var(--p-border)' }}>
          {entry.ctas.map(function (cta, i) {
            return (
              <button
                key={i}
                type="button"
                className="px-2 py-1 rounded-[var(--p-radius)] text-[11px] font-medium"
                style={{
                  background: 'var(--p-accent)',
                  color: 'var(--p-bg)',
                }}
                onClick={function () {
                  if (cta.action === 'nav' && cta.route !== undefined && cta.route !== '') {
                    nav.push(cta.route);
                  }
                }}
                aria-label={cta.label}
              >
                {cta.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Render a compact conversation surface above the governed evidence panel.
 *
 * Why this exists:
 * The governed panel is valuable, but it should not feel like the entire
 * product. This surface restores the user-facing PathAdvisor conversation entry
 * while keeping the governed panel below as the explicit evidence layer.
 *
 * How it preserves the truth boundary:
 * The messages shown here are conversational framing only. The governed panel
 * still carries the structured truth state, missing inputs, next steps, and
 * metadata. This block makes the rail feel conversational again without
 * flattening the governed output into chat bubbles.
 */
function GovernedConversationSurface(props: {
  messages: PathAdvisorMessage[];
  conversationState: PathAdvisorConversationRequestState | undefined;
  result: PathAdvisorGovernedResultState;
}) {
  const recentMessages =
    props.messages.length > 4 ? props.messages.slice(props.messages.length - 4) : props.messages;

  return (
    <div
      className="px-3 pt-2 pb-1 flex-shrink-0"
      data-testid="pathadvisor-governed-conversation-shell"
    >
      <div
        className="rounded-[var(--p-radius)] border p-3"
        style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
      >
        <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
          Conversation
        </p>
        <p className="text-[12px] mt-2" style={{ color: 'var(--p-text-muted)' }}>
          Ask PathAdvisor about the current governed result. It will explain the result shown below without replacing the governed evidence.
        </p>
        {props.result.response !== null ? (
          <p className="text-[11px] mt-2" style={{ color: 'var(--p-text-dim)' }}>
            Current governed state: {props.result.response.responseState} {props.result.response.domain}
          </p>
        ) : (
          <p className="text-[11px] mt-2" style={{ color: 'var(--p-text-dim)' }}>
            No governed result is loaded yet. The conversation stays bounded and will point you back to the governed request surface when needed.
          </p>
        )}
        {props.conversationState !== undefined && props.conversationState.status === 'loading' ? (
          <div
            className="rounded-[var(--p-radius)] px-3 py-2 mt-3"
            style={{
              background: 'color-mix(in srgb, var(--p-accent) 8%, var(--p-surface2))',
              border: '1px solid color-mix(in srgb, var(--p-accent) 20%, var(--p-border))',
            }}
            data-testid="pathadvisor-conversation-loading"
          >
            <p className="text-[12px]" style={{ color: 'var(--p-text-muted)' }}>
              PathAdvisor is asking the backend conversation layer to explain the current governed result.
            </p>
          </div>
        ) : null}
        {props.conversationState !== undefined && props.conversationState.status === 'error' ? (
          <div
            className="rounded-[var(--p-radius)] px-3 py-2 mt-3"
            style={{
              background: 'color-mix(in srgb, var(--p-danger, #ef4444) 8%, var(--p-surface2))',
              border: '1px solid color-mix(in srgb, var(--p-danger, #ef4444) 20%, var(--p-border))',
            }}
            data-testid="pathadvisor-conversation-error"
          >
            <p className="text-[12px] font-semibold" style={{ color: 'var(--p-text)' }}>
              Technical conversation request failure
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--p-text-muted)' }}>
              {props.conversationState.errorMessage !== null && props.conversationState.errorMessage !== ''
                ? props.conversationState.errorMessage
                : 'PathAdvisor could not load the backend conversation reply.'}
            </p>
          </div>
        ) : null}
        <div className="mt-3 space-y-2">
          {recentMessages.length === 0 ? (
            <div
              className="rounded-[var(--p-radius)] px-3 py-2"
              style={{ background: 'var(--p-surface2)' }}
            >
              <p className="text-[12px]" style={{ color: 'var(--p-text-muted)' }}>
                Start with a short question such as &quot;What does this result mean?&quot; or &quot;What is still missing?&quot;
              </p>
            </div>
          ) : (
            recentMessages.map(function (message, index) {
              const isUser = message.role === 'user';
              return (
                <div
                  key={String(index) + '-' + message.role}
                  className="rounded-[var(--p-radius)] px-3 py-2"
                  style={{
                    background: isUser ? 'color-mix(in srgb, var(--p-accent) 10%, var(--p-surface2))' : 'var(--p-surface2)',
                    border: isUser ? '1px solid color-mix(in srgb, var(--p-accent) 30%, var(--p-border))' : '1px solid var(--p-border)',
                  }}
                >
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
                    {isUser ? 'You' : 'PathAdvisor'}
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: 'var(--p-text)' }}>
                    {message.content}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders the PathAdvisor conversation inside one ModuleCard: header, context
 * pills, scrollable conversation (suggested chips + messages), and pinned composer.
 *
 * Why this file matters:
 * This is the shell that keeps PathAdvisor feeling conversational while still
 * giving the governed response panel a clear, structured place in the same
 * rail. The composer stays available in governed mode, but the governed panel
 * remains visible so the user can always inspect the underlying truth state.
 */
export function PathAdvisorCard(props: PathAdvisorCardProps) {
  const viewing =
    props.viewingLabel !== undefined && props.viewingLabel !== null
      ? props.viewingLabel
      : 'Dashboard';
  const currentScreen = props.currentScreen !== undefined && props.currentScreen !== '' ? props.currentScreen : 'dashboard';

  const [activeTab, setActiveTab] = useState<'guidance' | 'explain' | 'actions' | 'history'>('guidance');
  const [inputValue, setInputValue] = useState('');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [keepHistoryEnabled, setKeepHistoryEnabled] = useState(
    props.keepHistoryOnDevice !== undefined ? props.keepHistoryOnDevice : true
  );
  const [quickQuestionsExpanded, setQuickQuestionsExpanded] = useState(false);
  /** User toggles: which anchors are explicitly expanded (true) or collapsed (false). Active anchor is expanded by default unless user collapsed it. */
  const [expandedAnchorKeys, setExpandedAnchorKeys] = useState<Record<string, boolean>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerActionsRef = useRef<HTMLDivElement>(null);

  const entriesByAnchor = usePathAdvisorContextLogStore(function (s) {
    return s.entriesByAnchor;
  });
  const activeAnchorKey = usePathAdvisorContextLogStore(function (s) {
    return s.activeAnchorKey;
  });
  const clearScreen = usePathAdvisorContextLogStore(function (s) {
    return s.clearScreen;
  });
  const clearAnchor = usePathAdvisorContextLogStore(function (s) {
    return s.clearAnchor;
  });
  const setActiveAnchor = usePathAdvisorContextLogStore(function (s) {
    return s.setActiveAnchor;
  });

  const contextLogAnchorKeys = getAnchorKeysForScreen(entriesByAnchor, currentScreen);
  const hasContextLogEntries = contextLogAnchorKeys.length > 0;

  /** Derived: active anchor is expanded by default; others only if user expanded them. */
  const isAnchorExpanded = function (anchorKey: string): boolean {
    if (anchorKey === activeAnchorKey) {
      return expandedAnchorKeys[anchorKey] !== false;
    }
    return expandedAnchorKeys[anchorKey] === true;
  };

  const briefing = usePathAdvisorBriefingStore(function (s) {
    return s.briefing;
  });
  const isBriefingOpen = usePathAdvisorBriefingStore(function (s) {
    return s.isOpen;
  });
  const closeBriefing = usePathAdvisorBriefingStore(function (s) {
    return s.clearBriefing;
  });
  const heroDoNow = useDashboardHeroDoNowStore(function (s) {
    return s.action;
  });
  const nav = useNav();

  useEffect(
    function () {
      if (props.keepHistoryOnDevice !== undefined) {
        const value = props.keepHistoryOnDevice;
        queueMicrotask(function () { setKeepHistoryEnabled(value); });
      }
    },
    [props.keepHistoryOnDevice]
  );

  function handlePromptClick(prompt: string) {
    setInputValue(prompt);
  }

  function handleSend() {
    const trimmed = inputValue.trim();
    if (trimmed !== '') {
      props.onSend(trimmed);
      setInputValue('');
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSend();
  }

  // Auto-scroll conversation to bottom when new messages are appended.
  useEffect(
    function () {
      const el = scrollContainerRef.current;
      if (el !== null && el !== undefined) {
        el.scrollTop = el.scrollHeight;
      }
    },
    [props.messages.length]
  );

  useEffect(function () {
    function handleDocumentPointerDown(e: MouseEvent) {
      const actionsEl = headerActionsRef.current;
      if (actionsEl !== null && !actionsEl.contains(e.target as Node)) {
        setIsClearConfirmOpen(false);
        setIsSettingsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleDocumentPointerDown);
    return function () {
      document.removeEventListener('mousedown', handleDocumentPointerDown);
    };
  }, []);

  function handleConfirmClear() {
    setIsClearConfirmOpen(false);
    if (props.onClearMessages !== undefined) {
      props.onClearMessages();
    }
  }

  function handleToggleStorage() {
    const nextEnabled = !keepHistoryEnabled;
    setKeepHistoryEnabled(nextEnabled);
    if (props.onToggleStorage !== undefined) {
      props.onToggleStorage(nextEnabled);
    }
  }

  function handleExportMessages() {
    setIsSettingsOpen(false);
    if (props.onExportMessages !== undefined) {
      props.onExportMessages();
    }
  }

  const actionButtonClassName =
    'h-7 w-7 grid place-items-center rounded-[var(--p-radius)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--p-accent)]';

  const headerActions = (
    <div
      ref={headerActionsRef}
      className="relative flex items-center gap-1"
    >
      <div className="relative group">
        <Tooltip
          contentId="pathadvisor-clear-tooltip"
          side="bottom"
          content={
            <>
              <p className="font-semibold" style={{ color: 'var(--p-text)' }}>Clear chat</p>
              <p>Remove current conversation messages from this PathAdvisor view.</p>
            </>
          }
        >
          <button
            type="button"
            className={actionButtonClassName}
            style={{
              background: 'var(--p-surface2)',
              border: '1px solid var(--p-border)',
              color: 'var(--p-text-muted)',
            }}
            aria-label="Clear chat"
            aria-expanded={isClearConfirmOpen}
            onClick={function () {
              setIsSettingsOpen(false);
              setIsClearConfirmOpen(!isClearConfirmOpen);
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
        {isClearConfirmOpen ? (
          <div
            className="absolute right-0 top-full mt-1 w-56 rounded-[var(--p-radius)] border p-2"
            style={{
              background: 'var(--p-surface)',
              borderColor: 'var(--p-border)',
              zIndex: Z_POPOVER,
            }}
          >
            <p className="text-[11px] mb-2" style={{ color: 'var(--p-text-muted)' }}>
              Clear all messages in this chat?
            </p>
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                className="h-7 px-2 rounded-[var(--p-radius)] text-[11px]"
                style={{
                  background: 'var(--p-surface2)',
                  border: '1px solid var(--p-border)',
                  color: 'var(--p-text-muted)',
                }}
                onClick={function () {
                  setIsClearConfirmOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-7 px-2 rounded-[var(--p-radius)] text-[11px]"
                style={{
                  background: 'var(--p-accent)',
                  color: 'var(--p-bg)',
                }}
                onClick={handleConfirmClear}
              >
                Confirm
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative group">
        <Tooltip
          contentId="pathadvisor-settings-tooltip"
          side="bottom"
          content={
            <>
              <p className="font-semibold" style={{ color: 'var(--p-text)' }}>PathAdvisor settings</p>
              <p>Adjust local chat retention and optional export actions.</p>
            </>
          }
        >
          <button
            type="button"
            className={actionButtonClassName}
            style={{
              background: 'var(--p-surface2)',
              border: '1px solid var(--p-border)',
              color: 'var(--p-text-muted)',
            }}
            aria-label="PathAdvisor settings"
            aria-expanded={isSettingsOpen}
            onClick={function () {
              setIsClearConfirmOpen(false);
              setIsSettingsOpen(!isSettingsOpen);
            }}
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
        {isSettingsOpen ? (
          <div
            className="absolute right-0 top-full mt-1 w-64 rounded-[var(--p-radius)] border p-2"
            style={{
              background: 'var(--p-surface)',
              borderColor: 'var(--p-border)',
              zIndex: Z_POPOVER,
            }}
          >
            <button
              type="button"
              className="w-full h-8 px-2 rounded-[var(--p-radius)] flex items-center justify-between text-[12px]"
              style={{
                background: 'var(--p-surface2)',
                border: '1px solid var(--p-border)',
                color: 'var(--p-text)',
              }}
              onClick={handleToggleStorage}
              aria-pressed={keepHistoryEnabled}
            >
              <span>Keep chat history on this device</span>
              <span style={{ color: 'var(--p-text-muted)' }}>
                {keepHistoryEnabled ? 'On' : 'Off'}
              </span>
            </button>
            {props.onExportMessages !== undefined ? (
              <button
                type="button"
                className="w-full h-8 mt-1 px-2 rounded-[var(--p-radius)] text-left text-[12px]"
                style={{
                  background: 'var(--p-surface2)',
                  border: '1px solid var(--p-border)',
                  color: 'var(--p-text)',
                }}
                onClick={handleExportMessages}
              >
                Export chat (JSON)
              </button>
            ) : null}
            {hasContextLogEntries ? (
              <button
                type="button"
                className="w-full h-8 mt-1 px-2 rounded-[var(--p-radius)] text-left text-[12px]"
                style={{
                  background: 'var(--p-surface2)',
                  border: '1px solid var(--p-border)',
                  color: 'var(--p-text-muted)',
                }}
                onClick={function () {
                  setIsSettingsOpen(false);
                  clearScreen(currentScreen);
                }}
              >
                Clear context log
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  const messageList = props.messages;
  const promptList = props.suggestedPrompts;
  const isGovernedMode =
    props.governedDraft !== undefined &&
    props.governedResult !== undefined &&
    props.onGovernedDraftChange !== undefined &&
    props.onGovernedSubmit !== undefined;
  const composerPlaceholder =
    props.composerPlaceholder !== undefined && props.composerPlaceholder !== ''
      ? props.composerPlaceholder
      : isGovernedMode
        ? 'Ask about this governed result...'
        : 'Ask PathAdvisor...';

  return (
    <ModuleCard
      icon={<Sparkles className="w-4 h-4" />}
      title="PathAdvisor AI"
      action={headerActions}
      variant="dense"
      className="h-full flex flex-col min-h-0"
    >
      {/* Wrapper so conversation window can flex and scroll; pills/composer stay fixed. */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Context pill: Viewing only (Privacy pill removed per Day 62 — local-only is in entry content when needed). */}
        <div className="flex flex-wrap gap-1.5 mb-2 flex-shrink-0">
          <span
            className="pathos-context-chip flex items-center gap-1.5 px-2 py-1 text-[12px] font-medium"
            style={{
              background: 'var(--p-surface2)',
              border: '1px solid var(--p-accent-muted)',
              borderRadius: 'var(--p-radius)',
              color: 'var(--p-text-muted)',
            }}
          >
            <Eye className="w-3 h-3 flex-shrink-0" />
            Viewing: {viewing}
          </span>
        </div>

        {/* Canonical workspace tab bar: Guidance / Explain / Actions / History — fixed across all screens. */}
        <div
          className="flex items-center gap-0 mb-3 flex-shrink-0 rounded-[var(--p-radius)] overflow-hidden"
          style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface2)' }}
          role="tablist"
          aria-label="PathAdvisor workspace"
        >
          {(['guidance', 'explain', 'actions', 'history'] as const).map(function (tab) {
            const labels: Record<string, string> = {
              guidance: 'Guidance',
              explain: 'Explain',
              actions: 'Actions',
              history: 'History',
            };
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                className="flex-1 py-1 text-[11px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--p-accent)]"
                style={{
                  background: isActive ? 'var(--p-accent)' : 'transparent',
                  color: isActive ? 'var(--p-bg)' : 'var(--p-text-muted)',
                  borderRight: tab !== 'history' ? '1px solid var(--p-border)' : undefined,
                }}
                onClick={function () { setActiveTab(tab); }}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

      {/* Output window: scrollable area that changes content by active tab. Fixed across all screens. */}
      <div
        ref={scrollContainerRef}
        className="pathos-scroll flex-1 min-h-0 overflow-y-auto rounded-[var(--p-radius)] mb-3 flex flex-col gap-2"
        style={{
          background: 'var(--p-surface2)',
          border: '1px solid var(--p-border)',
        }}
      >
        {/* --- GUIDANCE TAB --- */}
        {/* Briefing card (mockup: "from Saved Jobs" + helper text) when briefingLabel set; shows above railContent. */}
        {activeTab === 'guidance' && !hasContextLogEntries && props.briefingLabel !== undefined && props.briefingLabel !== '' ? (
          <div className="flex-shrink-0 px-3 pt-2">
            <div
              className="rounded-[var(--p-radius)] border p-2.5"
              style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
            >
              <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--p-text-dim)' }}>
                {props.briefingLabel}
              </p>
              {props.briefingHelperText !== undefined && props.briefingHelperText !== '' ? (
                <p className="text-[12px]" style={{ color: 'var(--p-text-muted)' }}>
                  {props.briefingHelperText}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* When Context Log has entries for this screen, skip static rail content (Do now / Insight); log replaces it. */}
        {activeTab === 'guidance' && !hasContextLogEntries && props.railContent !== undefined && props.railContent !== null ? (
          <div className="flex-shrink-0 px-3 pt-2 space-y-3">
            <div
              className="rounded-[var(--p-radius)] border p-2.5"
              style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
            >
              <p className="text-[10px] uppercase tracking-wide mb-1.5 flex items-center gap-1" style={{ color: 'var(--p-text-dim)' }}>
                <Lightbulb className="w-3 h-3" style={{ color: 'var(--p-accent)' }} aria-hidden />
                INSIGHT
              </p>
              <ul className="list-disc list-inside text-[12px] space-y-0.5" style={{ color: 'var(--p-text-muted)' }}>
                {props.railContent.insightBullets.map(function (bullet, i) {
                  return <li key={i}>{bullet}</li>;
                })}
              </ul>
            </div>
            {/* Mockup: when highlightNextBestAction, solid orange background and white text; CTA button darker orange + border. */}
            <div
              className="rounded-[var(--p-radius)] border p-2.5"
              style={
                props.railContent.highlightNextBestAction === true
                  ? {
                      background: 'var(--p-accent)',
                      border: '1px solid color-mix(in srgb, var(--p-accent) 70%, black)',
                      color: 'var(--p-bg)',
                    }
                  : { background: 'var(--p-surface)', borderColor: 'var(--p-border)' }
              }
            >
              <p className="text-[10px] uppercase tracking-wide mb-1.5 flex items-center gap-1"
                style={{ color: props.railContent.highlightNextBestAction === true ? 'var(--p-bg)' : 'var(--p-text-dim)' }}>
                <Lightbulb className="w-3 h-3" aria-hidden />
                NEXT BEST ACTION
              </p>
              {props.railContent.nextBestAction.title !== undefined && props.railContent.nextBestAction.title !== '' ? (
                <p className="text-[13px] font-semibold mb-1"
                  style={{ color: props.railContent.highlightNextBestAction === true ? 'var(--p-bg)' : 'var(--p-text)' }}>
                  {props.railContent.nextBestAction.title}
                </p>
              ) : null}
              <p className="text-[12px] mb-2"
                style={{ color: props.railContent.highlightNextBestAction === true ? 'var(--p-bg)' : 'var(--p-text-muted)' }}>
                {props.railContent.nextBestAction.text}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-[var(--p-radius)] px-3 py-1.5 text-[12px] font-medium transition-colors outline-none hover:opacity-90 active:opacity-95 focus-visible:ring-2 focus-visible:ring-[var(--p-bg)] focus-visible:ring-offset-1"
                  style={
                    props.railContent.highlightNextBestAction === true
                      ? {
                          background: 'color-mix(in srgb, var(--p-accent) 75%, black)',
                          color: 'var(--p-bg)',
                          border: '1px solid var(--p-bg)',
                        }
                      : {
                          background: 'var(--p-accent)',
                          color: 'var(--p-bg)',
                        }
                  }
                  aria-label={props.railContent.nextBestAction.ctaLabel}
                  onClick={props.onRailNextBestActionClick !== undefined ? props.onRailNextBestActionClick : undefined}
                >
                  {props.railContent.nextBestAction.ctaLabel}
                </button>
                {props.railContent.nextBestAction.skipLabel !== undefined && props.railContent.nextBestAction.skipLabel !== '' ? (
                  <button
                    type="button"
                    className="flex-1 rounded-[var(--p-radius)] px-3 py-1.5 text-[12px] font-medium transition-colors outline-none hover:opacity-80 active:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--p-bg)] focus-visible:ring-offset-1"
                    style={
                      props.railContent.highlightNextBestAction === true
                        ? {
                            background: 'transparent',
                            color: 'var(--p-bg)',
                            border: '1px solid color-mix(in srgb, var(--p-bg) 50%, transparent)',
                          }
                        : {
                            background: 'var(--p-surface)',
                            color: 'var(--p-text-muted)',
                            border: '1px solid var(--p-border)',
                          }
                    }
                    aria-label={props.railContent.nextBestAction.skipLabel}
                    onClick={props.onRailSkipClick !== undefined ? props.onRailSkipClick : undefined}
                  >
                    {props.railContent.nextBestAction.skipLabel}
                  </button>
                ) : null}
              </div>
            </div>
            {props.railContent.collapsedSectionLabels !== undefined && props.railContent.collapsedSectionLabels.length > 0
              ? props.railContent.collapsedSectionLabels.map(function (label, i) {
                  return (
                    <button
                      key={i}
                      type="button"
                      className="w-full flex items-center gap-1 text-[12px] text-left py-1"
                      style={{ color: 'var(--p-text-muted)' }}
                    >
                      <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                      {label}
                    </button>
                  );
                })
              : null}
          </div>
        ) : activeTab === 'guidance' && !hasContextLogEntries ? (
          <div className="flex-shrink-0 px-3 pt-2">
            <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--p-text-dim)' }}>
              {props.briefingLabel !== undefined && props.briefingLabel !== ''
                ? props.briefingLabel
                : "From Today's Focus"}
            </p>
            {heroDoNow !== null && heroDoNow !== undefined && heroDoNow.route !== null && heroDoNow.route !== '' ? (
              <button
                type="button"
                onClick={function () {
                  nav.push(heroDoNow.route);
                }}
                className="w-full rounded-[var(--p-radius)] px-3 py-2 text-[12px] font-medium transition-colors hover:opacity-90 flex items-center justify-center gap-1.5"
                style={{
                  background: 'var(--p-accent-bg)',
                  border: '1px solid var(--p-accent-muted)',
                  color: 'var(--p-accent)',
                }}
                aria-label={heroDoNow.label !== null && heroDoNow.label !== '' ? 'Do now: ' + heroDoNow.label : 'Do now'}
              >
                Do now: {heroDoNow.label !== null && heroDoNow.label !== '' ? heroDoNow.label : 'Open'}
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full rounded-[var(--p-radius)] px-3 py-2 text-[12px] font-medium flex items-center justify-center gap-1.5 opacity-60 cursor-not-allowed"
                style={{
                  background: 'var(--p-surface2)',
                  border: '1px solid var(--p-border)',
                  color: 'var(--p-text-muted)',
                }}
                title="No action selected"
                aria-label="No action selected"
              >
                Do now
              </button>
            )}
          </div>
        ) : null}

        {/* Context Log: when this screen has entries, show grouped anchors (collapsible) then Quick questions (collapsed). */}
        {activeTab === 'guidance' && hasContextLogEntries ? (
          <div className="flex flex-col gap-3 px-3 pt-2 pb-2 flex-shrink-0">
            {contextLogAnchorKeys.map(function (anchorKey) {
              const entries = getEntriesForAnchor(entriesByAnchor, anchorKey);
              const firstEntry = entries.length > 0 ? entries[0] : undefined;
              const label = firstEntry !== undefined ? firstEntry.anchor.label : anchorKey;
              const isExpanded = isAnchorExpanded(anchorKey);
              return (
                <div
                  key={anchorKey}
                  className="rounded-[var(--p-radius)] border flex flex-col"
                  style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface)' }}
                >
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[12px] font-medium"
                    style={{ color: 'var(--p-text)' }}
                    onClick={function () {
                      setExpandedAnchorKeys(function (prev) {
                        const next = Object.assign({}, prev);
                        next[anchorKey] = !isExpanded;
                        return next;
                      });
                      if (anchorKey !== activeAnchorKey) {
                        setActiveAnchor(anchorKey);
                      }
                    }}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Collapse ' + label : 'Expand ' + label}
                  >
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--p-text-muted)' }} aria-hidden />
                      {label}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--p-text-muted)' }}>
                      {String(entries.length)} {entries.length === 1 ? 'entry' : 'entries'}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--p-text-muted)' }} aria-hidden />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--p-text-muted)' }} aria-hidden />
                    )}
                  </button>
                  {isExpanded ? (
                    <div className="px-2.5 pb-2 pt-0 space-y-2 border-t" style={{ borderColor: 'var(--p-border)' }}>
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ color: 'var(--p-text-muted)', background: 'var(--p-surface2)', border: '1px solid var(--p-border)' }}
                          onClick={function (e) {
                            e.stopPropagation();
                            clearAnchor(anchorKey);
                          }}
                          aria-label={'Clear this thread: ' + label}
                        >
                          Clear this thread
                        </button>
                      </div>
                      {entries.map(function (entry) {
                        return (
                          <ContextLogEntryBlock key={entry.id} entry={entry} nav={nav} />
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {/* Quick questions: collapsed by default when Context Log is showing. */}
            <div className="border rounded-[var(--p-radius)]" style={{ borderColor: 'var(--p-border)' }}>
              <button
                type="button"
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-[12px]"
                style={{ color: 'var(--p-text-muted)' }}
                onClick={function () {
                  setQuickQuestionsExpanded(!quickQuestionsExpanded);
                }}
                aria-expanded={quickQuestionsExpanded}
                aria-label={quickQuestionsExpanded ? 'Collapse quick questions' : 'Expand quick questions'}
              >
                Quick questions
                {quickQuestionsExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                )}
              </button>
              {quickQuestionsExpanded && promptList.length > 0 ? (
                <div className="p-2 flex flex-wrap gap-1.5 border-t" style={{ borderColor: 'var(--p-border)' }}>
                  {promptList.map(function (prompt) {
                    return (
                      <button
                        key={prompt}
                        type="button"
                        onClick={function () {
                          handlePromptClick(prompt);
                        }}
                        className="pathos-prompt-row px-3 py-1.5 text-[12px] rounded-[var(--p-radius)] transition-colors border"
                        style={{
                          background: 'var(--p-surface2)',
                          borderColor: 'var(--p-border)',
                          color: 'var(--p-text)',
                        }}
                      >
                        {prompt}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* PathAdvisor Briefing: deep explanation opened from Dashboard "Ask PathAdvisor"; above quick prompts. (Only when no Context Log for this screen, Guidance tab.) */}
        {activeTab === 'guidance' && !hasContextLogEntries && briefing !== null && isBriefingOpen ? (
          <div className="flex-shrink-0 px-3 pt-2 pb-2">
            <div
              className="rounded-[var(--p-radius)] border p-3"
              style={{
                background: 'var(--p-surface)',
                borderColor: 'var(--p-border)',
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-[13px]" style={{ color: 'var(--p-text)' }}>
                  {isFitBriefing(briefing) ? 'PathAdvisor Briefing' : (briefing.title !== undefined && briefing.title !== '' ? briefing.title : 'PathAdvisor Briefing')}
                </h3>
                <div className="relative group">
                  <Tooltip
                    contentId="pathadvisor-briefing-close-tooltip"
                    side="bottom"
                    content={
                      <>
                        <p className="font-semibold" style={{ color: 'var(--p-text)' }}>Close briefing</p>
                        <p>Close this briefing and return to the default PathAdvisor view.</p>
                      </>
                    }
                  >
                    <button
                      type="button"
                      onClick={closeBriefing}
                      className="h-6 w-6 grid place-items-center rounded-[var(--p-radius)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--p-accent)]"
                      style={{
                        background: 'var(--p-surface2)',
                        border: '1px solid var(--p-border)',
                        color: 'var(--p-text-muted)',
                      }}
                      aria-label="Close briefing"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </div>
              </div>
              {isFitBriefing(briefing) ? (
                <div className="text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
                  <p className="mb-1 font-medium" style={{ color: 'var(--p-text-muted)' }}>Alignment: {briefing.jobTitle}</p>
                  <p className="mb-1">{briefing.stars} stars · {briefing.confidence} confidence · Effort: {briefing.effort}</p>
                  {briefing.blocker !== undefined && briefing.blocker !== '' ? (
                    <p className="mb-1">Primary blocker: {briefing.blocker}</p>
                  ) : null}
                  {briefing.reasons.length > 0 ? (
                    <ul className="list-disc list-inside mt-1">
                      {briefing.reasons.slice(0, 3).map(function (r, i) {
                        return <li key={i}>{r}</li>;
                      })}
                    </ul>
                  ) : null}
                  {briefing.missingInputs !== undefined && briefing.missingInputs.length > 0 ? (
                    <p className="mt-1">What is missing: {briefing.missingInputs.join(', ')}</p>
                  ) : null}
                  <p className="mt-2 font-medium" style={{ color: 'var(--p-text-muted)' }}>
                    {briefing.isJobSaved ? 'Next: Open Decision Brief or Start Tailoring.' : 'Next: Save + Start Tailoring.'}
                  </p>
                </div>
              ) : (
                <>
                  {briefing.sourceLabel !== undefined && briefing.sourceLabel !== '' ? (
                    <p className="text-[11px] mb-2" style={{ color: 'var(--p-text-dim)' }}>
                      From: {briefing.sourceLabel}
                    </p>
                  ) : null}
                  {briefing.sections.length > 0
                    ? briefing.sections.map(function (sec: { heading: string; body: string }, idx: number) {
                        const isFirst = idx === 0;
                        return (
                          <div key={idx} className={isFirst ? 'pt-0 pb-2' : 'pt-2 pb-2'}>
                            {isFirst ? null : (
                              <div
                                className="mx-4 mb-2 h-px"
                                style={{ background: 'var(--p-border)', opacity: 0.6 }}
                              />
                            )}
                            <p className="text-[11px] font-medium mb-0.5" style={{ color: 'var(--p-text-muted)' }}>
                              {sec.heading}
                            </p>
                            <p className="text-[11px] mt-0" style={{ color: 'var(--p-text-dim)' }}>
                              {sec.body}
                            </p>
                          </div>
                        );
                      })
                    : null}
                  {briefing.primaryCta !== undefined && briefing.primaryCta !== null &&
                   briefing.primaryCta.route !== undefined && briefing.primaryCta.route !== '' ? (
                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--p-border)' }}>
                      <button
                        type="button"
                        onClick={function () {
                          const cta = briefing.primaryCta;
                          if (cta !== undefined && cta !== null && cta.route !== '') {
                            nav.push(cta.route);
                          }
                        }}
                        className="w-full rounded-[var(--p-radius)] px-3 py-1.5 text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--p-accent)]"
                        style={{
                          background: 'var(--p-accent)',
                          color: 'var(--p-bg)',
                        }}
                        aria-label={briefing.primaryCta.label}
                      >
                        {briefing.primaryCta.label}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
            <div
              className="mt-2 mx-0 h-px flex-shrink-0"
              style={{ background: 'var(--p-border)', opacity: 0.7 }}
            />
          </div>
        ) : null}

        {/* Suggested prompts as chips. Guidance tab only; governed mode keeps the
         * explicit composer instead of leaning on static prompt chips. */}
        {activeTab === 'guidance' && !hasContextLogEntries && !isGovernedMode && promptList.length > 0 ? (
          <div className="px-2 pb-2 flex-shrink-0">
            <p className="text-[10px] uppercase tracking-wide mb-1.5 px-1" style={{ color: 'var(--p-text-dim)' }}>
              Quick Prompts
            </p>
            <div className="flex flex-wrap gap-1.5">
              {promptList.map(function (prompt) {
                return (
                  <button
                    key={prompt}
                    type="button"
                    onClick={function () {
                      handlePromptClick(prompt);
                    }}
                    className="pathos-prompt-row px-3 py-1.5 text-[12px] rounded-[var(--p-radius)] transition-colors border"
                    style={{
                      background: 'var(--p-surface)',
                      borderColor: 'var(--p-border)',
                      color: 'var(--p-text)',
                    }}
                  >
                    {prompt}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Governed conversation shell plus governed evidence panel.
         *
         * Why this order matters:
         * The conversation should feel like the entry point again, but the
         * governed panel must still sit in the same view as the evidence layer.
         * The conversation sits above; the structured governed result stays
         * below. */}
        {activeTab === 'guidance' && !hasContextLogEntries && isGovernedMode ? (
          <>
            <GovernedConversationSurface
              messages={messageList}
              conversationState={props.governedConversationState}
              result={props.governedResult as PathAdvisorGovernedResultState}
            />
            <PathAdvisorGovernedPanel
              draft={props.governedDraft as PathAdvisorGovernedDraft}
              result={props.governedResult as PathAdvisorGovernedResultState}
              onDraftChange={props.onGovernedDraftChange as (draft: PathAdvisorGovernedDraft) => void}
              onSubmit={props.onGovernedSubmit as () => void}
            />
          </>
        ) : null}

        {/* --- HISTORY TAB --- */}
        {/* Message list: conversation history shown in History tab. */}
        {activeTab === 'history' ? (
          <div className="px-3 pb-3 flex-1 min-h-0">
            {messageList.length === 0 ? (
              <p className="text-[13px]" style={{ color: 'var(--p-text-muted)' }}>
                No conversation history yet. Ask PathAdvisor a question to get started.
              </p>
            ) : (
              messageList.map(function (msg, index) {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={index}
                    className={'mb-2 text-[13px] ' + (isUser ? 'text-right' : '')}
                    style={{
                      color: isUser ? 'var(--p-text)' : 'var(--p-text-muted)',
                    }}
                  >
                    {msg.content}
                  </div>
                );
              })
            )}
          </div>
        ) : null}

        {/* --- EXPLAIN TAB --- */}
        {activeTab === 'explain' ? (
          <div className="px-3 py-3 flex-shrink-0">
            <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--p-text-dim)' }}>
              Explain
            </p>
            <p className="text-[13px]" style={{ color: 'var(--p-text-muted)' }}>
              PathAdvisor will explain the scoring, signals, and methodology behind your current view.
            </p>
          </div>
        ) : null}

        {/* --- ACTIONS TAB --- */}
        {activeTab === 'actions' ? (
          <div className="px-3 py-3 flex-shrink-0">
            <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--p-text-dim)' }}>
              Actions
            </p>
            <p className="text-[13px]" style={{ color: 'var(--p-text-muted)' }}>
              Recommended next steps and one-click actions for your current context will appear here.
            </p>
          </div>
        ) : null}
      </div>

        {/* Composer: restored for both governed and non-governed surfaces.
         *
         * Why this exists in governed mode:
         * PathAdvisor is still a conversational explanation layer. The bounded
         * governed request form remains in the scroll area as the evidence
         * source, while this composer lets the user ask follow-up questions
         * about the current governed state.
         */}
        <div
          className="flex-shrink-0 pt-3"
          style={{ borderTop: '1px solid var(--p-border)' }}
        >
          {isGovernedMode ? (
            <p className="text-[11px] mb-2" style={{ color: 'var(--p-text-muted)' }}>
              PathAdvisor explains the current governed result. It does not create truth outside the structured response shown above.
            </p>
          ) : null}
          <div
            className="rounded-[var(--p-radius)] px-0 py-0"
          >
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2"
              data-testid={isGovernedMode ? 'pathadvisor-governed-composer' : 'pathadvisor-composer'}
            >
              <div
                className="flex flex-1 min-w-0 h-11 px-3 rounded-[var(--p-radius)] focus-within:ring-2 focus-within:ring-offset-1 focus-within:ring-[var(--p-accent)]"
                style={{
                  background: 'var(--p-surface2)',
                  border: '1px solid var(--p-border)',
                }}
              >
                <input
                  type="text"
                  placeholder={composerPlaceholder}
                  value={inputValue}
                  onChange={function (e) {
                    setInputValue(e.target.value);
                  }}
                  className="flex-1 min-w-0 h-full bg-transparent outline-none border-0"
                  style={{ color: 'var(--p-text)' }}
                  disabled={
                    props.governedConversationState !== undefined &&
                    props.governedConversationState.status === 'loading'
                  }
                />
              </div>
              <button
                type="submit"
                className="flex-shrink-0 h-11 w-11 grid place-items-center rounded-[var(--p-radius)] transition-colors"
                style={{
                  background:
                    props.governedConversationState !== undefined &&
                    props.governedConversationState.status === 'loading'
                      ? 'var(--p-surface)'
                      : 'var(--p-accent)',
                  color:
                    props.governedConversationState !== undefined &&
                    props.governedConversationState.status === 'loading'
                      ? 'var(--p-text-muted)'
                      : 'var(--p-bg)',
                }}
                aria-label="Send"
                disabled={
                  props.governedConversationState !== undefined &&
                  props.governedConversationState.status === 'loading'
                }
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </ModuleCard>
  );
}
