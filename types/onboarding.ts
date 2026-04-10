/**
 * Deterministic onboarding contracts owned by the backend.
 */

export interface OnboardingQuestionOption {
  value: string;
  label: string;
  description: string;
}

export interface OnboardingQuestion {
  question_id: string;
  prompt: string;
  helper_text: string;
  why_it_matters: string;
  input_type: 'single_select';
  allow_skip: boolean;
  options: OnboardingQuestionOption[];
}

export interface OnboardingProgressSummary {
  completed_steps: number;
  total_steps: number;
  answered_core_facts: number;
  answered_branch_facts: number;
  branch_facts_required_for_insight: number;
  profile_completeness: number;
  ready_for_first_insight: boolean;
}

export interface PrioritizedQuestionCandidate {
  question: OnboardingQuestion;
  priority_band: 'high' | 'medium' | 'low';
  priority_score: number;
  prioritization_reason: string;
  expected_unlock: string;
}

export interface ProfileCompletenessSection {
  section_id: string;
  label: string;
  completeness: number;
  confidence_contribution: 'low' | 'medium' | 'high';
  answered_fields: number;
  total_fields: number;
}

export interface MissingFieldPriority {
  field_id: string;
  label: string;
  section_id: string;
  priority_band: 'high' | 'medium' | 'low';
  reason: string;
  expected_unlock: string;
}

export interface OnboardingProfileCompleteness {
  overall_score: number;
  overall_band: 'early' | 'building' | 'strong';
  section_breakdown: ProfileCompletenessSection[];
  top_missing_fields: MissingFieldPriority[];
  most_valuable_missing_fields: MissingFieldPriority[];
}

export interface OnboardingFirstInsight {
  confidence_band: 'low' | 'medium' | 'high';
  likely_fit_areas: string[];
  likely_blockers: string[];
  next_actions: string[];
  missing_information: string[];
  explanation: string;
  based_on_facts: string[];
  engine_version: string;
}

export interface EnrichmentRecommendation {
  question: OnboardingQuestion;
  recommendation_priority: 'high' | 'medium' | 'low';
  recommendation_reason: string;
  expected_benefit: string;
}

export interface WorkspaceHandoff {
  workspace: 'job_search' | 'resume_builder';
  title: string;
  description: string;
  cta_label: string;
  cta_href: string;
  context_items: string[];
  warnings: string[];
}

export interface OnboardingProfileFreshness {
  last_updated: string;
  freshness_band: 'fresh' | 'aging' | 'stale';
  needs_review: boolean;
  update_prompt: string;
}

export interface OnboardingThread {
  id: string;
  type:
    | 'target_role'
    | 'location_preference'
    | 'resume_readiness'
    | 'federal_fit'
    | 'transition_path';
  title: string;
  completeness: number;
  confidence: 'low' | 'medium' | 'high';
  last_updated: string;
  why_it_matters: string;
  facts: string[];
  last_signal_at: string | null;
  signal_influence_summary: string;
  signal_confidence_contribution: 'low' | 'medium' | 'high' | null;
}

export interface ProfileEvolutionChange {
  field_id: string;
  label: string;
  previous_value: string;
  current_value: string;
  changed_at: string;
  impact: string;
  change_reason: string;
}

export interface OnboardingProfileEvolution {
  changes: ProfileEvolutionChange[];
}

export interface RefinementRecommendation {
  question: OnboardingQuestion;
  recommendation_priority: 'high' | 'medium' | 'low';
  reason: string;
  expected_impact: string;
  related_thread: string;
  derived_from_signals: boolean;
  related_workspace: 'job_search' | 'resume_builder' | 'dashboard';
}

export interface OnboardingActionEvent {
  action_type:
    | 'opened_job_search'
    | 'opened_resume_builder'
    | 'viewed_roles_no_apply'
    | 'edited_resume'
    | 'skipped_applying';
  workspace: 'job_search' | 'resume_builder' | 'dashboard';
  occurred_at: string;
  summary: string;
}

export interface OnboardingRealSignalPayload {
  role_family: string;
  location_focus: string;
  series_code: string;
  grade_target: string;
  remote_preference: string;
  search_keyword: string;
  readiness_score: number | null;
  gap_count: number | null;
  validation_status: string;
  target_role_title: string;
  evidence_gap: string;
}

export interface OnboardingRealSignalEvent {
  source: 'job_search' | 'resume_builder' | 'resume_workspace';
  signal_type:
    | 'job_search_performed'
    | 'job_opened'
    | 'job_saved'
    | 'target_role_selected'
    | 'search_filter_applied'
    | 'likely_role_cluster_observed'
    | 'resume_builder_started'
    | 'resume_workspace_opened'
    | 'resume_validation_completed'
    | 'resume_readiness_gap_detected'
    | 'tailoring_mode_started'
    | 'evidence_gap_detected'
    | 'target_role_attached';
  payload: OnboardingRealSignalPayload;
  occurred_at: string;
  summary: string;
}

export interface InterpretedSignalEffect {
  thread_id: string;
  effect_type:
    | 'confidence_increase'
    | 'confidence_decrease'
    | 'freshness_refresh'
    | 'refinement_trigger';
  summary: string;
  confidence_delta: number;
  recommendation_hint: string;
}

export interface ReengagementSignal {
  trigger_type: 'time_based' | 'completeness_based' | 'action_based' | 'confidence_based';
  message: string;
  priority: 'high' | 'medium' | 'low';
  recommended_next_step: string;
}

export interface PathAdvisorContextBootstrapSnapshot {
  persona_summary: string;
  goal_summary: string;
  known_facts: string[];
  missing_facts: string[];
  active_recommendation_summary: string;
  next_question_candidates: string[];
  context_version: string;
  profile_completeness: number;
  profile_completeness_detail: OnboardingProfileCompleteness | null;
  recommended_next_workspace: 'job_search' | 'resume_builder' | 'dashboard' | null;
  handoff_reason: string;
  last_session_id: string | null;
  profile_freshness: OnboardingProfileFreshness | null;
  threads: OnboardingThread[];
  profile_evolution: OnboardingProfileEvolution | null;
  refinement_recommendations: RefinementRecommendation[];
  reengagement_signals: ReengagementSignal[];
  recent_actions: OnboardingActionEvent[];
  recent_signals: OnboardingRealSignalEvent[];
  interpreted_signal_effects: InterpretedSignalEffect[];
  signal_derived_insights: string[];
  refinement_mode_active: boolean;
  updated_at: string;
}

export interface OnboardingQuestionState {
  question: OnboardingQuestion;
  answer_value: string | null;
  answer_label: string;
  skipped: boolean;
  editable: boolean;
}

export interface OnboardingSessionState {
  session_id: string;
  status: 'active' | 'insight_ready' | 'completed' | 'deferred' | 'refinement';
  current_stage: 'intake' | 'first_insight_ready' | 'refinement' | 'handoff';
  saved_structured_answers: Record<string, string>;
  skipped_question_ids: string[];
  question_history: OnboardingQuestionState[];
  progress_summary: OnboardingProgressSummary;
  next_question: OnboardingQuestion | null;
  prioritized_next_question: PrioritizedQuestionCandidate | null;
  additional_question_candidates: PrioritizedQuestionCandidate[];
  profile_completeness_detail: OnboardingProfileCompleteness | null;
  first_insight: OnboardingFirstInsight | null;
  enrichment_recommendations: EnrichmentRecommendation[];
  job_search_handoff: WorkspaceHandoff | null;
  resume_builder_handoff: WorkspaceHandoff | null;
  recommended_next_workspace: 'job_search' | 'resume_builder' | 'dashboard' | null;
  handoff_reason: string;
  profile_freshness: OnboardingProfileFreshness | null;
  threads: OnboardingThread[];
  profile_evolution: OnboardingProfileEvolution | null;
  refinement_recommendations: RefinementRecommendation[];
  reengagement_signals: ReengagementSignal[];
  recent_actions: OnboardingActionEvent[];
  recent_signals: OnboardingRealSignalEvent[];
  interpreted_signal_effects: InterpretedSignalEffect[];
  signal_derived_insights: string[];
  context_bootstrap: PathAdvisorContextBootstrapSnapshot;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CreateOnboardingSessionResponse {
  session_id: string;
  current_stage: 'intake' | 'first_insight_ready' | 'refinement' | 'handoff';
  progress_summary: OnboardingProgressSummary;
  first_question: OnboardingQuestion | null;
}

export interface SubmitOnboardingAnswerRequest {
  question_id: string;
  answer: string | null;
  skip: boolean;
}

export interface SubmitOnboardingAnswerResponse {
  session: OnboardingSessionState;
  next_question: OnboardingQuestion | null;
  first_insight: OnboardingFirstInsight | null;
  transition: 'next_question' | 'first_insight' | 'complete' | null;
}

export interface CompleteOnboardingResponse {
  session: OnboardingSessionState;
  dashboard_mode: 'standard' | 'resume_onboarding';
  bootstrap_ready: boolean;
  handoff_message: string;
}

export interface ReopenOnboardingSessionResponse {
  session: OnboardingSessionState;
  reopened: boolean;
}

export interface RecordOnboardingActionResponse {
  session: OnboardingSessionState;
  recorded_action: OnboardingActionEvent;
}

export interface RecordOnboardingSignalResponse {
  session: OnboardingSessionState;
  recorded_signal: OnboardingRealSignalEvent;
}
