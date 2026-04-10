import { NextRequest, NextResponse } from 'next/server';
import { proxyIntelligenceRequest } from '../_shared';

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyIntelligenceRequest(
    request,
    '/api/v1/intelligence/career-readiness',
    'The career readiness route requires a structured request payload.',
    'The backend did not return a career readiness snapshot.'
  );
}
