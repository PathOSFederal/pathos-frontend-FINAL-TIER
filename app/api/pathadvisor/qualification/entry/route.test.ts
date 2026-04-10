/**
 * ============================================================================
 * COVERAGE-AWARE PATHADVISOR QUALIFICATION ENTRY PROXY ROUTE TESTS
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
    user_message: 'do i qualify for law enforcement?',
    user_facts: {
      user_id: 'user-1',
      years_experience: 2,
      target_roles: ['Program Analyst'],
      skills: ['analysis'],
      preferred_locations: ['Washington, DC'],
      authorized_to_work: true,
    },
    use_persisted_profile: false,
    request_id: 'qualification-123',
  };
}

function buildRequest(payload: unknown): NextRequest {
  return new NextRequest('http://localhost/api/pathadvisor/qualification/entry', {
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

describe('POST /api/pathadvisor/qualification/entry', function () {
  it('forwards the exact bounded entry payload to the backend route', async function () {
    const payload = buildPayload();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
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
      'https://backend.pathos.test/api/v1/pathadvisor/qualification/entry'
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual(payload);
    expect(response.status).toBe(200);
    expect(json.refusal_reason).toBe('governed_target_family_uncovered');
  });

  it('rejects widened payloads before any backend call is made', async function () {
    const payload = buildPayload() as Record<string, unknown>;
    payload.route = 'qualification_explanation';
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const response = await POST(buildRequest(payload));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('user message plus a structured qualification payload');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
