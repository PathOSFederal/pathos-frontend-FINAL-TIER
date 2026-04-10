/**
 * ============================================================================
 * CAREER SCREEN TESTS — Lock key behavior (title/sections, disabled Tailoring CTA)
 * ============================================================================
 *
 * Minimal high-signal tests per testing-standards: (1) Renders title and key
 * sections. (2) Tailoring CTA is disabled when no job selected (demoState
 * other than tailorReadyWithJob).
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  NavigationProvider,
  type NavigationAdapter,
  type NavLinkProps,
} from '@pathos/adapters';
import { useCareerResumeScreenStore } from '../stores/careerResumeScreenStore';
import { CareerScreen } from './CareerScreen';
import type { UnifiedCareerResumeIntelligenceState } from '../intelligence/careerResumeIntelligence';

function noop() {
  /* mock */
}

const testAdapter: NavigationAdapter = {
  pathname: '/dashboard/career',
  push: noop,
  replace: noop,
  back: function () {
    /* mock */
  },
};

function TestLink(props: NavLinkProps) {
  return (
    <a
      href={props.href}
      className={props.className}
      onClick={props.onClick}
      data-tour={props['data-tour']}
    >
      {props.children}
    </a>
  );
}

function renderCareer(element: React.ReactNode) {
  return renderToString(
    <NavigationProvider adapter={testAdapter} linkComponent={TestLink}>
      {element}
    </NavigationProvider>
  );
}

describe('CareerScreen', function () {
  beforeEach(function () {
    useCareerResumeScreenStore.getState().resetSeeded();
  });

  it('renders Resume Readiness title and key sections', function () {
    const output = renderCareer(<CareerScreen />);
    expect(output).toContain('Resume Readiness');
    expect(output).toContain('Keep your story complete, tailored, and ready to submit.');
    expect(output).toMatch(/TODAY.*BEST MOVE/);
    expect(output).toContain('RESUME READINESS');
    expect(output).toContain('YOUR RESUMES');
    expect(output).toContain('REFERRAL READINESS CHECK');
    expect(output).toContain('TAILORING WORKSPACE');
    expect(output).toContain('CAREER NARRATIVE');
    expect(output).toContain('PROOF LIBRARY');
    expect(output).toContain('Reusable evidence you can drop into bullets and tailoring');
    expect(output).toContain('STAR stories');
    expect(output).toContain('Bullet bank');
    expect(output).toContain('Metrics');
  });

  it('renders Proof Library with three panels (STAR stories, Bullet bank, Metrics)', function () {
    const output = renderCareer(<CareerScreen />);
    expect(output).toContain('PROOF LIBRARY');
    expect(output).toContain('STAR stories');
    expect(output).toContain('Bullet bank');
    expect(output).toContain('Metrics');
    expect(output).toContain('Add STAR story');
    expect(output).toContain('Add bullet');
    expect(output).toContain('Add metric');
    expect(output).toContain('Import from notes (optional)');
  });

  it('renders Referral Readiness Check card (not Linter Findings)', function () {
    const output = renderCareer(<CareerScreen demoState="incompleteResume" />);
    expect(output).toContain('REFERRAL READINESS CHECK');
    expect(output).toContain('Quick issues that could lower your referral odds');
    expect(output).not.toContain('LINTER FINDINGS');
  });

  it('renders YOUR RESUMES section and Tailoring Workspace with target job picker', function () {
    const output = renderCareer(<CareerScreen demoState="incompleteResume" />);
    expect(output).toContain('YOUR RESUMES');
    expect(output).toContain('Target job');
    expect(output).toContain('Select a saved job');
    expect(output).toContain('Start Tailoring');
  });

  it('disables Start Tailoring when no target job selected', function () {
    const output = renderCareer(<CareerScreen demoState="incompleteResume" />);
    expect(output).toContain('Start Tailoring');
    expect(output).toContain('disabled');
  });

  it('renders Tailoring Workspace with Target job picker and Start Tailoring', function () {
    const output = renderCareer(<CareerScreen demoState="tailorReadyWithJob" />);
    expect(output).toContain('Target job');
    expect(output).toContain('Start Tailoring');
    expect(output).toContain('Select a saved job');
  });

  it('renders YOUR RESUMES empty state when no resumes (SSR does not seed store)', function () {
    const output = renderCareer(<CareerScreen demoState="incompleteResume" />);
    expect(output).toContain('YOUR RESUMES');
    expect(output).toContain('No resume yet');
  });

  it('renders live unified intelligence on the resume-readiness surface', function () {
    const intelligence: UnifiedCareerResumeIntelligenceState = {
      source: 'live',
      isRefreshing: false,
      lastUpdatedLabel: 'Apr 9, 2026, 8:30 AM',
      errorMessage: null,
      careerReadiness: {
        meta: {
          snapshot_id: 'career-1',
          generated_at: '2026-04-09T12:30:00Z',
          input_hash: 'hash-1',
          rule_version: 'rules-1',
          knowledge_pack_version: 'pack-1',
          kind: 'career_readiness',
        },
        overall_score: 74,
        label: 'Competitive with targeted improvements',
        target_role: 'GS-12 Program Analyst (0343)',
        spokes: {
          qualification: 80,
        },
        top_gaps: [
          {
            key: 'transcript',
            title: 'Transcript documentation',
            impact_points: 5,
            reason: 'Transcript evidence is still required for one qualification path.',
          },
        ],
        action_plan: [],
        reasons: [],
        evidence_used: [],
        missing_evidence: [],
      },
      resumeReadiness: {
        meta: {
          snapshot_id: 'resume-1',
          generated_at: '2026-04-09T12:31:00Z',
          input_hash: 'hash-2',
          rule_version: 'rules-1',
          knowledge_pack_version: 'pack-1',
          kind: 'resume_readiness',
        },
        overall_score: 68,
        target_role: 'GS-12 Program Analyst (0343)',
        categories: {
          clarity: 70,
          evidence: 64,
        },
        suggestions: [
          {
            key: 'dates',
            title: 'Add employment dates',
            impact_points: 6,
            example: 'List start and end dates for each federal role.',
          },
        ],
        reasons: [],
        evidence_used: [],
        missing_evidence: [
          {
            key: 'employment_dates',
            label: 'Employment dates',
            why_it_matters: 'Federal review needs dates to evaluate experience chronology.',
          },
        ],
      },
      workspaceResume: {
        id: 'resume-1',
        name: 'Program Analyst Resume',
        mode: 'master',
        updatedAt: '2026-04-09T12:00:00Z',
        targetRoleTitle: 'GS-12 Program Analyst (0343)',
      },
      refresh: function () {
        /* noop */
      },
    };

    const output = renderCareer(<CareerScreen intelligence={intelligence} />);
    expect(output).toContain('Live intelligence');
    expect(output).toContain('68% Ready');
    expect(output).toContain('Employment dates');
    expect(output).toContain('GS-12 Program Analyst (0343)');
    expect(output).toContain('Program Analyst Resume');
    expect(output).toContain('Open Resume Workspace');
  });
});
