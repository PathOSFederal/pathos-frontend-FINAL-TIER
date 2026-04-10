/**
 * ============================================================================
 * PATHADVISOR UNIVERSAL ENTRY PROXY ROUTE
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { proxyGovernedPathAdvisorRequest } from '../_shared';
import { isPathAdvisorEntryRequestPayload } from '@/lib/pathadvisor-governed/client';

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyGovernedPathAdvisorRequest(
    request,
    '/api/v1/pathadvisor/entry',
    'The PathAdvisor entry route requires the user message plus a structured federal job-seeking payload.',
    'The backend did not return a PathAdvisor entry response.',
    isPathAdvisorEntryRequestPayload
  );
}
