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
    rewrite_request_id: 'rewrite-1',
    resume: {
      resume_id: 'resume-1',
      variant_id: 'variant-1',
      revision_id: 'revision-1',
      snapshot_id: 'snapshot-1',
      diagnostics_id: 'diag-1',
    },
    target: {
      section_id: 'experience',
      bullet_id: 'exp-1-bullet-0',
      original_text: 'Tracked implementation milestones.',
    },
    grounding: {
      issue_code: 'MISSING_QUANTIFIED_OUTCOME',
      recommendation_code: 'REWRITE_FOR_OUTCOME',
      explanation_title: 'Rewrite the top bullet around the result',
      explanation_detail: 'This bullet is responsibility-heavy.',
      action_hint: 'Lead with an outcome and then show the action.',
      target_role: 'Program Analyst',
    },
  };
}

function buildRequest(payload: unknown): NextRequest {
  return new NextRequest('http://localhost/api/resume/rewrite-assist', {
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

describe('POST /api/resume/rewrite-assist', function () {
  it('forwards the exact bounded payload to the backend rewrite route', async function () {
    const payload = buildPayload();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          rewrite_request_id: 'rewrite-1',
          status: 'ready',
          candidates: [
            {
              candidate_id: 'candidate-1',
              label: 'Outcome-first option',
              text: 'Tracked implementation milestones across three teams and cut reporting lag by 25%.',
              rationale: 'Leads with scope and result.',
            },
          ],
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
    expect(fetchMock.mock.calls[0][0]).toBe('https://backend.pathos.test/api/v1/resume/rewrite-assist/generate');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual(payload);
    expect(response.status).toBe(200);
    expect(json.candidates.length).toBe(1);
  });

  it('rejects malformed widened payloads before the backend is called', async function () {
    const payload = buildPayload() as Record<string, unknown>;
    payload.untrusted_extra = 'not-allowed';
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const response = await POST(buildRequest(payload));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('bounded diagnostics-grounded rewrite payload');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
