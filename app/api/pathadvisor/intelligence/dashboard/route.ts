import { NextResponse } from 'next/server';
import { resolveLiveAdvisorBackendConfig } from '@/lib/live-advisor/backend';

async function readBackendPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === '') {
    return null;
  }

  return JSON.parse(text) as unknown;
}

export async function GET(): Promise<NextResponse> {
  const backend = resolveLiveAdvisorBackendConfig();
  if (backend.config === null) {
    return NextResponse.json({ error: backend.errorMessage }, { status: 500 });
  }

  const response = await fetch(
    backend.config.baseUrl + '/api/v1/advisor/intelligence/dashboard',
    {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + backend.config.apiKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    }
  );
  const payload = await readBackendPayload(response);

  return NextResponse.json(payload, { status: response.status });
}
