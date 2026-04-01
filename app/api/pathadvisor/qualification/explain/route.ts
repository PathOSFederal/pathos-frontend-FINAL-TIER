/**
 * ============================================================================
 * GOVERNED PATHADVISOR QUALIFICATION PROXY ROUTE
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { proxyGovernedPathAdvisorRequest } from '../../_shared';

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyGovernedPathAdvisorRequest(
    request,
    '/api/v1/pathadvisor/qualification/explain',
    'The governed PathAdvisor qualification route requires a structured qualification payload.',
    'The backend did not return a governed qualification PathAdvisor response.'
  );
}
