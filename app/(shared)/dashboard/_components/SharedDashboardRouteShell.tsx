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
  type PathAdvisorGovernedDraft,
  type PathAdvisorGovernedResultState,
  type PathAdvisorMessage,
} from '@pathos/ui';
import { useProfileStore } from '@/store/profileStore';
import {
  buildInitialPathAdvisorDraft,
  fetchGovernedPathAdvisorResponse,
} from '@/lib/pathadvisor-governed/client';

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

  useEffect(function () {
    if (!isProfileLoaded) {
      loadProfileFromStorage();
    }
  }, [isProfileLoaded, loadProfileFromStorage]);

  const handleClearMessages = useCallback(function () {
    setAdvisorMessages([]);
    setGovernedResult({
      status: 'idle',
      response: null,
      errorMessage: null,
    });
  }, []);

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

    setGovernedResult({
      status: 'loading',
      response: null,
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
                onSend={function () {
                  /* Governed mode uses the bounded request form instead of the legacy composer. */
                }}
                onClearMessages={handleClearMessages}
                governedDraft={governedDraft}
                governedResult={governedResult}
                onGovernedDraftChange={setGovernedDraft}
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
