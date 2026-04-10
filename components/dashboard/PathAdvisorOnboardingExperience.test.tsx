import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  PathAdvisorOnboardingView,
  buildAnswerSummaryItems,
  isRecoverableSessionError,
  shouldReloadAuthoritativeSession,
} from './PathAdvisorOnboardingExperience';
import { OnboardingClientError } from '@/lib/onboarding/client';
import type { OnboardingSessionState } from '@/types/onboarding';

function buildSession(): OnboardingSessionState {
  return {
    session_id: 'session-1',
    status: 'insight_ready',
    current_stage: 'first_insight_ready',
    saved_structured_answers: {
      persona_type: 'job_seeker',
      primary_goal: 'find_best_fit_roles',
      urgency_level: 'high',
      target_field: 'program_analyst',
    },
    skipped_question_ids: ['resume_status'],
    question_history: [
      {
        question: {
          question_id: 'persona_type',
          prompt: 'Which best describes you right now?',
          helper_text: '',
          why_it_matters: '',
          input_type: 'single_select',
          allow_skip: false,
          options: [],
        },
        answer_value: 'job_seeker',
        answer_label: 'Job seeker',
        skipped: false,
        editable: true,
      },
      {
        question: {
          question_id: 'resume_status',
          prompt: 'What is the current state of your resume?',
          helper_text: '',
          why_it_matters: '',
          input_type: 'single_select',
          allow_skip: true,
          options: [],
        },
        answer_value: null,
        answer_label: '',
        skipped: true,
        editable: true,
      },
    ],
    progress_summary: {
      completed_steps: 4,
      total_steps: 10,
      answered_core_facts: 3,
      answered_branch_facts: 3,
      branch_facts_required_for_insight: 3,
      profile_completeness: 40,
      ready_for_first_insight: true,
    },
    prioritized_next_question: {
      question: {
        question_id: 'location_flexibility',
        prompt: 'How flexible are you on location?',
        helper_text: 'You can refine metros later.',
        why_it_matters: 'Location flexibility shapes how broad the likely-fit surface is.',
        input_type: 'single_select',
        allow_skip: true,
        options: [],
      },
      priority_band: 'high',
      priority_score: 84,
      prioritization_reason: 'Location flexibility strongly changes which opportunities are realistic.',
      expected_unlock: 'More useful Job Search filters and opportunity breadth guidance.',
    },
    additional_question_candidates: [
      {
        question: {
          question_id: 'resume_status',
          prompt: 'What is the current state of your resume?',
          helper_text: '',
          why_it_matters: '',
          input_type: 'single_select',
          allow_skip: true,
          options: [],
        },
        priority_band: 'medium',
        priority_score: 74,
        prioritization_reason: 'Resume readiness is the clearest downstream blocker signal.',
        expected_unlock: 'More honest Resume Builder guidance and readiness next steps.',
      },
    ],
    profile_completeness_detail: {
      overall_score: 52,
      overall_band: 'building',
      section_breakdown: [
        {
          section_id: 'basics',
          label: 'Basics',
          completeness: 100,
          confidence_contribution: 'low',
          answered_fields: 1,
          total_fields: 1,
        },
        {
          section_id: 'preferences',
          label: 'Preferences',
          completeness: 50,
          confidence_contribution: 'medium',
          answered_fields: 1,
          total_fields: 2,
        },
      ],
      top_missing_fields: [
        {
          field_id: 'location_flexibility',
          label: 'How flexible are you on location?',
          section_id: 'preferences',
          priority_band: 'high',
          reason: 'Location flexibility strongly changes which opportunities are realistic.',
          expected_unlock: 'More useful Job Search filters and opportunity breadth guidance.',
        },
      ],
      most_valuable_missing_fields: [
        {
          field_id: 'location_flexibility',
          label: 'How flexible are you on location?',
          section_id: 'preferences',
          priority_band: 'high',
          reason: 'Location flexibility strongly changes which opportunities are realistic.',
          expected_unlock: 'More useful Job Search filters and opportunity breadth guidance.',
        },
      ],
    },
    next_question: {
      question_id: 'location_flexibility',
      prompt: 'How flexible are you on location?',
      helper_text: 'You can refine metros later.',
      why_it_matters: 'Location flexibility shapes how broad the likely-fit surface is.',
      input_type: 'single_select',
      allow_skip: true,
      options: [
        {
          value: 'local_only',
          label: 'Local only',
          description: 'You want to stay near your current area.',
        },
      ],
    },
    first_insight: {
      confidence_band: 'low',
      likely_fit_areas: ['Program and policy analysis tracks'],
      likely_blockers: ['Resume evidence is likely weaker than your stated target'],
      next_actions: ['Turn your best experience into quantified role-ready bullets'],
      missing_information: ['What is the current state of your resume? (skipped for now)'],
      explanation:
        'This first insight is based on your stated persona, primary goal, urgency, and at least three branch-specific facts.',
      based_on_facts: ['Target field: Program / policy analyst'],
      engine_version: 'onboarding-insight-v1',
    },
    enrichment_recommendations: [
      {
        question: {
          question_id: 'resume_status',
          prompt: 'What is the current state of your resume?',
          helper_text: '',
          why_it_matters: '',
          input_type: 'single_select',
          allow_skip: true,
          options: [],
        },
        recommendation_priority: 'medium',
        recommendation_reason: 'Resume readiness is the clearest downstream blocker signal.',
        expected_benefit: 'More honest Resume Builder guidance and readiness next steps.',
      },
    ],
    job_search_handoff: {
      workspace: 'job_search',
      title: 'Explore roles that fit your current profile',
      description: 'Use your structured onboarding context to frame a tighter first search.',
      cta_label: 'Open Job Search',
      cta_href: '/dashboard/job-search',
      context_items: ['Target field: Program / policy analyst'],
      warnings: ['Resume evidence is likely weaker than your stated target'],
    },
    resume_builder_handoff: {
      workspace: 'resume_builder',
      title: 'Strengthen your evidence before broad applications',
      description: 'Bring your onboarding context into Resume Builder so the first edits are grounded.',
      cta_label: 'Open Resume Builder',
      cta_href: '/dashboard/resume-builder',
      context_items: ['Resume status: Draft'],
      warnings: ['Resume evidence is likely weaker than your stated target'],
    },
    recommended_next_workspace: 'resume_builder',
    handoff_reason: 'Resume readiness is the clearest blocker, so Resume Builder is the best next workspace.',
    profile_freshness: {
      last_updated: '2026-04-08T12:00:00Z',
      freshness_band: 'aging',
      needs_review: true,
      update_prompt: 'Some profile details may need a quick refresh before you rely on them.',
    },
    threads: [
      {
        id: 'target_role',
        type: 'target_role',
        title: 'Target direction',
        completeness: 67,
        confidence: 'medium',
        last_updated: '2026-04-08T12:00:00Z',
        why_it_matters: 'Sharper role direction improves fit guidance and downstream workspace handoff quality.',
        facts: ['Which field best matches where you want to go next?: Program / policy analyst'],
        last_signal_at: '2026-04-08T12:30:00Z',
        signal_influence_summary: 'Recent activity is converging on analyst roles in Maryland and DC.',
        signal_confidence_contribution: 'medium',
      },
    ],
    profile_evolution: {
      changes: [
        {
          field_id: 'target_field',
          label: 'Which field best matches where you want to go next?',
          previous_value: 'Operations / logistics',
          current_value: 'Program / policy analyst',
          changed_at: '2026-04-08T12:00:00Z',
          impact: 'Improved role-matching and downstream handoff quality.',
          change_reason: 'User updated this field during onboarding refinement.',
        },
      ],
    },
    refinement_recommendations: [
      {
        question: {
          question_id: 'location_flexibility',
          prompt: 'How flexible are you on location?',
          helper_text: '',
          why_it_matters: '',
          input_type: 'single_select',
          allow_skip: true,
          options: [],
        },
        recommendation_priority: 'high',
        reason: 'Recent Job Search activity needs clearer location framing.',
        expected_impact: 'Improves search filters and reduces noisy role suggestions.',
        related_thread: 'location_preference',
        derived_from_signals: true,
        related_workspace: 'job_search',
      },
    ],
    reengagement_signals: [
      {
        trigger_type: 'action_based',
        message: 'Recent activity suggests a blocker is still getting in the way of action.',
        priority: 'high',
        recommended_next_step: 'Review the next refinement recommendation',
      },
    ],
    recent_actions: [
      {
        action_type: 'viewed_roles_no_apply',
        workspace: 'job_search',
        occurred_at: '2026-04-08T12:00:00Z',
        summary: 'Viewed roles but did not apply.',
      },
    ],
    recent_signals: [
      {
        source: 'job_search',
        signal_type: 'job_saved',
        payload: {
          role_family: 'Operations / Program Support',
          location_focus: 'Maryland and DC',
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
        occurred_at: '2026-04-08T12:30:00Z',
        summary: 'Saved a job for later comparison or tailoring.',
      },
    ],
    interpreted_signal_effects: [
      {
        thread_id: 'target_role',
        effect_type: 'confidence_increase',
        summary: 'Recent activity is converging on analyst roles in Maryland and DC.',
        confidence_delta: 12,
        recommendation_hint: 'Narrow your target role so PathAdvisor can sharpen fit guidance.',
      },
    ],
    signal_derived_insights: [
      'Recent activity suggests Operations / Program Support is a stronger target lane.',
    ],
    context_bootstrap: {
      persona_summary: 'Job seeker',
      goal_summary: 'Find best-fit roles',
      known_facts: ['Persona: Job seeker'],
      missing_facts: ['What is the current state of your resume? (skipped for now)'],
      active_recommendation_summary: 'Turn your best experience into quantified role-ready bullets',
      next_question_candidates: ['How flexible are you on location?'],
      context_version: 'pathadvisor-context-bootstrap-v1',
      profile_completeness: 40,
      profile_completeness_detail: {
        overall_score: 52,
        overall_band: 'building',
        section_breakdown: [],
        top_missing_fields: [],
        most_valuable_missing_fields: [],
      },
      recommended_next_workspace: 'resume_builder',
      handoff_reason:
        'Resume readiness is the clearest blocker, so Resume Builder is the best next workspace.',
      last_session_id: 'session-1',
      profile_freshness: {
        last_updated: '2026-04-08T12:00:00Z',
        freshness_band: 'aging',
        needs_review: true,
        update_prompt: 'Some profile details may need a quick refresh before you rely on them.',
      },
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
    completed_at: null,
  };
}

describe('PathAdvisorOnboardingView', function () {
  it('renders dashboard-embedded onboarding copy and backend question payload', function () {
    const session = buildSession();
    const output = renderToString(
      <PathAdvisorOnboardingView
        session={session}
        activeQuestion={session.next_question}
        editingQuestionId={null}
        isSubmitting={false}
        isCompleting={false}
        isRecordingAction={false}
        errorMessage={null}
        onSelect={function () {
          return;
        }}
        onSkip={function () {
          return;
        }}
        onEditQuestion={function () {
          return;
        }}
        onRecordAction={function () {
          return;
        }}
        onRetryLoad={function () {
          return;
        }}
        onRestartSession={function () {
          return;
        }}
        onEnterDashboard={function () {
          return;
        }}
        onAnswerLater={function () {
          return;
        }}
      />
    );

    expect(output).toContain('Trust-first onboarding mode');
    expect(output).toContain('Build your first PathAdvisor context');
    expect(output).toContain('How flexible are you on location?');
    expect(output).toContain('Local only');
    expect(output).toContain('Why this matters:');
    expect(output).toContain('Location flexibility shapes how broad the likely-fit surface is.');
  });

  it('renders backend-owned edit controls for answered and skipped question history', function () {
    const session = buildSession();
    const output = renderToString(
      <PathAdvisorOnboardingView
        session={session}
        activeQuestion={session.question_history[0].question}
        editingQuestionId="persona_type"
        isSubmitting={false}
        isCompleting={false}
        isRecordingAction={false}
        errorMessage={null}
        onSelect={function () {
          return;
        }}
        onSkip={function () {
          return;
        }}
        onEditQuestion={function () {
          return;
        }}
        onRecordAction={function () {
          return;
        }}
        onRetryLoad={function () {
          return;
        }}
        onRestartSession={function () {
          return;
        }}
        onEnterDashboard={function () {
          return;
        }}
        onAnswerLater={function () {
          return;
        }}
      />
    );

    expect(output).toContain('Review or update earlier answer');
    expect(output).toContain('Which best describes you right now?');
    expect(output).toContain('Job seeker');
    expect(output).toContain('Answer later');
    expect(output).toContain('Edit answer');
  });

  it('renders the backend first insight without inventing higher confidence', function () {
    const session = buildSession();
    const output = renderToString(
      <PathAdvisorOnboardingView
        session={session}
        activeQuestion={session.next_question}
        editingQuestionId={null}
        isSubmitting={false}
        isCompleting={false}
        isRecordingAction={false}
        errorMessage={null}
        onSelect={function () {
          return;
        }}
        onSkip={function () {
          return;
        }}
        onEditQuestion={function () {
          return;
        }}
        onRecordAction={function () {
          return;
        }}
        onRetryLoad={function () {
          return;
        }}
        onRestartSession={function () {
          return;
        }}
        onEnterDashboard={function () {
          return;
        }}
        onAnswerLater={function () {
          return;
        }}
      />
    );

    expect(output).toContain('Confidence:');
    expect(output).toContain('low');
    expect(output).toContain('Program and policy analysis tracks');
    expect(output).toContain('Resume evidence is likely weaker than your stated target');
  });

  it('renders backend-owned prioritization and completeness details', function () {
    const session = buildSession();
    const output = renderToString(
      <PathAdvisorOnboardingView
        session={session}
        activeQuestion={session.next_question}
        editingQuestionId={null}
        isSubmitting={false}
        isCompleting={false}
        isRecordingAction={false}
        errorMessage={null}
        onSelect={function () {
          return;
        }}
        onSkip={function () {
          return;
        }}
        onEditQuestion={function () {
          return;
        }}
        onRecordAction={function () {
          return;
        }}
        onRetryLoad={function () {
          return;
        }}
        onRestartSession={function () {
          return;
        }}
        onEnterDashboard={function () {
          return;
        }}
        onAnswerLater={function () {
          return;
        }}
      />
    );

    expect(output).toContain('Profile completeness');
    expect(output).toContain('52<!-- -->% complete');
    expect(output).toContain('PathAdvisor prioritization');
    expect(output).toContain('How flexible are you on location?');
    expect(output).toContain('More useful Job Search filters and opportunity breadth guidance.');
  });

  it('renders enrichment and downstream handoff cards from backend payloads', function () {
    const session = buildSession();
    const output = renderToString(
      <PathAdvisorOnboardingView
        session={session}
        activeQuestion={session.next_question}
        editingQuestionId={null}
        isSubmitting={false}
        isCompleting={false}
        isRecordingAction={false}
        errorMessage={null}
        onSelect={function () {
          return;
        }}
        onSkip={function () {
          return;
        }}
        onEditQuestion={function () {
          return;
        }}
        onRecordAction={function () {
          return;
        }}
        onRetryLoad={function () {
          return;
        }}
        onRestartSession={function () {
          return;
        }}
        onEnterDashboard={function () {
          return;
        }}
        onAnswerLater={function () {
          return;
        }}
      />
    );

    expect(output).toContain('Guided enrichment');
    expect(output).toContain('Open Job Search');
    expect(output).toContain('Open Resume Builder');
    expect(output).toContain('Recommended');
    expect(output).toContain('Resume readiness is the clearest blocker');
  });

  it('renders continuity, thread memory, evolution, and action-loop feedback from backend state', function () {
    const session = buildSession();
    const output = renderToString(
      <PathAdvisorOnboardingView
        session={session}
        activeQuestion={session.next_question}
        editingQuestionId={null}
        isSubmitting={false}
        isCompleting={false}
        isRecordingAction={false}
        errorMessage={null}
        onSelect={function () {
          return;
        }}
        onSkip={function () {
          return;
        }}
        onEditQuestion={function () {
          return;
        }}
        onRecordAction={function () {
          return;
        }}
        onRetryLoad={function () {
          return;
        }}
        onRestartSession={function () {
          return;
        }}
        onEnterDashboard={function () {
          return;
        }}
        onAnswerLater={function () {
          return;
        }}
      />
    );

    expect(output).toContain('PathAdvisor prompts');
    expect(output).toContain('Topic threads');
    expect(output).toContain('Profile evolution');
    expect(output).toContain('Action loop');
    expect(output).toContain('Continue improving the profile where the next answer matters most');
    expect(output).toContain('Viewed roles but did not apply.');
  });

  it('renders signal-derived guidance without inventing local interpretation', function () {
    const session = buildSession();
    const output = renderToString(
      <PathAdvisorOnboardingView
        session={session}
        activeQuestion={session.next_question}
        editingQuestionId={null}
        isSubmitting={false}
        isCompleting={false}
        isRecordingAction={false}
        errorMessage={null}
        onSelect={function () {
          return;
        }}
        onSkip={function () {
          return;
        }}
        onEditQuestion={function () {
          return;
        }}
        onRecordAction={function () {
          return;
        }}
        onRetryLoad={function () {
          return;
        }}
        onRestartSession={function () {
          return;
        }}
        onEnterDashboard={function () {
          return;
        }}
        onAnswerLater={function () {
          return;
        }}
      />
    );

    expect(output).toContain('Real product signals');
    expect(output).toContain('Recent activity suggests Operations / Program Support is a stronger target lane.');
    expect(output).toContain('Saved a job for later comparison or tailoring.');
    expect(output).toContain('Recent signal update:');
    expect(output).toContain('Recent activity is converging on analyst roles in Maryland and DC.');
    expect(output).toContain('Derived from recent');
    expect(output).toContain('job search');
    expect(output).toContain('signals.');
  });
});

describe('buildAnswerSummaryItems', function () {
  it('uses backend-owned question history labels instead of deriving local labels', function () {
    const items = buildAnswerSummaryItems(buildSession());

    expect(items).toContain('Which best describes you right now?: Job seeker');
    expect(items).toContain('What is the current state of your resume?: answer later');
  });
});

describe('onboarding error helpers', function () {
  it('marks missing-session client errors as recoverable', function () {
    expect(isRecoverableSessionError(new OnboardingClientError('missing', 404, 'NOT_FOUND'))).toBe(true);
    expect(isRecoverableSessionError(new Error('network'))).toBe(false);
  });

  it('marks stale-session validation errors for authoritative reload', function () {
    expect(shouldReloadAuthoritativeSession(new OnboardingClientError('stale', 400, 'BAD_REQUEST'))).toBe(true);
    expect(shouldReloadAuthoritativeSession(new OnboardingClientError('missing', 404, 'NOT_FOUND'))).toBe(false);
  });
});
