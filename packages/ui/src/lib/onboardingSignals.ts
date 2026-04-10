/**
 * Bounded onboarding signal bridge for real product activity.
 *
 * This helper keeps UI packages transport-light: screens emit small,
 * explainable events and the backend owns all interpretation.
 */

const ONBOARDING_SESSION_ID_STORAGE_KEY = 'pathos_onboarding_session_id';
const SIGNAL_DEDUPE_TTL_MS = 60 * 1000;

export type OnboardingSignalSource = 'job_search' | 'resume_builder' | 'resume_workspace';

export type OnboardingSignalType =
  | 'job_search_performed'
  | 'job_opened'
  | 'job_saved'
  | 'target_role_selected'
  | 'search_filter_applied'
  | 'likely_role_cluster_observed'
  | 'resume_builder_started'
  | 'resume_workspace_opened'
  | 'resume_validation_completed'
  | 'resume_readiness_gap_detected'
  | 'tailoring_mode_started'
  | 'evidence_gap_detected'
  | 'target_role_attached';

export interface OnboardingSignalPayload {
  role_family?: string;
  location_focus?: string;
  series_code?: string;
  grade_target?: string;
  remote_preference?: string;
  search_keyword?: string;
  readiness_score?: number;
  gap_count?: number;
  validation_status?: string;
  target_role_title?: string;
  evidence_gap?: string;
}

function getSignalSessionId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const sessionId = window.localStorage.getItem(ONBOARDING_SESSION_ID_STORAGE_KEY);
  if (sessionId === null || sessionId.trim() === '') {
    return null;
  }
  return sessionId;
}

function buildSignalDedupeKey(
  source: OnboardingSignalSource,
  signalType: OnboardingSignalType,
  payload: OnboardingSignalPayload
): string {
  return 'pathos_onboarding_signal:' + source + ':' + signalType + ':' + JSON.stringify(payload);
}

function shouldSkipDuplicateSignal(dedupeKey: string): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  const previous = window.sessionStorage.getItem(dedupeKey);
  if (previous !== null && previous !== '') {
    const previousTime = Number(previous);
    if (!Number.isNaN(previousTime) && Date.now() - previousTime < SIGNAL_DEDUPE_TTL_MS) {
      return true;
    }
  }
  window.sessionStorage.setItem(dedupeKey, String(Date.now()));
  return false;
}

export async function emitOnboardingSignal(
  source: OnboardingSignalSource,
  signalType: OnboardingSignalType,
  payload: OnboardingSignalPayload
): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const sessionId = getSignalSessionId();
  if (sessionId === null) {
    return;
  }

  const dedupeKey = buildSignalDedupeKey(source, signalType, payload);
  if (shouldSkipDuplicateSignal(dedupeKey)) {
    return;
  }

  try {
    await window.fetch('/api/onboarding/session/' + sessionId + '/signal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: source,
        signal_type: signalType,
        payload: payload,
      }),
      cache: 'no-store',
    });
  } catch {
    return;
  }
}
