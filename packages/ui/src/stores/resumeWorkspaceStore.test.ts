import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultDraft } from '@pathos/core';
import type { ResumeDiagnosticsEvaluateResponse } from '../resume-workspace/resumeDiagnostics';
import {
  RESUME_WORKSPACE_STORAGE_KEY,
  buildResumeDiagnosticsSnapshot,
  buildPlaceholderReviewState,
  deriveSectionCompletion,
  getDiagnosticsSnapshotById,
  getDiagnosticsSnapshotsForVariant,
  getLatestDiagnosticsSnapshotForVariant,
  getRevisionContentSnapshotById,
  getRevisionContentSnapshotsForVariant,
  useResumeWorkspaceStore,
} from './resumeWorkspaceStore';

const originalFetch = globalThis.fetch;

function buildDiagnosticsResponse(responseState: 'evaluated' | 'insufficient_input' | 'unsupported_context'): ResumeDiagnosticsEvaluateResponse {
  return {
    response_state: responseState,
    diagnostics_id: 'diag-123',
    resume_id: 'resume-master-seed',
    revision_id: '2026-04-08T13:00:00.000Z',
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
      readiness_band: responseState === 'evaluated' ? 'workable' : 'insufficient_evidence',
      score: responseState === 'evaluated' ? 72 : null,
      summary: responseState === 'unsupported_context'
        ? 'Unsupported context summary.'
        : responseState === 'insufficient_input'
          ? 'Need more content before the backend can evaluate deeply.'
          : 'Backend-owned diagnostics summary.',
    },
    category_scores: [],
    issues: [
      {
        issue_id: 'issue-1',
        code: 'MISSING_QUANTIFIED_OUTCOME',
        category: 'metrics',
        severity: 'high',
        title: 'Add measurable outcome evidence',
        detail: 'The bullet describes work performed but does not show the result.',
        target_refs: [
          {
            section_id: 'experience',
            bullet_id: 'exp-seed-1-bullet-0',
          },
        ],
        why_it_matters: 'Outcome evidence makes the bullet easier to trust.',
        evidence_refs: [],
      },
    ],
    recommendations: [
      {
        code: 'REWRITE_FOR_OUTCOME',
        priority: 1,
        title: 'Rewrite the top experience bullets',
        detail: 'Rewrite the bullet around the outcome, not just the responsibility.',
        target_refs: [
          {
            section_id: 'experience',
            bullet_id: 'exp-seed-1-bullet-0',
          },
        ],
      },
    ],
    warnings: [],
    missing_evidence: [],
    explanations: {
      overall_summary: {
        headline: 'Resume is workable, but the experience section needs sharper evidence.',
        detail: 'PathAdvisor is using backend explanation text instead of raw diagnostics prose.',
        top_priority: 'Start by tightening the experience bullets around measurable outcomes.',
      },
      key_takeaways: [
        {
          takeaway_id: 'takeaway-1',
          title: 'Clarify the main value of your experience section',
          detail: 'The strongest backend signal points to clearer impact framing in experience bullets.',
          target_refs: [
            {
              section_id: 'experience',
              bullet_id: 'exp-seed-1-bullet-0',
            },
          ],
        },
      ],
      section_explanations: [
        {
          section_id: 'experience',
          title: 'Experience needs clearer evidence',
          what_is_wrong: 'Several bullets describe responsibilities more than outcomes.',
          why_it_matters: 'The target role needs clearer proof of scope and results.',
          what_to_do: 'Rewrite the top bullets to show measurable outcomes and impact.',
          target_refs: [
            {
              section_id: 'experience',
              bullet_id: 'exp-seed-1-bullet-0',
            },
          ],
        },
      ],
      recommendation_explanations: [
        {
          code: 'REWRITE_FOR_OUTCOME',
          title: 'Rewrite the top experience bullets',
          short_explanation: 'This is the fastest way to improve readiness for the current target.',
          action_hint: 'Open experience and replace responsibility-heavy lines with results.',
          target_refs: [
            {
              section_id: 'experience',
              bullet_id: 'exp-seed-1-bullet-0',
            },
          ],
        },
      ],
      warning_explanations: [
        {
          code: 'warning-1',
          title: 'Target context is still thin',
          detail: 'A fuller announcement or target role brief would sharpen later guidance.',
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

afterEach(function () {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('resumeWorkspaceStore helpers', function () {
  beforeEach(function () {
    localStorage.removeItem(RESUME_WORKSPACE_STORAGE_KEY);
    useResumeWorkspaceStore.getState().hydrate();
  });

  it('derives section completion from deterministic draft content', function () {
    const draft = createDefaultDraft();
    draft.contact.fullName = 'Jordan Ellis';
    draft.contact.email = 'jordan@example.gov';
    draft.contact.phone = '202-555-0184';
    draft.contact.city = 'Washington';
    draft.contact.state = 'DC';
    draft.summary = 'Summary';
    draft.experience.push({
      id: 'exp-1',
      jobTitle: 'Analyst',
      employer: 'Agency',
      location: 'DC',
      startDate: '',
      endDate: '',
      hoursPerWeek: '',
      grade: '',
      duties: 'Built reports.',
    });
    draft.education.push({
      id: 'edu-1',
      institution: 'School',
      degree: '',
      field: '',
      graduationDate: '',
      gpa: '',
    });
    draft.skills.push({ id: 'skill-1', name: 'Analysis' });

    const completion = deriveSectionCompletion(draft);

    expect(completion.contact).toBe(true);
    expect(completion.summary).toBe(true);
    expect(completion.experience).toBe(true);
    expect(completion.education).toBe(true);
    expect(completion.skills).toBe(true);
    expect(completion.review).toBe(true);
  });

  it('builds placeholder review state without fake scoring', function () {
    const draft = createDefaultDraft();
    const review = buildPlaceholderReviewState(draft, {
      targetRoleTitle: '',
      seriesGrade: '',
      agencyDomain: '',
      jobAnnouncementText: '',
      plainLanguageGoal: '',
      linkedJobId: null,
    });

    expect(review.readinessBand).toBe('Not started');
    expect(review.placeholderMessage).toContain('Frontend placeholder review only');
    expect(review.issues.length).toBeGreaterThan(0);
    expect(review.categories.length).toBe(3);
  });
});

describe('resumeWorkspaceStore actions', function () {
  beforeEach(function () {
    localStorage.removeItem(RESUME_WORKSPACE_STORAGE_KEY);
    useResumeWorkspaceStore.getState().hydrate();
  });

  it('creates a new resume from the guided flow and makes it active', function () {
    const store = useResumeWorkspaceStore.getState();
    store.setGoalMode('tailor-to-job');
    store.updateTargetContextField('targetRoleTitle', 'Budget Analyst');
    const newResumeId = store.createResumeFromFlow();
    const nextState = useResumeWorkspaceStore.getState();

    expect(nextState.activeResumeId).toBe(newResumeId);
    expect(nextState.resumes[0].id).toBe(newResumeId);
    expect(nextState.resumes[0].mode).toBe('tailored');
    expect(nextState.resumes[0].variantId).toBe(newResumeId);
    expect(nextState.resumes[0].currentRevisionId.length).toBeGreaterThan(0);
    expect(nextState.resumes[0].latestSnapshotId).toBeNull();
    expect(
      getRevisionContentSnapshotById(
        nextState.revisionContentSnapshots,
        nextState.resumes[0].currentRevisionId
      ) !== null
    ).toBe(true);
  });

  it('duplicates the current draft for another target and clears target role context', function () {
    const duplicateId = useResumeWorkspaceStore.getState().duplicateForAnotherTarget();
    const nextState = useResumeWorkspaceStore.getState();

    expect(duplicateId).not.toBeNull();
    expect(nextState.activeResumeId).toBe(duplicateId);
    if (duplicateId !== null) {
      expect(nextState.resumes[0].id).toBe(duplicateId);
      expect(nextState.resumes[0].targetContext.targetRoleTitle).toBe('');
      expect(nextState.resumes[0].sourceVariantId).toBe('resume-master-seed');
    }
  });

  it('focuses builder sections from diagnostics target refs', function () {
    useResumeWorkspaceStore.getState().focusDiagnosticsTargetRefs([
      {
        section_id: 'experience',
        bullet_id: 'exp-seed-1-bullet-0',
      },
      {
        section_id: 'skills',
        bullet_id: null,
      },
    ]);
    const nextState = useResumeWorkspaceStore.getState();

    expect(nextState.builder.activeSection).toBe('experience');
    expect(nextState.review.highlightedSections).toEqual(['experience', 'skills']);
  });

  it('stores an evaluated backend diagnostics response for the active resume', async function () {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(buildDiagnosticsResponse('evaluated')), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    await useResumeWorkspaceStore.getState().evaluateActiveResumeDiagnostics();
    const nextState = useResumeWorkspaceStore.getState();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(nextState.review.status).toBe('evaluated');
    expect(nextState.review.response !== null && nextState.review.response.diagnostics_id).toBe('diag-123');
    expect(nextState.review.request !== null && nextState.review.request.scope.evaluation_mode).toBe('full_document');
    expect(nextState.resumes[0].latestSnapshotId).not.toBeNull();
    expect(Object.keys(nextState.diagnosticsSnapshots).length).toBe(1);
    const latestSnapshot = getLatestDiagnosticsSnapshotForVariant(
      nextState.diagnosticsSnapshots,
      nextState.resumes[0]
    );
    expect(latestSnapshot !== null && latestSnapshot.diagnosticsId).toBe('diag-123');
    expect(latestSnapshot !== null && latestSnapshot.response.explanations !== null).toBe(true);
    expect(latestSnapshot !== null && latestSnapshot.inputHash).toBe('hash-1');
  });

  it('keeps snapshot history and replaces the latest snapshot reference on re-evaluation', async function () {
    const firstFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(buildDiagnosticsResponse('evaluated')), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );
    globalThis.fetch = firstFetch as typeof globalThis.fetch;
    await useResumeWorkspaceStore.getState().evaluateActiveResumeDiagnostics();
    const firstState = useResumeWorkspaceStore.getState();
    const firstSnapshotId = firstState.resumes[0].latestSnapshotId;

    const secondResponse = buildDiagnosticsResponse('evaluated');
    secondResponse.diagnostics_id = 'diag-456';
    secondResponse.meta.input_hash = 'hash-2';
    const secondFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(secondResponse), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );
    globalThis.fetch = secondFetch as typeof globalThis.fetch;
    await useResumeWorkspaceStore.getState().evaluateActiveResumeDiagnostics();
    const secondState = useResumeWorkspaceStore.getState();

    expect(secondState.resumes[0].latestSnapshotId).not.toBe(firstSnapshotId);
    expect(Object.keys(secondState.diagnosticsSnapshots).length).toBe(2);
    expect(secondState.diagnosticsSnapshotIdsByVariant['resume-master-seed'].length).toBe(2);
    expect(secondState.diagnosticsSnapshotIdsByVariant['resume-master-seed'][0]).toBe(secondState.resumes[0].latestSnapshotId);
  });

  it('stores review snapshot selection and compare state inside the persisted review shell state', async function () {
    const firstResponse = buildDiagnosticsResponse('evaluated');
    firstResponse.diagnostics_id = 'diag-history-1';
    firstResponse.meta.input_hash = 'hash-history-1';
    const secondResponse = buildDiagnosticsResponse('evaluated');
    secondResponse.diagnostics_id = 'diag-history-2';
    secondResponse.meta.input_hash = 'hash-history-2';

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(firstResponse), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(secondResponse), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      ) as typeof globalThis.fetch;

    await useResumeWorkspaceStore.getState().evaluateActiveResumeDiagnostics();
    await useResumeWorkspaceStore.getState().evaluateActiveResumeDiagnostics();

    const stateAfterEvaluations = useResumeWorkspaceStore.getState();
    const variantSnapshots = getDiagnosticsSnapshotsForVariant(
      stateAfterEvaluations.diagnosticsSnapshots,
      stateAfterEvaluations.diagnosticsSnapshotIdsByVariant,
      'resume-master-seed'
    );

    expect(variantSnapshots.length).toBe(2);

    useResumeWorkspaceStore.getState().selectReviewSnapshot(variantSnapshots[1].snapshotId);
    useResumeWorkspaceStore.getState().setCompareSnapshotId(variantSnapshots[0].snapshotId);

    const comparedState = useResumeWorkspaceStore.getState();
    expect(comparedState.review.selectedSnapshotId).toBe(variantSnapshots[1].snapshotId);
    expect(comparedState.review.compareSnapshotId).toBe(variantSnapshots[0].snapshotId);
    expect(comparedState.review.isCompareMode).toBe(true);
    expect(
      getDiagnosticsSnapshotById(
        comparedState.diagnosticsSnapshots,
        comparedState.review.selectedSnapshotId
      ) !== null
    ).toBe(true);

    useResumeWorkspaceStore.getState().clearSnapshotCompare();
    const clearedState = useResumeWorkspaceStore.getState();
    expect(clearedState.review.compareSnapshotId).toBeNull();
    expect(clearedState.review.isCompareMode).toBe(false);
  });

  it('preserves real revision content snapshots when a draft edit creates a new revision', function () {
    const initialState = useResumeWorkspaceStore.getState();
    const initialRevisionId = initialState.resumes[0].currentRevisionId;

    useResumeWorkspaceStore.getState().updateExperienceText(
      'Built reporting templates.\nReduced review time by 20%.'
    );

    const nextState = useResumeWorkspaceStore.getState();
    const nextRevisionId = nextState.resumes[0].currentRevisionId;
    const variantRevisionSnapshots = getRevisionContentSnapshotsForVariant(
      nextState.revisionContentSnapshots,
      nextState.revisionContentIdsByVariant,
      'resume-master-seed'
    );

    expect(nextRevisionId).not.toBe(initialRevisionId);
    expect(variantRevisionSnapshots.length).toBeGreaterThanOrEqual(2);
    expect(
      getRevisionContentSnapshotById(
        nextState.revisionContentSnapshots,
        initialRevisionId
      ) !== null
    ).toBe(true);
    const currentRevisionSnapshot = getRevisionContentSnapshotById(
      nextState.revisionContentSnapshots,
      nextRevisionId
    );
    expect(currentRevisionSnapshot !== null).toBe(true);
    expect(
      currentRevisionSnapshot !== null &&
      currentRevisionSnapshot.draft.experience[0].duties
    ).toContain('Reduced review time by 20%');
  });

  it('preserves the latest saved snapshot while a new diagnostics request is loading', async function () {
    const initialSnapshot = buildResumeDiagnosticsSnapshot(
      'resume-master-seed',
      useResumeWorkspaceStore.getState().resumes[0].currentRevisionId,
      buildDiagnosticsResponse('evaluated'),
      '2026-04-08T15:00:00.000Z'
    );
    useResumeWorkspaceStore.setState(function (state) {
      const nextResumes = state.resumes.slice();
      nextResumes[0] = Object.assign({}, nextResumes[0], {
        latestSnapshotId: initialSnapshot.snapshotId,
      });
      return {
        resumes: nextResumes,
        diagnosticsSnapshots: Object.assign({}, state.diagnosticsSnapshots, {
          [initialSnapshot.snapshotId]: initialSnapshot,
        }),
        diagnosticsSnapshotIdsByVariant: Object.assign({}, state.diagnosticsSnapshotIdsByVariant, {
          'resume-master-seed': [initialSnapshot.snapshotId],
        }),
      };
    });

    let releaseRequest: (() => void) | null = null;
    const pendingFetch = new Promise<Response>(function (resolve) {
      releaseRequest = function () {
        resolve(
          new Response(JSON.stringify(buildDiagnosticsResponse('evaluated')), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          })
        );
      };
    });
    globalThis.fetch = vi.fn().mockReturnValue(pendingFetch) as typeof globalThis.fetch;

    const evaluationPromise = useResumeWorkspaceStore.getState().evaluateActiveResumeDiagnostics();
    const loadingState = useResumeWorkspaceStore.getState();
    expect(loadingState.review.status).toBe('loading');
    expect(loadingState.resumes[0].latestSnapshotId).toBe(initialSnapshot.snapshotId);
    expect(getLatestDiagnosticsSnapshotForVariant(loadingState.diagnosticsSnapshots, loadingState.resumes[0]) !== null).toBe(true);

    const releaseCurrentRequest = releaseRequest as (() => void) | null;
    if (releaseCurrentRequest !== null) {
      releaseCurrentRequest();
    }
    await evaluationPromise;
  });

  it('stores insufficient-input and unsupported-context backend states without inventing local findings', async function () {
    const insufficientFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(buildDiagnosticsResponse('insufficient_input')), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );
    globalThis.fetch = insufficientFetch as typeof globalThis.fetch;

    await useResumeWorkspaceStore.getState().evaluateActiveResumeDiagnostics();
    expect(useResumeWorkspaceStore.getState().review.status).toBe('insufficient_input');

    const unsupportedFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(buildDiagnosticsResponse('unsupported_context')), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );
    globalThis.fetch = unsupportedFetch as typeof globalThis.fetch;

    await useResumeWorkspaceStore.getState().evaluateActiveResumeDiagnostics();
    expect(useResumeWorkspaceStore.getState().review.status).toBe('unsupported_context');
  });

  it('stores an error state when diagnostics fail', async function () {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'The diagnostics request failed.' }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    await useResumeWorkspaceStore.getState().evaluateActiveResumeDiagnostics();
    const nextState = useResumeWorkspaceStore.getState();

    expect(nextState.review.status).toBe('unavailable');
    expect(nextState.review.errorMessage).toBe('The diagnostics request failed.');
  });

  it('requests grounded rewrite candidates and stores them without changing the draft', async function () {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(buildDiagnosticsResponse('evaluated')), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          rewrite_request_id: 'rewrite-1',
          status: 'ready',
          candidates: [
            {
              candidate_id: 'candidate-1',
              label: 'Outcome-first option',
              text: 'Improved program tracking by consolidating milestone reporting into one weekly executive dashboard.',
              rationale: 'Moves the bullet from responsibility to result.',
            },
            {
              candidate_id: 'candidate-2',
              label: 'Stronger scope option',
              text: 'Coordinated program milestones across three teams and delivered leadership reporting that reduced status-prep time by 20%.',
              rationale: 'Adds measurable scale and outcome.',
            },
          ],
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    await useResumeWorkspaceStore.getState().evaluateActiveResumeDiagnostics();
    const stateAfterDiagnostics = useResumeWorkspaceStore.getState();
    const latestSnapshot = getLatestDiagnosticsSnapshotForVariant(
      stateAfterDiagnostics.diagnosticsSnapshots,
      stateAfterDiagnostics.resumes[0]
    );

    expect(latestSnapshot !== null).toBe(true);

    await useResumeWorkspaceStore.getState().requestResumeRewrite({
      rewrite_request_id: 'rewrite-1',
      resume: {
        resume_id: stateAfterDiagnostics.resumes[0].id,
        variant_id: stateAfterDiagnostics.resumes[0].variantId,
        revision_id: stateAfterDiagnostics.resumes[0].currentRevisionId,
        snapshot_id: latestSnapshot !== null ? latestSnapshot.snapshotId : 'missing',
        diagnostics_id: latestSnapshot !== null ? latestSnapshot.diagnosticsId : 'missing',
      },
      target: {
        section_id: 'experience',
        bullet_id: 'exp-seed-1-bullet-0',
        original_text: 'Coordinated cross-functional program tracking for service delivery milestones.',
      },
      grounding: {
        issue_code: 'MISSING_QUANTIFIED_OUTCOME',
        recommendation_code: 'REWRITE_FOR_OUTCOME',
        explanation_title: 'Rewrite the top experience bullets',
        explanation_detail: 'This is the fastest way to improve readiness for the current target.',
        action_hint: 'Open experience and replace responsibility-heavy lines with results.',
        target_role: 'Program Analyst',
      },
    });

    const rewriteState = useResumeWorkspaceStore.getState().rewrite;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(rewriteState.status).toBe('ready');
    expect(rewriteState.candidates.length).toBe(2);
    expect(useResumeWorkspaceStore.getState().resumeDrafts['resume-master-seed'].experience[0].duties).toContain(
      'Coordinated cross-functional program tracking for service delivery milestones.'
    );
  });

  it('opens builder-native rewrite state immediately while candidates are still loading', async function () {
    let releaseRewriteRequest: (() => void) | null = null;
    globalThis.fetch = vi.fn().mockImplementation(function (input: RequestInfo | URL) {
      const requestUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (requestUrl.indexOf('/api/resume/rewrite-assist') >= 0) {
        return new Promise<Response>(function (resolve) {
          releaseRewriteRequest = function () {
            resolve(
              new Response(JSON.stringify({
                rewrite_request_id: 'rewrite-loading-1',
                status: 'ready',
                candidates: [],
              }), {
                status: 200,
                headers: {
                  'Content-Type': 'application/json',
                },
              })
            );
          };
        });
      }
      return Promise.resolve(
        new Response(JSON.stringify(buildDiagnosticsResponse('evaluated')), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    }) as typeof globalThis.fetch;

    const rewritePromise = useResumeWorkspaceStore.getState().requestResumeRewrite({
      rewrite_request_id: 'rewrite-loading-1',
      resume: {
        resume_id: 'resume-master-seed',
        variant_id: 'resume-master-seed',
        revision_id: useResumeWorkspaceStore.getState().resumes[0].currentRevisionId,
        snapshot_id: 'snapshot-1',
        diagnostics_id: 'diag-1',
      },
      target: {
        section_id: 'experience',
        bullet_id: 'exp-seed-1-bullet-0',
        original_text: 'Coordinated cross-functional program tracking for service delivery milestones.',
      },
      grounding: {
        issue_code: 'MISSING_QUANTIFIED_OUTCOME',
        recommendation_code: 'REWRITE_FOR_OUTCOME',
        explanation_title: null,
        explanation_detail: null,
        action_hint: null,
        target_role: 'Program Analyst',
      },
    });

    const loadingState = useResumeWorkspaceStore.getState();
    expect(loadingState.rewrite.status).toBe('loading');
    expect(loadingState.builder.activeSection).toBe('experience');
    expect(loadingState.rewrite.request !== null && loadingState.rewrite.request.target.original_text).toContain(
      'Coordinated cross-functional'
    );

    const releaseCurrentRewriteRequest = releaseRewriteRequest as (() => void) | null;
    if (releaseCurrentRewriteRequest !== null) {
      releaseCurrentRewriteRequest();
    }
    await rewritePromise;
  });

  it('applies an approved rewrite, bumps the revision id, and preserves a new revision snapshot', async function () {
    const initialState = useResumeWorkspaceStore.getState();
    const initialRevisionId = initialState.resumes[0].currentRevisionId;

    useResumeWorkspaceStore.setState(function (state) {
      return {
        rewrite: {
          status: 'ready',
          request: {
            rewrite_request_id: 'rewrite-apply-1',
            resume: {
              resume_id: state.resumes[0].id,
              variant_id: state.resumes[0].variantId,
              revision_id: state.resumes[0].currentRevisionId,
              snapshot_id: 'snapshot-1',
              diagnostics_id: 'diag-1',
            },
            target: {
              section_id: 'experience',
              bullet_id: 'exp-seed-1-bullet-0',
              original_text: 'Coordinated cross-functional program tracking for service delivery milestones.',
            },
            grounding: {
              issue_code: 'MISSING_QUANTIFIED_OUTCOME',
              recommendation_code: 'REWRITE_FOR_OUTCOME',
              explanation_title: 'Rewrite the top experience bullets',
              explanation_detail: null,
              action_hint: null,
              target_role: 'Program Analyst',
            },
          },
          candidates: [
            {
              candidate_id: 'candidate-apply-1',
              label: 'Outcome-first option',
              text: 'Improved program tracking by consolidating milestone reporting into one weekly executive dashboard.',
              rationale: null,
            },
          ],
          errorMessage: null,
          appliedCandidateId: null,
        },
      };
    });

    useResumeWorkspaceStore.getState().applyResumeRewriteCandidate('candidate-apply-1');

    const nextState = useResumeWorkspaceStore.getState();
    const nextRevisionId = nextState.resumes[0].currentRevisionId;
    const currentRevisionSnapshot = getRevisionContentSnapshotById(
      nextState.revisionContentSnapshots,
      nextRevisionId
    );

    expect(nextRevisionId).not.toBe(initialRevisionId);
    expect(nextState.rewrite.status).toBe('applied');
    expect(nextState.rewrite.appliedCandidateId).toBe('candidate-apply-1');
    expect(nextState.builder.activeSection).toBe('experience');
    expect(nextState.resumeDrafts['resume-master-seed'].experience[0].duties).toContain(
      'Improved program tracking by consolidating milestone reporting into one weekly executive dashboard.'
    );
    expect(currentRevisionSnapshot !== null).toBe(true);
    expect(
      currentRevisionSnapshot !== null &&
      currentRevisionSnapshot.draft.experience[0].duties
    ).toContain('Improved program tracking by consolidating milestone reporting into one weekly executive dashboard.');
  });

  it('dismisses rewrite assistance without mutating draft content', function () {
    const beforeDismiss = useResumeWorkspaceStore.getState().resumeDrafts['resume-master-seed'].summary;

    useResumeWorkspaceStore.setState(function () {
      return {
        rewrite: {
          status: 'ready',
          request: {
            rewrite_request_id: 'rewrite-dismiss-1',
            resume: {
              resume_id: 'resume-master-seed',
              variant_id: 'resume-master-seed',
              revision_id: 'revision-1',
              snapshot_id: 'snapshot-1',
              diagnostics_id: 'diag-1',
            },
            target: {
              section_id: 'summary',
              bullet_id: null,
              original_text: beforeDismiss,
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
          errorMessage: null,
          appliedCandidateId: null,
        },
      };
    });

    useResumeWorkspaceStore.getState().dismissResumeRewrite();

    const nextState = useResumeWorkspaceStore.getState();
    expect(nextState.rewrite.status).toBe('dismissed');
    expect(nextState.resumeDrafts['resume-master-seed'].summary).toBe(beforeDismiss);
  });
});
