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
    user_profile: {
      years_experience: 3,
      education_level: 'Bachelor',
      target_series: ['Program Analyst (0343)'],
      location: 'Washington, DC',
    },
    target_role: 'GS-7 Program Analyst (0343)',
    resume_id: 'resume-123',
  };
}

function buildRequest(payload: unknown): NextRequest {
  return new NextRequest('http://localhost/api/intelligence/career-readiness', {
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

describe('POST /api/intelligence/career-readiness', function () {
  it('forwards the career-readiness payload unchanged to the backend route', async function () {
    const payload = buildPayload();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          meta: {
            snapshot_id: 'career-123',
            generated_at: '2026-04-09T12:00:00Z',
            input_hash: 'hash-123',
            rule_version: 'snapshot-rules-v1',
            knowledge_pack_version: 'career-pack-v1',
            kind: 'career_readiness',
          },
          overall_score: 71,
          label: 'Competitive with targeted improvements',
          target_role: 'GS-7 Program Analyst (0343)',
          spokes: {
            qualification: 78,
            target_alignment: 72,
          },
          top_gaps: [],
          action_plan: [],
          reasons: [],
          evidence_used: [],
          missing_evidence: [],
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
    expect(fetchMock.mock.calls[0][0]).toBe('https://backend.pathos.test/api/v1/intelligence/career-readiness');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual(payload);
    expect(response.status).toBe(200);
    expect(json.overall_score).toBe(71);
  });

  it('rejects non-object payloads before any backend call', async function () {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const response = await POST(buildRequest(['invalid']));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('structured request payload');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
