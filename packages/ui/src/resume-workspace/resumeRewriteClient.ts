/**
 * ============================================================================
 * RESUME REWRITE CLIENT — Day 85 bounded candidate fetch
 * ============================================================================
 *
 * PURPOSE:
 * Keep the browser-side rewrite request small and typed. The review shell
 * should not own HTTP parsing or server error translation.
 *
 * IMPORTANT:
 * This client does not generate rewrite text. It only calls the same-origin
 * rewrite route and adapts its bounded response.
 */

import type {
  ResumeRewriteRequest,
  ResumeRewriteResponse,
} from './resumeRewrite';

interface ResumeRewriteErrorPayload {
  error?: string;
  detail?: string | { message?: string | null } | null;
}

export interface ResumeRewriteClientResult {
  ok: boolean;
  unavailable: boolean;
  errorMessage: string | null;
  response: ResumeRewriteResponse | null;
}

function readJsonPayload(response: Response): Promise<unknown> {
  return response.text().then(function (text) {
    if (text.trim() === '') {
      return null;
    }
    return JSON.parse(text) as unknown;
  });
}

function extractErrorMessage(payload: unknown, fallbackMessage: string): string {
  if (payload === null || payload === undefined) {
    return fallbackMessage;
  }
  if (typeof payload === 'string' && payload.trim().length > 0) {
    return payload;
  }
  if (typeof payload !== 'object') {
    return fallbackMessage;
  }
  const typedPayload = payload as ResumeRewriteErrorPayload;
  if (
    typeof typedPayload.error === 'string' &&
    typedPayload.error.trim().length > 0
  ) {
    return typedPayload.error;
  }
  if (
    typeof typedPayload.detail === 'string' &&
    typedPayload.detail.trim().length > 0
  ) {
    return typedPayload.detail;
  }
  if (
    typedPayload.detail !== null &&
    typedPayload.detail !== undefined &&
    typeof typedPayload.detail === 'object' &&
    typeof typedPayload.detail.message === 'string' &&
    typedPayload.detail.message.trim().length > 0
  ) {
    return typedPayload.detail.message;
  }
  return fallbackMessage;
}

export async function requestResumeRewriteCandidates(
  request: ResumeRewriteRequest
): Promise<ResumeRewriteClientResult> {
  try {
    const response = await fetch('/api/resume/rewrite-assist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify(request),
    });
    const payload = await readJsonPayload(response);

    if (!response.ok) {
      return {
        ok: false,
        unavailable: response.status >= 500 || response.status === 404,
        errorMessage: extractErrorMessage(
          payload,
          'The rewrite assistance service did not return any candidates.'
        ),
        response: null,
      };
    }

    return {
      ok: true,
      unavailable: false,
      errorMessage: null,
      response: payload as ResumeRewriteResponse,
    };
  } catch (error) {
    return {
      ok: false,
      unavailable: true,
      errorMessage:
        error instanceof Error
          ? error.message
          : 'The rewrite assistance service is unavailable right now.',
      response: null,
    };
  }
}
