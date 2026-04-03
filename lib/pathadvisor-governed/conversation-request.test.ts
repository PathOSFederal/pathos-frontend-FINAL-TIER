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
      'entity',
    ]);
    expect(payload.route).toBe('qualification_explanation');
    expect(payload.domain).toBe('qualification');
    expect(payload.trust_state).toBe('governed');
    expect(payload.entity).not.toBeUndefined();
    if (payload.entity === undefined) {
      throw new Error('Expected entity payload.');
    }
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
});
