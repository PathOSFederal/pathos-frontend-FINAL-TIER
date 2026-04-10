import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCareerReadinessSnapshot,
  fetchResumeReadinessSnapshot,
} from './client';

const originalFetch = globalThis.fetch;

afterEach(function () {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('intelligence client', function () {
  it('returns a typed career-readiness snapshot on success', async function () {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          meta: {
            snapshot_id: 'career-1',
            generated_at: '2026-04-09T12:00:00Z',
            input_hash: 'hash-1',
            rule_version: 'rules-1',
            knowledge_pack_version: 'pack-1',
            kind: 'career_readiness',
          },
          overall_score: 72,
          label: 'Competitive with targeted improvements',
          target_role: 'GS-7 Program Analyst',
          spokes: {},
          top_gaps: [],
          action_plan: [],
          reasons: [],
          evidence_used: [],
          missing_evidence: [],
        }),
        { status: 200 }
      )
    ) as typeof globalThis.fetch;

    const result = await fetchCareerReadinessSnapshot({
      user_profile: {
        years_experience: 3,
      },
      target_role: 'GS-7 Program Analyst',
      resume_id: 'resume-1',
    });

    expect(result.ok).toBe(true);
    expect(result.snapshot?.overall_score).toBe(72);
    expect(result.errorMessage).toBeNull();
  });

  it('returns an unavailable result when the backend proxy fails', async function () {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Backend unavailable' }), { status: 503 })
    ) as typeof globalThis.fetch;

    const result = await fetchResumeReadinessSnapshot({
      resume_text: 'Summary\nExperience',
      resume_id: 'resume-1',
      target_role: 'GS-12 Program Analyst',
    });

    expect(result.ok).toBe(false);
    expect(result.unavailable).toBe(true);
    expect(result.errorMessage).toBe('Backend unavailable');
    expect(result.snapshot).toBeNull();
  });
});
