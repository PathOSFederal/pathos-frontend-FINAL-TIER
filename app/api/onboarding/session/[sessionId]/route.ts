import { NextResponse } from 'next/server';
import { proxyOnboardingRequest } from '../../_shared';

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  return proxyOnboardingRequest(
    '/api/v1/onboarding/session/' + params.sessionId,
    'GET',
    undefined,
    'The frontend could not load the onboarding session.'
  );
}
