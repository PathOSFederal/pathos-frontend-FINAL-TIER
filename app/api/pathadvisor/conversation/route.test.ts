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
    intelligence: {
      source: 'live',
      isRefreshing: false,
      lastUpdatedLabel: 'Updated moments ago',
      errorMessage: null,
      workspaceResume: {
        id: 'resume-master-seed',
        name: 'Master Resume',
        mode: 'master',
        updatedAt: '2026-04-02T09:00:00Z',
        targetRoleTitle: 'Program Analyst',
      },
      careerReadiness: {
        meta: {
          snapshot_id: 'career-snapshot-2',
          generated_at: '2026-04-03T11:58:00Z',
          input_hash: 'career-hash',
          rule_version: 'rules-v1',
          knowledge_pack_version: 'career-pack-v1',
          kind: 'career_readiness',
        },
        overall_score: 73,
        label: 'Near ready',
        target_role: 'GS-9 Program Analyst',
        spokes: {
          qualifications: 76,
        },
        top_gaps: [
          {
            key: 'transcript',
            title: 'Provide transcript support',
            impact_points: 12,
            reason: 'The transcript is still missing.',
          },
        ],
        action_plan: [
          {
            key: 'upload-transcript',
            title: 'Upload transcript',
            impact_points: 12,
            effort: 'S',
            helper: 'Add the official transcript before applying.',
          },
        ],
        reasons: [],
        evidence_used: [],
        missing_evidence: [
          {
            key: 'governed_transcript_requirement',
            label: 'Official transcript',
            why_it_matters: 'Qualification review needs it.',
          },
        ],
      },
      resumeReadiness: null,
      refresh: null,
    },
    routeContext: {
      screenId: 'job-search',
      activeAnchor: {
        anchorType: 'job',
        anchorId: 'job-7',
        anchorLabel: 'Program Analyst',
      },
      recentEntries: [
        {
          title: 'Selected job: Program Analyst',
          subtitle: 'Department of Veterans Affairs',
          sections: [
            {
              title: null,
              lines: ['Current selection in Job Search.', 'Location: Washington, DC'],
              bullets: [],
            },
          ],
        },
      ],
    },
    carryForwardContext: {
      sourceKind: 'immediately_previous_user_turn',
      transformKind: 'same_thing_but',
      priorUserMessage: 'Are there law enforcement jobs available?',
      originalUserMessage: 'same thing but for florida',
      effectiveUserMessage: 'Are there law enforcement jobs available in florida?',
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
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).intelligence_context).toEqual({
      source: 'live',
      workspace_resume: {
        id: 'resume-master-seed',
        name: 'Master Resume',
        mode: 'master',
        updated_at: '2026-04-02T09:00:00Z',
        target_role_title: 'Program Analyst',
      },
      career_readiness: {
        snapshot_id: 'career-snapshot-2',
        generated_at: '2026-04-03T11:58:00Z',
        overall_score: 73,
        label: 'Near ready',
        target_role: 'GS-9 Program Analyst',
        spokes: {
          qualifications: 76,
        },
        top_gaps: ['Provide transcript support'],
        next_actions: ['Upload transcript'],
        missing_evidence: ['Official transcript'],
      },
      resume_readiness: null,
      application_confidence: null,
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).route_context).toEqual({
      screen_id: 'job-search',
      active_anchor: {
        anchor_type: 'job',
        anchor_id: 'job-7',
        anchor_label: 'Program Analyst',
      },
      recent_entries: [
        {
          title: 'Selected job: Program Analyst',
          subtitle: 'Department of Veterans Affairs',
          sections: [
            {
              title: null,
              lines: ['Current selection in Job Search.', 'Location: Washington, DC'],
              bullets: [],
            },
          ],
        },
      ],
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[0][1].body)).carry_forward_context
    ).toEqual({
      source_kind: 'immediately_previous_user_turn',
      transform_kind: 'same_thing_but',
      prior_user_message: 'Are there law enforcement jobs available?',
      original_user_message: 'same thing but for florida',
      effective_user_message: 'Are there law enforcement jobs available in florida?',
    });
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
    expect(json.error).toContain('bounded user message, governed context payload, and optional bounded intelligence and route context');
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
    expect(json.error).toContain('bounded user message, governed context payload, and optional bounded intelligence and route context');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
