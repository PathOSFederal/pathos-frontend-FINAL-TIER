import { NextRequest, NextResponse } from 'next/server';
import { proxyOnboardingRequest } from '../../../_shared';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  return proxyOnboardingRequest(
    '/api/v1/onboarding/session/' + params.sessionId + '/answer',
    'POST',
    request,
    'The frontend could not submit the onboarding answer.'
  );
}
