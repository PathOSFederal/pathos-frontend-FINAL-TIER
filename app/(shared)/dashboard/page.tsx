/**
 * ============================================================================
 * DASHBOARD ROUTE PAGE — PathAdvisor Conversation Workspace
 * ============================================================================
 *
 * WHY THIS FILE EXISTS:
 * This is the Next.js App Router page for the /dashboard route. It wires
 * the transport-agnostic DashboardScreen (from @pathos/ui) into the Next.js
 * navigation and routing system via SharedDashboardRouteShell.
 *
 * WHY THE CHANGE:
 * The old page.tsx mounted the DashboardScreen with numerous card-grid
 * callbacks (onOpenWeeklyBriefing, onFixResumeGap, etc.) and a Weekly
 * Briefing modal. The new page is dramatically simpler because:
 * 1. PathAdvisor is now the center of the dashboard, not a sidebar.
 * 2. The right-rail PathAdvisor is hidden (hideAdvisor) since the
 *    conversation canvas IS the main content.
 * 3. Action callbacks route to the appropriate pages via Next router.
 * 4. The Weekly Briefing modal is removed (no longer part of the design).
 *
 * HOW IT FITS:
 * - SharedDashboardRouteShell provides the app shell (sidebar, top bar)
 *   via SharedAppShell, plus NavigationProvider for route adapters.
 * - hideAdvisor={true} suppresses the right-rail PathAdvisorRail since
 *   the dashboard now embeds PathAdvisor directly in its main canvas.
 * - DashboardScreen receives navigation callbacks and renders the
 *   conversation-first experience.
 *
 * ARCHITECTURE:
 * app/(shared)/dashboard/page.tsx (this file — Next.js routing glue)
 *   → SharedDashboardRouteShell (shell + nav adapter)
 *     → SharedAppShell (sidebar, top bar, scroll region)
 *       → DashboardScreen (PathAdvisor conversation workspace)
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DashboardScreen,
  type DashboardIntelligencePayload,
  type DashboardConversationExchange,
  type PathAdvisorConversationRequestState,
  type PathAdvisorGovernedDraft,
  type PathAdvisorGovernedResultState,
  usePathAdvisorContextLogStore,
  usePathAdvisorThreadStore,
} from '@pathos/ui';
import { SharedDashboardRouteShell } from './_components/SharedDashboardRouteShell';
import { PathAdvisorOnboardingGate } from '@/components/dashboard/PathAdvisorOnboardingGate';
import { useProfileStore } from '@/store/profileStore';
import { fetchDashboardIntelligence } from '@/lib/pathadvisor-intelligence/client';
import {
  buildInitialPathAdvisorDraft,
  fetchPathAdvisorEntryResponse,
  fetchGovernedPathAdvisorResponse,
  fetchPathAdvisorConversationResponse,
} from '@/lib/pathadvisor-governed/client';
import {
  buildPathAdvisorConversationContext,
  buildPathAdvisorEntryContext,
  buildPathAdvisorRouteContext,
} from '@/lib/pathadvisor-governed/conversation-context';
import {
  buildPathAdvisorCarryForwardContext,
  findPreviousUserMessage,
  type PathAdvisorCarryForwardContext,
} from '@/lib/pathadvisor-governed/carry-forward';
import { useCareerResumeIntelligence } from '@/lib/intelligence/useCareerResumeIntelligence';

/**
 * Route constants for navigation targets.
 *
 * WHY DEFINED HERE:
 * These routes are the Next.js paths that the DashboardScreen's action
 * buttons navigate to. They're defined at the page level because routing
 * is a transport concern — the shared UI package doesn't know about Next.js
 * route paths (it uses its own route constants via useNav).
 */
const RESUME_BUILDER_ROUTE = '/dashboard/resume';
const CAREER_READINESS_ROUTE = '/dashboard/career-readiness';

/**
 * Dashboard page component.
 *
 * WHAT IT DOES:
 * 1. Wraps DashboardScreen in SharedDashboardRouteShell with hideAdvisor
 *    so the right rail is suppressed.
 * 2. Provides navigation callbacks that use Next.js router.push to navigate
 *    to the appropriate pages when action buttons are clicked.
 *
 * WHY hideAdvisor:
 * The dashboard redesign moves PathAdvisor from a sidebar widget to the
 * main canvas. Showing both a right-rail PathAdvisor AND a centered
 * PathAdvisor conversation would be confusing and redundant. Other routes
 * under /dashboard/* (job-search, resume-builder, etc.) still use the
 * right rail via their own page.tsx files.
 */
export default function DashboardPage() {
  const router = useRouter();
  const intelligence = useCareerResumeIntelligence();
  const profile = useProfileStore(function (state) {
    return state.profile;
  });
  const isProfileLoaded = useProfileStore(function (state) {
    return state.isLoaded;
  });
  const loadProfileFromStorage = useProfileStore(function (state) {
    return state.loadFromStorage;
  });
  const contextEntriesByAnchor = usePathAdvisorContextLogStore(function (state) {
    return state.entriesByAnchor;
  });
  const activeContextAnchorKey = usePathAdvisorContextLogStore(function (state) {
    return state.activeAnchorKey;
  });
  const dashboardThreads = usePathAdvisorThreadStore(function (state) {
    return state.threads;
  });
  const activeDashboardThreadId = usePathAdvisorThreadStore(function (state) {
    return state.activeThreadId;
  });
  const [governedDraft, setGovernedDraft] = useState<PathAdvisorGovernedDraft>(
    buildInitialPathAdvisorDraft(profile)
  );
  const [governedResult, setGovernedResult] = useState<PathAdvisorGovernedResultState>({
    status: 'idle',
    response: null,
    errorMessage: null,
  });
  const [conversationState, setConversationState] = useState<PathAdvisorConversationRequestState>({
    status: 'idle',
    errorMessage: null,
  });
  const [carryForwardContextsByThreadId, setCarryForwardContextsByThreadId] = useState<
    Record<string, PathAdvisorCarryForwardContext>
  >({});
  const [dashboardIntelligence, setDashboardIntelligence] =
    useState<DashboardIntelligencePayload | null>(null);
  const routeContext = useMemo(
    function () {
      return buildPathAdvisorRouteContext(
        'dashboard',
        contextEntriesByAnchor,
        activeContextAnchorKey,
        {
          allowActiveAnchorFallback: true,
        }
      );
    },
    [activeContextAnchorKey, contextEntriesByAnchor]
  );
  const previousDashboardUserMessage = useMemo(
    function () {
      if (activeDashboardThreadId === null) {
        return null;
      }

      for (let i = 0; i < dashboardThreads.length; i += 1) {
        if (dashboardThreads[i].id === activeDashboardThreadId) {
          return findPreviousUserMessage(dashboardThreads[i].messages);
        }
      }

      return null;
    },
    [activeDashboardThreadId, dashboardThreads]
  );
  const previousDashboardCarryForwardContext = useMemo(
    function () {
      if (activeDashboardThreadId === null) {
        return null;
      }

      return carryForwardContextsByThreadId[activeDashboardThreadId] ?? null;
    },
    [activeDashboardThreadId, carryForwardContextsByThreadId]
  );

  useEffect(function () {
    if (!isProfileLoaded) {
      loadProfileFromStorage();
    }
  }, [isProfileLoaded, loadProfileFromStorage]);

  useEffect(
    function () {
      const activeThreadIds = new Set(
        dashboardThreads.map(function (thread) {
          return thread.id;
        })
      );

      setCarryForwardContextsByThreadId(function (prev) {
        const next: Record<string, PathAdvisorCarryForwardContext> = {};
        const prevKeys = Object.keys(prev);

        for (let i = 0; i < prevKeys.length; i += 1) {
          if (activeThreadIds.has(prevKeys[i])) {
            next[prevKeys[i]] = prev[prevKeys[i]];
          }
        }

        return prevKeys.length === Object.keys(next).length ? prev : next;
      });
    },
    [dashboardThreads]
  );

  useEffect(function () {
    setGovernedDraft(buildInitialPathAdvisorDraft(profile));
  }, [profile]);

  useEffect(function () {
    let cancelled = false;

    void fetchDashboardIntelligence()
      .then(function (payload) {
        if (!cancelled) {
          setDashboardIntelligence(payload);
        }
      })
      .catch(function () {
        if (!cancelled) {
          setDashboardIntelligence(null);
        }
      });

    return function () {
      cancelled = true;
    };
  }, []);

  const requestDashboardConversation = useCallback(async function (
    text: string
  ): Promise<DashboardConversationExchange> {
    const carryForwardContext =
      governedDraft.domain === 'fehb'
        ? null
        : buildPathAdvisorCarryForwardContext(
            text,
            previousDashboardUserMessage,
            previousDashboardCarryForwardContext
          );
    const effectiveConversationMessage =
      carryForwardContext !== null ? carryForwardContext.effectiveUserMessage : text;

    setConversationState({
      status: 'loading',
      errorMessage: null,
    });

    let nextGovernedResponse = governedResult.response;

    try {
      if (nextGovernedResponse === null || carryForwardContext !== null) {
        setGovernedResult(function (prev) {
          return {
            status: 'loading',
            response: prev.status === 'success' ? prev.response : null,
            errorMessage: null,
          };
        });

        const governedResponse =
          governedDraft.domain === 'qualification' || carryForwardContext !== null
            ? await fetchPathAdvisorEntryResponse(
                effectiveConversationMessage,
                governedDraft,
                profile,
                buildPathAdvisorEntryContext({
                  currentView: 'dashboard',
                  draft: governedDraft,
                  result: {
                    status: 'idle',
                    response: null,
                    errorMessage: null,
                  },
                  intelligence: intelligence,
                  routeContext: routeContext,
                })
              )
            : await fetchGovernedPathAdvisorResponse(governedDraft, profile);
        if (governedResponse === null) {
          setGovernedResult({
            status: 'empty',
            response: null,
            errorMessage: null,
          });
          throw new Error('PathAdvisor could not load governed evidence for this explanation.');
        }

        nextGovernedResponse = governedResponse;
        setGovernedResult({
          status: 'success',
          response: governedResponse,
          errorMessage: null,
        });
      }

      const governedResultForConversation: PathAdvisorGovernedResultState = {
        status: 'success',
        response: nextGovernedResponse,
        errorMessage: null,
      };
      const context = buildPathAdvisorConversationContext({
        currentView: 'dashboard',
        draft: governedDraft,
        result: governedResultForConversation,
        intelligence: intelligence,
        routeContext: routeContext,
        carryForwardContext: carryForwardContext,
      });
      const conversationResponse = await fetchPathAdvisorConversationResponse(
        effectiveConversationMessage,
        context
      );

      setConversationState({
        status: 'idle',
        errorMessage: null,
      });
      if (activeDashboardThreadId !== null) {
        setCarryForwardContextsByThreadId(function (prev) {
          if (carryForwardContext === null) {
            if (prev[activeDashboardThreadId] === undefined) {
              return prev;
            }

            const next = { ...prev };
            delete next[activeDashboardThreadId];
            return next;
          }

          return {
            ...prev,
            [activeDashboardThreadId]: carryForwardContext,
          };
        });
      }

      return {
        reply: conversationResponse.reply,
        governedResponse: nextGovernedResponse,
      };
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'The PathAdvisor conversation request failed.';
      setConversationState({
        status: 'error',
        errorMessage: message,
      });
      throw error;
    }
  }, [activeDashboardThreadId, governedDraft, governedResult.response, intelligence, previousDashboardCarryForwardContext, previousDashboardUserMessage, profile, routeContext]);

  return (
    <SharedDashboardRouteShell
      currentView="dashboard"
      conversationIntelligence={intelligence}
      hideAdvisor
    >
      <PathAdvisorOnboardingGate>
        <DashboardScreen
          intelligencePayload={dashboardIntelligence}
          requestConversation={requestDashboardConversation}
          conversationRequestState={conversationState}
          onStartImprovement={function () {
            router.push(CAREER_READINESS_ROUTE + '#action-plan');
          }}
          onOpenResumeBuilder={function () {
            router.push(RESUME_BUILDER_ROUTE);
          }}
          onOpenReadinessBreakdown={function () {
            router.push(CAREER_READINESS_ROUTE);
          }}
        />
      </PathAdvisorOnboardingGate>
    </SharedDashboardRouteShell>
  );
}
