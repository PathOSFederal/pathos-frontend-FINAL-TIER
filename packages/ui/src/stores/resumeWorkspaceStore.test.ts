import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultDraft } from '@pathos/core';
import {
  RESUME_WORKSPACE_STORAGE_KEY,
  buildPlaceholderReviewState,
  deriveSectionCompletion,
  useResumeWorkspaceStore,
} from './resumeWorkspaceStore';

const originalFetch = globalThis.fetch;

function buildDiagnosticsResponse(responseState: 'evaluated' | 'insufficient_input' | 'unsupported_context') {
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
    issues: [],
    recommendations: [],
    warnings: [],
    missing_evidence: [],
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
  });

  it('duplicates the current draft for another target and clears target role context', function () {
    const duplicateId = useResumeWorkspaceStore.getState().duplicateForAnotherTarget();
    const nextState = useResumeWorkspaceStore.getState();

    expect(duplicateId).not.toBeNull();
    expect(nextState.activeResumeId).toBe(duplicateId);
    if (duplicateId !== null) {
      expect(nextState.resumes[0].id).toBe(duplicateId);
      expect(nextState.resumes[0].targetContext.targetRoleTitle).toBe('');
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
});
