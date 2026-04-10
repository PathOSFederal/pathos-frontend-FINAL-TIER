/**
 * ============================================================================
 * GOVERNED PATHADVISOR CONVERSATION REQUEST TESTS
 * ============================================================================
 *
 * PURPOSE:
 * Prove the Day 50 conversation request builder and validator keep the payload
 * narrow, backend-shaped, and free of synthetic truth fields.
 */

import { describe, expect, it } from 'vitest';
import { buildPathAdvisorConversationContext } from './conversation-context';
import {
  buildPathAdvisorConversationRequestPayload,
  isPathAdvisorConversationRequestPayload,
} from './conversation-request';

function buildConversationContext() {
  return buildPathAdvisorConversationContext({
    currentView: 'shared-dashboard',
    draft: {
      domain: 'qualification',
      qualification: {
        yearsExperience: '7',
        targetRoles: 'Program Analyst',
        skills: 'analysis, writing',
        authorizedToWork: true,
      },
      fehb: {
        enrollmentType: 'open_season',
        coverageType: 'family',
        expectedUtilization: 'high',
        householdSize: '4',
        planPreferences: 'low deductible',
        comparisonTargets: 'BCBS Basic',
      },
    },
    result: {
      status: 'success',
      errorMessage: null,
      response: {
        domain: 'qualification',
        responseState: 'partial',
        grounded: true,
        summary: 'Backend-shaped summary',
        explanation: 'Backend-shaped explanation',
        keyFactors: [
          {
            factorType: 'missing_input',
            label: 'Need utilization detail',
            detail: 'Expected utilization is missing.',
            code: 'expected_utilization_missing',
            severity: 'medium',
          },
        ],
        missingInputs: ['expected_utilization'],
        nextSteps: ['Provide utilization details.'],
        refusalReason: null,
        packVersionId: 'pack-version-2',
        freshnessState: 'aging',
        grounding: {
          domain: 'qualification',
          responseState: 'partial',
          grounded: true,
          partial: true,
          refusalReason: null,
          missingInputs: ['expected_utilization'],
          packId: 'pack-1',
          packKey: 'qualification.pack',
          versionId: 'pack-version-2',
          version: 2,
          freshnessState: 'aging',
          freshnessReason: 'Aging.',
          effectiveAt: null,
          reviewedAt: null,
          reviewBy: null,
          expiresAt: null,
          servingEligible: true,
          sourceSummary: null,
          conversationProvider: 'fake-provider',
          providerUsed: true,
          refusalDomain: null,
          domains: [],
        },
        servedAt: '2026-04-03T12:00:00Z',
      },
    },
    intelligence: {
      source: 'partial_live',
      isRefreshing: false,
      lastUpdatedLabel: 'Updated moments ago',
      errorMessage: null,
      workspaceResume: {
        id: 'resume-master-seed',
        name: 'Master Resume',
        mode: 'master',
        updatedAt: '2026-04-02T09:00:00Z',
        targetRoleTitle: 'Program Analyst',
      },
      careerReadiness: {
        meta: {
          snapshot_id: 'career-snapshot-2',
          generated_at: '2026-04-03T11:58:00Z',
          input_hash: 'career-hash',
          rule_version: 'rules-v1',
          knowledge_pack_version: 'career-pack-v1',
          kind: 'career_readiness',
        },
        overall_score: 73,
        label: 'Near ready',
        target_role: 'GS-9 Program Analyst',
        spokes: {
          qualifications: 76,
        },
        top_gaps: [
          {
            key: 'transcript',
            title: 'Provide transcript support',
            impact_points: 12,
            reason: 'The transcript is still missing.',
          },
        ],
        action_plan: [
          {
            key: 'upload-transcript',
            title: 'Upload transcript',
            impact_points: 12,
            effort: 'S',
            helper: 'Add the official transcript before applying.',
          },
        ],
        reasons: [],
        evidence_used: [],
        missing_evidence: [
          {
            key: 'governed_transcript_requirement',
            label: 'Official transcript',
            why_it_matters: 'Qualification review needs it.',
          },
        ],
      },
      resumeReadiness: null,
      refresh: null,
    },
    routeContext: {
      screenId: 'job-search',
      activeAnchor: {
        anchorType: 'job',
        anchorId: 'job-7',
        anchorLabel: 'Program Analyst',
      },
      targetScope: {
        sourceKind: 'route_anchor',
        rawLabel: 'Program Analyst',
        normalizedTitle: 'Program Analyst',
        seriesCode: null,
        grade: null,
        familyTags: ['analysis'],
      },
      recentEntries: [
        {
          title: 'Selected job: Program Analyst',
          subtitle: 'Department of Veterans Affairs',
          sections: [
            {
              title: null,
              lines: ['Current selection in Job Search.', 'Location: Washington, DC'],
              bullets: [],
            },
          ],
        },
        {
          title: 'Live evaluation: Program Analyst',
          subtitle: 'Department of Veterans Affairs • Washington, DC',
          sections: [
            {
              title: 'Evaluation summary',
              lines: ['Recommendation: consider'],
              bullets: [],
            },
          ],
        },
      ],
    },
    selectedEntity: {
      entityType: 'job',
      entityId: 'job-7',
      entityLabel: 'Program Analyst',
    },
  });
}

describe('governed PathAdvisor conversation request', function () {
  it('builds only the bounded payload fields allowed for the conversation route', function () {
    const payload = buildPathAdvisorConversationRequestPayload(
      'What is still missing?',
      buildConversationContext()
    );

    expect(Object.keys(payload)).toEqual([
      'route',
      'domain',
      'user_message',
      'trust_state',
      'governed_context',
      'intelligence_context',
      'current_target_scope',
      'route_context',
      'entity',
    ]);
    expect(payload.route).toBe('qualification_explanation');
    expect(payload.domain).toBe('qualification');
    expect(payload.trust_state).toBe('governed');
    expect(payload.entity).not.toBeUndefined();
    if (payload.entity === undefined) {
      throw new Error('Expected entity payload.');
    }
    expect(payload.intelligence_context).toEqual({
      source: 'partial_live',
      workspace_resume: {
        id: 'resume-master-seed',
        name: 'Master Resume',
        mode: 'master',
        updated_at: '2026-04-02T09:00:00Z',
        target_role_title: 'Program Analyst',
      },
      career_readiness: {
        snapshot_id: 'career-snapshot-2',
        generated_at: '2026-04-03T11:58:00Z',
        overall_score: 73,
        label: 'Near ready',
        target_role: 'GS-9 Program Analyst',
        spokes: {
          qualifications: 76,
        },
        top_gaps: ['Provide transcript support'],
        next_actions: ['Upload transcript'],
        missing_evidence: ['Official transcript'],
      },
      resume_readiness: null,
      application_confidence: null,
    });
    expect(payload.current_target_scope).toEqual({
      source_kind: 'career_readiness',
      raw_label: 'GS-9 Program Analyst',
      normalized_title: 'Program Analyst',
      series_code: null,
      grade: 'GS-9',
      family_tags: ['analysis'],
    });
    expect(payload.route_context).toEqual({
      screen_id: 'job-search',
      active_anchor: {
        anchor_type: 'job',
        anchor_id: 'job-7',
        anchor_label: 'Program Analyst',
      },
      target_scope: {
        source_kind: 'route_anchor',
        raw_label: 'Program Analyst',
        normalized_title: 'Program Analyst',
        series_code: null,
        grade: null,
        family_tags: ['analysis'],
      },
      recent_entries: [
        {
          title: 'Selected job: Program Analyst',
          subtitle: 'Department of Veterans Affairs',
          sections: [
            {
              title: null,
              lines: ['Current selection in Job Search.', 'Location: Washington, DC'],
              bullets: [],
            },
          ],
        },
        {
          title: 'Live evaluation: Program Analyst',
          subtitle: 'Department of Veterans Affairs • Washington, DC',
          sections: [
            {
              title: 'Evaluation summary',
              lines: ['Recommendation: consider'],
              bullets: [],
            },
          ],
        },
      ],
    });
    expect(payload.entity.entity_id).toBe('job-7');
    expect(payload.governed_context.pack_version_id).toBe('pack-version-2');
    expect(payload.governed_context.grounding.partial).toBe(true);
    expect(payload.governed_context.grounding.conversation_provider).toBe('fake-provider');
    expect(payload.governed_context.grounding.provider_used).toBe(true);
    expect('draft_inputs' in payload).toBe(false);
    expect('request_id' in payload).toBe(false);
    expect('context' in payload).toBe(false);
    expect('domain' in payload.governed_context).toBe(false);
    expect('history' in payload).toBe(false);
    expect('threadId' in payload).toBe(false);
    expect('uiText' in payload).toBe(false);
  });

  it('forwards governed entry planning metadata when it is present', function () {
    const context = buildConversationContext();
    if (context.governedResponse === null) {
      throw new Error('Expected governed response.');
    }

    context.governedResponse.grounding.entryPlanning = {
      planningBasis: 'capability_fallback',
      planningSummary:
        'Planner used bounded context fallback to select application confidence and resume readiness.',
      plannedDomains: [
        {
          domain: 'application_confidence',
          selectionBasis: 'capability_fallback',
          capabilityState: 'available',
          capabilityReason: 'Selected-job application-confidence context is available.',
        },
        {
          domain: 'resume_readiness',
          selectionBasis: 'capability_fallback',
          capabilityState: 'available',
          capabilityReason: 'Live resume-readiness context is available.',
        },
      ],
    };

    const payload = buildPathAdvisorConversationRequestPayload(
      'Why did you choose this domain?',
      context
    );

    expect(payload.governed_context.grounding.entry_planning).toEqual({
      planning_basis: 'capability_fallback',
      planning_summary:
        'Planner used bounded context fallback to select application confidence and resume readiness.',
      planned_domains: [
        {
          domain: 'application_confidence',
          selection_basis: 'capability_fallback',
          capability_state: 'available',
          capability_reason: 'Selected-job application-confidence context is available.',
        },
        {
          domain: 'resume_readiness',
          selection_basis: 'capability_fallback',
          capability_state: 'available',
          capability_reason: 'Live resume-readiness context is available.',
        },
      ],
    });
    expect(isPathAdvisorConversationRequestPayload(payload)).toBe(true);
  });

  it('forwards bounded carry-forward context when it is present', function () {
    const context = buildConversationContext();
    context.carryForwardContext = {
      sourceKind: 'immediately_previous_user_turn',
      transformKind: 'same_thing_but',
      priorUserMessage: 'Are there law enforcement jobs available?',
      originalUserMessage: 'same thing but for GS-12 in Florida',
      effectiveUserMessage: 'Are there law enforcement jobs available for gs-12 in florida?',
    };

    const payload = buildPathAdvisorConversationRequestPayload(
      'Are there law enforcement jobs available for gs-12 in florida?',
      context
    );

    expect(payload.carry_forward_context).toEqual({
      source_kind: 'immediately_previous_user_turn',
      transform_kind: 'same_thing_but',
      prior_user_message: 'Are there law enforcement jobs available?',
      original_user_message: 'same thing but for GS-12 in Florida',
      effective_user_message: 'Are there law enforcement jobs available for gs-12 in florida?',
    });
    expect(isPathAdvisorConversationRequestPayload(payload)).toBe(true);
  });

  it('includes draft_inputs only when allowed backend conversation hint lists are provided', function () {
    const context = buildConversationContext();
    context.conversationDraftInputs = {
      focusTopics: ['qualification'],
      selectedMissingInputs: ['expected_utilization'],
      selectedNextSteps: ['Provide utilization details.'],
    };

    const payload = buildPathAdvisorConversationRequestPayload(
      'What is still missing?',
      context
    );

    expect(payload.draft_inputs).toEqual({
      focus_topics: ['qualification'],
      selected_missing_inputs: ['expected_utilization'],
      selected_next_steps: ['Provide utilization details.'],
    });
  });

  it('routes follow-up conversation through the returned job_search domain when the entry result is job search', function () {
    const context = buildConversationContext();
    if (context.governedResponse === null) {
      throw new Error('Expected governed response.');
    }

    context.requestDomain = 'job_search';
    context.governedResponse.grounding.domain = 'job_search';

    const payload = buildPathAdvisorConversationRequestPayload(
      'are there law enforcement jobs available in florida?',
      context
    );

    expect(payload.route).toBe('job_search_explanation');
    expect(payload.domain).toBe('job_search');
    expect(payload.governed_context.grounding.domain).toBe('job_search');
  });

  it('routes follow-up conversation through the returned resume_readiness domain when the entry result is resume readiness', function () {
    const context = buildConversationContext();
    if (context.governedResponse === null) {
      throw new Error('Expected governed response.');
    }

    context.requestDomain = 'resume_readiness';
    context.governedResponse.grounding.domain = 'resume_readiness';

    const payload = buildPathAdvisorConversationRequestPayload(
      'is my resume ready for this job?',
      context
    );

    expect(payload.route).toBe('resume_readiness_explanation');
    expect(payload.domain).toBe('resume_readiness');
    expect(payload.governed_context.grounding.domain).toBe('resume_readiness');
  });

  it('routes follow-up conversation through the returned application_confidence domain when the entry result is application confidence', function () {
    const context = buildConversationContext();
    if (context.governedResponse === null) {
      throw new Error('Expected governed response.');
    }

    context.requestDomain = 'application_confidence';
    context.governedResponse.grounding.domain = 'application_confidence';

    const payload = buildPathAdvisorConversationRequestPayload(
      'should i apply for this job?',
      context
    );

    expect(payload.route).toBe('application_confidence_explanation');
    expect(payload.domain).toBe('application_confidence');
    expect(payload.governed_context.grounding.domain).toBe('application_confidence');
  });

  it('accepts the exact bounded payload shape', function () {
    const payload = buildPathAdvisorConversationRequestPayload(
      'Explain this result.',
      buildConversationContext()
    );

    expect(isPathAdvisorConversationRequestPayload(payload)).toBe(true);
  });

  it('rejects widened payloads with extra keys', function () {
    const payload = buildPathAdvisorConversationRequestPayload(
      'Explain this result.',
      buildConversationContext()
    ) as unknown as Record<string, unknown>;

    payload.request_id = 'frontend-should-not-send-this';

    expect(isPathAdvisorConversationRequestPayload(payload)).toBe(false);
  });

  it('rejects the old nested context wrapper shape', function () {
    const payload = {
      user_message: 'Explain this result.',
      context: {
        route: {
          view: 'dashboard',
        },
      },
    };

    expect(isPathAdvisorConversationRequestPayload(payload)).toBe(false);
  });

  it('rejects draft_inputs with forbidden raw qualification and fehb objects', function () {
    const payload: Record<string, unknown> = {
      route: 'qualification_explanation',
      domain: 'qualification',
      user_message: 'Explain this result.',
      governed_context: {
        response_state: 'grounded',
        grounded: true,
        key_factors: [],
        grounding: {
          domain: 'qualification',
          response_state: 'grounded',
          grounded: true,
          partial: false,
          conversation_provider: 'governed_only',
          provider_used: false,
        },
      },
      draft_inputs: {
        qualification: {
          years_experience: '7',
        },
        fehb: {
          coverage_type: 'family',
        },
      },
    };

    expect(isPathAdvisorConversationRequestPayload(payload)).toBe(false);
  });

  it('rejects widened intelligence context fields', function () {
    const payload = buildPathAdvisorConversationRequestPayload(
      'Explain this result.',
      buildConversationContext()
    ) as unknown as Record<string, unknown>;

    payload.intelligence_context = {
      source: 'live',
      career_readiness: {
        snapshot_id: 'career-snapshot-2',
        generated_at: '2026-04-03T11:58:00Z',
        overall_score: 73,
        label: 'Near ready',
        target_role: 'GS-9 Program Analyst',
        spokes: {
          qualifications: 76,
        },
        top_gaps: ['Provide transcript support'],
        next_actions: ['Upload transcript'],
        missing_evidence: ['Official transcript'],
        ui_summary: 'frontend should never send this',
      },
    };

    expect(isPathAdvisorConversationRequestPayload(payload)).toBe(false);
  });

  it('rejects widened route context fields', function () {
    const payload = buildPathAdvisorConversationRequestPayload(
      'Explain this result.',
      buildConversationContext()
    ) as unknown as Record<string, unknown>;

    payload.route_context = {
      screen_id: 'job-search',
      active_anchor: {
        anchor_type: 'job',
        anchor_id: 'job-7',
        anchor_label: 'Program Analyst',
      },
      recent_entries: [
        {
          title: 'Live evaluation: Program Analyst',
          subtitle: 'Department of Veterans Affairs',
          sections: [],
          rendered_card_html: '<div>forbidden</div>',
        },
      ],
    };

    expect(isPathAdvisorConversationRequestPayload(payload)).toBe(false);
  });

  it('rejects widened current target scope fields', function () {
    const payload = buildPathAdvisorConversationRequestPayload(
      'Explain this result.',
      buildConversationContext()
    ) as unknown as Record<string, unknown>;

    payload.current_target_scope = {
      source_kind: 'career_readiness',
      raw_label: 'GS-9 Program Analyst',
      normalized_title: 'Program Analyst',
      series_code: null,
      grade: 'GS-9',
      family_tags: ['analysis'],
      unsupported_extra: 'frontend should never send this',
    };

    expect(isPathAdvisorConversationRequestPayload(payload)).toBe(false);
  });
});
