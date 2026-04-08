/**
 * ============================================================================
 * RESUME WORKSPACE SCREEN — Day 75 guided flow foundation
 * ============================================================================
 *
 * PURPOSE:
 * This screen powers the new canonical resume workspace routes:
 *   - /dashboard/resume
 *   - /dashboard/resume/new
 *   - /dashboard/resume/[resumeId]
 *   - /dashboard/resume/[resumeId]/review
 *
 * WHY THIS FILE EXISTS:
 * The older resume-builder and resume-readiness surfaces are still present in
 * the repo, but Day 75 needs a cleaner frontend-first architecture foundation.
 * This screen delivers that bounded foundation with:
 *   - a workspace home
 *   - a guided new-resume flow
 *   - a document-centered builder shell
 *   - a dedicated review shell
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
  Target,
  ArrowRight,
  FolderPlus,
  Download,
  CheckCircle2,
  AlertCircle,
  LayoutPanelLeft,
} from 'lucide-react';
import type { ResumeDraft } from '@pathos/core';
import {
  useResumeWorkspaceStore,
  type ResumeBuilderSection,
  type ResumeCreationStep,
  type ResumeDraftSummary,
  type ResumeRightRailTab,
  type ResumeWorkspaceRouteView,
} from '../stores/resumeWorkspaceStore';
import {
  formatReadinessBandLabel,
  mapDiagnosticsSectionIdToBuilderSection,
  type ResumeTargetRef,
} from '../resume-workspace/resumeDiagnostics';

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
  if (status === 'evaluated') return 'These findings, recommendations, and readiness signals come directly from the backend diagnostics response.';
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

function formatSectionRefLabel(targetRef: ResumeTargetRef): string {
  const builderSection = mapDiagnosticsSectionIdToBuilderSection(targetRef.section_id);
  if (
    typeof targetRef.bullet_id === 'string' &&
    targetRef.bullet_id.trim().length > 0
  ) {
    return builderSectionLabel(builderSection) + ' detail';
  }
  return builderSectionLabel(builderSection);
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

function DiagnosticsTargetRefList(props: {
  targetRefs: ResumeTargetRef[];
  onFocus: (targetRefs: ResumeTargetRef[]) => void;
}) {
  if (props.targetRefs.length === 0) {
    return null;
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {props.targetRefs.map(function (targetRef, index) {
        const label = formatSectionRefLabel(targetRef);
        return (
          <button
            key={targetRef.section_id + '-' + String(targetRef.bullet_id) + '-' + index.toString()}
            type="button"
            onClick={function () {
              props.onFocus([targetRef]);
            }}
            className="rounded-full border px-2 py-1 text-xs font-medium transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
            style={{ borderColor: 'var(--p-border)', color: 'var(--p-accent)' }}
          >
            Open {label}
          </button>
        );
      })}
    </div>
  );
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

  function navigateToBuilder(resumeId: string) {
    nav.push('/dashboard/resume/' + resumeId);
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
              Resume Workspace Home
            </p>
            <h1 className="mt-1 text-2xl font-semibold" style={{ color: 'var(--p-text)' }}>
              Build, tailor, review, and export from one document-centered flow.
            </h1>
            <p className="mt-2 max-w-3xl text-sm" style={{ color: 'var(--p-text-muted)' }}>
              PathOS keeps the resume as the main object, preserves master versus tailored variants, and uses honest placeholder review surfaces until live deterministic diagnostics are connected.
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
                    The safest Day 75 move is to treat the master resume as the source of truth, create tailored variants only when a role is defined, and use review mode for deterministic cleanup before export.
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm" style={{ color: 'var(--p-text-muted)' }}>
                <div className="flex items-start gap-2">
                  <ArrowRight className="mt-0.5 h-4 w-4" aria-hidden />
                  <span>Create a new resume if you need a clean workspace or a separate variant.</span>
                </div>
                <div className="flex items-start gap-2">
                  <ArrowRight className="mt-0.5 h-4 w-4" aria-hidden />
                  <span>Add a role title or announcement before expecting tailored review guidance.</span>
                </div>
                <div className="flex items-start gap-2">
                  <ArrowRight className="mt-0.5 h-4 w-4" aria-hidden />
                  <span>Use the review shell to see what is deterministic today and what is explicitly placeholder-bound.</span>
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

    return (
      <div className="space-y-6">
        <div className="grid gap-3 rounded-xl border p-4 xl:grid-cols-7" style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>Resume name</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--p-text)' }}>{activeSummary.name}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>Mode</div>
            <div className="mt-1 text-sm" style={{ color: 'var(--p-text)' }}>{activeSummary.mode === 'master' ? 'Master' : 'Tailored'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>Target job</div>
            <div className="mt-1 text-sm" style={{ color: 'var(--p-text)' }}>
              {activeSummary.targetContext.targetRoleTitle.trim().length > 0 ? activeSummary.targetContext.targetRoleTitle : 'No target linked'}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>Active section</div>
            <div className="mt-1 text-sm" style={{ color: 'var(--p-text)' }}>{builderSectionLabel(builder.activeSection)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>Readiness</div>
            <div className="mt-1 text-sm" style={{ color: 'var(--p-text)' }}>
              {review.response !== null ? formatReadinessBandLabel(review.response.overall.readiness_band) : diagnosticsStatusHeading(review.status)}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>Utility actions</div>
            <div className="mt-1 flex flex-wrap gap-2">
              <button type="button" onClick={function () { openDialog('save-master'); }} className="rounded-md border px-2 py-1 text-xs font-medium transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]" style={{ borderColor: 'var(--p-border)', color: 'var(--p-text-muted)' }}>Save master</button>
              <button type="button" onClick={function () { openDialog('save-variant'); }} className="rounded-md border px-2 py-1 text-xs font-medium transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]" style={{ borderColor: 'var(--p-border)', color: 'var(--p-text-muted)' }}>Save variant</button>
              <button type="button" onClick={function () { openDialog('duplicate'); }} className="rounded-md border px-2 py-1 text-xs font-medium transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]" style={{ borderColor: 'var(--p-border)', color: 'var(--p-text-muted)' }}>Duplicate</button>
            </div>
          </div>
          <div className="flex items-end justify-end">
            <button
              type="button"
              onClick={function () {
                navigateToReview(activeSummary.id);
              }}
              className="inline-flex items-center gap-2 rounded-md px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
              style={{ background: 'var(--p-accent)', color: 'var(--p-bg)' }}
            >
              Open review
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
          <SurfaceCard title="Sections" subtitle="Left rail navigation stays stable while the document remains central.">
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
                    className="flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left transition-colors hover:opacity-95 active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
                    style={{
                      background: isActive ? 'color-mix(in srgb, var(--p-accent) 8%, var(--p-surface))' : 'var(--p-surface2)',
                      borderColor: isActive || isHighlighted ? 'var(--p-accent)' : 'var(--p-border)',
                    }}
                  >
                    <span className="text-sm font-medium" style={{ color: 'var(--p-text)' }}>
                      {builderSectionLabel(section)}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: isComplete ? 'var(--p-success)' : 'var(--p-text-dim)' }}>
                      {isHighlighted ? 'Needs attention' : isComplete ? 'Complete' : 'In progress'}
                    </span>
                  </button>
                );
              })}
            </div>
          </SurfaceCard>

          <SurfaceCard title="Resume canvas" subtitle="The resume remains the main object, not a giant form with a tiny preview.">
            <div className="space-y-4">
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'white', color: '#111827' }}>
                <div className="border-b pb-4" style={{ borderColor: '#d1d5db' }}>
                  <input
                    type="text"
                    value={activeDraft.contact.fullName}
                    onChange={function (event) {
                      updateContactField('fullName', event.target.value);
                    }}
                    className="w-full border-0 p-0 text-2xl font-semibold focus:outline-none"
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
                            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>

                {BUILDER_SECTIONS.filter(function (section) { return section !== 'contact' && section !== 'review'; }).map(function (section) {
                  const isFocused = builder.activeSection === section;
                  const isHighlighted = review.highlightedSections.indexOf(section) >= 0;
                  const value = sectionTextValue(section, activeDraft);
                  return (
                    <section
                      key={section}
                      className="border-b py-4 last:border-b-0"
                      style={{
                        borderColor: isHighlighted ? 'var(--p-accent)' : '#e5e7eb',
                        background: isHighlighted ? 'color-mix(in srgb, var(--p-accent) 5%, white)' : 'transparent',
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{builderSectionLabel(section)}</h3>
                        {isFocused ? <span className="text-xs font-semibold text-sky-700">Active section</span> : null}
                        {!isFocused && isHighlighted ? <span className="text-xs font-semibold text-sky-700">Diagnostics target</span> : null}
                      </div>
                      <textarea
                        value={value}
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
                        className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-600"
                      />
                    </section>
                  );
                })}
              </div>

              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                <div className="flex items-start gap-3">
                  <LayoutPanelLeft className="mt-0.5 h-5 w-5" style={{ color: 'var(--p-accent)' }} aria-hidden />
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>Builder v1 shell note</h3>
                    <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
                      This is the deterministic-friendly workspace foundation for Day 75. It establishes the left rail, center canvas, right rail contract, and save/export entry points without claiming live scoring or rewrite intelligence.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard title="Right rail" subtitle="Guidance, diagnostics, and context stay separated so later engines can plug in cleanly.">
            <div className="grid grid-cols-3 gap-2">
              <RailTabButton tab="guidance" label="Guidance" activeTab={ui.rightRailTab} onSelect={setRightRailTab} />
              <RailTabButton tab="diagnostics" label="Diagnostics" activeTab={ui.rightRailTab} onSelect={setRightRailTab} />
              <RailTabButton tab="context" label="Context" activeTab={ui.rightRailTab} onSelect={setRightRailTab} />
            </div>

            <div className="mt-4 space-y-3">
              {ui.rightRailTab === 'guidance' ? (
                <div className="space-y-3">
                  <div className="rounded-xl border p-3" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                    <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
                      {diagnosticsStatusHeading(review.status)}
                    </div>
                    <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
                      {review.response !== null ? review.response.overall.summary : diagnosticsStatusMessage(review.status)}
                    </p>
                    <button
                      type="button"
                      onClick={function () {
                        void evaluateActiveResumeDiagnostics();
                      }}
                      className="mt-3 rounded-md border px-3 py-2 text-xs font-medium transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"
                      style={{ borderColor: 'var(--p-border)', color: 'var(--p-accent)' }}
                    >
                      {review.status === 'loading' ? 'Refreshing...' : 'Run diagnostics'}
                    </button>
                  </div>

                  {review.response !== null ? review.response.issues.slice(0, 2).map(function (issue) {
                    return (
                      <div key={issue.issue_id} className="rounded-xl border p-3" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                        <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>{issue.title}</div>
                        <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>{issue.why_it_matters}</p>
                        <DiagnosticsTargetRefList targetRefs={issue.target_refs} onFocus={focusDiagnosticsTargetRefs} />
                      </div>
                    );
                  }) : null}
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

                  {review.response !== null ? review.response.issues.map(function (issue) {
                    return (
                      <div key={issue.issue_id} className="rounded-xl border p-3" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                        <div className="flex items-start gap-2">
                          {issue.severity === 'high' ? <AlertCircle className="mt-0.5 h-4 w-4" style={{ color: 'var(--p-danger)' }} aria-hidden /> : issue.severity === 'medium' ? <AlertCircle className="mt-0.5 h-4 w-4" style={{ color: 'var(--p-warning)' }} aria-hidden /> : <CheckCircle2 className="mt-0.5 h-4 w-4" style={{ color: 'var(--p-success)' }} aria-hidden />}
                          <div>
                            <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>{issue.title}</div>
                            <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>{issue.detail}</p>
                          </div>
                        </div>
                        <DiagnosticsTargetRefList targetRefs={issue.target_refs} onFocus={focusDiagnosticsTargetRefs} />
                      </div>
                    );
                  }) : null}

                  {review.response !== null && review.response.issues.length === 0 ? (
                    <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}>
                      No backend issues are attached to the current diagnostics response.
                    </div>
                  ) : null}
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
                  {review.response !== null ? (
                    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>Diagnostics engine</div>
                      <div className="mt-1 text-sm" style={{ color: 'var(--p-text)' }}>
                        {review.response.meta.engine_version}
                      </div>
                      <div className="mt-1 text-xs" style={{ color: 'var(--p-text-muted)' }}>
                        Ruleset {review.response.meta.ruleset_version} · Explainability {review.response.meta.explainability_version}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  function renderReview(): React.ReactNode {
    if (activeSummary === null || activeDraft === null) {
      return renderBuilder();
    }
    const diagnosticsResponse = review.response;
    const readinessLabel =
      diagnosticsResponse !== null
        ? formatReadinessBandLabel(diagnosticsResponse.overall.readiness_band)
        : null;
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-xl border p-6 md:flex-row md:items-end md:justify-between" style={{ background: 'var(--p-surface)', borderColor: 'var(--p-border)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--p-accent)' }}>Review / Optimize</p>
            <h1 className="mt-1 text-2xl font-semibold" style={{ color: 'var(--p-text)' }}>
              Review shell for {activeSummary.name}
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--p-text-muted)' }}>
              This review surface renders backend diagnostics directly. PathOS shows transport state clearly and does not invent scores, issues, or recommendations on the client.
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

        <div className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard title="Overall readiness band" subtitle="The backend owns readiness, summary text, and all review findings.">
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'color-mix(in srgb, var(--p-accent) 8%, var(--p-surface))' }}>
              <div className="flex items-start gap-3">
                <Target className="mt-0.5 h-5 w-5" style={{ color: 'var(--p-accent)' }} aria-hidden />
                <div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--p-text)' }}>
                    {readinessLabel !== null ? readinessLabel : diagnosticsStatusHeading(review.status)}
                  </div>
                  <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>
                    {diagnosticsResponse !== null ? diagnosticsResponse.overall.summary : diagnosticsStatusMessage(review.status)}
                  </p>
                  {diagnosticsResponse !== null && diagnosticsResponse.overall.score !== null ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--p-text-dim)' }}>
                      Score {diagnosticsResponse.overall.score} / 100
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            {review.errorMessage !== null ? (
              <p className="mt-4 text-sm" style={{ color: 'var(--p-text-muted)' }}>{review.errorMessage}</p>
            ) : null}
            {diagnosticsResponse !== null && diagnosticsResponse.warnings.length > 0 ? (
              <div className="mt-4 space-y-2">
                {diagnosticsResponse.warnings.map(function (warning) {
                  return (
                    <div key={warning.code} className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}>
                      {warning.text}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </SurfaceCard>

          <SurfaceCard title="Category breakdown" subtitle="Category rows are rendered from backend scores and stay empty when the backend does not provide them.">
            <div className="space-y-3">
              {diagnosticsResponse !== null ? diagnosticsResponse.category_scores.map(function (category) {
                return (
                  <div key={category.code} className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>{category.label}</div>
                      <span className="rounded-full border px-2 py-1 text-xs font-medium" style={{ borderColor: 'var(--p-border)', color: 'var(--p-text-muted)' }}>
                        {category.score !== null ? category.score.toString() + ' / ' + category.max_score.toString() : 'No score'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm" style={{ color: 'var(--p-text-muted)' }}>{category.code}</p>
                  </div>
                );
              }) : (
                <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}>
                  {diagnosticsStatusMessage(review.status)}
                </div>
              )}
            </div>
          </SurfaceCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <SurfaceCard title="Top issues" subtitle="Issues, missing evidence, and target refs come directly from the backend response.">
            <div className="space-y-3">
              {diagnosticsResponse !== null ? diagnosticsResponse.issues.map(function (issue) {
                return (
                  <div key={issue.issue_id} className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                    <div className="flex items-start gap-3">
                      {issue.severity === 'high' ? <AlertCircle className="mt-0.5 h-5 w-5" style={{ color: 'var(--p-danger)' }} aria-hidden /> : issue.severity === 'medium' ? <AlertCircle className="mt-0.5 h-5 w-5" style={{ color: 'var(--p-warning)' }} aria-hidden /> : <CheckCircle2 className="mt-0.5 h-5 w-5" style={{ color: 'var(--p-success)' }} aria-hidden />}
                      <div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>{issue.title}</div>
                        <p className="mt-1 text-sm" style={{ color: 'var(--p-text-muted)' }}>{issue.detail}</p>
                        <p className="mt-2 text-xs" style={{ color: 'var(--p-text-dim)' }}>{issue.why_it_matters}</p>
                        <DiagnosticsTargetRefList targetRefs={issue.target_refs} onFocus={focusDiagnosticsTargetRefs} />
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}>
                  {diagnosticsStatusMessage(review.status)}
                </div>
              )}

              {diagnosticsResponse !== null && diagnosticsResponse.missing_evidence.length > 0 ? (
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                  <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>Missing evidence</div>
                  <div className="mt-3 space-y-3">
                    {diagnosticsResponse.missing_evidence.map(function (item) {
                      return (
                        <div key={item.code}>
                          <p className="text-sm" style={{ color: 'var(--p-text-muted)' }}>{item.text}</p>
                          <DiagnosticsTargetRefList targetRefs={item.target_refs ? item.target_refs : []} onFocus={focusDiagnosticsTargetRefs} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </SurfaceCard>

          <SurfaceCard title="Recommendations" subtitle="Recommendation ordering and wording are backend-owned.">
            <div className="space-y-3">
              {diagnosticsResponse !== null ? diagnosticsResponse.recommendations.map(function (item) {
                return (
                  <div key={item.code + '-' + item.priority.toString()} className="rounded-xl border p-4" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>{item.title}</div>
                      <span className="rounded-full border px-2 py-1 text-xs font-medium" style={{ borderColor: 'var(--p-border)', color: 'var(--p-accent)' }}>
                        Priority {item.priority}
                      </span>
                    </div>
                    <p className="mt-2 text-sm" style={{ color: 'var(--p-text-muted)' }}>{item.detail}</p>
                    <DiagnosticsTargetRefList targetRefs={item.target_refs} onFocus={focusDiagnosticsTargetRefs} />
                  </div>
                );
              }) : (
                <div className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--p-border)', background: 'var(--p-surface2)', color: 'var(--p-text-muted)' }}>
                  {diagnosticsStatusMessage(review.status)}
                </div>
              )}
            </div>
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
