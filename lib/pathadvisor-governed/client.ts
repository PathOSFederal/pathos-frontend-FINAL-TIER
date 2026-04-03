/**
 * ============================================================================
 * GOVERNED PATHADVISOR CLIENT
 * ============================================================================
 *
 * PURPOSE:
 * Keep the thin browser-side contract boundary for the governed PathAdvisor
 * rail in one place. The shared rail UI stays transport-agnostic, while this
 * file owns:
 * - bounded request shaping
 * - same-origin API calls
 * - backend response normalization
 * - the conversation API boundary layered on top of governed truth
 */

import type { Profile } from '@/lib/api/profile';
import type {
  PathAdvisorConversationResponse,
  PathAdvisorGovernedDraft,
  PathAdvisorGovernedDomain,
  PathAdvisorShapedResponse,
} from '@pathos/ui';
import type { PathAdvisorGovernedConversationContext } from './conversation-context';
import { buildPathAdvisorConversationRequestPayload } from './conversation-request';

interface PathAdvisorErrorPayload {
  error?: string;
  detail?: string | { code?: string; message?: string } | null;
}

interface BackendPathAdvisorKeyFactor {
  factor_type: 'finding' | 'recommendation' | 'warning' | 'missing_input' | 'status';
  label: string;
  detail: string;
  code?: string | null;
  severity?: 'low' | 'medium' | 'high' | null;
}

interface BackendPathAdvisorDomainGroundingRecord {
  domain: 'qualification' | 'fehb';
  response_state: 'grounded' | 'partial' | 'refused';
  grounded: boolean;
  partial: boolean;
  refusal_reason?: string | null;
  missing_inputs?: string[] | null;
  pack_id?: string | null;
  pack_key?: string | null;
  version_id?: string | null;
  version?: number | null;
  freshness_state?: 'fresh' | 'aging' | 'stale' | 'expired' | null;
  freshness_reason?: string | null;
}

interface BackendPathAdvisorGrounding {
  domain: 'qualification' | 'fehb' | 'cross_domain';
  response_state: 'grounded' | 'partial' | 'refused';
  grounded: boolean;
  partial: boolean;
  refusal_reason?: string | null;
  missing_inputs?: string[] | null;
  pack_id?: string | null;
  pack_key?: string | null;
  version_id?: string | null;
  version?: number | null;
  freshness_state?: 'fresh' | 'aging' | 'stale' | 'expired' | null;
  freshness_reason?: string | null;
  effective_at?: string | null;
  reviewed_at?: string | null;
  review_by?: string | null;
  expires_at?: string | null;
  serving_eligible: boolean;
  source_summary?: {
    source_type?: string | null;
    source_label?: string | null;
    source_count?: number | null;
    latest_published_at?: string | null;
  } | null;
  conversation_provider: string;
  provider_used: boolean;
  refusal_domain?: 'qualification' | 'fehb' | null;
  domains?: BackendPathAdvisorDomainGroundingRecord[] | null;
}

interface BackendPathAdvisorShapedResponse {
  domain: 'qualification' | 'fehb' | 'cross_domain';
  response_state: 'grounded' | 'partial' | 'refused';
  grounded: boolean;
  summary: string;
  explanation: string;
  key_factors?: BackendPathAdvisorKeyFactor[] | null;
  missing_inputs?: string[] | null;
  next_steps?: string[] | null;
  refusal_reason?: string | null;
  pack_version_id?: string | null;
  freshness_state?: 'fresh' | 'aging' | 'stale' | 'expired' | null;
  grounding: BackendPathAdvisorGrounding;
  served_at: string;
}

interface BackendQualificationRequest {
  user_facts: {
    user_id: string | null;
    years_experience: number | null;
    target_roles: string[];
    skills: string[];
    preferred_locations: string[];
    authorized_to_work: boolean | null;
  };
  use_persisted_profile: boolean;
  request_id: string;
}

interface BackendFehbRequest {
  user_inputs: {
    enrollment_type: string | null;
    coverage_type: string | null;
    expected_utilization: string | null;
    household_size: number | null;
    plan_preferences: string[];
    comparison_targets: string[];
  };
  use_persisted_profile: boolean;
  request_id: string;
}

interface BackendCrossDomainRequest {
  user_facts: BackendQualificationRequest['user_facts'];
  user_inputs: BackendFehbRequest['user_inputs'];
  use_persisted_profile: boolean;
  request_id: string;
}

interface BackendPathAdvisorConversationResponse {
  reply?: string | null;
  message?: string | null;
  response_state?: 'grounded' | 'partial' | 'refused';
  grounded?: boolean;
  refusal_reason?: string | null;
}

function splitCommaSeparated(value: string): string[] {
  const results: string[] = [];
  const parts = value.split(',');
  for (let i = 0; i < parts.length; i++) {
    const trimmed = parts[i].trim();
    if (trimmed !== '') {
      results.push(trimmed);
    }
  }
  return results;
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function readJsonPayload(response: Response): Promise<unknown> {
  return response.text().then(function (text) {
    if (text.trim() === '') {
      return null;
    }
    return JSON.parse(text) as unknown;
  });
}

function extractErrorMessage(payload: unknown, fallbackMessage: string): string {
  if (payload === null || payload === undefined) {
    return fallbackMessage;
  }

  if (typeof payload === 'string' && payload.trim() !== '') {
    return payload;
  }

  if (typeof payload !== 'object') {
    return fallbackMessage;
  }

  const typedPayload = payload as PathAdvisorErrorPayload;
  if (typeof typedPayload.error === 'string' && typedPayload.error.trim() !== '') {
    return typedPayload.error;
  }
  if (typeof typedPayload.detail === 'string' && typedPayload.detail.trim() !== '') {
    return typedPayload.detail;
  }
  if (
    typedPayload.detail !== null &&
    typedPayload.detail !== undefined &&
    typeof typedPayload.detail === 'object' &&
    typeof typedPayload.detail.message === 'string' &&
    typedPayload.detail.message.trim() !== ''
  ) {
    return typedPayload.detail.message;
  }
  if (
    typedPayload.detail !== null &&
    typedPayload.detail !== undefined &&
    typeof typedPayload.detail === 'object' &&
    typeof typedPayload.detail.code === 'string' &&
    typedPayload.detail.code.trim() !== ''
  ) {
    return 'Governed PathAdvisor request failed: ' + typedPayload.detail.code;
  }

  return fallbackMessage;
}

function normalizeStringList(values: string[] | null | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalized: string[] = [];
  for (let i = 0; i < values.length; i++) {
    normalized.push(values[i]);
  }
  return normalized;
}

function adaptResponse(payload: BackendPathAdvisorShapedResponse): PathAdvisorShapedResponse {
  const keyFactors = Array.isArray(payload.key_factors) ? payload.key_factors : [];
  const domainGrounding = Array.isArray(payload.grounding.domains) ? payload.grounding.domains : [];

  return {
    domain: payload.domain,
    responseState: payload.response_state,
    grounded: payload.grounded,
    summary: payload.summary,
    explanation: payload.explanation,
    keyFactors: keyFactors.map(function (item) {
      return {
        factorType: item.factor_type,
        label: item.label,
        detail: item.detail,
        code: item.code !== undefined ? item.code : null,
        severity: item.severity !== undefined ? item.severity : null,
      };
    }),
    missingInputs: normalizeStringList(payload.missing_inputs),
    nextSteps: normalizeStringList(payload.next_steps),
    refusalReason: payload.refusal_reason !== undefined ? payload.refusal_reason : null,
    packVersionId: payload.pack_version_id !== undefined ? payload.pack_version_id : null,
    freshnessState: payload.freshness_state !== undefined ? payload.freshness_state : null,
    grounding: {
      domain: payload.grounding.domain,
      responseState: payload.grounding.response_state,
      grounded: payload.grounding.grounded,
      partial: payload.grounding.partial,
      refusalReason:
        payload.grounding.refusal_reason !== undefined ? payload.grounding.refusal_reason : null,
      missingInputs: normalizeStringList(payload.grounding.missing_inputs),
      packId: payload.grounding.pack_id !== undefined ? payload.grounding.pack_id : null,
      packKey: payload.grounding.pack_key !== undefined ? payload.grounding.pack_key : null,
      versionId: payload.grounding.version_id !== undefined ? payload.grounding.version_id : null,
      version: payload.grounding.version !== undefined ? payload.grounding.version : null,
      freshnessState:
        payload.grounding.freshness_state !== undefined ? payload.grounding.freshness_state : null,
      freshnessReason:
        payload.grounding.freshness_reason !== undefined ? payload.grounding.freshness_reason : null,
      effectiveAt: payload.grounding.effective_at !== undefined ? payload.grounding.effective_at : null,
      reviewedAt: payload.grounding.reviewed_at !== undefined ? payload.grounding.reviewed_at : null,
      reviewBy: payload.grounding.review_by !== undefined ? payload.grounding.review_by : null,
      expiresAt: payload.grounding.expires_at !== undefined ? payload.grounding.expires_at : null,
      servingEligible: payload.grounding.serving_eligible,
      sourceSummary:
        payload.grounding.source_summary !== undefined &&
        payload.grounding.source_summary !== null
          ? {
              sourceType:
                payload.grounding.source_summary.source_type !== undefined
                  ? payload.grounding.source_summary.source_type
                  : null,
              sourceLabel:
                payload.grounding.source_summary.source_label !== undefined
                  ? payload.grounding.source_summary.source_label
                  : null,
              sourceCount:
                payload.grounding.source_summary.source_count !== undefined
                  ? payload.grounding.source_summary.source_count
                  : null,
              latestPublishedAt:
                payload.grounding.source_summary.latest_published_at !== undefined
                  ? payload.grounding.source_summary.latest_published_at
                  : null,
            }
          : null,
      conversationProvider: payload.grounding.conversation_provider,
      providerUsed: payload.grounding.provider_used,
      refusalDomain:
        payload.grounding.refusal_domain !== undefined ? payload.grounding.refusal_domain : null,
      domains: domainGrounding.map(function (item) {
        return {
          domain: item.domain,
          responseState: item.response_state,
          grounded: item.grounded,
          partial: item.partial,
          refusalReason: item.refusal_reason !== undefined ? item.refusal_reason : null,
          missingInputs: normalizeStringList(item.missing_inputs),
          packId: item.pack_id !== undefined ? item.pack_id : null,
          packKey: item.pack_key !== undefined ? item.pack_key : null,
          versionId: item.version_id !== undefined ? item.version_id : null,
          version: item.version !== undefined ? item.version : null,
          freshnessState: item.freshness_state !== undefined ? item.freshness_state : null,
          freshnessReason: item.freshness_reason !== undefined ? item.freshness_reason : null,
        };
      }),
    },
    servedAt: payload.served_at,
  };
}

/**
 * Adapt the backend conversation payload into the explicit frontend
 * conversation contract.
 *
 * Why this exists:
 * The UI should not fetch an untyped opaque object and hope the fields are
 * present. This adapter makes the conversation route fail honestly if the
 * backend response is malformed.
 */
function adaptConversationResponse(
  payload: BackendPathAdvisorConversationResponse
): PathAdvisorConversationResponse {
  const reply =
    typeof payload.reply === 'string' && payload.reply.trim() !== ''
      ? payload.reply
      : typeof payload.message === 'string' && payload.message.trim() !== ''
        ? payload.message
        : null;

  if (
    reply === null ||
    (payload.response_state !== 'grounded' &&
      payload.response_state !== 'partial' &&
      payload.response_state !== 'refused')
  ) {
    throw new Error('The frontend could not parse the PathAdvisor conversation response.');
  }

  return {
    reply: reply,
    responseState: payload.response_state,
    grounded:
      payload.grounded !== undefined
        ? payload.grounded
        : payload.response_state !== 'refused',
    refusalReason: payload.refusal_reason !== undefined ? payload.refusal_reason : null,
  };
}

function createRequestId(domain: PathAdvisorGovernedDomain): string {
  return domain + '-' + String(Date.now());
}

function buildQualificationUserFacts(
  draft: PathAdvisorGovernedDraft,
  profile: Profile
): BackendQualificationRequest['user_facts'] {
  const preferredLocations: string[] = [];

  for (let i = 0; i < profile.location.preferredLocations.length; i++) {
    preferredLocations.push(profile.location.preferredLocations[i]);
  }
  if (
    profile.location.currentMetroArea !== '' &&
    preferredLocations.indexOf(profile.location.currentMetroArea) === -1
  ) {
    preferredLocations.push(profile.location.currentMetroArea);
  }

  return {
    user_id: profile.name !== '' ? profile.name : null,
    years_experience: parseOptionalNumber(draft.qualification.yearsExperience),
    target_roles: splitCommaSeparated(draft.qualification.targetRoles),
    skills: splitCommaSeparated(draft.qualification.skills),
    preferred_locations: preferredLocations,
    authorized_to_work: draft.qualification.authorizedToWork,
  };
}

function buildFehbUserInputs(
  draft: PathAdvisorGovernedDraft
): BackendFehbRequest['user_inputs'] {
  return {
    enrollment_type:
      draft.fehb.enrollmentType.trim() !== '' ? draft.fehb.enrollmentType.trim() : null,
    coverage_type:
      draft.fehb.coverageType.trim() !== '' ? draft.fehb.coverageType.trim() : null,
    expected_utilization:
      draft.fehb.expectedUtilization.trim() !== ''
        ? draft.fehb.expectedUtilization.trim()
        : null,
    household_size: parseOptionalNumber(draft.fehb.householdSize),
    plan_preferences: splitCommaSeparated(draft.fehb.planPreferences),
    comparison_targets: splitCommaSeparated(draft.fehb.comparisonTargets),
  };
}

export function buildInitialPathAdvisorDraft(profile: Profile): PathAdvisorGovernedDraft {
  let targetRoles = '';
  if (profile.goals.targetSeries.length > 0) {
    targetRoles = profile.goals.targetSeries.join(', ');
  } else if (profile.goals.nextCareerMove !== '') {
    targetRoles = profile.goals.nextCareerMove;
  }

  let coverageType = '';
  if (profile.benefits.householdCoverage === 'self_only') {
    coverageType = 'self_only';
  } else if (profile.benefits.householdCoverage === 'self_plus_one') {
    coverageType = 'self_plus_one';
  } else if (profile.benefits.householdCoverage === 'family') {
    coverageType = 'family';
  }

  return {
    domain: 'qualification',
    qualification: {
      yearsExperience:
        profile.jobSeeker !== null ? String(profile.jobSeeker.yearsOfExperience) : '',
      targetRoles: targetRoles,
      skills: '',
      authorizedToWork: true,
    },
    fehb: {
      enrollmentType: '',
      coverageType: coverageType,
      expectedUtilization: '',
      householdSize: '',
      planPreferences: '',
      comparisonTargets: '',
    },
  };
}

export async function fetchGovernedPathAdvisorResponse(
  draft: PathAdvisorGovernedDraft,
  profile: Profile
): Promise<PathAdvisorShapedResponse | null> {
  let route = '/api/pathadvisor/qualification/explain';
  let requestPayload: BackendQualificationRequest | BackendFehbRequest | BackendCrossDomainRequest = {
    user_facts: buildQualificationUserFacts(draft, profile),
    use_persisted_profile: false,
    request_id: createRequestId(draft.domain),
  };

  if (draft.domain === 'fehb') {
    route = '/api/pathadvisor/fehb/explain';
    requestPayload = {
      user_inputs: buildFehbUserInputs(draft),
      use_persisted_profile: false,
      request_id: createRequestId(draft.domain),
    };
  } else if (draft.domain === 'cross_domain') {
    route = '/api/pathadvisor/cross-domain/explain';
    requestPayload = {
      user_facts: buildQualificationUserFacts(draft, profile),
      user_inputs: buildFehbUserInputs(draft),
      use_persisted_profile: false,
      request_id: createRequestId(draft.domain),
    };
  }

  const response = await fetch(route, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify(requestPayload),
  });
  const payload = await readJsonPayload(response);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(
        payload,
        'The frontend could not load the governed PathAdvisor response.'
      )
    );
  }

  if (payload === null || Array.isArray(payload) || typeof payload !== 'object') {
    return null;
  }

  return adaptResponse(payload as BackendPathAdvisorShapedResponse);
}

/**
 * Fetch a conversational PathAdvisor explanation from the backend conversation
 * layer.
 *
 * Step by step:
 * 1. Convert the bounded local context into the backend request payload.
 * 2. Send the request through the same-origin conversation proxy route.
 * 3. Parse backend errors honestly.
 * 4. Adapt the response into the explicit frontend conversation contract.
 *
 * Why this preserves trust:
 * The request carries only structured governed fields and the user's message.
 * The frontend does not generate its own explanation anymore. It simply passes
 * the bounded context to the backend conversation layer and renders the reply.
 */
export async function fetchPathAdvisorConversationResponse(
  userMessage: string,
  context: PathAdvisorGovernedConversationContext
): Promise<PathAdvisorConversationResponse> {
  const requestPayload = buildPathAdvisorConversationRequestPayload(userMessage, context);
  const response = await fetch('/api/pathadvisor/conversation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify(requestPayload),
  });
  const payload = await readJsonPayload(response);

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(
        payload,
        'The frontend could not load the PathAdvisor conversation response.'
      )
    );
  }

  if (payload === null || Array.isArray(payload) || typeof payload !== 'object') {
    throw new Error('The frontend could not parse the PathAdvisor conversation response.');
  }

  return adaptConversationResponse(payload as BackendPathAdvisorConversationResponse);
}
