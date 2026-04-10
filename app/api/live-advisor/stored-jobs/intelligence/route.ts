/**
 * Proxy the canonical Saved Jobs intelligence payload through the backend.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveLiveAdvisorBackendConfig } from '@/lib/live-advisor/backend';

interface BackendErrorPayload {
  detail?: string | { code?: string; message?: string } | null;
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

  return fallbackMessage;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const backend = resolveLiveAdvisorBackendConfig();
  if (backend.config === null) {
    return NextResponse.json({ error: backend.errorMessage }, { status: 500 });
  }

  const requestPayload = (await request.json()) as unknown;
  if (
    requestPayload === null ||
    Array.isArray(requestPayload) ||
    typeof requestPayload !== 'object'
  ) {
    return NextResponse.json(
      { error: 'The Saved Jobs intelligence route requires a structured payload.' },
      { status: 400 }
    );
  }

  const response = await fetch(
    backend.config.baseUrl + '/api/v1/advisor/intelligence/stored-job',
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
          'The backend did not return Saved Jobs intelligence.'
        ),
      },
      { status: response.status }
    );
  }

  return NextResponse.json(payload, { status: 200 });
}
