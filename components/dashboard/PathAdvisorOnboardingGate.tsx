'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PathAdvisorOnboardingExperience } from './PathAdvisorOnboardingExperience';
import { ONBOARDING_SESSION_ID_STORAGE_KEY } from '@/lib/storage-keys';
import { getOnboardingSession, reopenOnboardingSession } from '@/lib/onboarding/client';
import { isRecoverableSessionError } from './PathAdvisorOnboardingExperience';
import type { OnboardingSessionState } from '@/types/onboarding';

export function resolveOnboardingGateMode(status: string): 'onboarding' | 'standard' {
  if (status === 'completed' || status === 'deferred') {
    return 'standard';
  }
  return 'onboarding';
}

export function shouldOfferProfileContinuation(session: OnboardingSessionState | null): boolean {
  if (session === null) {
    return false;
  }
  if (session.status !== 'completed' && session.status !== 'deferred') {
    return false;
  }
  if (session.profile_freshness !== null && session.profile_freshness.needs_review) {
    return true;
  }
  if (session.reengagement_signals.length > 0) {
    return true;
  }
  return session.first_insight !== null;
}

export function PathAdvisorOnboardingGate(props: { children: ReactNode }) {
  const [mode, setMode] = useState<'loading' | 'onboarding' | 'standard' | 'error'>('loading');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolvedSession, setResolvedSession] = useState<OnboardingSessionState | null>(null);
  const [isReopening, setIsReopening] = useState(false);

  const resolveMode = useCallback(async function (): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    setErrorMessage(null);

    const storedSessionId = localStorage.getItem(ONBOARDING_SESSION_ID_STORAGE_KEY);
    if (storedSessionId === null || storedSessionId.trim() === '') {
      setSessionId(null);
      setResolvedSession(null);
      setMode('onboarding');
      return;
    }

    try {
      const session = await getOnboardingSession(storedSessionId);
      setSessionId(storedSessionId);
       setResolvedSession(session);
      setMode(resolveOnboardingGateMode(session.status));
    } catch (error) {
      if (isRecoverableSessionError(error)) {
        localStorage.removeItem(ONBOARDING_SESSION_ID_STORAGE_KEY);
        setSessionId(null);
        setResolvedSession(null);
        setMode('onboarding');
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'The dashboard could not confirm your onboarding session.'
      );
      setMode('error');
    }
  }, []);

  useEffect(function () {
    const timeoutId = window.setTimeout(function () {
      void resolveMode();
    }, 0);
    return function () {
      window.clearTimeout(timeoutId);
    };
  }, [resolveMode]);

  if (mode === 'loading') {
    return (
      <div className="w-full px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] p-6 text-sm text-[var(--p-text-muted)]">
          Checking PathAdvisor onboarding state.
        </div>
      </div>
    );
  }

  if (mode === 'error') {
    return (
      <div className="w-full px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] p-6 text-sm text-[var(--p-text-muted)]">
          <div>{errorMessage !== null ? errorMessage : 'The dashboard could not confirm onboarding state.'}</div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={function () {
                setMode('loading');
                void resolveMode();
              }}
            >
              Retry sync
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={function () {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem(ONBOARDING_SESSION_ID_STORAGE_KEY);
                }
                setSessionId(null);
                setResolvedSession(null);
                setMode('onboarding');
              }}
            >
              Start fresh session
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'onboarding') {
    return (
      <PathAdvisorOnboardingExperience
        initialSessionId={sessionId}
        onFinished={function (result) {
          setResolvedSession(result.session);
          setMode('standard');
        }}
      />
    );
  }

  return (
    <>
      {shouldOfferProfileContinuation(resolvedSession) ? (
        <div className="w-full px-4 pt-6">
          <div className="mx-auto max-w-6xl rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.14em] text-[var(--p-text-dim)]">
                  Continue improving your profile
                </div>
                <div className="text-lg font-semibold text-[var(--p-text)]">
                  PathAdvisor can keep refining your profile over time.
                </div>
                <div className="max-w-3xl text-sm text-[var(--p-text-muted)]">
                  {resolvedSession !== null &&
                  resolvedSession.profile_freshness !== null &&
                  resolvedSession.profile_freshness.update_prompt !== ''
                    ? resolvedSession.profile_freshness.update_prompt
                    : 'You can revisit a few structured topics whenever your direction, location, or readiness changes.'}
                </div>
                {resolvedSession !== null && resolvedSession.reengagement_signals.length > 0 ? (
                  <div className="rounded-xl border border-[var(--p-border)] bg-[var(--p-bg)] px-3 py-3 text-sm text-[var(--p-text-muted)]">
                    {resolvedSession.reengagement_signals[0].message}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={isReopening || resolvedSession === null}
                  onClick={async function () {
                    if (resolvedSession === null) {
                      return;
                    }
                    setIsReopening(true);
                    setErrorMessage(null);
                    try {
                      const response = await reopenOnboardingSession(resolvedSession.session_id);
                      if (typeof window !== 'undefined') {
                        localStorage.setItem(ONBOARDING_SESSION_ID_STORAGE_KEY, response.session.session_id);
                      }
                      setResolvedSession(response.session);
                      setSessionId(response.session.session_id);
                      setMode('onboarding');
                    } catch (error) {
                      setErrorMessage(
                        error instanceof Error
                          ? error.message
                          : 'The dashboard could not reopen onboarding.'
                      );
                      setMode('error');
                    } finally {
                      setIsReopening(false);
                    }
                  }}
                >
                  Continue improving
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {props.children}
    </>
  );
}
