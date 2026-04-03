/**
 * ============================================================================
 * DASHBOARD SCREEN — PathAdvisor-Centered Conversation Workspace
 * ============================================================================
 *
 * WHY THIS FILE EXISTS:
 * This is the main content component for the /dashboard route. It replaces
 * the old "Command Center" card-grid layout with a conversation-first UX
 * where PathAdvisor is the center of gravity. The app shell (sidebar, top bar)
 * is provided by SharedAppShell via SharedDashboardRouteShell — this file
 * only owns the main content canvas.
 *
 * WHY THE CHANGE:
 * The prior dashboard felt like a wall of cards. The new design feels like a
 * calm, guided decision workspace. Users ask PathAdvisor a question; the
 * answer comes back conversationally, followed by structured governed evidence
 * and actionable next steps. Compact status chips carry the summary load that
 * previously required four briefing tiles and multiple card sections.
 *
 * ARCHITECTURE FIT:
 * - Lives in packages/ui (shared, transport-agnostic — no next/* imports).
 * - Consumed by app/(shared)/dashboard/page.tsx via SharedDashboardRouteShell.
 * - The dashboard route now passes hideAdvisor to the shell so the right-rail
 *   PathAdvisor is suppressed. PathAdvisor IS the main canvas, not a sidebar.
 * - Thread state is local (useState) with seeded demo data for this slice.
 *   Real runtime data from the governed API replaces it cleanly later.
 *
 * COMPONENT BREAKDOWN:
 * - CompactSummaryChips: clickable status pills near the top
 * - PathAdvisorEmptyState: centered hero with input + prompt chips
 * - ConversationThread: the active thread view
 * - UserMessageBubble: right-aligned user message
 * - PathAdvisorResponseBlock: unified response composition
 * - VerdictStrip: Decision / Confidence / Band
 * - GroundedReasonsSection: evidence bullet list
 * - TopGapsSection: restrained inline pills
 * - RecommendedNextStepBlock: highlighted guidance within flow
 * - ResponseActionButtons: primary + secondary actions
 * - ThreadFollowUpInput: continuation input below thread
 * - TrustNote: subtle governance attribution
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 *
 * KEY DECISIONS:
 * - Inline styles with var(--p-*) tokens for all colors (no hardcoded hex).
 * - Tailwind utility classes for layout (flex, grid, spacing).
 * - No ModuleCard or card-grid patterns — the response is one fluid composition.
 * - Thread state is an array of ThreadMessage objects; governed data attaches
 *   to assistant messages. This structure supports future multi-turn threads.
 * - Seeded demo response uses the approved GS-13 competitiveness scenario.
 * - Max-width ~860px for readable conversation canvas (not full enterprise width).
 *
 * REPO RULES OBSERVED:
 * - No var (const/let only).
 * - No ?. (explicit null checks).
 * - No ?? (explicit ternaries).
 * - No ... (spread) — explicit array/object construction.
 * - Over-commented with teaching-level headers.
 * - Token-only colors via var(--p-*).
 * - Interaction states: hover, focus-visible, active per house rules.
 */

'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Sparkles,
  Send,
  CheckCircle2,
  Bookmark,
  FileText,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';
import { useNav } from '@pathos/adapters';
import { usePathAdvisorScreenOverridesStore } from '../stores/pathAdvisorScreenOverridesStore';
import { usePathAdvisorThreadStore } from '../stores/pathAdvisorThreadStore';
import { INTERACTIVE_HOVER_CLASS } from '../styles/interactiveHover';
import {
  CAREER_READINESS,
  SAVED_JOBS,
  IMPORT,
  RESUME_BUILDER,
} from '../routes/routes';


// ============================================================================
// TYPES — Thread model, governed response, compact summary
// ============================================================================
//
// These types define the data contract for the PathAdvisor conversation thread.
// They are intentionally separate from the old DashboardData type (which drove
// the card-grid layout). This lets us evolve the conversation model without
// dragging legacy card shapes along.
//
// Exported so consumers (tests, future stores, adapters) can work with them.

/**
 * A single message in the PathAdvisor conversation thread.
 *
 * HOW IT WORKS:
 * - role 'user' renders as a right-aligned message bubble
 * - role 'assistant' renders as a left-aligned response, optionally with
 *   structured governed evidence attached
 *
 * WHY governed is optional:
 * Not every assistant response has structured evidence. A purely
 * conversational follow-up (e.g. "Can you clarify?") won't include
 * governed data. The UI conditionally renders the evidence sections
 * only when governed data is present.
 */
export interface ThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Structured governed evidence; present only on qualifying assistant responses. */
  governed: GovernedResponseData | null;
}

/**
 * Structured governed evidence attached to a PathAdvisor response.
 *
 * WHY THIS SHAPE:
 * Mirrors the approved mockup: a verdict strip (decision + confidence + band),
 * grounded reasons, top gaps, and a recommended next step — all inside one
 * unified response block. Actions map to buttons at the bottom.
 *
 * decisionVariant drives the verdict strip color:
 * - 'positive' → var(--p-success) (green)
 * - 'caution'  → var(--p-warning) (amber)
 * - 'negative' → var(--p-danger)  (red)
 */
export interface GovernedResponseData {
  decision: string;
  decisionVariant: 'positive' | 'caution' | 'negative';
  confidence: string;
  band: string;
  groundedReasons: string[];
  topGaps: string[];
  recommendedNextStep: {
    label: string;
    estimatedImpact: string;
    estimatedTime: string;
  };
  actions: Array<{
    label: string;
    variant: 'primary' | 'secondary';
    actionId: string;
  }>;
}

/**
 * Compact status data displayed as clickable chips above the conversation.
 *
 * WHY COMPACT:
 * The old dashboard had four briefing tiles taking up significant vertical
 * space. These chips carry the same status signal in a single row, letting
 * PathAdvisor own the main canvas space.
 */
export interface CompactSummary {
  readinessScore: number;
  savedJobsCount: number;
  applicationsCount: number;
  lastUpdated: string;
}

/**
 * Props for the redesigned DashboardScreen.
 *
 * DESIGN NOTE:
 * Callbacks are optional so the component works in both Next (router.push)
 * and Desktop (electron IPC) contexts without coupling. The page.tsx layer
 * provides the actual navigation implementation.
 */
export interface DashboardScreenProps {
  /** Compact summary for status chips. Falls back to built-in demo data. */
  summary?: CompactSummary;
  /** Called when the user clicks "Start improvement" action. */
  onStartImprovement?: () => void;
  /** Called when the user clicks "Open Resume Builder" action. */
  onOpenResumeBuilder?: () => void;
  /** Called when the user clicks "See full readiness breakdown" action. */
  onOpenReadinessBreakdown?: () => void;
  /** Called when a compact summary chip is clicked (receives chip id). */
  onSummaryChipClick?: (chipId: string) => void;
}

// ============================================================================
// BACKWARD-COMPAT TYPE EXPORTS
// ============================================================================
//
// The old DashboardData interface was exported from this file and consumed by
// mockDashboardData.ts and buildDashboardViewModel.ts. We keep it here as a
// type-only re-export so those files continue to compile. The new screen does
// NOT use this type — it's retained purely for downstream compatibility.

/** @deprecated Use CompactSummary + ThreadMessage instead. Kept for mockDashboardData compat. */
export interface DashboardData {
  briefing: Array<{ label: string; value: string; subtext: string; subtextPositive?: boolean }>;
  focusHero: {
    title: string;
    reason: string;
    ctaLabel: string;
    stepBadge: string;
    explainKnow: string;
    explainNotKnow: string;
    explainWhy: string;
    estimatedTime?: string;
    whyItMatters?: string;
    whatYoullDo?: string;
  } | null;
  focusSmall: Array<{ title: string; description: string; ctaLabel: string }>;
  savedJobs: Array<{ title: string; orgGrade: string; status: string; timeAgo: string }>;
  applications: Array<{
    title: string;
    submittedDate: string;
    status: string;
    statusVariant?: string;
  }>;
  resume: {
    progressPercent: number;
    checklist: Array<{ label: string; checked: boolean }>;
    openCtaLabel: string;
  };
  updatesSinceVisit: Array<{ icon: string; text: string; timeAgo: string }>;
  readinessDeltas: Array<{
    label: string;
    delta: string;
    deltaPositive?: boolean;
    deltaNegative?: boolean;
    explanation: string;
  }>;
  timelineEstimates: Array<{ label: string; range: string }>;
  timelineDisclaimer: string;
  timelineMethodology: string;
  lastUpdated?: string;
}


// ============================================================================
// SEEDED / DEMO DATA
// ============================================================================
//
// WHY SEEDED DATA:
// This first slice uses hardcoded demo data to implement the approved mockup.
// The data shape matches the types above so switching to real runtime data
// from the governed API is a clean replacement — swap the data source, keep
// the rendering pipeline.
//
// The seeded response models the "Am I competitive for GS-13 roles?" scenario
// as specified in the approved design.

/** Default compact summary matching the approved mockup values. */
const DEFAULT_SUMMARY: CompactSummary = {
  readinessScore: 74,
  savedJobsCount: 3,
  applicationsCount: 2,
  lastUpdated: '2 min ago',
};

/**
 * Seeded governed response for the GS-13 competitiveness question.
 *
 * HOW THIS WORKS:
 * When the user sends a message (any message in this demo slice), the
 * dashboard transitions from empty state to active thread state using this
 * seeded response. The governed data populates the verdict strip, evidence
 * sections, and action buttons.
 *
 * WHY THIS SPECIFIC CONTENT:
 * It matches the approved mockup exactly: "Competitive with improvements",
 * medium confidence, three grounded reasons, three gaps, one recommended
 * next step with impact estimate, and three action buttons.
 */
const SEEDED_GOVERNED_RESPONSE: GovernedResponseData = {
  decision: 'Competitive with improvements',
  decisionVariant: 'caution',
  confidence: 'Medium',
  band: 'Likely fit with stronger evidence',
  groundedReasons: [
    'You appear to meet baseline qualification standards for GS-13 analyst roles',
    'Resume evidence is weaker than your qualification baseline',
    'Leadership and scope signals are present but limited',
  ],
  topGaps: [
    'Quantified accomplishments',
    'Leadership scope',
    'Target role alignment',
  ],
  recommendedNextStep: {
    label: 'Add 3 quantified accomplishments',
    estimatedImpact: '+4 readiness',
    estimatedTime: '15\u201320 min',
  },
  actions: [
    { label: 'Start improvement', variant: 'primary', actionId: 'start-improvement' },
    { label: 'Open Resume Builder', variant: 'secondary', actionId: 'open-resume-builder' },
    { label: 'See full readiness breakdown', variant: 'secondary', actionId: 'open-readiness' },
  ],
};

/**
 * The seeded assistant message text for the GS-13 competitiveness response.
 * Rendered as the headline answer before the governed evidence sections.
 */
const SEEDED_RESPONSE_CONTENT =
  'You are competitive for GS-13 roles, but with improvements.\n' +
  'Your strongest limiting factor right now is resume evidence, not baseline qualification.';

/**
 * Suggested prompt chips shown in the empty/home state.
 * These are conversation starters that help users understand what PathAdvisor
 * can help with. Ordered by likely user intent (exploration → assessment → action).
 */
const SUGGESTED_PROMPTS: string[] = [
  'How do I search for a job?',
  'Am I competitive for GS-13 roles?',
  'What should I improve first?',
  'Why was I not referred?',
  'Show me strong-fit jobs',
  'Decode my latest application status',
];

/**
 * Suggested prompts that PathAdvisor screen overrides use for the right rail.
 * Even though the right rail is hidden on dashboard, setting these keeps the
 * screen context consistent for any components that read overrides.
 */
const DASHBOARD_SCREEN_PROMPTS: string[] = [
  'What should I focus on first today?',
  'Why did my readiness score change?',
  'When can I expect a referral decision?',
];


// ============================================================================
// COMPACT SUMMARY CHIPS
// ============================================================================
//
// WHY CHIPS INSTEAD OF TILES:
// The old dashboard had four large "Briefing" tiles (Saved Jobs, Tracked Apps,
// Readiness, Next Milestone) each with card chrome, accent borders, and CTAs.
// The new design replaces these with compact clickable chips in a horizontal
// row. They convey the same status signal with far less visual weight, leaving
// the canvas free for the conversation thread.
//
// HOW THEY WORK:
// Each chip renders an icon + label + value. Clicking a chip can navigate to
// the relevant detail page (e.g. clicking "Saved jobs: 3" goes to Saved Jobs).
// The onSummaryChipClick callback is optional; when absent, chips are static.

/**
 * Renders a single compact summary chip (icon + label + value).
 *
 * INTERACTION STATES:
 * - hover: background brightens to var(--p-surface2)
 * - focus-visible: ring-2 accent ring
 * - active: slight opacity reduction
 * - uses button semantics when clickable, span when static
 */
function SummaryChip(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  chipId: string;
  onClick?: (chipId: string) => void;
}) {
  const isClickable = props.onClick !== undefined && props.onClick !== null;

  /**
   * WHY CONDITIONAL TAG:
   * When there's no click handler, we render a <span> instead of a <button>
   * to avoid misleading keyboard users into thinking the chip is interactive.
   * When clickable, <button> provides native keyboard activation (Enter/Space).
   */
  if (isClickable) {
    return (
      <button
        type="button"
        onClick={function () {
          const handler = props.onClick;
          if (handler !== undefined && handler !== null) {
            handler(props.chipId);
          }
        }}
        className={
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ' +
          'transition-colors duration-150 cursor-pointer ' +
          'hover:opacity-90 ' +
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ' +
          'active:opacity-75'
        }
        style={{
          background: 'var(--p-surface)',
          border: '1px solid var(--p-border)',
          color: 'var(--p-text-muted)',
          /** focus-visible ring color uses the accent token */
          '--tw-ring-color': 'var(--p-accent)',
        } as React.CSSProperties}
        aria-label={props.label + ': ' + props.value}
      >
        {props.icon}
        <span style={{ color: 'var(--p-text-muted)' }}>{props.label}:</span>
        <span style={{ color: 'var(--p-text)' }}>{props.value}</span>
      </button>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
      style={{
        background: 'var(--p-surface)',
        border: '1px solid var(--p-border)',
        color: 'var(--p-text-muted)',
      }}
    >
      {props.icon}
      <span style={{ color: 'var(--p-text-muted)' }}>{props.label}:</span>
      <span style={{ color: 'var(--p-text)' }}>{props.value}</span>
    </span>
  );
}

/**
 * Horizontal row of compact summary chips.
 *
 * WHY THIS COMPONENT:
 * Encapsulates the status chip row so the main DashboardScreen render stays
 * clean. Also centralizes the icon-to-chip mapping.
 *
 * LAYOUT:
 * Uses flex-wrap so chips gracefully wrap on narrow viewports. Centered
 * horizontally to match the conversation canvas alignment.
 */
function CompactSummaryChips(props: {
  summary: CompactSummary;
  onChipClick?: (chipId: string) => void;
}) {
  const s = props.summary;

  /** Icon size for summary chips — small enough to not compete with content. */
  const iconSize = 'w-3.5 h-3.5';
  const iconStyle: React.CSSProperties = { color: 'var(--p-text-dim)' };

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2"
      role="status"
      aria-label="Dashboard status summary"
    >
      <SummaryChip
        icon={<CheckCircle2 className={iconSize} style={iconStyle} />}
        label="Readiness"
        value={String(s.readinessScore)}
        chipId="readiness"
        onClick={props.onChipClick}
      />
      <SummaryChip
        icon={<Bookmark className={iconSize} style={iconStyle} />}
        label="Saved jobs"
        value={String(s.savedJobsCount)}
        chipId="saved-jobs"
        onClick={props.onChipClick}
      />
      <SummaryChip
        icon={<FileText className={iconSize} style={iconStyle} />}
        label="Applications"
        value={String(s.applicationsCount)}
        chipId="applications"
        onClick={props.onChipClick}
      />
      <SummaryChip
        icon={<Clock className={iconSize} style={iconStyle} />}
        label="Updated"
        value={s.lastUpdated}
        chipId="updated"
      />
    </div>
  );
}


// ============================================================================
// TRUST NOTE
// ============================================================================
//
// WHY THIS EXISTS:
// PathOS is a trust-first product. Every response surface must attribute where
// the guidance comes from. The trust note is subtle (small, muted text) so it
// never competes with the actual content, but it's always present.

function TrustNote(props: { text: string }) {
  return (
    <p
      className="text-center text-[11px] mt-4"
      style={{ color: 'var(--p-text-dim)' }}
    >
      {props.text}
    </p>
  );
}


// ============================================================================
// CONVERSATION INPUT
// ============================================================================
//
// WHY THIS COMPONENT:
// A unified input component used in both the empty state (large, centered)
// and the follow-up state (below thread). Takes a placeholder, onSend
// callback, and optional size variant.
//
// HOW IT WORKS:
// Renders a textarea-style input (single line visually, but textarea for
// future multi-line support) with a send button on the right. Enter sends;
// Shift+Enter would add a newline (future). The input clears after send.
//
// ACCESSIBILITY:
// - Uses <textarea> with role description for screen readers
// - Send button has aria-label
// - Focus-visible ring on both input and button

function ConversationInput(props: {
  placeholder: string;
  onSend: (text: string) => void;
  /** Visual variant: 'hero' for the empty state (larger), 'compact' for thread follow-up. */
  variant?: 'hero' | 'compact';
}) {
  const [value, setValue] = useState('');
  const variant = props.variant !== undefined ? props.variant : 'hero';
  const isHero = variant === 'hero';

  /**
   * Destructure onSend so React Compiler can track the dependency
   * precisely (avoids "inferred less specific property" lint error
   * when the dep array references props.onSend).
   */
  const onSend = props.onSend;

  /**
   * Handle keyboard events on the input.
   *
   * WHY ENTER-TO-SEND:
   * Chat-style inputs conventionally use Enter to send. This matches
   * the mental model of a conversation thread, not a form submission.
   */
  const handleKeyDown = useCallback(
    function (e: React.KeyboardEvent<HTMLTextAreaElement>) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed !== '') {
          onSend(trimmed);
          setValue('');
        }
      }
    },
    [value, onSend]
  );

  const handleSendClick = useCallback(
    function () {
      const trimmed = value.trim();
      if (trimmed !== '') {
        onSend(trimmed);
        setValue('');
      }
    },
    [value, onSend]
  );

  const handleChange = useCallback(function (e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
  }, []);

  /**
   * Input container styling: rounded pill shape, subtle border, surface
   * background. The hero variant is slightly taller for visual prominence.
   */
  const containerPadding = isHero ? 'px-4 py-3' : 'px-3 py-2.5';

  return (
    <div
      className={
        'flex items-center gap-2 rounded-xl ' + containerPadding +
        ' transition-colors duration-150'
      }
      style={{
        background: 'var(--p-surface)',
        border: '1px solid var(--p-border)',
      }}
    >
      <textarea
        rows={1}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={props.placeholder}
        className={
          'flex-1 resize-none bg-transparent text-sm leading-snug ' +
          'placeholder:text-[var(--p-text-dim)] ' +
          'focus:outline-none'
        }
        style={{
          color: 'var(--p-text)',
          minHeight: isHero ? '24px' : '20px',
          maxHeight: '120px',
        }}
        aria-label="Message PathAdvisor"
      />
      <button
        type="button"
        onClick={handleSendClick}
        disabled={value.trim() === ''}
        className={
          'flex-shrink-0 rounded-lg p-2 transition-all duration-150 ' +
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ' +
          'disabled:opacity-30 disabled:cursor-not-allowed ' +
          'hover:opacity-90 active:scale-95'
        }
        style={{
          background: value.trim() !== '' ? 'var(--p-accent)' : 'var(--p-surface2)',
          color: value.trim() !== '' ? 'var(--p-bg)' : 'var(--p-text-dim)',
          '--tw-ring-color': 'var(--p-accent)',
        } as React.CSSProperties}
        aria-label="Send message"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}


// ============================================================================
// SUGGESTED PROMPT CHIPS
// ============================================================================
//
// WHY THESE EXIST:
// New users don't know what to ask. Prompt chips demonstrate the range of
// PathAdvisor's capabilities (job search, competitiveness assessment,
// improvement guidance, status decoding) and reduce blank-screen anxiety.
//
// HOW THEY WORK:
// Clicking a chip immediately sends that prompt text to the conversation,
// transitioning from empty state to active thread state.
//
// INTERACTION STATES:
// - hover: background shifts to var(--p-surface2), border brightens
// - focus-visible: accent ring
// - active: slight scale reduction

function SuggestedPromptChips(props: {
  prompts: string[];
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2 mt-4">
      {props.prompts.map(function (prompt, idx) {
        return (
          <button
            key={idx}
            type="button"
            onClick={function () {
              props.onSelect(prompt);
            }}
            className={
              'rounded-full px-3 py-1.5 text-xs font-medium ' +
              'transition-all duration-150 cursor-pointer ' +
              'hover:opacity-90 ' +
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ' +
              'active:scale-[0.97]'
            }
            style={{
              background: 'var(--p-surface)',
              border: '1px solid var(--p-border)',
              color: 'var(--p-text-muted)',
              '--tw-ring-color': 'var(--p-accent)',
            } as React.CSSProperties}
          >
            {prompt}
          </button>
        );
      })}
    </div>
  );
}


// ============================================================================
// PATHADVISOR EMPTY STATE
// ============================================================================
//
// WHY THIS EXISTS:
// The empty state is the user's first impression of the dashboard. It should
// feel calm, inviting, and purposeful. PathAdvisor IS the experience — not a
// widget stuck in a sidebar. The centered icon, heading, input, and prompt
// chips communicate "start here."
//
// LAYOUT:
// The parent canvas div has min-height: calc(100vh - 7rem) and uses flex
// centering (items-center + justify-center) to position this component at
// the true viewport center of the space below the summary chips. This
// component itself is a simple flex-col with horizontal centering — it
// does NOT set its own vertical padding because the parent canvas handles
// vertical placement via its explicit min-height.
//
// WHY NO "Dashboard" HEADING OR SUBTITLE:
// The task explicitly prohibits "Dashboard" heading and "Your command center"
// subtitle. The summary chips carry the status load; the main canvas belongs
// to PathAdvisor.

function PathAdvisorEmptyState(props: {
  onSend: (text: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4">
      {/* PathAdvisor icon — the Sparkles icon represents AI guidance */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: 'var(--p-accent-bg)',
          border: '1px solid var(--p-accent-muted)',
        }}
      >
        <Sparkles
          className="w-7 h-7"
          style={{ color: 'var(--p-accent)' }}
        />
      </div>

      {/* Heading and supporting line */}
      <h1
        className="text-xl font-semibold mb-1"
        style={{ color: 'var(--p-text)' }}
      >
        PathAdvisor
      </h1>
      <p
        className="text-sm mb-6"
        style={{ color: 'var(--p-text-muted)' }}
      >
        What would you like to figure out today?
      </p>

      {/* Main conversation input — wide, centered, prominent */}
      <div className="w-full max-w-[600px]">
        <ConversationInput
          placeholder="Ask about your readiness, explore jobs, or get guidance on your next move..."
          onSend={props.onSend}
          variant="hero"
        />
      </div>

      {/* Suggested prompt chips — conversation starters */}
      <div className="w-full max-w-[640px]">
        <SuggestedPromptChips
          prompts={SUGGESTED_PROMPTS}
          onSelect={props.onSend}
        />
      </div>

      {/* Trust note — always present, never competing */}
      <TrustNote text="PathAdvisor explores governed results from your profile, job data, and local workspace context." />
    </div>
  );
}


// ============================================================================
// USER MESSAGE BUBBLE
// ============================================================================
//
// WHY THIS COMPONENT:
// In a conversation thread, user messages need to be visually distinct from
// assistant responses. A right-aligned bubble with subtle surface treatment
// makes the conversation flow readable at a glance.
//
// STYLING:
// Right-aligned, rounded, surface2 background. No card chrome or borders —
// just enough tonal separation to distinguish from assistant content.

function UserMessageBubble(props: { content: string }) {
  return (
    <div className="flex justify-end mb-4">
      <div
        className="rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%]"
        style={{
          background: 'var(--p-surface2)',
          color: 'var(--p-text)',
        }}
      >
        <p className="text-sm leading-relaxed">{props.content}</p>
      </div>
    </div>
  );
}


// ============================================================================
// VERDICT STRIP
// ============================================================================
//
// WHY THIS EXISTS:
// Decision / Confidence / Band are the three authoritative signals that ground
// the PathAdvisor response. They must feel like one scannable, deterministic
// unit — not random metadata fields scattered across the response.
//
// DESIGN:
// A single horizontal strip with three label/value pairs. The Decision label
// uses a tinted badge whose color reflects the variant (positive/caution/negative).
// Confidence and Band are calm inline label/value pairs.
//
// WHY NOT A BORDERED CARD:
// The task says "reduce card-inside-card feel." The verdict strip uses subtle
// background tinting and a left accent border instead of full card chrome.

function VerdictStrip(props: {
  decision: string;
  decisionVariant: 'positive' | 'caution' | 'negative';
  confidence: string;
  band: string;
}) {
  /**
   * Map the variant to the appropriate semantic color tokens.
   *
   * WHY EXPLICIT IFS INSTEAD OF OBJECT LOOKUP:
   * The repo avoids optional chaining and prefers explicit control flow.
   * Three branches is clearer than a lookup table for three values.
   */
  let decisionColor = 'var(--p-warning)';
  let decisionBg = 'var(--p-warning-bg)';
  if (props.decisionVariant === 'positive') {
    decisionColor = 'var(--p-success)';
    decisionBg = 'var(--p-success-bg)';
  } else if (props.decisionVariant === 'negative') {
    decisionColor = 'var(--p-danger)';
    decisionBg = 'var(--p-danger-bg)';
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg px-4 py-3 mt-4"
      style={{
        background: 'var(--p-surface)',
        borderLeft: '3px solid ' + decisionColor,
      }}
    >
      {/* Decision — the primary verdict; uses a tinted badge */}
      <div className="flex items-center gap-2">
        <span
          className="text-[11px] uppercase tracking-wide font-medium"
          style={{ color: 'var(--p-text-dim)' }}
        >
          Decision
        </span>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{
            background: decisionBg,
            color: decisionColor,
          }}
        >
          {props.decision}
        </span>
      </div>

      {/* Confidence — calm label/value */}
      <div className="flex items-center gap-2">
        <span
          className="text-[11px] uppercase tracking-wide font-medium"
          style={{ color: 'var(--p-text-dim)' }}
        >
          Confidence
        </span>
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--p-text)' }}
        >
          {props.confidence}
        </span>
      </div>

      {/* Band — calm label/value */}
      <div className="flex items-center gap-2">
        <span
          className="text-[11px] uppercase tracking-wide font-medium"
          style={{ color: 'var(--p-text-dim)' }}
        >
          Band
        </span>
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--p-text-muted)' }}
        >
          {props.band}
        </span>
      </div>
    </div>
  );
}


// ============================================================================
// GROUNDED REASONS SECTION
// ============================================================================
//
// WHY THIS EXISTS:
// Grounded reasons are the evidence supporting PathAdvisor's verdict. They
// must read as serious, verifiable statements — not marketing copy. Each
// reason is a bullet in a clean list.
//
// WHY COLLAPSIBLE:
// The task says grounded reasons should "read as evidence." A collapsible
// section keeps the default view scannable while allowing users to expand
// for the full evidence list.

function GroundedReasonsSection(props: { reasons: string[] }) {
  const [expanded, setExpanded] = useState(true);

  if (props.reasons.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={function () {
          setExpanded(!expanded);
        }}
        className={
          'flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-medium ' +
          'transition-colors duration-150 ' +
          'hover:opacity-80 ' +
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ' +
          INTERACTIVE_HOVER_CLASS
        }
        style={{
          color: 'var(--p-text-dim)',
          background: 'none',
          border: 'none',
          padding: '2px 4px',
          cursor: 'pointer',
          borderRadius: 'var(--p-radius)',
          '--tw-ring-color': 'var(--p-accent)',
        } as React.CSSProperties}
        aria-expanded={expanded}
        aria-controls="grounded-reasons-list"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronUp className="w-3 h-3" />
        )}
        Grounded reasons
      </button>
      {expanded ? (
        <ul
          id="grounded-reasons-list"
          className="mt-2 space-y-1.5 list-none pl-0"
        >
          {props.reasons.map(function (reason, idx) {
            return (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm leading-relaxed"
                style={{ color: 'var(--p-text-muted)' }}
              >
                <span
                  className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--p-text-dim)' }}
                  aria-hidden="true"
                />
                {reason}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}


// ============================================================================
// TOP GAPS SECTION
// ============================================================================
//
// WHY THIS EXISTS:
// Top gaps highlight the specific weaknesses the user should address. They
// appear as restrained inline tags — serious and readable, not decorative
// filter chips.
//
// STYLING:
// Subtle surface2 background, muted text, small size. No accent tinting —
// these are informational markers, not interactive toggles.

function TopGapsSection(props: { gaps: string[] }) {
  if (props.gaps.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <span
        className="text-[11px] uppercase tracking-wide font-medium"
        style={{ color: 'var(--p-text-dim)' }}
      >
        Top gaps
      </span>
      <div className="flex flex-wrap gap-2 mt-2">
        {props.gaps.map(function (gap, idx) {
          return (
            <span
              key={idx}
              className="rounded-md px-2.5 py-1 text-xs font-medium"
              style={{
                background: 'var(--p-surface2)',
                border: '1px solid var(--p-border)',
                color: 'var(--p-text-muted)',
              }}
            >
              {gap}
            </span>
          );
        })}
      </div>
    </div>
  );
}


// ============================================================================
// RECOMMENDED NEXT STEP BLOCK
// ============================================================================
//
// WHY THIS EXISTS:
// The recommended next step is the single most actionable piece of guidance
// in the response. It should feel like a highlighted guidance block within
// the response flow — not a separate nested card.
//
// STYLING:
// Subtle accent-tinted background with a left accent border. Shows the
// action label, estimated impact, and estimated time in a scannable format.
// The Zap icon signals actionability.

function RecommendedNextStepBlock(props: {
  label: string;
  estimatedImpact: string;
  estimatedTime: string;
}) {
  return (
    <div
      className="mt-4 rounded-lg px-4 py-3 flex items-start gap-3"
      style={{
        background: 'var(--p-accent-bg)',
        borderLeft: '3px solid var(--p-accent)',
      }}
    >
      <Zap
        className="w-4 h-4 flex-shrink-0 mt-0.5"
        style={{ color: 'var(--p-accent)' }}
      />
      <div className="flex-1 min-w-0">
        <span
          className="text-[11px] uppercase tracking-wide font-medium block"
          style={{ color: 'var(--p-accent-text)' }}
        >
          Recommended next step
        </span>
        <p
          className="text-sm font-semibold mt-0.5"
          style={{ color: 'var(--p-text)' }}
        >
          {props.label}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
          <span className="text-xs" style={{ color: 'var(--p-accent-text)' }}>
            Estimated impact: {props.estimatedImpact}
          </span>
          <span className="text-xs" style={{ color: 'var(--p-text-dim)' }}>
            Time: {props.estimatedTime}
          </span>
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// RESPONSE ACTION BUTTONS
// ============================================================================
//
// WHY THIS EXISTS:
// Action buttons at the end of a response turn the governed analysis into
// concrete next steps. "Start improvement" is the primary (accent-filled),
// while "Open Resume Builder" and "See full readiness breakdown" are calm
// secondary buttons.
//
// INTERACTION STATES:
// - Primary: accent bg, hover darkens, focus-visible ring, active scale
// - Secondary: surface2 bg + border, hover brightens, focus-visible ring

function ResponseActionButtons(props: {
  actions: GovernedResponseData['actions'];
  onAction: (actionId: string) => void;
}) {
  if (props.actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-5">
      {props.actions.map(function (action, idx) {
        const isPrimary = action.variant === 'primary';

        return (
          <button
            key={idx}
            type="button"
            onClick={function () {
              props.onAction(action.actionId);
            }}
            className={
              'rounded-[var(--p-radius)] px-4 py-2 text-sm font-medium ' +
              'transition-all duration-150 ' +
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ' +
              'active:scale-[0.97] ' +
              (isPrimary
                ? 'hover:opacity-90 flex items-center gap-1.5'
                : 'hover:opacity-90')
            }
            style={
              isPrimary
                ? {
                    background: 'var(--p-accent)',
                    color: 'var(--p-bg)',
                    '--tw-ring-color': 'var(--p-accent)',
                  } as React.CSSProperties
                : {
                    background: 'var(--p-surface2)',
                    border: '1px solid var(--p-border)',
                    color: 'var(--p-text)',
                    '--tw-ring-color': 'var(--p-accent)',
                  } as React.CSSProperties
            }
          >
            {action.label}
            {isPrimary ? (
              <ArrowRight className="w-4 h-4" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}


// ============================================================================
// PATHADVISOR RESPONSE BLOCK
// ============================================================================
//
// WHY THIS EXISTS:
// The PathAdvisor response is the core value proposition of the dashboard.
// It must feel like one unified composition — not a stack of separate cards.
// The visual read order is:
//   1. Headline answer (conversational, clear hierarchy)
//   2. Verdict strip (Decision / Confidence / Band)
//   3. Grounded reasons (evidence)
//   4. Top gaps (specific weaknesses)
//   5. Recommended next step (highlighted guidance)
//   6. Action buttons (concrete next steps)
//
// STYLING:
// No heavy bordered card. Uses spacing, subtle tonal separation, and a
// left-aligned Sparkles icon to signal PathAdvisor authorship.
//
// WHY HEADLINE ACCENTING:
// The task says "Accent only the truly meaningful phrase." In the seeded
// response, "resume evidence" is the key insight. We render it with the
// accent color using a simple string-matching approach that can be
// replaced with proper tokenization in a future pass.

/**
 * Renders a content line with an optional accented phrase.
 *
 * HOW IT WORKS:
 * If the line contains the accent phrase, it splits the text around it
 * and renders the phrase with accent color + underline. Otherwise, it
 * renders the line as plain text.
 *
 * WHY NOT DANGEROUSLY SET INNER HTML:
 * We never inject uncontrolled HTML. The accent phrase is a known safe
 * string from the governed response, and we use React elements to render it.
 */
function AccentedLine(props: {
  text: string;
  accentPhrase: string | null;
}) {
  const phrase = props.accentPhrase;
  if (phrase === null || phrase === '') {
    return <span>{props.text}</span>;
  }

  const phraseIndex = props.text.indexOf(phrase);
  if (phraseIndex === -1) {
    return <span>{props.text}</span>;
  }

  const before = props.text.substring(0, phraseIndex);
  const after = props.text.substring(phraseIndex + phrase.length);

  return (
    <span>
      {before}
      <span
        className="underline decoration-1 underline-offset-2"
        style={{ color: 'var(--p-accent-text)' }}
      >
        {phrase}
      </span>
      {after}
    </span>
  );
}

function PathAdvisorResponseBlock(props: {
  content: string;
  governed: GovernedResponseData | null;
  onAction: (actionId: string) => void;
}) {
  /**
   * Split the content into lines for rendering.
   *
   * WHY SPLIT:
   * The seeded response has two lines separated by \n. Rendering them as
   * separate paragraphs with different hierarchy (first = headline, second
   * = supporting detail) achieves the "stronger hierarchy for the answer"
   * requirement.
   */
  const lines: string[] = [];
  const rawLines = props.content.split('\n');
  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();
    if (trimmed !== '') {
      lines.push(trimmed);
    }
  }

  const governed = props.governed;
  const hasGoverned = governed !== null && governed !== undefined;

  return (
    <div className="mb-4">
      {/* PathAdvisor avatar + response content */}
      <div className="flex items-start gap-3">
        {/* Small PathAdvisor avatar icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{
            background: 'var(--p-accent-bg)',
            border: '1px solid var(--p-accent-muted)',
          }}
        >
          <Sparkles
            className="w-4 h-4"
            style={{ color: 'var(--p-accent)' }}
          />
        </div>

        {/* Response content area */}
        <div className="flex-1 min-w-0">
          {/* Headline answer — first line is the primary response */}
          {lines.length > 0 ? (
            <p
              className="text-base font-semibold leading-relaxed"
              style={{ color: 'var(--p-text)' }}
            >
              <AccentedLine text={lines[0]} accentPhrase={null} />
            </p>
          ) : null}

          {/* Supporting detail lines — second line and beyond */}
          {lines.length > 1 ? (
            <div className="mt-1">
              {lines.slice(1).map(function (line, idx) {
                return (
                  <p
                    key={idx}
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--p-text-muted)' }}
                  >
                    <AccentedLine text={line} accentPhrase="resume evidence" />
                  </p>
                );
              })}
            </div>
          ) : null}

          {/* Governed evidence sections (only when governed data is present) */}
          {hasGoverned ? (
            <div>
              {/* Verdict strip: Decision / Confidence / Band */}
              <VerdictStrip
                decision={governed.decision}
                decisionVariant={governed.decisionVariant}
                confidence={governed.confidence}
                band={governed.band}
              />

              {/* Grounded reasons: evidence supporting the verdict */}
              <GroundedReasonsSection reasons={governed.groundedReasons} />

              {/* Top gaps: specific areas to improve */}
              <TopGapsSection gaps={governed.topGaps} />

              {/* Recommended next step: highlighted guidance block */}
              <RecommendedNextStepBlock
                label={governed.recommendedNextStep.label}
                estimatedImpact={governed.recommendedNextStep.estimatedImpact}
                estimatedTime={governed.recommendedNextStep.estimatedTime}
              />

              {/* Action buttons: concrete next steps */}
              <ResponseActionButtons
                actions={governed.actions}
                onAction={props.onAction}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// CONVERSATION THREAD
// ============================================================================
//
// WHY THIS EXISTS:
// The conversation thread is the active state of the dashboard. It renders
// a sequence of user messages and PathAdvisor responses, followed by a
// follow-up input for continuing the conversation.
//
// ARCHITECTURE:
// The thread is a flat array of ThreadMessage objects. Each message is
// rendered based on its role: user messages as right-aligned bubbles,
// assistant messages as left-aligned response blocks. This structure
// supports arbitrary multi-turn threads in the future.
//
// LAYOUT:
// The parent canvas div positions this component with a fixed top offset
// (pt-14 = 56px) inside a min-height container so the thread feels
// intentionally staged rather than pinned to the top. The thread itself
// only handles horizontal padding and internal spacing. It scrolls
// naturally with the page via the parent <main> scroll container. The
// follow-up input is always visible below the last message.

function ConversationThread(props: {
  messages: ThreadMessage[];
  onSend: (text: string) => void;
  onAction: (actionId: string) => void;
}) {
  return (
    <div className="px-4">
      {/* Render each message in the thread */}
      {props.messages.map(function (msg) {
        if (msg.role === 'user') {
          return (
            <UserMessageBubble key={msg.id} content={msg.content} />
          );
        }

        return (
          <PathAdvisorResponseBlock
            key={msg.id}
            content={msg.content}
            governed={msg.governed}
            onAction={props.onAction}
          />
        );
      })}

      {/* Follow-up input — continuation, not restart */}
      <div className="mt-6">
        <ConversationInput
          placeholder="Ask a follow-up about readiness, jobs, or your next move\u2026"
          onSend={props.onSend}
          variant="compact"
        />
      </div>

      {/* Trust note — subtle governance attribution */}
      <TrustNote text="Governed guidance from your profile, job data, and local workspace context." />
    </div>
  );
}


// ============================================================================
// MAIN DASHBOARD SCREEN
// ============================================================================
//
// WHY THIS COMPONENT:
// This is the top-level export consumed by the dashboard route page.tsx.
// It manages the state machine between empty and active thread states,
// renders the compact summary chips, and delegates to the appropriate
// sub-component (empty state hero or conversation thread).
//
// STATE MACHINE:
// - messages.length === 0 → empty/home state (PathAdvisorEmptyState)
// - messages.length > 0   → active thread state (ConversationThread)
//
// HOW SEND WORKS:
// When the user sends a message (from either the empty state input, a
// suggested prompt chip, or the follow-up input):
// 1. A user message is added to the messages array.
// 2. After a brief simulated delay, a seeded PathAdvisor response is added.
// 3. The UI transitions to (or remains in) the active thread state.
//
// In a future pass, step 2 will be replaced by a real governed API call.
// The current seeded approach lets us validate the UI composition and UX
// flow without backend dependencies.
//
// LAYOUT:
// The main canvas is centered with a max-width of ~860px for comfortable
// reading. The compact summary chips sit above it. The entire composition
// lives inside the SharedAppShell's main scroll region.

export function DashboardScreen(props: DashboardScreenProps) {
  /**
   * Destructure props at the top level so React Compiler can track
   * individual callback dependencies precisely. This avoids the
   * "inferred less specific property" lint error when useCallback
   * dep arrays reference props.someProp.
   */
  const propSummary = props.summary;
  const propOnStartImprovement = props.onStartImprovement;
  const propOnOpenResumeBuilder = props.onOpenResumeBuilder;
  const propOnOpenReadinessBreakdown = props.onOpenReadinessBreakdown;
  const propOnSummaryChipClick = props.onSummaryChipClick;

  // ==========================================================================
  // THREAD STORE INTEGRATION
  // ==========================================================================
  //
  // WHY THE THREAD STORE REPLACES LOCAL useState:
  // The original DashboardScreen used useState<ThreadMessage[]> for messages.
  // That meant conversations were lost on every page navigation or refresh.
  // The thread store provides:
  //   1. Persistence: threads survive page refresh via localStorage.
  //   2. Multi-thread: users can switch between saved conversations.
  //   3. Sidebar integration: threads appear in the left nav.
  //
  // HOW THE INTEGRATION WORKS:
  // - The store owns the data (threads, messages, activeThreadId).
  // - DashboardScreen reads the active thread's messages and maps them
  //   to its own ThreadMessage format (which includes `governed` data).
  // - On send: if no active thread, createThreadWithMessage(); otherwise
  //   addMessageToThread() to the active thread.
  // - The governed data is local ephemeral state (not persisted) since it
  //   would be regenerated from the API in production.

  const activeThreadId = usePathAdvisorThreadStore(function (s) { return s.activeThreadId; });
  const storeThreads = usePathAdvisorThreadStore(function (s) { return s.threads; });
  const hydrated = usePathAdvisorThreadStore(function (s) { return s.hydrated; });
  const hydrateStore = usePathAdvisorThreadStore(function (s) { return s.hydrate; });
  const createThreadWithMessage = usePathAdvisorThreadStore(function (s) { return s.createThreadWithMessage; });
  const addMessageToThread = usePathAdvisorThreadStore(function (s) { return s.addMessageToThread; });

  /**
   * Hydrate the thread store from localStorage on mount.
   *
   * WHY HERE AND NOT ONLY IN SIDEBAR:
   * If the user navigates directly to /dashboard (e.g. bookmark, refresh),
   * the sidebar may not have mounted yet or may mount asynchronously.
   * Hydrating in DashboardScreen ensures the active thread is available
   * immediately. The hydrate() function is idempotent, so calling it from
   * both sidebar and dashboard is safe.
   */
  useEffect(function () {
    if (!hydrated) {
      hydrateStore();
    }
  }, [hydrated, hydrateStore]);

  /**
   * Build the ThreadMessage array from the active thread's stored messages.
   *
   * WHY MAP BETWEEN TYPES:
   * The store uses AdvisorThreadMessage (lean, persistence-focused).
   * The UI uses ThreadMessage (includes `governed` for structured rendering).
   * We map from store → UI format here. The `governed` field is null for
   * persisted messages; the seeded governed response is only attached to
   * messages created in the current session via the ephemeral governed map.
   *
   * WHY useMemo:
   * Prevents rebuilding the messages array on every render. Only recalculates
   * when the thread store state changes (activeThreadId or threads).
   */
  const [governedDataMap, setGovernedDataMap] = useState<Record<string, GovernedResponseData>>({});

  const messages: ThreadMessage[] = useMemo(function () {
    if (activeThreadId === null) {
      return [];
    }

    /** Find the active thread by iterating (no optional chaining). */
    let activeThread = null;
    for (let i = 0; i < storeThreads.length; i++) {
      if (storeThreads[i].id === activeThreadId) {
        activeThread = storeThreads[i];
        break;
      }
    }

    if (activeThread === null) {
      return [];
    }

    /** Map AdvisorThreadMessage → ThreadMessage for the UI. */
    const mapped: ThreadMessage[] = [];
    for (let i = 0; i < activeThread.messages.length; i++) {
      const storeMsg = activeThread.messages[i];
      /**
       * Map 'advisor' role to 'assistant' for UI rendering.
       * The store uses 'advisor' (product vocabulary); the UI uses
       * 'assistant' (rendering convention established in the original code).
       */
      const uiRole: 'user' | 'assistant' = storeMsg.role === 'advisor' ? 'assistant' : 'user';

      /**
       * Look up ephemeral governed data for this message.
       * Governed data is NOT persisted (it's large and would be regenerated
       * from the API in production). It's stored in a local map keyed by
       * message ID for the current session only.
       */
      const governed = governedDataMap[storeMsg.id] !== undefined
        ? governedDataMap[storeMsg.id]
        : null;

      mapped.push({
        id: storeMsg.id,
        role: uiRole,
        content: storeMsg.content,
        governed: governed,
      });
    }

    return mapped;
  }, [activeThreadId, storeThreads, governedDataMap]);

  /**
   * Resolve the compact summary — use provided data or fall back to defaults.
   *
   * WHY useMemo:
   * Avoids creating a new object reference on every render, which would
   * cause unnecessary re-renders of CompactSummaryChips.
   */
  const summary = useMemo(function () {
    if (propSummary !== undefined && propSummary !== null) {
      return propSummary;
    }
    return DEFAULT_SUMMARY;
  }, [propSummary]);

  const nav = useNav();

  /**
   * Register PathAdvisor screen overrides.
   *
   * WHY STILL SET OVERRIDES:
   * Even though the right rail is hidden on the dashboard, some components
   * (e.g. PathAdvisorCard in other contexts) read screen overrides to
   * customize their behavior. Setting these keeps the context consistent.
   */
  const setOverrides = usePathAdvisorScreenOverridesStore(function (s) {
    return s.setOverrides;
  });

  useEffect(
    function () {
      setOverrides({
        screenId: 'dashboard',
        viewingLabel: 'Dashboard',
        suggestedPrompts: DASHBOARD_SCREEN_PROMPTS,
      });
      return function () {
        setOverrides(null);
      };
    },
    [setOverrides]
  );

  /**
   * Handle sending a message (from any input surface).
   *
   * THREAD CREATION RULE (CRITICAL):
   * - If NO active thread: createThreadWithMessage() creates the thread
   *   and its first message in one atomic operation. This is the ONLY way
   *   threads are created — never on "new conversation" click.
   * - If ACTIVE thread exists: addMessageToThread() appends the message.
   *
   * SEEDED RESPONSE:
   * After the user message, a simulated PathAdvisor response is added
   * after a 300ms delay. In production, this will be a real API call.
   * The governed data is stored in an ephemeral local map (not persisted)
   * and associated with the response message's ID for rendering.
   */
  const handleSend = useCallback(function (text: string) {
    /**
     * Determine whether we need to create a new thread or add to an existing one.
     *
     * WHY READ activeThreadId DIRECTLY FROM STORE:
     * useCallback dependencies would create a stale closure if we used the
     * component-level activeThreadId. Reading from the store's getState()
     * ensures we always have the current value at call time.
     */
    const currentActiveId = usePathAdvisorThreadStore.getState().activeThreadId;

    let targetThreadId: string;

    if (currentActiveId === null) {
      /**
       * NO ACTIVE THREAD — create a new thread with this as the first message.
       * createThreadWithMessage() handles: ID generation, title generation,
       * message creation, setting activeThreadId, and localStorage persistence.
       */
      targetThreadId = createThreadWithMessage(text);
    } else {
      /**
       * ACTIVE THREAD EXISTS — add the user message to it.
       */
      targetThreadId = currentActiveId;
      addMessageToThread(targetThreadId, 'user', text);
    }

    /**
     * Simulate PathAdvisor response after a brief delay.
     *
     * WHY setTimeout:
     * In the real implementation, this will be an async API call. The
     * setTimeout placeholder preserves the same async pattern so the
     * UI already handles the "response arrives later" flow correctly.
     *
     * WHY 300ms:
     * Brief enough to feel responsive, long enough to prevent the response
     * from appearing simultaneously with the user message (which would
     * feel jarring and unrealistic).
     */
    setTimeout(function () {
      const assistantMsgId = addMessageToThread(
        targetThreadId,
        'advisor',
        SEEDED_RESPONSE_CONTENT
      );

      /**
       * Store the governed data in the ephemeral map, keyed by message ID.
       *
       * WHY NOT IN THE THREAD STORE:
       * Governed data is large (grounded reasons, gaps, actions, etc.) and
       * is specific to the rendering session. In production, it would be
       * regenerated from the API. Persisting it to localStorage would bloat
       * storage for no benefit. The ephemeral map keeps it available for
       * the current session's rendering only.
       */
      setGovernedDataMap(function (prev) {
        const next: Record<string, GovernedResponseData> = Object.assign({}, prev);
        next[assistantMsgId] = SEEDED_GOVERNED_RESPONSE;
        return next;
      });
    }, 300);
  }, [createThreadWithMessage, addMessageToThread]);

  /**
   * Handle action button clicks from the response block.
   *
   * WHY A SINGLE HANDLER WITH actionId:
   * The response block's action buttons each have a unique actionId.
   * Routing through a single handler keeps the wiring clean and makes
   * it easy to add new actions later.
   *
   * ACTION ROUTING:
   * - 'start-improvement': calls onStartImprovement or navigates to Career Readiness
   * - 'open-resume-builder': calls onOpenResumeBuilder or navigates to Resume Builder
   * - 'open-readiness': calls onOpenReadinessBreakdown or navigates to Career Readiness
   */
  const handleAction = useCallback(
    function (actionId: string) {
      if (actionId === 'start-improvement') {
        if (propOnStartImprovement !== undefined && propOnStartImprovement !== null) {
          propOnStartImprovement();
        } else {
          nav.push(CAREER_READINESS + '#action-plan');
        }
        return;
      }

      if (actionId === 'open-resume-builder') {
        if (propOnOpenResumeBuilder !== undefined && propOnOpenResumeBuilder !== null) {
          propOnOpenResumeBuilder();
        } else {
          nav.push(RESUME_BUILDER);
        }
        return;
      }

      if (actionId === 'open-readiness') {
        if (propOnOpenReadinessBreakdown !== undefined && propOnOpenReadinessBreakdown !== null) {
          propOnOpenReadinessBreakdown();
        } else {
          nav.push(CAREER_READINESS);
        }
        return;
      }
    },
    [propOnStartImprovement, propOnOpenResumeBuilder, propOnOpenReadinessBreakdown, nav]
  );

  /**
   * Handle summary chip clicks.
   *
   * WHY THIS ROUTING:
   * Each chip ID maps to a navigation target. The onSummaryChipClick
   * callback allows the page.tsx layer to override navigation behavior,
   * but the default behavior uses the shared route constants.
   */
  const handleChipClick = useCallback(
    function (chipId: string) {
      if (propOnSummaryChipClick !== undefined && propOnSummaryChipClick !== null) {
        propOnSummaryChipClick(chipId);
        return;
      }

      if (chipId === 'readiness') {
        nav.push(CAREER_READINESS);
      } else if (chipId === 'saved-jobs') {
        nav.push(SAVED_JOBS);
      } else if (chipId === 'applications') {
        nav.push(IMPORT);
      }
    },
    [propOnSummaryChipClick, nav]
  );

  /**
   * Determine which state to render: empty or active thread.
   *
   * WHY THIS CHECK:
   * The state machine is driven by the messages array length. Zero
   * messages = empty state; one or more = active thread. This is the
   * simplest possible state machine that correctly models the UX.
   */
  const hasMessages = messages.length > 0;

  /**
   * STATE-AWARE CANVAS CLASSES
   *
   * The canvas is a dedicated region below the summary chips that fills the
   * remaining viewport via min-height: calc(100vh - 7rem). The 7rem accounts
   * for the TopBar (3.5rem on desktop) and the chips area (~3.5rem including
   * padding). This gives the canvas a definite height for flex centering
   * without relying on flex-1 inside a min-height parent (which does not
   * provide a definite main size for flex distribution).
   *
   * EMPTY STATE — flex + items-center + justify-center
   *   The PathAdvisor hero is centered vertically and horizontally within the
   *   canvas. Because the canvas has an explicit min-height, flex centering
   *   produces true viewport-center alignment.
   *
   * ACTIVE THREAD — flex-col with fixed top offset (pt-14 = 56px)
   *   The thread starts with intentional breathing room (within the 48–72px
   *   range) so it feels staged, not cramped against the chips. The thread
   *   grows naturally downward and the parent <main> scrolls.
   */
  const canvasClasses = hasMessages
    ? 'flex flex-col pt-14'
    : 'flex items-center justify-center';

  return (
    <div
      className="flex flex-col items-center w-full min-h-full"
      style={{ background: 'var(--p-bg)' }}
    >
      {/* Compact summary chips — always visible, centered above the canvas */}
      <div className="w-full max-w-[860px] pt-4 px-4">
        <CompactSummaryChips
          summary={summary}
          onChipClick={handleChipClick}
        />
      </div>

      {/* Conversation canvas — fills remaining viewport, state-aware alignment */}
      <div
        className={'w-full max-w-[860px] ' + canvasClasses}
        style={{ minHeight: 'calc(100vh - 7rem)' }}
      >
        {hasMessages ? (
          <ConversationThread
            messages={messages}
            onSend={handleSend}
            onAction={handleAction}
          />
        ) : (
          <PathAdvisorEmptyState
            onSend={handleSend}
          />
        )}
      </div>
    </div>
  );
}
