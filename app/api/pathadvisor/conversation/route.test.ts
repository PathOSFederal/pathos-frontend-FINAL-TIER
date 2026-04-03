/**
 * ============================================================================
 * PATHADVISOR CONVERSATION PROXY ROUTE TESTS
 * ============================================================================
 *
 * PURPOSE:
 * Verify the same-origin conversation proxy accepts only the exact bounded
 * payload and forwards it unchanged to the backend route.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { buildPathAdvisorConversationContext } from '@/lib/pathadvisor-governed/conversation-context';
import { buildPathAdvisorConversationRequestPayload } from '@/lib/pathadvisor-governed/conversation-request';

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
  const context = buildPathAdvisorConversationContext({
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
        responseState: 'grounded',
        grounded: true,
        summary: 'Governed summary',
        explanation: 'Governed explanation',
        keyFactors: [],
        missingInputs: [],
        nextSteps: ['Review the duties.'],
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

  return buildPathAdvisorConversationRequestPayload('What does this mean?', context);
}

function buildRequest(payload: unknown): NextRequest {
  return new NextRequest('http://localhost/api/pathadvisor/conversation', {
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

describe('POST /api/pathadvisor/conversation', function () {
  it('forwards the exact bounded payload without reshaping backend business fields', async function () {
    const payload = buildPayload();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          reply: 'Backend explanation only.',
          response_state: 'grounded',
          grounded: true,
          refusal_reason: null,
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
    expect(fetchMock.mock.calls[0][0]).toBe('https://backend.pathos.test/api/v1/pathadvisor/conversation');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual(payload);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).draft_inputs).toBeUndefined();
    expect(response.status).toBe(200);
    expect(json.reply).toBe('Backend explanation only.');
  });

  it('forwards only allowed draft_inputs fields when explicit conversation hints exist', async function () {
    const payload = buildPayload();
    payload.draft_inputs = {
      focus_topics: ['qualification'],
      selected_missing_inputs: [],
      selected_next_steps: ['Review the duties.'],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          reply: 'Backend explanation only.',
          response_state: 'grounded',
          grounded: true,
          refusal_reason: null,
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
    const forwardedBody = JSON.parse(String(fetchMock.mock.calls[0][1].body));

    expect(response.status).toBe(200);
    expect(forwardedBody.draft_inputs).toEqual({
      focus_topics: ['qualification'],
      selected_missing_inputs: [],
      selected_next_steps: ['Review the duties.'],
    });
    expect(forwardedBody.draft_inputs.qualification).toBeUndefined();
    expect(forwardedBody.draft_inputs.fehb).toBeUndefined();
  });

  it('rejects widened payloads before any backend call is made', async function () {
    const payload = buildPayload() as unknown as Record<string, unknown>;
    payload.request_id = 'frontend-should-not-send-this';
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const response = await POST(buildRequest(payload));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('bounded user message and governed context payload');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects the old nested context payload shape', async function () {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const response = await POST(buildRequest({
      user_message: 'Explain this result.',
      context: {
        route: {
          view: 'dashboard',
        },
      },
    }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('bounded user message and governed context payload');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
