/**
 * ============================================================================
 * RESUME WORKSPACE SCREEN — Hub, creation flow, review, and diagnostics
 * ============================================================================
 *
 * PURPOSE:
 * This screen powers the resume workspace routes:
 *   - /dashboard/resume               → workspace hub (resume list, next actions)
 *   - /dashboard/resume/new           → guided new-resume creation flow
 *   - /dashboard/resume/[resumeId]    → structured review and diagnostics
 *   - /dashboard/resume/[resumeId]/review → dedicated review shell
 *
 * The canonical document-centered editor lives at /dashboard/resume-builder
 * (ResumeBuilderScreen). This screen does NOT serve as the primary editing
 * surface — it provides the workspace hub where users manage resumes, and
 * the review/diagnostics surfaces where users run structured guidance.
 *
 * NAVIGATION MODEL:
 * "Open builder" from the hub navigates to /dashboard/resume-builder.
 * "Review" from the hub navigates to /dashboard/resume/[resumeId]/review.
 *
 * TRUST-FIRST:
 * Diagnostics here are intentionally honest placeholders. We only surface
 * deterministic draft-completeness guidance and explicit notes about what is
 * not wired yet.
 */

'use client';

import type React from 'react';
import { useEffect } from 'react';
import { useNav } from '@pathos/adapters';
import {
  Sparkles,
  ArrowRight,
  FolderPlus,
  Download,
  CheckCircle2,
  LayoutPanelLeft,
} from 'lucide-react';
import type { ResumeDraft } from '@pathos/core';
import {
  getDiagnosticsSnapshotById,
  getDiagnosticsSnapshotsForVariant,
  getRevisionContentSnapshotById,
  getRevisionContentSnapshotsForVariant,
  useResumeWorkspaceStore,
  getLatestDiagnosticsSnapshotForVariant,
  type ResumeBuilderSection,
  type ResumeBuilderViewMode,
  type ResumeCreationStep,
  type ResumeDraftSummary,
  type ResumeRightRailTab,
  type ResumeWorkspaceRouteView,
} from '../stores/resumeWorkspaceStore';
import {
  formatReadinessBandLabel,
} from '../resume-workspace/resumeDiagnostics';
import {
  getResumeExportReadiness,
} from '../resume-workspace/resumeExportReadiness';
import {
  ResumeExportReadinessCard,
} from '../resume-workspace/ResumeExportReadinessCard';
import {
  buildResumeRewriteRequest,
  getResumeRewriteEligibility,
  listResumeSectionRewriteActions,
  type ResumeSectionRewriteAction,
} from '../resume-workspace/resumeRewrite';
import {
  ResumeRewritePanel,
} from '../resume-workspace/ResumeRewritePanel';
import {
  buildResumeSnapshotCompareSummary,
} from '../resume-workspace/resumeSnapshotCompare';
import {
  buildResumeRevisionDiffSummary,
} from '../resume-workspace/resumeRevisionDiff';
import {
  ResumeRevisionDiffPanel,
} from '../resume-workspace/ResumeRevisionDiffPanel';
import {
  findSectionExplanation,
  hasResumeExplanations,
  KeyTakeawaysPanel,
  PathAdvisorSummary,
  RecommendationList,
  SectionGuidance,
  WarningExplanationList,
} from '../resume-workspace/PathAdvisorResumeGuidance';
import {
  ResumeSnapshotComparePanel,
  ResumeSnapshotHistoryPanel,
} from '../resume-workspace/ResumeSnapshotPanels';
import {
  buildResumePathAdvisorContextEntry,
  buildResumePathAdvisorSelectionPayload,
} from '../resume-workspace/pathAdvisorResumeContext';
import {
  publishScreenContext,
  publishSelectionContext,
} from '../lib/pathAdvisorPublish';

export interface ResumeWorkspaceScreenProps {
  view: ResumeWorkspaceRouteView;
  resumeId?: string | null;
}

const PRIMARY_BUTTON_CLASS =
  'rounded-md px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]';

const SECONDARY_BUTTON_CLASS =
  'rounded-md border px-4 py-3 text-sm font-medium transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]';

const CARD_BUTTON_CLASS =
  'w-full rounded-xl border p-4 text-left transition-colors hover:opacity-95 active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]';

const CREATION_STEPS: ResumeCreationStep[] = [
  'document-type',
  'start-method',
  'goal',
  'target-context',
  'confirm',
];

const BUILDER_SECTIONS: ResumeBuilderSection[] = [
  'contact',
  'summary',
  'experience',
  'education',
  'skills',
  'review',
];

function builderSectionLabel(section: ResumeBuilderSection): string {
  if (section === 'contact') return 'Contact';
  if (section === 'summary') return 'Summary';
  if (section === 'experience') return 'Experience';
  if (section === 'education') return 'Education';
  if (section === 'skills') return 'Skills';
  return 'Review';
}

function creationStepLabel(step: ResumeCreationStep): string {
  if (step === 'document-type') return 'What are you creating';
  if (step === 'start-method') return 'How do you want to start';
  if (step === 'goal') return 'What is your goal';
  if (step === 'target-context') return 'Add target context';
  return 'Confirm setup';
}

function statusLabel(status: ResumeDraftSummary['status']): string {
  if (status === 'ready-to-export') return 'Ready to export';
  if (status === 'needs-review') return 'Needs review';
  if (status === 'tailored') return 'Tailored';
  return 'Draft';
}

function diagnosticsStatusHeading(status: string): string {
  if (status === 'loading') return 'Running backend diagnostics';
  if (status === 'insufficient_input') return 'More resume evidence is needed';
  if (status === 'unsupported_context') return 'The current targeting context is unsupported';
  if (status === 'error') return 'Diagnostics could not be loaded';
  if (status === 'unavailable') return 'Diagnostics are unavailable';
  if (status === 'evaluated') return 'Backend diagnostics';
  return 'Diagnostics not run yet';
}

function diagnosticsStatusMessage(status: string): string {
  if (status === 'loading') return 'PathOS is waiting on the backend diagnostics contract to evaluate the current draft.';
  if (status === 'insufficient_input') return 'Add more resume evidence or target context, then run diagnostics again.';
  if (status === 'unsupported_context') return 'The backend declined this context. Review the attached warnings and try a supported role or canonical job target.';
  if (status === 'error') return 'The diagnostics request failed. Try again after checking the current draft and network state.';
  if (status === 'unavailable') return 'The diagnostics service is not available right now. The workspace is still editable, but review findings cannot be refreshed.';
  if (status === 'evaluated') return 'These explanations and recommendations come directly from the backend diagnostics response.';
  return 'Run diagnostics to replace the Day 75 placeholder shell with backend-owned findings.';
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatEvaluatedAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sectionTextValue(section: ResumeBuilderSection, draft: ResumeDraft): string {
  if (section === 'contact') {
    return draft.contact.fullName;
  }
  if (section === 'summary') {
    return draft.summary;
  }
  if (section === 'experience') {
    if (draft.experience.length > 0) {
      return draft.experience[0].duties;
    }
    return '';
  }
  if (section === 'education') {
    if (draft.education.length > 0) {
      return draft.education[0].institution;
    }
    return '';
  }
  if (section === 'skills') {
    const names: string[] = [];
    for (let i = 0; i < draft.skills.length; i++) {
      names.push(draft.skills[i].name);
    }
    return names.join(', ');
  }
  return '';
}

function targetContextFieldValue(
  field: 'targetRoleTitle' | 'seriesGrade' | 'agencyDomain' | 'plainLanguageGoal',
  draftSummaryValue: {
    targetRoleTitle: string;
    seriesGrade: string;
    agencyDomain: string;
    plainLanguageGoal: string;
  },
): string {
  if (field === 'targetRoleTitle') return draftSummaryValue.targetRoleTitle;
  if (field === 'seriesGrade') return draftSummaryValue.seriesGrade;
  if (field === 'agencyDomain') return draftSummaryValue.agencyDomain;
  return draftSummaryValue.plainLanguageGoal;
}

function sectionActionHint(section: ResumeBuilderSection): string {
  if (section === 'summary') {
    return 'Tighten the opening narrative and target alignment.';
  }
  if (section === 'experience') {
    return 'Make the strongest bullets outcome-first and evidence-rich.';
  }
  if (section === 'education') {
    return 'Keep the record complete and easy to scan.';
  }
  if (section === 'skills') {
    return 'Keep skills relevant, specific, and ATS-safe.';
  }
  if (section === 'contact') {
    return 'Keep contact details current and export-ready.';
  }
  return 'Review saved diagnostics and next actions before export.';
}

function BuilderSectionAnchorOverlay(props: {
  showGuidanceAnchor: boolean;
  showRewriteAnchor: boolean;
}) {
  if (!props.showGuidanceAnchor && !props.showRewriteAnchor) {
    return null;
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-visible"
      style={{ zIndex: 0 }}
    >
      <svg
        className="h-full w-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {props.showRewriteAnchor ? (
          <g opacity="0.7">
            <circle cx="6" cy="20" r="1.8" fill="var(--p-accent)" />
            <path
              d="M 7.5 20 C 16 20, 16 34, 12 42 S 10 56, 16 63"
              fill="none"
              stroke="var(--p-accent)"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeDasharray="1.5 2.25"
            />
            <circle
              cx="16"
              cy="63"
              r="1.8"
              fill="color-mix(in srgb, var(--p-accent) 65%, white)"
            />
          </g>
        ) : null}
        {props.showGuidanceAnchor ? (
          <g opacity="0.55">
            <circle
              cx="6"
              cy={props.showRewriteAnchor ? '62' : '24'}
              r="1.8"
              fill="var(--p-accent)"
            />
            <path
              d={
                props.showRewriteAnchor
                  ? 'M 7.5 62 C 18 62, 18 72, 14 80 S 12 90, 18 95'
                  : 'M 7.5 24 C 18 24, 18 46, 13 62 S 12 78, 18 92'
              }
              fill="none"
              stroke="var(--p-accent)"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeDasharray="1.25 2.5"
            />
            <circle
              cx="18"
              cy="95"
              r="1.8"
              fill="color-mix(in srgb, var(--p-accent) 60%, white)"
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function BuilderRewriteActionList(props: {
  actions: ResumeSectionRewriteAction[];
  canRewrite: boolean;
  rewriteDisabledReason: string | null;
  onRequestRewrite: (action: ResumeSectionRewriteAction) => void;
}) {
  if (props.actions.length === 0) {
    return null;
  }

  return (
    <div
      className="relative z-10 mt-3 rounded-xl border p-4"
      style={{
        borderColor: 'color-mix(in srgb, var(--p-accent) 25%, var(--p-border))',
        background: 'color-mix(in srgb, var(--p-accent) 4%, var(--p-surface2))',
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
        Rewrite assistance
      </div>
      <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
        Rewrite suggestions open here in the builder so the original text, pending state, and approved changes stay attached to the current draft.
      </p>
      <div className="mt-3 space-y-3">
        {props.actions.map(function (action, index) {
          const title =
            action.explanation !== null &&
            action.explanation.title !== null &&
            action.explanation.title !== undefined &&
            action.explanation.title.trim().length > 0
              ? action.explanation.title
              : action.recommendation.title;
          const detail =
            action.explanation !== null &&
            action.explanation.short_explanation !== null &&
            action.explanation.short_explanation !== undefined &&
            action.explanation.short_explanation.trim().length > 0
              ? action.explanation.short_explanation
              : action.recommendation.detail;
          return (
            <div
              key={action.recommendation.code + '-' + action.targetLabel + '-' + index.toString()}
              className="rounded-lg border p-3"
              style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
                    {title}
                  </div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
                    {action.targetLabel}
                  </div>
                  <p className="mt-2 text-sm" style={{ color: 'var(--p-text-muted)' }}>
                    {detail}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!props.canRewrite}
                  onClick={function () {
                    if (props.canRewrite) {
                      props.onRequestRewrite(action);
                    }
                  }}
                  className="rounded-md border px-3 py-2 text-xs font-medium transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ borderColor: 'var(--p-border)', color: 'var(--p-accent)' }}
                >
                  Rewrite with AI
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {!props.canRewrite && props.rewriteDisabledReason !== null ? (
        <p className="mt-3 text-xs" style={{ color: 'var(--p-text-dim)' }}>
          {props.rewriteDisabledReason}
        </p>
      ) : null}
    </div>
  );
}

/**
 * BUILDER MODE TOGGLE — segmented control that switches between canvas
 * (document-dominant), focus guidance (rail open with section help), and
 * diagnostics (rail open with backend evaluation). The toggle lives in the
 * stable top bar so the user always knows which workspace mode is active.
 */
function BuilderModeToggle(props: {
  activeMode: ResumeBuilderViewMode;
  onSelectMode: (mode: ResumeBuilderViewMode) => void;
}) {
  const modes: Array<{ mode: ResumeBuilderViewMode; label: string }> = [
    { mode: 'canvas', label: 'Canvas' },
    { mode: 'focus_guidance', label: 'Guidance' },
    { mode: 'diagnostics', label: 'Diagnostics' },
  ];
  return (
    <div
      className="inline-flex rounded-lg border"
      style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}
      role="group"
      aria-label="Builder workspace mode"
    >
      {modes.map(function (item) {
        const isActive = item.mode === props.activeMode;
        return (
          <button
            key={item.mode}
            type="button"
            onClick={function () {
              props.onSelectMode(item.mode);
            }}
            className="relative px-3 py-1.5 text-xs font-medium transition-colors duration-150 first:rounded-l-md last:rounded-r-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)] focus-visible:ring-inset"
            style={{
              background: isActive
                ? 'color-mix(in srgb, var(--p-accent) 12%, var(--p-surface))'
                : 'transparent',
              color: isActive ? 'var(--p-accent)' : 'var(--p-text-muted)',
              borderBottom: isActive ? '2px solid var(--p-accent)' : '2px solid transparent',
            }}
            aria-pressed={isActive ? 'true' : 'false'}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function RailTabButton(props: {
  tab: ResumeRightRailTab;
  label: string;
  activeTab: ResumeRightRailTab;
  onSelect: (tab: ResumeRightRailTab) => void;
}) {
  const isActive = props.tab === props.activeTab;
  return (
    <button
      type="button"
      onClick={function () {
        props.onSelect(props.tab);
      }}
      className="rounded-md border px-3 py-2 text-sm font-medium text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
      style={{
        background: isActive ? 'color-mix(in srgb, var(--p-accent) 10%, var(--p-surface))' : 'var(--p-surface)',
        borderColor: isActive ? 'var(--p-accent)' : 'var(--p-border)',
        color: isActive ? 'var(--p-accent)' : 'var(--p-text-muted)',
      }}
    >
      {props.label}
    </button>
  );
}

function ActionDialog(props: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        className="w-full max-w-md rounded-xl border p-5 shadow-xl"
        style={{
          background: 'var(--p-surface)',
          borderColor: 'var(--p-border)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
      >
        <h2 className="text-lg font-semibold" style={{ color: 'var(--p-text)' }}>
          {props.title}
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--p-text-muted)' }}>
          {props.description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-md border px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
            style={{
              borderColor: 'var(--p-border)',
              color: 'var(--p-text-muted)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={props.onConfirm}
            className="rounded-md px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
            style={{
              background: 'var(--p-accent)',
              color: 'var(--p-bg)',
            }}
          >
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SurfaceCard(props: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl border p-5"
      style={{
        background: 'var(--p-surface)',
        borderColor: 'var(--p-border)',
      }}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--p-text)' }}>
          {props.title}
        </h2>
        {props.subtitle ? (
          <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
            {props.subtitle}
          </p>
        ) : null}
      </div>
      {props.children}
    </section>
  );
}

function EmptyResumeState(props: { onCreate: () => void }) {
  return (
    <div
      className="rounded-xl border p-6"
      style={{
        background: 'var(--p-surface2)',
        borderColor: 'var(--p-border)',
      }}
    >
      <h3 className="text-lg font-semibold" style={{ color: 'var(--p-text)' }}>
        No resumes yet
      </h3>
      <p className="mt-2 text-sm" style={{ color: 'var(--p-text-muted)' }}>
        The workspace is ready, but there are no resume summaries in local state right now. Create a new resume to start the guided flow, or return later when a master or tailored variant has been saved on this device.
      </p>
      <button
        type="button"
        onClick={props.onCreate}
        className={'mt-4 inline-flex items-center gap-2 ' + PRIMARY_BUTTON_CLASS}
        style={{ background: 'var(--p-accent)', color: 'var(--p-bg)' }}
      >
        <FolderPlus className="h-4 w-4" aria-hidden />
        Create new resume
      </button>
    </div>
  );
}

function isActivationKey(event: React.KeyboardEvent<HTMLDivElement>): boolean {
  return event.key === 'Enter' || event.key === ' ';
}

export function ResumeWorkspaceScreen(props: ResumeWorkspaceScreenProps) {
  const nav = useNav();
  const hydrate = useResumeWorkspaceStore(function (state) {
    return state.hydrate;
  });
  const setCurrentView = useResumeWorkspaceStore(function (state) {
    return state.setCurrentView;
  });
  const setActiveResumeId = useResumeWorkspaceStore(function (state) {
    return state.setActiveResumeId;
  });
  const activeResumeId = useResumeWorkspaceStore(function (state) {
    return state.activeResumeId;
  });
  const resumes = useResumeWorkspaceStore(function (state) {
    return state.resumes;
  });
  const resumeDrafts = useResumeWorkspaceStore(function (state) {
    return state.resumeDrafts;
  });
  const diagnosticsSnapshots = useResumeWorkspaceStore(function (state) {
    return state.diagnosticsSnapshots;
  });
  const diagnosticsSnapshotIdsByVariant = useResumeWorkspaceStore(function (state) {
    return state.diagnosticsSnapshotIdsByVariant;
  });
  const revisionContentSnapshots = useResumeWorkspaceStore(function (state) {
    return state.revisionContentSnapshots;
  });
  const revisionContentIdsByVariant = useResumeWorkspaceStore(function (state) {
    return state.revisionContentIdsByVariant;
  });
  const creationFlow = useResumeWorkspaceStore(function (state) {
    return state.creationFlow;
  });
  const builder = useResumeWorkspaceStore(function (state) {
    return state.builder;
  });
  const review = useResumeWorkspaceStore(function (state) {
    return state.review;
  });
  const ui = useResumeWorkspaceStore(function (state) {
    return state.ui;
  });
  const setCreationStep = useResumeWorkspaceStore(function (state) {
    return state.setCreationStep;
  });
  const setStartMethod = useResumeWorkspaceStore(function (state) {
    return state.setStartMethod;
  });
  const setGoalMode = useResumeWorkspaceStore(function (state) {
    return state.setGoalMode;
  });
  const updateTargetContextField = useResumeWorkspaceStore(function (state) {
    return state.updateTargetContextField;
  });
  const createResumeFromFlow = useResumeWorkspaceStore(function (state) {
    return state.createResumeFromFlow;
  });
  const setActiveSection = useResumeWorkspaceStore(function (state) {
    return state.setActiveSection;
  });
  const setRightRailTab = useResumeWorkspaceStore(function (state) {
    return state.setRightRailTab;
  });
  const setBuilderViewMode = useResumeWorkspaceStore(function (state) {
    return state.setBuilderViewMode;
  });
  const updateContactField = useResumeWorkspaceStore(function (state) {
    return state.updateContactField;
  });
  const updateSummary = useResumeWorkspaceStore(function (state) {
    return state.updateSummary;
  });
  const updateExperienceText = useResumeWorkspaceStore(function (state) {
    return state.updateExperienceText;
  });
  const updateEducationText = useResumeWorkspaceStore(function (state) {
    return state.updateEducationText;
  });
  const updateSkillsText = useResumeWorkspaceStore(function (state) {
    return state.updateSkillsText;
  });
  const saveAsMasterResume = useResumeWorkspaceStore(function (state) {
    return state.saveAsMasterResume;
  });
  const saveAsTailoredVariant = useResumeWorkspaceStore(function (state) {
    return state.saveAsTailoredVariant;
  });
  const duplicateForAnotherTarget = useResumeWorkspaceStore(function (state) {
    return state.duplicateForAnotherTarget;
  });
  const markExportReady = useResumeWorkspaceStore(function (state) {
    return state.markExportReady;
  });
  const evaluateActiveResumeDiagnostics = useResumeWorkspaceStore(function (state) {
    return state.evaluateActiveResumeDiagnostics;
  });
  const focusDiagnosticsTargetRefs = useResumeWorkspaceStore(function (state) {
    return state.focusDiagnosticsTargetRefs;
  });
  const clearDiagnosticsHighlights = useResumeWorkspaceStore(function (state) {
    return state.clearDiagnosticsHighlights;
  });
  const rewrite = useResumeWorkspaceStore(function (state) {
    return state.rewrite;
  });
  const requestResumeRewrite = useResumeWorkspaceStore(function (state) {
    return state.requestResumeRewrite;
  });
  const dismissResumeRewrite = useResumeWorkspaceStore(function (state) {
    return state.dismissResumeRewrite;
  });
  const applyResumeRewriteCandidate = useResumeWorkspaceStore(function (state) {
    return state.applyResumeRewriteCandidate;
  });
  const selectReviewSnapshot = useResumeWorkspaceStore(function (state) {
    return state.selectReviewSnapshot;
  });
  const setCompareSnapshotId = useResumeWorkspaceStore(function (state) {
    return state.setCompareSnapshotId;
  });
  const setCompareMode = useResumeWorkspaceStore(function (state) {
    return state.setCompareMode;
  });
  const openDialog = useResumeWorkspaceStore(function (state) {
    return state.openDialog;
  });
  const closeDialog = useResumeWorkspaceStore(function (state) {
    return state.closeDialog;
  });
  const clearToast = useResumeWorkspaceStore(function (state) {
    return state.clearToast;
  });

  useEffect(function () {
    hydrate();
  }, [hydrate]);

  useEffect(function () {
    setCurrentView(props.view);
  }, [props.view, setCurrentView]);

  useEffect(function () {
    if (props.resumeId && props.resumeId.length > 0) {
      setActiveResumeId(props.resumeId);
    }
  }, [props.resumeId, setActiveResumeId]);

  const routeResumeId = typeof props.resumeId === 'string' && props.resumeId.length > 0 ? props.resumeId : null;
  const resolvedResumeId = routeResumeId !== null ? routeResumeId : activeResumeId;
  const activeSummary = resolvedResumeId ? resumes.find(function (summary) { return summary.id === resolvedResumeId; }) || null : null;
  const activeDraft = resolvedResumeId ? resumeDrafts[resolvedResumeId] : null;
  const latestSnapshot = getLatestDiagnosticsSnapshotForVariant(
    diagnosticsSnapshots,
    activeSummary
  );
  const variantSnapshots = getDiagnosticsSnapshotsForVariant(
    diagnosticsSnapshots,
    diagnosticsSnapshotIdsByVariant,
    activeSummary !== null ? activeSummary.variantId : null
  );
  const selectedSnapshot =
    review.selectedSnapshotId !== null
      ? getDiagnosticsSnapshotById(diagnosticsSnapshots, review.selectedSnapshotId)
      : latestSnapshot;
  const compareSnapshot =
    review.compareSnapshotId !== null
      ? getDiagnosticsSnapshotById(diagnosticsSnapshots, review.compareSnapshotId)
      : null;
  const variantRevisionSnapshots = getRevisionContentSnapshotsForVariant(
    revisionContentSnapshots,
    revisionContentIdsByVariant,
    activeSummary !== null ? activeSummary.variantId : null
  );
  const selectedRevisionSnapshot =
    selectedSnapshot !== null && selectedSnapshot.revisionId !== null
      ? getRevisionContentSnapshotById(revisionContentSnapshots, selectedSnapshot.revisionId)
      : (
          activeSummary !== null
            ? getRevisionContentSnapshotById(
                revisionContentSnapshots,
                activeSummary.currentRevisionId
              )
            : null
        );
  const compareRevisionSnapshot =
    compareSnapshot !== null && compareSnapshot.revisionId !== null
      ? getRevisionContentSnapshotById(revisionContentSnapshots, compareSnapshot.revisionId)
      : null;
  const effectiveDiagnosticsResponse =
    selectedSnapshot !== null ? selectedSnapshot.response : (
      review.response !== null ? review.response : (
        latestSnapshot !== null ? latestSnapshot.response : null
      )
    );
  const pathAdvisorScreenId =
    props.view === 'review' ? 'resume-review' : 'resume-workspace';
  const activeSectionExplanation =
    builder.activeSection !== 'contact' && builder.activeSection !== 'review'
      ? findSectionExplanation(
          effectiveDiagnosticsResponse !== null
            ? effectiveDiagnosticsResponse.explanations
            : null,
          builder.activeSection
        )
      : null;
  const compareSummary =
    selectedSnapshot !== null && compareSnapshot !== null
      ? buildResumeSnapshotCompareSummary(compareSnapshot, selectedSnapshot)
      : null;
  const revisionDiffSummary =
    selectedRevisionSnapshot !== null && compareRevisionSnapshot !== null
      ? buildResumeRevisionDiffSummary(compareRevisionSnapshot, selectedRevisionSnapshot)
      : null;

  useEffect(function () {
    if (activeSummary === null || activeDraft === null) {
      return;
    }
    const shouldEvaluate =
      props.view === 'review' ||
      ui.rightRailTab === 'diagnostics';
    const reviewMatchesActiveResume =
      review.lastEvaluatedResumeId === activeSummary.id;
    if (shouldEvaluate && !reviewMatchesActiveResume && review.status !== 'loading') {
      void evaluateActiveResumeDiagnostics();
    }
  }, [
    activeDraft,
    activeSummary,
    evaluateActiveResumeDiagnostics,
    props.view,
    review.lastEvaluatedResumeId,
    review.status,
    ui.rightRailTab,
  ]);

  useEffect(function () {
    if (activeSummary === null || props.view === 'new') {
      return;
    }

    const selection = buildResumePathAdvisorSelectionPayload({
      view: props.view,
      summary: activeSummary,
    });

    publishSelectionContext({
      screen: pathAdvisorScreenId,
      anchor: {
        type: 'resume',
        id: activeSummary.id,
        label: activeSummary.name,
      },
      payload: {
        title: selection.title,
        subtitle: selection.subtitle,
        lines: selection.lines,
      },
      dedupeKey: 'resume-selection:' + props.view + ':' + activeSummary.id,
    });
  }, [activeSummary, pathAdvisorScreenId, props.view]);

  useEffect(function () {
    if (
      activeSummary === null ||
      (props.view !== 'builder' && props.view !== 'review')
    ) {
      return;
    }

    const entry = buildResumePathAdvisorContextEntry({
      view: props.view,
      summary: activeSummary,
      diagnosticsStatus: review.status,
      diagnosticsResponse: effectiveDiagnosticsResponse,
      activeSection: props.view === 'builder' ? builder.activeSection : null,
      activeSectionExplanation:
        props.view === 'builder' ? activeSectionExplanation : null,
      selectedSnapshotId:
        selectedSnapshot !== null ? selectedSnapshot.snapshotId : null,
      snapshotEvaluatedAt:
        selectedSnapshot !== null
          ? selectedSnapshot.evaluatedAt
          : latestSnapshot !== null
            ? latestSnapshot.evaluatedAt
            : null,
    });

    publishScreenContext({
      screen: pathAdvisorScreenId,
      anchor: {
        type: 'resume',
        id: activeSummary.id,
        label: activeSummary.name,
      },
      title: entry.title,
      subtitle: entry.subtitle,
      sections: entry.sections,
      dedupeKey: entry.dedupeKey,
    });
  }, [
    activeSectionExplanation,
    activeSummary,
    builder.activeSection,
    effectiveDiagnosticsResponse,
    latestSnapshot,
    pathAdvisorScreenId,
    props.view,
    review.status,
    selectedSnapshot,
  ]);

  /**
   * Navigates to the canonical document-centered builder at /dashboard/resume-builder.
   * The resumeId parameter is preserved for callers that reference it (e.g. review
   * "Back to builder") but the target route is the canvas builder which manages
   * its own active-resume state via @pathos/core stores.
   */
  function navigateToBuilder(_resumeId: string) {
    nav.push('/dashboard/resume-builder');
  }

  function navigateToReview(resumeId: string) {
    nav.push('/dashboard/resume/' + resumeId + '/review');
  }

  function renderHome(): React.ReactNode {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-xl border p-6 md:flex-row md:items-end md:justify-between" style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--p-accent)' }}>
              Resume Workspace
            </p>
            <h1 className="mt-1 text-2xl font-semibold" style={{ color: 'var(--p-text)' }}>
              Your resumes, variants, and next actions in one place.
            </h1>
            <p className="mt-2 max-w-3xl text-sm" style={{ color: 'var(--p-text-muted)' }}>
              Open a resume to edit in the builder, run diagnostics and review, or create a new master or tailored variant. PathOS preserves master versus tailored variants with explicit workflow status.
            </p>
          </div>
          <button
            type="button"
            onClick={function () {
              nav.push('/dashboard/resume/new');
            }}
            className={'inline-flex items-center gap-2 ' + PRIMARY_BUTTON_CLASS}
            style={{ background: 'var(--p-accent)', color: 'var(--p-bg)' }}
          >
            <FolderPlus className="h-4 w-4" aria-hidden />
            Create new resume
          </button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <SurfaceCard title="Your resumes" subtitle="Master resumes and tailored variants stay visible together with explicit workflow status.">
            {resumes.length === 0 ? (
              <EmptyResumeState
                onCreate={function () {
                  nav.push('/dashboard/resume/new');
                }}
              />
            ) : (
              <div className="space-y-3">
                {resumes.map(function (summary) {
                  const isActive = summary.id === activeResumeId;
                  return (
                    <div
                      key={summary.id}
                      role="button"
                      tabIndex={0}
                      onClick={function () {
                        setActiveResumeId(summary.id);
                        navigateToBuilder(summary.id);
                      }}
                      onKeyDown={function (event) {
                        if (!isActivationKey(event)) {
                          return;
                        }
                        event.preventDefault();
                        setActiveResumeId(summary.id);
                        navigateToBuilder(summary.id);
                      }}
                      className={CARD_BUTTON_CLASS}
                      style={{
                        background: isActive ? 'color-mix(in srgb, var(--p-accent) 8%, var(--p-surface))' : 'var(--p-surface2)',
                        borderColor: isActive ? 'var(--p-accent)' : 'var(--p-border)',
                      }}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border px-2 py-1 text-xs font-medium" style={{ borderColor: 'var(--p-border)', color: 'var(--p-text-muted)' }}>
                              {summary.mode === 'master' ? 'Master' : 'Tailored'}
                            </span>
                            <span className="rounded-full border px-2 py-1 text-xs font-medium" style={{ borderColor: 'var(--p-border)', color: 'var(--p-text-muted)' }}>
                              {statusLabel(summary.status)}
                            </span>
                          </div>
                          <h3 className="mt-3 text-lg font-semibold" style={{ color: 'var(--p-text)' }}>
                            {summary.name}
                          </h3>
                          <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
                            Updated {formatUpdatedAt(summary.updatedAt)}
                          </p>
                          <p className="mt-2 text-sm" style={{ color: 'var(--p-text-muted)' }}>
                            {summary.targetContext.targetRoleTitle.trim().length > 0
                              ? 'Target role: ' + summary.targetContext.targetRoleTitle
                              : 'No target role linked yet.'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={function (event) {
                              event.stopPropagation();
                              setActiveResumeId(summary.id);
                              navigateToBuilder(summary.id);
                            }}
                            className={SECONDARY_BUTTON_CLASS.replace('px-4 py-3', 'px-3 py-2')}
                            style={{ borderColor: 'var(--p-border)', color: 'var(--p-text-muted)' }}
                          >
                            Open builder
                          </button>
                          <button
                            type="button"
                            onClick={function (event) {
                              event.stopPropagation();
                              setActiveResumeId(summary.id);
                              navigateToReview(summary.id);
                            }}
                            className={PRIMARY_BUTTON_CLASS.replace('px-4 py-3', 'px-3 py-2')}
                            style={{ background: 'var(--p-accent)', color: 'var(--p-bg)' }}
                          >
                            Review
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard title="PathAdvisor next best action" subtitle="Contextual guidance, not a magic chatbot.">
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'color-mix(in srgb, var(--p-accent) 6%, var(--p-surface))' }}>
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5" style={{ color: 'var(--p-accent)' }} aria-hidden />
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
                    Keep the master resume strong, then tailor with explicit target context.
                  </h3>
                  <p className="mt-2 text-sm" style={{ color: 'var(--p-text-muted)' }}>
                    Open the builder to edit your resume directly. When you are ready for a deeper pass, use Review to run diagnostics and get structured guidance before export.
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm" style={{ color: 'var(--p-text-muted)' }}>
                <div className="flex items-start gap-2">
                  <ArrowRight className="mt-0.5 h-4 w-4" aria-hidden />
                  <span>Open a resume in the builder to edit content directly.</span>
                </div>
                <div className="flex items-start gap-2">
                  <ArrowRight className="mt-0.5 h-4 w-4" aria-hidden />
                  <span>Add a role title or announcement before expecting tailored review guidance.</span>
                </div>
                <div className="flex items-start gap-2">
                  <ArrowRight className="mt-0.5 h-4 w-4" aria-hidden />
                  <span>Use Review to run diagnostics and get structured recommendations before export.</span>
                </div>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  function renderNewFlow(): React.ReactNode {
    const currentIndex = CREATION_STEPS.indexOf(creationFlow.currentStep);
    return (
      <div className="space-y-6">
        <SurfaceCard title="New Resume Flow" subtitle="The user should always know where they are, why the step matters, and what comes next.">
          <div className="grid gap-2 md:grid-cols-5">
            {CREATION_STEPS.map(function (step, index) {
              const isCurrent = index === currentIndex;
              const isDone = index < currentIndex;
              return (
                <button
                  key={step}
                  type="button"
                  onClick={function () {
                    setCreationStep(step);
                  }}
                  className="rounded-lg border px-3 py-3 text-left transition-colors hover:opacity-95 active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
                  style={{
                    background: isCurrent ? 'color-mix(in srgb, var(--p-accent) 8%, var(--p-surface))' : 'var(--p-surface2)',
                    borderColor: isCurrent ? 'var(--p-accent)' : 'var(--p-border)',
                    color: isDone ? 'var(--p-accent)' : 'var(--p-text-muted)',
                  }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide">{index + 1}</div>
                  <div className="mt-1 text-sm font-medium">{creationStepLabel(step)}</div>
                </button>
              );
            })}
          </div>
        </SurfaceCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <SurfaceCard title={creationStepLabel(creationFlow.currentStep)} subtitle="Visible choices make the future backend contract easier to wire and easier to explain.">
            <div className="space-y-4">
              {creationFlow.currentStep === 'document-type' ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <button type="button" className="rounded-xl border p-4 text-left transition-colors hover:opacity-95 active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]" style={{ borderColor: 'var(--p-accent)', background: 'color-mix(in srgb, var(--p-accent) 8%, var(--p-surface))' }}>
                    <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>Resume</div>
                    <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>Active for Day 75.</p>
                  </button>
                  <div className="rounded-xl border p-4 text-left" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                    <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>Other document types</div>
                    <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>Reserved for later phases. This flow stays resume-first today.</p>
                  </div>
                </div>
              ) : null}

              {creationFlow.currentStep === 'start-method' ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    ['import-existing', 'Import existing resume'],
                    ['build-from-scratch', 'Build from scratch'],
                    ['from-master', 'Start from existing PathOS master resume'],
                  ].map(function (item) {
                    const value = item[0] as 'import-existing' | 'build-from-scratch' | 'from-master';
                    const isSelected = creationFlow.startMethod === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={function () {
                          setStartMethod(value);
                        }}
                        className="rounded-xl border p-4 text-left transition-colors hover:opacity-95 active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
                        style={{
                          borderColor: isSelected ? 'var(--p-accent)' : 'var(--p-border)',
                          background: isSelected ? 'color-mix(in srgb, var(--p-accent) 8%, var(--p-surface))' : 'var(--p-surface2)',
                        }}
                      >
                        <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>{item[1]}</div>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {creationFlow.currentStep === 'goal' ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    ['general-purpose', 'General-purpose'],
                    ['tailor-to-job', 'Tailor to a specific job'],
                    ['build-master', 'Build or update master resume'],
                  ].map(function (item) {
                    const value = item[0] as 'general-purpose' | 'tailor-to-job' | 'build-master';
                    const isSelected = creationFlow.goalMode === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={function () {
                          setGoalMode(value);
                        }}
                        className="rounded-xl border p-4 text-left transition-colors hover:opacity-95 active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
                        style={{
                          borderColor: isSelected ? 'var(--p-accent)' : 'var(--p-border)',
                          background: isSelected ? 'color-mix(in srgb, var(--p-accent) 8%, var(--p-surface))' : 'var(--p-surface2)',
                        }}
                      >
                        <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>{item[1]}</div>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {creationFlow.currentStep === 'target-context' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['targetRoleTitle', 'Target role / title'],
                    ['seriesGrade', 'Series / grade if known'],
                    ['agencyDomain', 'Agency / domain if known'],
                    ['plainLanguageGoal', 'Plain-language goal'],
                  ].map(function (item) {
                    return (
                      <label key={item[0]} className="block">
                        <span className="mb-1 block text-sm font-medium" style={{ color: 'var(--p-text)' }}>{item[1]}</span>
                        <input
                          type="text"
                          value={targetContextFieldValue(
                            item[0] as 'targetRoleTitle' | 'seriesGrade' | 'agencyDomain' | 'plainLanguageGoal',
                            creationFlow.targetContext,
                          )}
                          onChange={function (event) {
                            updateTargetContextField(item[0] as 'targetRoleTitle' | 'seriesGrade' | 'agencyDomain' | 'plainLanguageGoal', event.target.value);
                          }}
                          className="w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
                          style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)', color: 'var(--p-text)' }}
                        />
                      </label>
                    );
                  })}
                  <label className="md:col-span-2">
                    <span className="mb-1 block text-sm font-medium" style={{ color: 'var(--p-text)' }}>Job announcement text</span>
                    <textarea
                      value={creationFlow.targetContext.jobAnnouncementText}
                      onChange={function (event) {
                        updateTargetContextField('jobAnnouncementText', event.target.value);
                      }}
                      className="min-h-32 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
                      style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)', color: 'var(--p-text)' }}
                    />
                  </label>
                </div>
              ) : null}

              {creationFlow.currentStep === 'confirm' ? (
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>Start method</p>
                      <p className="mt-1 text-sm" style={{ color: 'var(--p-text)' }}>{creationFlow.startMethod}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>Goal</p>
                      <p className="mt-1 text-sm" style={{ color: 'var(--p-text)' }}>{creationFlow.goalMode}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>Target role</p>
                      <p className="mt-1 text-sm" style={{ color: 'var(--p-text)' }}>
                        {creationFlow.targetContext.targetRoleTitle.trim().length > 0 ? creationFlow.targetContext.targetRoleTitle : 'Not added yet'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>Plain-language goal</p>
                      <p className="mt-1 text-sm" style={{ color: 'var(--p-text)' }}>
                        {creationFlow.targetContext.plainLanguageGoal.trim().length > 0 ? creationFlow.targetContext.plainLanguageGoal : 'Not added yet'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  onClick={function () {
                    if (currentIndex > 0) {
                      setCreationStep(CREATION_STEPS[currentIndex - 1]);
                    } else {
                      nav.push('/dashboard/resume');
                    }
                  }}
                  className={SECONDARY_BUTTON_CLASS}
                  style={{ borderColor: 'var(--p-border)', color: 'var(--p-text-muted)' }}
                >
                  {currentIndex > 0 ? 'Back' : 'Return to workspace'}
                </button>
                <button
                  type="button"
                  onClick={function () {
                    if (creationFlow.currentStep === 'confirm') {
                      const resumeId = createResumeFromFlow();
                      navigateToBuilder(resumeId);
                      return;
                    }
                    setCreationStep(CREATION_STEPS[currentIndex + 1]);
                  }}
                  className={PRIMARY_BUTTON_CLASS}
                  style={{ background: 'var(--p-accent)', color: 'var(--p-bg)' }}
                >
                  {creationFlow.currentStep === 'confirm' ? 'Open builder' : 'Continue'}
                </button>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard title="Why this step matters" subtitle="Trust-first microcopy stays explicit throughout the flow.">
            <p className="text-sm" style={{ color: 'var(--p-text-muted)' }}>
              {creationFlow.currentStep === 'document-type' ? 'The product shape starts by making the resume explicit instead of burying it in a generic document picker.' : null}
              {creationFlow.currentStep === 'start-method' ? 'Start method controls how much structure arrives with the draft. The UI stays honest about what is copied versus what remains blank.' : null}
              {creationFlow.currentStep === 'goal' ? 'Goal mode defines whether the draft behaves like a master resume or a tailored variant in later screens.' : null}
              {creationFlow.currentStep === 'target-context' ? 'Target context is kept as clean structured input so later federal-aware diagnostics can plug in without refactoring the flow.' : null}
              {creationFlow.currentStep === 'confirm' ? 'The setup summary shows exactly what will open in the builder and leaves unfinished intelligence work clearly out of scope.' : null}
            </p>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  function renderBuilder(): React.ReactNode {
    if (activeSummary === null || activeDraft === null) {
      return (
        <SurfaceCard title="Resume not found" subtitle="Select or create a resume from the workspace home.">
          <button
            type="button"
            onClick={function () {
              nav.push('/dashboard/resume');
            }}
            className={PRIMARY_BUTTON_CLASS}
            style={{ background: 'var(--p-accent)', color: 'var(--p-bg)' }}
          >
            Return to workspace
          </button>
        </SurfaceCard>
      );
    }

    const diagnosticsResponse = effectiveDiagnosticsResponse;
    const explanations =
      diagnosticsResponse !== null ? diagnosticsResponse.explanations : null;
    const hasExplanations = hasResumeExplanations(explanations);
    const rewriteEligibility = getResumeRewriteEligibility(
      activeSummary,
      latestSnapshot,
      latestSnapshot,
      diagnosticsResponse
    );
    const evaluationStatusLine =
      latestSnapshot !== null
        ? 'Last evaluated ' + formatEvaluatedAt(latestSnapshot.evaluatedAt)
        : 'No saved diagnostics snapshot yet';

    /**
     * The builder view mode drives the workspace composition. In canvas mode
     * the document dominates and the right rail is hidden. When the user opens
     * guidance or diagnostics the rail slides in alongside the document.
     */
    const viewMode: ResumeBuilderViewMode = ui.builderViewMode;
    const isRailOpen = viewMode === 'focus_guidance' || viewMode === 'diagnostics';

    /**
     * Grid class switches between two-column (canvas mode, document takes
     * full remaining width) and three-column (rail open, 340px right rail).
     */
    const mainGridClass = isRailOpen
      ? 'grid gap-6 xl:grid-cols-[180px_minmax(0,1fr)_340px]'
      : 'grid gap-6 xl:grid-cols-[180px_minmax(0,1fr)]';

    return (
      <div className="space-y-4">
        {/* ----------------------------------------------------------------
         * STABLE TOP BAR — compact resume metadata + mode toggles
         * ---------------------------------------------------------------- */}
        <div
          className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
          style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
        >
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>{activeSummary.name}</div>
              <div className="mt-0.5 text-xs" style={{ color: 'var(--p-text-dim)' }}>
                {activeSummary.mode === 'master' ? 'Master' : 'Tailored'}
                {activeSummary.targetContext.targetRoleTitle.trim().length > 0 ? ' · ' + activeSummary.targetContext.targetRoleTitle : ''}
              </div>
            </div>
            <div
              className="hidden h-6 w-px md:block"
              style={{ background: 'var(--p-border)' }}
              aria-hidden
            />
            <div className="text-xs" style={{ color: 'var(--p-text-dim)' }}>
              {diagnosticsResponse !== null ? formatReadinessBandLabel(diagnosticsResponse.overall.readiness_band) : diagnosticsStatusHeading(review.status)}
              <span className="mx-1">·</span>
              {evaluationStatusLine}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Workspace mode toggle — canvas (default) vs guidance vs diagnostics */}
            <BuilderModeToggle
              activeMode={viewMode}
              onSelectMode={setBuilderViewMode}
            />
            <div
              className="hidden h-6 w-px md:block"
              style={{ background: 'var(--p-border)' }}
              aria-hidden
            />
            <button type="button" onClick={function () { openDialog('save-master'); }} className="rounded-md border px-2 py-1 text-xs font-medium transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]" style={{ borderColor: 'var(--p-border)', color: 'var(--p-text-muted)' }}>Save master</button>
            <button type="button" onClick={function () { openDialog('save-variant'); }} className="rounded-md border px-2 py-1 text-xs font-medium transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]" style={{ borderColor: 'var(--p-border)', color: 'var(--p-text-muted)' }}>Save variant</button>
            <button
              type="button"
              onClick={function () {
                navigateToReview(activeSummary.id);
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
              style={{ background: 'var(--p-accent)', color: 'var(--p-bg)' }}
            >
              Review
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------------
         * MAIN AREA — section rail + document canvas + optional right rail
         * ---------------------------------------------------------------- */}
        <div className={mainGridClass}>
          {/* LEFT RAIL — slim section navigation */}
          <div className="space-y-2">
            {BUILDER_SECTIONS.map(function (section) {
              const isActive = builder.activeSection === section;
              const isComplete = builder.sectionCompletion[section];
              const isHighlighted = review.highlightedSections.indexOf(section) >= 0;
              return (
                <button
                  key={section}
                  type="button"
                  onClick={function () {
                    setActiveSection(section);
                  }}
                  className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 hover:opacity-95 active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
                  style={{
                    background: isActive ? 'color-mix(in srgb, var(--p-accent) 12%, var(--p-surface))' : 'var(--p-surface2)',
                    borderColor: isActive || isHighlighted ? 'var(--p-accent)' : 'var(--p-border)',
                    boxShadow: isActive ? 'inset 3px 0 0 var(--p-accent)' : 'none',
                  }}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span className="text-sm font-medium" style={{ color: 'var(--p-text)' }}>
                    {builderSectionLabel(section)}
                  </span>
                  <span
                    className="ml-1 inline-block h-2 w-2 rounded-full"
                    style={{
                      background: isHighlighted
                        ? 'var(--p-warning)'
                        : isComplete
                          ? 'var(--p-success)'
                          : 'var(--p-text-dim)',
                    }}
                    aria-label={isHighlighted ? 'Needs attention' : isComplete ? 'Complete' : 'In progress'}
                  />
                </button>
              );
            })}
          </div>

          {/* CENTER CANVAS — document-first editing surface */}
          <div className="space-y-0">
            <div
              className="rounded-xl border px-6 py-5"
              style={{
                borderColor: 'color-mix(in srgb, var(--p-border) 70%, white)',
                background: 'color-mix(in srgb, white 96%, var(--p-surface))',
                color: '#111827',
                boxShadow: '0 8px 32px rgba(15, 23, 42, 0.10)',
              }}
            >
              {/* Contact header */}
              <div className="border-b pb-4" style={{ borderColor: '#e5e7eb' }}>
                <input
                  type="text"
                  value={activeDraft.contact.fullName}
                  onChange={function (event) {
                    updateContactField('fullName', event.target.value);
                  }}
                  className="w-full border border-transparent p-0 text-2xl font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-sky-600"
                  style={{ background: 'transparent', color: '#111827' }}
                  aria-label="Resume full name"
                />
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {[
                    ['email', 'Email', activeDraft.contact.email],
                    ['phone', 'Phone', activeDraft.contact.phone],
                    ['city', 'City', activeDraft.contact.city],
                    ['state', 'State', activeDraft.contact.state],
                  ].map(function (item) {
                    return (
                      <label key={item[0]} className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{item[1]}</span>
                        <input
                          type="text"
                          value={String(item[2])}
                          onChange={function (event) {
                            updateContactField(item[0] as 'email' | 'phone' | 'city' | 'state', event.target.value);
                          }}
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition-colors duration-150 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-600"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Body sections — document-first, inline guidance is demoted */}
              {BUILDER_SECTIONS.filter(function (section) { return section !== 'contact' && section !== 'review'; }).map(function (section) {
                const isFocused = builder.activeSection === section;
                const isHighlighted = review.highlightedSections.indexOf(section) >= 0;
                const value = sectionTextValue(section, activeDraft);
                const sectionExplanation = findSectionExplanation(explanations, section);
                const sectionRewriteIsActive =
                  rewrite.status !== 'idle' &&
                  rewrite.status !== 'dismissed' &&
                  rewrite.request !== null &&
                  rewrite.request.target.section_id === section;
                const hasGuidance = sectionExplanation !== null;
                return (
                  <section
                    key={section}
                    id={'resume-builder-section-' + section}
                    className="relative border-b px-0 py-4 transition-colors duration-150 last:border-b-0"
                    style={{
                      borderColor: '#e5e7eb',
                      background: isFocused
                        ? 'color-mix(in srgb, var(--p-accent) 3%, transparent)'
                        : 'transparent',
                    }}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {builderSectionLabel(section)}
                        </h3>
                        {/* Subtle status indicators — not heavy inline panels */}
                        {hasGuidance ? (
                          <button
                            type="button"
                            onClick={function () {
                              setActiveSection(section);
                              setBuilderViewMode('focus_guidance');
                            }}
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-80 active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
                            style={{ borderColor: '#c4b5fd', background: '#f5f3ff', color: '#6d28d9' }}
                            aria-label={'Open guidance for ' + builderSectionLabel(section)}
                          >
                            <Sparkles className="h-2.5 w-2.5" aria-hidden />
                            Guidance
                          </button>
                        ) : null}
                        {sectionRewriteIsActive ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                            style={{ borderColor: '#7dd3fc', background: '#eff6ff', color: '#075985' }}
                          >
                            <span
                              className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full"
                              style={{ background: '#0ea5e9' }}
                            />
                            Rewriting
                          </span>
                        ) : null}
                        {isHighlighted && !isFocused ? (
                          <span
                            className="inline-flex h-1.5 w-1.5 rounded-full"
                            style={{ background: 'var(--p-warning)' }}
                            aria-label="Diagnostics target"
                          />
                        ) : null}
                      </div>
                      {isFocused ? (
                        <button
                          type="button"
                          onClick={function () {
                            setActiveSection(section);
                            setBuilderViewMode('focus_guidance');
                          }}
                          className="rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors duration-150 hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
                          style={{ borderColor: '#d1d5db', color: '#1d4ed8', background: 'rgba(255,255,255,0.88)' }}
                        >
                          Focus guidance
                        </button>
                      ) : null}
                    </div>
                    <textarea
                      value={value}
                      onFocus={function () {
                        setActiveSection(section);
                      }}
                      onChange={function (event) {
                        if (section === 'summary') {
                          updateSummary(event.target.value);
                        } else if (section === 'experience') {
                          updateExperienceText(event.target.value);
                        } else if (section === 'education') {
                          updateEducationText(event.target.value);
                        } else if (section === 'skills') {
                          updateSkillsText(event.target.value);
                        }
                      }}
                      className="min-h-20 w-full rounded-md border px-3 py-3 text-sm text-slate-900 transition-colors duration-150 hover:border-slate-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                      style={{
                        borderColor: isFocused ? '#38bdf8' : 'rgba(226,232,240,0.8)',
                        background: isFocused ? 'rgba(255,255,255,0.99)' : 'rgba(255,255,255,0.6)',
                        boxShadow: isFocused ? '0 0 0 1px rgba(14,165,233,0.1)' : 'none',
                        resize: 'vertical',
                      }}
                    />
                    {/* Active rewrite panel stays inline — it is part of the
                        editing decision flow, not background guidance */}
                    {sectionRewriteIsActive ? (
                      <div className="mt-3">
                        <ResumeRewritePanel
                          rewrite={rewrite}
                          onApplyCandidate={applyResumeRewriteCandidate}
                          onDismiss={dismissResumeRewrite}
                        />
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          </div>

          {/* RIGHT RAIL — on-demand guidance / diagnostics / context panel.
              Only visible when the user intentionally opens it via the mode
              toggle or a section "Focus guidance" button. */}
          {isRailOpen ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-3 gap-1.5" style={{ flex: 1 }}>
                  <RailTabButton tab="guidance" label="Guidance" activeTab={ui.rightRailTab} onSelect={function (tab) { setRightRailTab(tab); }} />
                  <RailTabButton tab="diagnostics" label="Diagnostics" activeTab={ui.rightRailTab} onSelect={function (tab) { setRightRailTab(tab); }} />
                  <RailTabButton tab="context" label="Context" activeTab={ui.rightRailTab} onSelect={function (tab) { setRightRailTab(tab); }} />
                </div>
                <button
                  type="button"
                  onClick={function () {
                    setBuilderViewMode('canvas');
                  }}
                  className="ml-2 rounded-md border p-1.5 transition-opacity hover:opacity-80 active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
                  style={{ borderColor: 'var(--p-border)', color: 'var(--p-text-muted)' }}
                  aria-label="Close panel and return to canvas"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>

              <div className="space-y-3">
                {ui.rightRailTab === 'guidance' ? (
                  <div className="space-y-3">
                    <div
                      className="rounded-xl border p-4"
                      style={{
                        borderColor: activeSectionExplanation !== null ? 'var(--p-accent)' : 'var(--p-border)',
                        background: activeSectionExplanation !== null
                          ? 'color-mix(in srgb, var(--p-accent) 8%, var(--p-surface))'
                          : 'var(--p-surface2)',
                      }}
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
                        Attached to active section
                      </div>
                      <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
                        PathAdvisor is attached to {builderSectionLabel(builder.activeSection)}
                      </div>
                      <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
                        {activeSectionExplanation !== null
                          ? 'The builder, guidance, and rewrite actions are currently aligned to this section.'
                          : 'Select a section to keep guidance, rewrite actions, and editing focused in one place.'}
                      </p>
                    </div>
                    {/* Rewrite actions for the active section — surfaced here
                        instead of cluttering the canvas inline */}
                    {renderGuidanceRailRewriteActions(rewriteEligibility, diagnosticsResponse)}
                    <PathAdvisorSummary
                      explanations={explanations}
                      fallbackHeadline={diagnosticsStatusHeading(review.status)}
                      fallbackDetail={diagnosticsResponse !== null ? diagnosticsResponse.overall.summary : diagnosticsStatusMessage(review.status)}
                      statusLabel={review.status === 'evaluated' ? 'PathAdvisor guidance' : 'Diagnostics state'}
                    />
                    <WarningExplanationList explanations={explanations} />
                    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                      <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
                        Key takeaways
                      </div>
                      <div className="mt-3">
                        <KeyTakeawaysPanel
                          explanations={explanations}
                          onFocusTargetRefs={focusDiagnosticsTargetRefs}
                        />
                      </div>
                    </div>
                    {/* Section-specific guidance that was previously inlined in
                        every canvas section is now contained here */}
                    {activeSectionExplanation !== null ? (
                      <SectionGuidance
                        explanation={activeSectionExplanation}
                        onFocusTargetRefs={focusDiagnosticsTargetRefs}
                        variant="builder"
                        attachmentLabel={'Attached to ' + builderSectionLabel(builder.activeSection)}
                      />
                    ) : null}
                    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
                            Guidance refresh
                          </div>
                          <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
                            {hasExplanations ? 'PathAdvisor is rendering backend explanation objects for this draft.' : diagnosticsStatusMessage(review.status)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={function () {
                            void evaluateActiveResumeDiagnostics();
                          }}
                          className="rounded-md border px-3 py-2 text-xs font-medium transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
                          style={{ borderColor: 'var(--p-border)', color: 'var(--p-accent)' }}
                        >
                          {review.status === 'loading' ? 'Refreshing...' : 'Run diagnostics'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {ui.rightRailTab === 'diagnostics' ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
                            {diagnosticsStatusHeading(review.status)}
                          </div>
                          <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
                            {review.errorMessage !== null ? review.errorMessage : diagnosticsStatusMessage(review.status)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={function () {
                            void evaluateActiveResumeDiagnostics();
                          }}
                          className="rounded-md border px-3 py-2 text-xs font-medium transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
                          style={{ borderColor: 'var(--p-border)', color: 'var(--p-accent)' }}
                        >
                          {review.status === 'loading' ? 'Running...' : 'Refresh'}
                        </button>
                      </div>
                    </div>
                    {diagnosticsResponse !== null ? (
                      <div className="rounded-xl border p-3" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
                          Backend snapshot
                        </div>
                        <div className="mt-2 grid gap-2">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span style={{ color: 'var(--p-text-muted)' }}>Readiness</span>
                            <span style={{ color: 'var(--p-text)' }}>
                              {formatReadinessBandLabel(diagnosticsResponse.overall.readiness_band)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span style={{ color: 'var(--p-text-muted)' }}>Issues</span>
                            <span style={{ color: 'var(--p-text)' }}>
                              {diagnosticsResponse.issues.length.toString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span style={{ color: 'var(--p-text-muted)' }}>Recommendations</span>
                            <span style={{ color: 'var(--p-text)' }}>
                              {diagnosticsResponse.recommendations.length.toString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span style={{ color: 'var(--p-text-muted)' }}>Evaluated sections</span>
                            <span style={{ color: 'var(--p-text)' }}>
                              {diagnosticsResponse.scope.evaluated_section_ids.length.toString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}>
                        {diagnosticsStatusMessage(review.status)}
                      </div>
                    )}
                  </div>
                ) : null}

                {ui.rightRailTab === 'context' ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>Mode</div>
                      <div className="mt-1 text-sm" style={{ color: 'var(--p-text)' }}>{activeSummary.mode === 'master' ? 'Master resume' : 'Tailored variant'}</div>
                    </div>
                    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>Target role</div>
                      <div className="mt-1 text-sm" style={{ color: 'var(--p-text)' }}>
                        {activeSummary.targetContext.targetRoleTitle.trim().length > 0 ? activeSummary.targetContext.targetRoleTitle : 'No role attached yet'}
                      </div>
                    </div>
                    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>Federal readiness hook</div>
                      <div className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
                        Series, grade, agency, and announcement text remain explicit fields so federal-aware review logic can connect later without changing the user flow.
                      </div>
                    </div>
                    {diagnosticsResponse !== null ? (
                      <div className="rounded-xl border p-3" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>Diagnostics engine</div>
                        <div className="mt-1 text-sm" style={{ color: 'var(--p-text)' }}>
                          {diagnosticsResponse.meta.engine_version}
                        </div>
                        <div className="mt-1 text-xs" style={{ color: 'var(--p-text-muted)' }}>
                          Ruleset {diagnosticsResponse.meta.ruleset_version} · Explainability {diagnosticsResponse.meta.explainability_version}
                        </div>
                        <div className="mt-1 text-xs" style={{ color: 'var(--p-text-dim)' }}>
                          Revision {activeSummary.currentRevisionId}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  /**
   * Renders rewrite action cards inside the guidance rail for the currently
   * active section. This moves rewrite affordances out of the default canvas
   * and into the on-demand guidance panel where they can be reviewed without
   * cluttering the document view.
   *
   * All resume state (activeSummary, activeDraft, latestSnapshot, etc.) is
   * captured from the parent closure — no extra parameters needed.
   */
  function renderGuidanceRailRewriteActions(
    rewriteEligibility: { canRewrite: boolean; reason: string | null },
    currentDiagnosticsResponse: typeof effectiveDiagnosticsResponse
  ): React.ReactNode {
    if (activeSummary === null || activeDraft === null) {
      return null;
    }
    const section = builder.activeSection;
    if (section === 'contact' || section === 'review') {
      return null;
    }
    const rewriteActions =
      section === 'summary' ||
      section === 'experience' ||
      section === 'skills'
        ? listResumeSectionRewriteActions({
            summary: activeSummary,
            draft: activeDraft,
            latestSnapshot: latestSnapshot,
            selectedSnapshot: latestSnapshot,
            diagnosticsResponse: currentDiagnosticsResponse,
            recommendation: null,
            explanation: null,
          }, section)
        : [];
    if (rewriteActions.length === 0) {
      return null;
    }
    return (
      <BuilderRewriteActionList
        actions={rewriteActions}
        canRewrite={rewriteEligibility.canRewrite}
        rewriteDisabledReason={rewriteEligibility.reason}
        onRequestRewrite={function (action) {
          void requestResumeRewrite(action.request);
        }}
      />
    );
  }

  function renderReview(): React.ReactNode {
    if (activeSummary === null || activeDraft === null) {
      return renderBuilder();
    }
    const exportReadiness = getResumeExportReadiness(
      activeSummary,
      latestSnapshot
    );
    const diagnosticsResponse = effectiveDiagnosticsResponse;
    const explanations =
      diagnosticsResponse !== null ? diagnosticsResponse.explanations : null;
    const rewriteEligibility = getResumeRewriteEligibility(
      activeSummary,
      latestSnapshot,
      selectedSnapshot,
      diagnosticsResponse
    );
    const readinessLabel =
      diagnosticsResponse !== null
        ? formatReadinessBandLabel(diagnosticsResponse.overall.readiness_band)
        : null;
    const evaluationStateMessage =
      review.status === 'loading' && latestSnapshot !== null
        ? 'Refreshing diagnostics. Showing the last saved evaluation from ' + formatEvaluatedAt(latestSnapshot.evaluatedAt) + '.'
        : selectedSnapshot !== null
          ? 'Viewing saved snapshot from ' + formatEvaluatedAt(selectedSnapshot.evaluatedAt) + '.'
          : latestSnapshot !== null
            ? 'Last saved evaluation: ' + formatEvaluatedAt(latestSnapshot.evaluatedAt) + '.'
          : diagnosticsStatusMessage(review.status);
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-xl border p-6 md:flex-row md:items-end md:justify-between" style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--p-accent)' }}>Review / Optimize</p>
            <h1 className="mt-1 text-2xl font-semibold" style={{ color: 'var(--p-text)' }}>
              Review shell for {activeSummary.name}
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--p-text-muted)' }}>
              This review surface renders backend PathAdvisor explanations anchored to the resume. PathOS shows transport state clearly and does not invent findings or rewrite logic on the client.
            </p>
            <p className="mt-2 text-xs" style={{ color: 'var(--p-text-dim)' }}>
              Variant {activeSummary.variantId} · Revision {activeSummary.currentRevisionId}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={function () {
                void evaluateActiveResumeDiagnostics();
              }}
              className={SECONDARY_BUTTON_CLASS}
              style={{ borderColor: 'var(--p-border)', color: 'var(--p-text-muted)' }}
            >
              {review.status === 'loading' ? 'Running diagnostics...' : 'Refresh diagnostics'}
            </button>
            <button
              type="button"
              onClick={function () {
                navigateToBuilder(activeSummary.id);
              }}
              className={SECONDARY_BUTTON_CLASS}
              style={{ borderColor: 'var(--p-border)', color: 'var(--p-text-muted)' }}
            >
              Back to builder
            </button>
          </div>
        </div>

        <ResumeSnapshotHistoryPanel
          snapshots={variantSnapshots}
          selectedSnapshotId={selectedSnapshot !== null ? selectedSnapshot.snapshotId : null}
          compareSnapshotId={review.compareSnapshotId}
          isCompareMode={review.isCompareMode}
          onSelectSnapshot={selectReviewSnapshot}
          onCompareSnapshot={setCompareSnapshotId}
          onToggleCompareMode={setCompareMode}
        />

        <ResumeExportReadinessCard readinessSummary={exportReadiness} />

        {review.isCompareMode ? (
          <ResumeSnapshotComparePanel
            currentSnapshot={selectedSnapshot}
            compareSnapshot={compareSnapshot}
            compareSummary={compareSummary}
          />
        ) : null}

        {review.isCompareMode || variantRevisionSnapshots.length > 0 ? (
          <ResumeRevisionDiffPanel
            currentRevisionSnapshot={selectedRevisionSnapshot}
            compareRevisionSnapshot={compareRevisionSnapshot}
            diffSummary={revisionDiffSummary}
          />
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard title="PathAdvisor summary" subtitle="The backend owns summary text, priority framing, and all review explanations.">
              <PathAdvisorSummary
                explanations={explanations}
                fallbackHeadline={readinessLabel !== null ? readinessLabel : diagnosticsStatusHeading(review.status)}
                fallbackDetail={diagnosticsResponse !== null ? diagnosticsResponse.overall.summary : evaluationStateMessage}
                statusLabel={review.status === 'evaluated' ? 'Resume explanation' : 'Diagnostics state'}
              />
            {review.errorMessage !== null ? (
              <p className="mt-4 text-sm" style={{ color: 'var(--p-text-muted)' }}>{review.errorMessage}</p>
            ) : null}
            <p className="mt-4 text-xs" style={{ color: 'var(--p-text-dim)' }}>
              {evaluationStateMessage}
            </p>
            <div className="mt-4">
              <WarningExplanationList explanations={explanations} />
            </div>
          </SurfaceCard>

          <SurfaceCard title="Key takeaways" subtitle="Short backend-owned actions stay ordered and anchored to the resume when target refs are present.">
            <KeyTakeawaysPanel
              explanations={explanations}
              onFocusTargetRefs={focusDiagnosticsTargetRefs}
            />
          </SurfaceCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <SurfaceCard title="Section guidance" subtitle="PathAdvisor explanations stay tied to resume sections instead of floating as global prose.">
            <div className="space-y-3">
              {diagnosticsResponse !== null && explanations !== null && explanations !== undefined && Array.isArray(explanations.section_explanations) ? explanations.section_explanations.map(function (sectionExplanation, index) {
                return (
                  <SectionGuidance
                    key={sectionExplanation.section_id + '-' + index.toString()}
                    explanation={sectionExplanation}
                    onFocusTargetRefs={focusDiagnosticsTargetRefs}
                  />
                );
              }) : (
                <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}>
                  {diagnosticsStatusMessage(review.status)}
                </div>
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard title="Guidance strip" subtitle="Compact recommendation cards keep the right rail intentional instead of duplicating the full review.">
            <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}>
              Rewrite suggestions open in the builder so the editable text, pending state, and approved changes stay attached to the live draft.
            </div>
            <RecommendationList
              explanations={explanations}
              diagnosticsRecommendations={diagnosticsResponse !== null ? diagnosticsResponse.recommendations : null}
              canRequestRewrite={rewriteEligibility.canRewrite}
              rewriteDisabledReason={rewriteEligibility.reason}
              rewriteButtonLabel="Rewrite in Builder"
              onRequestRewrite={function (recommendation, explanation) {
                const request = buildResumeRewriteRequest({
                  summary: activeSummary,
                  draft: activeDraft,
                  latestSnapshot: latestSnapshot,
                  selectedSnapshot: selectedSnapshot,
                  diagnosticsResponse: diagnosticsResponse,
                  recommendation: recommendation,
                  explanation: explanation,
                });
                if (request !== null) {
                  void requestResumeRewrite(request);
                  navigateToBuilder(activeSummary.id);
                }
              }}
              onFocusTargetRefs={focusDiagnosticsTargetRefs}
              emptyMessage="PathAdvisor recommendation cards will appear here when the backend provides them."
            />
            {review.highlightedSections.length > 0 ? (
              <button
                type="button"
                onClick={clearDiagnosticsHighlights}
                className="mt-4 rounded-md border px-4 py-3 text-sm font-medium transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
                style={{ borderColor: 'var(--p-border)', color: 'var(--p-text-muted)' }}
              >
                Clear section highlights
              </button>
            ) : null}
            <button
              type="button"
              onClick={function () {
                openDialog('export');
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-md px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
              style={{ background: 'var(--p-accent)', color: 'var(--p-bg)' }}
            >
              <Download className="h-4 w-4" aria-hidden />
              Export
            </button>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  function renderDialog(): React.ReactNode {
    if (ui.activeDialog === 'save-master') {
      return (
        <ActionDialog
          title="Save as master resume"
          description="This promotes the current draft to the master resume concept in the Day 75 workspace model."
          confirmLabel="Save master"
          onConfirm={saveAsMasterResume}
          onClose={closeDialog}
        />
      );
    }
    if (ui.activeDialog === 'save-variant') {
      return (
        <ActionDialog
          title="Save as tailored variant"
          description="This creates a distinct tailored variant entry point without claiming automatic rewrite intelligence."
          confirmLabel="Create variant"
          onConfirm={function () {
            const nextId = saveAsTailoredVariant();
            if (nextId !== null) {
              navigateToBuilder(nextId);
            }
          }}
          onClose={closeDialog}
        />
      );
    }
    if (ui.activeDialog === 'duplicate') {
      return (
        <ActionDialog
          title="Duplicate for another target"
          description="This clones the current draft, clears the targeting context, and leaves the new variant ready for a different target role."
          confirmLabel="Duplicate"
          onConfirm={function () {
            const nextId = duplicateForAnotherTarget();
            if (nextId !== null) {
              navigateToBuilder(nextId);
            }
          }}
          onClose={closeDialog}
        />
      );
    }
    if (ui.activeDialog === 'export') {
      return (
        <ActionDialog
          title="Export entry point"
          description="Live export hardening remains out of scope today. This action marks the resume as export-ready and preserves the UI entry point for later wiring."
          confirmLabel="Mark export-ready"
          onConfirm={markExportReady}
          onClose={closeDialog}
        />
      );
    }
    return null;
  }

  let content: React.ReactNode = renderHome();
  if (props.view === 'new') {
    content = renderNewFlow();
  } else if (props.view === 'builder') {
    content = renderBuilder();
  } else if (props.view === 'review') {
    content = renderReview();
  }

  return (
    <div className="relative space-y-6 pb-8">
      {content}
      {ui.toastMessage ? (
        <button
          type="button"
          onClick={clearToast}
          className="fixed bottom-4 right-4 rounded-lg border px-4 py-3 text-left shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
          style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5" style={{ color: 'var(--p-success)' }} aria-hidden />
            <div>
              <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>Resume workspace update</div>
              <div className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>{ui.toastMessage}</div>
            </div>
          </div>
        </button>
      ) : null}
      {renderDialog()}
    </div>
  );
}
