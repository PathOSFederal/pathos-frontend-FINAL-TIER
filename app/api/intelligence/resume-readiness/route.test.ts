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
    resume_text:
      'Summary\nFederal analyst with program operations experience.\nExperience\n2022 2023 40 hours per week',
    resume_id: 'resume-123',
    target_role: 'GS-12 Program Analyst (0343)',
  };
}

function buildRequest(payload: unknown): NextRequest {
  return new NextRequest('http://localhost/api/intelligence/resume-readiness', {
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

describe('POST /api/intelligence/resume-readiness', function () {
  it('forwards the resume-readiness payload unchanged to the backend route', async function () {
    const payload = buildPayload();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          meta: {
            snapshot_id: 'resume-123',
            generated_at: '2026-04-09T12:00:00Z',
            input_hash: 'hash-123',
            rule_version: 'snapshot-rules-v1',
            knowledge_pack_version: 'career-pack-v1',
            kind: 'resume_readiness',
          },
          overall_score: 66,
          target_role: 'GS-12 Program Analyst (0343)',
          categories: {
            clarity: 68,
            evidence: 62,
          },
          suggestions: [],
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
    expect(fetchMock.mock.calls[0][0]).toBe('https://backend.pathos.test/api/v1/intelligence/resume-readiness');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual(payload);
    expect(response.status).toBe(200);
    expect(json.overall_score).toBe(66);
  });

  it('rejects non-object payloads before any backend call', async function () {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const response = await POST(buildRequest('invalid'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('structured request payload');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
