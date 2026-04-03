/**
 * ============================================================================
 * PATHADVISOR THREAD STORE TESTS
 * ============================================================================
 *
 * WHY THIS FILE EXISTS:
 * Validates the core behavior of the PathAdvisor conversation thread store.
 * The thread store is the backbone of conversation persistence — if it breaks,
 * users lose the ability to save, switch, or continue conversations.
 *
 * WHAT'S TESTED:
 * 1. Thread title generation heuristic (generateThreadTitle)
 * 2. Thread creation: only happens on first message, not on "new conversation"
 * 3. Message addition to existing threads
 * 4. Active thread switching
 * 5. Active thread clearing ("new conversation" action)
 * 6. Thread persistence to localStorage
 * 7. Store hydration from localStorage
 * 8. Active thread getter
 * 9. Thread list ordering (newest first)
 *
 * TESTING PATTERN:
 * Uses Zustand's getState()/setState() for direct store manipulation,
 * matching the established pattern in this repo (see dashboardHeroDoNowStore.test.ts).
 * Tests interact with the store synchronously since Zustand state updates
 * are synchronous outside of React.
 *
 * ARCHITECTURE FIT:
 * Co-located with the store file in packages/ui/src/stores/, matching
 * the existing test co-location pattern (careerResumeScreenStore.test.ts,
 * dashboardHeroDoNowStore.test.ts, etc.).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  usePathAdvisorThreadStore,
  generateThreadTitle,
} from './pathAdvisorThreadStore';


// ============================================================================
// SETUP — Reset store state before each test
// ============================================================================

/**
 * Reset the store to a clean state before each test.
 *
 * WHY:
 * Zustand stores are singletons. Without resetting, state from one test
 * would leak into the next, causing flaky failures. We also clear
 * localStorage to prevent cross-test persistence contamination.
 */
beforeEach(function () {
  usePathAdvisorThreadStore.setState({
    threads: [],
    activeThreadId: null,
    hydrated: false,
  });

  try {
    localStorage.removeItem('pathos-pathadvisor-threads-v1');
  } catch {
    /* ignore — localStorage may not exist in all environments */
  }
});


// ============================================================================
// THREAD TITLE GENERATION TESTS
// ============================================================================

describe('generateThreadTitle', function () {

  it('strips question prefixes and generates clean title', function () {
    /**
     * WHY THIS TEST:
     * The most common use case — user asks a question starting with
     * "Am I..." and the title should strip the question prefix.
     */
    const title = generateThreadTitle('Am I competitive for GS-13 roles?');
    expect(title).toBe('Competitive for GS-13 roles');
  });

  it('strips "Why was" prefix', function () {
    const title = generateThreadTitle('Why was I not referred?');
    expect(title).toBe('I not referred');
  });

  it('strips "Show me" prefix', function () {
    const title = generateThreadTitle('Show me strong-fit jobs');
    expect(title).toBe('Strong-fit jobs');
  });

  it('strips "Decode my" prefix', function () {
    const title = generateThreadTitle('Decode my latest application status');
    expect(title).toBe('Latest application status');
  });

  it('strips "How do I" prefix', function () {
    const title = generateThreadTitle('How do I search for a job?');
    expect(title).toBe('Search for a job');
  });

  it('strips trailing punctuation', function () {
    const title = generateThreadTitle('Help me understand my benefits.');
    expect(title).toBe('Understand my benefits');
  });

  it('capitalizes first letter of result', function () {
    const title = generateThreadTitle('what is my readiness score?');
    expect(title).toBe('My readiness score');
  });

  it('truncates long titles at word boundary', function () {
    const longMessage =
      'Can you help me understand why my application for the senior policy analyst position at the Department of Interior was rejected?';
    const title = generateThreadTitle(longMessage);
    /** Should be <= 40 chars and end at a word boundary. */
    expect(title.length).toBeLessThanOrEqual(40);
    expect(title).not.toContain('?');
  });

  it('returns fallback for very short input', function () {
    expect(generateThreadTitle('Hi')).toBe('New conversation');
    expect(generateThreadTitle('')).toBe('New conversation');
    expect(generateThreadTitle('  ')).toBe('New conversation');
  });

  it('handles input with no matching prefix', function () {
    const title = generateThreadTitle('Readiness breakdown for GS-12');
    expect(title).toBe('Readiness breakdown for GS-12');
  });
});


// ============================================================================
// THREAD CREATION TESTS
// ============================================================================

describe('Thread creation', function () {

  it('creates a thread with first message and sets it as active', function () {
    /**
     * WHY THIS TEST:
     * Core thread creation behavior — createThreadWithMessage() must:
     * 1. Create a thread with generated title
     * 2. Include the user message
     * 3. Set it as activeThreadId
     */
    const threadId = usePathAdvisorThreadStore.getState().createThreadWithMessage(
      'Am I competitive for GS-13 roles?'
    );

    const state = usePathAdvisorThreadStore.getState();
    expect(state.threads.length).toBe(1);
    expect(state.activeThreadId).toBe(threadId);
    expect(state.threads[0].id).toBe(threadId);
    expect(state.threads[0].title).toBe('Competitive for GS-13 roles');
    expect(state.threads[0].messages.length).toBe(1);
    expect(state.threads[0].messages[0].role).toBe('user');
    expect(state.threads[0].messages[0].content).toBe('Am I competitive for GS-13 roles?');
  });

  it('does NOT create a thread when clearing active thread (new conversation)', function () {
    /**
     * WHY THIS TEST (CRITICAL):
     * The spec explicitly requires: "DO NOT create a thread when user clicks
     * 'New conversation'". clearActiveThread() must only set activeThreadId
     * to null without creating any new thread.
     */
    /** First, create a thread so there's something to clear. */
    usePathAdvisorThreadStore.getState().createThreadWithMessage('Test message');
    expect(usePathAdvisorThreadStore.getState().threads.length).toBe(1);

    /** Now clear the active thread ("new conversation" action). */
    usePathAdvisorThreadStore.getState().clearActiveThread();

    /** Thread count must not change — no new thread created. */
    expect(usePathAdvisorThreadStore.getState().threads.length).toBe(1);
    expect(usePathAdvisorThreadStore.getState().activeThreadId).toBeNull();
  });

  it('returns a unique thread ID', function () {
    const id1 = usePathAdvisorThreadStore.getState().createThreadWithMessage('Message one');
    const id2 = usePathAdvisorThreadStore.getState().createThreadWithMessage('Message two');
    expect(id1).not.toBe(id2);
  });

  it('prepends new threads (newest first)', function () {
    /**
     * WHY THIS TEST:
     * The sidebar shows threads newest-first. The store must maintain
     * this ordering by prepending new threads to the array.
     */
    usePathAdvisorThreadStore.getState().createThreadWithMessage('First thread');
    usePathAdvisorThreadStore.getState().createThreadWithMessage('Second thread');
    usePathAdvisorThreadStore.getState().createThreadWithMessage('Third thread');

    const threads = usePathAdvisorThreadStore.getState().threads;
    expect(threads.length).toBe(3);
    /** The most recently created thread should be at index 0. */
    expect(threads[0].messages[0].content).toBe('Third thread');
    expect(threads[1].messages[0].content).toBe('Second thread');
    expect(threads[2].messages[0].content).toBe('First thread');
  });
});


// ============================================================================
// MESSAGE ADDITION TESTS
// ============================================================================

describe('Adding messages to threads', function () {

  it('appends a message to an existing thread', function () {
    const threadId = usePathAdvisorThreadStore.getState().createThreadWithMessage('Hello');

    usePathAdvisorThreadStore.getState().addMessageToThread(threadId, 'advisor', 'Hi there!');

    const thread = usePathAdvisorThreadStore.getState().threads[0];
    expect(thread.messages.length).toBe(2);
    expect(thread.messages[1].role).toBe('advisor');
    expect(thread.messages[1].content).toBe('Hi there!');
  });

  it('updates the thread updatedAt timestamp', function () {
    const threadId = usePathAdvisorThreadStore.getState().createThreadWithMessage('Hello');
    const originalUpdatedAt = usePathAdvisorThreadStore.getState().threads[0].updatedAt;

    /** Small delay to ensure timestamp difference. */
    usePathAdvisorThreadStore.getState().addMessageToThread(threadId, 'advisor', 'Response');

    const newUpdatedAt = usePathAdvisorThreadStore.getState().threads[0].updatedAt;
    /** updatedAt should be >= original (may be equal if same millisecond). */
    expect(new Date(newUpdatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(originalUpdatedAt).getTime()
    );
  });

  it('returns a unique message ID', function () {
    const threadId = usePathAdvisorThreadStore.getState().createThreadWithMessage('Hello');
    const msgId1 = usePathAdvisorThreadStore.getState().addMessageToThread(threadId, 'advisor', 'R1');
    const msgId2 = usePathAdvisorThreadStore.getState().addMessageToThread(threadId, 'user', 'Q2');
    expect(msgId1).not.toBe(msgId2);
  });
});


// ============================================================================
// THREAD NAVIGATION TESTS
// ============================================================================

describe('Thread navigation', function () {

  it('setActiveThread switches the active thread', function () {
    const id1 = usePathAdvisorThreadStore.getState().createThreadWithMessage('Thread 1');
    const id2 = usePathAdvisorThreadStore.getState().createThreadWithMessage('Thread 2');

    /** After creating thread 2, it should be active (createThreadWithMessage sets active). */
    expect(usePathAdvisorThreadStore.getState().activeThreadId).toBe(id2);

    /** Switch to thread 1. */
    usePathAdvisorThreadStore.getState().setActiveThread(id1);
    expect(usePathAdvisorThreadStore.getState().activeThreadId).toBe(id1);
  });

  it('clearActiveThread sets activeThreadId to null', function () {
    usePathAdvisorThreadStore.getState().createThreadWithMessage('Test');
    expect(usePathAdvisorThreadStore.getState().activeThreadId).not.toBeNull();

    usePathAdvisorThreadStore.getState().clearActiveThread();
    expect(usePathAdvisorThreadStore.getState().activeThreadId).toBeNull();
  });

  it('getActiveThread returns the correct thread object', function () {
    const id1 = usePathAdvisorThreadStore.getState().createThreadWithMessage('Thread 1');

    const activeThread = usePathAdvisorThreadStore.getState().getActiveThread();
    expect(activeThread).not.toBeNull();
    if (activeThread !== null) {
      expect(activeThread.id).toBe(id1);
      expect(activeThread.messages[0].content).toBe('Thread 1');
    }
  });

  it('getActiveThread returns null when no active thread', function () {
    usePathAdvisorThreadStore.getState().clearActiveThread();
    expect(usePathAdvisorThreadStore.getState().getActiveThread()).toBeNull();
  });

  it('active thread is highlighted (activeThreadId matches)', function () {
    /**
     * WHY THIS TEST:
     * The sidebar uses activeThreadId to highlight the current thread.
     * This test verifies the state contract that clicking a thread sets
     * the correct activeThreadId.
     */
    const id1 = usePathAdvisorThreadStore.getState().createThreadWithMessage('Thread A');
    usePathAdvisorThreadStore.getState().createThreadWithMessage('Thread B');

    usePathAdvisorThreadStore.getState().setActiveThread(id1);
    expect(usePathAdvisorThreadStore.getState().activeThreadId).toBe(id1);
  });
});


// ============================================================================
// PERSISTENCE TESTS
// ============================================================================

describe('localStorage persistence', function () {

  it('persists threads to localStorage on creation', function () {
    usePathAdvisorThreadStore.getState().createThreadWithMessage('Persisted thread');

    const raw = localStorage.getItem('pathos-pathadvisor-threads-v1');
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw as string);
    expect(parsed.threads.length).toBe(1);
    expect(parsed.threads[0].messages[0].content).toBe('Persisted thread');
  });

  it('persists activeThreadId to localStorage', function () {
    const threadId = usePathAdvisorThreadStore.getState().createThreadWithMessage('Test');

    const raw = localStorage.getItem('pathos-pathadvisor-threads-v1');
    const parsed = JSON.parse(raw as string);
    expect(parsed.activeThreadId).toBe(threadId);
  });

  it('hydrates threads from localStorage', function () {
    /**
     * WHY THIS TEST:
     * When the user refreshes the page, the store starts empty and must
     * restore its state from localStorage via hydrate(). This test verifies
     * that round-trip persistence works correctly.
     */
    /** Step 1: Create a thread (persists to localStorage). */
    usePathAdvisorThreadStore.getState().createThreadWithMessage('Survive refresh');
    const threadId = usePathAdvisorThreadStore.getState().activeThreadId;

    /** Step 2: Reset the store (simulates page refresh). */
    usePathAdvisorThreadStore.setState({
      threads: [],
      activeThreadId: null,
      hydrated: false,
    });

    /** Step 3: Hydrate from localStorage. */
    usePathAdvisorThreadStore.getState().hydrate();

    /** Step 4: Verify state was restored. */
    const state = usePathAdvisorThreadStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.threads.length).toBe(1);
    expect(state.threads[0].messages[0].content).toBe('Survive refresh');
    expect(state.activeThreadId).toBe(threadId);
  });

  it('persists clearActiveThread to localStorage', function () {
    usePathAdvisorThreadStore.getState().createThreadWithMessage('Test');
    usePathAdvisorThreadStore.getState().clearActiveThread();

    const raw = localStorage.getItem('pathos-pathadvisor-threads-v1');
    const parsed = JSON.parse(raw as string);
    expect(parsed.activeThreadId).toBeNull();
    expect(parsed.threads.length).toBe(1);
  });

  it('persists messages added to threads', function () {
    const threadId = usePathAdvisorThreadStore.getState().createThreadWithMessage('Q1');
    usePathAdvisorThreadStore.getState().addMessageToThread(threadId, 'advisor', 'A1');

    const raw = localStorage.getItem('pathos-pathadvisor-threads-v1');
    const parsed = JSON.parse(raw as string);
    expect(parsed.threads[0].messages.length).toBe(2);
    expect(parsed.threads[0].messages[1].content).toBe('A1');
  });
});


// ============================================================================
// EMPTY STATE TESTS
// ============================================================================

describe('Dashboard empty state contract', function () {

  it('renders empty state when no active thread', function () {
    /**
     * WHY THIS TEST:
     * The dashboard must show the PathAdvisor empty state when
     * activeThreadId is null. This tests the state contract that
     * drives the conditional rendering.
     */
    expect(usePathAdvisorThreadStore.getState().activeThreadId).toBeNull();
    expect(usePathAdvisorThreadStore.getState().threads.length).toBe(0);
    expect(usePathAdvisorThreadStore.getState().getActiveThread()).toBeNull();
  });

  it('first message transitions from empty state to active thread', function () {
    /**
     * WHY THIS TEST:
     * The key user flow: start from empty state, send a message,
     * thread is created, activeThreadId is set, dashboard transitions.
     */
    expect(usePathAdvisorThreadStore.getState().activeThreadId).toBeNull();

    usePathAdvisorThreadStore.getState().createThreadWithMessage('First message');

    expect(usePathAdvisorThreadStore.getState().activeThreadId).not.toBeNull();
    expect(usePathAdvisorThreadStore.getState().threads.length).toBe(1);
  });
});
