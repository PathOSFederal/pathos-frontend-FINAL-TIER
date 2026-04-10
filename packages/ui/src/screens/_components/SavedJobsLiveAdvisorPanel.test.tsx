/**
 * ============================================================================
 * SAVED JOBS LIVE ADVISOR PANEL TESTS
 * ============================================================================
 *
 * PURPOSE:
 * Verify the honest UI states used by the live Saved Jobs advisor flow. These
 * tests are intentionally structural so they stay fast and deterministic.
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  buildLiveEvaluationPathAdvisorSummary,
  SavedJobsLiveAdvisorPanel,
  type SavedJobsLiveEvaluationState,
} from './SavedJobsLiveAdvisorPanel';

function renderPanel(state: SavedJobsLiveEvaluationState): string {
  return renderToString(
    <SavedJobsLiveAdvisorPanel
      jobTitle="Program Analyst"
      state={state}
      onRetry={function () {
        /* noop */
      }}
    />
  );
}

describe('SavedJobsLiveAdvisorPanel', function () {
  it('renders the loading state honestly', function () {
    const output = renderPanel({
      status: 'loading',
      errorMessage: null,
      evaluation: null,
    });

    expect(output).toContain('saved-jobs-live-advisor-loading');
    expect(output).toContain('Loading live advisor evaluation');
  });

  it('renders the error state honestly', function () {
    const output = renderPanel({
      status: 'error',
      errorMessage: 'Backend configuration is missing.',
      evaluation: null,
    });

    expect(output).toContain('saved-jobs-live-advisor-error');
    expect(output).toContain('Live advisor evaluation is unavailable');
    expect(output).toContain('Backend configuration is missing.');
  });

  it('renders the empty state honestly', function () {
    const output = renderPanel({
      status: 'empty',
      errorMessage: null,
      evaluation: null,
    });

    expect(output).toContain('saved-jobs-live-advisor-empty');
    expect(output).toContain('No live advisor output was returned');
  });

  it('renders decision, warnings, missing evidence, and provenance fields', function () {
    const output = renderPanel({
      status: 'success',
      errorMessage: null,
      evaluation: {
        recommendation: 'consider',
        decisionBand: 'caution',
        confidenceBand: 'medium',
        overallScore: 74,
        reasons: [
          {
            code: 'ROLE_ALIGNMENT',
            ruleId: 'role_alignment_positive',
            basis: 'known',
            text: 'Role alignment is strong enough to review further.',
            severity: 'info',
            suggestion: 'Compare the duties to your resume.',
            importance: 'high',
            evidenceRefs: [
              {
                label: 'profile.goals.targetSeries',
                sourceCategory: 'profile',
                factStatus: 'known',
              },
            ],
          },
        ],
        gaps: [],
        warnings: [
          {
            code: 'LOW_CONFIDENCE',
            ruleId: 'confidence_medium',
            basis: 'inferred',
            text: 'Confidence is not high because profile evidence is incomplete.',
            severity: 'warning',
            suggestion: 'Review missing profile signals.',
            importance: 'medium',
            evidenceRefs: [
              {
                label: 'profile.skills',
                sourceCategory: 'missing',
                factStatus: 'missing',
              },
            ],
          },
        ],
        missingEvidence: [
          {
            code: 'MISSING_SKILLS',
            ruleId: 'missing_skill_signal',
            basis: 'missing',
            text: 'No skills evidence was provided.',
            severity: 'warning',
            suggestion: 'Add skills to improve this evaluation.',
            importance: 'medium',
            evidenceRefs: [
              {
                label: 'profile.skills',
                sourceCategory: 'missing',
                factStatus: 'missing',
              },
            ],
          },
        ],
        nextActions: [
          {
            code: 'ADD_SKILLS',
            action: 'Add skills before using this as a strong-fit decision.',
            priority: 1,
          },
        ],
        applicationDecision: {
          decisionBand: 'consider',
          priorityLevel: 'medium',
          alertImportance: 'medium',
          rationaleSummary:
            'There is enough signal to review the role closely, but evidence is partial.',
          blockingIssues: [
            {
              code: 'NO_RESUME',
              ruleId: 'resume_missing',
              sourceType: 'profile',
              severity: 'warning',
              text: 'No resume evidence is linked.',
              evidenceRefs: [
                {
                  label: 'profile.resume',
                  sourceCategory: 'missing',
                  factStatus: 'missing',
                },
              ],
            },
          ],
          recommendedNextActions: [
            {
              code: 'REFRESH_PROFILE',
              action: 'Refresh profile evidence before applying.',
              priority: 1,
            },
          ],
          decisionRuleIds: ['decision_consider_partial'],
          decisionVersion: 'decision-v1',
        },
        explainabilityVersion: 'explainability-v1',
        engineVersion: 'qualification-v1',
        jobMatchProjection: {
          overallScore: 74,
          confidenceBand: 'medium',
          blockerSeverity: 'medium',
          explanationSummary: 'Match projection is grounded in canonical user context and job evidence.',
          dimensions: [
            {
              dimensionId: 'qualification_alignment',
              label: 'Qualification alignment',
              score: 74,
              status: 'building',
              explanation: 'Grounded in the backend job-evaluation score against canonical user evidence.',
            },
          ],
          nextActions: ['Refresh profile evidence before applying.'],
          blockers: ['No resume evidence is linked.'],
          warnings: ['Confidence is not high because profile evidence is incomplete.'],
        },
        screenIntelligence: {
          screen: 'saved_jobs',
          pathadvisorMode: 'decision_risk',
          context: {
            targetRoleClusters: ['Program analyst'],
            preferredLocations: ['Washington, DC'],
            readinessState: 'Draft resume',
            fitLanes: ['Program analyst lane'],
            blockers: ['No resume evidence is linked.'],
            topMissingItems: ['Resume evidence'],
            nextBestActions: ['Refresh profile evidence before applying.'],
            activeThreads: ['Resume readiness'],
            profileCompleteness: 74,
            freshnessBand: 'fresh',
            confidenceBand: 'medium',
            recentMeaningfulChanges: [],
            activitySignals: [],
            updatedAt: '2026-04-09T12:00:00Z',
          },
          summary:
            'Saved Jobs is using the same canonical match projection with decision-first framing.',
          nextBestAction: {
            actionId: 'improve_before_apply',
            title: 'Improve before applying',
            description: 'Saved Jobs should shift from consideration to blocker removal for this role.',
            ctaLabel: 'Improve readiness first',
            ctaHref: '/dashboard/resume-builder',
            reason: 'The canonical match projection still shows heavy blocker pressure.',
          },
          jobMatchProjection: {
            overallScore: 74,
            confidenceBand: 'medium',
            blockerSeverity: 'medium',
            explanationSummary: 'Match projection is grounded in canonical user context and job evidence.',
            dimensions: [
              {
                dimensionId: 'qualification_alignment',
                label: 'Qualification alignment',
                score: 74,
                status: 'building',
                explanation: 'Grounded in the backend job-evaluation score against canonical user evidence.',
              },
            ],
            nextActions: ['Refresh profile evidence before applying.'],
            blockers: ['No resume evidence is linked.'],
            warnings: ['Confidence is not high because profile evidence is incomplete.'],
          },
          decisionGuidance: ['Improve before applying'],
        },
      },
    });

    expect(output).toContain('saved-jobs-live-advisor-success');
    expect(output).toContain('Match for this job');
    expect(output).toContain('Building match');
    expect(output).toContain('Match breakdown');
    expect(output).toContain('Qualification alignment');
    expect(output).toContain('Partial evidence');
    expect(output).toContain('Blocking Issues');
    expect(output).toContain('profile.goals.targetSeries');
    expect(output).toContain('Explainability metadata');
    expect(output).toContain('qualification-v1');
    expect(output).toContain('decision-v1');
  });

  it('builds a bounded PathAdvisor summary from live evaluation state', function () {
    const summary = buildLiveEvaluationPathAdvisorSummary({
      recommendation: 'consider',
      decisionBand: 'caution',
      confidenceBand: 'medium',
      overallScore: 74,
      reasons: [
        {
          code: 'ROLE_ALIGNMENT',
          ruleId: 'role_alignment_positive',
          basis: 'known',
          text: 'Role alignment is strong enough to review further.',
          severity: 'info',
          suggestion: 'Compare the duties to your resume.',
          importance: 'high',
          evidenceRefs: [],
        },
      ],
      gaps: [],
      warnings: [],
      missingEvidence: [
        {
          code: 'MISSING_SKILLS',
          ruleId: 'missing_skill_signal',
          basis: 'missing',
          text: 'No skills evidence was provided.',
          severity: 'warning',
          suggestion: 'Add skills to improve this evaluation.',
          importance: 'medium',
          evidenceRefs: [],
        },
      ],
      nextActions: [
        {
          code: 'ADD_SKILLS',
          action: 'Add skills before using this as a strong-fit decision.',
          priority: 1,
        },
      ],
      applicationDecision: {
        decisionBand: 'consider',
        priorityLevel: 'medium',
        alertImportance: 'medium',
        rationaleSummary:
          'There is enough signal to review the role closely, but evidence is partial.',
        blockingIssues: [
          {
            code: 'NO_RESUME',
            ruleId: 'resume_missing',
            sourceType: 'profile',
            severity: 'warning',
            text: 'No resume evidence is linked.',
            evidenceRefs: [],
          },
        ],
        recommendedNextActions: [
          {
            code: 'REFRESH_PROFILE',
            action: 'Refresh profile evidence before applying.',
            priority: 1,
          },
        ],
        decisionRuleIds: ['decision_consider_partial'],
        decisionVersion: 'decision-v1',
      },
      explainabilityVersion: 'explainability-v1',
      engineVersion: 'qualification-v1',
      canonicalUserContext: null,
      jobMatchProjection: {
        overallScore: 74,
        confidenceBand: 'medium',
        blockerSeverity: 'medium',
        explanationSummary: 'Match projection is grounded in canonical user context and job evidence.',
        dimensions: [
          {
            dimensionId: 'qualification_alignment',
            label: 'Qualification alignment',
            score: 74,
            status: 'building',
            explanation: 'Grounded in the backend job-evaluation score against canonical user evidence.',
          },
        ],
        nextActions: ['Refresh profile evidence before applying.'],
        blockers: ['No resume evidence is linked.'],
        warnings: ['Confidence is not high because profile evidence is incomplete.'],
      },
      screenIntelligence: null,
    });

    expect(summary.summaryLines).toEqual([
      'Recommendation: consider',
      'Overall score: 74 (caution, confidence medium)',
      'Application decision: consider — There is enough signal to review the role closely, but evidence is partial.',
    ]);
    expect(summary.keyReasons).toEqual([
      'Role alignment is strong enough to review further.',
    ]);
    expect(summary.missingEvidence).toEqual([
      'No skills evidence was provided.',
      'No resume evidence is linked.',
    ]);
    expect(summary.nextActions).toEqual([
      'Refresh profile evidence before applying.',
      'Add skills before using this as a strong-fit decision.',
    ]);
  });
});
