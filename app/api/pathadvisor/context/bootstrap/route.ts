import { NextResponse } from 'next/server';
import { proxyOnboardingRequest } from '../../../onboarding/_shared';

export async function GET(): Promise<NextResponse> {
  return proxyOnboardingRequest(
    '/api/v1/pathadvisor/context/bootstrap',
    'GET',
    undefined,
    'The frontend could not load the PathAdvisor bootstrap snapshot.'
  );
}
