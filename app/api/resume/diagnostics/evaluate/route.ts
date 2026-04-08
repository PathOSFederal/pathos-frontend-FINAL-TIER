/**
 * ============================================================================
 * RESUME DIAGNOSTICS EVALUATION PROXY ROUTE
 * ============================================================================
 *
 * PURPOSE:
 * Keep the Day 76b diagnostics boundary same-origin for the frontend. The
 * Resume Workspace posts a typed diagnostics payload here, and this route
 * forwards it unchanged to the backend truth endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiveAdvisorBackendConfig } from '@/lib/live-advisor/backend';

interface BackendErrorPayload {
  detail?: string | { code?: string; message?: string } | null;
}

function isPlainObject(payload: unknown): payload is Record<string, unknown> {
  return payload !== null && !Array.isArray(payload) && typeof payload === 'object';
}

async function readBackendPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === '') {
    return null;
  }
  return JSON.parse(text) as unknown;
}

function extractBackendErrorMessage(
  payload: unknown,
  fallbackMessage: string
): string {
  if (payload === null || payload === undefined) {
    return fallbackMessage;
  }
  if (typeof payload === 'string' && payload.trim() !== '') {
    return payload;
  }
  if (typeof payload !== 'object') {
    return fallbackMessage;
  }
  const typedPayload = payload as BackendErrorPayload;
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
    return 'Resume diagnostics backend request failed: ' + typedPayload.detail.code;
  }
  return fallbackMessage;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const backend = resolveLiveAdvisorBackendConfig();
  if (backend.config === null) {
    return NextResponse.json(
      {
        error: backend.errorMessage,
      },
      { status: 500 }
    );
  }

  const requestPayload = (await request.json()) as unknown;
  if (!isPlainObject(requestPayload)) {
    return NextResponse.json(
      {
        error:
          'The resume diagnostics route requires a structured evaluation payload.',
      },
      { status: 400 }
    );
  }

  const response = await fetch(
    backend.config.baseUrl + '/api/v1/resume/diagnostics/evaluate',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + backend.config.apiKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify(requestPayload),
    }
  );
  const payload = await readBackendPayload(response);

  if (!response.ok) {
    return NextResponse.json(
      {
        error: extractBackendErrorMessage(
          payload,
          'The backend did not return a resume diagnostics evaluation.'
        ),
      },
      { status: response.status }
    );
  }

  return NextResponse.json(payload, { status: 200 });
}
