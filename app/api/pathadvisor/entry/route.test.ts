/**
 * ============================================================================
 * PATHADVISOR UNIVERSAL ENTRY PROXY ROUTE TESTS
 * ============================================================================
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

vi.mock('@/lib/live-advisor/backend', function () {
  return {
    resolveLiveAdvisorBackendConfig: function () {
      return {
        config: {
          baseUrl: 'https://backend.pathos.test',
          apiKey: 'test-api-key',
        },
        errorMessage: null,
      };
    },
  };
});

const originalFetch = globalThis.fetch;

function buildPayload() {
  return {
    user_message: 'are there law enforcement jobs available in florida?',
    user_facts: {
      user_id: 'user-1',
      years_experience: 2,
      target_roles: ['Program Analyst'],
      skills: ['analysis'],
      preferred_locations: ['Florida'],
      authorized_to_work: true,
    },
    intelligence_context: {
      source: 'partial_live',
      resume_readiness: {
        snapshot_id: 'resume-snapshot-1',
        generated_at: '2026-04-09T12:00:00Z',
        overall_score: 61,
        target_role: 'Criminal Investigator',
        categories: {
          evidence: 55,
        },
        suggestions: ['Add employment dates'],
        missing_evidence: ['Employment dates'],
      },
    },
    current_target_label: 'GS-9 Program Analyst',
    route_target_label: 'Criminal Investigator',
    route_anchor_label: 'Criminal Investigator',
    route_screen_id: 'job-search',
    use_persisted_profile: false,
    request_id: 'entry-123',
  };
}

function buildRequest(payload: unknown): NextRequest {
  return new NextRequest('http://localhost/api/pathadvisor/entry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

afterEach(function () {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('POST /api/pathadvisor/entry', function () {
  it('forwards the exact bounded entry payload to the backend route', async function () {
    const payload = buildPayload();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
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
          },
          served_at: '2026-04-09T12:00:00Z',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    );
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const response = await POST(buildRequest(payload));
    const json = await response.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://backend.pathos.test/api/v1/pathadvisor/entry'
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual(payload);
    expect(response.status).toBe(200);
    expect(json.domain).toBe('job_search');
  });

  it('rejects widened payloads before any backend call is made', async function () {
    const payload = buildPayload() as Record<string, unknown>;
    payload.route = 'job_search_explanation';
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const response = await POST(buildRequest(payload));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('structured federal job-seeking payload');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
