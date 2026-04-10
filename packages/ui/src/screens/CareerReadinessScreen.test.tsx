/**
 * Career Readiness screen tests: smoke render of title, score, and key sections.
 * Per testing-standards: optional for pure UI; minimal smoke test for regression.
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  NavigationProvider,
  type NavigationAdapter,
  type NavLinkProps,
} from '@pathos/adapters';
import { usePathAdvisorScreenOverridesStore } from '../stores/pathAdvisorScreenOverridesStore';
import { CareerReadinessScreen } from './CareerReadinessScreen';
import type { UnifiedCareerResumeIntelligenceState } from '../intelligence/careerResumeIntelligence';

function noop() {
  /* mock */
}

const testAdapter: NavigationAdapter = {
  pathname: '/dashboard/career-readiness',
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

function renderScreen(element: React.ReactNode) {
  return renderToString(
    <NavigationProvider adapter={testAdapter} linkComponent={TestLink}>
      {element}
    </NavigationProvider>
  );
}

describe('CareerReadinessScreen', function () {
  beforeEach(function () {
    usePathAdvisorScreenOverridesStore.getState().setOverrides(null);
  });

  it('renders title, subtitle, primary score, and key text', function () {
    const output = renderScreen(<CareerReadinessScreen />);
    expect(output).toContain('Career Readiness');
    expect(output).toContain('Your competitiveness baseline for federal roles.');
    expect(output).toContain('74');
    expect(output).toContain('100');
    expect(output).toContain('Competitive with improvements');
    expect(output).toContain('Baseline competitiveness across common federal roles.');
  });

  it('renders Readiness Trajectory and Readiness Radar cards', function () {
    const output = renderScreen(<CareerReadinessScreen />);
    expect(output).toContain('Readiness Trajectory');
    expect(output).toContain('Readiness Radar');
    expect(output).toContain('Top gaps holding you back');
  });

  it('renders READINESS RADAR section and all 5 radar indicator labels', function () {
    const output = renderScreen(<CareerReadinessScreen />);
    expect(output).toContain('Readiness Radar');
    expect(output).toContain('Target Alignment');
    expect(output).toContain('Specialized Experience');
    expect(output).toContain('Resume Evidence');
    expect(output).toContain('Keywords Coverage');
    expect(output.indexOf('Leadership') !== -1 && output.indexOf('Scope') !== -1).toBe(true);
    expect(output).toContain('Leadership &amp; Scope');
  });

  it('renders trajectory legend (Actual, Possible) and trust microcopy', function () {
    const output = renderScreen(<CareerReadinessScreen />);
    expect(output).toContain('Actual');
    expect(output).toContain('Possible');
    expect(output).toContain('Actual shows your progress over time. Possible shows where you could be if you complete selected actions. Local-only.');
  });

  it('renders Action Plan and Evidence & Inputs section', function () {
    const output = renderScreen(<CareerReadinessScreen />);
    expect(output).toContain('Action Plan');
    expect(output).toContain('Projected readiness');
    expect(output.indexOf('Evidence') !== -1 && output.indexOf('Inputs') !== -1).toBe(true);
    expect(output).toContain('See what inputs were used for scoring.');
  });

  it('renders live career-readiness content when unified intelligence is provided', function () {
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
        overall_score: 81,
        label: 'Ready to compete',
        target_role: 'GS-7 Program Analyst (0343)',
        spokes: {
          target_alignment: 80,
          specialized_experience: 78,
          resume_evidence: 76,
          keywords: 74,
          leadership_scope: 70,
          qualification: 88,
        },
        top_gaps: [
          {
            key: 'transcript',
            title: 'Transcript documentation',
            impact_points: 6,
            reason: 'Official transcript evidence is still missing.',
          },
        ],
        action_plan: [
          {
            key: 'transcript',
            title: 'Upload transcript',
            impact_points: 6,
            effort: 'S',
            helper: 'Add the transcript that supports your education-substitution path.',
          },
        ],
        reasons: [
          {
            code: 'qualification',
            message: 'Qualification evidence is strong for the target grade.',
          },
        ],
        evidence_used: [
          {
            key: 'education',
            label: 'Education level',
            source_type: 'profile_field',
          },
        ],
        missing_evidence: [],
      },
      resumeReadiness: null,
      workspaceResume: {
        id: 'resume-1',
        name: 'Program Analyst Resume',
        mode: 'master',
        updatedAt: '2026-04-09T12:00:00Z',
        targetRoleTitle: 'GS-7 Program Analyst (0343)',
      },
      refresh: function () {
        /* noop */
      },
    };

    const output = renderScreen(<CareerReadinessScreen intelligence={intelligence} />);
    expect(output).toContain('81');
    expect(output).toContain('Ready to compete');
    expect(output).toContain('Live backend');
    expect(output).toContain('GS-7 Program Analyst (0343)');
    expect(output).toContain('Transcript documentation');
    expect(output).toContain('Upload transcript');
  });
});
