import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  findSectionExplanation,
  hasResumeExplanations,
  KeyTakeawaysPanel,
  PathAdvisorSummary,
  RecommendationList,
  SectionGuidance,
  WarningExplanationList,
} from './PathAdvisorResumeGuidance';
import type {
  ResumeDiagnosticsExplanations,
  ResumeDiagnosticsRecommendation,
} from './resumeDiagnostics';

function buildExplanations(): ResumeDiagnosticsExplanations {
  return {
    overall_summary: {
      headline: 'Your resume is close, but the experience section needs stronger evidence.',
      detail: 'PathAdvisor is rendering backend explanation text instead of raw diagnostics prose.',
      top_priority: 'Rewrite the strongest experience bullets around measurable outcomes.',
    },
    key_takeaways: [
      {
        takeaway_id: 'takeaway-1',
        title: 'Strengthen the experience bullets first',
        detail: 'That is the fastest path to a stronger review result.',
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
        title: 'Experience needs stronger proof',
        what_is_wrong: 'Several bullets describe duties but not outcomes.',
        why_it_matters: 'Reviewers need clearer evidence of impact.',
        what_to_do: 'Rewrite the top bullets to show concrete results.',
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
        title: 'Tighten the top experience bullets',
        short_explanation: 'This recommendation aligns directly to the current backend summary.',
        action_hint: 'Open the experience section and replace responsibility-heavy lines.',
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
        code: 'warn-1',
        title: 'Target context is still thin',
        detail: 'Adding more target context would sharpen later guidance.',
      },
    ],
  };
}

function buildDiagnosticsRecommendations(): ResumeDiagnosticsRecommendation[] {
  return [
    {
      code: 'REWRITE_FOR_OUTCOME',
      priority: 1,
      title: 'Tighten the top experience bullets',
      detail: 'Rewrite the first bullet around the result.',
      target_refs: [
        {
          section_id: 'experience',
          bullet_id: 'exp-seed-1-bullet-1',
        },
      ],
    },
    {
      code: 'REWRITE_FOR_OUTCOME',
      priority: 2,
      title: 'Rewrite the actual targeted experience bullet',
      detail: 'Rewrite the bullet that matches the explanation target.',
      target_refs: [
        {
          section_id: 'experience',
          bullet_id: 'exp-seed-1-bullet-0',
        },
      ],
    },
  ];
}

describe('PathAdvisorResumeGuidance', function () {
  it('detects explanation availability and maps section guidance', function () {
    const explanations = buildExplanations();

    expect(hasResumeExplanations(explanations)).toBe(true);
    expect(findSectionExplanation(explanations, 'experience')).not.toBeNull();
    expect(findSectionExplanation(explanations, 'skills')).toBeNull();
  });

  it('renders summary, takeaways, section guidance, recommendations, and warnings', function () {
    const explanations = buildExplanations();
    const output = renderToString(
      <div>
        <PathAdvisorSummary
          explanations={explanations}
          fallbackHeadline="Fallback headline"
          fallbackDetail="Fallback detail"
          statusLabel="Resume explanation"
        />
        <KeyTakeawaysPanel explanations={explanations} />
        <SectionGuidance explanation={findSectionExplanation(explanations, 'experience')} />
        <RecommendationList
          explanations={explanations}
          diagnosticsRecommendations={buildDiagnosticsRecommendations()}
          canRequestRewrite={true}
          rewriteButtonLabel="Rewrite in Builder"
          emptyMessage="No recommendations"
        />
        <WarningExplanationList explanations={explanations} />
      </div>
    );

    expect(output).toContain('Your resume is close, but the experience section needs stronger evidence.');
    expect(output).toContain('Strengthen the experience bullets first');
    expect(output).toContain('Experience needs stronger proof');
    expect(output).toContain('What to do');
    expect(output).toContain('Tighten the top experience bullets');
    expect(output).toContain('Rewrite in Builder');
    expect(output).toContain('Target context is still thin');
  });

  it('renders builder-attached section guidance copy when requested', function () {
    const explanations = buildExplanations();
    const output = renderToString(
      <SectionGuidance
        explanation={findSectionExplanation(explanations, 'experience')}
        variant="builder"
        attachmentLabel="Attached to Experience"
      />
    );

    expect(output).toContain('Attached guidance');
    expect(output).toContain('Attached to Experience');
  });

  it('fails soft when explanation fields are missing', function () {
    const explanations = buildExplanations();
    explanations.overall_summary = null;
    explanations.key_takeaways = [];
    explanations.recommendation_explanations = [];
    explanations.warning_explanations = [];

    const output = renderToString(
      <div>
        <PathAdvisorSummary
          explanations={explanations}
          fallbackHeadline="Fallback headline"
          fallbackDetail="Fallback detail"
        />
        <KeyTakeawaysPanel explanations={explanations} />
        <RecommendationList
          explanations={explanations}
          emptyMessage="No recommendations"
        />
      </div>
    );

    expect(output).toContain('Fallback headline');
    expect(output).toContain('Fallback detail');
    expect(output).toContain('PathAdvisor key takeaways will appear here when the backend includes them.');
    expect(output).toContain('No recommendations');
  });
});
