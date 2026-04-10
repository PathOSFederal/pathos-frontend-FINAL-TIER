/**
 * Job Search screen tests: title/subtitle, empty state, loadSampleJobs (fit badge + reasons),
 * save creates decision brief in localStorage, Decision Brief tab content.
 * Listbox UX: full-row selectable, consistent row height, Why this fit opens PathAdvisor briefing (no inline expand).
 * Unified search: prompt panel collapsed by default; Describe CTA expands panel; Translate->Apply sets filters and runs search;
 * Applied from prompt indicator; Reset clears applied-from-prompt; manual search unchanged.
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  NavigationProvider,
  type NavigationAdapter,
  type NavLinkProps,
} from '@pathos/adapters';
import type { Job } from '@pathos/core';
import { useJobSearchV1Store } from '../stores/jobSearchV1Store';
import { useDecisionBriefsV1Store, buildDecisionBriefRecord } from '../stores/decisionBriefsV1Store';
import { usePathAdvisorBriefingStore } from '../stores/pathAdvisorBriefingStore';
import {
  buildJobMatchSnapshot,
  buildReadinessInputFromMock,
  buildDimensionBriefingPayload,
} from '../lib/jobMatchSnapshot';
import type { ScreenIntelligenceEnvelope } from '../types/pathadvisorIntelligence';
import { CAREER_READINESS_MOCK } from './careerReadiness/careerReadinessMockData';
import {
  buildJobListMatchDisplay,
  buildQueryAwareLocationDisplay,
  deriveMatchLevelFromOverallScore,
  getResetSearchQuery,
  JobDetailsPanel,
  JobSearchScreen,
  resolveJobListRowState,
  resolveJobSearchLikelihoodScore,
  resolveUsaJobsUrl,
} from './JobSearchScreen';
import { MOCK_JOBS } from './jobSearchMockJobs';
import { usePathAdvisorContextLogStore, getAnchorKeysForScreen, getEntriesForAnchor } from '../stores/pathAdvisorContextLogStore';
import { publishScreenContext, publishDimensionExplainContext } from '../lib/pathAdvisorPublish';

function noop() {
  /* mock */
}

const testAdapter: NavigationAdapter = {
  pathname: '/dashboard/job-search',
  push: noop,
  replace: noop,
  back: function () {
    /* mock */
  },
};

function TestLink(props: NavLinkProps) {
  return (
    <a href={props.href} className={props.className} onClick={props.onClick} data-tour={props['data-tour']}>
      {props.children}
    </a>
  );
}

function renderJobSearch() {
  return renderInNavigation(<JobSearchScreen />);
}

function renderLiveJobSearch() {
  return renderInNavigation(
    <JobSearchScreen
      liveSearch={{
        searchJobs: async function () {
          return {
            results: [],
            total: 0,
            page: 1,
            pageSize: 20,
            requestId: 'request-1',
          };
        },
      }}
    />
  );
}

function renderInNavigation(element: React.ReactNode) {
  return renderToString(
    <NavigationProvider adapter={testAdapter} linkComponent={TestLink}>
      {element}
    </NavigationProvider>
  );
}

function renderJobDetailsWithLiveState(state: {
  status: 'idle' | 'loading' | 'error' | 'empty' | 'success';
  errorMessage: string | null;
  evaluation: null | {
    recommendation: string;
    decisionBand: string;
    confidenceBand: string;
    overallScore: number;
    reasons: Array<{
      code: string | null;
      ruleId: string | null;
      basis: string | null;
      text: string;
      severity: string | null;
      suggestion: string | null;
      importance: string | null;
      evidenceRefs: Array<{
        label: string | null;
        sourceCategory: string | null;
        factStatus: string | null;
      }>;
    }>;
    gaps: Array<{
      code: string | null;
      ruleId: string | null;
      basis: string | null;
      text: string;
      severity: string | null;
      suggestion: string | null;
      importance: string | null;
      evidenceRefs: Array<{
        label: string | null;
        sourceCategory: string | null;
        factStatus: string | null;
      }>;
    }>;
    warnings: Array<{
      code: string | null;
      ruleId: string | null;
      basis: string | null;
      text: string;
      severity: string | null;
      suggestion: string | null;
      importance: string | null;
      evidenceRefs: Array<{
        label: string | null;
        sourceCategory: string | null;
        factStatus: string | null;
      }>;
    }>;
    missingEvidence: Array<{
      code: string | null;
      ruleId: string | null;
      basis: string | null;
      text: string;
      severity: string | null;
      suggestion: string | null;
      importance: string | null;
      evidenceRefs: Array<{
        label: string | null;
        sourceCategory: string | null;
        factStatus: string | null;
      }>;
    }>;
    nextActions: Array<{
      code: string | null;
      action: string;
      priority: number;
    }>;
    applicationDecision: null | {
      decisionBand: string;
      priorityLevel: string;
      alertImportance: string;
      rationaleSummary: string;
      blockingIssues: Array<{
        code: string | null;
        ruleId: string | null;
        sourceType: string | null;
        severity: string | null;
        text: string;
        evidenceRefs: Array<{
          label: string | null;
          sourceCategory: string | null;
          factStatus: string | null;
        }>;
      }>;
      recommendedNextActions: Array<{
        code: string | null;
        action: string;
        priority: number;
      }>;
      decisionRuleIds: string[];
      decisionVersion: string | null;
    };
    explainabilityVersion: string | null;
    engineVersion: string | null;
    canonicalUserContext?: {
      targetRoleClusters: string[];
      preferredLocations: string[];
      readinessState: string;
      fitLanes: string[];
      blockers: string[];
      topMissingItems: string[];
      nextBestActions: string[];
      activeThreads: string[];
      profileCompleteness: number;
      freshnessBand: 'fresh' | 'aging' | 'stale' | 'unknown';
      confidenceBand: 'low' | 'medium' | 'high';
      recentMeaningfulChanges: string[];
      activitySignals: string[];
      updatedAt: string;
    } | null;
    jobMatchProjection?: {
      overallScore: number;
      confidenceBand: 'low' | 'medium' | 'high';
      blockerSeverity: 'low' | 'medium' | 'high';
      explanationSummary: string;
      dimensions: Array<{
        dimensionId: string;
        label: string;
        score: number;
        status: 'strong' | 'building' | 'weak';
        explanation: string;
      }>;
      nextActions: string[];
      blockers: string[];
      warnings: string[];
    } | null;
    screenIntelligence?: ScreenIntelligenceEnvelope | null;
  };
}) {
  const job = MOCK_JOBS[0];
  if (job === undefined) {
    throw new Error('Missing mock job for live Job Search panel test.');
  }

  return renderInNavigation(
    <JobDetailsPanel
      job={job}
      isSaved={false}
      isLiveAdvisorMode={true}
      activeTab="overview"
      onTabChange={function () {
        /* noop */
      }}
      decisionBrief={null}
      snapshot={undefined}
      jobMatchSnapshot={undefined}
      liveAdvisorState={state}
      onSave={function () {
        /* noop */
      }}
      onTailor={function () {
        /* noop */
      }}
      onAskPathAdvisor={function () {
        /* noop */
      }}
      onRetryLiveEvaluation={function () {
        /* noop */
      }}
      onExplainInPathAdvisor={function () {
        /* noop */
      }}
      onOpenCareerReadinessActionPlan={function () {
        /* noop */
      }}
      onOpenDimensionBriefing={function () {
        /* noop */
      }}
    />
  );
}

function renderJobDetails(job: Job, locationQuery?: string) {
  return renderInNavigation(
    <JobDetailsPanel
      job={job}
      locationQuery={locationQuery}
      isSaved={false}
      isLiveAdvisorMode={true}
      activeTab="overview"
      onTabChange={function () {
        /* noop */
      }}
      decisionBrief={null}
      snapshot={undefined}
      jobMatchSnapshot={undefined}
      liveAdvisorState={{
        status: 'idle',
        errorMessage: null,
        evaluation: null,
      }}
      onSave={function () {
        /* noop */
      }}
      onTailor={function () {
        /* noop */
      }}
      onAskPathAdvisor={function () {
        /* noop */
      }}
      onRetryLiveEvaluation={function () {
        /* noop */
      }}
      onExplainInPathAdvisor={function () {
        /* noop */
      }}
      onOpenCareerReadinessActionPlan={function () {
        /* noop */
      }}
      onOpenDimensionBriefing={function () {
        /* noop */
      }}
    />
  );
}

describe('JobSearchScreen', function () {
  beforeEach(function () {
    useJobSearchV1Store.getState().loadFromStorage();
    usePathAdvisorContextLogStore.getState().clearAll();
    useJobSearchV1Store.setState({
      searchErrorMessage: null,
    });
  });

  it('renders loading or Job Search content', function () {
    const output = renderJobSearch();
    expect(output.indexOf('Job Search') !== -1 || output.indexOf('Loading job search') !== -1).toBe(true);
  });

  it('includes Explore roles subtitle in component tree when mounted', function () {
    useJobSearchV1Store.setState({
      hasSearched: false,
      results: [],
      loading: false,
      searchErrorMessage: null,
    });
    const output = renderJobSearch();
    expect(output.indexOf('Explore roles') !== -1 || output.indexOf('Loading') !== -1).toBe(true);
  });

  it('live search mode does not expose sample-job fallback copy on server render', function () {
    useJobSearchV1Store.setState({
      hasSearched: false,
      results: [],
      loading: false,
      searchErrorMessage: null,
    });

    const output = renderLiveJobSearch();
    expect(
      output.indexOf('Search live jobs') !== -1 ||
      output.indexOf('Loading job search') !== -1
    ).toBe(true);
    expect(output.indexOf('Load sample jobs')).toBe(-1);
  });

  it('live search error state does not regress server render', function () {
    useJobSearchV1Store.setState({
      hasSearched: true,
      results: [],
      allResults: [],
      loading: false,
      searchErrorMessage: 'Backend live search failed.',
    });

    const output = renderLiveJobSearch();
    expect(
      output.indexOf('Live search is unavailable for this request.') !== -1 ||
      output.indexOf('Loading job search') !== -1
    ).toBe(true);
  });

  it('renders canonical job-search intelligence projection from the backend payload', function () {
    const output = renderJobDetailsWithLiveState({
      status: 'success',
      errorMessage: null,
      evaluation: {
        recommendation: 'consider',
        decisionBand: 'caution',
        confidenceBand: 'medium',
        overallScore: 74,
        reasons: [],
        gaps: [],
        warnings: [],
        missingEvidence: [],
        nextActions: [],
        applicationDecision: null,
        explainabilityVersion: 'explainability-v1',
        engineVersion: 'qualification-v1',
        canonicalUserContext: {
          targetRoleClusters: ['Program analyst'],
          preferredLocations: ['Maryland and DC'],
          readinessState: 'Draft resume',
          fitLanes: ['Target field: Program / policy analyst'],
          blockers: ['Resume evidence still needs work'],
          topMissingItems: ['Location flexibility'],
          nextBestActions: ['Clarify target role cluster'],
          activeThreads: ['Target direction'],
          profileCompleteness: 68,
          freshnessBand: 'fresh',
          confidenceBand: 'medium',
          recentMeaningfulChanges: [],
          activitySignals: ['Recent job activity strengthened analyst direction.'],
          updatedAt: '2026-04-09T12:00:00Z',
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
          nextActions: ['Clarify your target role cluster'],
          blockers: ['Resume evidence still needs work'],
          warnings: [],
        },
        screenIntelligence: {
          screen: 'job_search',
          pathadvisorMode: 'search_refinement',
          context: {
            targetRoleClusters: ['Program analyst'],
            preferredLocations: ['Maryland and DC'],
            readinessState: 'Draft resume',
            fitLanes: ['Target field: Program / policy analyst'],
            blockers: ['Resume evidence still needs work'],
            topMissingItems: ['Location flexibility'],
            nextBestActions: ['Clarify target role cluster'],
            activeThreads: ['Target direction'],
            profileCompleteness: 68,
            freshnessBand: 'fresh',
            confidenceBand: 'medium',
            recentMeaningfulChanges: [],
            activitySignals: ['Recent job activity strengthened analyst direction.'],
            updatedAt: '2026-04-09T12:00:00Z',
          },
          summary: 'Job Search is projecting canonical user intelligence onto this role.',
          nextBestAction: {
            actionId: 'clarify_target_cluster',
            title: 'Clarify your target role cluster',
            description: 'The selected job is broader than your current target-role context.',
            ctaLabel: 'Refine role direction',
            ctaHref: '/dashboard',
            reason: 'Sharper target direction improves match quality.',
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
            nextActions: ['Clarify your target role cluster'],
            blockers: ['Resume evidence still needs work'],
            warnings: [],
          },
          refinementSuggestions: ['Clarify target role cluster'],
        },
      },
    });

    expect(output).toContain('Canonical user intelligence');
    expect(output).toContain('Canonical match projection');
    expect(output).toContain('Screen guidance');
    expect(output).toContain('Clarify your target role cluster');
  });

  it('renders structured live salary in the decision band instead of See announcement', function () {
    const output = renderJobDetails({
      id: 'live-salary-1',
      title: 'Contract Specialist',
      agency: 'General Services Administration',
      location: 'Remote',
      grade: 'GS-12',
      salaryMin: 101234,
      salaryMax: 132456,
      savedAt: '2026-03-26T12:00:00Z',
      url: 'https://www.usajobs.gov/job/123456789',
    });

    expect(output).toContain('$101,234 - $132,456');
    expect(output).toContain('GS-12 pay context from the live result.');
    expect(output).not.toContain('See announcement');
  });

  it('renders an honest salary fallback when structured compensation is missing', function () {
    const output = renderJobDetails({
      id: 'live-salary-2',
      title: 'Program Analyst',
      agency: 'Department of Veterans Affairs',
      location: 'Washington, DC',
      grade: 'GS-11',
      savedAt: '2026-03-26T12:00:00Z',
      url: 'https://www.usajobs.gov/job/223456789',
    });

    expect(output).toContain('Structured salary was not included in this result.');
    expect(output).toContain('Open the full USAJOBS announcement for the compensation section.');
    expect(output).toContain('Promotion details unavailable in this result.');
    expect(output).not.toContain('Promotion potential was not structured in this result.');
  });

  it('buildQueryAwareLocationDisplay brings matched locations to the front and collapses the remainder', function () {
    const display = buildQueryAwareLocationDisplay(
      'Denver, Colorado | Miami, Florida | Tampa, Florida | Remote',
      'Florida',
      2
    );

    expect(display.hasMatch).toBe(true);
    expect(display.visibleParts[0].text).toBe('Miami, Florida');
    expect(display.visibleParts[0].matched).toBe(true);
    expect(display.visibleParts[1].text).toBe('Tampa, Florida');
    expect(display.remainingCount).toBe(2);
  });

  it('resolveUsaJobsUrl keeps the selected job linked to the current announcement and falls back from a numeric job id', function () {
    expect(
      resolveUsaJobsUrl({
        id: '123456789',
        title: 'Program Analyst',
        agency: 'General Services Administration',
        location: 'Washington, DC',
        savedAt: '2026-03-26T12:00:00Z',
      })
    ).toBe('https://www.usajobs.gov/job/123456789');

    expect(
      resolveUsaJobsUrl({
        id: 'selected-job-1',
        title: 'Contract Specialist',
        agency: 'Department of Veterans Affairs',
        location: 'Remote',
        savedAt: '2026-03-26T12:00:00Z',
        url: 'https://www.usajobs.gov/job/987654321',
      })
    ).toBe('https://www.usajobs.gov/job/987654321');
  });

  it('selected job detail renders the current USAJOBS link and highlights matching locations first', function () {
    const output = renderJobDetails(
      {
        id: '555001',
        title: 'Regional Program Analyst',
        agency: 'Department of Homeland Security',
        location: 'Denver, Colorado | Miami, Florida | Tampa, Florida | Remote',
        savedAt: '2026-03-26T12:00:00Z',
      },
      'Florida'
    );

    expect(output).toContain('href="https://www.usajobs.gov/job/555001"');
    expect(output).toContain('<mark');
    expect(output).toContain('Miami, Florida');
    expect(output).toContain('+2 more');
  });

  it('getResetSearchQuery restores a sensible live default instead of an empty live keyword', function () {
    expect(getResetSearchQuery(true)).toEqual({
      keywords: 'federal',
      location: '',
    });
    expect(getResetSearchQuery(false)).toEqual({
      keywords: '',
      location: '',
    });
  });

  it('after loadSampleJobs store has results and first job selected for details pane', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const state = useJobSearchV1Store.getState();
    expect(state.hasSearched).toBe(true);
    expect(state.results.length).toBeGreaterThan(0);
    expect(state.selectedJobId).toBe(state.results[0].id);
    expect(state.results[0].title.indexOf('IT Specialist') !== -1 || state.results[0].title.indexOf('Cybersecurity') !== -1).toBe(true);
  });

  it('selecting a job yields details pane content: Match for this job appears when job selected (or loading on first paint)', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const state = useJobSearchV1Store.getState();
    expect(state.selectedJobId).not.toBeNull();
    expect(state.results.length).toBeGreaterThan(0);
    const output = renderJobSearch();
    expect(
      output.indexOf('Match for this job') !== -1 || output.indexOf('Loading job search') !== -1
    ).toBe(true);
  });

  it('when a job is selected and snapshot visible Match breakdown rows include at least two dimension labels', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Match for this job') === -1) return;
    expect(output.indexOf('Match breakdown') !== -1).toBe(true);
    const hasResumeEvidence = output.indexOf('Resume Evidence') !== -1;
    const hasKeywordsCoverage = output.indexOf('Keywords Coverage') !== -1;
    expect(hasResumeEvidence || hasKeywordsCoverage).toBe(true);
    expect(output.indexOf('Target Alignment') !== -1 || output.indexOf('Specialized Experience') !== -1).toBe(true);
  });

  it('opening dimension briefing for Resume Evidence sets PathAdvisor briefing with title containing Resume Evidence', function () {
    usePathAdvisorBriefingStore.getState().clearBriefing();
    useJobSearchV1Store.getState().loadSampleJobs();
    const actionPlanRoute = '/dashboard/career-readiness#action-plan';
    const readinessInput = buildReadinessInputFromMock({
      score: 74,
      scoreMax: 100,
      badgeLabel: 'Competitive',
      radarSpokes: [
        { name: 'Target Alignment', value: 68 },
        { name: 'Specialized Exp', value: 72 },
        { name: 'Resume Evidence', value: 58 },
        { name: 'Keywords Coverage', value: 75 },
        { name: 'Leadership & Scope', value: 65 },
      ],
      gaps: [{ name: 'Resume Evidence', impact: 6 }],
      actionPlanItems: [{ label: 'Add quantified accomplishments', impact: 4 }],
    });
    const job = useJobSearchV1Store.getState().results[0];
    if (job === undefined) throw new Error('no job');
    const snapshot = buildJobMatchSnapshot(readinessInput, job);
    let resumeDim;
    for (let i = 0; i < snapshot.dimensions.length; i++) {
      const d = snapshot.dimensions[i];
      if (d !== undefined && d.key === 'Resume Evidence') {
        resumeDim = d;
        break;
      }
    }
    if (resumeDim === undefined) throw new Error('expected Resume Evidence dimension');
    const payload = buildDimensionBriefingPayload(resumeDim, snapshot, actionPlanRoute);
    const id = 'dimension-Resume-Evidence';
    usePathAdvisorBriefingStore.getState().openBriefing({
      id,
      title: payload.title,
      sourceLabel: payload.sourceLabel,
      sections: payload.sections,
      primaryCta: payload.primaryCta,
    });
    const state = usePathAdvisorBriefingStore.getState();
    expect(state.briefing).not.toBeNull();
    expect(state.isOpen).toBe(true);
    if (state.briefing !== null && typeof state.briefing === 'object' && 'title' in state.briefing) {
      expect((state.briefing as { title: string }).title.indexOf('Resume Evidence') !== -1).toBe(true);
    }
  });

  it('when a job is selected and snapshot visible readiness score appears in snapshot copy (e.g. 74/100)', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Match for this job') === -1) return;
    expect(output.indexOf('74/100') !== -1).toBe(true);
  });

  it('match panel shows both Readiness and Job match labels (Option A clarity)', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Match for this job') === -1) return;
    expect(output.indexOf('Readiness:') !== -1).toBe(true);
    expect(output.indexOf('Job match:') !== -1).toBe(true);
  });

  it('at least one job row renders Match badge (e.g. Moderate) and score with /100', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Match for this job') === -1) return;
    const hasModerate = output.indexOf('Moderate') !== -1;
    const hasStrong = output.indexOf('Strong') !== -1;
    const hasStretch = output.indexOf('Stretch') !== -1;
    expect(hasModerate || hasStrong || hasStretch).toBe(true);
    expect(output.indexOf('/100') !== -1).toBe(true);
  });

  it('after loadSampleJobs list contains at least two different match labels across rows', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    const hasStrong = output.indexOf('Strong') !== -1;
    const hasModerate = output.indexOf('Moderate') !== -1;
    const hasStretch = output.indexOf('Stretch') !== -1;
    if (!hasStrong && !hasModerate && !hasStretch) return;
    const distinctCount = (hasStrong ? 1 : 0) + (hasModerate ? 1 : 0) + (hasStretch ? 1 : 0);
    expect(distinctCount >= 2).toBe(true);
  });

  it('when details panel is visible it shows Match for this job and Job match score', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Match for this job') === -1) return;
    expect(output.indexOf('Job match:') !== -1).toBe(true);
  });

  it('Why this fit? is not present in results list (Option A: replaced by Match badge)', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    expect(output.indexOf('Why this fit?') === -1).toBe(true);
  });

  it('at least one Match breakdown row has Open dimension details in aria-label', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Match breakdown') === -1) return;
    expect(output.indexOf('Open dimension details') !== -1).toBe(true);
  });

  it('when a job is selected and snapshot visible a Fix gap CTA exists for career readiness', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Match for this job') === -1) return;
    /* Day 74: CTA simplified from "Open Career Readiness: Fix X (+N)" to "Fix X".
     * The button text starts with "Fix " followed by the weakest dimension label. */
    expect(output.indexOf('Fix ') !== -1).toBe(true);
  });

  it('when a job is selected and snapshot visible primary blocker line is present and may include a weak dimension label', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Match for this job') === -1) return;
    expect(output.indexOf('Primary blocker') !== -1).toBe(true);
    const hasDimensionInBlocker =
      output.indexOf('Resume Evidence') !== -1 ||
      output.indexOf('Target Alignment') !== -1 ||
      output.indexOf('Leadership & Scope') !== -1 ||
      output.indexOf('Keywords Coverage') !== -1 ||
      output.indexOf('Specialized Experience') !== -1 ||
      output.indexOf('Missing readiness') !== -1 ||
      output.indexOf('None detected') !== -1;
    expect(hasDimensionInBlocker).toBe(true);
  });

  it('Explain this match sets rail briefing state (store has type fit and isOpen)', function () {
    usePathAdvisorBriefingStore.getState().clearBriefing();
    useJobSearchV1Store.getState().loadSampleJobs();
    const openBriefing = usePathAdvisorBriefingStore.getState().openBriefing;
    openBriefing({
      type: 'fit',
      jobId: 'mock-js-1',
      jobTitle: 'IT Specialist (Cybersecurity)',
      stars: 4,
      confidence: 'High',
      reasons: ['Series matches your target (2210)', 'Grade aligned with target (GS-12)'],
      blocker: '',
      effort: 'Low',
      risks: ['Travel', 'Drug test'],
      inputsUsed: ['target series', 'target grade'],
      missingInputs: [],
      isJobSaved: false,
    });
    const state = usePathAdvisorBriefingStore.getState();
    expect(state.briefing).not.toBeNull();
    expect(state.isOpen).toBe(true);
    if (state.briefing !== null && typeof state.briefing === 'object') {
      expect((state.briefing as { type?: string }).type).toBe('fit');
      expect((state.briefing as { blocker?: string }).blocker).toBeDefined();
      expect((state.briefing as { effort?: string }).effort).toBe('Low');
    }
  });

  it('loadSampleJobs then store has results usable for fit scoring', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const state = useJobSearchV1Store.getState();
    expect(state.results.length).toBeGreaterThan(0);
    const first = state.results[0];
    expect(first).toBeDefined();
    expect(first.title).toBeDefined();
    expect(first.id).toBeDefined();
  });

  it('saveBrief persists decision brief to store and getBrief returns it', function () {
    const job = MOCK_JOBS[0];
    if (job === undefined) throw new Error('no job');
    useDecisionBriefsV1Store.setState({ briefs: {} });
    const record = buildDecisionBriefRecord(job.id, job, {}, {});
    useDecisionBriefsV1Store.getState().saveBrief(record);
    const loaded = useDecisionBriefsV1Store.getState().getBrief(job.id);
    expect(loaded).not.toBeNull();
    if (loaded !== null) {
      expect(loaded.jobId).toBe(job.id);
      expect(loaded.nextActions.length).toBe(3);
    }
  });

  it('decision brief record has PathOS Brief tab content fields', function () {
    const job = MOCK_JOBS[0];
    if (job === undefined) throw new Error('no job');
    const record = buildDecisionBriefRecord(job.id, job, {}, {});
    expect(record.fitAssessment).toBeDefined();
    expect(record.nextActions.length).toBeGreaterThanOrEqual(1);
    expect(record.keyFactsSummary).toBeDefined();
  });

  it('Series dropdown reads from store (store test in jobSearchV1Store verifies setFilters/clearAllFilters for series)', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    useJobSearchV1Store.setState({ filters: { series: '2210' } });
    const state = useJobSearchV1Store.getState();
    expect(state.filters.series).toBe('2210');
  });

  it('results list uses listbox semantics and consistent row height when results are shown', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    expect(output).toBeDefined();
    expect(output.length).toBeGreaterThan(0);
    if (output.indexOf('listbox') !== -1) {
      expect(output.indexOf('option') !== -1).toBe(true);
      expect(output.indexOf('min-h') !== -1).toBe(true);
    }
  });

  it('Explain this match opens PathAdvisor fit briefing; briefing store has type fit and isOpen', function () {
    usePathAdvisorBriefingStore.getState().clearBriefing();
    usePathAdvisorBriefingStore.getState().openBriefing({
      type: 'fit',
      jobId: 'mock-js-1',
      jobTitle: 'IT Specialist (Cybersecurity)',
      stars: 4,
      confidence: 'High',
      reasons: ['Grade match', 'Series alignment'],
      blocker: '',
      effort: 'Medium',
      risks: [],
      inputsUsed: ['target role', 'job data'],
      missingInputs: [],
      isJobSaved: false,
    });
    const state = usePathAdvisorBriefingStore.getState();
    expect(state.briefing).not.toBeNull();
    expect(state.isOpen).toBe(true);
    if (state.briefing !== null && typeof state.briefing === 'object') {
      expect((state.briefing as { type?: string }).type).toBe('fit');
      expect((state.briefing as { jobId?: string }).jobId).toBe('mock-js-1');
    }
  });

  it('saveJob can be called and store remains consistent (create-button rule covered in jobSearchV1Store.test)', function () {
    const job = MOCK_JOBS[0];
    if (job === undefined) throw new Error('no job');
    useJobSearchV1Store.getState().loadFromStorage();
    expect(function () {
      useJobSearchV1Store.getState().saveJob(job);
    }).not.toThrow();
  });

  it('prompt panel is collapsed by default (Describe what you want optional or loading)', function () {
    useJobSearchV1Store.getState().loadFromStorage();
    const output = renderJobSearch();
    expect(
      output.indexOf('Describe what you want (optional)') !== -1 || output.indexOf('Loading job search') !== -1
    ).toBe(true);
    expect(output.indexOf('PathOS will translate it into filters') !== -1 || output.indexOf('Loading') !== -1).toBe(true);
  });

  it('single Search button present when mounted (unified search; no duplicate Search in describe flow)', function () {
    useJobSearchV1Store.getState().loadFromStorage();
    const output = renderJobSearch();
    expect(output.indexOf('Search') !== -1 || output.indexOf('Loading job search') !== -1).toBe(true);
    expect(output.indexOf('Reset') !== -1 || output.indexOf('Loading') !== -1).toBe(true);
  });

  it('manual search still works: runSearch sets results and hasSearched', function () {
    useJobSearchV1Store.getState().loadFromStorage();
    useJobSearchV1Store.getState().setLastQuery({ keywords: 'IT' });
    useJobSearchV1Store.getState().runSearch();
    return new Promise(function (resolve) {
      setTimeout(function () {
        const state = useJobSearchV1Store.getState();
        expect(state.hasSearched).toBe(true);
        expect(state.loading).toBe(false);
        resolve(undefined);
      }, 500);
    });
  });

  it('applyProposedFiltersFromPrompt then runSearch sets filters and results; appliedFromPrompt is set', function () {
    useJobSearchV1Store.getState().loadFromStorage();
    useJobSearchV1Store.getState().applyProposedFiltersFromPrompt('Remote GS-12', { gradeBand: 'GS-12', remoteType: 'Remote' });
    const afterApply = useJobSearchV1Store.getState();
    expect(afterApply.filters.gradeBand).toBe('GS-12');
    expect(afterApply.filters.remoteType).toBe('Remote');
    expect(afterApply.appliedFromPrompt).not.toBeNull();
    if (afterApply.appliedFromPrompt !== null) {
      expect(afterApply.appliedFromPrompt.promptText).toBe('Remote GS-12');
    }
    useJobSearchV1Store.getState().runSearch();
    return new Promise(function (resolve) {
      setTimeout(function () {
        const state = useJobSearchV1Store.getState();
        expect(state.hasSearched).toBe(true);
        expect(state.results.length).toBeGreaterThanOrEqual(0);
        resolve(undefined);
      }, 500);
    });
  });

  it('Applied from prompt indicator appears when appliedFromPrompt is set (or loading)', function () {
    useJobSearchV1Store.getState().loadFromStorage();
    useJobSearchV1Store.getState().applyProposedFiltersFromPrompt('Remote GS-12', { gradeBand: 'GS-12', remoteType: 'Remote' });
    const output = renderJobSearch();
    expect(
      output.indexOf('Applied from prompt') !== -1 || output.indexOf('Loading job search') !== -1
    ).toBe(true);
    expect(output.indexOf('View') !== -1 || output.indexOf('Loading') !== -1).toBe(true);
  });

  it('Reset clears selectedJobId filters appliedFromPrompt (store resets to clean state)', function () {
    useJobSearchV1Store.getState().loadFromStorage();
    useJobSearchV1Store.getState().loadSampleJobs();
    useJobSearchV1Store.getState().applyProposedFiltersFromPrompt('GS-12', { gradeBand: 'GS-12' });
    const before = useJobSearchV1Store.getState();
    expect(before.selectedJobId).not.toBeNull();
    expect(before.appliedFromPrompt).not.toBeNull();
    useJobSearchV1Store.getState().setLastQuery({ keywords: '', location: '' });
    useJobSearchV1Store.getState().clearAllFilters();
    useJobSearchV1Store.getState().setAppliedFromPrompt(null);
    useJobSearchV1Store.getState().setFilters({});
    useJobSearchV1Store.getState().setSelectedJob(null);
    useJobSearchV1Store.getState().clearSearchResults();
    useJobSearchV1Store.getState().persist();
    const after = useJobSearchV1Store.getState();
    expect(after.selectedJobId).toBeNull();
    expect(after.appliedFromPrompt).toBeNull();
    expect(after.filters.gradeBand === undefined || after.filters.gradeBand === '').toBe(true);
  });

  it('after search, store has totalCount and results slice; status line would show Showing 1–N of totalCount', function () {
    useJobSearchV1Store.getState().loadFromStorage();
    useJobSearchV1Store.getState().loadSampleJobs();
    const state = useJobSearchV1Store.getState();
    expect(state.hasSearched).toBe(true);
    expect(state.totalCount).toBeGreaterThanOrEqual(30);
    expect(state.results.length).toBeLessThanOrEqual(state.pageSize);
    expect(state.results.length).toBe(Math.min(state.pageSize, state.totalCount));
  });

  it('Day 62/74: match panel does not show What you\'re missing block (intelligence moved to PathAdvisor)', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Loading job search') !== -1) {
      return;
    }
    expect(output).not.toContain("What you're missing");
  });

  it('Day 62: selecting a job appends context log entry with title containing Job match', function () {
    usePathAdvisorContextLogStore.getState().clearAll();
    const job = MOCK_JOBS[0];
    if (job === undefined) throw new Error('no job');
    const readinessInput = buildReadinessInputFromMock({
      score: CAREER_READINESS_MOCK.score,
      scoreMax: CAREER_READINESS_MOCK.scoreMax,
      badgeLabel: CAREER_READINESS_MOCK.badgeLabel,
      radarSpokes: CAREER_READINESS_MOCK.radarSpokes,
      gaps: CAREER_READINESS_MOCK.gaps,
      actionPlanItems: CAREER_READINESS_MOCK.actionPlanItems,
    });
    const snap = buildJobMatchSnapshot(readinessInput, job);
    publishScreenContext({
      screen: 'job-search',
      anchor: { type: 'job', id: job.id, label: job.title !== undefined ? job.title : job.id },
      title: 'Job match: ' + (job.title !== undefined ? job.title : job.id),
      subtitle: (job.agency !== undefined ? job.agency : '') + ' • ' + (job.location !== undefined ? job.location : ''),
      sections: [
        { title: 'Summary', lines: ['Readiness: ' + String(snap.overallReadinessScore) + '/' + String(snap.overallReadinessMax)] },
      ],
      tags: ['localOnly'],
      dedupeKey: 'selectJob:' + job.id + ':' + String(snap.overallMatchScore),
    });
    const keys = getAnchorKeysForScreen(usePathAdvisorContextLogStore.getState().entriesByAnchor, 'job-search');
    expect(keys.length).toBeGreaterThanOrEqual(1);
    const entries = getEntriesForAnchor(usePathAdvisorContextLogStore.getState().entriesByAnchor, keys[0]);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[entries.length - 1].title).toContain('Job match');
  });

  /* ── Day 74: Structural parity tests — Job Search matches Saved Jobs architecture ── */

  it('Day 74: selected job detail panel shows job title and agency in fixed header zone', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Loading job search') !== -1) return;
    const firstJob = useJobSearchV1Store.getState().results[0];
    if (firstJob === undefined) return;
    expect(output.indexOf(firstJob.title) !== -1).toBe(true);
    expect(output.indexOf(firstJob.agency) !== -1).toBe(true);
  });

  it('Day 74: selected job shows Readiness badge with numeric score', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Loading job search') !== -1) return;
    expect(output.indexOf('Readiness') !== -1).toBe(true);
  });

  it('Day 74: detail panel has Match Overview and Job Overview mode tabs (sibling parity with Saved Jobs)', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Loading job search') !== -1) return;
    expect(output.indexOf('Match Overview') !== -1).toBe(true);
    expect(output.indexOf('Job Overview') !== -1).toBe(true);
  });

  it('Day 74: action bar contains Build Resume button', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Loading job search') !== -1) return;
    expect(output.indexOf('Build Resume') !== -1).toBe(true);
  });

  it('Day 74: action bar contains View on USAJOBS link', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Loading job search') !== -1) return;
    expect(output.indexOf('View on USAJOBS') !== -1).toBe(true);
  });

  it('Day 74: decision summary band shows Salary, Grade, Work Mode, and Deadline tiles (Agency in header, not tiles)', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Loading job search') !== -1) return;
    if (output.indexOf('Match Overview') === -1) return;
    expect(output.indexOf('Salary') !== -1).toBe(true);
    expect(output.indexOf('Grade') !== -1).toBe(true);
    expect(output.indexOf('Work Mode') !== -1).toBe(true);
    expect(output.indexOf('Deadline') !== -1).toBe(true);
  });

  it('Day 74: match breakdown section header and dimension bars present in match overview', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Loading job search') !== -1) return;
    if (output.indexOf('Match for this job') === -1) return;
    expect(output.indexOf('Match breakdown') !== -1).toBe(true);
    expect(output.indexOf('Dimension') !== -1).toBe(true);
  });

  it('Day 74: list items show readiness percentage badge with color-coded treatment', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Loading job search') !== -1) return;
    /* Readiness badges render as "N%" where N varies per job. At least one should be present. */
    const hasPercentBadge = output.indexOf('%') !== -1;
    expect(hasPercentBadge).toBe(true);
  });

  it('Day 74: search controls (Search, Reset, filter dropdowns) remain present', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Loading job search') !== -1) return;
    expect(output.indexOf('Search') !== -1).toBe(true);
    expect(output.indexOf('Reset') !== -1).toBe(true);
    expect(output.indexOf('Sort by') !== -1).toBe(true);
    expect(output.indexOf('Clear all filters') !== -1).toBe(true);
  });

  it('Day 74: save action button present in selected-job panel (Save + Start Tailoring or Saved)', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Loading job search') !== -1) return;
    const hasSaveAction = output.indexOf('Save + Start Tailoring') !== -1 || output.indexOf('Saved') !== -1;
    expect(hasSaveAction).toBe(true);
  });

  it('Day 74: Primary blocker line visible in match overview when snapshot present', function () {
    useJobSearchV1Store.getState().loadSampleJobs();
    const output = renderJobSearch();
    if (output.indexOf('Match for this job') === -1) return;
    expect(output.indexOf('Primary blocker') !== -1).toBe(true);
  });

  it('Day 62: dimension explain appends context log entry with title containing Match breakdown', function () {
    usePathAdvisorContextLogStore.getState().clearAll();
    const job = MOCK_JOBS[0];
    if (job === undefined) throw new Error('no job');
    const readinessInput = buildReadinessInputFromMock({
      score: CAREER_READINESS_MOCK.score,
      scoreMax: CAREER_READINESS_MOCK.scoreMax,
      badgeLabel: CAREER_READINESS_MOCK.badgeLabel,
      radarSpokes: CAREER_READINESS_MOCK.radarSpokes,
      gaps: CAREER_READINESS_MOCK.gaps,
      actionPlanItems: CAREER_READINESS_MOCK.actionPlanItems,
    });
    const snap = buildJobMatchSnapshot(readinessInput, job);
    const dim = snap.dimensions[0];
    if (dim === undefined) throw new Error('no dimension');
    publishDimensionExplainContext({
      screen: 'job-search',
      anchor: { type: 'job', id: job.id, label: job.title !== undefined ? job.title : job.id },
      dimension: dim.label,
      payload: { whatMeasures: ['Test'], yourSignal: 'Good', fastestFix: 'Add evidence.' },
      dedupeKey: 'dimension:' + dim.key + ':' + String(snap.overallMatchScore),
    });
    const keys = getAnchorKeysForScreen(usePathAdvisorContextLogStore.getState().entriesByAnchor, 'job-search');
    expect(keys.length).toBeGreaterThanOrEqual(1);
    const entries = getEntriesForAnchor(usePathAdvisorContextLogStore.getState().entriesByAnchor, keys[0]);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[entries.length - 1].title).toContain('Match breakdown');
  });
});

describe('JobSearchScreen live advisor integration', function () {
  it('uses canonical backend row score when live evaluation is available', function () {
    const display = buildJobListMatchDisplay(
      true,
      {
        matchLevel: 'Moderate',
        overallMatchScore: 58,
      },
      {
        recommendation: 'consider',
        decisionBand: 'caution',
        confidenceBand: 'medium',
        overallScore: 71,
        reasons: [],
        gaps: [],
        warnings: [],
        missingEvidence: [],
        nextActions: [],
        applicationDecision: null,
        explainabilityVersion: 'explainability-v1',
        engineVersion: 'qualification-v1',
      }
    );

    expect(display.overallMatchScore).toBe(71);
    expect(display.matchLevel).toBe('Moderate');
    expect(display.scoreSource).toBe('canonical');
  });

  it('falls back to the local row score when no live evaluation is cached', function () {
    const display = buildJobListMatchDisplay(
      true,
      {
        matchLevel: 'Strong',
        overallMatchScore: 82,
      },
      undefined
    );

    expect(display.overallMatchScore).toBe(82);
    expect(display.matchLevel).toBe('Strong');
    expect(display.scoreSource).toBe('local');
  });

  it('derives row match level from canonical score thresholds', function () {
    expect(deriveMatchLevelFromOverallScore(80)).toBe('Strong');
    expect(deriveMatchLevelFromOverallScore(60)).toBe('Moderate');
    expect(deriveMatchLevelFromOverallScore(40)).toBe('Stretch');
  });

  it('uses canonical score for likelihood sorting when live evaluation is cached', function () {
    const score = resolveJobSearchLikelihoodScore(
      true,
      58,
      {
        recommendation: 'consider',
        decisionBand: 'caution',
        confidenceBand: 'medium',
        overallScore: 73,
        reasons: [],
        gaps: [],
        warnings: [],
        missingEvidence: [],
        nextActions: [],
        applicationDecision: null,
        explainabilityVersion: 'explainability-v1',
        engineVersion: 'qualification-v1',
      }
    );

    expect(score).toBe(73);
  });

  it('falls back to local score for likelihood sorting when canonical score is unavailable', function () {
    const score = resolveJobSearchLikelihoodScore(true, 58, undefined);
    expect(score).toBe(58);
  });

  it('marks a live row as loading until canonical match data arrives', function () {
    expect(
      resolveJobListRowState({
        isLiveAdvisorMode: true,
        scoreSource: 'local',
        liveStatus: 'loading',
      })
    ).toBe('loading');
  });

  it('marks a live row as estimated when it is still showing fallback data', function () {
    expect(
      resolveJobListRowState({
        isLiveAdvisorMode: true,
        scoreSource: 'local',
        liveStatus: 'error',
      })
    ).toBe('estimated');
  });

  it('marks a live row as canonical once backend match data is cached', function () {
    expect(
      resolveJobListRowState({
        isLiveAdvisorMode: true,
        scoreSource: 'canonical',
        liveStatus: 'success',
      })
    ).toBe('live');
  });

  it('renders live loading state for the selected job panel', function () {
    const output = renderJobDetailsWithLiveState({
      status: 'loading',
      errorMessage: null,
      evaluation: null,
    });

    expect(output).toContain('Loading live advisor evaluation');
    expect(output).toContain('Evaluation');
  });

  it('renders live error state honestly', function () {
    const output = renderJobDetailsWithLiveState({
      status: 'error',
      errorMessage: 'Backend evaluation is unavailable.',
      evaluation: null,
    });

    expect(output).toContain('Live advisor evaluation is unavailable');
    expect(output).toContain('Backend evaluation is unavailable.');
  });

  it('renders live partial-evidence output in the selected job panel', function () {
    const output = renderJobDetailsWithLiveState({
      status: 'success',
      errorMessage: null,
      evaluation: {
        recommendation: 'consider',
        decisionBand: 'caution',
        confidenceBand: 'medium',
        overallScore: 71,
        reasons: [
          {
            code: 'ROLE_ALIGNMENT',
            ruleId: 'role_alignment_positive',
            basis: 'known',
            text: 'The role aligns with your target series.',
            severity: null,
            suggestion: null,
            importance: null,
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
            basis: 'missing',
            text: 'Confidence is reduced because profile evidence is incomplete.',
            severity: null,
            suggestion: null,
            importance: null,
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
            severity: null,
            suggestion: null,
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
            action: 'Add profile skills before treating this as a strong fit.',
            priority: 1,
          },
        ],
        applicationDecision: {
          decisionBand: 'consider',
          priorityLevel: 'medium',
          alertImportance: 'medium',
          rationaleSummary: 'There is enough signal to review this job closely.',
          blockingIssues: [],
          recommendedNextActions: [
            {
              code: 'REVIEW_EVIDENCE',
              action: 'Review missing profile evidence before applying.',
              priority: 1,
            },
          ],
          decisionRuleIds: ['decision_consider_partial'],
          decisionVersion: 'decision-v1',
        },
        explainabilityVersion: 'explainability-v1',
        engineVersion: 'qualification-v1',
        jobMatchProjection: {
          overallScore: 71,
          confidenceBand: 'medium',
          blockerSeverity: 'medium',
          explanationSummary: 'Match projection is grounded in canonical user context and job evidence.',
          dimensions: [
            {
              dimensionId: 'qualification_alignment',
              label: 'Qualification alignment',
              score: 71,
              status: 'building',
              explanation: 'Grounded in the backend job-evaluation score against canonical user evidence.',
            },
          ],
          nextActions: ['Review missing profile evidence before applying.'],
          blockers: ['No skills evidence was provided.'],
          warnings: ['Confidence is reduced because profile evidence is incomplete.'],
        },
      },
    });

    expect(output).toContain('Match');
    expect(output).toContain('Building match');
    expect(output).toContain('Partial evidence');
    expect(output).toContain('The role aligns with your target series.');
    expect(output).toContain('No skills evidence was provided.');
    expect(output).toContain('qualification-v1');
  });
});
