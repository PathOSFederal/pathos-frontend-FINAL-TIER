import { NextResponse } from 'next/server';
import { proxyOnboardingRequest } from '../_shared';

export async function POST(): Promise<NextResponse> {
  return proxyOnboardingRequest(
    '/api/v1/onboarding/session',
    'POST',
    undefined,
    'The frontend could not create the onboarding session.'
  );
}
