/**
 * ============================================================================
 * GOVERNED PATHADVISOR CONVERSATION PROXY ROUTE
 * ============================================================================
 *
 * PURPOSE:
 * Provide the same-origin frontend entry point for PathAdvisor conversation.
 *
 * WHY THIS FILE EXISTS:
 * The browser-side PathAdvisor composer should talk only to the Next app. This
 * route keeps backend auth on the server, validates that the conversation
 * request stays bounded to structured governed context, and then forwards the
 * payload to the backend conversation endpoint.
 *
 * IMPORTANT BOUNDARY:
 * This route does not allow arbitrary pass-through blobs. The conversation
 * layer is allowed to explain governed results, not to become an unbounded chat
 * tunnel that bypasses the trust model.
 */

import { NextRequest, NextResponse } from 'next/server';
import { proxyGovernedPathAdvisorRequest } from '../_shared';

interface ConversationBoundedRequest {
  qualification: {
    yearsExperience: string;
    targetRoles: string;
    skills: string;
    authorizedToWork: boolean;
  };
  fehb: {
    enrollmentType: string;
    coverageType: string;
    expectedUtilization: string;
    householdSize: string;
    planPreferences: string;
    comparisonTargets: string;
  };
}

interface ConversationGovernedResponsePayload {
  domain: 'qualification' | 'fehb' | 'cross_domain';
  responseState: 'grounded' | 'partial' | 'refused';
  grounded: boolean;
  summary: string;
  explanation: string;
  keyFactors: Array<{
    factorType: string;
    label: string;
    detail: string;
    code: string | null;
    severity: string | null;
  }>;
  missingInputs: string[];
  nextSteps: string[];
  refusalReason: string | null;
  packVersionId: string | null;
  freshnessState: string | null;
}

interface ConversationSelectedEntityPayload {
  entityType: 'job' | 'dashboard' | 'unknown';
  entityId: string | null;
  entityLabel: string | null;
}

interface PathAdvisorConversationRequestPayload {
  user_message: string;
  request_id: string;
  context: {
    current_view: string;
    request_domain: 'qualification' | 'fehb' | 'cross_domain';
    trust_state: 'grounded' | 'partial' | 'refused' | 'loading' | 'idle' | 'error' | 'empty';
    bounded_request: ConversationBoundedRequest;
    selected_entity: ConversationSelectedEntityPayload;
    governed_response: ConversationGovernedResponsePayload | null;
  };
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  if (!Array.isArray(value)) {
    return false;
  }

  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string') {
      return false;
    }
  }

  return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

function isConversationBoundedRequest(value: unknown): value is ConversationBoundedRequest {
  if (!isPlainObject(value)) {
    return false;
  }

  const qualification = value.qualification;
  const fehb = value.fehb;
  if (!isPlainObject(qualification) || !isPlainObject(fehb)) {
    return false;
  }

  return (
    isString(qualification.yearsExperience) &&
    isString(qualification.targetRoles) &&
    isString(qualification.skills) &&
    typeof qualification.authorizedToWork === 'boolean' &&
    isString(fehb.enrollmentType) &&
    isString(fehb.coverageType) &&
    isString(fehb.expectedUtilization) &&
    isString(fehb.householdSize) &&
    isString(fehb.planPreferences) &&
    isString(fehb.comparisonTargets)
  );
}

function isConversationSelectedEntity(value: unknown): value is ConversationSelectedEntityPayload {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    (value.entityType === 'job' || value.entityType === 'dashboard' || value.entityType === 'unknown') &&
    isNullableString(value.entityId) &&
    isNullableString(value.entityLabel)
  );
}

function isConversationGovernedResponse(
  value: unknown
): value is ConversationGovernedResponsePayload | null {
  if (value === null) {
    return true;
  }

  if (!isPlainObject(value)) {
    return false;
  }

  return (
    (value.domain === 'qualification' || value.domain === 'fehb' || value.domain === 'cross_domain') &&
    (value.responseState === 'grounded' || value.responseState === 'partial' || value.responseState === 'refused') &&
    typeof value.grounded === 'boolean' &&
    isString(value.summary) &&
    isString(value.explanation) &&
    Array.isArray(value.keyFactors) &&
    isStringArray(value.missingInputs) &&
    isStringArray(value.nextSteps) &&
    isNullableString(value.refusalReason) &&
    isNullableString(value.packVersionId) &&
    isNullableString(value.freshnessState)
  );
}

/**
 * Validate the bounded conversation payload.
 *
 * Why this exists:
 * The backend conversation endpoint should receive a narrow trusted payload,
 * not an unchecked frontend blob. This validator keeps the proxy honest and
 * documents exactly what the conversation layer is allowed to receive.
 */
function isPathAdvisorConversationRequestPayload(
  payload: unknown
): payload is PathAdvisorConversationRequestPayload {
  if (!isPlainObject(payload)) {
    return false;
  }

  if (!isString(payload.user_message) || payload.user_message.trim() === '') {
    return false;
  }

  if (!isString(payload.request_id) || payload.request_id.trim() === '') {
    return false;
  }

  const context = payload.context;
  if (!isPlainObject(context)) {
    return false;
  }

  return (
    isString(context.current_view) &&
    (context.request_domain === 'qualification' || context.request_domain === 'fehb' || context.request_domain === 'cross_domain') &&
    (context.trust_state === 'grounded' ||
      context.trust_state === 'partial' ||
      context.trust_state === 'refused' ||
      context.trust_state === 'loading' ||
      context.trust_state === 'idle' ||
      context.trust_state === 'error' ||
      context.trust_state === 'empty') &&
    isConversationBoundedRequest(context.bounded_request) &&
    isConversationSelectedEntity(context.selected_entity) &&
    isConversationGovernedResponse(context.governed_response)
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyGovernedPathAdvisorRequest(
    request,
    '/api/v1/pathadvisor/conversation',
    'The PathAdvisor conversation route requires a bounded user message plus structured governed context.',
    'The backend did not return a PathAdvisor conversation response.',
    isPathAdvisorConversationRequestPayload
  );
}
