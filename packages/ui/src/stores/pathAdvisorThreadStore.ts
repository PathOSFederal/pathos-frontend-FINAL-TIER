/**
 * ============================================================================
 * PATHADVISOR THREAD STORE — Conversation persistence and thread navigation
 * ============================================================================
 *
 * WHY THIS FILE EXISTS:
 * PathAdvisor on the Dashboard supports multiple saved conversation threads.
 * Users can start a new conversation, send messages, and later switch back
 * to any previous thread. This store owns the entire lifecycle:
 *   - Creating threads (only on first message, never on "new conversation" click)
 *   - Storing messages within threads
 *   - Switching active threads
 *   - Persisting everything to localStorage so threads survive page refresh
 *
 * ARCHITECTURE FIT:
 * - Lives in packages/ui/src/stores (shared, transport-agnostic).
 * - Used by DashboardScreen to read/write the active conversation.
 * - Used by Sidebar to render the thread list and handle thread switching.
 * - No next/* or electron/* imports (BOUNDARY RULE).
 *
 * DATA MODEL:
 * - AdvisorThread: a full conversation with id, title, timestamps, messages.
 * - AdvisorThreadMessage: a single message (user or advisor role + content).
 * - Threads are stored as a flat array, ordered by updatedAt descending.
 * - activeThreadId points to the currently visible thread (null = empty state).
 *
 * PERSISTENCE:
 * - Every mutation (create, add message, switch, clear) writes the full state
 *   to localStorage via the PATHADVISOR_THREADS_STORAGE_KEY.
 * - On store creation, we attempt to hydrate from localStorage.
 * - If localStorage is unavailable (SSR, quota exceeded), the store works
 *   in memory-only mode with no persistence. No errors are thrown.
 *
 * THREAD CREATION RULE (CRITICAL):
 * Clicking "New conversation" does NOT create a thread. It only clears
 * activeThreadId so the dashboard shows the empty state. A thread is
 * created ONLY when the user submits their first message. This prevents
 * empty/abandoned threads from cluttering the sidebar.
 *
 * THREAD TITLING:
 * Auto-generated from the first user message via generateThreadTitle().
 * Titles are short (3–6 words), heuristic-based, and can be edited later
 * (no edit UI required yet).
 *
 * REPO RULES OBSERVED:
 * - No var (const/let only).
 * - No ?. (explicit null checks).
 * - No ?? (explicit ternaries).
 * - No ... (spread) — explicit array/object construction.
 * - Over-commented with teaching-level headers.
 */

import { create } from 'zustand';

// ============================================================================
// TYPES — Thread and message models
// ============================================================================

/**
 * A single message within a PathAdvisor conversation thread.
 *
 * WHY SEPARATE FROM DashboardScreen's ThreadMessage:
 * DashboardScreen's ThreadMessage includes a `governed` field for structured
 * evidence rendering. This store-level message is a persistence-focused model
 * that stores the raw content. The governed data is ephemeral UI state that
 * does not need to persist across sessions (it will be regenerated from the
 * API in production). Keeping the persistence model lean avoids bloating
 * localStorage with large governed payloads.
 *
 * ROLE VALUES:
 * - 'user': message sent by the human user
 * - 'advisor': response from PathAdvisor (not 'assistant' — we use 'advisor'
 *   to match the product vocabulary; DashboardScreen maps this to its own
 *   'assistant' role for rendering)
 */
export interface AdvisorThreadMessage {
  /** Unique message ID within the thread. */
  id: string;
  /** Who sent this message: the user or PathAdvisor. */
  role: 'user' | 'advisor';
  /** The text content of the message. */
  content: string;
  /** ISO 8601 timestamp of when the message was created. */
  timestamp: string;
}

/**
 * A full PathAdvisor conversation thread.
 *
 * WHY THIS SHAPE:
 * Each thread is a self-contained conversation with its own identity, title,
 * and message history. The title is auto-generated from the first user message
 * and can be overridden later. Timestamps track creation and last activity
 * for sorting and display purposes.
 *
 * OPTIONAL SUMMARY:
 * Reserved for future use — a short AI-generated summary of the conversation
 * that could appear in the sidebar or thread list hover tooltip.
 */
export interface AdvisorThread {
  /** Unique thread ID (generated at creation time). */
  id: string;
  /** Short display title (auto-generated from first message, 3–6 words). */
  title: string;
  /** ISO 8601 timestamp of thread creation. */
  createdAt: string;
  /** ISO 8601 timestamp of last message or activity. */
  updatedAt: string;
  /** Ordered array of messages in this thread (oldest first). */
  messages: AdvisorThreadMessage[];
  /** Optional short summary for sidebar tooltip (future use). */
  summary: string | null;
}


// ============================================================================
// THREAD TITLE GENERATION
// ============================================================================
//
// WHY A HEURISTIC:
// Full AI-powered title generation would require an API call, adding latency
// to the first-message experience. A simple heuristic that truncates and
// normalizes the first user message provides instant titles that are "good
// enough" for navigation. AI-powered titles can be added as an async
// enhancement later (backfill after the thread is created).
//
// ALGORITHM:
// 1. Strip leading question words ("how", "why", "what", "can", etc.)
// 2. Strip trailing punctuation
// 3. Capitalize first letter
// 4. Truncate to ~40 characters at a word boundary
// 5. If the result is too short (<3 chars), fall back to "New conversation"

/**
 * Common question-start words to strip for cleaner titles.
 * Ordered roughly by frequency in PathAdvisor queries.
 */
const QUESTION_PREFIXES: string[] = [
  'how do i ',
  'how can i ',
  'how to ',
  'what is ',
  'what are ',
  'what should ',
  'what do ',
  'why was ',
  'why is ',
  'why did ',
  'why am ',
  'can you ',
  'can i ',
  'could you ',
  'should i ',
  'tell me about ',
  'show me ',
  'help me ',
  'i want to ',
  'i need to ',
  'am i ',
  'is my ',
  'decode my ',
  'explain my ',
];

/**
 * Generate a short thread title from the first user message.
 *
 * HOW IT WORKS:
 * 1. Lowercases the input for prefix matching.
 * 2. Strips the first matching question prefix (if any).
 * 3. Strips trailing punctuation (? . !).
 * 4. Capitalizes the first letter.
 * 5. Truncates at ~40 chars on a word boundary.
 * 6. Falls back to "New conversation" if the result is too short.
 *
 * EXAMPLES:
 * - "Am I competitive for GS-13 roles?" → "Competitive for GS-13 roles"
 * - "Why was I not referred?" → "Not referred"
 * - "Decode my latest application status" → "Latest application status"
 * - "Show me strong-fit jobs" → "Strong-fit jobs"
 * - "Hi" → "New conversation"
 *
 * @param firstMessage - The raw text of the first user message.
 * @returns A short display title (3–6 words typically).
 */
export function generateThreadTitle(firstMessage: string): string {
  /** Work with a trimmed copy; never mutate the input. */
  let text = firstMessage.trim();

  /**
   * If the message is empty or trivially short, use the fallback.
   * 3 chars is the minimum to form a meaningful title word.
   */
  if (text.length < 3) {
    return 'New conversation';
  }

  /** Lowercase for prefix matching (preserving the original for output). */
  const lower = text.toLowerCase();

  /**
   * Strip the first matching question prefix.
   *
   * WHY ONLY THE FIRST MATCH:
   * We iterate through prefixes and break on the first hit. This avoids
   * double-stripping in edge cases like "How do I tell me about..." which
   * would be mangled by stripping both "how do i " and "tell me about ".
   */
  for (let i = 0; i < QUESTION_PREFIXES.length; i++) {
    const prefix = QUESTION_PREFIXES[i];
    if (lower.indexOf(prefix) === 0) {
      text = text.substring(prefix.length);
      break;
    }
  }

  /** Strip trailing punctuation (? . ! ,) — these are noise in a title. */
  while (text.length > 0) {
    const lastChar = text.charAt(text.length - 1);
    if (lastChar === '?' || lastChar === '.' || lastChar === '!' || lastChar === ',') {
      text = text.substring(0, text.length - 1).trim();
    } else {
      break;
    }
  }

  /** Re-check length after stripping. */
  if (text.length < 3) {
    return 'New conversation';
  }

  /** Capitalize the first letter of the result. */
  text = text.charAt(0).toUpperCase() + text.substring(1);

  /**
   * Truncate at ~40 characters on a word boundary.
   *
   * WHY 40 CHARS:
   * Sidebar nav items are ~200px wide. At 13px font size, ~40 chars fills
   * the space well without overflow. Truncating on a word boundary avoids
   * cutting words in half.
   */
  const MAX_TITLE_LENGTH = 40;
  if (text.length > MAX_TITLE_LENGTH) {
    /** Find the last space before the limit. */
    const truncateAt = text.lastIndexOf(' ', MAX_TITLE_LENGTH);
    if (truncateAt > 10) {
      text = text.substring(0, truncateAt);
    } else {
      /** No good word boundary found; hard-truncate. */
      text = text.substring(0, MAX_TITLE_LENGTH);
    }
  }

  return text;
}


// ============================================================================
// PERSISTENCE HELPERS
// ============================================================================
//
// WHY MANUAL PERSISTENCE (NOT ZUSTAND MIDDLEWARE):
// Zustand's `persist` middleware uses spread operators and optional chaining
// internally, which conflicts with this repo's hard constraints. Manual
// persistence via explicit read/write functions is more transparent, easier
// to debug, and fully compliant with repo rules.

/**
 * The localStorage key for thread persistence.
 * Matches the constant in lib/storage-keys.ts.
 */
const STORAGE_KEY = 'pathos-pathadvisor-threads-v1';

/**
 * Shape of the persisted data in localStorage.
 * Contains only serializable state (no functions).
 */
interface PersistedThreadState {
  threads: AdvisorThread[];
  activeThreadId: string | null;
}

/**
 * Read persisted thread state from localStorage.
 *
 * HOW IT WORKS:
 * 1. Check if localStorage is available (handles SSR and restricted contexts).
 * 2. Try to read the storage key.
 * 3. Parse the JSON.
 * 4. Return the parsed state or null on any failure.
 *
 * WHY CHECK typeof localStorage:
 * In SSR (Node), there is no localStorage unless polyfilled. In tests,
 * vitest.setup.ts polyfills localStorage on globalThis. Checking for
 * localStorage directly (instead of window) works in both browser and
 * polyfilled test environments.
 *
 * WHY TRY/CATCH:
 * localStorage can throw in restricted contexts (incognito mode quotas,
 * iframe restrictions, etc.). We never let storage failures crash the app.
 *
 * @returns The persisted state, or null if unavailable/corrupt.
 */
function loadPersistedState(): PersistedThreadState | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null || raw === '') {
      return null;
    }
    const parsed = JSON.parse(raw);
    /**
     * Basic shape validation: ensure threads is an array and
     * activeThreadId is either a string or null.
     */
    if (parsed !== null && parsed !== undefined && Array.isArray(parsed.threads)) {
      return {
        threads: parsed.threads,
        activeThreadId: typeof parsed.activeThreadId === 'string' ? parsed.activeThreadId : null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write thread state to localStorage.
 *
 * HOW IT WORKS:
 * Serializes the threads array and activeThreadId to JSON, then writes
 * to localStorage. Failures are silently ignored (no data loss since
 * the in-memory store is the source of truth).
 *
 * @param state - The state to persist.
 */
function savePersistedState(state: PersistedThreadState): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    const serialized = JSON.stringify({
      threads: state.threads,
      activeThreadId: state.activeThreadId,
    });
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    /* Silently ignore write failures (quota exceeded, etc.) */
  }
}


// ============================================================================
// UNIQUE ID GENERATION
// ============================================================================
//
// WHY NOT UUID:
// Adding a UUID library for thread IDs is unnecessary overhead. A combination
// of timestamp + random suffix provides sufficient uniqueness for local-first
// data where collisions only matter within a single user's browser.

/**
 * Generate a unique ID for threads and messages.
 *
 * FORMAT: "t-{timestamp}-{random4}"
 * Example: "t-1711900800000-a3f2"
 *
 * WHY THIS FORMAT:
 * - Timestamp prefix ensures rough chronological ordering.
 * - Random suffix prevents collisions when multiple IDs are generated
 *   in the same millisecond (e.g. thread + first message).
 * - The "t-" prefix makes IDs visually identifiable in localStorage dumps.
 */
function generateId(): string {
  const ts = String(Date.now());
  const rand = Math.random().toString(36).substring(2, 6);
  return 't-' + ts + '-' + rand;
}


// ============================================================================
// STORE STATE AND ACTIONS TYPES
// ============================================================================

/**
 * State shape for the PathAdvisor thread store.
 *
 * WHY SEPARATE STATE AND ACTIONS:
 * Following the established pattern in this repo (e.g. pathAdvisorStore.ts),
 * separating state from actions makes the store shape explicit and enables
 * precise TypeScript type checking.
 */
interface PathAdvisorThreadState {
  /** All saved conversation threads, ordered by updatedAt (newest first in UI). */
  threads: AdvisorThread[];
  /** ID of the currently active thread, or null for empty/home state. */
  activeThreadId: string | null;
  /** Whether the store has attempted to hydrate from localStorage. */
  hydrated: boolean;
}

/**
 * Actions for the PathAdvisor thread store.
 *
 * LIFECYCLE:
 * 1. hydrate() — called once on mount to load persisted state.
 * 2. clearActiveThread() — called when user clicks "New conversation".
 * 3. createThreadWithMessage() — called on first message send (creates thread + adds message).
 * 4. addMessageToThread() — called on subsequent messages in an active thread.
 * 5. setActiveThread() — called when user clicks a thread in the sidebar.
 */
interface PathAdvisorThreadActions {
  /**
   * Load persisted state from localStorage.
   *
   * WHY EXPLICIT HYDRATE:
   * We don't hydrate in the store initializer because that runs during
   * module evaluation, which can happen during SSR. Explicit hydration
   * is called from a useEffect in the consuming component, ensuring
   * it only runs in the browser.
   */
  hydrate: () => void;

  /**
   * Create a new thread with the first message.
   *
   * WHEN CALLED:
   * Only when the user submits a message and there is NO active thread.
   * This is the ONLY way threads are created — never on "new conversation" click.
   *
   * WHAT IT DOES:
   * 1. Generates a thread ID.
   * 2. Generates a title from the message text.
   * 3. Creates the thread with the first message.
   * 4. Sets it as the active thread.
   * 5. Persists to localStorage.
   *
   * @param messageText - The text of the first user message.
   * @returns The created thread's ID (for the caller to use).
   */
  createThreadWithMessage: (messageText: string) => string;

  /**
   * Add a message to an existing thread.
   *
   * WHEN CALLED:
   * When the user sends a follow-up message in an active thread, or when
   * the simulated assistant response arrives.
   *
   * WHAT IT DOES:
   * 1. Finds the thread by ID.
   * 2. Appends the message to its messages array.
   * 3. Updates the thread's updatedAt timestamp.
   * 4. Persists to localStorage.
   *
   * @param threadId - The thread to add the message to.
   * @param role - 'user' or 'advisor'.
   * @param content - The message text.
   * @returns The created message's ID.
   */
  addMessageToThread: (threadId: string, role: 'user' | 'advisor', content: string) => string;

  /**
   * Set the active thread by ID (for sidebar thread switching).
   *
   * WHAT IT DOES:
   * Sets activeThreadId so the dashboard renders that thread's messages.
   * Persists the activeThreadId change to localStorage.
   *
   * @param threadId - The thread to make active.
   */
  setActiveThread: (threadId: string) => void;

  /**
   * Clear the active thread (for "New conversation" action).
   *
   * WHAT IT DOES:
   * Sets activeThreadId to null so the dashboard shows the empty/home state.
   * Does NOT create a thread. Does NOT delete any data.
   * Persists the change to localStorage.
   */
  clearActiveThread: () => void;

  /**
   * Get the currently active thread object.
   *
   * WHY A GETTER:
   * Components often need the full thread object, not just the ID.
   * This getter centralizes the lookup and handles the null case.
   *
   * @returns The active AdvisorThread, or null if none is active.
   */
  getActiveThread: () => AdvisorThread | null;
}

/**
 * Combined store type (state + actions).
 */
type PathAdvisorThreadStore = PathAdvisorThreadState & PathAdvisorThreadActions;


// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

/**
 * PathAdvisor conversation thread store.
 *
 * PURPOSE:
 * Central state management for PathAdvisor conversation history. Provides
 * thread CRUD operations with localStorage persistence.
 *
 * USAGE:
 * ```tsx
 * // Read threads for sidebar
 * const threads = usePathAdvisorThreadStore(function (s) { return s.threads; });
 *
 * // Get active thread ID
 * const activeId = usePathAdvisorThreadStore(function (s) { return s.activeThreadId; });
 *
 * // Create thread on first message
 * const createThread = usePathAdvisorThreadStore(function (s) { return s.createThreadWithMessage; });
 * const threadId = createThread("Am I competitive for GS-13?");
 *
 * // Switch thread from sidebar
 * const setActive = usePathAdvisorThreadStore(function (s) { return s.setActiveThread; });
 * setActive(threadId);
 * ```
 *
 * PERSISTENCE:
 * Every mutation calls savePersistedState() to write to localStorage.
 * Call hydrate() from a useEffect to restore state on page load.
 */
export const usePathAdvisorThreadStore = create<PathAdvisorThreadStore>(function (set, get) {
  return {
    // ========================================================================
    // INITIAL STATE
    // ========================================================================
    //
    // Threads start empty. The hydrate() action loads persisted data.
    // activeThreadId starts null (empty/home state).
    // hydrated starts false; set to true after hydrate() completes.

    threads: [],
    activeThreadId: null,
    hydrated: false,

    // ========================================================================
    // ACTIONS
    // ========================================================================

    /**
     * Load persisted state from localStorage.
     *
     * HOW IT WORKS:
     * 1. Calls loadPersistedState() to read and parse localStorage.
     * 2. If data exists, sets threads and activeThreadId from persisted data.
     * 3. Sets hydrated to true regardless of success/failure.
     *
     * WHY IDEMPOTENT:
     * Calling hydrate() multiple times is safe — it just overwrites with
     * the latest localStorage state. The hydrated flag prevents unnecessary
     * re-renders but doesn't block re-hydration.
     */
    hydrate: function () {
      const persisted = loadPersistedState();
      if (persisted !== null) {
        set({
          threads: persisted.threads,
          activeThreadId: persisted.activeThreadId,
          hydrated: true,
        });
      } else {
        set({ hydrated: true });
      }
    },

    /**
     * Create a new thread with the first user message.
     *
     * STEP BY STEP:
     * 1. Generate unique IDs for both the thread and the message.
     * 2. Generate a title from the message text (heuristic).
     * 3. Build the message object.
     * 4. Build the thread object containing the message.
     * 5. Prepend the thread to the threads array (newest first).
     * 6. Set the new thread as active.
     * 7. Persist to localStorage.
     *
     * WHY PREPEND (NOT APPEND):
     * The sidebar shows threads in most-recent-first order. By prepending,
     * the array is always sorted correctly without a separate sort step.
     *
     * @param messageText - The first user message text.
     * @returns The new thread's ID.
     */
    createThreadWithMessage: function (messageText: string) {
      const threadId = generateId();
      const messageId = generateId();
      const now = new Date().toISOString();

      const title = generateThreadTitle(messageText);

      const message: AdvisorThreadMessage = {
        id: messageId,
        role: 'user',
        content: messageText,
        timestamp: now,
      };

      const thread: AdvisorThread = {
        id: threadId,
        title: title,
        createdAt: now,
        updatedAt: now,
        messages: [message],
        summary: null,
      };

      /**
       * Build the new threads array by prepending the new thread.
       * Uses explicit loop (no spread operator per repo rules).
       */
      const currentState = get();
      const newThreads: AdvisorThread[] = [thread];
      for (let i = 0; i < currentState.threads.length; i++) {
        newThreads.push(currentState.threads[i]);
      }

      set({
        threads: newThreads,
        activeThreadId: threadId,
      });

      savePersistedState({
        threads: newThreads,
        activeThreadId: threadId,
      });

      return threadId;
    },

    /**
     * Add a message to an existing thread.
     *
     * STEP BY STEP:
     * 1. Generate a unique message ID.
     * 2. Build the message object.
     * 3. Find the target thread in the array.
     * 4. Build a new messages array for that thread (append the message).
     * 5. Build a new thread object with updated messages and updatedAt.
     * 6. Build a new threads array with the updated thread.
     * 7. Persist to localStorage.
     *
     * WHY REBUILD THE ARRAY:
     * Zustand requires immutable updates for change detection. We build
     * new arrays instead of mutating in place.
     *
     * @param threadId - Target thread ID.
     * @param role - Message role ('user' or 'advisor').
     * @param content - Message text.
     * @returns The new message's ID.
     */
    addMessageToThread: function (threadId: string, role: 'user' | 'advisor', content: string) {
      const messageId = generateId();
      const now = new Date().toISOString();

      const message: AdvisorThreadMessage = {
        id: messageId,
        role: role,
        content: content,
        timestamp: now,
      };

      const currentState = get();
      const newThreads: AdvisorThread[] = [];

      for (let i = 0; i < currentState.threads.length; i++) {
        const thread = currentState.threads[i];
        if (thread.id === threadId) {
          /**
           * This is the target thread — append the message and update timestamp.
           * Build a new messages array (no spread) by copying existing + new.
           */
          const newMessages: AdvisorThreadMessage[] = [];
          for (let j = 0; j < thread.messages.length; j++) {
            newMessages.push(thread.messages[j]);
          }
          newMessages.push(message);

          /** Build updated thread object (no spread, use Object.assign). */
          const updatedThread: AdvisorThread = Object.assign({}, thread, {
            messages: newMessages,
            updatedAt: now,
          });
          newThreads.push(updatedThread);
        } else {
          newThreads.push(thread);
        }
      }

      set({ threads: newThreads });

      savePersistedState({
        threads: newThreads,
        activeThreadId: currentState.activeThreadId,
      });

      return messageId;
    },

    /**
     * Set the active thread by ID.
     *
     * HOW IT WORKS:
     * Simply sets activeThreadId. The dashboard reads this and renders
     * the matching thread's messages. If the ID doesn't match any thread
     * (e.g. it was deleted), the dashboard will render empty state.
     *
     * @param threadId - The thread to activate.
     */
    setActiveThread: function (threadId: string) {
      const currentState = get();
      set({ activeThreadId: threadId });

      savePersistedState({
        threads: currentState.threads,
        activeThreadId: threadId,
      });
    },

    /**
     * Clear the active thread (show empty/home state).
     *
     * WHEN CALLED:
     * - User clicks "+ New conversation" in the sidebar.
     * - User clicks "Dashboard" in the sidebar.
     *
     * WHAT IT DOES NOT DO:
     * - Does not create a thread.
     * - Does not delete any existing thread.
     * - Does not modify any thread data.
     */
    clearActiveThread: function () {
      const currentState = get();
      set({ activeThreadId: null });

      savePersistedState({
        threads: currentState.threads,
        activeThreadId: null,
      });
    },

    /**
     * Get the currently active thread object.
     *
     * HOW IT WORKS:
     * Looks up the thread by activeThreadId in the threads array.
     * Returns null if no thread is active or if the ID doesn't match.
     *
     * @returns The active AdvisorThread or null.
     */
    getActiveThread: function (): AdvisorThread | null {
      const state = get();
      if (state.activeThreadId === null) {
        return null;
      }
      for (let i = 0; i < state.threads.length; i++) {
        if (state.threads[i].id === state.activeThreadId) {
          return state.threads[i];
        }
      }
      return null;
    },
  };
});
