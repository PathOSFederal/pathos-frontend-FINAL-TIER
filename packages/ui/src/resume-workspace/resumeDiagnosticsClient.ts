/**
 * ============================================================================
 * RESUME DIAGNOSTICS CLIENT
 * ============================================================================
 *
 * PURPOSE:
 * Keep the browser-side diagnostics call small and typed. The Resume Workspace
 * store should not own HTTP parsing details, and the screen should not own the
 * request boundary.
 */

import type {
  ResumeDiagnosticsEvaluateRequest,
  ResumeDiagnosticsEvaluateResponse,
} from './resumeDiagnostics';

interface ResumeDiagnosticsErrorPayload {
  error?: string;
  detail?: string | { message?: string | null } | null;
}

export interface ResumeDiagnosticsClientResult {
  ok: boolean;
  unavailable: boolean;
  errorMessage: string | null;
  response: ResumeDiagnosticsEvaluateResponse | null;
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
  const typedPayload = payload as ResumeDiagnosticsErrorPayload;
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

export async function evaluateResumeDiagnostics(
  request: ResumeDiagnosticsEvaluateRequest
): Promise<ResumeDiagnosticsClientResult> {
  try {
    const response = await fetch('/api/resume/diagnostics/evaluate', {
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
        unavailable: response.status >= 500,
        errorMessage: extractErrorMessage(
          payload,
          'The resume diagnostics service did not return an evaluation.'
        ),
        response: null,
      };
    }

    return {
      ok: true,
      unavailable: false,
      errorMessage: null,
      response: payload as ResumeDiagnosticsEvaluateResponse,
    };
  } catch (error) {
    return {
      ok: false,
      unavailable: true,
      errorMessage:
        error instanceof Error
          ? error.message
          : 'The resume diagnostics service is unavailable right now.',
      response: null,
    };
  }
}
