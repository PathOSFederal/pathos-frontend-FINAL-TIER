/**
 * ============================================================================
 * GOVERNED PATHADVISOR CLIENT TESTS
 * ============================================================================
 *
 * PURPOSE:
 * Protect the thin browser-side contract boundary for the shared PathAdvisor
 * rail. These tests verify request shaping, endpoint selection, and shaped
 * response adaptation without touching live backend infrastructure.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoJobSeekerProfile } from '@/lib/api/profile';
import {
  buildInitialPathAdvisorDraft,
  fetchPathAdvisorEntryResponse,
  fetchQualificationEntryPathAdvisorResponse,
  fetchPathAdvisorConversationResponse,
  fetchGovernedPathAdvisorResponse,
} from './client';
import { buildPathAdvisorConversationContext } from './conversation-context';
import { buildPathAdvisorConversationRequestPayload } from './conversation-request';

const originalFetch = globalThis.fetch;

afterEach(function () {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('governed PathAdvisor client', function () {
  it('builds the initial draft from the frontend profile', function () {
    const draft = buildInitialPathAdvisorDraft(demoJobSeekerProfile);

    expect(draft.domain).toBe('qualification');
    expect(draft.qualification.yearsExperience).toBe('3');
    expect(draft.qualification.targetRoles).toContain('IT Specialist (2210)');
    expect(draft.fehb.coverageType).toBe('self_only');
  });

  it('routes qualification requests through the governed qualification endpoint', async function () {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async function () {
        return JSON.stringify({
          domain: 'qualification',
          response_state: 'grounded',
          grounded: true,
          summary: 'Qualification summary',
          explanation: 'Qualification explanation',
          key_factors: [],
          missing_inputs: [],
          next_steps: [],
          refusal_reason: null,
          pack_version_id: 'pack-version-1',
          freshness_state: 'fresh',
          grounding: {
            domain: 'qualification',
            response_state: 'grounded',
            grounded: true,
            partial: false,
            refusal_reason: null,
            missing_inputs: [],
            pack_id: 'pack-1',
            pack_key: 'qualification.pack',
            version_id: 'pack-version-1',
            version: 1,
            freshness_state: 'fresh',
            freshness_reason: 'Fresh.',
            effective_at: null,
            reviewed_at: null,
            review_by: null,
            expires_at: null,
            serving_eligible: true,
            source_summary: null,
            conversation_provider: 'fake-provider',
            provider_used: true,
            refusal_domain: null,
            domains: [
              {
                domain: 'qualification',
                response_state: 'grounded',
                grounded: true,
                partial: false,
                refusal_reason: null,
                missing_inputs: [],
                pack_id: 'pack-1',
                pack_key: 'qualification.pack',
                version_id: 'pack-version-1',
                version: 1,
                freshness_state: 'fresh',
                freshness_reason: 'Fresh.',
              },
            ],
          },
          served_at: '2026-04-01T12:00:00Z',
        });
      },
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const response = await fetchGovernedPathAdvisorResponse(
      buildInitialPathAdvisorDraft(demoJobSeekerProfile),
      demoJobSeekerProfile
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/pathadvisor/qualification/explain');
    expect(response !== null).toBe(true);
    if (response === null) {
      throw new Error('Expected governed PathAdvisor response.');
    }
    expect(response.responseState).toBe('grounded');
    expect(response.packVersionId).toBe('pack-version-1');
    expect(response.grounding.conversationProvider).toBe('fake-provider');
  });

  it('routes cross-domain requests through the cross-domain endpoint', async function () {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async function () {
        return JSON.stringify({
          domain: 'cross_domain',
          response_state: 'partial',
          grounded: true,
          summary: 'Cross-domain summary',
          explanation: 'Cross-domain explanation',
          key_factors: [],
          missing_inputs: ['fehb.expected_utilization'],
          next_steps: [],
          refusal_reason: null,
          pack_version_id: 'cross-domain-pack',
          freshness_state: 'aging',
          grounding: {
            domain: 'cross_domain',
            response_state: 'partial',
            grounded: true,
            partial: true,
            refusal_reason: null,
            missing_inputs: ['fehb.expected_utilization'],
            pack_id: null,
            pack_key: null,
            version_id: null,
            version: null,
            freshness_state: 'aging',
            freshness_reason: 'Aging.',
            effective_at: null,
            reviewed_at: null,
            review_by: null,
            expires_at: null,
            serving_eligible: true,
            source_summary: null,
            conversation_provider: 'fake-provider',
            provider_used: true,
            refusal_domain: null,
            domains: [
              {
                domain: 'qualification',
                response_state: 'grounded',
                grounded: true,
                partial: false,
                refusal_reason: null,
                missing_inputs: [],
                pack_id: 'qualification-pack',
                pack_key: 'qualification.pack',
                version_id: 'qualification-version',
                version: 1,
                freshness_state: 'fresh',
                freshness_reason: 'Fresh.',
              },
              {
                domain: 'fehb',
                response_state: 'partial',
                grounded: true,
                partial: true,
                refusal_reason: null,
                missing_inputs: ['expected_utilization'],
                pack_id: 'fehb-pack',
                pack_key: 'fehb.pack',
                version_id: 'fehb-version',
                version: 1,
                freshness_state: 'aging',
                freshness_reason: 'Aging.',
              },
            ],
          },
          served_at: '2026-04-01T12:00:00Z',
        });
      },
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const draft = buildInitialPathAdvisorDraft(demoJobSeekerProfile);
    draft.domain = 'cross_domain';
    draft.fehb.coverageType = 'family';
    draft.fehb.expectedUtilization = 'high';

    const response = await fetchGovernedPathAdvisorResponse(
      draft,
      demoJobSeekerProfile
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/pathadvisor/cross-domain/explain');
    expect(response !== null).toBe(true);
    if (response === null) {
      throw new Error('Expected cross-domain response.');
    }
    expect(response.domain).toBe('cross_domain');
    expect(response.missingInputs).toEqual(['fehb.expected_utilization']);
    expect(response.grounding.domains.length).toBe(2);
  });

  it('throws a technical error when the proxy route fails', async function () {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async function () {
        return JSON.stringify({
          error: 'Backend configuration is missing.',
        });
      },
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    await expect(
      fetchGovernedPathAdvisorResponse(
        buildInitialPathAdvisorDraft(demoJobSeekerProfile),
        demoJobSeekerProfile
      )
    ).rejects.toThrow('Backend configuration is missing.');
  });

  it('routes qualification entry requests through the coverage-aware qualification entry endpoint', async function () {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async function () {
        return JSON.stringify({
          domain: 'qualification',
          response_state: 'refused',
          grounded: false,
          summary: 'Governed family coverage is not currently available.',
          explanation: 'Coverage-aware refusal.',
          key_factors: [],
          missing_inputs: [],
          next_steps: ['Continue once coverage is promoted.'],
          refusal_reason: 'governed_target_family_uncovered',
          pack_version_id: null,
          freshness_state: null,
          grounding: {
            domain: 'qualification',
            response_state: 'refused',
            grounded: false,
            partial: false,
            refusal_reason: 'governed_target_family_uncovered',
            missing_inputs: [],
            pack_id: null,
            pack_key: null,
            version_id: null,
            version: null,
            freshness_state: null,
            freshness_reason: null,
            effective_at: null,
            reviewed_at: null,
            review_by: null,
            expires_at: null,
            serving_eligible: false,
            source_summary: null,
            conversation_provider: 'pathadvisor_qualification_entry',
            provider_used: false,
            refusal_domain: null,
            domains: [],
          },
          served_at: '2026-04-09T12:00:00Z',
        });
      },
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const response = await fetchQualificationEntryPathAdvisorResponse(
      'do i qualify for law enforcement?',
      buildInitialPathAdvisorDraft(demoJobSeekerProfile),
      demoJobSeekerProfile
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/pathadvisor/qualification/entry');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).user_message).toBe(
      'do i qualify for law enforcement?'
    );
    expect(response !== null).toBe(true);
    if (response === null) {
      throw new Error('Expected coverage-aware PathAdvisor response.');
    }
    expect(response.responseState).toBe('refused');
    expect(response.refusalReason).toBe('governed_target_family_uncovered');
  });

  it('routes universal entry requests through the PathAdvisor entry endpoint', async function () {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async function () {
        return JSON.stringify({
          domain: 'job_search',
          response_state: 'grounded',
          grounded: true,
          summary: 'Live availability found current matches.',
          explanation: 'Live availability explanation.',
          key_factors: [],
          missing_inputs: [],
          next_steps: ['Open Job Search.'],
          refusal_reason: null,
          pack_version_id: null,
          freshness_state: 'fresh',
          grounding: {
            domain: 'job_search',
            response_state: 'grounded',
            grounded: true,
            partial: false,
            refusal_reason: null,
            missing_inputs: [],
            pack_id: null,
            pack_key: null,
            version_id: null,
            version: null,
            freshness_state: 'fresh',
            freshness_reason: 'live_usajobs_search',
            effective_at: null,
            reviewed_at: null,
            review_by: null,
            expires_at: null,
            serving_eligible: true,
            source_summary: null,
            conversation_provider: 'pathadvisor_job_search_entry',
            provider_used: false,
            refusal_domain: null,
            domains: [],
            entry_planning: {
              planning_basis: 'explicit_intent',
              planning_summary:
                "Planner selected job search from the user's explicit question.",
              planned_domains: [
                {
                  domain: 'job_search',
                  selection_basis: 'explicit_intent',
                  capability_state: 'not_required',
                  capability_reason:
                    'Job search routing does not depend on pre-existing bounded screen context.',
                },
              ],
            },
          },
          served_at: '2026-04-09T12:00:00Z',
        });
      },
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const response = await fetchPathAdvisorEntryResponse(
      'are there law enforcement jobs available in florida?',
      buildInitialPathAdvisorDraft(demoJobSeekerProfile),
      demoJobSeekerProfile
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/pathadvisor/entry');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).user_message).toBe(
      'are there law enforcement jobs available in florida?'
    );
    expect(response !== null).toBe(true);
    if (response === null) {
      throw new Error('Expected PathAdvisor entry response.');
    }
    expect(response.domain).toBe('job_search');
    expect(response.responseState).toBe('grounded');
    expect(response.grounding.entryPlanning?.planningBasis).toBe('explicit_intent');
    expect(response.grounding.entryPlanning?.plannedDomains[0].capabilityState).toBe(
      'not_required'
    );
  });

  it('forwards bounded route and current target context through the universal entry endpoint', async function () {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async function () {
        return JSON.stringify({
          domain: 'qualification',
          response_state: 'grounded',
          grounded: true,
          summary: 'Governed qualification guidance is available.',
          explanation: 'Qualification explanation.',
          key_factors: [],
          missing_inputs: [],
          next_steps: ['Review the governed qualification details.'],
          refusal_reason: null,
          pack_version_id: 'pack-version-1',
          freshness_state: 'fresh',
          grounding: {
            domain: 'qualification',
            response_state: 'grounded',
            grounded: true,
            partial: false,
            refusal_reason: null,
            missing_inputs: [],
            pack_id: 'pack-1',
            pack_key: 'qualification.pack',
            version_id: 'pack-version-1',
            version: 1,
            freshness_state: 'fresh',
            freshness_reason: 'within_review_window',
            effective_at: null,
            reviewed_at: null,
            review_by: null,
            expires_at: null,
            serving_eligible: true,
            source_summary: null,
            conversation_provider: 'pathadvisor_qualification_entry',
            provider_used: false,
            refusal_domain: null,
            domains: [],
          },
          served_at: '2026-04-09T12:00:00Z',
        });
      },
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    await fetchPathAdvisorEntryResponse(
      'do i qualify for this job?',
      buildInitialPathAdvisorDraft(demoJobSeekerProfile),
      demoJobSeekerProfile,
      {
        intelligenceContext: {
          source: 'partial_live',
          workspaceResume: null,
          careerReadiness: null,
          resumeReadiness: {
            snapshotId: 'resume-snapshot-1',
            generatedAt: '2026-04-09T12:00:00Z',
            overallScore: 61,
            targetRole: 'Criminal Investigator',
            categories: {
              evidence: 55,
              structure: 68,
            },
            suggestions: ['Add employment dates'],
            missingEvidence: ['Employment dates'],
          },
          applicationConfidence: {
            source: 'live',
            screenId: 'job-search',
            jobId: 'job-123',
            jobTitle: 'Criminal Investigator',
            targetRole: 'Criminal Investigator',
            overallScore: 74,
            recommendation: 'consider',
            decisionBand: 'consider',
            confidenceBand: 'medium',
            rationaleSummary:
              'The selected job is plausible, but evidence is still incomplete.',
            priorityLevel: 'medium',
            alertImportance: 'medium',
            blockingIssues: ['Transcript evidence is still unresolved.'],
            missingEvidence: ['Official transcript'],
            nextActions: ['Upload transcript'],
            decisionVersion: 'decision-v1',
          },
        },
        currentTargetLabel: 'GS-9 Program Analyst',
        routeTargetLabel: 'Criminal Investigator',
        routeAnchorLabel: 'Criminal Investigator',
        routeScreenId: 'job-search',
      }
    );

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(requestBody.intelligence_context).toEqual({
      source: 'partial_live',
      career_readiness: null,
      resume_readiness: {
        snapshot_id: 'resume-snapshot-1',
        generated_at: '2026-04-09T12:00:00Z',
        overall_score: 61,
        target_role: 'Criminal Investigator',
        categories: {
          evidence: 55,
          structure: 68,
        },
        suggestions: ['Add employment dates'],
        missing_evidence: ['Employment dates'],
      },
      application_confidence: {
        source: 'live',
        screen_id: 'job-search',
        job_id: 'job-123',
        job_title: 'Criminal Investigator',
        target_role: 'Criminal Investigator',
        overall_score: 74,
        recommendation: 'consider',
        decision_band: 'consider',
        confidence_band: 'medium',
        rationale_summary:
          'The selected job is plausible, but evidence is still incomplete.',
        priority_level: 'medium',
        alert_importance: 'medium',
        blocking_issues: ['Transcript evidence is still unresolved.'],
        missing_evidence: ['Official transcript'],
        next_actions: ['Upload transcript'],
        decision_version: 'decision-v1',
      },
    });
    expect(requestBody.current_target_label).toBe('GS-9 Program Analyst');
    expect(requestBody.route_target_label).toBe('Criminal Investigator');
    expect(requestBody.route_anchor_label).toBe('Criminal Investigator');
    expect(requestBody.route_screen_id).toBe('job-search');
  });

  it('adapts mixed cross-domain entry responses returned by the universal entry endpoint', async function () {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async function () {
        return JSON.stringify({
          domain: 'cross_domain',
          response_state: 'partial',
          grounded: true,
          summary: 'Combined job search and qualification guidance is limited by one unavailable domain.',
          explanation: 'Job availability: live search explanation. Qualification guidance: unavailable.',
          key_factors: [],
          missing_inputs: ['qualification.skills'],
          next_steps: ['Open Job Search.', 'Provide your skills.'],
          refusal_reason: null,
          pack_version_id: null,
          freshness_state: null,
          grounding: {
            domain: 'cross_domain',
            response_state: 'partial',
            grounded: true,
            partial: true,
            refusal_reason: null,
            missing_inputs: ['qualification.skills'],
            pack_id: null,
            pack_key: null,
            version_id: null,
            version: null,
            freshness_state: null,
            freshness_reason: null,
            effective_at: null,
            reviewed_at: null,
            review_by: null,
            expires_at: null,
            serving_eligible: true,
            source_summary: null,
            conversation_provider: 'pathadvisor_job_search_qualification_entry',
            provider_used: false,
            refusal_domain: null,
            domains: [
              {
                domain: 'qualification',
                response_state: 'partial',
                grounded: true,
                partial: true,
                refusal_reason: null,
                missing_inputs: ['skills'],
                pack_id: 'pack-1',
                pack_key: 'qualification.pack',
                version_id: 'pack-ver-1',
                version: 1,
                freshness_state: 'fresh',
                freshness_reason: 'within_review_window',
              },
              {
                domain: 'job_search',
                response_state: 'grounded',
                grounded: true,
                partial: false,
                refusal_reason: null,
                missing_inputs: [],
                pack_id: null,
                pack_key: null,
                version_id: null,
                version: null,
                freshness_state: 'fresh',
                freshness_reason: 'live_usajobs_search',
              },
            ],
          },
          served_at: '2026-04-09T12:00:00Z',
        });
      },
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const response = await fetchPathAdvisorEntryResponse(
      'are there law enforcement jobs in florida, and do i qualify?',
      buildInitialPathAdvisorDraft(demoJobSeekerProfile),
      demoJobSeekerProfile
    );

    expect(response !== null).toBe(true);
    if (response === null) {
      throw new Error('Expected mixed PathAdvisor entry response.');
    }
    expect(response.domain).toBe('cross_domain');
    expect(response.responseState).toBe('partial');
    expect(response.grounding.domains.length).toBe(2);
    expect(response.grounding.domains[1].domain).toBe('job_search');
  });

  it('treats omitted application confidence on entry context as absent instead of crashing', async function () {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async function () {
        return JSON.stringify({
          domain: 'qualification',
          response_state: 'grounded',
          grounded: true,
          summary: 'Qualification summary',
          explanation: 'Qualification explanation.',
          key_factors: [],
          missing_inputs: [],
          next_steps: [],
          refusal_reason: null,
          pack_version_id: 'pack-version-1',
          freshness_state: 'fresh',
          grounding: {
            domain: 'qualification',
            response_state: 'grounded',
            grounded: true,
            partial: false,
            refusal_reason: null,
            missing_inputs: [],
            pack_id: 'pack-1',
            pack_key: 'qualification.pack',
            version_id: 'pack-version-1',
            version: 1,
            freshness_state: 'fresh',
            freshness_reason: 'within_review_window',
            effective_at: null,
            reviewed_at: null,
            review_by: null,
            expires_at: null,
            serving_eligible: true,
            source_summary: null,
            conversation_provider: 'pathadvisor_qualification_entry',
            provider_used: false,
            refusal_domain: null,
            domains: [],
          },
          served_at: '2026-04-09T12:00:00Z',
        });
      },
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    await fetchPathAdvisorEntryResponse(
      'do i qualify for this job?',
      buildInitialPathAdvisorDraft(demoJobSeekerProfile),
      demoJobSeekerProfile,
      {
        intelligenceContext: {
          source: 'partial_live',
          workspaceResume: null,
          careerReadiness: null,
          resumeReadiness: null,
        } as Parameters<typeof fetchPathAdvisorEntryResponse>[3]['intelligenceContext'],
        currentTargetLabel: 'GS-9 Program Analyst',
        routeTargetLabel: 'Criminal Investigator',
        routeAnchorLabel: 'Criminal Investigator',
        routeScreenId: 'job-search',
      }
    );

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(requestBody.intelligence_context.application_confidence).toBe(null);
  });

  it('routes governed conversation requests through the same-origin conversation endpoint', async function () {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async function () {
        return JSON.stringify({
          reply: 'This is the backend conversation reply.',
          response_state: 'grounded',
          grounded: true,
          refusal_reason: null,
        });
      },
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const conversationContext = buildPathAdvisorConversationContext({
      currentView: 'dashboard',
      draft: buildInitialPathAdvisorDraft(demoJobSeekerProfile),
      result: {
        status: 'success',
        errorMessage: null,
        response: {
          domain: 'qualification',
          responseState: 'grounded',
          grounded: true,
          summary: 'Governed summary',
          explanation: 'Governed explanation',
          keyFactors: [],
          missingInputs: [],
          nextSteps: [],
          refusalReason: null,
          packVersionId: 'pack-version-1',
          freshnessState: 'fresh',
          grounding: {
            domain: 'qualification',
            responseState: 'grounded',
            grounded: true,
            partial: false,
            refusalReason: null,
            missingInputs: [],
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
    });

    const response = await fetchPathAdvisorConversationResponse(
      'What does this result mean?',
      conversationContext
    );
    const requestInit = fetchMock.mock.calls[0][1];
    const requestBody = JSON.parse(String(requestInit.body));
    const expectedRequest = buildPathAdvisorConversationRequestPayload(
      'What does this result mean?',
      conversationContext
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/pathadvisor/conversation');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      cache: 'no-store',
    });
    expect(requestBody).toEqual(expectedRequest);
    expect('draft_inputs' in requestBody).toBe(false);
    expect('request_id' in requestBody).toBe(false);
    expect(requestBody.route).toBe('qualification_explanation');
    expect(requestBody.trust_state).toBe('governed');
    expect(requestBody.governed_context.pack_version_id).toBe('pack-version-1');
    expect(requestBody.governed_context.grounding.conversation_provider).toBe('fake-provider');
    expect('context' in requestBody).toBe(false);
    expect('qualification' in requestBody).toBe(false);
    expect(response.reply).toBe('This is the backend conversation reply.');
    expect(response.responseState).toBe('grounded');
  });

  it('throws a clear local error when the conversation request lacks governed context', async function () {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const conversationContext = buildPathAdvisorConversationContext({
      currentView: 'dashboard',
      draft: buildInitialPathAdvisorDraft(demoJobSeekerProfile),
      result: {
        status: 'idle',
        response: null,
        errorMessage: null,
      },
    });

    await expect(
      fetchPathAdvisorConversationResponse(
        'What can you explain?',
        conversationContext
      )
    ).rejects.toThrow('PathAdvisor needs a governed result before it can request a bounded conversation explanation.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws a technical error when the conversation proxy route fails', async function () {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async function () {
        return JSON.stringify({
          error: 'Conversation backend is unavailable.',
        });
      },
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const conversationContext = buildPathAdvisorConversationContext({
      currentView: 'dashboard',
      draft: buildInitialPathAdvisorDraft(demoJobSeekerProfile),
      result: {
        status: 'success',
        response: {
          domain: 'qualification',
          responseState: 'grounded',
          grounded: true,
          summary: 'Governed summary',
          explanation: 'Governed explanation',
          keyFactors: [],
          missingInputs: [],
          nextSteps: [],
          refusalReason: null,
          packVersionId: 'pack-version-1',
          freshnessState: 'fresh',
          grounding: {
            domain: 'qualification',
            responseState: 'grounded',
            grounded: true,
            partial: false,
            refusalReason: null,
            missingInputs: [],
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
            servingEligible: true,
            sourceSummary: null,
            conversationProvider: 'fake-provider',
            providerUsed: true,
            refusalDomain: null,
            domains: [],
          },
          servedAt: '2026-04-03T12:00:00Z',
        },
        errorMessage: null,
      },
    });

    await expect(
      fetchPathAdvisorConversationResponse(
        'What can you explain?',
        conversationContext
      )
    ).rejects.toThrow('Conversation backend is unavailable.');
  });
});
