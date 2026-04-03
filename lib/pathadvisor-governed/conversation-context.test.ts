/**
 * ============================================================================
 * GOVERNED PATHADVISOR CONVERSATION CONTEXT TESTS
 * ============================================================================
 *
 * PURPOSE:
 * Prove the restored conversational shell still uses structured governed data
 * instead of rendered UI strings.
 *
 * WHY THESE TESTS MATTER:
 * This slice restores the user-facing composer, but the future conversation
 * handoff must still stay deterministic. These tests lock in that the context
 * builder copies authoritative fields only and that the temporary local reply
 * logic respects grounded, partial, refused, and technical-error distinctions.
 */

import { describe, expect, it } from 'vitest';
import type { PathAdvisorGovernedDraft, PathAdvisorGovernedResultState } from '@pathos/ui';
import {
  buildPathAdvisorConversationContext,
  buildPathAdvisorLocalConversationReply,
} from './conversation-context';

function buildDraft(): PathAdvisorGovernedDraft {
  return {
    domain: 'qualification',
    qualification: {
      yearsExperience: '5',
      targetRoles: 'Program Analyst',
      skills: 'analysis, writing',
      authorizedToWork: true,
    },
    fehb: {
      enrollmentType: '',
      coverageType: 'family',
      expectedUtilization: 'high',
      householdSize: '',
      planPreferences: 'low deductible',
      comparisonTargets: 'BCBS Basic',
    },
  };
}

function buildSuccessResult(
  responseState: 'grounded' | 'partial' | 'refused'
): PathAdvisorGovernedResultState {
  return {
    status: 'success',
    errorMessage: null,
    response: {
      domain: responseState === 'refused' ? 'cross_domain' : 'qualification',
      responseState: responseState,
      grounded: responseState !== 'refused',
      summary: responseState === 'partial'
        ? 'You have a useful but incomplete governed answer.'
        : responseState === 'refused'
          ? 'The current governed request is intentionally refused.'
          : 'You have a grounded governed answer.',
      explanation: 'Authoritative explanation from the backend contract.',
      keyFactors: [
        {
          factorType: 'finding',
          label: 'Experience aligns',
          detail: 'Your experience range aligns with the request.',
          code: 'experience_alignment',
          severity: 'low',
        },
      ],
      missingInputs: responseState === 'partial' ? ['expected_utilization'] : [],
      nextSteps: responseState === 'refused'
        ? ['Try again when governed FEHB coverage is available.']
        : ['Review the duties before applying.'],
      refusalReason: responseState === 'refused' ? 'cross_domain_fehb_unavailable' : null,
      packVersionId: 'pack-version-1',
      freshnessState: 'fresh',
      grounding: {
        domain: responseState === 'refused' ? 'cross_domain' : 'qualification',
        responseState: responseState,
        grounded: responseState !== 'refused',
        partial: responseState === 'partial',
        refusalReason: responseState === 'refused' ? 'cross_domain_fehb_unavailable' : null,
        missingInputs: responseState === 'partial' ? ['expected_utilization'] : [],
        packId: 'pack-1',
        packKey: 'qualification.pack',
        versionId: 'pack-version-1',
        version: 1,
        freshnessState: 'fresh',
        freshnessReason: 'Fresh.',
        effectiveAt: null,
        reviewedAt: null,
        reviewBy: null,
        expiresAt: null,
        servingEligible: responseState !== 'refused',
        sourceSummary: null,
        conversationProvider: 'fake-provider',
        providerUsed: true,
        refusalDomain: responseState === 'refused' ? 'fehb' : null,
        domains: [],
      },
      servedAt: '2026-04-03T12:00:00Z',
    },
  };
}

describe('governed PathAdvisor conversation context', function () {
  it('builds future conversation context from structured governed fields only', function () {
    const context = buildPathAdvisorConversationContext({
      currentView: 'dashboard',
      draft: buildDraft(),
      result: buildSuccessResult('grounded'),
      selectedEntity: {
        entityType: 'job',
        entityId: 'job-123',
        entityLabel: 'Program Analyst',
      },
    });

    expect(context.currentView).toBe('dashboard');
    expect(context.requestDomain).toBe('qualification');
    expect(context.trustState).toBe('grounded');
    expect(context.selectedEntity.entityId).toBe('job-123');
    expect(context.governedResponse !== null).toBe(true);
    if (context.governedResponse === null) {
      throw new Error('Expected governed response.');
    }
    expect(context.governedResponse.summary).toBe('You have a grounded governed answer.');
    expect(context.governedResponse.explanation).toBe('Authoritative explanation from the backend contract.');
    expect('Current governed state: grounded qualification' in context).toBe(false);
  });

  it('builds partial conversational replies from missing inputs and next steps', function () {
    const context = buildPathAdvisorConversationContext({
      currentView: 'dashboard',
      draft: buildDraft(),
      result: buildSuccessResult('partial'),
    });

    const reply = buildPathAdvisorLocalConversationReply(context, 'What is still missing?');

    expect(reply).toContain('incomplete governed answer');
    expect(reply).toContain('expected_utilization');
    expect(reply).toContain('Review the duties before applying.');
    expect(reply).toContain('What is still missing?');
  });

  it('keeps refused replies distinct from technical failures', function () {
    const refusedReply = buildPathAdvisorLocalConversationReply(
      buildPathAdvisorConversationContext({
        currentView: 'dashboard',
        draft: buildDraft(),
        result: buildSuccessResult('refused'),
      }),
      'Why can you not answer?'
    );

    const technicalReply = buildPathAdvisorLocalConversationReply(
      buildPathAdvisorConversationContext({
        currentView: 'dashboard',
        draft: buildDraft(),
        result: {
          status: 'error',
          response: null,
          errorMessage: 'Proxy route failed.',
        },
      }),
      'Why can you not answer?'
    );

    expect(refusedReply).toContain('intentionally refused');
    expect(refusedReply).toContain('cross_domain_fehb_unavailable');
    expect(refusedReply).not.toContain('technical');
    expect(technicalReply).toContain('technical');
    expect(technicalReply).not.toContain('refused');
  });
});
