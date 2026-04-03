/**
 * ============================================================================
 * GOVERNED PATHADVISOR CONVERSATION REQUEST
 * ============================================================================
 *
 * PURPOSE:
 * Keep the exact bounded PathAdvisor conversation request contract in one
 * place so the browser client and the same-origin proxy route cannot drift.
 *
 * WHY THIS FILE EXISTS:
 * The backend conversation route is strict:
 * - snake_case only
 * - no extra fields
 * - top-level route/domain/user_message/governed_context
 * - optional trust_state/entity/draft_inputs only
 *
 * The frontend must therefore build and validate the exact payload shape the
 * backend expects, with no nested wrapper object and no UI-shaped extras.
 */

import type { PathAdvisorGovernedDomain } from '@pathos/ui';
import type { PathAdvisorGovernedConversationContext } from './conversation-context';

export type PathAdvisorConversationRoute =
  | 'qualification_explanation'
  | 'fehb_explanation'
  | 'cross_domain_explanation';

export interface PathAdvisorConversationEntityPayload {
  entity_type: 'job' | 'dashboard' | 'unknown';
  entity_id: string | null;
  entity_label: string | null;
}

export interface PathAdvisorConversationDraftInputsPayload {
  focus_topics?: string[];
  selected_missing_inputs?: string[];
  selected_next_steps?: string[];
}

export interface PathAdvisorConversationGroundingPayload {
  domain: PathAdvisorGovernedDomain;
  response_state: 'grounded' | 'partial' | 'refused';
  grounded: boolean;
  partial: boolean;
  missing_inputs: string[];
  pack_id: string | null;
  pack_key: string | null;
  version_id: string | null;
  version: number | null;
  freshness_state: string | null;
  freshness_reason: string | null;
  serving_eligible: boolean;
  conversation_provider: string;
  provider_used: boolean;
}

export interface PathAdvisorConversationGovernedContextPayload {
  response_state: 'grounded' | 'partial' | 'refused';
  grounded: boolean;
  summary: string;
  explanation: string;
  key_factors: Array<{
    factor_type: string;
    label: string;
    detail: string;
    code: string | null;
    severity: string | null;
  }>;
  missing_inputs: string[];
  next_steps: string[];
  refusal_reason: string | null;
  pack_version_id: string | null;
  freshness_state: string | null;
  grounding: PathAdvisorConversationGroundingPayload;
}

export interface PathAdvisorConversationRequestPayload {
  route: PathAdvisorConversationRoute;
  domain: PathAdvisorGovernedDomain;
  user_message: string;
  governed_context: PathAdvisorConversationGovernedContextPayload;
  trust_state?: 'governed';
  entity?: PathAdvisorConversationEntityPayload;
  draft_inputs?: PathAdvisorConversationDraftInputsPayload;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && !Array.isArray(value) && typeof value === 'object';
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
  const actualKeys = Object.keys(value);

  for (let i = 0; i < actualKeys.length; i++) {
    if (allowedKeys.indexOf(actualKeys[i]) === -1) {
      return false;
    }
  }

  return true;
}

function hasRequiredKeys(value: Record<string, unknown>, requiredKeys: string[]): boolean {
  for (let i = 0; i < requiredKeys.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(value, requiredKeys[i])) {
      return false;
    }
  }

  return true;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
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

function buildConversationRoute(domain: PathAdvisorGovernedDomain): PathAdvisorConversationRoute {
  if (domain === 'fehb') {
    return 'fehb_explanation';
  }

  if (domain === 'cross_domain') {
    return 'cross_domain_explanation';
  }

  return 'qualification_explanation';
}

function isConversationEntity(value: unknown): value is PathAdvisorConversationEntityPayload {
  if (!isPlainObject(value)) {
    return false;
  }

  if (!hasOnlyAllowedKeys(value, ['entity_type', 'entity_id', 'entity_label'])) {
    return false;
  }

  if (!hasRequiredKeys(value, ['entity_type', 'entity_id', 'entity_label'])) {
    return false;
  }

  return (
    (value.entity_type === 'job' ||
      value.entity_type === 'dashboard' ||
      value.entity_type === 'unknown') &&
    isNullableString(value.entity_id) &&
    isNullableString(value.entity_label)
  );
}

function isConversationDraftInputs(
  value: unknown
): value is PathAdvisorConversationDraftInputsPayload {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !hasOnlyAllowedKeys(value, [
      'focus_topics',
      'selected_missing_inputs',
      'selected_next_steps',
    ])
  ) {
    return false;
  }

  if (Object.keys(value).length === 0) {
    return false;
  }

  return (
    (value.focus_topics === undefined || isStringArray(value.focus_topics)) &&
    (value.selected_missing_inputs === undefined || isStringArray(value.selected_missing_inputs)) &&
    (value.selected_next_steps === undefined || isStringArray(value.selected_next_steps))
  );
}

function isGovernedKeyFactor(
  value: unknown
): value is PathAdvisorConversationGovernedContextPayload['key_factors'][number] {
  if (!isPlainObject(value)) {
    return false;
  }

  if (!hasOnlyAllowedKeys(value, ['factor_type', 'label', 'detail', 'code', 'severity'])) {
    return false;
  }

  if (!hasRequiredKeys(value, ['factor_type', 'label', 'detail', 'code', 'severity'])) {
    return false;
  }

  return (
    isString(value.factor_type) &&
    isString(value.label) &&
    isString(value.detail) &&
    isNullableString(value.code) &&
    isNullableString(value.severity)
  );
}

function isGovernedGrounding(
  value: unknown
): value is PathAdvisorConversationGroundingPayload {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !hasOnlyAllowedKeys(value, [
      'domain',
      'response_state',
      'grounded',
      'partial',
      'missing_inputs',
      'pack_id',
      'pack_key',
      'version_id',
      'version',
      'freshness_state',
      'freshness_reason',
      'serving_eligible',
      'conversation_provider',
      'provider_used',
    ])
  ) {
    return false;
  }

  if (
    !hasRequiredKeys(value, [
      'domain',
      'response_state',
      'grounded',
      'partial',
      'conversation_provider',
      'provider_used',
    ])
  ) {
    return false;
  }

  if (
    !(
      value.domain === 'qualification' ||
      value.domain === 'fehb' ||
      value.domain === 'cross_domain'
    )
  ) {
    return false;
  }

  if (
    !(
      value.response_state === 'grounded' ||
      value.response_state === 'partial' ||
      value.response_state === 'refused'
    )
  ) {
    return false;
  }

  return (
    typeof value.grounded === 'boolean' &&
    typeof value.partial === 'boolean' &&
    (value.missing_inputs === undefined || isStringArray(value.missing_inputs)) &&
    (value.pack_id === undefined || isNullableString(value.pack_id)) &&
    (value.pack_key === undefined || isNullableString(value.pack_key)) &&
    (value.version_id === undefined || isNullableString(value.version_id)) &&
    (value.version === undefined || isNullableNumber(value.version)) &&
    (value.freshness_state === undefined || isNullableString(value.freshness_state)) &&
    (value.freshness_reason === undefined || isNullableString(value.freshness_reason)) &&
    (value.serving_eligible === undefined || typeof value.serving_eligible === 'boolean') &&
    isString(value.conversation_provider) &&
    typeof value.provider_used === 'boolean'
  );
}

function isGovernedContext(
  value: unknown
): value is PathAdvisorConversationGovernedContextPayload {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !hasOnlyAllowedKeys(value, [
      'response_state',
      'grounded',
      'summary',
      'explanation',
      'key_factors',
      'missing_inputs',
      'next_steps',
      'refusal_reason',
      'pack_version_id',
      'freshness_state',
      'grounding',
    ])
  ) {
    return false;
  }

  if (!hasRequiredKeys(value, ['response_state', 'grounded', 'grounding'])) {
    return false;
  }

  if (
    !(
      value.response_state === 'grounded' ||
      value.response_state === 'partial' ||
      value.response_state === 'refused'
    )
  ) {
    return false;
  }

  if (!Array.isArray(value.key_factors)) {
    return false;
  }

  for (let i = 0; i < value.key_factors.length; i++) {
    if (!isGovernedKeyFactor(value.key_factors[i])) {
      return false;
    }
  }

  return (
    typeof value.grounded === 'boolean' &&
    (value.summary === undefined || isString(value.summary)) &&
    (value.explanation === undefined || isString(value.explanation)) &&
    (value.missing_inputs === undefined || isStringArray(value.missing_inputs)) &&
    (value.next_steps === undefined || isStringArray(value.next_steps)) &&
    (value.refusal_reason === undefined || isNullableString(value.refusal_reason)) &&
    (value.pack_version_id === undefined || isNullableString(value.pack_version_id)) &&
    (value.freshness_state === undefined || isNullableString(value.freshness_state)) &&
    isGovernedGrounding(value.grounding)
  );
}

/**
 * Convert the bounded local conversation context into the exact backend
 * request schema.
 *
 * Why this exists:
 * The builder strips the request to the allowed fields only and reuses the
 * backend-shaped governed response already present in screen state. If no
 * governed response exists yet, the caller must fetch governed truth first.
 */
export function buildPathAdvisorConversationRequestPayload(
  userMessage: string,
  context: PathAdvisorGovernedConversationContext
): PathAdvisorConversationRequestPayload {
  if (context.governedResponse === null) {
    throw new Error(
      'PathAdvisor needs a governed result before it can request a bounded conversation explanation.'
    );
  }

  const payload: PathAdvisorConversationRequestPayload = {
    route: buildConversationRoute(context.requestDomain),
    domain: context.requestDomain,
    user_message: userMessage,
    trust_state: 'governed',
    governed_context: {
      response_state: context.governedResponse.responseState,
      grounded: context.governedResponse.grounded,
      summary: context.governedResponse.summary,
      explanation: context.governedResponse.explanation,
      key_factors: context.governedResponse.keyFactors.map(function (item) {
        return {
          factor_type: item.factorType,
          label: item.label,
          detail: item.detail,
          code: item.code,
          severity: item.severity,
        };
      }),
      missing_inputs: context.governedResponse.missingInputs.map(function (item) {
        return item;
      }),
      next_steps: context.governedResponse.nextSteps.map(function (item) {
        return item;
      }),
      refusal_reason: context.governedResponse.refusalReason,
      pack_version_id: context.governedResponse.packVersionId,
      freshness_state: context.governedResponse.freshnessState,
      grounding: {
        domain: context.governedResponse.grounding.domain,
        response_state: context.governedResponse.grounding.responseState,
        grounded: context.governedResponse.grounding.grounded,
        partial: context.governedResponse.grounding.partial,
        missing_inputs: context.governedResponse.grounding.missingInputs.map(function (item) {
          return item;
        }),
        pack_id: context.governedResponse.grounding.packId,
        pack_key: context.governedResponse.grounding.packKey,
        version_id: context.governedResponse.grounding.versionId,
        version: context.governedResponse.grounding.version,
        freshness_state: context.governedResponse.grounding.freshnessState,
        freshness_reason: context.governedResponse.grounding.freshnessReason,
        serving_eligible: context.governedResponse.grounding.servingEligible,
        conversation_provider: context.governedResponse.grounding.conversationProvider,
        provider_used: context.governedResponse.grounding.providerUsed,
      },
    },
  };

  /**
   * Only forward backend-accepted list hints when an upstream surface
   * explicitly provides them. Raw qualification or FEHB draft objects are
   * never valid conversation `draft_inputs`.
   */
  if (context.conversationDraftInputs !== undefined) {
    const draftInputs: PathAdvisorConversationDraftInputsPayload = {};

    if (context.conversationDraftInputs.focusTopics.length > 0) {
      draftInputs.focus_topics = context.conversationDraftInputs.focusTopics.map(function (item) {
        return item;
      });
    }

    if (context.conversationDraftInputs.selectedMissingInputs.length > 0) {
      draftInputs.selected_missing_inputs = context.conversationDraftInputs.selectedMissingInputs.map(function (item) {
        return item;
      });
    }

    if (context.conversationDraftInputs.selectedNextSteps.length > 0) {
      draftInputs.selected_next_steps = context.conversationDraftInputs.selectedNextSteps.map(function (item) {
        return item;
      });
    }

    if (Object.keys(draftInputs).length > 0) {
      payload.draft_inputs = draftInputs;
    }
  }

  if (context.selectedEntity.entityType !== 'dashboard' || context.selectedEntity.entityId !== null) {
    payload.entity = {
      entity_type: context.selectedEntity.entityType,
      entity_id: context.selectedEntity.entityId,
      entity_label: context.selectedEntity.entityLabel,
    };
  }

  return payload;
}

/**
 * Validate the exact bounded backend request schema.
 *
 * Why exactness matters:
 * The backend uses `extra="forbid"`. This validator therefore rejects unknown
 * keys at every level and enforces the exact top-level contract the backend
 * accepts.
 */
export function isPathAdvisorConversationRequestPayload(
  payload: unknown
): payload is PathAdvisorConversationRequestPayload {
  if (!isPlainObject(payload)) {
    return false;
  }

  if (
    !hasOnlyAllowedKeys(payload, [
      'route',
      'domain',
      'user_message',
      'governed_context',
      'trust_state',
      'entity',
      'draft_inputs',
    ])
  ) {
    return false;
  }

  if (!hasRequiredKeys(payload, ['route', 'domain', 'user_message', 'governed_context'])) {
    return false;
  }

  if (
    !(
      payload.route === 'qualification_explanation' ||
      payload.route === 'fehb_explanation' ||
      payload.route === 'cross_domain_explanation'
    )
  ) {
    return false;
  }

  if (
    !(
      payload.domain === 'qualification' ||
      payload.domain === 'fehb' ||
      payload.domain === 'cross_domain'
    )
  ) {
    return false;
  }

  return (
    isString(payload.user_message) &&
    payload.user_message.trim() !== '' &&
    (payload.trust_state === undefined || payload.trust_state === 'governed') &&
    (payload.entity === undefined || isConversationEntity(payload.entity)) &&
    (payload.draft_inputs === undefined || isConversationDraftInputs(payload.draft_inputs)) &&
    isGovernedContext(payload.governed_context)
  );
}
