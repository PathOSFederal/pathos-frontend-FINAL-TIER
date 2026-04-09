import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  buildResumeRewriteLoadingLabel,
  ResumeRewritePanel,
  sliceResumeRewriteCandidateText,
} from './ResumeRewritePanel';

describe('ResumeRewritePanel', function () {
  it('keeps loading-label frames bounded and readable', function () {
    expect(buildResumeRewriteLoadingLabel(0)).toBe('Rewriting.');
    expect(buildResumeRewriteLoadingLabel(1)).toBe('Rewriting..');
    expect(buildResumeRewriteLoadingLabel(2)).toBe('Rewriting...');
    expect(buildResumeRewriteLoadingLabel(3)).toBe('Rewriting.');
  });

  it('reveals candidate text progressively without overshooting the final text', function () {
    expect(sliceResumeRewriteCandidateText('Program Analyst', 0)).toBe('');
    expect(sliceResumeRewriteCandidateText('Program Analyst', 7)).toBe('Program');
    expect(sliceResumeRewriteCandidateText('Program Analyst', 50)).toBe('Program Analyst');
  });

  it('opens immediately with original text and loading state before candidates return', function () {
    const output = renderToString(
      <ResumeRewritePanel
        rewrite={{
          status: 'loading',
          request: {
            rewrite_request_id: 'rewrite-loading-1',
            resume: {
              resume_id: 'resume-1',
              variant_id: 'variant-1',
              revision_id: 'revision-1',
              snapshot_id: 'snapshot-1',
              diagnostics_id: 'diag-1',
            },
            target: {
              section_id: 'summary',
              bullet_id: null,
              original_text: 'Program analyst with reporting support experience.',
            },
            grounding: {
              issue_code: 'SUMMARY_MISSING_TARGET_ALIGNMENT',
              recommendation_code: 'ALIGN_SUMMARY_TO_TARGET',
              explanation_title: 'Align the summary to the target role',
              explanation_detail: 'The summary does not reflect the target role clearly.',
              action_hint: 'Make the role fit visible in the opening lines.',
              target_role: 'Program Analyst',
            },
          },
          candidates: [],
          errorMessage: null,
          appliedCandidateId: null,
        }}
        onApplyCandidate={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(output).toContain('AI rewrite assistance');
    expect(output).toContain('Original text');
    expect(output).toContain('Program analyst with reporting support experience.');
    expect(output).toContain('Generating rewrite options');
  });

  it('renders bounded candidate review content when candidates are ready', function () {
    const output = renderToString(
      <ResumeRewritePanel
        rewrite={{
          status: 'ready',
          request: {
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
          },
          candidates: [
            {
              candidate_id: 'candidate-1',
              label: 'Outcome-first option',
              text: 'Tracked implementation milestones across three teams and cut reporting lag by 25%.',
              rationale: 'Leads with scope and result.',
            },
          ],
          errorMessage: null,
          appliedCandidateId: null,
        }}
        onApplyCandidate={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(output).toContain('AI rewrite assistance');
    expect(output).toContain('Original text');
    expect(output).toContain('Tracked implementation milestones.');
    expect(output).toContain('Outcome-first option');
    expect(output).toContain('Apply this rewrite');
  });

  it('renders an honest unavailable state when the rewrite service fails', function () {
    const output = renderToString(
      <ResumeRewritePanel
        rewrite={{
          status: 'unavailable',
          request: {
            rewrite_request_id: 'rewrite-1',
            resume: {
              resume_id: 'resume-1',
              variant_id: 'variant-1',
              revision_id: 'revision-1',
              snapshot_id: 'snapshot-1',
              diagnostics_id: 'diag-1',
            },
            target: {
              section_id: 'summary',
              bullet_id: null,
              original_text: 'Program support specialist with reporting experience.',
            },
            grounding: {
              issue_code: 'SUMMARY_MISSING_TARGET_ALIGNMENT',
              recommendation_code: 'ALIGN_SUMMARY_TO_TARGET',
              explanation_title: null,
              explanation_detail: null,
              action_hint: null,
              target_role: 'Program Analyst',
            },
          },
          candidates: [],
          errorMessage: 'The rewrite assistance service is unavailable right now.',
          appliedCandidateId: null,
        }}
        onApplyCandidate={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(output).toContain('Unavailable');
    expect(output).toContain('The rewrite assistance service is unavailable right now.');
  });

  it('renders an honest empty state when the backend returns no candidates', function () {
    const output = renderToString(
      <ResumeRewritePanel
        rewrite={{
          status: 'ready',
          request: {
            rewrite_request_id: 'rewrite-empty-1',
            resume: {
              resume_id: 'resume-1',
              variant_id: 'variant-1',
              revision_id: 'revision-1',
              snapshot_id: 'snapshot-1',
              diagnostics_id: 'diag-1',
            },
            target: {
              section_id: 'skills',
              bullet_id: null,
              original_text: 'Communication, teamwork',
            },
            grounding: {
              issue_code: 'SKILLS_TOO_GENERIC',
              recommendation_code: 'EXPAND_RELEVANT_SKILLS',
              explanation_title: null,
              explanation_detail: null,
              action_hint: null,
              target_role: 'Program Analyst',
            },
          },
          candidates: [],
          errorMessage: null,
          appliedCandidateId: null,
        }}
        onApplyCandidate={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(output).toContain('did not receive any bounded rewrite candidates');
  });
});
