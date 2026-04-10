import { describe, expect, it } from 'vitest';
import type { ResumeDraftSummary } from '../stores/resumeWorkspaceStore';
import type { ResumeDiagnosticsEvaluateResponse } from './resumeDiagnostics';
import {
  buildResumePathAdvisorContextEntry,
  buildResumePathAdvisorSelectionPayload,
} from './pathAdvisorResumeContext';

function buildSummary(): ResumeDraftSummary {
  return {
    id: 'resume-master-seed',
    variantId: 'resume-master-seed',
    name: 'Master Resume',
    mode: 'master',
    status: 'needs-review',
    updatedAt: '2026-04-09T10:00:00Z',
    targetContext: {
      targetRoleTitle: 'Program Analyst',
      seriesGrade: 'GS-12',
      agencyDomain: 'HHS',
      jobAnnouncementText: '',
      plainLanguageGoal: 'Federal program analyst role',
      linkedJobId: null,
    },
    linkedToResumeId: null,
    sourceVariantId: null,
    currentRevisionId: 'revision-1',
    latestSnapshotId: 'snapshot-1',
  };
}

function buildDiagnosticsResponse(): ResumeDiagnosticsEvaluateResponse {
  return {
    response_state: 'evaluated',
    diagnostics_id: 'diag-1',
    resume_id: 'resume-master-seed',
    revision_id: 'revision-1',
    scope: {
      evaluation_mode: 'full_document',
      evaluated_section_ids: ['summary', 'experience', 'skills'],
    },
    target_context: {
      mode: 'role',
      target_role: 'Program Analyst',
      canonical_job_id: null,
    },
    overall: {
      readiness_band: 'workable',
      score: 72,
      summary: 'The draft is workable but still needs clearer federal evidence.',
    },
    category_scores: [],
    issues: [],
    recommendations: [
      {
        code: 'ADD_RESULT_METRIC',
        priority: 1,
        title: 'Add quantified outcomes',
        detail: 'Show the impact of your experience bullets.',
        target_refs: [
          {
            section_id: 'experience',
            bullet_id: 'exp-1-bullet-1',
          },
        ],
      },
    ],
    warnings: [],
    missing_evidence: [
      {
        code: 'MISSING_DATES',
        text: 'Employment dates are still missing from experience history.',
        target_refs: [
          {
            section_id: 'experience',
            bullet_id: null,
          },
        ],
      },
    ],
    explanations: {
      overall_summary: {
        headline: 'Backend review found a workable draft.',
        detail: 'The draft has usable material but still needs clearer evidence.',
        top_priority: 'Clarify the strongest accomplishment in the experience section.',
      },
      key_takeaways: [
        {
          takeaway_id: 'takeaway-1',
          title: 'Clarify the strongest accomplishment',
          detail: 'The draft needs one stronger accomplishment line.',
          target_refs: [
            {
              section_id: 'experience',
              bullet_id: null,
            },
          ],
        },
      ],
      section_explanations: [
        {
          section_id: 'experience',
          title: 'Experience needs stronger evidence',
          what_is_wrong: 'The bullets are still responsibility-heavy.',
          why_it_matters: 'Federal reviewers need scope and outcome evidence.',
          what_to_do: 'Add quantified outcome language to the strongest bullet.',
          target_refs: [
            {
              section_id: 'experience',
              bullet_id: null,
            },
          ],
        },
      ],
      recommendation_explanations: [
        {
          code: 'ADD_RESULT_METRIC',
          title: 'Add quantified outcomes',
          short_explanation: 'Metrics make the strongest bullet easier to trust.',
          action_hint: 'Update one experience bullet with measurable impact.',
          target_refs: [
            {
              section_id: 'experience',
              bullet_id: null,
            },
          ],
        },
      ],
      warning_explanations: [
        {
          code: 'MISSING_DATES',
          title: 'Employment dates are missing',
          detail: 'Reviewers still need dated experience history.',
        },
      ],
    },
    meta: {
      engine_version: 'resume-engine-v1',
      ruleset_version: 'rules-v1',
      explainability_version: 'exp-v1',
      knowledge_pack_version: 'career-pack-v1',
      input_hash: 'input-hash-1',
    },
  };
}

describe('pathAdvisorResumeContext', function () {
  it('builds a bounded resume selection payload for the workspace context log', function () {
    const payload = buildResumePathAdvisorSelectionPayload({
      view: 'builder',
      summary: buildSummary(),
    });

    expect(payload).toEqual({
      title: 'Selected resume: Master Resume',
      subtitle: 'Master resume • Program Analyst',
      lines: [
        'Current view: Resume builder',
        'Mode: Master resume',
        'Resume status: Needs review',
        'Target role: Program Analyst',
      ],
    });
  });

  it('builds a bounded builder context entry from authoritative diagnostics fields', function () {
    const diagnosticsResponse = buildDiagnosticsResponse();
    const activeSectionExplanation =
      diagnosticsResponse.explanations !== null &&
      diagnosticsResponse.explanations !== undefined &&
      Array.isArray(diagnosticsResponse.explanations.section_explanations)
        ? diagnosticsResponse.explanations.section_explanations[0]
        : null;

    const payload = buildResumePathAdvisorContextEntry({
      view: 'builder',
      summary: buildSummary(),
      diagnosticsStatus: 'evaluated',
      diagnosticsResponse: diagnosticsResponse,
      activeSection: 'experience',
      activeSectionExplanation: activeSectionExplanation,
      selectedSnapshotId: 'snapshot-1',
      snapshotEvaluatedAt: '2026-04-09T10:30:00Z',
    });

    expect(payload.title).toBe('Resume workspace: Master Resume');
    expect(payload.subtitle).toBe('Master resume • Program Analyst');
    expect(payload.dedupeKey).toContain('builder:resume-master-seed:revision-1');
    expect(payload.sections).toEqual([
      {
        title: 'Workspace state',
        lines: [
          'Current view: Resume builder',
          'Resume status: Needs review',
          'Active section: Experience',
        ],
      },
      {
        title: 'Diagnostics state',
        lines: [
          'Readiness: Workable',
          'Response state: evaluated',
          'Snapshot: snapshot-1',
          'Evaluated at: 2026-04-09T10:30:00Z',
        ],
      },
      {
        title: 'PathAdvisor summary',
        lines: [
          'Backend review found a workable draft.',
          'The draft has usable material but still needs clearer evidence.',
          'Clarify the strongest accomplishment in the experience section.',
        ],
      },
      {
        title: 'Focused guidance',
        lines: [
          'Experience needs stronger evidence',
          'Federal reviewers need scope and outcome evidence.',
          'Add quantified outcome language to the strongest bullet.',
        ],
      },
      {
        title: 'Key takeaways',
        bullets: ['Clarify the strongest accomplishment'],
      },
      {
        title: 'Warnings or missing evidence',
        bullets: ['Employment dates are missing'],
      },
    ]);
  });
});
