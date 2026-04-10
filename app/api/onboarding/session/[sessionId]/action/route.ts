import { NextRequest, NextResponse } from 'next/server';
import { proxyOnboardingRequest } from '../../../../onboarding/_shared';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  return proxyOnboardingRequest(
    '/api/v1/onboarding/session/' + params.sessionId + '/action',
    'POST',
    request,
    'The frontend could not record onboarding action feedback.'
  );
}
