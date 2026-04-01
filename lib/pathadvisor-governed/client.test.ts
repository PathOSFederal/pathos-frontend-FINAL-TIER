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
  fetchGovernedPathAdvisorResponse,
} from './client';

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
});
