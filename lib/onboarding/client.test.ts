import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  completeOnboardingSession,
  createOnboardingSession,
  getOnboardingSession,
  getPathAdvisorBootstrapSnapshot,
  OnboardingClientError,
  recordOnboardingSignal,
  submitOnboardingAnswer,
} from './client';

afterEach(function () {
  vi.restoreAllMocks();
});

describe('onboarding client', function () {
  it('creates a session through the same-origin frontend boundary', async function () {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async function () {
          return JSON.stringify({
            session_id: 'session-1',
            current_stage: 'intake',
            progress_summary: {
              completed_steps: 0,
              total_steps: 10,
              answered_core_facts: 0,
              answered_branch_facts: 0,
              branch_facts_required_for_insight: 3,
              profile_completeness: 0,
              ready_for_first_insight: false,
            },
            first_question: {
              question_id: 'persona_type',
              prompt: 'Which best describes you right now?',
              helper_text: '',
              why_it_matters: '',
              input_type: 'single_select',
              allow_skip: false,
              options: [],
            },
          });
        },
      })
    );

    const response = await createOnboardingSession();
    expect(response.session_id).toBe('session-1');
    expect(response.first_question !== null && response.first_question.question_id === 'persona_type').toBe(true);
  });

  it('submits an answer and advances to the backend-selected next question', async function () {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async function () {
          return JSON.stringify({
            session: {
              session_id: 'session-1',
              status: 'active',
              current_stage: 'intake',
              saved_structured_answers: {
                persona_type: 'job_seeker',
              },
              skipped_question_ids: [],
              progress_summary: {
                completed_steps: 1,
                total_steps: 10,
                answered_core_facts: 1,
                answered_branch_facts: 0,
                branch_facts_required_for_insight: 3,
                profile_completeness: 10,
                ready_for_first_insight: false,
              },
              next_question: {
                question_id: 'primary_goal',
                prompt: 'What is your primary goal for this first PathAdvisor pass?',
                helper_text: '',
                why_it_matters: '',
                input_type: 'single_select',
                allow_skip: false,
                options: [],
              },
              first_insight: null,
              context_bootstrap: {
                persona_summary: 'Job seeker',
                goal_summary: '',
                known_facts: [],
                missing_facts: [],
                active_recommendation_summary: '',
                next_question_candidates: [],
                context_version: 'pathadvisor-context-bootstrap-v1',
                profile_completeness: 10,
                last_session_id: 'session-1',
                updated_at: '2026-04-08T12:00:00Z',
              },
              created_at: '2026-04-08T12:00:00Z',
              updated_at: '2026-04-08T12:00:00Z',
              completed_at: null,
            },
            next_question: {
              question_id: 'primary_goal',
              prompt: 'What is your primary goal for this first PathAdvisor pass?',
              helper_text: '',
              why_it_matters: '',
              input_type: 'single_select',
              allow_skip: false,
              options: [],
            },
            first_insight: null,
            transition: 'next_question',
          });
        },
      })
    );

    const response = await submitOnboardingAnswer('session-1', 'persona_type', 'job_seeker', false);
    expect(response.transition).toBe('next_question');
    expect(response.next_question !== null && response.next_question.question_id === 'primary_goal').toBe(true);
  });

  it('reloads an existing session and preserves backend-owned low-confidence insight state', async function () {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async function () {
          return JSON.stringify({
            session_id: 'session-1',
            status: 'insight_ready',
            current_stage: 'first_insight_ready',
            saved_structured_answers: {},
            skipped_question_ids: [],
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
            context_bootstrap: {
              persona_summary: 'Job seeker',
              goal_summary: 'Find best-fit roles',
              known_facts: [],
              missing_facts: [],
              active_recommendation_summary: '',
              next_question_candidates: [],
              context_version: 'pathadvisor-context-bootstrap-v1',
              profile_completeness: 60,
              last_session_id: 'session-1',
              updated_at: '2026-04-08T12:00:00Z',
            },
            created_at: '2026-04-08T12:00:00Z',
            updated_at: '2026-04-08T12:00:00Z',
            completed_at: null,
          });
        },
      })
    );

    const response = await getOnboardingSession('session-1');
    expect(response.first_insight !== null && response.first_insight.confidence_band === 'low').toBe(true);
    expect(response.progress_summary.ready_for_first_insight).toBe(true);
  });

  it('completes onboarding and exposes the dashboard handoff contract', async function () {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async function () {
          return JSON.stringify({
            session: {
              session_id: 'session-1',
              status: 'completed',
              current_stage: 'handoff',
              saved_structured_answers: {},
              skipped_question_ids: [],
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
              first_insight: null,
              context_bootstrap: {
                persona_summary: 'Job seeker',
                goal_summary: 'Find best-fit roles',
                known_facts: [],
                missing_facts: [],
                active_recommendation_summary: '',
                next_question_candidates: [],
                context_version: 'pathadvisor-context-bootstrap-v1',
                profile_completeness: 60,
                last_session_id: 'session-1',
                updated_at: '2026-04-08T12:00:00Z',
              },
              created_at: '2026-04-08T12:00:00Z',
              updated_at: '2026-04-08T12:00:00Z',
              completed_at: '2026-04-08T12:01:00Z',
            },
            dashboard_mode: 'standard',
            bootstrap_ready: true,
            handoff_message: 'Onboarding complete. Your PathAdvisor context is ready in the dashboard.',
          });
        },
      })
    );

    const response = await completeOnboardingSession('session-1', 'complete');
    expect(response.dashboard_mode).toBe('standard');
    expect(response.bootstrap_ready).toBe(true);
  });

  it('loads the persisted bootstrap snapshot for later PathAdvisor use', async function () {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async function () {
          return JSON.stringify({
            persona_summary: 'Job seeker',
            goal_summary: 'Find best-fit roles',
            known_facts: ['Persona: Job seeker'],
            missing_facts: ['Resume status'],
            active_recommendation_summary: 'Quantify accomplishments',
            next_question_candidates: ['Resume status'],
            context_version: 'pathadvisor-context-bootstrap-v1',
            profile_completeness: 60,
            last_session_id: 'session-1',
            updated_at: '2026-04-08T12:00:00Z',
          });
        },
      })
    );

    const snapshot = await getPathAdvisorBootstrapSnapshot();
    expect(snapshot.last_session_id).toBe('session-1');
    expect(snapshot.active_recommendation_summary).toBe('Quantify accomplishments');
  });

  it('records a bounded real-product signal through the same-origin onboarding boundary', async function () {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async function () {
          return JSON.stringify({
            session: {
              session_id: 'session-1',
              status: 'refinement',
              current_stage: 'refinement',
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
              first_insight: null,
              enrichment_recommendations: [],
              job_search_handoff: null,
              resume_builder_handoff: null,
              recommended_next_workspace: 'job_search',
              handoff_reason: 'Recent job-search signals sharpened role or location direction enough to support a tighter search.',
              profile_freshness: null,
              threads: [],
              profile_evolution: { changes: [] },
              refinement_recommendations: [],
              reengagement_signals: [],
              recent_actions: [],
              recent_signals: [],
              interpreted_signal_effects: [],
              signal_derived_insights: ['Recent activity suggests analyst roles are a stronger lane.'],
              context_bootstrap: {
                persona_summary: 'Job seeker',
                goal_summary: 'Find best-fit roles',
                known_facts: [],
                missing_facts: [],
                active_recommendation_summary: '',
                next_question_candidates: [],
                context_version: 'pathadvisor-context-bootstrap-v4',
                profile_completeness: 60,
                profile_completeness_detail: null,
                recommended_next_workspace: 'job_search',
                handoff_reason: '',
                last_session_id: 'session-1',
                profile_freshness: null,
                threads: [],
                profile_evolution: { changes: [] },
                refinement_recommendations: [],
                reengagement_signals: [],
                recent_actions: [],
                recent_signals: [],
                interpreted_signal_effects: [],
                signal_derived_insights: [],
                refinement_mode_active: true,
                updated_at: '2026-04-09T10:00:00Z',
              },
              created_at: '2026-04-08T12:00:00Z',
              updated_at: '2026-04-09T10:00:00Z',
              completed_at: null,
            },
            recorded_signal: {
              source: 'job_search',
              signal_type: 'job_saved',
              payload: {
                role_family: 'Program Analyst',
                location_focus: 'Maryland',
                series_code: '0343',
                grade_target: '',
                remote_preference: '',
                search_keyword: '',
                readiness_score: null,
                gap_count: null,
                validation_status: '',
                target_role_title: '',
                evidence_gap: '',
              },
              occurred_at: '2026-04-09T10:00:00Z',
              summary: 'Saved a job for later comparison or tailoring.',
            },
          });
        },
      })
    );

    const response = await recordOnboardingSignal('session-1', 'job_search', 'job_saved', {
      role_family: 'Program Analyst',
      location_focus: 'Maryland',
      series_code: '0343',
    });

    expect(response.recorded_signal.signal_type).toBe('job_saved');
    expect(response.session.signal_derived_insights[0]).toContain('analyst roles');
  });

  it('extracts backend error code and message from the governed error envelope', async function () {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async function () {
          return JSON.stringify({
            error: {
              code: 'NOT_FOUND',
              message: 'The requested resource was not found.',
            },
          });
        },
      })
    );

    let thrown: unknown = null;
    try {
      await getOnboardingSession('missing-session');
    } catch (error) {
      thrown = error;
    }

    expect(thrown instanceof OnboardingClientError).toBe(true);
    if (thrown instanceof OnboardingClientError) {
      expect(thrown.status).toBe(404);
      expect(thrown.code).toBe('NOT_FOUND');
      expect(thrown.message).toBe('The requested resource was not found.');
    }
  });
});
