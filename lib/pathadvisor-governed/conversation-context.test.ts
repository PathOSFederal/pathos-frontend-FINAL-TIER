/**
 * ============================================================================
 * GOVERNED PATHADVISOR CONVERSATION CONTEXT TESTS
 * ============================================================================
 *
 * PURPOSE:
 * Prove the restored conversational shell still uses structured governed data
 * instead of rendered UI strings.
 *
 * WHY THESE TESTS MATTER:
 * The conversation API wiring must still stay deterministic. These tests lock
 * in that the context builder copies authoritative fields only and does not
 * regress into reading rendered UI strings.
 */

import { describe, expect, it } from 'vitest';
import type {
  PathAdvisorContextEntry,
  PathAdvisorGovernedDraft,
  PathAdvisorGovernedResultState,
  UnifiedCareerResumeIntelligenceState,
} from '@pathos/ui';
import {
  buildPathAdvisorConversationContext,
  buildPathAdvisorEntryContext,
  buildPathAdvisorRouteContext,
} from './conversation-context';

function buildDraft(): PathAdvisorGovernedDraft {
  return {
    domain: 'qualification',
    qualification: {
      yearsExperience: '5',
      targetRoles: 'Program Analyst',
      skills: 'analysis, writing',
      authorizedToWork: true,
    },
    fehb: {
      enrollmentType: '',
      coverageType: 'family',
      expectedUtilization: 'high',
      householdSize: '',
      planPreferences: 'low deductible',
      comparisonTargets: 'BCBS Basic',
    },
  };
}

function buildSuccessResult(
  responseState: 'grounded' | 'partial' | 'refused'
): PathAdvisorGovernedResultState {
  return {
    status: 'success',
    errorMessage: null,
    response: {
      domain: responseState === 'refused' ? 'cross_domain' : 'qualification',
      responseState: responseState,
      grounded: responseState !== 'refused',
      summary: responseState === 'partial'
        ? 'You have a useful but incomplete governed answer.'
        : responseState === 'refused'
          ? 'The current governed request is intentionally refused.'
          : 'You have a grounded governed answer.',
      explanation: 'Authoritative explanation from the backend contract.',
      keyFactors: [
        {
          factorType: 'finding',
          label: 'Experience aligns',
          detail: 'Your experience range aligns with the request.',
          code: 'experience_alignment',
          severity: 'low',
        },
      ],
      missingInputs: responseState === 'partial' ? ['expected_utilization'] : [],
      nextSteps: responseState === 'refused'
        ? ['Try again when governed FEHB coverage is available.']
        : ['Review the duties before applying.'],
      refusalReason: responseState === 'refused' ? 'cross_domain_fehb_unavailable' : null,
      packVersionId: 'pack-version-1',
      freshnessState: 'fresh',
      grounding: {
        domain: responseState === 'refused' ? 'cross_domain' : 'qualification',
        responseState: responseState,
        grounded: responseState !== 'refused',
        partial: responseState === 'partial',
        refusalReason: responseState === 'refused' ? 'cross_domain_fehb_unavailable' : null,
        missingInputs: responseState === 'partial' ? ['expected_utilization'] : [],
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
        servingEligible: responseState !== 'refused',
        sourceSummary: null,
        conversationProvider: 'fake-provider',
        providerUsed: true,
        refusalDomain: responseState === 'refused' ? 'fehb' : null,
        domains: [],
      },
      servedAt: '2026-04-03T12:00:00Z',
    },
  };
}

function buildIntelligence(): UnifiedCareerResumeIntelligenceState {
  return {
    source: 'live',
    isRefreshing: false,
    lastUpdatedLabel: 'Updated just now',
    errorMessage: null,
    workspaceResume: {
      id: 'resume-master-seed',
      name: 'Master Resume',
      mode: 'master',
      updatedAt: '2026-04-08T09:30:00Z',
      targetRoleTitle: 'Program Analyst',
    },
    careerReadiness: {
      meta: {
        snapshot_id: 'career-snapshot-1',
        generated_at: '2026-04-08T10:00:00Z',
        input_hash: 'career-input-hash',
        rule_version: 'rules-v1',
        knowledge_pack_version: 'career-pack-v1',
        kind: 'career_readiness',
      },
      overall_score: 74,
      label: 'Promising',
      target_role: 'GS-9 Program Analyst',
      spokes: {
        qualifications: 71,
        evidence: 78,
      },
      top_gaps: [
        {
          key: 'specialized_experience',
          title: 'Clarify specialized experience',
          impact_points: 8,
          reason: 'The profile does not fully describe the qualifying work.',
        },
      ],
      action_plan: [
        {
          key: 'transcript',
          title: 'Upload a transcript',
          impact_points: 12,
          effort: 'S',
          helper: 'Add the transcript before applying.',
        },
      ],
      reasons: [],
      evidence_used: [],
      missing_evidence: [
        {
          key: 'governed_transcript_requirement',
          label: 'Official transcript',
          why_it_matters: 'The governed qualification rule requires it.',
        },
      ],
    },
    resumeReadiness: {
      meta: {
        snapshot_id: 'resume-snapshot-1',
        generated_at: '2026-04-08T10:05:00Z',
        input_hash: 'resume-input-hash',
        rule_version: 'rules-v1',
        knowledge_pack_version: 'career-pack-v1',
        kind: 'resume_readiness',
      },
      overall_score: 68,
      target_role: 'GS-9 Program Analyst',
      categories: {
        evidence: 64,
        structure: 72,
      },
      suggestions: [
        {
          key: 'employment_dates',
          title: 'Add employment dates',
          impact_points: 10,
          example: null,
        },
      ],
      reasons: [],
      evidence_used: [],
      missing_evidence: [
        {
          key: 'governed_resume_employment_dates',
          label: 'Employment dates',
          why_it_matters: 'Federal resume review needs dated history.',
        },
      ],
    },
    refresh: null,
  };
}

describe('governed PathAdvisor conversation context', function () {
  it('builds future conversation context from structured governed fields only', function () {
    const context = buildPathAdvisorConversationContext({
      currentView: 'dashboard',
      draft: buildDraft(),
      result: buildSuccessResult('grounded'),
      selectedEntity: {
        entityType: 'job',
        entityId: 'job-123',
        entityLabel: 'Program Analyst',
      },
    });

    expect(context.currentView).toBe('dashboard');
    expect(context.requestDomain).toBe('qualification');
    expect(context.trustState).toBe('grounded');
    expect(context.selectedEntity.entityId).toBe('job-123');
    expect(context.currentTargetScope).toEqual({
      sourceKind: 'qualification_draft',
      rawLabel: 'Program Analyst',
      normalizedTitle: 'Program Analyst',
      seriesCode: null,
      grade: null,
      familyTags: ['analysis'],
    });
    expect(context.governedResponse !== null).toBe(true);
    if (context.governedResponse === null) {
      throw new Error('Expected governed response.');
    }
    expect(context.governedResponse.summary).toBe('You have a grounded governed answer.');
    expect(context.governedResponse.explanation).toBe('Authoritative explanation from the backend contract.');
    expect(context.governedResponse.grounding.partial).toBe(false);
    expect(context.governedResponse.grounding.conversationProvider).toBe('fake-provider');
    expect(context.governedResponse.grounding.providerUsed).toBe(true);
    expect('Current governed state: grounded qualification' in context).toBe(false);
  });

  it('copies entry planning metadata from the governed response when present', function () {
    const result = buildSuccessResult('grounded');
    if (result.response === null) {
      throw new Error('Expected governed response.');
    }

    result.response.grounding.entryPlanning = {
      planningBasis: 'capability_fallback',
      planningSummary:
        'Planner used bounded context fallback to select application confidence and resume readiness.',
      plannedDomains: [
        {
          domain: 'application_confidence',
          selectionBasis: 'capability_fallback',
          capabilityState: 'available',
          capabilityReason: 'Selected-job application-confidence context is available.',
        },
      ],
    };

    const context = buildPathAdvisorConversationContext({
      currentView: 'dashboard',
      draft: buildDraft(),
      result: result,
    });

    expect(context.governedResponse?.grounding.entryPlanning).toEqual({
      planningBasis: 'capability_fallback',
      planningSummary:
        'Planner used bounded context fallback to select application confidence and resume readiness.',
      plannedDomains: [
        {
          domain: 'application_confidence',
          selectionBasis: 'capability_fallback',
          capabilityState: 'available',
          capabilityReason: 'Selected-job application-confidence context is available.',
        },
      ],
    });
  });

  it('copies bounded carry-forward context when it is provided', function () {
    const context = buildPathAdvisorConversationContext({
      currentView: 'dashboard',
      draft: buildDraft(),
      result: buildSuccessResult('grounded'),
      carryForwardContext: {
        sourceKind: 'immediately_previous_user_turn',
        transformKind: 'same_thing_but',
        baseUserMessage: 'Are there law enforcement jobs available?',
        priorUserMessage: 'Are there law enforcement jobs available?',
        originalUserMessage: 'same thing but for GS-12 in Florida',
        effectiveUserMessage: 'Are there law enforcement jobs available for gs-12 in florida?',
        modifiers: [
          { kind: 'grade', value: 'gs-12' },
          { kind: 'location', value: 'florida' },
        ],
        modifierChanges: [
          { kind: 'grade', operation: 'add', value: 'gs-12', previousValue: null },
          { kind: 'location', operation: 'add', value: 'florida', previousValue: null },
        ],
      },
    });

    expect(context.carryForwardContext).toEqual({
      sourceKind: 'immediately_previous_user_turn',
      transformKind: 'same_thing_but',
      baseUserMessage: 'Are there law enforcement jobs available?',
      priorUserMessage: 'Are there law enforcement jobs available?',
      originalUserMessage: 'same thing but for GS-12 in Florida',
      effectiveUserMessage: 'Are there law enforcement jobs available for gs-12 in florida?',
      modifiers: [
        { kind: 'grade', value: 'gs-12' },
        { kind: 'location', value: 'florida' },
      ],
      modifierChanges: [
        { kind: 'grade', operation: 'add', value: 'gs-12', previousValue: null },
        { kind: 'location', operation: 'add', value: 'florida', previousValue: null },
      ],
    });
  });

  it('keeps partial trust state and missing inputs in the structured context', function () {
    const context = buildPathAdvisorConversationContext({
      currentView: 'dashboard',
      draft: buildDraft(),
      result: buildSuccessResult('partial'),
    });

    expect(context.trustState).toBe('partial');
    expect(context.governedResponse !== null).toBe(true);
    if (context.governedResponse === null) {
      throw new Error('Expected governed response.');
    }
    expect(context.governedResponse.missingInputs).toEqual(['expected_utilization']);
    expect(context.governedResponse.nextSteps).toEqual(['Review the duties before applying.']);
  });

  it('keeps refused trust state distinct from technical error state', function () {
    const refusedContext = buildPathAdvisorConversationContext({
      currentView: 'dashboard',
      draft: buildDraft(),
      result: buildSuccessResult('refused'),
    });
    const technicalContext = buildPathAdvisorConversationContext({
      currentView: 'dashboard',
      draft: buildDraft(),
      result: {
        status: 'error',
        response: null,
        errorMessage: 'Proxy route failed.',
      },
    });

    expect(refusedContext.trustState).toBe('refused');
    expect(refusedContext.governedResponse !== null).toBe(true);
    if (refusedContext.governedResponse === null) {
      throw new Error('Expected governed response.');
    }
    expect(refusedContext.governedResponse.refusalReason).toBe('cross_domain_fehb_unavailable');
    expect(technicalContext.trustState).toBe('error');
    expect(technicalContext.governedResponse).toBe(null);
  });

  it('adds bounded unified intelligence context when live application intelligence is provided', function () {
    const context = buildPathAdvisorConversationContext({
      currentView: 'career-readiness',
      draft: buildDraft(),
      result: buildSuccessResult('grounded'),
      intelligence: buildIntelligence(),
    });

    expect(context.intelligenceContext).toEqual({
      source: 'live',
      workspaceResume: {
        id: 'resume-master-seed',
        name: 'Master Resume',
        mode: 'master',
        updatedAt: '2026-04-08T09:30:00Z',
        targetRoleTitle: 'Program Analyst',
      },
      careerReadiness: {
        snapshotId: 'career-snapshot-1',
        generatedAt: '2026-04-08T10:00:00Z',
        overallScore: 74,
        label: 'Promising',
        targetRole: 'GS-9 Program Analyst',
        spokes: {
          qualifications: 71,
          evidence: 78,
        },
        topGaps: ['Clarify specialized experience'],
        nextActions: ['Upload a transcript'],
        missingEvidence: ['Official transcript'],
      },
      resumeReadiness: {
        snapshotId: 'resume-snapshot-1',
        generatedAt: '2026-04-08T10:05:00Z',
        overallScore: 68,
        targetRole: 'GS-9 Program Analyst',
        categories: {
          evidence: 64,
          structure: 72,
        },
        suggestions: ['Add employment dates'],
        missingEvidence: ['Employment dates'],
      },
      applicationConfidence: null,
    });
    expect(context.currentTargetScope).toEqual({
      sourceKind: 'career_readiness',
      rawLabel: 'GS-9 Program Analyst',
      normalizedTitle: 'Program Analyst',
      seriesCode: null,
      grade: 'GS-9',
      familyTags: ['analysis'],
    });
  });

  it('builds bounded route context from the active screen anchor and derives selected job entity', function () {
    const entriesByAnchor: Record<string, PathAdvisorContextEntry[]> = {
      'job-search:job:job-123': [
        {
          id: 'ctx-1',
          createdAtISO: '2026-04-08T10:00:00Z',
          screen: 'job-search',
          anchor: {
            type: 'job',
            id: 'job-123',
            label: 'Program Analyst',
          },
          title: 'Selected job: Program Analyst',
          subtitle: 'Department of Veterans Affairs',
          sections: [
            {
              lines: ['Current selection in Job Search.', 'Location: Washington, DC'],
            },
          ],
        },
        {
          id: 'ctx-2',
          createdAtISO: '2026-04-08T10:05:00Z',
          screen: 'job-search',
          anchor: {
            type: 'job',
            id: 'job-123',
            label: 'Program Analyst',
          },
          title: 'Live evaluation: Program Analyst',
          subtitle: 'Department of Veterans Affairs • Washington, DC',
          sections: [
            {
              title: 'Evaluation summary',
              lines: ['Recommendation: consider', 'Overall score: 74 (caution, confidence medium)'],
              bullets: [],
            },
            {
              title: 'Next actions',
              lines: [],
              bullets: ['Upload transcript'],
            },
          ],
        },
      ],
    };

    const routeContext = buildPathAdvisorRouteContext(
      'job-search',
      entriesByAnchor,
      'job-search:job:job-123'
    );

    expect(routeContext).toEqual({
      screenId: 'job-search',
      activeAnchor: {
        anchorType: 'job',
        anchorId: 'job-123',
        anchorLabel: 'Program Analyst',
      },
      targetScope: {
        sourceKind: 'route_anchor',
        rawLabel: 'Program Analyst',
        normalizedTitle: 'Program Analyst',
        seriesCode: null,
        grade: null,
        familyTags: ['analysis'],
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
        {
          title: 'Live evaluation: Program Analyst',
          subtitle: 'Department of Veterans Affairs • Washington, DC',
          sections: [
            {
              title: 'Evaluation summary',
              lines: ['Recommendation: consider', 'Overall score: 74 (caution, confidence medium)'],
              bullets: [],
            },
            {
              title: 'Next actions',
              lines: [],
              bullets: ['Upload transcript'],
            },
          ],
        },
      ],
    });

    const context = buildPathAdvisorConversationContext({
      currentView: 'job-search',
      draft: buildDraft(),
      result: buildSuccessResult('grounded'),
      routeContext: routeContext,
    });

    expect(context.selectedEntity).toEqual({
      entityType: 'job',
      entityId: 'job-123',
      entityLabel: 'Program Analyst',
    });
    expect(context.currentTargetScope).toEqual({
      sourceKind: 'qualification_draft',
      rawLabel: 'Program Analyst',
      normalizedTitle: 'Program Analyst',
      seriesCode: null,
      grade: null,
      familyTags: ['analysis'],
    });
    expect(context.routeContext).toEqual(routeContext);
  });

  it('falls back to the active thread when the current screen has no local route context', function () {
    const entriesByAnchor: Record<string, PathAdvisorContextEntry[]> = {
      'resume-review:resume:resume-master-seed': [
        {
          id: 'ctx-resume-1',
          createdAtISO: '2026-04-09T10:00:00Z',
          screen: 'resume-review',
          anchor: {
            type: 'resume',
            id: 'resume-master-seed',
            label: 'Master Resume',
          },
          title: 'Resume review: Master Resume',
          subtitle: 'Master resume • Program Analyst',
          sections: [
            {
              title: 'Diagnostics state',
              lines: ['Readiness: Workable', 'Response state: evaluated'],
            },
          ],
        },
      ],
    };

    const routeContext = buildPathAdvisorRouteContext(
      'dashboard',
      entriesByAnchor,
      'resume-review:resume:resume-master-seed',
      {
        allowActiveAnchorFallback: true,
      }
    );

    expect(routeContext).toEqual({
      screenId: 'resume-review',
      activeAnchor: {
        anchorType: 'resume',
        anchorId: 'resume-master-seed',
        anchorLabel: 'Master Resume',
      },
      recentEntries: [
        {
          title: 'Resume review: Master Resume',
          subtitle: 'Master resume • Program Analyst',
          sections: [
            {
              title: 'Diagnostics state',
              lines: ['Readiness: Workable', 'Response state: evaluated'],
              bullets: [],
            },
          ],
        },
      ],
    });

    const context = buildPathAdvisorConversationContext({
      currentView: 'dashboard',
      draft: buildDraft(),
      result: buildSuccessResult('grounded'),
      routeContext: routeContext,
    });

    expect(context.currentView).toBe('dashboard');
    expect(context.selectedEntity).toEqual({
      entityType: 'dashboard',
      entityId: null,
      entityLabel: null,
    });
    expect(context.routeContext).toEqual(routeContext);
  });

  it('builds bounded entry context from current and route target scope', function () {
    const routeContext = {
      screenId: 'job-search',
      activeAnchor: {
        anchorType: 'job' as const,
        anchorId: 'job-123',
        anchorLabel: 'Criminal Investigator',
      },
      targetScope: {
        sourceKind: 'route_anchor' as const,
        rawLabel: 'Criminal Investigator',
        normalizedTitle: 'Criminal Investigator',
        seriesCode: '1811',
        grade: 'GS-9',
        familyTags: ['law_enforcement'],
      },
      recentEntries: [],
    };

    const entryContext = buildPathAdvisorEntryContext({
      currentView: 'job-search',
      draft: buildDraft(),
      result: {
        status: 'idle',
        response: null,
        errorMessage: null,
      },
      intelligence: buildIntelligence(),
      routeContext: routeContext,
    });

    expect(entryContext).toEqual({
      intelligenceContext: {
        source: 'live',
        workspaceResume: {
          id: 'resume-master-seed',
          name: 'Master Resume',
          mode: 'master',
          updatedAt: '2026-04-08T09:30:00Z',
          targetRoleTitle: 'Program Analyst',
        },
        careerReadiness: {
          snapshotId: 'career-snapshot-1',
          generatedAt: '2026-04-08T10:00:00Z',
          overallScore: 74,
          label: 'Promising',
          targetRole: 'GS-9 Program Analyst',
          spokes: {
            qualifications: 71,
            evidence: 78,
          },
          topGaps: ['Clarify specialized experience'],
          nextActions: ['Upload a transcript'],
          missingEvidence: ['Official transcript'],
        },
        resumeReadiness: {
          snapshotId: 'resume-snapshot-1',
          generatedAt: '2026-04-08T10:05:00Z',
          overallScore: 68,
          targetRole: 'GS-9 Program Analyst',
          categories: {
            evidence: 64,
            structure: 72,
          },
          suggestions: ['Add employment dates'],
          missingEvidence: ['Employment dates'],
        },
        applicationConfidence: null,
      },
      currentTargetLabel: 'GS-9 Program Analyst',
      routeTargetLabel: 'Criminal Investigator',
      routeAnchorLabel: 'Criminal Investigator',
      routeScreenId: 'job-search',
    });
  });

  it('derives bounded application-confidence context from route entry meta', function () {
    const routeContext = {
      screenId: 'job-search',
      activeAnchor: {
        anchorType: 'job' as const,
        anchorId: 'job-123',
        anchorLabel: 'Criminal Investigator',
      },
      targetScope: {
        sourceKind: 'route_anchor' as const,
        rawLabel: 'Criminal Investigator',
        normalizedTitle: 'Criminal Investigator',
        seriesCode: '1811',
        grade: 'GS-9',
        familyTags: ['law_enforcement'],
      },
      recentEntries: [
        {
          title: 'Live evaluation: Criminal Investigator',
          subtitle: 'Department of Justice',
          sections: [
            {
              title: 'Evaluation summary',
              lines: ['Recommendation: consider'],
              bullets: [],
              meta: {
                pathadvisor_context_kind: 'application_confidence',
                source: 'live',
                job_id: 'job-123',
                job_title: 'Criminal Investigator',
                target_role: 'Criminal Investigator',
                overall_score: '74',
                recommendation: 'consider',
                decision_band: 'consider',
                confidence_band: 'medium',
                rationale_summary:
                  'The selected job is plausible, but evidence is still incomplete.',
                priority_level: 'medium',
                alert_importance: 'medium',
                blocking_issues: JSON.stringify([
                  'Transcript evidence is still unresolved.',
                ]),
                missing_evidence: JSON.stringify(['Official transcript']),
                next_actions: JSON.stringify(['Upload transcript']),
                decision_version: 'decision-v1',
              },
            },
          ],
        },
      ],
    };

    const entryContext = buildPathAdvisorEntryContext({
      currentView: 'job-search',
      draft: buildDraft(),
      result: {
        status: 'idle',
        response: null,
        errorMessage: null,
      },
      routeContext: routeContext,
    });

    expect(entryContext.intelligenceContext).toEqual({
      source: 'live',
      workspaceResume: null,
      careerReadiness: null,
      resumeReadiness: null,
      applicationConfidence: {
        source: 'live',
        screenId: 'job-search',
        jobId: 'job-123',
        jobTitle: 'Criminal Investigator',
        targetRole: 'Criminal Investigator',
        overallScore: 74,
        recommendation: 'consider',
        decisionBand: 'consider',
        confidenceBand: 'medium',
        rationaleSummary:
          'The selected job is plausible, but evidence is still incomplete.',
        priorityLevel: 'medium',
        alertImportance: 'medium',
        blockingIssues: ['Transcript evidence is still unresolved.'],
        missingEvidence: ['Official transcript'],
        nextActions: ['Upload transcript'],
        decisionVersion: 'decision-v1',
      },
    });
  });
});
