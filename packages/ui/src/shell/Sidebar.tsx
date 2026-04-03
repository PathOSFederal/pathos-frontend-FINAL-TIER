/**
 * ============================================================================
 * SHARED SIDEBAR — Platform-agnostic sidebar navigation
 * ============================================================================
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 * Navigation is handled via @pathos/adapters (useNav / useNavLink).
 *
 * This is the shared version of the PathOS sidebar. It mirrors the structure
 * of components/path-os-sidebar.tsx but uses the NavigationAdapter pattern
 * so it can render in Next.js, Electron, or any other React host.
 *
 * INFORMATION ARCHITECTURE (REFINEMENT — 2026-04-03):
 * The sidebar has three visual zones:
 *
 *   1. TOP ZONE — Brand header, Dashboard, + New conversation, core nav.
 *      Core product navigation lives here and must never be pushed down by
 *      user-generated data (threads, history, etc.). "+ New conversation"
 *      sits just below Dashboard so starting a PathAdvisor session is always
 *      one click away.
 *
 *   2. MAIN NAV — Career Readiness through Settings. These are primary
 *      product routes that must remain visually stable and anchored.
 *
 *   3. BOTTOM ZONE — "Recent conversations" collapsible section. Saved
 *      PathAdvisor threads are user-generated workspace artifacts, not
 *      primary navigation destinations. Placing them at the bottom keeps
 *      the nav stable while still giving threads a permanent home.
 *
 * WHY THIS REFINEMENT:
 * The original implementation placed saved threads at the TOP of the
 * sidebar above all navigation. This was correct for signaling that
 * PathAdvisor is first-class, but in practice it pushed core product
 * routes (Career Readiness, Job Search, Resume Builder, etc.) down
 * the sidebar. Users with many saved conversations saw navigation
 * displaced by thread history. The product decision is:
 *   - "+ New conversation" stays near the top (quick access)
 *   - Saved threads move to the bottom (workspace history, not primary nav)
 *   - Core routes remain visually primary and positionally stable
 */

'use client';

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Home,
  Cog,
  DollarSign,
  TrendingUp,
  Shield,
  FileText,
  Settings,
  ChevronRight,
  ChevronDown,
  Briefcase,
  Search,
  Bookmark,
  BookOpen,
  Bell,
  Inbox,
  ClipboardList,
  Target,
  Calculator,
  Plus,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@pathos/core';
import { useNav, useNavLink } from '@pathos/adapters';
import {
  usePathAdvisorThreadStore,
  type AdvisorThread,
} from '../stores/pathAdvisorThreadStore';
import {
  DASHBOARD,
  CAREER_READINESS,
  COMPENSATION,
  BENEFITS,
  RETIREMENT,
  RESUME_READINESS,
  CAREER,
  RESUME_BUILDER,
  JOB_SEARCH,
  SAVED_JOBS,
  GUIDED_APPLY_CANON,
  APPLICATION_CONFIDENCE_CENTER,
  EXPLORE_BENEFITS,
  BENEFITS_WORKSPACE,
  ALERTS,
  IMPORT,
  SETTINGS,
} from '../routes/routes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavSection {
  title: string;
  items: NavItem[];
  employeeOnly?: boolean;
  jobSeekerOnly?: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: NavItem[];
  badgeCount?: number;
}

export interface SidebarProps {
  /** Callback when a navigation item is clicked (e.g., close mobile sheet) */
  onNavigate?: () => void;
  /** Whether the current user is a federal employee */
  isEmployee?: boolean;
  /** Display name of the user */
  userName?: string;
  /** Grade+step and agency text for employees */
  userSubtitle?: string;
  /** Total count of new alert matches (badge on Alerts item) */
  alertBadgeCount?: number;
}

// ---------------------------------------------------------------------------
// Static nav definition
// ---------------------------------------------------------------------------

const navSections: NavSection[] = [
  {
    title: 'OVERVIEW',
    items: [
      { label: 'Dashboard', href: DASHBOARD, icon: <Home className="w-4 h-4" /> },
      { label: 'Career Readiness', href: CAREER_READINESS, icon: <Cog className="w-4 h-4" /> },
    ],
  },
  {
    title: 'MONEY & PAY',
    items: [
      { label: 'Compensation', href: COMPENSATION, icon: <DollarSign className="w-4 h-4" /> },
    ],
    employeeOnly: true,
  },
  {
    title: 'BENEFITS',
    items: [
      { label: 'Benefits', href: BENEFITS, icon: <Shield className="w-4 h-4" /> },
    ],
    employeeOnly: true,
  },
  {
    title: 'RETIREMENT',
    items: [
      { label: 'Retirement', href: RETIREMENT, icon: <TrendingUp className="w-4 h-4" /> },
    ],
    employeeOnly: true,
  },
  {
    title: 'CAREER & JOBS',
    items: [
      { label: 'Job Search', href: JOB_SEARCH, icon: <Search className="w-4 h-4" /> },
      { label: 'Saved Jobs', href: SAVED_JOBS, icon: <Bookmark className="w-4 h-4" /> },
      { label: 'Resume Builder', href: RESUME_BUILDER, icon: <FileText className="w-4 h-4" /> },
      { label: 'Resume Readiness', href: RESUME_READINESS, icon: <Briefcase className="w-4 h-4" /> },
      { label: 'Application Confidence Center', href: APPLICATION_CONFIDENCE_CENTER, icon: <Target className="w-4 h-4" /> },
      { label: 'Guided Apply', href: GUIDED_APPLY_CANON, icon: <ClipboardList className="w-4 h-4" /> },
    ],
  },
  {
    title: 'EXPLORE',
    items: [
      { label: 'Explore Federal Benefits', href: EXPLORE_BENEFITS, icon: <BookOpen className="w-4 h-4" /> },
      { label: 'Benefits Workspace', href: BENEFITS_WORKSPACE, icon: <Calculator className="w-4 h-4" /> },
    ],
    jobSeekerOnly: true,
  },
  {
    title: 'ALERTS',
    items: [
      { label: 'Alerts Center', href: ALERTS, icon: <Bell className="w-4 h-4" /> },
    ],
  },
  {
    title: 'IMPORT',
    items: [
      { label: 'Import Center', href: IMPORT, icon: <Inbox className="w-4 h-4" /> },
    ],
  },
  {
    title: 'SETTINGS',
    items: [
      { label: 'Settings', href: SETTINGS, icon: <Settings className="w-4 h-4" /> },
    ],
  },
];

// ---------------------------------------------------------------------------
// NavItemRow sub-component
// ---------------------------------------------------------------------------

function NavItemRow(props: {
  item: NavItem;
  isActive: boolean;
  onNavigate?: () => void;
  dataTourId?: string;
  NavLink: ReturnType<typeof useNavLink>;
}) {
  const NavLink = props.NavLink;
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = props.item.children && props.item.children.length > 0;
  const hasBadge = props.item.badgeCount !== undefined && props.item.badgeCount > 0;

  const handleClick = function (e: React.MouseEvent) {
    if (hasChildren) {
      e.preventDefault();
      setIsExpanded(!isExpanded);
    } else if (props.onNavigate) {
      props.onNavigate();
    }
  };

  return (
    <div>
      <NavLink
        href={props.item.href}
        onClick={handleClick}
        data-tour={props.dataTourId}
        className={cn(
          'flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors relative group',
          props.isActive ? 'font-medium' : '',
        )}
      >
        {/* Active indicator bar (restrained accent) */}
        {props.isActive && (
          <div
            className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r"
            style={{ background: 'var(--p-accent)' }}
          />
        )}
        {/* Row background */}
        <div
          className="absolute inset-0 rounded-md transition-colors"
          style={{
            background: props.isActive ? 'var(--p-accent-bg)' : 'transparent',
          }}
        />
        <span className="flex-shrink-0 relative" style={{ color: props.isActive ? 'var(--p-accent)' : 'var(--p-text-dim)', zIndex: 1 }}>{props.item.icon}</span>
        <span className="flex-1 relative" style={{ color: props.isActive ? 'var(--p-text)' : 'var(--p-text-muted)', zIndex: 1 }}>{props.item.label}</span>
        {hasBadge && (
          <span
            className="flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center relative"
            style={{ zIndex: 1, background: 'var(--p-danger)', color: '#fff' }}
          >
            {props.item.badgeCount}
          </span>
        )}
        {hasChildren && (
          <ChevronRight className={cn('w-4 h-4 transition-transform relative', isExpanded && 'rotate-90')} style={{ color: 'var(--p-text-dim)', zIndex: 1 }} />
        )}
      </NavLink>
      {hasChildren && isExpanded && props.item.children && (
        <div className="ml-6 mt-1 space-y-1">
          {props.item.children.map(function (child) {
            return (
              <NavLink
                key={child.href}
                href={child.href}
                onClick={props.onNavigate}
                className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors"
              >
                <span className="flex-shrink-0" style={{ color: 'var(--p-text-dim)' }}>{child.icon}</span>
                <span className="flex-1" style={{ color: 'var(--p-text-muted)' }}>{child.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NEW CONVERSATION BUTTON (TOP ZONE)
// ---------------------------------------------------------------------------
//
// WHY THIS EXISTS AS A SEPARATE COMPONENT:
// The information architecture refinement splits the old PathAdvisorThreadSection
// into two pieces: this button (top of sidebar, near Dashboard) and the
// RecentConversationsSection (bottom of sidebar). Keeping this component
// isolated means the main Sidebar layout can place it exactly where it
// belongs — right after the OVERVIEW section — without dragging along
// thread list rendering logic.
//
// PRODUCT DECISION:
// "+ New conversation" must remain near the top of the sidebar so starting
// a PathAdvisor session is always quick and discoverable. It must NOT be
// pushed down by thread history or moved into the bottom history section.
//
// INTERACTION STATES (per house rules):
// - hover: surface2 background
// - focus-visible: ring-2 accent ring
// - active: slight opacity shift

/**
 * Renders the "+ New conversation" button.
 *
 * HOW IT WORKS:
 * A stateless button that calls onNewConversation when clicked. The parent
 * Sidebar handles the actual logic (clear active thread, navigate to
 * /dashboard, close mobile sheet). This component is purely presentational.
 *
 * WHY A BUTTON (NOT A LINK):
 * "New conversation" is an action (clear active thread), not a navigation
 * destination. It does not correspond to a route. Using <button> with
 * type="button" communicates the correct semantics to screen readers and
 * prevents form submission in any parent form context.
 */
function NewConversationButton(props: {
  onNewConversation: () => void;
}) {
  return (
    <div className="mb-1" data-testid="new-conversation-section">
      <button
        type="button"
        onClick={props.onNewConversation}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-1.5 text-[13px] font-medium',
          'rounded-md transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          'active:opacity-75',
        )}
        style={{
          color: 'var(--p-accent)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          '--tw-ring-color': 'var(--p-accent)',
        } as React.CSSProperties}
        onMouseEnter={function (e) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--p-surface2)';
        }}
        onMouseLeave={function (e) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
        aria-label="Start a new PathAdvisor conversation"
      >
        <Plus className="w-4 h-4" style={{ color: 'var(--p-accent)' }} />
        <span>New conversation</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RECENT CONVERSATIONS SECTION (BOTTOM ZONE)
// ---------------------------------------------------------------------------
//
// WHY THIS EXISTS:
// Saved PathAdvisor threads are user-generated workspace artifacts — they are
// NOT primary navigation destinations like Dashboard, Job Search, or Resume
// Builder. Placing them at the bottom of the sidebar in a collapsible section
// keeps core product routes visually stable and positionally anchored, while
// still giving threads a permanent, discoverable home.
//
// WHY COLLAPSIBLE:
// Users with many saved conversations should be able to tuck the section
// away when they want a clean sidebar. The section defaults to collapsed
// on every page so the sidebar stays clean and navigation-focused. Users
// can expand with one click when they want to see their history. The
// collapse state is local (useState) — it does not persist across page
// refreshes because the cost of re-expanding is trivially low.
//
// INFORMATION ARCHITECTURE:
// The section header reads "Recent conversations" (optionally with a count)
// to communicate that these are working artifacts, not navigation routes.
// The visual treatment is intentionally secondary: dimmer header color,
// smaller thread rows, and a top border to separate from the main nav.
//
// INTERACTION STATES (per house rules):
// - Section header: hover brightens, focus-visible accent ring, active opacity shift
// - Thread rows: hover surface2 bg, focus-visible accent ring, active opacity shift
// - Active thread: accent bg tint + left accent bar (stronger than hover)
//
// MAX VISIBLE THREADS:
// Capped at 10 to prevent a "thread graveyard" effect. The bottom section
// has its own scroll if needed, but 10 threads at ~32px each is ~320px —
// manageable without dominating the sidebar.
//
// INTERNAL SCROLL BEHAVIOR (HARDENING — 2026-04-03):
// Stress testing revealed that even with the MAX_VISIBLE_THREADS cap, the
// thread list can consume significant vertical space in the bottom zone,
// especially on shorter viewports or when the user has 8–10 threads. The
// thread list body (the div containing thread buttons) is now internally
// scrollable with a bounded max-height (THREAD_LIST_MAX_HEIGHT_PX).
//
// HOW IT WORKS:
// - The "Recent conversations" header row always remains visible and is
//   OUTSIDE the scroll container. Collapsing/expanding still works normally.
// - Only the thread entries (buttons) are inside the scroll container.
// - When the list is shorter than the max height, no scrollbar appears
//   and the section looks exactly the same as before.
// - When the list exceeds the max height, the container clips and shows
//   a subtle scrollbar (browser-native, no custom scrollbar styling).
// - The scroll container uses overflow-y: auto (not scroll), so the
//   scrollbar only appears when needed.
//
// WHY THIS PRESERVES THE INFORMATION ARCHITECTURE:
// The three-zone sidebar layout depends on the bottom zone being bounded.
// Without a max height, the thread list could grow taller than the main
// nav zone, undermining the stability guarantee. The internal scroll keeps
// the bottom zone predictably sized while still giving users access to all
// their conversations via scroll.
//
// TRADEOFFS:
// - Collapse state is not persisted to localStorage. This is intentional:
//   the section defaults to collapsed on every page load, and the
//   collapse state is a transient UI preference, not a data model concern.
// - The thread count in the header shows total thread count, not visible count.
//   This helps users know how many conversations they have even if the list
//   is capped at MAX_VISIBLE_THREADS.
// - The max height is a fixed pixel value, not viewport-relative. This is
//   deliberate: a percentage-based height would couple the thread section
//   to viewport size in unpredictable ways and make the sidebar layout
//   harder to reason about. A fixed cap keeps behavior consistent.
// - Scrollbar styling is browser-native. No custom scrollbar CSS is added
//   unless the repo already has a scrollbar utility class. This keeps the
//   visual treatment calm and consistent with the main nav zone's overflow.
//
// FUTURE EXTENSION POINTS:
// - Thread deletion (swipe-to-delete or context menu on individual threads)
// - Thread search/filter within the section
// - "Show all" link that navigates to a dedicated thread management view
// - Pinned threads that appear above the recent list
// - Persistence of collapse state if user research indicates it matters
// - Viewport-adaptive max height (e.g. shorter on mobile sheets)
// - Scroll-to-active: auto-scroll the list so the active thread is visible
//   when the section first expands or when the user switches threads

/**
 * Maximum number of threads to show in the Recent Conversations section.
 *
 * WHY 10:
 * The bottom section does not displace primary navigation, so it can afford
 * to show slightly more threads than the old top-placed section (which was 8).
 * 10 threads at ~32px each is ~320px — still fits within typical sidebar
 * height alongside the main nav and user card.
 */
const MAX_VISIBLE_THREADS = 10;

/**
 * Maximum pixel height for the scrollable thread list body.
 *
 * WHY 260px:
 * This is the bounded height for the scrollable thread entries container.
 * At ~32px per thread row, 260px comfortably fits ~8 threads without
 * scrolling and starts scrolling around thread 9–10. The value was chosen
 * to sit in the middle of the 220–320px usability range:
 *   - 220px would feel tight with 7+ threads (frequent scrolling)
 *   - 320px would consume too much bottom-zone real estate on 768px laptops
 *   - 260px balances visibility and bounded height
 *
 * WHY A CONSTANT (NOT CSS):
 * Defined here as a JS constant so it can be referenced in both the
 * inline style (for the actual max-height) and in tests (to verify the
 * scrollable container has the expected constraint). Using a CSS class
 * would work but would make the test assertion less direct.
 *
 * TRADEOFF:
 * This is a fixed pixel value. On very short viewports (e.g. 600px),
 * 260px may still be too generous. A future enhancement could make this
 * viewport-adaptive, but for typical desktop sidebar usage this is solid.
 */
export const THREAD_LIST_MAX_HEIGHT_PX = 260;

/**
 * Collapsible "Recent conversations" section for the sidebar bottom zone.
 *
 * HOW IT WORKS:
 * 1. Renders a clickable section header with chevron toggle.
 * 2. When expanded, shows up to MAX_VISIBLE_THREADS thread rows.
 * 3. Active thread is highlighted with accent styling matching NavItemRow.
 * 4. Clicking a thread calls onSelectThread (parent handles navigation).
 * 5. Section collapses/expands via local isCollapsed state.
 *
 * WHY THIS IS A SEPARATE COMPONENT:
 * Keeps the bottom-zone thread history logic isolated from the main Sidebar
 * layout. The section has its own collapse state and thread-list rendering
 * that is logically distinct from the static nav sections above.
 */
function RecentConversationsSection(props: {
  threads: AdvisorThread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  /** Whether the current route is /dashboard (for highlighting context). */
  isOnDashboard: boolean;
}) {
  /**
   * Local collapse/expand state.
   *
   * WHY DEFAULT COLLAPSED:
   * The Recent conversations section defaults to collapsed on every page
   * load. Core product navigation is the primary sidebar content — saved
   * threads are secondary workspace artifacts. Defaulting to collapsed
   * keeps the sidebar clean and focused on navigation. Users who want to
   * see their conversation history can expand with one click. This also
   * ensures the bottom zone never competes with the main nav for visual
   * attention on initial render.
   *
   * WHY NOT PERSISTED:
   * This is a transient UI preference. The cost of re-expanding on page
   * load is one click — not worth the complexity of localStorage persistence
   * for a collapse toggle.
   */
  const [isCollapsed, setIsCollapsed] = useState(true);

  /**
   * If there are no threads, don't render the section at all.
   *
   * WHY HIDE WHEN EMPTY:
   * An empty "Recent conversations" section with zero items would look
   * broken and waste space. The section appears naturally when the user
   * creates their first conversation thread.
   */
  if (props.threads.length === 0) {
    return null;
  }

  /**
   * Limit visible threads to MAX_VISIBLE_THREADS.
   * The threads array is already sorted newest-first from the store.
   */
  const visibleThreads: AdvisorThread[] = [];
  const limit = props.threads.length < MAX_VISIBLE_THREADS
    ? props.threads.length
    : MAX_VISIBLE_THREADS;
  for (let i = 0; i < limit; i++) {
    visibleThreads.push(props.threads[i]);
  }

  /**
   * Total thread count for the section header.
   * Shows the full count so users know how many conversations exist,
   * even if the visible list is capped at MAX_VISIBLE_THREADS.
   */
  const threadCount = props.threads.length;

  return (
    <div
      data-testid="recent-conversations-section"
      style={{ borderTop: '1px solid var(--p-border)' }}
      className="px-3 py-2"
    >
      {/*
        Section header — clickable to toggle collapse/expand.

        WHY A BUTTON:
        The header is an interactive toggle, not a heading-only element.
        Using <button> ensures keyboard accessibility (Enter/Space to toggle)
        and correct screen reader semantics. The aria-expanded attribute
        communicates the current state to assistive technology.

        VISUAL TREATMENT:
        Intentionally secondary — dimmer text color, smaller font, uppercase
        tracking — to differentiate from primary nav section headers. This
        signals "workspace history" rather than "product navigation."
      */}
      <button
        type="button"
        onClick={function () { setIsCollapsed(!isCollapsed); }}
        className={cn(
          'flex items-center gap-1.5 w-full py-1 text-[11px] font-semibold uppercase',
          'tracking-[var(--p-letter-spacing-section)]',
          'rounded transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          'active:opacity-75',
        )}
        style={{
          color: 'var(--p-text-dim)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          '--tw-ring-color': 'var(--p-accent)',
        } as React.CSSProperties}
        onMouseEnter={function (e) {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--p-text-muted)';
        }}
        onMouseLeave={function (e) {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--p-text-dim)';
        }}
        aria-expanded={!isCollapsed}
        aria-controls="recent-conversations-list"
        aria-label={
          isCollapsed
            ? 'Expand recent conversations'
            : 'Collapse recent conversations'
        }
      >
        {/*
          Chevron indicator — rotates to show collapse/expand state.
          ChevronRight when collapsed, ChevronDown when expanded.
          Using two icons instead of CSS rotation for clarity.
        */}
        {isCollapsed ? (
          <ChevronRight className="w-3 h-3 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        )}
        <span>Recent conversations</span>
        {/*
          Thread count badge — shows total number of saved threads.

          WHY SHOW THE COUNT:
          Helps users understand their conversation volume at a glance.
          Especially useful when the section is collapsed — users can see
          "Recent conversations (4)" without expanding.
        */}
        <span
          className="text-[10px] font-normal"
          style={{ color: 'var(--p-text-dim)' }}
        >
          ({String(threadCount)})
        </span>
      </button>

      {/*
        Thread list — only rendered when expanded.

        WHY BUTTONS (NOT LINKS):
        Clicking a thread sets the active thread AND navigates to /dashboard.
        However, the primary action is "switch thread" (state change), and
        the navigation is a side effect. Using buttons with onClick handlers
        keeps the interaction model clean and avoids stale link hrefs.

        SCROLL BEHAVIOR (HARDENING — 2026-04-03):
        The thread list body is now a bounded, internally scrollable container.
        - maxHeight caps the list at THREAD_LIST_MAX_HEIGHT_PX (260px).
        - overflowY: 'auto' shows a scrollbar only when content exceeds the cap.
        - The "Recent conversations" header row is OUTSIDE this container,
          so it always remains visible regardless of scroll position.
        - Keyboard navigation (Tab/Arrow keys) still works inside the scrollable
          region — browsers natively handle focus-driven scrolling within
          overflow containers, so no custom scroll-into-view logic is needed.
        - The visual feel is intentionally calm: no explicit border or shadow
          on the scroll container. The overflow clip itself is the only visual
          signal that more content exists below the fold.

        WHY data-testid="recent-conversations-scroll-body":
        Tests need to verify that the scrollable container exists and has the
        expected max-height constraint. The data-testid provides a stable
        selector for structural assertions without coupling to class names.
      */}
      {!isCollapsed ? (
        <div
          id="recent-conversations-list"
          data-testid="recent-conversations-scroll-body"
          className="mt-1 space-y-0.5"
          role="list"
          aria-label="Recent PathAdvisor conversations"
          style={{
            maxHeight: String(THREAD_LIST_MAX_HEIGHT_PX) + 'px',
            overflowY: 'auto',
          }}
        >
          {visibleThreads.map(function (thread) {
            /**
             * Determine if this thread is the active (selected) one.
             * Active = activeThreadId matches AND we're on the dashboard.
             *
             * WHY REQUIRE isOnDashboard:
             * A thread should only appear "active" when the user is actually
             * viewing it on the dashboard. If the user navigates to Job Search,
             * no thread should be highlighted — even though activeThreadId
             * still points to the last-viewed thread in the store.
             */
            const isActive = props.activeThreadId === thread.id && props.isOnDashboard;

            return (
              <button
                key={thread.id}
                type="button"
                role="listitem"
                onClick={function () {
                  props.onSelectThread(thread.id);
                }}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-1.5 text-[13px]',
                  'rounded-md transition-colors duration-150 relative',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                  'active:opacity-75',
                  isActive ? 'font-medium' : '',
                )}
                style={{
                  color: isActive ? 'var(--p-text)' : 'var(--p-text-muted)',
                  background: isActive ? 'var(--p-accent-bg)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  '--tw-ring-color': 'var(--p-accent)',
                } as React.CSSProperties}
                onMouseEnter={function (e) {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--p-surface2)';
                  }
                }}
                onMouseLeave={function (e) {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }
                }}
                title={thread.title}
                aria-label={'Open conversation: ' + thread.title}
                aria-current={isActive ? 'true' : undefined}
              >
                {/* Active indicator bar — accent left border matching NavItemRow pattern */}
                {isActive ? (
                  <div
                    className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r"
                    style={{ background: 'var(--p-accent)' }}
                  />
                ) : null}

                {/* Thread icon — small message bubble */}
                <MessageSquare
                  className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: isActive ? 'var(--p-accent)' : 'var(--p-text-dim)' }}
                />

                {/*
                  Thread title — truncated with CSS ellipsis.

                  WHY CSS TRUNCATION:
                  Titles are already short (3–6 words from generateThreadTitle),
                  but edge cases or future manual titles could be longer. CSS
                  truncation is more resilient than JS substring.
                */}
                <span className="flex-1 min-w-0 truncate">{thread.title}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Main Sidebar
// ---------------------------------------------------------------------------
//
// LAYOUT ARCHITECTURE (REFINEMENT — 2026-04-03):
// The sidebar uses a flex column layout with three zones:
//
//   1. HEADER (flex-shrink-0): Brand, subtitle, persona label.
//   2. MAIN NAV (flex-1, overflow-y-auto): Dashboard + New conversation +
//      all product navigation sections. This zone scrolls independently
//      if the nav is taller than available space.
//   3. BOTTOM ZONE (flex-shrink-0): Recent conversations (collapsible) +
//      user card. These sit below the main nav and do not scroll with it.
//
// WHY THIS LAYOUT:
// The main nav zone is the primary content and gets all available space.
// The bottom zone is anchored so the user card and recent conversations
// are always visible (or at least the collapse header is). If the main
// nav overflows, it scrolls internally without pushing the bottom zone
// off-screen.
//
// TRADEOFF:
// If both the main nav AND the recent conversations section are very tall,
// the bottom zone could consume significant screen real estate. This is
// mitigated by: (a) MAX_VISIBLE_THREADS cap on the thread list, and
// (b) the collapsible toggle that lets users reclaim space.

export function Sidebar(props: SidebarProps) {
  const nav = useNav();
  const NavLink = useNavLink();
  const pathname = nav.pathname;
  const isEmployee = props.isEmployee !== undefined && props.isEmployee !== null ? props.isEmployee : false;
  const userName = props.userName !== undefined && props.userName !== null ? props.userName : 'User';
  const alertBadgeCount = props.alertBadgeCount !== undefined && props.alertBadgeCount !== null ? props.alertBadgeCount : 0;

  // ==========================================================================
  // PATHADVISOR THREAD STORE INTEGRATION
  // ==========================================================================
  //
  // WHY READ THE STORE HERE:
  // The Sidebar needs threads for the bottom-zone thread list, activeThreadId
  // for highlighting the current thread, and the action methods for handling
  // clicks. Reading from the store here keeps NewConversationButton and
  // RecentConversationsSection as pure presentational components that
  // receive props.
  //
  // WHY HYDRATE IN useEffect:
  // The store starts empty and loads persisted state from localStorage via
  // hydrate(). This must happen in useEffect (not during render) because
  // localStorage is a browser API that doesn't exist during SSR.

  const threads = usePathAdvisorThreadStore(function (s) { return s.threads; });
  const activeThreadId = usePathAdvisorThreadStore(function (s) { return s.activeThreadId; });
  const hydrated = usePathAdvisorThreadStore(function (s) { return s.hydrated; });
  const hydrate = usePathAdvisorThreadStore(function (s) { return s.hydrate; });
  const clearActiveThread = usePathAdvisorThreadStore(function (s) { return s.clearActiveThread; });
  const setActiveThread = usePathAdvisorThreadStore(function (s) { return s.setActiveThread; });

  /**
   * Destructure onNavigate at the top level so React Compiler can track the
   * dependency precisely. This avoids the "existing memoization could not be
   * preserved" lint error when useCallback dep arrays reference props.onNavigate.
   */
  const propOnNavigate = props.onNavigate;

  /**
   * Hydrate the thread store from localStorage on mount.
   * Only runs once (hydrate is a stable function reference from Zustand).
   */
  useEffect(function () {
    if (!hydrated) {
      hydrate();
    }
  }, [hydrated, hydrate]);

  /**
   * Handle "+ New conversation" click.
   *
   * WHAT IT DOES:
   * 1. Clears the active thread (dashboard shows empty state).
   * 2. Navigates to /dashboard (in case user is on another page).
   * 3. Calls onNavigate (closes mobile sidebar sheet if open).
   *
   * WHY NAVIGATE:
   * The user might click "New conversation" while on /dashboard/job-search.
   * We need to bring them to /dashboard for the PathAdvisor empty state.
   */
  const handleNewConversation = useCallback(function () {
    clearActiveThread();
    nav.push(DASHBOARD);
    if (propOnNavigate !== undefined && propOnNavigate !== null) {
      propOnNavigate();
    }
  }, [clearActiveThread, nav, propOnNavigate]);

  /**
   * Handle thread selection from the bottom-zone thread list.
   *
   * WHAT IT DOES:
   * 1. Sets the selected thread as active.
   * 2. Navigates to /dashboard (thread renders there).
   * 3. Calls onNavigate (closes mobile sidebar sheet if open).
   */
  const handleSelectThread = useCallback(function (threadId: string) {
    setActiveThread(threadId);
    nav.push(DASHBOARD);
    if (propOnNavigate !== undefined && propOnNavigate !== null) {
      propOnNavigate();
    }
  }, [setActiveThread, nav, propOnNavigate]);

  /** Whether the current route is /dashboard (for active thread highlighting). */
  const isOnDashboard = pathname === DASHBOARD;

  // Build visible sections with optional badge injection
  const visibleSections: NavSection[] = [];
  for (let i = 0; i < navSections.length; i++) {
    const section = navSections[i];
    if (section.employeeOnly && !isEmployee) continue;
    if (section.jobSeekerOnly && isEmployee) continue;

    if (section.title === 'ALERTS' && alertBadgeCount > 0) {
      const itemsWithBadge: NavItem[] = [];
      for (let j = 0; j < section.items.length; j++) {
        const item = section.items[j];
        if (item.href === ALERTS) {
          itemsWithBadge.push(Object.assign({}, item, { badgeCount: alertBadgeCount }));
        } else {
          itemsWithBadge.push(item);
        }
      }
      visibleSections.push(Object.assign({}, section, { items: itemsWithBadge }));
    } else {
      visibleSections.push(section);
    }
  }

  const isItemActive = function (itemHref: string): boolean {
    if (itemHref === DASHBOARD) {
      return pathname === DASHBOARD;
    }
    if (itemHref === CAREER_READINESS) {
      return pathname === CAREER_READINESS;
    }
    if (itemHref === RESUME_READINESS) {
      return pathname === RESUME_READINESS || pathname === CAREER;
    }
    if (itemHref === EXPLORE_BENEFITS) {
      return pathname === EXPLORE_BENEFITS;
    }
    return pathname === itemHref || pathname.indexOf(itemHref + '/') === 0;
  };

  // Tour data attributes (hrefs from route constants)
  const tourMap: Record<string, string> = {
    [CAREER_READINESS]: 'nav-career-readiness',
    [RESUME_READINESS]: 'nav-resume-readiness',
    [RESUME_BUILDER]: 'nav-resume-builder',
    [JOB_SEARCH]: 'nav-job-search',
    [EXPLORE_BENEFITS]: 'nav-benefits',
    [ALERTS]: 'nav-alerts',
    [IMPORT]: 'nav-import',
  };

  // User initials
  const initials = userName
    .split(' ')
    .map(function (n) { return n[0]; })
    .join('');

  return (
    <aside
      className="w-64 flex flex-col h-full"
      role="navigation"
      aria-label="Main sidebar navigation"
      style={{ background: 'var(--p-surface)', borderRight: '1px solid var(--p-border)' }}
    >
      {/*
        ================================================================
        ZONE 1: HEADER — Brand, subtitle, persona label.
        ================================================================
        flex-shrink-0 so it never collapses even if the sidebar is short.
      */}
      <div className="flex-shrink-0 px-3 py-3" style={{ borderBottom: '1px solid var(--p-border)' }}>
        <h2 className="text-base font-semibold" style={{ color: 'var(--p-text)' }}>PathOS</h2>
        <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--p-accent-muted)' }}>Career Intelligence Dashboard</p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--p-text-dim)' }}>
          {isEmployee ? 'For federal employees' : 'For federal job seekers'}
        </p>
      </div>

      {/*
        ================================================================
        ZONE 2: MAIN NAV — Dashboard, + New conversation, all product
        navigation sections. This zone gets flex-1 and scrolls
        independently if the nav is taller than available space.
        ================================================================

        WHY + NEW CONVERSATION IS HERE (NOT IN THE BOTTOM ZONE):
        The product decision is that starting a new conversation must be
        quick and discoverable. Placing the button near the Dashboard
        entry point (top of the nav) means it is always visible without
        scrolling, regardless of how many threads exist. Moving it to
        the bottom zone would bury the primary PathAdvisor entry action
        below all navigation sections.

        LAYOUT ORDER:
        1. OVERVIEW section (Dashboard, Career Readiness)
        2. + New conversation button
        3. Remaining nav sections (Career & Jobs, Explore, etc.)
      */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {visibleSections.map(function (section, sectionIndex) {
          return (
            <div key={section.title}>
              <h3
                className="text-[11px] font-semibold uppercase tracking-[var(--p-letter-spacing-section)] px-3 mb-1"
                style={{ color: 'var(--p-text-dim)' }}
              >
                {section.title}
              </h3>
              <div className="space-y-0.5">
                {section.items.map(function (item) {
                  return (
                    <NavItemRow
                      key={item.href}
                      item={item}
                      isActive={isItemActive(item.href)}
                      onNavigate={props.onNavigate}
                      dataTourId={tourMap[item.href]}
                      NavLink={NavLink}
                    />
                  );
                })}
              </div>

              {/*
                Insert "+ New conversation" button after the OVERVIEW section.

                WHY AFTER OVERVIEW:
                The OVERVIEW section contains Dashboard and Career Readiness.
                Placing the new-conversation button right after OVERVIEW means
                it appears just below Dashboard — the natural entry point for
                PathAdvisor. This keeps it visually associated with PathAdvisor
                without creating a separate "PATHADVISOR" section header that
                would add visual weight.

                WHY sectionIndex === 0:
                The OVERVIEW section is always the first visible section
                (it has no employeeOnly or jobSeekerOnly filter). Checking
                sectionIndex === 0 is a safe, stable way to target it.
              */}
              {sectionIndex === 0 ? (
                <NewConversationButton
                  onNewConversation={handleNewConversation}
                />
              ) : null}
            </div>
          );
        })}
      </nav>

      {/*
        ================================================================
        ZONE 3: BOTTOM — Recent conversations (collapsible) + user card.
        ================================================================
        flex-shrink-0 so these elements stay anchored at the bottom and
        don't get pushed off-screen by the main nav scroll.

        WHY RECENT CONVERSATIONS IS HERE (NOT IN THE MAIN NAV):
        Threads are user-generated workspace artifacts. Placing them in
        the main nav zone caused them to push down primary product routes
        when the user had many saved conversations. The bottom zone keeps
        threads accessible without displacing core navigation.
      */}
      <div className="flex-shrink-0">
        {/*
          Recent conversations section — collapsible list of saved threads.
          Only renders when threads exist (hides entirely when empty).
        */}
        <RecentConversationsSection
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={handleSelectThread}
          isOnDashboard={isOnDashboard}
        />

        {/* User identity card — always visible at the very bottom. */}
        <div className="px-3 py-2" style={{ borderTop: '1px solid var(--p-border)' }}>
          <div
            className="flex items-center gap-2.5 px-3 py-2"
            style={{ background: 'var(--p-surface2)', borderRadius: 'var(--p-radius)' }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'var(--p-accent-bg)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--p-accent)' }}>{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--p-text)' }}>{userName}</p>
              <p className="text-xs truncate" style={{ color: 'var(--p-text-dim)' }}>
                {isEmployee ? (props.userSubtitle !== undefined && props.userSubtitle !== null ? props.userSubtitle : 'Federal Employee') : 'Federal Applicant'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
