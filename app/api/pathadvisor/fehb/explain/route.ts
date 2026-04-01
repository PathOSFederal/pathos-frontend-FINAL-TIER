/**
 * ============================================================================
 * GOVERNED PATHADVISOR FEHB PROXY ROUTE
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { proxyGovernedPathAdvisorRequest } from '../../_shared';

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyGovernedPathAdvisorRequest(
    request,
    '/api/v1/pathadvisor/fehb/explain',
    'The governed PathAdvisor FEHB route requires a structured FEHB payload.',
    'The backend did not return a governed FEHB PathAdvisor response.'
  );
}
