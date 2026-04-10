import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchDashboardIntelligence,
  fetchResumeBuilderIntelligence,
} from './client';

afterEach(function () {
  vi.restoreAllMocks();
});

describe('pathadvisor intelligence client', function () {
  it('adapts backend dashboard intelligence payloads into the UI contract', async function () {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async function () {
          return JSON.stringify({
            screen: 'dashboard',
            pathadvisor_mode: 'strategy_summary',
            context: {
              target_role_clusters: ['Program analyst'],
              preferred_locations: ['Washington, DC'],
              readiness_state: 'draft_resume',
              fit_lanes: ['Analyst lane'],
              blockers: ['Resume evidence still needs work'],
              top_missing_items: ['Location flexibility'],
              next_best_actions: ['Clarify location flexibility'],
              active_threads: ['Target direction'],
              profile_completeness: 68,
              freshness_band: 'fresh',
              confidence_band: 'medium',
              recent_meaningful_changes: ['Updated target role cluster'],
              activity_signals: ['Saved analyst roles in DC'],
              updated_at: '2026-04-09T12:00:00Z',
            },
            summary: 'PathAdvisor is distributing your strongest current intelligence across the dashboard.',
            strongest_current_fit_lanes: ['Target field: Program / policy analyst'],
            active_blockers: ['Resume evidence still needs work'],
            top_missing_items: ['Location flexibility'],
            next_best_action: {
              action_id: 'dashboard_next_best_action',
              title: 'Keep building your canonical profile',
              description: 'Clarify the highest-value missing item next.',
              cta_label: 'Continue improving profile',
              cta_href: '/dashboard',
              reason: 'This unlocks stronger guidance across the app.',
            },
            confidence_summary: 'Confidence is medium with profile completeness at 68%.',
          });
        },
      })
    );

    const payload = await fetchDashboardIntelligence();

    expect(payload.pathadvisorMode).toBe('strategy_summary');
    expect(payload.context.targetRoleClusters).toEqual(['Program analyst']);
    expect(payload.strongestCurrentFitLanes).toEqual([
      'Target field: Program / policy analyst',
    ]);
    expect(payload.nextBestAction.title).toBe('Keep building your canonical profile');
  });

  it('adapts backend resume builder intelligence payloads into the UI contract', async function () {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async function () {
          return JSON.stringify({
            screen: 'resume_builder',
            pathadvisor_mode: 'readiness_evidence',
            context: {
              target_role_clusters: ['Program analyst'],
              preferred_locations: ['Washington, DC'],
              readiness_state: 'draft_resume',
              fit_lanes: ['Analyst lane'],
              blockers: ['Resume evidence still needs work'],
              top_missing_items: ['Location flexibility'],
              next_best_actions: ['Strengthen evidence for analyst roles'],
              active_threads: ['Resume readiness'],
              profile_completeness: 70,
              freshness_band: 'fresh',
              confidence_band: 'medium',
              recent_meaningful_changes: ['Resume workflow started'],
              activity_signals: ['Started resume workflow'],
              updated_at: '2026-04-09T12:00:00Z',
            },
            summary: 'Resume Builder is consuming the same canonical user intelligence context used across the rest of PathOS.',
            target_alignment_warnings: [
              'Target role direction is still too broad for strong tailoring guidance.',
            ],
            evidence_gaps: ['Location flexibility'],
            suggested_builder_focus: ['Strengthen evidence for analyst roles'],
            next_best_action: {
              action_id: 'strengthen_evidence',
              title: 'Strengthen evidence for your likely-fit lane',
              description: 'Use canonical user intelligence to focus the next resume improvement pass.',
              cta_label: 'Strengthen resume evidence',
              cta_href: '/dashboard/resume-builder',
              reason: 'Resume Builder should turn canonical blockers into concrete evidence work.',
            },
          });
        },
      })
    );

    const payload = await fetchResumeBuilderIntelligence();

    expect(payload.pathadvisorMode).toBe('readiness_evidence');
    expect(payload.context.nextBestActions).toEqual([
      'Strengthen evidence for analyst roles',
    ]);
    expect(payload.targetAlignmentWarnings).toEqual([
      'Target role direction is still too broad for strong tailoring guidance.',
    ]);
    expect(payload.nextBestAction.ctaHref).toBe('/dashboard/resume-builder');
  });
});
