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
      },
    });

    expect(output).toContain('saved-jobs-live-advisor-success');
    expect(output).toContain('Partial evidence');
    expect(output).toContain('Blocking Issues');
    expect(output).toContain('profile.goals.targetSeries');
    expect(output).toContain('Explainability metadata');
    expect(output).toContain('qualification-v1');
    expect(output).toContain('decision-v1');
  });
});
