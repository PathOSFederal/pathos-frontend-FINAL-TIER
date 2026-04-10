import { NextRequest } from 'next/server';
import { proxyOnboardingRequest } from '@/app/api/onboarding/_shared';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const params = await context.params;
  return proxyOnboardingRequest(
    '/api/v1/onboarding/session/' + params.sessionId + '/signal',
    'POST',
    request,
    'The frontend could not record the onboarding signal.'
  );
}
