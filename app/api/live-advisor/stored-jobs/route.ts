/**
 * ============================================================================
 * LIVE ADVISOR STORED JOBS PROXY ROUTE
 * ============================================================================
 *
 * PURPOSE:
 * Proxy one narrow Saved Jobs frontend flow to the backend stored-job catalog
 * endpoint. This keeps backend credentials server-side and gives the frontend a
 * stable same-origin route for live integration.
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

  if (
    typedPayload.detail !== null &&
    typedPayload.detail !== undefined &&
    typeof typedPayload.detail === 'object' &&
    typeof typedPayload.detail.code === 'string' &&
    typedPayload.detail.code.trim() !== ''
  ) {
    return 'Live advisor backend request failed: ' + typedPayload.detail.code;
  }

  return fallbackMessage;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const backend = resolveLiveAdvisorBackendConfig();
  if (backend.config === null) {
    return NextResponse.json(
      {
        error: backend.errorMessage,
      },
      { status: 500 }
    );
  }

  const requestedLimit = request.nextUrl.searchParams.get('limit');
  const parsedLimit =
    requestedLimit !== null && requestedLimit.trim() !== ''
      ? Number(requestedLimit)
      : 10;
  const boundedLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(10, Math.floor(parsedLimit))
      : 10;

  const response = await fetch(
    backend.config.baseUrl +
      '/api/v1/advisor/stored-jobs?limit=' +
      String(boundedLimit),
    {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + backend.config.apiKey,
      },
      cache: 'no-store',
    }
  );
  const payload = await readBackendPayload(response);

  if (!response.ok) {
    return NextResponse.json(
      {
        error: extractBackendErrorMessage(
          payload,
          'The backend did not return live canonical stored jobs.'
        ),
      },
      { status: response.status }
    );
  }

  return NextResponse.json(payload, { status: 200 });
}
