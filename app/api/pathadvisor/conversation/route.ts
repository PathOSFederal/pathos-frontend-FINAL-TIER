/**
 * ============================================================================
 * GOVERNED PATHADVISOR CONVERSATION PROXY ROUTE
 * ============================================================================
 *
 * PURPOSE:
 * Provide the same-origin frontend entry point for the bounded PathAdvisor
 * conversation route.
 *
 * WHY THIS FILE EXISTS:
 * The browser-side PathAdvisor composer should talk only to the Next app. This
 * route keeps backend auth on the server, validates the exact bounded payload,
 * and forwards that payload to the backend conversation endpoint.
 *
 * IMPORTANT BOUNDARY:
 * This route does not reshape the governed business fields. It validates the
 * narrow frontend request contract and forwards the same bounded payload.
 */

import { NextRequest, NextResponse } from 'next/server';
import { proxyGovernedPathAdvisorRequest } from '../_shared';
import { isPathAdvisorConversationRequestPayload } from '@/lib/pathadvisor-governed/conversation-request';

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyGovernedPathAdvisorRequest(
    request,
    '/api/v1/pathadvisor/conversation',
    'The PathAdvisor conversation route requires only the bounded user message, governed context payload, and optional bounded intelligence and route context.',
    'The backend did not return a PathAdvisor conversation response.',
    isPathAdvisorConversationRequestPayload
  );
}
