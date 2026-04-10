/**
 * ============================================================================
 * COVERAGE-AWARE PATHADVISOR QUALIFICATION ENTRY PROXY ROUTE
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { proxyGovernedPathAdvisorRequest } from '../../_shared';
import { isPathAdvisorQualificationEntryRequestPayload } from '@/lib/pathadvisor-governed/client';

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyGovernedPathAdvisorRequest(
    request,
    '/api/v1/pathadvisor/qualification/entry',
    'The coverage-aware PathAdvisor qualification entry route requires the user message plus a structured qualification payload.',
    'The backend did not return a coverage-aware PathAdvisor qualification response.',
    isPathAdvisorQualificationEntryRequestPayload
  );
}
