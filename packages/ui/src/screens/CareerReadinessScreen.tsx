/**
 * ============================================================================
 * CAREER READINESS SCREEN — Competitiveness baseline for federal roles
 * ============================================================================
 *
 * BOUNDARY RULE: No next/* or electron/* imports.
 *
 * Layout: title row with header controls; primary score card; two-column
 * (Readiness Trajectory chart, Readiness Radar + gaps); Action Plan card;
 * Evidence & Inputs collapsible. PathAdvisor rail overrides set on mount
 * (Viewing: Career Readiness, INSIGHT + NEXT BEST ACTION). Local-only mock data.
 */

'use client';

import type React from 'react';
import { useEffect, useState, useCallback } from 'react';
import {
  Cog,
  RefreshCw,
  TrendingUp,
  Radar,
  ClipboardList,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { ModuleCard } from '../components/ModuleCard';
import { FilterDropdown } from './_components/FilterDropdown';
import { usePathAdvisorScreenOverridesStore } from '../stores/pathAdvisorScreenOverridesStore';
import { INTERACTIVE_HOVER_CLASS } from '../styles/interactiveHover';
import {
  CAREER_READINESS_MOCK,
  type CareerReadinessMockData,
  type ActionPlanItem,
  type ReadinessGap,
  type RadarSpoke,
  type TrajectoryData,
} from './careerReadiness/careerReadinessMockData';
import { ReadinessTrajectoryEChart } from './careerReadiness/ReadinessTrajectoryEChart';
import { ReadinessRadarEChart } from './careerReadiness/ReadinessRadarEChart';
import { publishScreenContext } from '../lib/pathAdvisorPublish';
import type { UnifiedCareerResumeIntelligenceState } from '../intelligence/careerResumeIntelligence';

// ---------------------------------------------------------------------------
// Target role dropdown options (header)
// ---------------------------------------------------------------------------

const TARGET_ROLE_OPTIONS = [
  { value: 'general', label: 'General readiness (recommended)' },
];

/** One line of context under the score badge based on selected target role. */
function getTargetRoleMicrocopy(value: string): string {
  if (value === 'general') {
    return 'Baseline competitiveness across common federal roles.';
  }
  if (value.indexOf('GS-13') !== -1 && value.indexOf('Program') !== -1) {
    return 'Competitiveness for GS-13 Program Analyst (0343) roles.';
  }
  return 'Baseline competitiveness across common federal roles.';
}

// ---------------------------------------------------------------------------
// Projected readiness: base + sum(selected impacts), clamp to 100
// ---------------------------------------------------------------------------

function computeProjectedScore(baseScore: number, selectedIds: Set<string>, items: ActionPlanItem[]): number {
  let sum = 0;
  for (let i = 0; i < items.length; i++) {
    if (selectedIds.has(items[i].id)) {
      sum += items[i].impact;
    }
  }
  const total = baseScore + sum;
  return total > 100 ? 100 : total;
}

function mapSpokeLabel(key: string): string {
  if (key === 'qualification') {
    return 'Qualification';
  }
  if (key === 'specialized_experience') {
    return 'Specialized Experience';
  }
  if (key === 'resume_evidence') {
    return 'Resume Evidence';
  }
  if (key === 'keywords') {
    return 'Keywords Coverage';
  }
  if (key === 'leadership_scope') {
    return 'Leadership & Scope';
  }
  if (key === 'target_alignment') {
    return 'Target Alignment';
  }
  return key
    .split('_')
    .map(function (part) {
      if (part.length === 0) {
        return '';
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

function buildLiveTrajectory(
  baseScore: number,
  selectedIds: Set<string>,
  items: ActionPlanItem[]
): TrajectoryData {
  const projectedScore = computeProjectedScore(baseScore, selectedIds, items);
  const midpointScore = Math.round(baseScore + (projectedScore - baseScore) * 0.5);

  return {
    actualPoints: [
      { label: 'Today', score: baseScore },
      { label: '3 mo', score: baseScore },
      { label: '6 mo', score: baseScore },
      { label: '12 mo', score: baseScore },
    ],
    possiblePoints: [
      { label: 'Today', score: baseScore },
      { label: '3 mo', score: midpointScore },
      { label: '6 mo', score: projectedScore },
      { label: '12 mo', score: projectedScore },
    ],
  };
}

function collectEvidenceLabels(
  intelligence: UnifiedCareerResumeIntelligenceState
): string[] {
  if (intelligence.careerReadiness === null) {
    return [];
  }

  const labels: string[] = [];
  for (let i = 0; i < intelligence.careerReadiness.evidence_used.length; i++) {
    const item = intelligence.careerReadiness.evidence_used[i];
    if (item.source_type !== 'profile_field') {
      continue;
    }
    if (labels.indexOf(item.label) === -1) {
      labels.push(item.label);
    }
  }
  return labels;
}

function collectResumeEvidenceLabel(
  intelligence: UnifiedCareerResumeIntelligenceState
): string {
  if (intelligence.careerReadiness === null) {
    return CAREER_READINESS_MOCK.evidenceResumeUsed;
  }

  for (let i = 0; i < intelligence.careerReadiness.evidence_used.length; i++) {
    const item = intelligence.careerReadiness.evidence_used[i];
    if (item.source_type === 'resume_section' || item.source_type === 'resume_bullet') {
      if (intelligence.workspaceResume !== null) {
        return intelligence.workspaceResume.name;
      }
      return 'Active Resume Workspace draft';
    }
  }

  return 'No resume evidence referenced';
}

interface CareerReadinessDisplayData extends CareerReadinessMockData {
  isLive: boolean;
  statusText: string;
  targetRoleMicrocopy: string;
  evidenceBanner: string;
}

function buildCareerReadinessDisplayData(
  intelligence: UnifiedCareerResumeIntelligenceState | undefined,
  selectedActionIds: Set<string>,
  targetRole: string
): CareerReadinessDisplayData {
  if (intelligence === undefined || intelligence.careerReadiness === null) {
    return {
      ...CAREER_READINESS_MOCK,
      isLive: false,
      statusText:
        intelligence !== undefined &&
        intelligence.errorMessage !== null &&
        intelligence.errorMessage.trim() !== ''
          ? 'Local fallback • Live snapshot unavailable'
          : 'Local-only • Updated 2 min ago',
      targetRoleMicrocopy: getTargetRoleMicrocopy(targetRole),
      evidenceBanner: 'Determined locally • No backend snapshot in use',
    };
  }

  const snapshot = intelligence.careerReadiness;
  const actionPlanItems: ActionPlanItem[] = snapshot.action_plan.map(function (item) {
    return {
      id: item.key,
      label: item.title,
      impact: item.impact_points,
      effort: item.effort,
      helperText: item.helper,
    };
  });
  const gaps: ReadinessGap[] = snapshot.top_gaps.map(function (item) {
    return {
      name: item.title,
      impact: item.impact_points,
      reason: item.reason,
      ctaLabel: 'Review gap',
    };
  });

  const radarSpokes: RadarSpoke[] = [];
  const orderedKeys = [
    'target_alignment',
    'specialized_experience',
    'resume_evidence',
    'keywords',
    'leadership_scope',
    'qualification',
  ];
  for (let i = 0; i < orderedKeys.length; i++) {
    const key = orderedKeys[i];
    if (Object.prototype.hasOwnProperty.call(snapshot.spokes, key)) {
      radarSpokes.push({
        name: mapSpokeLabel(key),
        value: snapshot.spokes[key],
      });
    }
  }
  const snapshotKeys = Object.keys(snapshot.spokes);
  for (let i = 0; i < snapshotKeys.length; i++) {
    const key = snapshotKeys[i];
    let exists = false;
    for (let j = 0; j < radarSpokes.length; j++) {
      if (radarSpokes[j].name === mapSpokeLabel(key)) {
        exists = true;
        break;
      }
    }
    if (!exists) {
      radarSpokes.push({
        name: mapSpokeLabel(key),
        value: snapshot.spokes[key],
      });
    }
  }

  const explanationParts = snapshot.reasons
    .slice(0, 2)
    .map(function (item) {
      return item.message;
    });
  const liveUpdatedLabel =
    intelligence.lastUpdatedLabel !== null ? intelligence.lastUpdatedLabel : 'Live';

  return {
    score: snapshot.overall_score,
    scoreMax: 100,
    badgeLabel: snapshot.label,
    explanationText:
      explanationParts.length > 0
        ? explanationParts.join(' ')
        : 'Deterministic readiness assessment generated from your current frontend profile and resume context.',
    trajectory: buildLiveTrajectory(
      snapshot.overall_score,
      selectedActionIds,
      actionPlanItems
    ),
    radarSpokes: radarSpokes,
    gaps: gaps,
    actionPlanItems: actionPlanItems,
    evidenceProfileFields: collectEvidenceLabels(intelligence),
    evidenceResumeUsed: collectResumeEvidenceLabel(intelligence),
    evidenceTargetRoleUsed: snapshot.target_role,
    evidencePrivacyNote:
      'Live backend snapshot. Deterministic scoring with explicit evidence and missing-evidence tracking.',
    isLive: true,
    statusText: 'Live backend • ' + liveUpdatedLabel,
    targetRoleMicrocopy: 'Live snapshot for ' + snapshot.target_role + '.',
    evidenceBanner: 'Live backend snapshot • Deterministic scoring',
  };
}

// ---------------------------------------------------------------------------
// CareerReadinessScreen
// ---------------------------------------------------------------------------

export interface CareerReadinessScreenProps {
  intelligence?: UnifiedCareerResumeIntelligenceState;
}

export function CareerReadinessScreen(props: CareerReadinessScreenProps): React.ReactElement {
  const setOverrides = usePathAdvisorScreenOverridesStore(function (s) { return s.setOverrides; });

  const [targetRole, setTargetRole] = useState('general');
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set(['quantified']));
  const data = buildCareerReadinessDisplayData(props.intelligence, selectedActionIds, targetRole);

  const projectedScore = computeProjectedScore(data.score, selectedActionIds, data.actionPlanItems);

  useEffect(
    function scrollToActionPlanWhenHashPresent() {
      if (typeof window === 'undefined') return;
      if (window.location.hash !== '#action-plan') return;
      const el = document.getElementById('action-plan');
      if (el !== null) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    []
  );

  useEffect(
    function () {
      setOverrides({
        screenId: 'career-readiness',
        viewingLabel: 'Career Readiness',
        suggestedPrompts: [
          'Why is my score this value?',
          "What's the fastest improvement?",
          'Compare to last month',
        ],
        railContent: {
          insightBullets: [
            'Qualification baseline is strong for GS-13 analyst roles.',
            'Resume evidence is the biggest limiting factor.',
            'Leadership signals are moderate and can be improved quickly.',
          ],
          nextBestAction: {
            title: 'Add 3 quantified accomplishments',
            text: 'This is the fastest way to boost your readiness score by +4 points.',
            ctaLabel: 'Start',
            skipLabel: 'Skip',
          },
          collapsedSectionLabels: ['Explain scoring'],
        },
      });
      return function () {
        setOverrides(null);
      };
    },
    [setOverrides]
  );

  const toggleAction = useCallback(function (id: string) {
    setSelectedActionIds(function (prev) {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelections = useCallback(function () {
    setSelectedActionIds(new Set());
  }, []);

  return (
    <div className="p-6 pb-8 space-y-6">
      {/* Title row + header controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--p-text)' }}>
            Career Readiness
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
            Your competitiveness baseline for federal roles.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Cog className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--p-accent)' }} aria-hidden />
            <FilterDropdown
              value={targetRole}
              label="Target role"
              options={TARGET_ROLE_OPTIONS}
              onSelect={setTargetRole}
            />
          </div>
          <span className="text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
            {data.statusText}
          </span>
          <button
            type="button"
            className={INTERACTIVE_HOVER_CLASS + ' h-9 w-9 grid place-items-center rounded-[var(--p-radius)] border'}
            style={{
              background: 'var(--p-surface2)',
              borderColor: 'var(--p-border)',
              color: 'var(--p-text-muted)',
            }}
            aria-label="Recompute readiness"
            title="Recompute readiness"
            onClick={props.intelligence?.refresh ?? undefined}
            disabled={props.intelligence?.refresh === undefined || props.intelligence?.refresh === null}
          >
            <RefreshCw
              className={
                'w-4 h-4' + (props.intelligence?.isRefreshing === true ? ' animate-spin' : '')
              }
            />
          </button>
        </div>
      </div>

      {/* Primary score card (full width) — no card title, same chrome as ModuleCard */}
      <div
        className="p-4"
        style={{
          background: 'var(--p-surface)',
          border: '1px solid var(--p-border)',
          borderRadius: 'var(--p-radius-lg)',
          boxShadow: 'var(--p-shadow-elev-1)',
          borderTop: '1px solid var(--p-accent-muted)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-3xl font-bold" style={{ color: 'var(--p-text)' }}>
              {data.score} / {data.scoreMax}
            </p>
            <span
              className="inline-block mt-2 px-2.5 py-1 text-[12px] font-medium rounded"
              style={{ background: 'var(--p-warning-bg)', color: 'var(--p-warning)' }}
            >
              {data.badgeLabel}
            </span>
            <p className="mt-1.5 text-[11px] max-w-xl" style={{ color: 'var(--p-text-dim)' }}>
              {data.targetRoleMicrocopy}
            </p>
            <p className="mt-2 text-sm max-w-xl" style={{ color: 'var(--p-text-muted)' }}>
              {data.explanationText}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={INTERACTIVE_HOVER_CLASS + ' px-4 py-2 text-sm font-medium rounded-[var(--p-radius)]'}
              style={{
                background: 'var(--p-accent)',
                color: 'var(--p-bg)',
              }}
              onClick={function () {
                publishScreenContext({
                  screen: 'career-readiness',
                  anchor: { type: 'card', id: 'career-readiness:improve', label: 'Improve readiness' },
                  title: 'What to do next',
                  sections: [
                    { title: 'Why this matters', lines: [data.explanationText] },
                    { title: 'Next steps', bullets: data.actionPlanItems.slice(0, 3).map(function (a) { return a.label + ' (+' + String(a.impact) + ')'; }) },
                  ],
                  tags: [data.isLive ? 'explainability' : 'localOnly'],
                  dedupeKey: 'career-readiness:improve',
                });
              }}
            >
              Improve readiness
            </button>
            <button
              type="button"
              className={INTERACTIVE_HOVER_CLASS + ' px-4 py-2 text-sm font-medium rounded-[var(--p-radius)] border'}
              style={{
                borderColor: 'var(--p-accent)',
                color: 'var(--p-accent)',
                background: 'transparent',
              }}
              onClick={function () {
                publishScreenContext({
                  screen: 'career-readiness',
                  anchor: { type: 'card', id: 'career-readiness:opportunities', label: 'View top opportunities' },
                  title: 'Why this changed',
                  sections: [{ lines: ['Your readiness baseline supports exploring roles that match your profile. Top opportunities appear in Job Search.'] }],
                  tags: ['localOnly'],
                  dedupeKey: 'career-readiness:opportunities',
                });
              }}
            >
              View top opportunities
            </button>
          </div>
        </div>
      </div>

      {/* Two-column: Trajectory + Radar — shared min-height so both cards feel like peers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[320px]">
        <ModuleCard
          icon={<TrendingUp className="w-4 h-4" />}
          title="Readiness Trajectory"
          variant="default"
          className="h-full flex flex-col"
        >
          <div className="flex-1 flex flex-col justify-center min-h-0">
            <ReadinessTrajectoryEChart trajectory={data.trajectory} />
            <p className="mt-2 text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
              {data.isLive
                ? 'Actual holds your current live readiness baseline. Possible projects where you could be if you complete selected actions.'
                : 'Actual shows your progress over time. Possible shows where you could be if you complete selected actions. Local-only.'}
            </p>
            <button
            type="button"
            className={INTERACTIVE_HOVER_CLASS + ' mt-2 flex items-center gap-1.5 rounded px-1.5 py-1 text-[12px] border border-transparent'}
            style={{ color: 'var(--p-accent-muted)' }}
            onClick={function () { setAssumptionsOpen(!assumptionsOpen); }}
          >
            {assumptionsOpen ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" aria-hidden /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />}
            Show assumptions
          </button>
          {assumptionsOpen ? (
            <ul className="mt-1.5 text-[11px] pl-5 list-disc space-y-0.5" style={{ color: 'var(--p-text-dim)' }}>
              <li>Selected actions completed</li>
              <li>Target role unchanged</li>
              <li>Profile inputs remain consistent</li>
            </ul>
          ) : null}
          </div>
        </ModuleCard>

        <ModuleCard
          icon={<Radar className="w-4 h-4" />}
          title="Readiness Radar"
          variant="default"
          className="h-full flex flex-col"
        >
          <ReadinessRadarEChart spokes={data.radarSpokes} />
          <p className="mt-3 text-[12px] font-medium" style={{ color: 'var(--p-text)' }}>
            Top gaps holding you back
          </p>
          <ul className="mt-2 space-y-3">
            {data.gaps.map(function (g, i) {
              return (
                <li key={i}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[12px] font-medium" style={{ color: 'var(--p-text)' }}>
                      {g.name}
                    </span>
                    <span
                      className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded"
                      style={{ background: 'var(--p-success-bg)', color: 'var(--p-success)' }}
                    >
                      +{g.impact}
                    </span>
                    <button
                      type="button"
                      className={INTERACTIVE_HOVER_CLASS + ' text-[12px] font-medium px-2 py-1 rounded border'}
                      style={{
                        borderColor: 'var(--p-border)',
                        color: 'var(--p-accent)',
                      }}
                      onClick={function () {
                        publishScreenContext({
                          screen: 'career-readiness',
                          anchor: { type: 'card', id: 'career-readiness:gap:' + g.name, label: g.name },
                          title: 'Why this changed: ' + g.name,
                          sections: [
                            { title: 'Impact', lines: ['+' + String(g.impact) + ' points'] },
                            { title: 'What to do', lines: [g.reason] },
                          ],
                          tags: [data.isLive ? 'explainability' : 'localOnly'],
                          dedupeKey: 'career-readiness:gap:' + g.name,
                        });
                      }}
                    >
                      {g.ctaLabel}
                    </button>
                  </div>
                  <p className="mt-0.5 text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
                    {g.reason}
                  </p>
                </li>
              );
            })}
          </ul>
        </ModuleCard>
      </div>

      {/* Action Plan card — id for dashboard CTA deep-link (hash #action-plan) */}
      <div id="action-plan">
        <ModuleCard
          icon={<ClipboardList className="w-4 h-4" />}
          title="Action Plan"
        variant="default"
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-[12px]"
              style={{ color: 'var(--p-accent-muted)' }}
              onClick={clearSelections}
            >
              Clear selections
            </button>
            <span
              className="px-2 py-0.5 text-[11px] font-medium rounded-full"
              style={{ background: 'var(--p-accent-bg)', color: 'var(--p-accent)' }}
            >
              Projected readiness: {projectedScore}
            </span>
          </div>
        }
      >
        <ul className="space-y-3">
          {data.actionPlanItems.map(function (item) {
            const checked = selectedActionIds.has(item.id);
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-start gap-2"
                style={{
                  background: checked ? 'var(--p-accent-bg)' : 'transparent',
                  padding: '8px',
                  borderRadius: 'var(--p-radius)',
                }}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  className="flex-shrink-0 mt-0.5 w-4 h-4 rounded border grid place-items-center"
                  style={{
                    borderColor: 'var(--p-border)',
                    background: checked ? 'var(--p-accent)' : 'transparent',
                  }}
                  onClick={function () {
                    toggleAction(item.id);
                    publishScreenContext({
                      screen: 'career-readiness',
                      anchor: { type: 'card', id: 'career-readiness:action:' + item.id, label: item.label },
                      title: 'What to do next: ' + item.label,
                      sections: [
                        { lines: [item.helperText] },
                        { title: 'Impact', lines: ['+' + String(item.impact) + ' • ' + item.effort] },
                      ],
                      tags: [data.isLive ? 'explainability' : 'localOnly'],
                      dedupeKey: 'career-readiness:action:' + item.id,
                    });
                  }}
                >
                  {checked ? (
                    <span className="text-white text-[10px]" aria-hidden>✓</span>
                  ) : null}
                </button>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-medium" style={{ color: 'var(--p-text)' }}>
                    {item.label}
                  </span>
                  <span
                    className="ml-1.5 inline-block px-1.5 py-0.5 text-[10px] font-medium rounded"
                    style={{ background: 'var(--p-success-bg)', color: 'var(--p-success)' }}
                  >
                    +{item.impact}
                  </span>
                  <span
                    className="ml-1 inline-block px-1.5 py-0.5 text-[10px] rounded"
                    style={{ background: 'var(--p-surface2)', color: 'var(--p-text-dim)' }}
                  >
                    {item.effort}
                  </span>
                  <p className="mt-0.5 text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
                    {item.helperText}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </ModuleCard>
      </div>

      {/* Evidence & Inputs: collapsible with prominent collapsed row and hint for discoverability */}
      <div
        style={{
          border: '1px solid var(--p-accent-muted)',
          borderRadius: 'var(--p-radius-lg)',
          overflow: 'hidden',
          background: 'var(--p-surface)',
        }}
      >
        <button
          type="button"
          onClick={function () { setEvidenceOpen(!evidenceOpen); }}
          className={INTERACTIVE_HOVER_CLASS + ' w-full flex items-center justify-between px-4 py-3 text-left'}
          style={{
            background: 'var(--p-surface2)',
            color: 'var(--p-text)',
            borderBottom: evidenceOpen ? '1px solid var(--p-border)' : 'none',
          }}
        >
          <span className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--p-accent)' }} aria-hidden />
            <span className="font-semibold" style={{ fontSize: 'var(--p-font-size-section)' }}>
              Evidence & Inputs
            </span>
            <span
              className="px-1.5 py-0.5 text-[10px] font-medium rounded"
              style={{ background: 'var(--p-accent-bg)', color: 'var(--p-accent)' }}
            >
              Audit details
            </span>
          </span>
          {evidenceOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0" aria-hidden /> : <ChevronRight className="w-4 h-4 flex-shrink-0" aria-hidden />}
        </button>
        {!evidenceOpen ? (
          <p className="px-4 pb-3 text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
            See what inputs were used for scoring.
          </p>
        ) : null}
        {evidenceOpen ? (
          <div className="px-4 py-3 space-y-2" style={{ background: 'var(--p-surface)' }}>
            <p className="text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
              {data.evidenceBanner}
            </p>
            <p className="text-[12px]" style={{ color: 'var(--p-text-muted)' }}>
              Profile fields used: {data.evidenceProfileFields.join(', ')}
            </p>
            <p className="text-[12px]" style={{ color: 'var(--p-text-muted)' }}>
              Resume used: {data.evidenceResumeUsed}
            </p>
            <p className="text-[12px]" style={{ color: 'var(--p-text-muted)' }}>
              Target role used: {data.evidenceTargetRoleUsed}
            </p>
            <p className="text-[11px] mt-2" style={{ color: 'var(--p-text-dim)' }}>
              {data.evidencePrivacyNote}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
