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
 * - optional bounded intelligence_context/carry_forward_context/route_context/trust_state/entity/draft_inputs only
 *
 * The frontend must therefore build and validate the exact payload shape the
 * backend expects, with no nested wrapper object and no UI-shaped extras.
 */

import type { PathAdvisorGovernedDomain } from '@pathos/ui';
import type { PathAdvisorGovernedConversationContext } from './conversation-context';

export type PathAdvisorConversationRoute =
  | 'qualification_explanation'
  | 'application_confidence_explanation'
  | 'resume_readiness_explanation'
  | 'job_search_explanation'
  | 'fehb_explanation'
  | 'cross_domain_explanation';

export interface PathAdvisorConversationEntityPayload {
  entity_type: 'job' | 'dashboard' | 'unknown';
  entity_id: string | null;
  entity_label: string | null;
}

export interface PathAdvisorConversationTargetScopePayload {
  source_kind:
    | 'career_readiness'
    | 'resume_readiness'
    | 'workspace_resume'
    | 'qualification_draft'
    | 'route_anchor';
  raw_label: string;
  normalized_title: string | null;
  series_code: string | null;
  grade: string | null;
  family_tags: string[];
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
  entry_planning?: {
    planning_basis: 'explicit_intent' | 'capability_fallback' | 'default_fallback' | 'mixed';
    planning_summary: string;
    planned_domains: Array<{
      domain: 'qualification' | 'job_search' | 'application_confidence' | 'resume_readiness';
      selection_basis:
        | 'explicit_intent'
        | 'capability_fallback'
        | 'default_fallback'
        | 'mixed';
      capability_state: 'available' | 'unavailable' | 'not_required';
      capability_reason: string | null;
    }>;
  };
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

export interface PathAdvisorConversationWorkspaceResumePayload {
  id: string;
  name: string;
  mode: 'master' | 'tailored';
  updated_at: string;
  target_role_title: string | null;
}

export interface PathAdvisorConversationCareerReadinessPayload {
  snapshot_id: string;
  generated_at: string;
  overall_score: number;
  label: string;
  target_role: string;
  spokes: Record<string, number>;
  top_gaps: string[];
  next_actions: string[];
  missing_evidence: string[];
}

export interface PathAdvisorConversationResumeReadinessPayload {
  snapshot_id: string;
  generated_at: string;
  overall_score: number;
  target_role: string;
  categories: Record<string, number>;
  suggestions: string[];
  missing_evidence: string[];
}

export interface PathAdvisorConversationApplicationConfidencePayload {
  source: 'fallback' | 'partial_live' | 'live';
  screen_id: string;
  job_id: string;
  job_title: string;
  target_role: string;
  overall_score: number;
  recommendation: string;
  decision_band: string;
  confidence_band: string;
  rationale_summary: string;
  priority_level: string | null;
  alert_importance: string | null;
  blocking_issues: string[];
  missing_evidence: string[];
  next_actions: string[];
  decision_version: string | null;
}

export interface PathAdvisorConversationIntelligenceContextPayload {
  source: 'fallback' | 'partial_live' | 'live';
  workspace_resume?: PathAdvisorConversationWorkspaceResumePayload | null;
  career_readiness?: PathAdvisorConversationCareerReadinessPayload | null;
  resume_readiness?: PathAdvisorConversationResumeReadinessPayload | null;
  application_confidence?: PathAdvisorConversationApplicationConfidencePayload | null;
}

export interface PathAdvisorConversationRouteContextSectionPayload {
  title: string | null;
  lines: string[];
  bullets: string[];
}

export interface PathAdvisorConversationRouteContextEntryPayload {
  title: string;
  subtitle: string | null;
  sections: PathAdvisorConversationRouteContextSectionPayload[];
}

export interface PathAdvisorConversationRouteContextPayload {
  screen_id: string;
  active_anchor: {
    anchor_type: 'job' | 'resume' | 'card' | 'screen' | 'other';
    anchor_id: string;
    anchor_label: string;
  };
  target_scope?: PathAdvisorConversationTargetScopePayload;
  recent_entries: PathAdvisorConversationRouteContextEntryPayload[];
}

export interface PathAdvisorConversationCarryForwardContextPayload {
  source_kind: 'immediately_previous_user_turn';
  transform_kind: 'same_thing_but' | 'modifier_follow_up';
  base_user_message: string;
  prior_user_message: string;
  original_user_message: string;
  effective_user_message: string;
  modifiers: Array<{
    kind: 'grade' | 'series' | 'location' | 'work_arrangement' | 'freeform';
    value: string;
  }>;
  modifier_changes: Array<{
    kind: 'grade' | 'series' | 'location' | 'work_arrangement' | 'freeform';
    operation: 'add' | 'replace' | 'remove';
    value: string | null;
    previous_value: string | null;
  }>;
}

export interface PathAdvisorConversationRequestPayload {
  route: PathAdvisorConversationRoute;
  domain: PathAdvisorGovernedDomain;
  user_message: string;
  governed_context: PathAdvisorConversationGovernedContextPayload;
  intelligence_context?: PathAdvisorConversationIntelligenceContextPayload;
  carry_forward_context?: PathAdvisorConversationCarryForwardContextPayload;
  current_target_scope?: PathAdvisorConversationTargetScopePayload;
  route_context?: PathAdvisorConversationRouteContextPayload;
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

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
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

function isStringNumberRecord(value: unknown): value is Record<string, number> {
  if (!isPlainObject(value)) {
    return false;
  }

  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i++) {
    if (typeof value[keys[i]] !== 'number') {
      return false;
    }
  }

  return true;
}

function isTargetScope(
  value: unknown
): value is PathAdvisorConversationTargetScopePayload {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !hasOnlyAllowedKeys(value, [
      'source_kind',
      'raw_label',
      'normalized_title',
      'series_code',
      'grade',
      'family_tags',
    ])
  ) {
    return false;
  }

  if (
    !hasRequiredKeys(value, [
      'source_kind',
      'raw_label',
      'normalized_title',
      'series_code',
      'grade',
      'family_tags',
    ])
  ) {
    return false;
  }

  if (
    !(
      value.source_kind === 'career_readiness' ||
      value.source_kind === 'resume_readiness' ||
      value.source_kind === 'workspace_resume' ||
      value.source_kind === 'qualification_draft' ||
      value.source_kind === 'route_anchor'
    )
  ) {
    return false;
  }

  return (
    isString(value.raw_label) &&
    isNullableString(value.normalized_title) &&
    isNullableString(value.series_code) &&
    isNullableString(value.grade) &&
    isStringArray(value.family_tags)
  );
}

function buildConversationRoute(domain: PathAdvisorGovernedDomain): PathAdvisorConversationRoute {
  if (domain === 'application_confidence') {
    return 'application_confidence_explanation';
  }

  if (domain === 'resume_readiness') {
    return 'resume_readiness_explanation';
  }

  if (domain === 'job_search') {
    return 'job_search_explanation';
  }

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
      'entry_planning',
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
      value.domain === 'application_confidence' ||
      value.domain === 'resume_readiness' ||
      value.domain === 'job_search' ||
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
    typeof value.provider_used === 'boolean' &&
    (value.entry_planning === undefined || isEntryPlanning(value.entry_planning))
  );
}

function isEntryPlanningDomain(
  value: unknown
): value is NonNullable<PathAdvisorConversationGroundingPayload['entry_planning']>['planned_domains'][number] {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !hasOnlyAllowedKeys(value, [
      'domain',
      'selection_basis',
      'capability_state',
      'capability_reason',
    ])
  ) {
    return false;
  }

  if (
    !hasRequiredKeys(value, [
      'domain',
      'selection_basis',
      'capability_state',
      'capability_reason',
    ])
  ) {
    return false;
  }

  return (
    (value.domain === 'qualification' ||
      value.domain === 'job_search' ||
      value.domain === 'application_confidence' ||
      value.domain === 'resume_readiness') &&
    (value.selection_basis === 'explicit_intent' ||
      value.selection_basis === 'capability_fallback' ||
      value.selection_basis === 'default_fallback' ||
      value.selection_basis === 'mixed') &&
    (value.capability_state === 'available' ||
      value.capability_state === 'unavailable' ||
      value.capability_state === 'not_required') &&
    isNullableString(value.capability_reason)
  );
}

function isEntryPlanning(
  value: unknown
): value is NonNullable<PathAdvisorConversationGroundingPayload['entry_planning']> {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !hasOnlyAllowedKeys(value, [
      'planning_basis',
      'planning_summary',
      'planned_domains',
    ])
  ) {
    return false;
  }

  if (
    !hasRequiredKeys(value, [
      'planning_basis',
      'planning_summary',
      'planned_domains',
    ])
  ) {
    return false;
  }

  if (
    !(
      value.planning_basis === 'explicit_intent' ||
      value.planning_basis === 'capability_fallback' ||
      value.planning_basis === 'default_fallback' ||
      value.planning_basis === 'mixed'
    ) ||
    !isString(value.planning_summary) ||
    !Array.isArray(value.planned_domains)
  ) {
    return false;
  }

  for (let i = 0; i < value.planned_domains.length; i++) {
    if (!isEntryPlanningDomain(value.planned_domains[i])) {
      return false;
    }
  }

  return true;
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

function isWorkspaceResumeContext(
  value: unknown
): value is PathAdvisorConversationWorkspaceResumePayload {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !hasOnlyAllowedKeys(value, ['id', 'name', 'mode', 'updated_at', 'target_role_title'])
  ) {
    return false;
  }

  if (
    !hasRequiredKeys(value, ['id', 'name', 'mode', 'updated_at', 'target_role_title'])
  ) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.name) &&
    (value.mode === 'master' || value.mode === 'tailored') &&
    isString(value.updated_at) &&
    isNullableString(value.target_role_title)
  );
}

function isCareerReadinessContext(
  value: unknown
): value is PathAdvisorConversationCareerReadinessPayload {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !hasOnlyAllowedKeys(value, [
      'snapshot_id',
      'generated_at',
      'overall_score',
      'label',
      'target_role',
      'spokes',
      'top_gaps',
      'next_actions',
      'missing_evidence',
    ])
  ) {
    return false;
  }

  if (
    !hasRequiredKeys(value, [
      'snapshot_id',
      'generated_at',
      'overall_score',
      'label',
      'target_role',
      'spokes',
      'top_gaps',
      'next_actions',
      'missing_evidence',
    ])
  ) {
    return false;
  }

  return (
    isString(value.snapshot_id) &&
    isString(value.generated_at) &&
    isNumber(value.overall_score) &&
    isString(value.label) &&
    isString(value.target_role) &&
    isStringNumberRecord(value.spokes) &&
    isStringArray(value.top_gaps) &&
    isStringArray(value.next_actions) &&
    isStringArray(value.missing_evidence)
  );
}

function isResumeReadinessContext(
  value: unknown
): value is PathAdvisorConversationResumeReadinessPayload {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !hasOnlyAllowedKeys(value, [
      'snapshot_id',
      'generated_at',
      'overall_score',
      'target_role',
      'categories',
      'suggestions',
      'missing_evidence',
    ])
  ) {
    return false;
  }

  if (
    !hasRequiredKeys(value, [
      'snapshot_id',
      'generated_at',
      'overall_score',
      'target_role',
      'categories',
      'suggestions',
      'missing_evidence',
    ])
  ) {
    return false;
  }

  return (
    isString(value.snapshot_id) &&
    isString(value.generated_at) &&
    isNumber(value.overall_score) &&
    isString(value.target_role) &&
    isStringNumberRecord(value.categories) &&
    isStringArray(value.suggestions) &&
    isStringArray(value.missing_evidence)
  );
}

function isApplicationConfidenceContext(
  value: unknown
): value is PathAdvisorConversationApplicationConfidencePayload {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !hasOnlyAllowedKeys(value, [
      'source',
      'screen_id',
      'job_id',
      'job_title',
      'target_role',
      'overall_score',
      'recommendation',
      'decision_band',
      'confidence_band',
      'rationale_summary',
      'priority_level',
      'alert_importance',
      'blocking_issues',
      'missing_evidence',
      'next_actions',
      'decision_version',
    ])
  ) {
    return false;
  }

  if (
    !hasRequiredKeys(value, [
      'source',
      'screen_id',
      'job_id',
      'job_title',
      'target_role',
      'overall_score',
      'recommendation',
      'decision_band',
      'confidence_band',
      'rationale_summary',
      'priority_level',
      'alert_importance',
      'blocking_issues',
      'missing_evidence',
      'next_actions',
      'decision_version',
    ])
  ) {
    return false;
  }

  return (
    (value.source === 'fallback' ||
      value.source === 'partial_live' ||
      value.source === 'live') &&
    isString(value.screen_id) &&
    isString(value.job_id) &&
    isString(value.job_title) &&
    isString(value.target_role) &&
    isNumber(value.overall_score) &&
    isString(value.recommendation) &&
    isString(value.decision_band) &&
    isString(value.confidence_band) &&
    isString(value.rationale_summary) &&
    isNullableString(value.priority_level) &&
    isNullableString(value.alert_importance) &&
    isStringArray(value.blocking_issues) &&
    isStringArray(value.missing_evidence) &&
    isStringArray(value.next_actions) &&
    isNullableString(value.decision_version)
  );
}

function isIntelligenceContext(
  value: unknown
): value is PathAdvisorConversationIntelligenceContextPayload {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    !hasOnlyAllowedKeys(value, [
      'source',
      'workspace_resume',
      'career_readiness',
      'resume_readiness',
      'application_confidence',
    ])
  ) {
    return false;
  }

  if (!hasRequiredKeys(value, ['source'])) {
    return false;
  }

  if (
    !(
      value.source === 'fallback' ||
      value.source === 'partial_live' ||
      value.source === 'live'
    )
  ) {
    return false;
  }

  return (
    (value.workspace_resume === undefined ||
      value.workspace_resume === null ||
      isWorkspaceResumeContext(value.workspace_resume)) &&
    (value.career_readiness === undefined ||
      value.career_readiness === null ||
      isCareerReadinessContext(value.career_readiness)) &&
    (value.resume_readiness === undefined ||
      value.resume_readiness === null ||
      isResumeReadinessContext(value.resume_readiness)) &&
    (value.application_confidence === undefined ||
      value.application_confidence === null ||
      isApplicationConfidenceContext(value.application_confidence))
  );
}

function isRouteContextSection(
  value: unknown
): value is PathAdvisorConversationRouteContextSectionPayload {
  if (!isPlainObject(value)) {
    return false;
  }

  if (!hasOnlyAllowedKeys(value, ['title', 'lines', 'bullets'])) {
    return false;
  }

  if (!hasRequiredKeys(value, ['title', 'lines', 'bullets'])) {
    return false;
  }

  return (
    isNullableString(value.title) &&
    isStringArray(value.lines) &&
    isStringArray(value.bullets)
  );
}

function isRouteContextEntry(
  value: unknown
): value is PathAdvisorConversationRouteContextEntryPayload {
  if (!isPlainObject(value)) {
    return false;
  }

  if (!hasOnlyAllowedKeys(value, ['title', 'subtitle', 'sections'])) {
    return false;
  }

  if (!hasRequiredKeys(value, ['title', 'subtitle', 'sections'])) {
    return false;
  }

  if (!isString(value.title) || !isNullableString(value.subtitle) || !Array.isArray(value.sections)) {
    return false;
  }

  for (let i = 0; i < value.sections.length; i++) {
    if (!isRouteContextSection(value.sections[i])) {
      return false;
    }
  }

  return true;
}

function isRouteContext(
  value: unknown
): value is PathAdvisorConversationRouteContextPayload {
  if (!isPlainObject(value)) {
    return false;
  }

  if (!hasOnlyAllowedKeys(value, ['screen_id', 'active_anchor', 'target_scope', 'recent_entries'])) {
    return false;
  }

  if (!hasRequiredKeys(value, ['screen_id', 'active_anchor', 'recent_entries'])) {
    return false;
  }

  if (
    !isString(value.screen_id) ||
    !isPlainObject(value.active_anchor) ||
    !Array.isArray(value.recent_entries)
  ) {
    return false;
  }

  if (
    !hasOnlyAllowedKeys(value.active_anchor, ['anchor_type', 'anchor_id', 'anchor_label']) ||
    !hasRequiredKeys(value.active_anchor, ['anchor_type', 'anchor_id', 'anchor_label'])
  ) {
    return false;
  }

  if (
    !(
      value.active_anchor.anchor_type === 'job' ||
      value.active_anchor.anchor_type === 'resume' ||
      value.active_anchor.anchor_type === 'card' ||
      value.active_anchor.anchor_type === 'screen' ||
      value.active_anchor.anchor_type === 'other'
    )
  ) {
    return false;
  }

  if (!isString(value.active_anchor.anchor_id) || !isString(value.active_anchor.anchor_label)) {
    return false;
  }

  if (value.target_scope !== undefined && !isTargetScope(value.target_scope)) {
    return false;
  }

  for (let i = 0; i < value.recent_entries.length; i++) {
    if (!isRouteContextEntry(value.recent_entries[i])) {
      return false;
    }
  }

  return true;
}

function isCarryForwardContext(
  value: unknown
): value is PathAdvisorConversationCarryForwardContextPayload {
  function isCarryForwardModifier(
    modifier: unknown
  ): modifier is PathAdvisorConversationCarryForwardContextPayload['modifiers'][number] {
    return (
      isPlainObject(modifier) &&
      hasOnlyAllowedKeys(modifier, ['kind', 'value']) &&
      hasRequiredKeys(modifier, ['kind', 'value']) &&
      (
        modifier.kind === 'grade' ||
        modifier.kind === 'series' ||
        modifier.kind === 'location' ||
        modifier.kind === 'work_arrangement' ||
        modifier.kind === 'freeform'
      ) &&
      isString(modifier.value) &&
      modifier.value.trim() !== ''
    );
  }

  return (
    isPlainObject(value) &&
    hasOnlyAllowedKeys(value, [
      'source_kind',
      'transform_kind',
      'base_user_message',
      'prior_user_message',
      'original_user_message',
      'effective_user_message',
      'modifiers',
      'modifier_changes',
    ]) &&
    hasRequiredKeys(value, [
      'source_kind',
      'transform_kind',
      'base_user_message',
      'prior_user_message',
      'original_user_message',
      'effective_user_message',
      'modifiers',
      'modifier_changes',
    ]) &&
    value.source_kind === 'immediately_previous_user_turn' &&
    (value.transform_kind === 'same_thing_but' ||
      value.transform_kind === 'modifier_follow_up') &&
    isString(value.base_user_message) &&
    value.base_user_message.trim() !== '' &&
    isString(value.prior_user_message) &&
    value.prior_user_message.trim() !== '' &&
    isString(value.original_user_message) &&
    value.original_user_message.trim() !== '' &&
    isString(value.effective_user_message) &&
    value.effective_user_message.trim() !== '' &&
    Array.isArray(value.modifiers) &&
    Array.isArray(value.modifier_changes) &&
    value.modifiers.every(function (item) {
      return isCarryForwardModifier(item);
    }) &&
    value.modifier_changes.every(function (item) {
      return (
        isPlainObject(item) &&
        hasOnlyAllowedKeys(item, ['kind', 'operation', 'value', 'previous_value']) &&
        hasRequiredKeys(item, ['kind', 'operation', 'value', 'previous_value']) &&
        (
          item.kind === 'grade' ||
          item.kind === 'series' ||
          item.kind === 'location' ||
          item.kind === 'work_arrangement' ||
          item.kind === 'freeform'
        ) &&
        (
          item.operation === 'add' ||
          item.operation === 'replace' ||
          item.operation === 'remove'
        ) &&
        isNullableString(item.value) &&
        isNullableString(item.previous_value)
      );
    })
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
        entry_planning:
          context.governedResponse.grounding.entryPlanning !== undefined &&
          context.governedResponse.grounding.entryPlanning !== null
            ? {
                planning_basis: context.governedResponse.grounding.entryPlanning.planningBasis,
                planning_summary:
                  context.governedResponse.grounding.entryPlanning.planningSummary,
                planned_domains:
                  context.governedResponse.grounding.entryPlanning.plannedDomains.map(function (item) {
                    return {
                      domain: item.domain,
                      selection_basis: item.selectionBasis,
                      capability_state: item.capabilityState,
                      capability_reason: item.capabilityReason,
                    };
                  }),
              }
            : undefined,
      },
    },
  };

  if (context.intelligenceContext !== undefined) {
    payload.intelligence_context = {
      source: context.intelligenceContext.source,
      workspace_resume:
        context.intelligenceContext.workspaceResume === null
          ? null
          : {
              id: context.intelligenceContext.workspaceResume.id,
              name: context.intelligenceContext.workspaceResume.name,
              mode: context.intelligenceContext.workspaceResume.mode,
              updated_at: context.intelligenceContext.workspaceResume.updatedAt,
              target_role_title: context.intelligenceContext.workspaceResume.targetRoleTitle,
            },
      career_readiness:
        context.intelligenceContext.careerReadiness === null
          ? null
          : {
              snapshot_id: context.intelligenceContext.careerReadiness.snapshotId,
              generated_at: context.intelligenceContext.careerReadiness.generatedAt,
              overall_score: context.intelligenceContext.careerReadiness.overallScore,
              label: context.intelligenceContext.careerReadiness.label,
              target_role: context.intelligenceContext.careerReadiness.targetRole,
              spokes: context.intelligenceContext.careerReadiness.spokes,
              top_gaps: context.intelligenceContext.careerReadiness.topGaps.map(function (item) {
                return item;
              }),
              next_actions: context.intelligenceContext.careerReadiness.nextActions.map(function (item) {
                return item;
              }),
              missing_evidence: context.intelligenceContext.careerReadiness.missingEvidence.map(function (item) {
                return item;
              }),
            },
      resume_readiness:
        context.intelligenceContext.resumeReadiness === null
          ? null
          : {
              snapshot_id: context.intelligenceContext.resumeReadiness.snapshotId,
              generated_at: context.intelligenceContext.resumeReadiness.generatedAt,
              overall_score: context.intelligenceContext.resumeReadiness.overallScore,
              target_role: context.intelligenceContext.resumeReadiness.targetRole,
              categories: context.intelligenceContext.resumeReadiness.categories,
              suggestions: context.intelligenceContext.resumeReadiness.suggestions.map(function (item) {
                return item;
              }),
              missing_evidence: context.intelligenceContext.resumeReadiness.missingEvidence.map(function (item) {
                return item;
              }),
            },
      application_confidence:
        context.intelligenceContext.applicationConfidence === null ||
        context.intelligenceContext.applicationConfidence === undefined
          ? null
          : {
              source: context.intelligenceContext.applicationConfidence.source,
              screen_id: context.intelligenceContext.applicationConfidence.screenId,
              job_id: context.intelligenceContext.applicationConfidence.jobId,
              job_title: context.intelligenceContext.applicationConfidence.jobTitle,
              target_role: context.intelligenceContext.applicationConfidence.targetRole,
              overall_score: context.intelligenceContext.applicationConfidence.overallScore,
              recommendation: context.intelligenceContext.applicationConfidence.recommendation,
              decision_band: context.intelligenceContext.applicationConfidence.decisionBand,
              confidence_band: context.intelligenceContext.applicationConfidence.confidenceBand,
              rationale_summary: context.intelligenceContext.applicationConfidence.rationaleSummary,
              priority_level: context.intelligenceContext.applicationConfidence.priorityLevel,
              alert_importance: context.intelligenceContext.applicationConfidence.alertImportance,
              blocking_issues: context.intelligenceContext.applicationConfidence.blockingIssues.map(function (item) {
                return item;
              }),
              missing_evidence: context.intelligenceContext.applicationConfidence.missingEvidence.map(function (item) {
                return item;
              }),
              next_actions: context.intelligenceContext.applicationConfidence.nextActions.map(function (item) {
                return item;
              }),
              decision_version: context.intelligenceContext.applicationConfidence.decisionVersion,
            },
    };
  }

  if (context.carryForwardContext !== undefined) {
    payload.carry_forward_context = {
      source_kind: context.carryForwardContext.sourceKind,
      transform_kind: context.carryForwardContext.transformKind,
      base_user_message: context.carryForwardContext.baseUserMessage,
      prior_user_message: context.carryForwardContext.priorUserMessage,
      original_user_message: context.carryForwardContext.originalUserMessage,
      effective_user_message: context.carryForwardContext.effectiveUserMessage,
      modifiers: context.carryForwardContext.modifiers.map(function (item) {
        return {
          kind: item.kind,
          value: item.value,
        };
      }),
      modifier_changes: context.carryForwardContext.modifierChanges.map(function (item) {
        return {
          kind: item.kind,
          operation: item.operation,
          value: item.value,
          previous_value: item.previousValue,
        };
      }),
    };
  }

  if (context.currentTargetScope !== undefined) {
    payload.current_target_scope = {
      source_kind: context.currentTargetScope.sourceKind,
      raw_label: context.currentTargetScope.rawLabel,
      normalized_title: context.currentTargetScope.normalizedTitle,
      series_code: context.currentTargetScope.seriesCode,
      grade: context.currentTargetScope.grade,
      family_tags: context.currentTargetScope.familyTags.map(function (item) {
        return item;
      }),
    };
  }

  if (context.routeContext !== undefined) {
    payload.route_context = {
      screen_id: context.routeContext.screenId,
      active_anchor: {
        anchor_type: context.routeContext.activeAnchor.anchorType,
        anchor_id: context.routeContext.activeAnchor.anchorId,
        anchor_label: context.routeContext.activeAnchor.anchorLabel,
      },
      target_scope:
        context.routeContext.targetScope === undefined
          ? undefined
          : {
              source_kind: context.routeContext.targetScope.sourceKind,
              raw_label: context.routeContext.targetScope.rawLabel,
              normalized_title: context.routeContext.targetScope.normalizedTitle,
              series_code: context.routeContext.targetScope.seriesCode,
              grade: context.routeContext.targetScope.grade,
              family_tags: context.routeContext.targetScope.familyTags.map(function (item) {
                return item;
              }),
            },
      recent_entries: context.routeContext.recentEntries.map(function (entry) {
        return {
          title: entry.title,
          subtitle: entry.subtitle,
          sections: entry.sections.map(function (section) {
            return {
              title: section.title,
              lines: section.lines.map(function (item) {
                return item;
              }),
              bullets: section.bullets.map(function (item) {
                return item;
              }),
            };
          }),
        };
      }),
    };
  }

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
      'intelligence_context',
      'carry_forward_context',
      'current_target_scope',
      'route_context',
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
      payload.route === 'application_confidence_explanation' ||
      payload.route === 'resume_readiness_explanation' ||
      payload.route === 'job_search_explanation' ||
      payload.route === 'fehb_explanation' ||
      payload.route === 'cross_domain_explanation'
    )
  ) {
    return false;
  }

  if (
    !(
      payload.domain === 'qualification' ||
      payload.domain === 'application_confidence' ||
      payload.domain === 'resume_readiness' ||
      payload.domain === 'job_search' ||
      payload.domain === 'fehb' ||
      payload.domain === 'cross_domain'
    )
  ) {
    return false;
  }

  return (
    isString(payload.user_message) &&
    payload.user_message.trim() !== '' &&
    (payload.intelligence_context === undefined ||
      isIntelligenceContext(payload.intelligence_context)) &&
    (payload.carry_forward_context === undefined ||
      isCarryForwardContext(payload.carry_forward_context)) &&
    (payload.current_target_scope === undefined ||
      isTargetScope(payload.current_target_scope)) &&
    (payload.route_context === undefined || isRouteContext(payload.route_context)) &&
    (payload.trust_state === undefined || payload.trust_state === 'governed') &&
    (payload.entity === undefined || isConversationEntity(payload.entity)) &&
    (payload.draft_inputs === undefined || isConversationDraftInputs(payload.draft_inputs)) &&
    isGovernedContext(payload.governed_context)
  );
}
