/**
 * ============================================================================
 * LIVE ADVISOR ADAPTERS
 * ============================================================================
 *
 * PURPOSE:
 * Keep backend contract translation in one place so UI components do not need
 * to know backend field names. This file adapts:
 * 1. persisted stored-job summaries -> Saved Jobs live seed records
 * 2. backend advisor output -> UI-safe live evaluation model
 * 3. frontend profile store -> backend UserProfileSnapshot request
 */

import type { Profile } from '@/lib/api/profile';
import type { Job } from '@pathos/core';
import type {
  CanonicalIntelligenceSummary,
  CanonicalJobMatchProjection,
  DashboardIntelligencePayload,
  ResumeBuilderIntelligencePayload,
  ScreenIntelligenceEnvelope,
  SavedJobsLiveApplicationDecision,
  SavedJobsLiveBlockingIssue,
  SavedJobsLiveEvaluation,
  SavedJobsLiveEvidenceRef,
  SavedJobsLiveNextAction,
  SavedJobsLiveReasonLikeItem,
  SavedJobsLiveStoredJob,
} from '@pathos/ui';

export interface BackendStoredJobCatalogItem {
  saved_search_id: string;
  job_id: string;
  title: string | null;
  organization: string | null;
  locations: string[];
  grade_min: number | null;
  grade_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  open_date: string | null;
  close_date: string | null;
  apply_url: string | null;
  source_name: string | null;
  last_seen_at: string | null;
}

export interface BackendEvidenceRef {
  label?: string | null;
  source_category?: string | null;
  fact_status?: string | null;
}

export interface BackendReasonLikeItem {
  code?: string | null;
  rule_id?: string | null;
  basis?: string | null;
  text: string;
  severity?: string | null;
  suggestion?: string | null;
  importance?: string | null;
  evidence_refs?: BackendEvidenceRef[] | null;
}

export interface BackendNextAction {
  code?: string | null;
  action: string;
  priority: number;
}

export interface BackendBlockingIssue {
  code?: string | null;
  rule_id?: string | null;
  source_type?: string | null;
  severity?: string | null;
  text: string;
  evidence_refs?: BackendEvidenceRef[] | null;
}

export interface BackendApplicationDecision {
  decision_band: string;
  priority_level: string;
  alert_importance: string;
  rationale_summary: string;
  blocking_issues?: BackendBlockingIssue[] | null;
  recommended_next_actions?: BackendNextAction[] | null;
  decision_rule_ids?: string[] | null;
  decision_version?: string | null;
}

export interface BackendAdvisorOutput {
  recommendation: string;
  decision_band: string;
  confidence_band: string;
  overall_score: number;
  reasons?: BackendReasonLikeItem[] | null;
  gaps?: BackendReasonLikeItem[] | null;
  warnings?: BackendReasonLikeItem[] | null;
  missing_evidence?: BackendReasonLikeItem[] | null;
  next_actions?: BackendNextAction[] | null;
  application_decision?: BackendApplicationDecision | null;
  meta?: {
    explainability_version?: string | null;
    engine_version?: string | null;
  } | null;
}

export interface BackendCanonicalIntelligenceSummary {
  target_role_clusters: string[];
  preferred_locations: string[];
  readiness_state: string;
  fit_lanes: string[];
  blockers: string[];
  top_missing_items: string[];
  next_best_actions: string[];
  active_threads: string[];
  profile_completeness: number;
  freshness_band: 'fresh' | 'aging' | 'stale' | 'unknown';
  confidence_band: 'low' | 'medium' | 'high';
  recent_meaningful_changes: string[];
  activity_signals: string[];
  updated_at: string;
}

export interface BackendScreenNextAction {
  action_id: string;
  title: string;
  description: string;
  cta_label: string;
  cta_href: string;
  reason: string;
}

export interface BackendCanonicalMatchProjectionDimension {
  dimension_id: string;
  label: string;
  score: number;
  status: 'strong' | 'building' | 'weak';
  explanation: string;
}

export interface BackendCanonicalJobMatchProjection {
  overall_score: number;
  confidence_band: 'low' | 'medium' | 'high';
  blocker_severity: 'low' | 'medium' | 'high';
  explanation_summary: string;
  dimensions: BackendCanonicalMatchProjectionDimension[];
  next_actions: string[];
  blockers: string[];
  warnings: string[];
}

export interface BackendJobSearchIntelligencePayload {
  screen: 'job_search';
  pathadvisor_mode: 'search_refinement';
  context: BackendCanonicalIntelligenceSummary;
  summary: string;
  refinement_suggestions: string[];
  next_best_action: BackendScreenNextAction;
  job_match_projection: BackendCanonicalJobMatchProjection;
  evaluation: BackendAdvisorOutput;
}

export interface BackendJobSearchIntelligenceBatchItem {
  job_id: string;
  payload: BackendJobSearchIntelligencePayload;
}

export interface BackendJobSearchIntelligenceBatchResponse {
  items: BackendJobSearchIntelligenceBatchItem[];
}

export interface BackendSavedJobsIntelligencePayload {
  screen: 'saved_jobs';
  pathadvisor_mode: 'decision_risk';
  context: BackendCanonicalIntelligenceSummary;
  summary: string;
  decision_guidance: string[];
  next_best_action: BackendScreenNextAction;
  job_match_projection: BackendCanonicalJobMatchProjection;
  evaluation: BackendAdvisorOutput;
}

export interface BackendSavedJobsSummaryMetric {
  metric_id: string;
  label: string;
  value: number;
  emphasis: 'neutral' | 'accent' | 'success' | 'warning';
  explanation: string;
}

export interface BackendSavedJobsSummaryPayload {
  screen: 'saved_jobs';
  summary: string;
  metrics: BackendSavedJobsSummaryMetric[];
  next_best_action: BackendScreenNextAction;
}

export function adaptSavedJobsSummaryPayload(
  payload: BackendSavedJobsSummaryPayload
): {
  screen: 'saved_jobs';
  summary: string;
  metrics: Array<{
    metricId: string;
    label: string;
    value: number;
    emphasis: 'neutral' | 'accent' | 'success' | 'warning';
    explanation: string;
  }>;
  nextBestAction: {
    actionId: string;
    title: string;
    description: string;
    ctaLabel: string;
    ctaHref: string;
    reason: string;
  };
} {
  return {
    screen: payload.screen,
    summary: payload.summary,
    metrics: Array.isArray(payload.metrics)
      ? payload.metrics.map(function (metric) {
          return {
            metricId: metric.metric_id,
            label: metric.label,
            value: metric.value,
            emphasis: metric.emphasis,
            explanation: metric.explanation,
          };
        })
      : [],
    nextBestAction: adaptScreenNextAction(payload.next_best_action),
  };
}

export interface BackendDashboardIntelligencePayload {
  screen: 'dashboard';
  pathadvisor_mode: 'strategy_summary';
  context: BackendCanonicalIntelligenceSummary;
  summary: string;
  strongest_current_fit_lanes: string[];
  active_blockers: string[];
  top_missing_items: string[];
  next_best_action: BackendScreenNextAction;
  confidence_summary: string;
}

export interface BackendResumeBuilderIntelligencePayload {
  screen: 'resume_builder';
  pathadvisor_mode: 'readiness_evidence';
  context: BackendCanonicalIntelligenceSummary;
  summary: string;
  target_alignment_warnings: string[];
  evidence_gaps: string[];
  suggested_builder_focus: string[];
  next_best_action: BackendScreenNextAction;
}

export interface BackendStoredJobEvaluationRequest {
  saved_search_id: string;
  job_id: string;
  profile: {
    user_id: string;
    years_experience: number;
    target_roles: string[];
    skills: string[];
    preferred_locations: string[];
    authorized_to_work: boolean;
  };
  user_notes?: string | null;
}

export interface BackendAdvisorEvaluateRequest {
  profile: {
    user_id: string;
    years_experience: number;
    target_roles: string[];
    skills: string[];
    preferred_locations: string[];
    authorized_to_work: boolean;
  };
  job: {
    job_id: string;
    title: string;
    company: string;
    location: {
      city: string | null;
      region: string | null;
      country: string | null;
      remote: boolean;
    };
    grade_range: {
      min_grade: number | null;
      max_grade: number | null;
    } | null;
    posting_dates: {
      posted_date: string | null;
      closes_date: string | null;
    } | null;
    source_url: string | null;
  };
  user_notes?: string | null;
}

export interface BackendAdvisorProfilePayload {
  user_id: string;
  years_experience: number;
  target_roles: string[];
  skills: string[];
  preferred_locations: string[];
  authorized_to_work: boolean;
}

export interface JobSearchEvaluableJob extends Job {
  overview?: {
    remoteJob?: string;
    teleworkEligible?: string;
  };
}

export interface LiveJobSearchFiltersInput {
  gradeBand?: string;
  series?: string;
  agency?: string;
  remoteType?: string;
  appointmentType?: string;
  location?: string;
}

export interface LiveJobSearchQueryInput {
  keyword: string;
  location?: string;
  filters: LiveJobSearchFiltersInput;
  page: number;
  pageSize: number;
}

export interface BackendLiveJobSearchRequest {
  keyword: string;
  location: string | null;
  remote_only: boolean | null;
  grade_min: number | null;
  grade_max: number | null;
  series: string[] | null;
  agency_codes: string[] | null;
  appointment_type: string | null;
  work_schedule: string | null;
  salary_min: number | null;
  page: number;
  page_size: number;
}

export interface BackendCanonicalCompensation {
  grade_min: number | null;
  grade_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
}

export interface BackendCanonicalSourceMetadata {
  source: string;
  retrieved_at: string;
  mapper_version: string | null;
}

export interface BackendCanonicalJobSearchResult {
  id: string;
  title: string;
  organization: string;
  locations: string[];
  compensation: BackendCanonicalCompensation;
  open_date: string | null;
  close_date: string | null;
  apply_url: string;
  source: BackendCanonicalSourceMetadata;
}

export interface BackendLiveJobSearchResponse {
  results: BackendCanonicalJobSearchResult[];
  total: number;
  page: number;
  page_size: number;
  request_id: string;
}

export interface LiveJobSearchResponse {
  results: Job[];
  total: number;
  page: number;
  pageSize: number;
  requestId: string;
}

/**
 * USAJOBS search requires agency subelement codes, not display labels.
 *
 * We only map the curated agencies the frontend explicitly offers. Unknown
 * labels stay unsupported so the UI can surface that honestly instead of
 * silently sending invalid values.
 */
const AGENCY_CODE_BY_NAME: Record<string, string> = {
  'Department of Homeland Security': 'HS00',
  'Department of Veterans Affairs': 'VA00',
  'Department of Defense': 'DD00',
  'Department of Health and Human Services': 'HE00',
  'Department of Justice': 'DJ00',
  'General Services Administration': 'GS00',
  'Office of Personnel Management': 'OM00',
};

/**
 * USAJOBS appointment filtering expects PositionOfferingTypeCode values.
 *
 * The old UI labels implied service categories like "Competitive", which are
 * not the same thing. This map keeps the request aligned to the actual live
 * contract.
 */
const APPOINTMENT_TYPE_CODE_BY_LABEL: Record<string, string> = {
  Permanent: '15317',
  Temporary: '15318',
  Term: '15319',
  Detail: '15320',
  Intermittent: '15522',
};

function normalizeEvidenceRefs(
  refs: BackendEvidenceRef[] | null | undefined
): SavedJobsLiveEvidenceRef[] {
  if (!Array.isArray(refs)) {
    return [];
  }

  const normalized: SavedJobsLiveEvidenceRef[] = [];
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    normalized.push({
      label: ref.label !== undefined ? ref.label : null,
      sourceCategory:
        ref.source_category !== undefined ? ref.source_category : null,
      factStatus: ref.fact_status !== undefined ? ref.fact_status : null,
    });
  }
  return normalized;
}

function normalizeReasonLikeItem(
  item: BackendReasonLikeItem
): SavedJobsLiveReasonLikeItem {
  return {
    code: item.code !== undefined ? item.code : null,
    ruleId: item.rule_id !== undefined ? item.rule_id : null,
    basis: item.basis !== undefined ? item.basis : null,
    text: item.text,
    severity: item.severity !== undefined ? item.severity : null,
    suggestion: item.suggestion !== undefined ? item.suggestion : null,
    importance: item.importance !== undefined ? item.importance : null,
    evidenceRefs: normalizeEvidenceRefs(item.evidence_refs),
  };
}

function normalizeReasonLikeItems(
  items: BackendReasonLikeItem[] | null | undefined
): SavedJobsLiveReasonLikeItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const normalized: SavedJobsLiveReasonLikeItem[] = [];
  for (let i = 0; i < items.length; i++) {
    normalized.push(normalizeReasonLikeItem(items[i]));
  }
  return normalized;
}

function normalizeNextActions(
  items: BackendNextAction[] | null | undefined
): SavedJobsLiveNextAction[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const normalized: SavedJobsLiveNextAction[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    normalized.push({
      code: item.code !== undefined ? item.code : null,
      action: item.action,
      priority: item.priority,
    });
  }
  return normalized;
}

function normalizeBlockingIssues(
  items: BackendBlockingIssue[] | null | undefined
): SavedJobsLiveBlockingIssue[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const normalized: SavedJobsLiveBlockingIssue[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    normalized.push({
      code: item.code !== undefined ? item.code : null,
      ruleId: item.rule_id !== undefined ? item.rule_id : null,
      sourceType: item.source_type !== undefined ? item.source_type : null,
      severity: item.severity !== undefined ? item.severity : null,
      text: item.text,
      evidenceRefs: normalizeEvidenceRefs(item.evidence_refs),
    });
  }
  return normalized;
}

function normalizeApplicationDecision(
  decision: BackendApplicationDecision | null | undefined
): SavedJobsLiveApplicationDecision | null {
  if (decision === null || decision === undefined) {
    return null;
  }

  return {
    decisionBand: decision.decision_band,
    priorityLevel: decision.priority_level,
    alertImportance: decision.alert_importance,
    rationaleSummary: decision.rationale_summary,
    blockingIssues: normalizeBlockingIssues(decision.blocking_issues),
    recommendedNextActions: normalizeNextActions(
      decision.recommended_next_actions
    ),
    decisionRuleIds: Array.isArray(decision.decision_rule_ids)
      ? decision.decision_rule_ids.slice()
      : [],
    decisionVersion:
      decision.decision_version !== undefined ? decision.decision_version : null,
  };
}

export function adaptStoredJobCatalogItems(
  items: BackendStoredJobCatalogItem[]
): SavedJobsLiveStoredJob[] {
  const normalized: SavedJobsLiveStoredJob[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    normalized.push({
      savedSearchId: item.saved_search_id,
      jobId: item.job_id,
      title: item.title,
      organization: item.organization,
      locations: Array.isArray(item.locations) ? item.locations.slice() : [],
      gradeMin: item.grade_min,
      gradeMax: item.grade_max,
      salaryMin: item.salary_min,
      salaryMax: item.salary_max,
      openDate: item.open_date,
      closeDate: item.close_date,
      applyUrl: item.apply_url,
      sourceName: item.source_name,
      lastSeenAt: item.last_seen_at,
    });
  }
  return normalized;
}

export function adaptAdvisorEvaluation(
  payload: BackendAdvisorOutput
): SavedJobsLiveEvaluation {
  let explainabilityVersion: string | null = null;
  let engineVersion: string | null = null;

  if (payload.meta !== null && payload.meta !== undefined) {
    explainabilityVersion =
      payload.meta.explainability_version !== undefined
        ? payload.meta.explainability_version
        : null;
    engineVersion =
      payload.meta.engine_version !== undefined
        ? payload.meta.engine_version
        : null;
  }

  return {
    recommendation: payload.recommendation,
    decisionBand: payload.decision_band,
    confidenceBand: payload.confidence_band,
    overallScore: payload.overall_score,
    reasons: normalizeReasonLikeItems(payload.reasons),
    gaps: normalizeReasonLikeItems(payload.gaps),
    warnings: normalizeReasonLikeItems(payload.warnings),
    missingEvidence: normalizeReasonLikeItems(payload.missing_evidence),
    nextActions: normalizeNextActions(payload.next_actions),
    applicationDecision: normalizeApplicationDecision(
      payload.application_decision
    ),
    explainabilityVersion: explainabilityVersion,
    engineVersion: engineVersion,
  };
}

function adaptCanonicalIntelligenceSummary(
  payload: BackendCanonicalIntelligenceSummary
): CanonicalIntelligenceSummary {
  return {
    targetRoleClusters: Array.isArray(payload.target_role_clusters)
      ? payload.target_role_clusters.slice()
      : [],
    preferredLocations: Array.isArray(payload.preferred_locations)
      ? payload.preferred_locations.slice()
      : [],
    readinessState: payload.readiness_state,
    fitLanes: Array.isArray(payload.fit_lanes) ? payload.fit_lanes.slice() : [],
    blockers: Array.isArray(payload.blockers) ? payload.blockers.slice() : [],
    topMissingItems: Array.isArray(payload.top_missing_items)
      ? payload.top_missing_items.slice()
      : [],
    nextBestActions: Array.isArray(payload.next_best_actions)
      ? payload.next_best_actions.slice()
      : [],
    activeThreads: Array.isArray(payload.active_threads)
      ? payload.active_threads.slice()
      : [],
    profileCompleteness: payload.profile_completeness,
    freshnessBand: payload.freshness_band,
    confidenceBand: payload.confidence_band,
    recentMeaningfulChanges: Array.isArray(payload.recent_meaningful_changes)
      ? payload.recent_meaningful_changes.slice()
      : [],
    activitySignals: Array.isArray(payload.activity_signals)
      ? payload.activity_signals.slice()
      : [],
    updatedAt: payload.updated_at,
  };
}

function adaptScreenNextAction(payload: BackendScreenNextAction) {
  return {
    actionId: payload.action_id,
    title: payload.title,
    description: payload.description,
    ctaLabel: payload.cta_label,
    ctaHref: payload.cta_href,
    reason: payload.reason,
  };
}

function adaptCanonicalProjection(
  payload: BackendCanonicalJobMatchProjection
): CanonicalJobMatchProjection {
  return {
    overallScore: payload.overall_score,
    confidenceBand: payload.confidence_band,
    blockerSeverity: payload.blocker_severity,
    explanationSummary: payload.explanation_summary,
    dimensions: Array.isArray(payload.dimensions)
      ? payload.dimensions.map(function (dimension) {
          return {
            dimensionId: dimension.dimension_id,
            label: dimension.label,
            score: dimension.score,
            status: dimension.status,
            explanation: dimension.explanation,
          };
        })
      : [],
    nextActions: Array.isArray(payload.next_actions)
      ? payload.next_actions.slice()
      : [],
    blockers: Array.isArray(payload.blockers) ? payload.blockers.slice() : [],
    warnings: Array.isArray(payload.warnings) ? payload.warnings.slice() : [],
  };
}

export function adaptJobSearchIntelligencePayload(
  payload: BackendJobSearchIntelligencePayload
): SavedJobsLiveEvaluation {
  const evaluation = adaptAdvisorEvaluation(payload.evaluation);
  const context = adaptCanonicalIntelligenceSummary(payload.context);
  const projection = adaptCanonicalProjection(payload.job_match_projection);
  const screenIntelligence: ScreenIntelligenceEnvelope = {
    screen: payload.screen,
    pathadvisorMode: payload.pathadvisor_mode,
    context: context,
    summary: payload.summary,
    nextBestAction: adaptScreenNextAction(payload.next_best_action),
    jobMatchProjection: projection,
    refinementSuggestions: Array.isArray(payload.refinement_suggestions)
      ? payload.refinement_suggestions.slice()
      : [],
  };

  return {
    recommendation: evaluation.recommendation,
    decisionBand: evaluation.decisionBand,
    confidenceBand: evaluation.confidenceBand,
    overallScore: evaluation.overallScore,
    reasons: evaluation.reasons,
    gaps: evaluation.gaps,
    warnings: evaluation.warnings,
    missingEvidence: evaluation.missingEvidence,
    nextActions: evaluation.nextActions,
    applicationDecision: evaluation.applicationDecision,
    explainabilityVersion: evaluation.explainabilityVersion,
    engineVersion: evaluation.engineVersion,
    canonicalUserContext: context,
    jobMatchProjection: projection,
    screenIntelligence: screenIntelligence,
  };
}

export function adaptSavedJobsIntelligencePayload(
  payload: BackendSavedJobsIntelligencePayload
): SavedJobsLiveEvaluation {
  const evaluation = adaptAdvisorEvaluation(payload.evaluation);
  const context = adaptCanonicalIntelligenceSummary(payload.context);
  const projection = adaptCanonicalProjection(payload.job_match_projection);
  const screenIntelligence: ScreenIntelligenceEnvelope = {
    screen: payload.screen,
    pathadvisorMode: payload.pathadvisor_mode,
    context: context,
    summary: payload.summary,
    nextBestAction: adaptScreenNextAction(payload.next_best_action),
    jobMatchProjection: projection,
    decisionGuidance: Array.isArray(payload.decision_guidance)
      ? payload.decision_guidance.slice()
      : [],
  };

  return {
    recommendation: evaluation.recommendation,
    decisionBand: evaluation.decisionBand,
    confidenceBand: evaluation.confidenceBand,
    overallScore: evaluation.overallScore,
    reasons: evaluation.reasons,
    gaps: evaluation.gaps,
    warnings: evaluation.warnings,
    missingEvidence: evaluation.missingEvidence,
    nextActions: evaluation.nextActions,
    applicationDecision: evaluation.applicationDecision,
    explainabilityVersion: evaluation.explainabilityVersion,
    engineVersion: evaluation.engineVersion,
    canonicalUserContext: context,
    jobMatchProjection: projection,
    screenIntelligence: screenIntelligence,
  };
}

export function adaptDashboardIntelligencePayload(
  payload: BackendDashboardIntelligencePayload
): DashboardIntelligencePayload {
  return {
    screen: payload.screen,
    pathadvisorMode: payload.pathadvisor_mode,
    context: adaptCanonicalIntelligenceSummary(payload.context),
    summary: payload.summary,
    strongestCurrentFitLanes: Array.isArray(payload.strongest_current_fit_lanes)
      ? payload.strongest_current_fit_lanes.slice()
      : [],
    activeBlockers: Array.isArray(payload.active_blockers)
      ? payload.active_blockers.slice()
      : [],
    topMissingItems: Array.isArray(payload.top_missing_items)
      ? payload.top_missing_items.slice()
      : [],
    nextBestAction: adaptScreenNextAction(payload.next_best_action),
    confidenceSummary: payload.confidence_summary,
  };
}

export function adaptResumeBuilderIntelligencePayload(
  payload: BackendResumeBuilderIntelligencePayload
): ResumeBuilderIntelligencePayload {
  return {
    screen: payload.screen,
    pathadvisorMode: payload.pathadvisor_mode,
    context: adaptCanonicalIntelligenceSummary(payload.context),
    summary: payload.summary,
    targetAlignmentWarnings: Array.isArray(payload.target_alignment_warnings)
      ? payload.target_alignment_warnings.slice()
      : [],
    evidenceGaps: Array.isArray(payload.evidence_gaps)
      ? payload.evidence_gaps.slice()
      : [],
    suggestedBuilderFocus: Array.isArray(payload.suggested_builder_focus)
      ? payload.suggested_builder_focus.slice()
      : [],
    nextBestAction: adaptScreenNextAction(payload.next_best_action),
  };
}

function deriveTargetRoles(profile: Profile): string[] {
  const roles: string[] = [];

  for (let i = 0; i < profile.goals.targetSeries.length; i++) {
    const value = profile.goals.targetSeries[i];
    if (value !== '') {
      roles.push(value);
    }
  }

  if (profile.goals.nextCareerMove !== '') {
    roles.push(profile.goals.nextCareerMove);
  }

  return roles;
}

function derivePreferredLocations(profile: Profile): string[] {
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
  return preferredLocations;
}

function parseGradeFilter(
  gradeBand: string | undefined
): { minGrade: number | null; maxGrade: number | null } {
  if (gradeBand === undefined || gradeBand === '') {
    return {
      minGrade: null,
      maxGrade: null,
    };
  }

  const matches = gradeBand.match(/\d+/g);
  if (matches === null || matches.length === 0) {
    return {
      minGrade: null,
      maxGrade: null,
    };
  }

  const firstValue = Number(matches[0]);
  if (!Number.isFinite(firstValue)) {
    return {
      minGrade: null,
      maxGrade: null,
    };
  }

  if (matches.length === 1) {
    return {
      minGrade: firstValue,
      maxGrade: firstValue,
    };
  }

  const secondValue = Number(matches[1]);
  if (!Number.isFinite(secondValue)) {
    return {
      minGrade: firstValue,
      maxGrade: firstValue,
    };
  }

  return {
    minGrade: Math.min(firstValue, secondValue),
    maxGrade: Math.max(firstValue, secondValue),
  };
}

function parseSeriesFilters(seriesValue: string | undefined): string[] | null {
  if (seriesValue === undefined || seriesValue.trim() === '') {
    return null;
  }

  const matches = seriesValue.match(/\d{4}/g);
  if (matches === null || matches.length === 0) {
    return null;
  }

  const normalized: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const value = matches[i];
    if (normalized.indexOf(value) === -1) {
      normalized.push(value);
    }
  }

  return normalized.length > 0 ? normalized : null;
}

function deriveRemoteOnlyFilter(remoteType: string | undefined): boolean | null {
  if (remoteType === undefined || remoteType === '') {
    return null;
  }

  const normalized = remoteType.toLowerCase();
  if (normalized.indexOf('remote') !== -1) {
    return true;
  }

  return null;
}

function parseAgencyCodes(agencyValue: string | undefined): string[] | null {
  if (agencyValue === undefined || agencyValue.trim() === '') {
    return null;
  }

  const normalized = agencyValue.trim();
  const code = AGENCY_CODE_BY_NAME[normalized];
  if (code === undefined || code === '') {
    return null;
  }

  return [code];
}

function parseAppointmentTypeCode(
  appointmentType: string | undefined
): string | null {
  if (appointmentType === undefined || appointmentType.trim() === '') {
    return null;
  }

  const normalized = appointmentType.trim();
  const code = APPOINTMENT_TYPE_CODE_BY_LABEL[normalized];
  if (code === undefined || code === '') {
    return null;
  }

  return code;
}

function formatCurrencyValue(value: number): string {
  return value.toLocaleString('en-US');
}

function formatGradeLabel(
  compensation: BackendCanonicalCompensation
): string | undefined {
  if (
    compensation.grade_min === null ||
    compensation.grade_min === undefined
  ) {
    return undefined;
  }

  if (
    compensation.grade_max === null ||
    compensation.grade_max === undefined ||
    compensation.grade_max === compensation.grade_min
  ) {
    return 'GS-' + String(compensation.grade_min);
  }

  return (
    'GS-' +
    String(compensation.grade_min) +
    ' - GS-' +
    String(compensation.grade_max)
  );
}

function formatSalaryLabel(
  compensation: BackendCanonicalCompensation
): string | undefined {
  if (
    compensation.salary_min === null ||
    compensation.salary_min === undefined
  ) {
    return undefined;
  }

  if (
    compensation.salary_max === null ||
    compensation.salary_max === undefined
  ) {
    return '$' + formatCurrencyValue(compensation.salary_min);
  }

  return (
    '$' +
    formatCurrencyValue(compensation.salary_min) +
    ' - $' +
    formatCurrencyValue(compensation.salary_max)
  );
}

function formatLocationLabel(locations: string[]): string {
  if (!Array.isArray(locations) || locations.length === 0) {
    return 'Location not provided';
  }

  const parts: string[] = [];
  for (let i = 0; i < locations.length; i++) {
    const value = locations[i];
    if (value !== undefined && value !== '') {
      parts.push(value);
    }
  }

  if (parts.length === 0) {
    return 'Location not provided';
  }

  return parts.join(' | ');
}

function deriveTeleworkLabel(locations: string[]): string | undefined {
  for (let i = 0; i < locations.length; i++) {
    const value = locations[i];
    if (
      value !== undefined &&
      value !== '' &&
      value.toLowerCase().indexOf('remote') !== -1
    ) {
      return 'Remote';
    }
  }

  return undefined;
}

function parseGradeRange(
  gradeValue: string | undefined
): { min_grade: number | null; max_grade: number | null } | null {
  if (gradeValue === undefined || gradeValue === '') {
    return null;
  }

  const matches = gradeValue.match(/\d+/g);
  if (matches === null || matches.length === 0) {
    return null;
  }

  const firstValue = Number(matches[0]);
  if (!Number.isFinite(firstValue)) {
    return null;
  }

  if (matches.length === 1) {
    return {
      min_grade: firstValue,
      max_grade: firstValue,
    };
  }

  const secondValue = Number(matches[1]);
  if (!Number.isFinite(secondValue)) {
    return {
      min_grade: firstValue,
      max_grade: firstValue,
    };
  }

  return {
    min_grade: Math.min(firstValue, secondValue),
    max_grade: Math.max(firstValue, secondValue),
  };
}

function deriveRemoteFlag(job: JobSearchEvaluableJob): boolean {
  if (
    job.overview !== undefined &&
    job.overview.remoteJob !== undefined &&
    job.overview.remoteJob.toLowerCase() === 'yes'
  ) {
    return true;
  }
  if (
    job.location !== undefined &&
    job.location !== '' &&
    job.location.toLowerCase().indexOf('remote') !== -1
  ) {
    return true;
  }
  return false;
}

function parseLocation(
  job: JobSearchEvaluableJob
): { city: string | null; region: string | null; country: string | null; remote: boolean } {
  const remote = deriveRemoteFlag(job);
  if (remote) {
    return {
      city: null,
      region: null,
      country: 'US',
      remote: true,
    };
  }

  if (job.location === undefined || job.location === '') {
    return {
      city: null,
      region: null,
      country: 'US',
      remote: false,
    };
  }

  const parts = job.location.split(',');
  const city = parts.length > 0 ? parts[0].trim() : '';
  const region = parts.length > 1 ? parts[1].trim() : '';

  return {
    city: city !== '' ? city : null,
    region: region !== '' ? region : null,
    country: 'US',
    remote: false,
  };
}

function parseJobId(job: JobSearchEvaluableJob): string {
  if (job.url !== undefined && job.url !== '') {
    const match = job.url.match(/\/job\/([^/?#]+)/i);
    if (match !== null && match[1] !== undefined && match[1] !== '') {
      return match[1];
    }
  }
  return job.id;
}

export function shouldApplyJobSearchEvaluationResult(
  activeJobId: string | null,
  activeRequestId: number,
  settledJobId: string,
  settledRequestId: number
): boolean {
  return (
    activeJobId !== null &&
    activeJobId === settledJobId &&
    activeRequestId === settledRequestId
  );
}

export function buildStoredJobEvaluationRequest(
  storedJob: SavedJobsLiveStoredJob,
  profile: Profile
): BackendStoredJobEvaluationRequest {
  return {
    saved_search_id: storedJob.savedSearchId,
    job_id: storedJob.jobId,
    profile: buildAdvisorProfilePayload(profile),
    user_notes: null,
  };
}

/**
 * Build the bounded live backend search request from the frontend Job Search
 * state. This keeps backend field names and unsupported-filter handling out of
 * the screen component.
 */
export function buildLiveJobSearchRequest(
  input: LiveJobSearchQueryInput
): BackendLiveJobSearchRequest {
  const gradeRange = parseGradeFilter(input.filters.gradeBand);
  const trimmedKeyword = input.keyword.trim();
  const trimmedLocation =
    input.location !== undefined && input.location.trim() !== ''
      ? input.location.trim()
      : input.filters.location !== undefined &&
          input.filters.location.trim() !== ''
        ? input.filters.location.trim()
        : null;

  return {
    keyword: trimmedKeyword,
    location: trimmedLocation,
    remote_only: deriveRemoteOnlyFilter(input.filters.remoteType),
    grade_min: gradeRange.minGrade,
    grade_max: gradeRange.maxGrade,
    series: parseSeriesFilters(input.filters.series),
    agency_codes: parseAgencyCodes(input.filters.agency),
    appointment_type: parseAppointmentTypeCode(input.filters.appointmentType),
    work_schedule: null,
    salary_min: null,
    page: input.page,
    page_size: input.pageSize,
  };
}

export function adaptLiveJobSearchResponse(
  payload: BackendLiveJobSearchResponse
): LiveJobSearchResponse {
  const results: Job[] = [];
  for (let i = 0; i < payload.results.length; i++) {
    const row = payload.results[i];
    results.push({
      id: row.id,
      title: row.title,
      agency: row.organization,
      location: formatLocationLabel(row.locations),
      grade: formatGradeLabel(row.compensation),
      salaryRange: formatSalaryLabel(row.compensation),
      salaryMin:
        row.compensation.salary_min !== null &&
        row.compensation.salary_min !== undefined
          ? row.compensation.salary_min
          : undefined,
      salaryMax:
        row.compensation.salary_max !== null &&
        row.compensation.salary_max !== undefined
          ? row.compensation.salary_max
          : undefined,
      url: row.apply_url,
      savedAt: row.source.retrieved_at,
      closeDate:
        row.close_date !== null && row.close_date !== undefined
          ? row.close_date
          : undefined,
      telework: deriveTeleworkLabel(row.locations),
    });
  }

  return {
    results: results,
    total: payload.total,
    page: payload.page,
    pageSize: payload.page_size,
    requestId: payload.request_id,
  };
}

export function buildJobSearchEvaluationRequest(
  job: JobSearchEvaluableJob,
  profile: Profile
): BackendAdvisorEvaluateRequest {
  const profilePayload = buildAdvisorProfilePayload(profile);
  return {
    profile: profilePayload,
    job: {
      job_id: parseJobId(job),
      title: job.title,
      company: job.agency,
      location: parseLocation(job),
      grade_range: parseGradeRange(job.grade),
      posting_dates:
        job.closeDate !== undefined && job.closeDate !== ''
          ? {
              posted_date: null,
              closes_date: job.closeDate,
            }
          : null,
      source_url: job.url !== undefined ? job.url : null,
    },
    user_notes: null,
  };
}

export function buildAdvisorProfilePayload(profile: Profile): BackendAdvisorProfilePayload {
  return {
    user_id: profile.name !== '' ? profile.name : 'pathos-frontend-user',
    years_experience:
      profile.jobSeeker !== null ? profile.jobSeeker.yearsOfExperience : 0,
    target_roles: deriveTargetRoles(profile),
    skills: [],
    preferred_locations: derivePreferredLocations(profile),
    authorized_to_work: true,
  };
}

export function buildJobSearchEvaluationBatchRequest(
  jobs: JobSearchEvaluableJob[],
  profile: Profile
): { items: BackendAdvisorEvaluateRequest[] } {
  return {
    items: jobs.map(function (job) {
      return buildJobSearchEvaluationRequest(job, profile);
    }),
  };
}
