import { describe, expect, it } from 'vitest';
import { createDefaultDraft } from '@pathos/core';
import {
  applyResumeRewriteCandidateToDraft,
  buildResumeRewriteRequest,
  findMatchingDiagnosticsRecommendationForExplanation,
  getResumeRewriteEligibility,
  listResumeSectionRewriteActions,
  resolveResumeRewriteTarget,
  type ResumeRewriteRequest,
} from './resumeRewrite';
import type {
  ResumeDiagnosticsEvaluateResponse,
} from './resumeDiagnostics';
import type {
  ResumeDiagnosticsSnapshot,
  ResumeDraftSummary,
} from '../stores/resumeWorkspaceStore';

function buildSummary(): ResumeDraftSummary {
  return {
    id: 'resume-1',
    variantId: 'variant-1',
    name: 'Program Analyst Variant',
    mode: 'tailored',
    status: 'needs-review',
    updatedAt: '2026-04-08T18:00:00.000Z',
    targetContext: {
      targetRoleTitle: 'Program Analyst',
      seriesGrade: '',
      agencyDomain: '',
      jobAnnouncementText: '',
      plainLanguageGoal: '',
      linkedJobId: null,
    },
    linkedToResumeId: 'resume-master-seed',
    sourceVariantId: 'resume-master-seed',
    currentRevisionId: 'revision-current',
    latestSnapshotId: 'snapshot-current',
  };
}

function buildDraft() {
  const draft = createDefaultDraft();
  draft.summary = 'Program support specialist with reporting experience.';
  draft.experience.push({
    id: 'exp-1',
    jobTitle: 'Analyst',
    employer: 'Agency',
    location: 'DC',
    startDate: '',
    endDate: '',
    hoursPerWeek: '',
    grade: '',
    duties: 'Tracked implementation milestones.\nPrepared weekly leadership summaries.',
  });
  draft.skills.push({
    id: 'skill-1',
    name: 'Analysis',
  });
  draft.skills.push({
    id: 'skill-2',
    name: 'Reporting',
  });
  return draft;
}

function buildSnapshot(): ResumeDiagnosticsSnapshot {
  const response = buildDiagnosticsResponse();
  return {
    snapshotId: 'snapshot-current',
    variantId: 'variant-1',
    revisionId: 'revision-current',
    diagnosticsId: 'diag-1',
    inputHash: 'hash-1',
    responseState: 'evaluated',
    readinessBand: response.overall.readiness_band,
    overallSummary: response.overall.summary,
    response: response,
    evaluatedAt: '2026-04-08T18:00:00.000Z',
    meta: {
      engineVersion: 'engine-1',
      rulesetVersion: 'rules-1',
      explainabilityVersion: 'exp-1',
      knowledgePackVersion: null,
    },
  };
}

function buildDiagnosticsResponse(): ResumeDiagnosticsEvaluateResponse {
  return {
    response_state: 'evaluated',
    diagnostics_id: 'diag-1',
    resume_id: 'resume-1',
    revision_id: 'revision-current',
    scope: {
      evaluation_mode: 'full_document',
      evaluated_section_ids: ['summary', 'experience'],
    },
    target_context: {
      mode: 'role',
      target_role: 'Program Analyst',
      canonical_job_id: null,
    },
    overall: {
      readiness_band: 'needs_revision',
      score: 62,
      summary: 'The resume needs stronger outcome evidence.',
    },
    category_scores: [],
    issues: [
      {
        issue_id: 'issue-1',
        code: 'MISSING_QUANTIFIED_OUTCOME',
        category: 'metrics',
        severity: 'high',
        title: 'Missing outcomes',
        detail: 'The bullet lacks measurable results.',
        target_refs: [
          {
            section_id: 'experience',
            bullet_id: 'exp-1-bullet-0',
          },
        ],
        why_it_matters: 'Measurable impact improves trust.',
        evidence_refs: [],
      },
    ],
    recommendations: [
      {
        code: 'REWRITE_FOR_OUTCOME',
        priority: 1,
        title: 'Rewrite the top bullet around the result',
        detail: 'Lead with the outcome instead of the duty.',
        target_refs: [
          {
            section_id: 'experience',
            bullet_id: 'exp-1-bullet-0',
          },
        ],
      },
    ],
    warnings: [],
    missing_evidence: [],
    explanations: {
      recommendation_explanations: [
        {
          code: 'REWRITE_FOR_OUTCOME',
          title: 'Rewrite the top bullet around the result',
          short_explanation: 'This bullet is responsibility-heavy.',
          action_hint: 'Lead with an outcome and then show the action.',
          target_refs: [
            {
              section_id: 'experience',
              bullet_id: 'exp-1-bullet-0',
            },
          ],
        },
      ],
    },
    meta: {
      engine_version: 'engine-1',
      ruleset_version: 'rules-1',
      explainability_version: 'exp-1',
      knowledge_pack_version: null,
      input_hash: 'hash-1',
    },
  };
}

describe('resumeRewrite', function () {
  it('blocks rewrite launches when diagnostics are stale', function () {
    const summary = buildSummary();
    const latestSnapshot = buildSnapshot();
    latestSnapshot.revisionId = 'revision-old';

    const eligibility = getResumeRewriteEligibility(
      summary,
      latestSnapshot,
      latestSnapshot,
      buildDiagnosticsResponse()
    );

    expect(eligibility.canRewrite).toBe(false);
    expect(eligibility.reason).toContain('Re-run diagnostics');
  });

  it('resolves summary, skills, and experience targets from current draft text', function () {
    const draft = buildDraft();

    expect(
      resolveResumeRewriteTarget(draft, {
        section_id: 'summary',
        bullet_id: null,
      })
    ).toEqual({
      sectionId: 'summary',
      bulletId: null,
      originalText: 'Program support specialist with reporting experience.',
    });

    expect(
      resolveResumeRewriteTarget(draft, {
        section_id: 'skills',
        bullet_id: 'skill-2',
      })
    ).toEqual({
      sectionId: 'skills',
      bulletId: 'skill-2',
      originalText: 'Reporting',
    });

    expect(
      resolveResumeRewriteTarget(draft, {
        section_id: 'experience',
        bullet_id: 'exp-1-bullet-0',
      })
    ).toEqual({
      sectionId: 'experience',
      bulletId: 'exp-1-bullet-0',
      originalText: 'Tracked implementation milestones.',
    });
  });

  it('builds a bounded rewrite request grounded in recommendation and issue codes', function () {
    const summary = buildSummary();
    const draft = buildDraft();
    const latestSnapshot = buildSnapshot();
    const diagnosticsResponse = buildDiagnosticsResponse();

    const request = buildResumeRewriteRequest({
      summary: summary,
      draft: draft,
      latestSnapshot: latestSnapshot,
      selectedSnapshot: latestSnapshot,
      diagnosticsResponse: diagnosticsResponse,
      recommendation: diagnosticsResponse.recommendations[0],
      explanation:
        diagnosticsResponse.explanations !== null &&
        diagnosticsResponse.explanations !== undefined &&
        Array.isArray(diagnosticsResponse.explanations.recommendation_explanations)
          ? diagnosticsResponse.explanations.recommendation_explanations[0]
          : null,
    });

    expect(request !== null).toBe(true);
    expect(request !== null && request.grounding.issue_code).toBe('MISSING_QUANTIFIED_OUTCOME');
    expect(request !== null && request.grounding.recommendation_code).toBe('REWRITE_FOR_OUTCOME');
    expect(request !== null && request.target.original_text).toBe('Tracked implementation milestones.');
  });

  it('matches recommendation explanations by code and target refs instead of code alone', function () {
    const diagnosticsResponse = buildDiagnosticsResponse();
    diagnosticsResponse.recommendations.push({
      code: 'REWRITE_FOR_OUTCOME',
      priority: 2,
      title: 'Rewrite the second bullet around the result',
      detail: 'Use the second bullet when that is the weaker line.',
      target_refs: [
        {
          section_id: 'experience',
          bullet_id: 'exp-1-bullet-1',
        },
      ],
    });
    if (
      diagnosticsResponse.explanations !== null &&
      diagnosticsResponse.explanations !== undefined &&
      Array.isArray(diagnosticsResponse.explanations.recommendation_explanations)
    ) {
      diagnosticsResponse.explanations.recommendation_explanations.push({
        code: 'REWRITE_FOR_OUTCOME',
        title: 'Rewrite the second bullet around the result',
        short_explanation: 'This second bullet still reads like a duty.',
        action_hint: 'Revise the second bullet, not the first one.',
        target_refs: [
          {
            section_id: 'experience',
            bullet_id: 'exp-1-bullet-1',
          },
        ],
      });
    }

    const matchedRecommendation =
      diagnosticsResponse.explanations !== null &&
      diagnosticsResponse.explanations !== undefined &&
      Array.isArray(diagnosticsResponse.explanations.recommendation_explanations)
        ? findMatchingDiagnosticsRecommendationForExplanation(
            diagnosticsResponse.recommendations,
            diagnosticsResponse.explanations.recommendation_explanations[1]
          )
        : null;

    expect(matchedRecommendation !== null && matchedRecommendation.target_refs[0].bullet_id).toBe('exp-1-bullet-1');
  });

  it('lists builder-native rewrite actions for a specific section only', function () {
    const actions = listResumeSectionRewriteActions(
      {
        summary: buildSummary(),
        draft: buildDraft(),
        latestSnapshot: buildSnapshot(),
        selectedSnapshot: buildSnapshot(),
        diagnosticsResponse: buildDiagnosticsResponse(),
        recommendation: null,
        explanation: null,
      },
      'experience'
    );

    expect(actions.length).toBe(1);
    expect(actions[0].request.target.section_id).toBe('experience');
    expect(actions[0].request.target.original_text).toBe('Tracked implementation milestones.');
  });

  it('applies an approved experience bullet candidate without touching unrelated lines', function () {
    const draft = buildDraft();
    const request: ResumeRewriteRequest = {
      rewrite_request_id: 'rewrite-1',
      resume: {
        resume_id: 'resume-1',
        variant_id: 'variant-1',
        revision_id: 'revision-current',
        snapshot_id: 'snapshot-current',
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
        explanation_title: null,
        explanation_detail: null,
        action_hint: null,
        target_role: 'Program Analyst',
      },
    };

    const result = applyResumeRewriteCandidateToDraft(draft, request, {
      candidate_id: 'candidate-1',
      label: 'Outcome-first option',
      text: 'Tracked implementation milestones across three teams and cut status-report lag by 25%.',
      rationale: null,
    });

    expect(result.appliedSectionId).toBe('experience');
    expect(result.nextDraft !== null).toBe(true);
    expect(result.nextDraft !== null && result.nextDraft.experience[0].duties).toContain(
      'Tracked implementation milestones across three teams and cut status-report lag by 25%.'
    );
    expect(result.nextDraft !== null && result.nextDraft.experience[0].duties).toContain(
      'Prepared weekly leadership summaries.'
    );
  });
});
