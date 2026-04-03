'use client';

import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { NavigationProvider } from '@pathos/adapters';
import { parseThemeVariant } from '@pathos/core';
import { useNextNavAdapter, NextNavLink } from '@/lib/adapters/next-nav-adapter';
import {
  SharedAppShell,
  PathAdvisorRail,
  type PathAdvisorConversationRequestState,
  type PathAdvisorGovernedDraft,
  type PathAdvisorGovernedResultState,
  type PathAdvisorMessage,
} from '@pathos/ui';
import { useProfileStore } from '@/store/profileStore';
import {
  buildInitialPathAdvisorDraft,
  fetchPathAdvisorConversationResponse,
  fetchGovernedPathAdvisorResponse,
} from '@/lib/pathadvisor-governed/client';
import { buildPathAdvisorConversationContext } from '@/lib/pathadvisor-governed/conversation-context';

/**
 * Shared dashboard shell wrapper for routes that use the canonical PathAdvisor
 * right rail.
 *
 * Why this file matters to governed PathAdvisor:
 * The app shell owns the request lifecycle and the lightweight conversation log,
 * while the UI package stays transport-agnostic. This file is therefore the
 * place where we preserve request determinism:
 * - bounded draft changes stay explicit
 * - loading, empty, error, and success remain distinct
 * - stale governed results are not left looking current after a domain switch
 * - the conversational shell sends structured governed context to the backend
 */
export function SharedDashboardRouteShell(props: {
  children: React.ReactNode;
  /**
   * When true, the PathAdvisor right rail is not rendered. Used by
   * surfaces that provide their own section-scoped guidance model
   * (e.g., Resume Builder) and do not want a competing assistant
   * column.
   */
  hideAdvisor?: boolean;
}) {
  const adapter = useNextNavAdapter();
  const searchParams = useSearchParams();
  const themeVariant = parseThemeVariant(searchParams.get('theme')) ?? undefined;
  const [advisorMessages, setAdvisorMessages] = useState<PathAdvisorMessage[]>([]);
  const profile = useProfileStore(function (state) {
    return state.profile;
  });
  const isProfileLoaded = useProfileStore(function (state) {
    return state.isLoaded;
  });
  const loadProfileFromStorage = useProfileStore(function (state) {
    return state.loadFromStorage;
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

  /**
   * Load the persisted profile once for shared dashboard routes.
   *
   * Why this matters:
   * The initial governed draft seeds from the profile. We still keep the
   * governed request explicitly editable in the rail, but loading the existing
   * profile keeps the bounded inputs useful on first render.
   */
  useEffect(function () {
    if (!isProfileLoaded) {
      loadProfileFromStorage();
    }
  }, [isProfileLoaded, loadProfileFromStorage]);

  /**
   * Clear both the lightweight conversation log and the governed response
   * state.
   *
   * Why this exists:
   * The shared rail should reset to an honest empty state when the user clears
   * the assistant surface. Leaving an old governed result behind would blur the
   * current request boundary.
   */
  const handleClearMessages = useCallback(function () {
    setAdvisorMessages([]);
    setGovernedResult({
      status: 'idle',
      response: null,
      errorMessage: null,
    });
    setConversationState({
      status: 'idle',
      errorMessage: null,
    });
  }, []);

  /**
   * Handle conversational composer sends in governed mode.
   *
   * Step by step:
   * 1. Record the user's message in the lightweight local conversation log.
   * 2. Build a bounded structured context object from the current governed
   *    draft and result state.
   * 3. Send that context plus the user message to the same-origin conversation
   *    route.
   * 4. Append the backend reply to the same lightweight log.
 *
   * Why this matters:
   * This keeps the conversational shell from acting like a second reasoning
   * engine. The frontend now assembles bounded request context only, while the
   * backend conversation layer produces the actual reply.
   */
  const handleAdvisorConversationSend = useCallback(async function (text: string) {
    const userMessage: PathAdvisorMessage = { role: 'user', content: text };

    setAdvisorMessages(function (prev) {
      const next: PathAdvisorMessage[] = [];
      for (let i = 0; i < prev.length; i++) {
        next.push(prev[i]);
      }
      next.push(userMessage);
      return next;
    });
    setConversationState({
      status: 'loading',
      errorMessage: null,
    });

    const context = buildPathAdvisorConversationContext({
      currentView: 'shared-dashboard',
      draft: governedDraft,
      result: governedResult,
    });
    try {
      const response = await fetchPathAdvisorConversationResponse(text, context);
      setConversationState({
        status: 'idle',
        errorMessage: null,
      });
      setAdvisorMessages(function (prev) {
        const next: PathAdvisorMessage[] = [];
        for (let i = 0; i < prev.length; i++) {
          next.push(prev[i]);
        }
        next.push({
          role: 'assistant',
          content: response.reply,
        });
        return next;
      });
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'The PathAdvisor conversation request failed.';
      setConversationState({
        status: 'error',
        errorMessage: message,
      });
    }
  }, [governedDraft, governedResult]);

  /**
   * Apply bounded draft edits coming from the governed request form.
   *
   * Step by step:
   * 1. Store the next bounded draft exactly as the panel provided it.
   * 2. If the request domain changed, clear the existing governed result.
   *
   * Why only clear on domain changes:
   * The clearest stale-state risk is switching from qualification to FEHB or
   * cross-domain while a previous answer is still visible. Clearing on every
   * keystroke would be more disruptive than helpful, so this refinement keeps
   * the reset narrowly scoped to the most confusing transition.
   */
  const handleGovernedDraftChange = useCallback(function (nextDraft: PathAdvisorGovernedDraft) {
    const didDomainChange = governedDraft.domain !== nextDraft.domain;
    setGovernedDraft(nextDraft);

    if (didDomainChange) {
      setGovernedResult({
        status: 'idle',
        response: null,
        errorMessage: null,
      });
      setConversationState({
        status: 'idle',
        errorMessage: null,
      });
    }
  }, [governedDraft.domain]);

  /**
   * Submit the current bounded draft to the governed backend.
   *
   * Step by step:
   * 1. Append a lightweight user message so the shared rail still has a simple
   *    conversational log.
   * 2. Move the governed result into loading while preserving the last success
   *    response, if one exists, so the UI can refresh in place instead of
   *    flashing empty.
   * 3. Call the thin governed client boundary.
   * 4. Distinguish empty, governed success, and technical failure explicitly.
   *
   * Why the trust boundary matters here:
   * A backend refusal is still a successful governed response, so it flows
   * through the success path and keeps its explicit response_state. Only actual
   * transport or proxy failures become the technical error state.
   */
  const handleGovernedSubmit = useCallback(async function () {
    const requestLabel =
      governedDraft.domain === 'qualification'
        ? 'Qualification explanation requested.'
        : governedDraft.domain === 'fehb'
          ? 'FEHB explanation requested.'
          : 'Cross-domain explanation requested.';

    const userMessage: PathAdvisorMessage = { role: 'user', content: requestLabel };
    setAdvisorMessages(function (prev) {
      const next: PathAdvisorMessage[] = [];
      for (let i = 0; i < prev.length; i++) {
        next.push(prev[i]);
      }
      next.push(userMessage);
      return next;
    });

    setGovernedResult(function (prev) {
      return {
        status: 'loading',
        response: prev.status === 'success' ? prev.response : null,
        errorMessage: null,
      };
    });
    setConversationState({
      status: 'idle',
      errorMessage: null,
    });

    try {
      const response = await fetchGovernedPathAdvisorResponse(governedDraft, profile);
      if (response === null) {
        setGovernedResult({
          status: 'empty',
          response: null,
          errorMessage: null,
        });
        setAdvisorMessages(function (prev) {
          const next: PathAdvisorMessage[] = [];
          for (let i = 0; i < prev.length; i++) {
            next.push(prev[i]);
          }
          next.push({
            role: 'assistant',
            content: 'No governed PathAdvisor response was returned.',
          });
          return next;
        });
        return;
      }

      setGovernedResult({
        status: 'success',
        response: response,
        errorMessage: null,
      });
      setAdvisorMessages(function (prev) {
        const next: PathAdvisorMessage[] = [];
        for (let i = 0; i < prev.length; i++) {
          next.push(prev[i]);
        }
        next.push({
          role: 'assistant',
          content: response.summary,
        });
        return next;
      });
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'The governed PathAdvisor request failed.';
      setGovernedResult({
        status: 'error',
        response: null,
        errorMessage: message,
      });
      setAdvisorMessages(function (prev) {
        const next: PathAdvisorMessage[] = [];
        for (let i = 0; i < prev.length; i++) {
          next.push(prev[i]);
        }
        next.push({
          role: 'assistant',
          content: 'Technical error: ' + message,
        });
        return next;
      });
    }
  }, [governedDraft, profile]);

  return (
    <NavigationProvider adapter={adapter} linkComponent={NextNavLink}>
      <SharedAppShell
        platform="web"
        themeVariant={themeVariant}
        rightRail={
          props.hideAdvisor
            ? undefined
            : <PathAdvisorRail
                dock="right"
                messages={advisorMessages}
                onSend={handleAdvisorConversationSend}
                onClearMessages={handleClearMessages}
                governedDraft={governedDraft}
                governedResult={governedResult}
                governedConversationState={conversationState}
                onGovernedDraftChange={handleGovernedDraftChange}
                onGovernedSubmit={handleGovernedSubmit}
              />
        }
        advisorDock="right"
        hideAdvisor={props.hideAdvisor}
      >
        {props.children}
      </SharedAppShell>
    </NavigationProvider>
  );
}
