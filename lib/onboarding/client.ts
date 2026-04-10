/**
 * Backend-owned onboarding client.
 */

import type {
  CompleteOnboardingResponse,
  CreateOnboardingSessionResponse,
  OnboardingSessionState,
  OnboardingRealSignalPayload,
  PathAdvisorContextBootstrapSnapshot,
  RecordOnboardingActionResponse,
  RecordOnboardingSignalResponse,
  ReopenOnboardingSessionResponse,
  SubmitOnboardingAnswerResponse,
} from '@/types/onboarding';

interface ErrorPayload {
  error?: string | { code?: string; message?: string } | null;
  detail?: string | { code?: string; message?: string } | null;
}

/**
 * The onboarding client needs structured error inspection because the dashboard
 * must distinguish a recoverable missing-session case from a real network or
 * contract failure. That lets the frontend restart safely without pretending
 * stale local state is still canonical.
 */
export class OnboardingClientError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'OnboardingClientError';
    this.status = status;
    this.code = code;
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === '') {
    return null;
  }
  return JSON.parse(text) as unknown;
}

function extractError(payload: unknown, fallbackMessage: string): string {
  if (payload === null || payload === undefined) {
    return fallbackMessage;
  }
  if (typeof payload === 'string' && payload.trim() !== '') {
    return payload;
  }
  if (typeof payload !== 'object') {
    return fallbackMessage;
  }

  const typedPayload = payload as ErrorPayload;
  if (typeof typedPayload.error === 'string' && typedPayload.error.trim() !== '') {
    return typedPayload.error;
  }
  if (
    typedPayload.error !== null &&
    typedPayload.error !== undefined &&
    typeof typedPayload.error === 'object' &&
    typeof typedPayload.error.message === 'string' &&
    typedPayload.error.message.trim() !== ''
  ) {
    return typedPayload.error.message;
  }
  if (typeof typedPayload.detail === 'string' && typedPayload.detail.trim() !== '') {
    return typedPayload.detail;
  }
  if (
    typedPayload.detail !== null &&
    typedPayload.detail !== undefined &&
    typeof typedPayload.detail === 'object' &&
    typeof typedPayload.detail.message === 'string' &&
    typedPayload.detail.message.trim() !== ''
  ) {
    return typedPayload.detail.message;
  }

  return fallbackMessage;
}

function extractErrorCode(payload: unknown): string | null {
  if (payload === null || payload === undefined || typeof payload !== 'object') {
    return null;
  }
  const typedPayload = payload as ErrorPayload;
  if (
    typedPayload.error !== null &&
    typedPayload.error !== undefined &&
    typeof typedPayload.error === 'object' &&
    typeof typedPayload.error.code === 'string' &&
    typedPayload.error.code.trim() !== ''
  ) {
    return typedPayload.error.code;
  }
  if (
    typedPayload.detail !== null &&
    typedPayload.detail !== undefined &&
    typeof typedPayload.detail === 'object' &&
    typeof typedPayload.detail.code === 'string' &&
    typedPayload.detail.code.trim() !== ''
  ) {
    return typedPayload.detail.code;
  }
  return null;
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  const response = await fetch(url, init);
  const payload = await readJson(response);

  if (!response.ok) {
    throw new OnboardingClientError(
      extractError(payload, fallbackMessage),
      response.status,
      extractErrorCode(payload)
    );
  }
  return payload as T;
}

export async function createOnboardingSession(): Promise<CreateOnboardingSessionResponse> {
  return requestJson<CreateOnboardingSessionResponse>(
    '/api/onboarding/session',
    {
      method: 'POST',
      cache: 'no-store',
    },
    'The frontend could not create an onboarding session.'
  );
}

export async function getOnboardingSession(sessionId: string): Promise<OnboardingSessionState> {
  return requestJson<OnboardingSessionState>(
    '/api/onboarding/session/' + sessionId,
    {
      method: 'GET',
      cache: 'no-store',
    },
    'The frontend could not load the onboarding session.'
  );
}

export async function submitOnboardingAnswer(
  sessionId: string,
  questionId: string,
  answer: string | null,
  skip: boolean
): Promise<SubmitOnboardingAnswerResponse> {
  return requestJson<SubmitOnboardingAnswerResponse>(
    '/api/onboarding/session/' + sessionId + '/answer',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        question_id: questionId,
        answer: answer,
        skip: skip,
      }),
    },
    'The frontend could not submit the onboarding answer.'
  );
}

export async function completeOnboardingSession(
  sessionId: string,
  action: 'complete' | 'defer'
): Promise<CompleteOnboardingResponse> {
  return requestJson<CompleteOnboardingResponse>(
    '/api/onboarding/session/' + sessionId + '/complete',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({ action: action }),
    },
    'The frontend could not complete onboarding.'
  );
}

export async function reopenOnboardingSession(
  sessionId: string
): Promise<ReopenOnboardingSessionResponse> {
  return requestJson<ReopenOnboardingSessionResponse>(
    '/api/onboarding/session/' + sessionId + '/reopen',
    {
      method: 'POST',
      cache: 'no-store',
    },
    'The frontend could not reopen onboarding.'
  );
}

export async function recordOnboardingAction(
  sessionId: string,
  actionType:
    | 'opened_job_search'
    | 'opened_resume_builder'
    | 'viewed_roles_no_apply'
    | 'edited_resume'
    | 'skipped_applying',
  workspace: 'job_search' | 'resume_builder' | 'dashboard'
): Promise<RecordOnboardingActionResponse> {
  return requestJson<RecordOnboardingActionResponse>(
    '/api/onboarding/session/' + sessionId + '/action',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        action_type: actionType,
        workspace: workspace,
      }),
    },
    'The frontend could not record the onboarding action feedback.'
  );
}

export async function recordOnboardingSignal(
  sessionId: string,
  source: 'job_search' | 'resume_builder' | 'resume_workspace',
  signalType:
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
    | 'target_role_attached',
  payload: Partial<OnboardingRealSignalPayload>
): Promise<RecordOnboardingSignalResponse> {
  return requestJson<RecordOnboardingSignalResponse>(
    '/api/onboarding/session/' + sessionId + '/signal',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        source: source,
        signal_type: signalType,
        payload: payload,
      }),
    },
    'The frontend could not record the onboarding signal.'
  );
}

export async function getPathAdvisorBootstrapSnapshot(): Promise<PathAdvisorContextBootstrapSnapshot> {
  return requestJson<PathAdvisorContextBootstrapSnapshot>(
    '/api/pathadvisor/context/bootstrap',
    {
      method: 'GET',
      cache: 'no-store',
    },
    'The frontend could not load the PathAdvisor bootstrap snapshot.'
  );
}
