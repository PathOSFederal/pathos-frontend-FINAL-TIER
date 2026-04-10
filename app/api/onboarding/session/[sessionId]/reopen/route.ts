import { NextResponse } from 'next/server';
import { proxyOnboardingRequest } from '../../../_shared';

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  return proxyOnboardingRequest(
    '/api/v1/onboarding/session/' + params.sessionId + '/reopen',
    'POST',
    undefined,
    'The frontend could not reopen onboarding.'
  );
}
