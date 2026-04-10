import { describe, expect, it } from 'vitest';
import { resolveOnboardingGateMode, shouldOfferProfileContinuation } from './PathAdvisorOnboardingGate';
import type { OnboardingSessionState } from '@/types/onboarding';

function buildCompletedSession(): OnboardingSessionState {
  return {
    session_id: 'session-1',
    status: 'completed',
    current_stage: 'handoff',
    saved_structured_answers: {},
    skipped_question_ids: [],
    question_history: [],
    progress_summary: {
      completed_steps: 6,
      total_steps: 10,
      answered_core_facts: 3,
      answered_branch_facts: 3,
      branch_facts_required_for_insight: 3,
      profile_completeness: 60,
      ready_for_first_insight: true,
    },
    next_question: null,
    prioritized_next_question: null,
    additional_question_candidates: [],
    profile_completeness_detail: null,
    first_insight: {
      confidence_band: 'low',
      likely_fit_areas: [],
      likely_blockers: [],
      next_actions: [],
      missing_information: [],
      explanation: 'Bounded first insight.',
      based_on_facts: [],
      engine_version: 'onboarding-insight-v1',
    },
    enrichment_recommendations: [],
    job_search_handoff: null,
    resume_builder_handoff: null,
    recommended_next_workspace: 'dashboard',
    handoff_reason: '',
    profile_freshness: {
      last_updated: '2026-04-08T12:00:00Z',
      freshness_band: 'stale',
      needs_review: true,
      update_prompt: 'Your profile details may be stale.',
    },
    threads: [],
    profile_evolution: {
      changes: [],
    },
    refinement_recommendations: [],
    reengagement_signals: [
      {
        trigger_type: 'time_based',
        message: 'Your profile details may be stale.',
        priority: 'high',
        recommended_next_step: 'Continue improving your profile',
      },
    ],
    recent_actions: [],
    recent_signals: [],
    interpreted_signal_effects: [],
    signal_derived_insights: [],
    context_bootstrap: {
      persona_summary: '',
      goal_summary: '',
      known_facts: [],
      missing_facts: [],
      active_recommendation_summary: '',
      next_question_candidates: [],
      context_version: 'pathadvisor-context-bootstrap-v3',
      profile_completeness: 60,
      profile_completeness_detail: null,
      recommended_next_workspace: 'dashboard',
      handoff_reason: '',
      last_session_id: 'session-1',
      profile_freshness: null,
      threads: [],
      profile_evolution: {
        changes: [],
      },
      refinement_recommendations: [],
      reengagement_signals: [],
      recent_actions: [],
      recent_signals: [],
      interpreted_signal_effects: [],
      signal_derived_insights: [],
      refinement_mode_active: false,
      updated_at: '2026-04-08T12:00:00Z',
    },
    created_at: '2026-04-08T12:00:00Z',
    updated_at: '2026-04-08T12:00:00Z',
    completed_at: '2026-04-08T12:05:00Z',
  };
}

describe('resolveOnboardingGateMode', function () {
  it('keeps active and insight-ready sessions in onboarding mode', function () {
    expect(resolveOnboardingGateMode('active')).toBe('onboarding');
    expect(resolveOnboardingGateMode('insight_ready')).toBe('onboarding');
  });

  it('moves completed and deferred sessions into standard dashboard mode', function () {
    expect(resolveOnboardingGateMode('completed')).toBe('standard');
    expect(resolveOnboardingGateMode('deferred')).toBe('standard');
  });

  it('offers profile continuation for completed sessions with freshness or re-engagement prompts', function () {
    expect(shouldOfferProfileContinuation(buildCompletedSession())).toBe(true);
    expect(shouldOfferProfileContinuation(null)).toBe(false);
  });
});
