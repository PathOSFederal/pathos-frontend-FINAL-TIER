/**
 * ============================================================================
 * RESUME DIAGNOSTICS PROXY ROUTE TESTS
 * ============================================================================
 *
 * PURPOSE:
 * Verify the Day 76b resume diagnostics proxy accepts only a structured
 * payload and forwards the backend contract unchanged to the canonical
 * diagnostics endpoint.
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
    resume: {
      resume_id: 'resume-123',
      revision_id: 'revision-123',
      document_text: 'Summary\n\nExperience',
      sections: [
        {
          section_id: 'summary',
          section_type: 'summary',
          title: 'Summary',
          content: 'Federal analyst with operations experience.',
        },
      ],
    },
    target_context: {
      mode: 'role',
      target_role: 'Program Analyst',
      canonical_job_id: null,
    },
    scope: {
      evaluation_mode: 'full_document',
    },
    options: {
      include_recommendations: true,
      include_examples: false,
    },
  };
}

function buildRequest(payload: unknown): NextRequest {
  return new NextRequest('http://localhost/api/resume/diagnostics/evaluate', {
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

describe('POST /api/resume/diagnostics/evaluate', function () {
  it('forwards the diagnostics payload unchanged to the backend route', async function () {
    const payload = buildPayload();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          response_state: 'evaluated',
          diagnostics_id: 'diag-123',
          resume_id: 'resume-123',
          revision_id: 'revision-123',
          scope: {
            evaluation_mode: 'full_document',
            evaluated_section_ids: ['summary'],
          },
          target_context: {
            mode: 'role',
            target_role: 'Program Analyst',
            canonical_job_id: null,
          },
          overall: {
            readiness_band: 'workable',
            score: 72,
            summary: 'Backend-owned summary.',
          },
          category_scores: [],
          issues: [],
          recommendations: [],
          warnings: [],
          missing_evidence: [],
          meta: {
            engine_version: 'engine-1',
            ruleset_version: 'rules-1',
            explainability_version: 'exp-1',
            knowledge_pack_version: null,
            input_hash: 'hash-1',
          },
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
    expect(fetchMock.mock.calls[0][0]).toBe('https://backend.pathos.test/api/v1/resume/diagnostics/evaluate');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual(payload);
    expect(response.status).toBe(200);
    expect(json.diagnostics_id).toBe('diag-123');
  });

  it('rejects non-object payloads before any backend call', async function () {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const response = await POST(buildRequest(['invalid']));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('structured evaluation payload');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
