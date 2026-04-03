/**
 * ============================================================================
 * PATHADVISOR GOVERNED PANEL TESTS
 * ============================================================================
 *
 * PURPOSE:
 * Prove the shared rail renders the governed PathAdvisor contract honestly.
 * These tests stay structural and deterministic so they run quickly.
 *
 * WHY THESE TESTS MATTER:
 * The governed PathAdvisor UX should never rely on "vibes" from freeform text.
 * These assertions lock in the visible trust cues that come from explicit
 * backend fields:
 * - incomplete is visibly incomplete
 * - refused is intentional, not broken
 * - technical failure is still separate
 * - refresh states stay stable instead of flashing empty
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PathAdvisorGovernedPanel } from './PathAdvisorGovernedPanel';
import type {
  PathAdvisorGovernedDraft,
  PathAdvisorShapedResponse,
  PathAdvisorGovernedResultState,
} from './pathadvisor-governed-types';

function buildDraft(): PathAdvisorGovernedDraft {
  return {
    domain: 'qualification',
    qualification: {
      yearsExperience: '5',
      targetRoles: 'Program Analyst',
      skills: 'analysis',
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

function renderPanel(state: PathAdvisorGovernedResultState): string {
  return renderToString(
    <PathAdvisorGovernedPanel
      draft={buildDraft()}
      result={state}
      onDraftChange={function () {
        /* noop */
      }}
      onSubmit={function () {
        /* noop */
      }}
    />
  );
}

function buildGroundedResponse(): PathAdvisorShapedResponse {
  return {
    domain: 'qualification',
    responseState: 'grounded',
    grounded: true,
    summary: 'You have enough qualification signal for a governed answer.',
    explanation: 'The governed qualification pack aligns with your supplied experience and skills.',
    keyFactors: [
      {
        factorType: 'finding',
        label: 'Experience aligns',
        detail: 'Five years of experience supports the request.',
        code: 'experience_alignment',
        severity: 'low',
      },
    ],
    missingInputs: [],
    nextSteps: ['Review the target role duties before applying.'],
    refusalReason: null,
    packVersionId: 'pack-version-1',
    freshnessState: 'fresh',
    grounding: {
      domain: 'qualification',
      responseState: 'grounded',
      grounded: true,
      partial: false,
      refusalReason: null,
      missingInputs: [],
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
      servingEligible: true,
      sourceSummary: null,
      conversationProvider: 'fake-provider',
      providerUsed: true,
      refusalDomain: null,
      domains: [
        {
          domain: 'qualification',
          responseState: 'grounded',
          grounded: true,
          partial: false,
          refusalReason: null,
          missingInputs: [],
          packId: 'pack-1',
          packKey: 'qualification.pack',
          versionId: 'pack-version-1',
          version: 1,
          freshnessState: 'fresh',
          freshnessReason: 'Fresh.',
        },
      ],
    },
    servedAt: '2026-04-01T12:00:00Z',
  };
}

describe('PathAdvisorGovernedPanel', function () {
  it('renders the idle state with bounded request guidance', function () {
    const output = renderPanel({
      status: 'idle',
      response: null,
      errorMessage: null,
    });

    expect(output).toContain('pathadvisor-governed-idle');
    expect(output).toContain('Governed PathAdvisor is ready');
    expect(output).toContain('Governed request');
  });

  it('renders the loading state honestly', function () {
    const output = renderPanel({
      status: 'loading',
      response: null,
      errorMessage: null,
    });

    expect(output).toContain('pathadvisor-governed-loading');
    expect(output).toContain('Loading governed response');
  });

  it('renders the technical error state distinctly from refusal', function () {
    const output = renderPanel({
      status: 'error',
      response: null,
      errorMessage: 'Backend configuration is missing.',
    });

    expect(output).toContain('pathadvisor-governed-error');
    expect(output).toContain('Technical request failure');
    expect(output).toContain('Backend configuration is missing.');
  });

  it('renders the grounded state structurally', function () {
    const output = renderPanel({
      status: 'success',
      errorMessage: null,
      response: buildGroundedResponse(),
    });

    expect(output).toContain('pathadvisor-governed-success');
    expect(output).toContain('Summary');
    expect(output).toContain('Explanation');
    expect(output).toContain('Key factors');
    expect(output).toContain('Grounding and status');
    expect(output).toContain('Pack:');
    expect(output).toContain('pack-version-1');
  });

  it('renders partial responses as incomplete and points to missing inputs', function () {
    const output = renderPanel({
      status: 'success',
      errorMessage: null,
      response: {
        domain: 'fehb',
        responseState: 'partial',
        grounded: true,
        summary: 'This FEHB answer is partial.',
        explanation: 'Coverage type is known, but utilization is missing.',
        keyFactors: [],
        missingInputs: ['expected_utilization'],
        nextSteps: ['Add expected utilization to improve the answer.'],
        refusalReason: null,
        packVersionId: 'fehb-pack-version-1',
        freshnessState: 'aging',
        grounding: {
          domain: 'fehb',
          responseState: 'partial',
          grounded: true,
          partial: true,
          refusalReason: null,
          missingInputs: ['expected_utilization'],
          packId: 'fehb-pack',
          packKey: 'fehb.pack',
          versionId: 'fehb-pack-version-1',
          version: 1,
          freshnessState: 'aging',
          freshnessReason: 'Aging.',
          effectiveAt: null,
          reviewedAt: null,
          reviewBy: null,
          expiresAt: null,
          servingEligible: true,
          sourceSummary: null,
          conversationProvider: 'fake-provider',
          providerUsed: true,
          refusalDomain: null,
          domains: [
            {
              domain: 'fehb',
              responseState: 'partial',
              grounded: true,
              partial: true,
              refusalReason: null,
              missingInputs: ['expected_utilization'],
              packId: 'fehb-pack',
              packKey: 'fehb.pack',
              versionId: 'fehb-pack-version-1',
              version: 1,
              freshnessState: 'aging',
              freshnessReason: 'Aging.',
            },
          ],
        },
        servedAt: '2026-04-01T12:00:00Z',
      },
    });

    expect(output).toContain('Incomplete');
    expect(output).toContain('pathadvisor-partial-signal');
    expect(output).toContain('This answer is incomplete because governed inputs are still missing.');
    expect(output).toContain('These backend-provided inputs are the reason this governed answer is not complete yet.');
    expect(output).toContain('Expected utilization');
    expect(output).toContain('Review FEHB inputs');
    expect(output).toContain('Path to completion');
  });

  it('renders refused responses as intentional trust boundaries', function () {
    const output = renderPanel({
      status: 'success',
      errorMessage: null,
      response: {
        domain: 'cross_domain',
        responseState: 'refused',
        grounded: false,
        summary: 'Cross-domain reasoning is unavailable.',
        explanation: 'A required governed domain is unavailable for this request.',
        keyFactors: [],
        missingInputs: [],
        nextSteps: ['Try again when the governed FEHB pack is available.'],
        refusalReason: 'cross_domain_fehb_unavailable',
        packVersionId: null,
        freshnessState: null,
        grounding: {
          domain: 'cross_domain',
          responseState: 'refused',
          grounded: false,
          partial: false,
          refusalReason: 'cross_domain_fehb_unavailable',
          missingInputs: [],
          packId: null,
          packKey: null,
          versionId: null,
          version: null,
          freshnessState: null,
          freshnessReason: null,
          effectiveAt: null,
          reviewedAt: null,
          reviewBy: null,
          expiresAt: null,
          servingEligible: false,
          sourceSummary: null,
          conversationProvider: 'fake-provider',
          providerUsed: false,
          refusalDomain: 'fehb',
          domains: [
            {
              domain: 'qualification',
              responseState: 'grounded',
              grounded: true,
              partial: false,
              refusalReason: null,
              missingInputs: [],
              packId: 'qualification-pack',
              packKey: 'qualification.pack',
              versionId: 'qualification-version-1',
              version: 1,
              freshnessState: 'fresh',
              freshnessReason: 'Fresh.',
            },
            {
              domain: 'fehb',
              responseState: 'refused',
              grounded: false,
              partial: false,
              refusalReason: 'cross_domain_fehb_unavailable',
              missingInputs: [],
              packId: null,
              packKey: null,
              versionId: null,
              version: null,
              freshnessState: null,
              freshnessReason: null,
            },
          ],
        },
        servedAt: '2026-04-01T12:00:00Z',
      },
    });

    expect(output).toContain('Refused');
    expect(output).toContain('pathadvisor-refused-signal');
    expect(output).toContain('Refusal boundary');
    expect(output).toContain('PathAdvisor is intentionally not answering this request yet.');
    expect(output).toContain('cross_domain_fehb_unavailable');
    expect(output).toContain('This is an intentional trust boundary, not a technical failure.');
    expect(output).toContain('Path to completion');
    expect(output).not.toContain('Technical request failure');
  });

  it('keeps the last governed answer visible while a refresh is loading', function () {
    const output = renderPanel({
      status: 'loading',
      errorMessage: null,
      response: buildGroundedResponse(),
    });

    expect(output).toContain('pathadvisor-governed-loading');
    expect(output).toContain('Refreshing governed response');
    expect(output).toContain('The last response stays visible until the updated request returns.');
    expect(output).toContain('You have enough qualification signal for a governed answer.');
  });
});
