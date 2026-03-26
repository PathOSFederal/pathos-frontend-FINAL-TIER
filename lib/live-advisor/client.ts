/**
 * ============================================================================
 * LIVE ADVISOR CLIENT HELPERS
 * ============================================================================
 *
 * PURPOSE:
 * Keep browser-side fetch logic for the narrow Saved Jobs live integration in
 * one place. The page wrapper calls these helpers, and the shared UI screen
 * stays transport-agnostic.
 */

import type { Profile } from '@/lib/api/profile';
import type { Job } from '@pathos/core';
import type {
  SavedJobsLiveEvaluation,
  SavedJobsLiveStoredJob,
} from '@pathos/ui';
import {
  adaptAdvisorEvaluation,
  adaptLiveJobSearchResponse,
  adaptStoredJobCatalogItems,
  buildLiveJobSearchRequest,
  buildJobSearchEvaluationRequest,
  buildStoredJobEvaluationRequest,
  type BackendAdvisorOutput,
  type BackendLiveJobSearchResponse,
  type JobSearchEvaluableJob,
  type BackendStoredJobCatalogItem,
  type LiveJobSearchFiltersInput,
  type LiveJobSearchResponse,
} from './adapter';

interface LiveAdvisorErrorPayload {
  error?: string;
  detail?: string | { code?: string; message?: string } | null;
}

async function readJsonPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === '') {
    return null;
  }

  return JSON.parse(text) as unknown;
}

function extractErrorMessage(payload: unknown, fallbackMessage: string): string {
  if (payload === null || payload === undefined) {
    return fallbackMessage;
  }

  if (typeof payload === 'string' && payload.trim() !== '') {
    return payload;
  }

  if (typeof payload !== 'object') {
    return fallbackMessage;
  }

  const typedPayload = payload as LiveAdvisorErrorPayload;
  if (typeof typedPayload.error === 'string' && typedPayload.error.trim() !== '') {
    return typedPayload.error;
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

  if (
    typedPayload.detail !== null &&
    typedPayload.detail !== undefined &&
    typeof typedPayload.detail === 'object' &&
    typeof typedPayload.detail.code === 'string' &&
    typedPayload.detail.code.trim() !== ''
  ) {
    return 'Live advisor request failed: ' + typedPayload.detail.code;
  }

  return fallbackMessage;
}

/**
 * Load recent canonical stored jobs through the same-origin frontend proxy.
 *
 * The returned records are already normalized into the shared UI model used by
 * the Saved Jobs live advisor path.
 */
export async function fetchLiveStoredJobs(): Promise<SavedJobsLiveStoredJob[]> {
  const response = await fetch('/api/live-advisor/stored-jobs?limit=10', {
    cache: 'no-store',
  });
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(
        payload,
        'The frontend could not load live canonical stored jobs from the backend.'
      )
    );
  }

  if (!Array.isArray(payload)) {
    throw new Error(
      'The frontend live advisor route returned an invalid stored-jobs payload.'
    );
  }

  return adaptStoredJobCatalogItems(payload as BackendStoredJobCatalogItem[]);
}

/**
 * Evaluate one stored canonical job through the live backend advisor path.
 *
 * The profile mapping is intentionally partial and honest. Missing frontend
 * profile evidence is left missing so the backend can surface uncertainty.
 */
export async function fetchLiveStoredJobEvaluation(
  storedJob: SavedJobsLiveStoredJob,
  profile: Profile
): Promise<SavedJobsLiveEvaluation | null> {
  const requestPayload = buildStoredJobEvaluationRequest(storedJob, profile);
  const response = await fetch('/api/live-advisor/stored-jobs/evaluate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify(requestPayload),
  });
  const payload = await readJsonPayload(response);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(
        payload,
        'The frontend could not load a live advisor evaluation for this stored job.'
      )
    );
  }

  if (payload === null || Array.isArray(payload) || typeof payload !== 'object') {
    throw new Error(
      'The frontend live advisor route returned an invalid evaluation payload.'
    );
  }

  return adaptAdvisorEvaluation(payload as BackendAdvisorOutput);
}

/**
 * Evaluate the currently selected Job Search job through the generic backend
 * advisor endpoint.
 *
 * This keeps Job Search on the same live backend decision engine as Saved Jobs
 * without requiring the search results themselves to be fully replatformed in
 * this phase.
 */
export async function fetchLiveJobSearchEvaluation(
  job: JobSearchEvaluableJob | Job,
  profile: Profile
): Promise<SavedJobsLiveEvaluation | null> {
  const requestPayload = buildJobSearchEvaluationRequest(
    job as JobSearchEvaluableJob,
    profile
  );
  const response = await fetch('/api/live-advisor/evaluate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify(requestPayload),
  });
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(
        payload,
        'The frontend could not load a live advisor evaluation for the selected search result.'
      )
    );
  }

  if (payload === null || Array.isArray(payload) || typeof payload !== 'object') {
    throw new Error(
      'The frontend live advisor route returned an invalid job-search evaluation payload.'
    );
  }

  return adaptAdvisorEvaluation(payload as BackendAdvisorOutput);
}

/**
 * Search live backend-backed USAJOBS results through the same-origin frontend
 * proxy. The UI passes frontend filter state; this helper handles the bounded
 * backend contract mapping in one place.
 */
export async function fetchLiveJobSearchResults(input: {
  keyword: string;
  location?: string;
  filters: LiveJobSearchFiltersInput;
  page: number;
  pageSize: number;
}): Promise<LiveJobSearchResponse> {
  const requestPayload = buildLiveJobSearchRequest(input);
  const response = await fetch('/api/live-advisor/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify(requestPayload),
  });
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(
        payload,
        'The frontend could not load live backend-backed job search results.'
      )
    );
  }

  if (payload === null || Array.isArray(payload) || typeof payload !== 'object') {
    throw new Error(
      'The frontend live search route returned an invalid jobs-search payload.'
    );
  }

  return adaptLiveJobSearchResponse(payload as BackendLiveJobSearchResponse);
}
