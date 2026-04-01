/**
 * ============================================================================
 * GOVERNED PATHADVISOR CROSS-DOMAIN PROXY ROUTE
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { proxyGovernedPathAdvisorRequest } from '../../_shared';

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyGovernedPathAdvisorRequest(
    request,
    '/api/v1/pathadvisor/cross-domain/explain',
    'The governed PathAdvisor cross-domain route requires a structured bounded payload.',
    'The backend did not return a governed cross-domain PathAdvisor response.'
  );
}
