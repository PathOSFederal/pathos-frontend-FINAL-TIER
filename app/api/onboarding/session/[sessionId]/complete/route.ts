import { NextRequest, NextResponse } from 'next/server';
import { proxyOnboardingRequest } from '../../../_shared';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  return proxyOnboardingRequest(
    '/api/v1/onboarding/session/' + params.sessionId + '/complete',
    'POST',
    request,
    'The frontend could not complete onboarding.'
  );
}
