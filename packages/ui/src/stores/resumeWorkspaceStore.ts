/**
 * ============================================================================
 * RESUME WORKSPACE STORE — Day 75 guided-flow local state foundation
 * ============================================================================
 *
 * PURPOSE:
 * This store is the local-first state backbone for the new Resume Workspace.
 * It intentionally models the whole guided flow, not just one page, so the
 * Home screen, New Resume flow, Builder shell, and Review shell all read from
 * the same deterministic client state.
 *
 * ARCHITECTURE FIT:
 * - Extends the existing core ResumeDraft model from @pathos/core.
 * - Keeps UI-only workflow state inside @pathos/ui.
 * - Persists a bounded local snapshot so the flow survives refresh without
 *   introducing backend coupling.
 *
 * TRUST-FIRST RULE:
 * Review data in this file is explicitly placeholder-oriented. The state only
 * exposes deterministic completeness-derived guidance and clear placeholder
 * messaging until a live diagnostics engine is connected.
 */

import { create } from 'zustand';
import {
  createDefaultDraft,
  storageGetJSON,
  storageSetJSON,
  type ResumeContact,
  type ResumeDraft,
} from '@pathos/core';
import {
  buildResumeDiagnosticsRequest,
  collectTargetedBuilderSections,
  type ResumeDiagnosticsEvaluateRequest,
  type ResumeDiagnosticsEvaluateResponse,
  type ResumeTargetRef,
} from '../resume-workspace/resumeDiagnostics';
import { evaluateResumeDiagnostics } from '../resume-workspace/resumeDiagnosticsClient';

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

export const RESUME_WORKSPACE_STORAGE_KEY = 'pathos-resume-workspace-v1';

// ---------------------------------------------------------------------------
// Types — route and workflow vocabulary
// ---------------------------------------------------------------------------

export type ResumeWorkspaceRouteView = 'home' | 'new' | 'builder' | 'review';
export type ResumeDocumentType = 'resume';
export type ResumeStartMethod = 'import-existing' | 'build-from-scratch' | 'from-master';
export type ResumeGoalMode = 'general-purpose' | 'tailor-to-job' | 'build-master';
export type ResumeMode = 'master' | 'tailored';
export type ResumeWorkspaceStatus = 'draft' | 'tailored' | 'needs-review' | 'ready-to-export';
export type ResumeCreationStep =
  | 'document-type'
  | 'start-method'
  | 'goal'
  | 'target-context'
  | 'confirm';
export type ResumeBuilderSection =
  | 'contact'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'review';
export type ResumeRightRailTab = 'guidance' | 'diagnostics' | 'context';
export type ResumeDialogType = 'save-master' | 'save-variant' | 'duplicate' | 'export' | null;
export type ResumeReadinessBand =
  | 'Not started'
  | 'Needs structure'
  | 'Ready for review'
  | 'Review complete';
export type ResumeDiagnosticSeverity = 'info' | 'attention' | 'ready';
export type ResumeDiagnosticsStatus =
  | 'idle'
  | 'loading'
  | 'evaluated'
  | 'insufficient_input'
  | 'unsupported_context'
  | 'error'
  | 'unavailable';

export interface ResumeTargetContext {
  targetRoleTitle: string;
  seriesGrade: string;
  agencyDomain: string;
  jobAnnouncementText: string;
  plainLanguageGoal: string;
  linkedJobId: string | null;
}

export interface ResumeDraftSummary {
  id: string;
  name: string;
  mode: ResumeMode;
  status: ResumeWorkspaceStatus;
  updatedAt: string;
  targetContext: ResumeTargetContext;
  linkedToResumeId: string | null;
}

export interface ResumeDiagnosticIssue {
  id: string;
  title: string;
  description: string;
  severity: ResumeDiagnosticSeverity;
  source: 'deterministic-completeness' | 'placeholder-review';
}

export interface ResumeRecommendation {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  targetSection: ResumeBuilderSection;
}

export interface ResumeEstimatedImpact {
  id: string;
  label: string;
  deltaLabel: string;
  description: string;
}

export interface ResumeReviewCategory {
  id: string;
  label: string;
  readinessLabel: string;
  detail: string;
}

export interface ResumeCreationFlowState {
  currentStep: ResumeCreationStep;
  documentType: ResumeDocumentType;
  startMethod: ResumeStartMethod;
  goalMode: ResumeGoalMode;
  targetContext: ResumeTargetContext;
}

export interface ResumeBuilderState {
  activeSection: ResumeBuilderSection;
  sectionCompletion: Record<ResumeBuilderSection, boolean>;
}

export interface ResumeReviewState {
  status: ResumeDiagnosticsStatus;
  request: ResumeDiagnosticsEvaluateRequest | null;
  response: ResumeDiagnosticsEvaluateResponse | null;
  errorMessage: string | null;
  lastEvaluatedResumeId: string | null;
  lastEvaluatedAt: string | null;
  highlightedSections: ResumeBuilderSection[];
}

export interface ResumePlaceholderReviewState {
  readinessBand: ResumeReadinessBand;
  readinessSummary: string;
  placeholderMessage: string;
  categories: ResumeReviewCategory[];
  issues: ResumeDiagnosticIssue[];
  recommendations: ResumeRecommendation[];
  estimatedImpact: ResumeEstimatedImpact[];
}

export interface ResumeWorkspaceUiState {
  currentView: ResumeWorkspaceRouteView;
  rightRailTab: ResumeRightRailTab;
  activeDialog: ResumeDialogType;
  toastMessage: string | null;
}

export interface ResumeWorkspaceState {
  activeResumeId: string | null;
  resumes: ResumeDraftSummary[];
  resumeDrafts: Record<string, ResumeDraft>;
  creationFlow: ResumeCreationFlowState;
  builder: ResumeBuilderState;
  review: ResumeReviewState;
  ui: ResumeWorkspaceUiState;
}

export interface ResumeWorkspaceActions {
  hydrate: () => void;
  persist: () => void;
  setCurrentView: (view: ResumeWorkspaceRouteView) => void;
  setActiveResumeId: (resumeId: string | null) => void;
  setCreationStep: (step: ResumeCreationStep) => void;
  setStartMethod: (method: ResumeStartMethod) => void;
  setGoalMode: (goal: ResumeGoalMode) => void;
  updateTargetContextField: (field: keyof ResumeTargetContext, value: string) => void;
  createResumeFromFlow: () => string;
  setActiveSection: (section: ResumeBuilderSection) => void;
  setRightRailTab: (tab: ResumeRightRailTab) => void;
  updateContactField: (field: keyof ResumeContact, value: string) => void;
  updateSummary: (value: string) => void;
  updateExperienceText: (value: string) => void;
  updateEducationText: (value: string) => void;
  updateSkillsText: (value: string) => void;
  saveAsMasterResume: () => void;
  saveAsTailoredVariant: () => string | null;
  duplicateForAnotherTarget: () => string | null;
  markExportReady: () => void;
  evaluateActiveResumeDiagnostics: () => Promise<void>;
  focusDiagnosticsTargetRefs: (targetRefs: ResumeTargetRef[]) => void;
  clearDiagnosticsHighlights: () => void;
  openDialog: (dialog: ResumeDialogType) => void;
  closeDialog: () => void;
  clearToast: () => void;
}

export type ResumeWorkspaceStore = ResumeWorkspaceState & ResumeWorkspaceActions;

// ---------------------------------------------------------------------------
// Pure helpers — deterministic seed, cloning, review placeholders
// ---------------------------------------------------------------------------

function deepCloneDraft(draft: ResumeDraft): ResumeDraft {
  return JSON.parse(JSON.stringify(draft)) as ResumeDraft;
}

function cloneTargetContext(context: ResumeTargetContext): ResumeTargetContext {
  return {
    targetRoleTitle: context.targetRoleTitle,
    seriesGrade: context.seriesGrade,
    agencyDomain: context.agencyDomain,
    jobAnnouncementText: context.jobAnnouncementText,
    plainLanguageGoal: context.plainLanguageGoal,
    linkedJobId: context.linkedJobId,
  };
}

function setTargetContextFieldValue(
  context: ResumeTargetContext,
  field: keyof ResumeTargetContext,
  value: string,
): void {
  if (field === 'targetRoleTitle') {
    context.targetRoleTitle = value;
    return;
  }
  if (field === 'seriesGrade') {
    context.seriesGrade = value;
    return;
  }
  if (field === 'agencyDomain') {
    context.agencyDomain = value;
    return;
  }
  if (field === 'jobAnnouncementText') {
    context.jobAnnouncementText = value;
    return;
  }
  if (field === 'plainLanguageGoal') {
    context.plainLanguageGoal = value;
    return;
  }
  context.linkedJobId = value.length > 0 ? value : null;
}

function createEmptyTargetContext(): ResumeTargetContext {
  return {
    targetRoleTitle: '',
    seriesGrade: '',
    agencyDomain: '',
    jobAnnouncementText: '',
    plainLanguageGoal: '',
    linkedJobId: null,
  };
}

function generateResumeId(): string {
  return 'resume-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function buildWorkspaceName(mode: ResumeMode, goal: ResumeGoalMode, targetContext: ResumeTargetContext): string {
  if (mode === 'master') {
    return 'Master Resume';
  }
  if (targetContext.targetRoleTitle.trim().length > 0) {
    return targetContext.targetRoleTitle.trim() + ' Variant';
  }
  if (goal === 'tailor-to-job') {
    return 'Tailored Resume';
  }
  return 'Resume Draft';
}

function buildSeedMasterDraft(): ResumeDraft {
  const draft = createDefaultDraft();
  draft.contact.fullName = 'Jordan Ellis';
  draft.contact.email = 'jordan.ellis@example.gov';
  draft.contact.phone = '202-555-0184';
  draft.contact.city = 'Washington';
  draft.contact.state = 'DC';
  draft.summary =
    'Program and operations specialist focused on federal service delivery, workforce coordination, and process clarity.';
  draft.experience.push({
    id: 'exp-seed-1',
    jobTitle: 'Program Analyst',
    employer: 'Department of Health and Human Services',
    location: 'Washington, DC',
    startDate: '2022',
    endDate: 'Present',
    hoursPerWeek: '40',
    grade: 'GS-12',
    duties:
      'Coordinated cross-functional program tracking for service delivery milestones.\nBuilt concise reporting artifacts for leadership review.\nSupported process updates with documented implementation notes.',
  });
  draft.education.push({
    id: 'edu-seed-1',
    institution: 'George Mason University',
    degree: 'MPA',
    field: 'Public Administration',
    graduationDate: '2021',
    gpa: '',
  });
  draft.skills.push({ id: 'skill-seed-1', name: 'Program operations' });
  draft.skills.push({ id: 'skill-seed-2', name: 'Stakeholder communication' });
  return draft;
}

function buildSeedTailoredDraft(masterDraft: ResumeDraft): ResumeDraft {
  const draft = deepCloneDraft(masterDraft);
  draft.summary =
    'Program analyst resume tailored for implementation-focused federal roles that need structured operations, stakeholder communication, and measurable delivery support.';
  if (draft.skills.length < 3) {
    draft.skills.push({ id: 'skill-seed-3', name: 'Implementation planning' });
  }
  return draft;
}

function createEmptyReviewState(): ResumeReviewState {
  return {
    status: 'idle',
    request: null,
    response: null,
    errorMessage: null,
    lastEvaluatedResumeId: null,
    lastEvaluatedAt: null,
    highlightedSections: [],
  };
}

export function deriveSectionCompletion(draft: ResumeDraft): Record<ResumeBuilderSection, boolean> {
  const contactComplete =
    draft.contact.fullName.trim().length > 0 &&
    draft.contact.email.trim().length > 0 &&
    draft.contact.phone.trim().length > 0 &&
    draft.contact.city.trim().length > 0 &&
    draft.contact.state.trim().length > 0;
  const summaryComplete = draft.summary.trim().length > 0;
  const experienceComplete = draft.experience.length > 0;
  const educationComplete = draft.education.length > 0;
  const skillsComplete = draft.skills.length > 0;
  const reviewReady =
    contactComplete &&
    summaryComplete &&
    experienceComplete &&
    educationComplete &&
    skillsComplete;

  return {
    contact: contactComplete,
    summary: summaryComplete,
    experience: experienceComplete,
    education: educationComplete,
    skills: skillsComplete,
    review: reviewReady,
  };
}

export function buildPlaceholderReviewState(draft: ResumeDraft, targetContext: ResumeTargetContext): ResumePlaceholderReviewState {
  const sectionCompletion = deriveSectionCompletion(draft);
  const issues: ResumeDiagnosticIssue[] = [];
  const recommendations: ResumeRecommendation[] = [];
  const impact: ResumeEstimatedImpact[] = [];

  if (!sectionCompletion.contact) {
    issues.push({
      id: 'issue-contact',
      title: 'Complete contact basics',
      description: 'Builder layout is ready, but the document still needs the core contact fields filled in.',
      severity: 'attention',
      source: 'deterministic-completeness',
    });
    recommendations.push({
      id: 'rec-contact',
      title: 'Finish contact section',
      description: 'Add complete contact information so the document shell reads like a real resume.',
      actionLabel: 'Open Contact',
      targetSection: 'contact',
    });
    impact.push({
      id: 'impact-contact',
      label: 'Identity clarity',
      deltaLabel: 'High',
      description: 'Completing contact details makes the document usable for review and export.',
    });
  }

  if (!sectionCompletion.summary) {
    issues.push({
      id: 'issue-summary',
      title: 'Summary still missing',
      description: 'No summary has been entered yet, so the guided flow cannot show a trustworthy top-level narrative.',
      severity: 'attention',
      source: 'deterministic-completeness',
    });
    recommendations.push({
      id: 'rec-summary',
      title: 'Draft a concise summary',
      description: 'Use the summary section to explain scope, strengths, and role focus before diagnostics get deeper later.',
      actionLabel: 'Open Summary',
      targetSection: 'summary',
    });
    impact.push({
      id: 'impact-summary',
      label: 'Narrative foundation',
      deltaLabel: 'Medium',
      description: 'A clear summary improves review readability and future targeting hooks.',
    });
  }

  if (!sectionCompletion.experience) {
    issues.push({
      id: 'issue-experience',
      title: 'Experience section needs content',
      description: 'The builder shell is live, but the resume still lacks experience detail for a meaningful review.',
      severity: 'attention',
      source: 'deterministic-completeness',
    });
    recommendations.push({
      id: 'rec-experience',
      title: 'Add core experience entries',
      description: 'Enter at least one substantive experience block so later diagnostics can map to real evidence.',
      actionLabel: 'Open Experience',
      targetSection: 'experience',
    });
    impact.push({
      id: 'impact-experience',
      label: 'Evidence surface',
      deltaLabel: 'High',
      description: 'Experience entries create the main content base for future deterministic scoring.',
    });
  }

  if (!sectionCompletion.education) {
    issues.push({
      id: 'issue-education',
      title: 'Education is still empty',
      description: 'Education is a visible section in the new builder shell and should be populated before review.',
      severity: 'info',
      source: 'deterministic-completeness',
    });
    recommendations.push({
      id: 'rec-education',
      title: 'Add education details',
      description: 'Populate education so the review surface has a complete document scaffold.',
      actionLabel: 'Open Education',
      targetSection: 'education',
    });
  }

  if (!sectionCompletion.skills) {
    issues.push({
      id: 'issue-skills',
      title: 'Skills list is missing',
      description: 'Skills are empty, so the right-rail context remains mostly structural for now.',
      severity: 'info',
      source: 'deterministic-completeness',
    });
    recommendations.push({
      id: 'rec-skills',
      title: 'Add a starter skills list',
      description: 'Even a short skills list makes the draft easier to review and future-ready for matching.',
      actionLabel: 'Open Skills',
      targetSection: 'skills',
    });
  }

  if (targetContext.targetRoleTitle.trim().length === 0 && targetContext.jobAnnouncementText.trim().length === 0) {
    issues.push({
      id: 'issue-targeting',
      title: 'Target context not added yet',
      description: 'The workflow supports targeting, but no role or announcement context has been attached yet.',
      severity: 'info',
      source: 'deterministic-completeness',
    });
    recommendations.push({
      id: 'rec-targeting',
      title: 'Add targeting context',
      description: 'Capture a role title, announcement text, or plain-language goal so later tailored diagnostics have a clean contract.',
      actionLabel: 'Open Context',
      targetSection: 'review',
    });
  }

  issues.push({
    id: 'issue-placeholder',
    title: 'Diagnostics are placeholder-bound for this pass',
    description: 'This review shell is intentionally honest: it shows layout-ready guidance until live deterministic diagnostics are wired.',
    severity: 'ready',
    source: 'placeholder-review',
  });

  if (impact.length === 0) {
    impact.push({
      id: 'impact-review',
      label: 'Review confidence',
      deltaLabel: 'Ready',
      description: 'The draft has enough structure for the review shell to support a clean next pass.',
    });
  }

  let readinessBand: ResumeReadinessBand = 'Not started';
  let readinessSummary = 'The draft is still mostly scaffold and needs core resume sections before review can mean much.';
  if (sectionCompletion.review) {
    readinessBand = 'Review complete';
    readinessSummary = 'The document structure is complete enough for a deterministic review shell and future diagnostics integration.';
  } else if (
    sectionCompletion.contact ||
    sectionCompletion.summary ||
    sectionCompletion.experience ||
    sectionCompletion.education ||
    sectionCompletion.skills
  ) {
    readinessBand = 'Needs structure';
    readinessSummary = 'The document has meaningful content, but it still needs more structure before a full review is trustworthy.';
  }
  if (
    sectionCompletion.contact &&
    sectionCompletion.summary &&
    sectionCompletion.experience &&
    !sectionCompletion.review
  ) {
    readinessBand = 'Ready for review';
    readinessSummary = 'The foundation is in place. The review shell can now guide targeted cleanup before export.';
  }

  return {
    readinessBand: readinessBand,
    readinessSummary: readinessSummary,
    placeholderMessage:
      'Frontend placeholder review only. Category cards and issues are bounded by draft completeness until live deterministic diagnostics are connected.',
    categories: [
      {
        id: 'cat-document',
        label: 'Document structure',
        readinessLabel: sectionCompletion.review ? 'Complete' : 'In progress',
        detail: 'Tracks whether the canonical builder sections are populated enough for review mode.',
      },
      {
        id: 'cat-targeting',
        label: 'Target context',
        readinessLabel:
          targetContext.targetRoleTitle.trim().length > 0 || targetContext.jobAnnouncementText.trim().length > 0
            ? 'Context added'
            : 'Context needed',
        detail: 'Keeps future master-vs-tailored and federal-aware targeting hooks visible without inventing fit claims.',
      },
      {
        id: 'cat-diagnostics',
        label: 'Diagnostics wiring',
        readinessLabel: 'Placeholder only',
        detail: 'The shell is ready, but live deterministic scoring and issue derivation are intentionally not connected in this pass.',
      },
    ],
    issues: issues,
    recommendations: recommendations,
    estimatedImpact: impact,
  };
}

function deriveStatusForSummary(
  mode: ResumeMode,
  sectionCompletion: Record<ResumeBuilderSection, boolean>,
): ResumeWorkspaceStatus {
  if (mode === 'tailored') {
    return 'tailored';
  }
  if (sectionCompletion.review) {
    return 'needs-review';
  }
  return 'draft';
}

function buildSeedState(): ResumeWorkspaceState {
  const masterId = 'resume-master-seed';
  const tailoredId = 'resume-tailored-seed';
  const masterDraft = buildSeedMasterDraft();
  const masterContext = createEmptyTargetContext();
  const masterSectionCompletion = deriveSectionCompletion(masterDraft);
  const tailoredContext: ResumeTargetContext = {
    targetRoleTitle: 'Program Analyst',
    seriesGrade: 'GS-0343 / GS-12',
    agencyDomain: 'HHS / Program Operations',
    jobAnnouncementText: 'Program analyst role focused on implementation tracking, reporting, and stakeholder coordination.',
    plainLanguageGoal: 'Tailor this draft for implementation and coordination work.',
    linkedJobId: null,
  };
  const tailoredDraft = buildSeedTailoredDraft(masterDraft);
  const tailoredSectionCompletion = deriveSectionCompletion(tailoredDraft);

  return {
    activeResumeId: masterId,
    resumes: [
      {
        id: masterId,
        name: 'Master Resume',
        mode: 'master',
        status: deriveStatusForSummary('master', masterSectionCompletion),
        updatedAt: new Date().toISOString(),
        targetContext: masterContext,
        linkedToResumeId: null,
      },
      {
        id: tailoredId,
        name: 'Program Analyst Variant',
        mode: 'tailored',
        status: deriveStatusForSummary('tailored', tailoredSectionCompletion),
        updatedAt: new Date().toISOString(),
        targetContext: tailoredContext,
        linkedToResumeId: masterId,
      },
    ],
    resumeDrafts: {
      'resume-master-seed': masterDraft,
      'resume-tailored-seed': tailoredDraft,
    },
    creationFlow: {
      currentStep: 'document-type',
      documentType: 'resume',
      startMethod: 'build-from-scratch',
      goalMode: 'general-purpose',
      targetContext: createEmptyTargetContext(),
    },
    builder: {
      activeSection: 'summary',
      sectionCompletion: deriveSectionCompletion(masterDraft),
    },
    review: createEmptyReviewState(),
    ui: {
      currentView: 'home',
      rightRailTab: 'guidance',
      activeDialog: null,
      toastMessage: null,
    },
  };
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

interface PersistedResumeWorkspaceState {
  activeResumeId: string | null;
  resumes: ResumeDraftSummary[];
  resumeDrafts: Record<string, ResumeDraft>;
  creationFlow: ResumeCreationFlowState;
  builder: ResumeBuilderState;
  review: ResumeReviewState;
  ui: ResumeWorkspaceUiState;
}

function normalizePersistedReviewState(
  review: unknown
): ResumeReviewState {
  const emptyReview = createEmptyReviewState();
  if (review === null || review === undefined || typeof review !== 'object') {
    return emptyReview;
  }
  const typedReview = review as Record<string, unknown>;
  return {
    status:
      typeof typedReview.status === 'string'
        ? typedReview.status as ResumeDiagnosticsStatus
        : emptyReview.status,
    request:
      typedReview.request !== undefined
        ? typedReview.request as ResumeDiagnosticsEvaluateRequest | null
        : emptyReview.request,
    response:
      typedReview.response !== undefined
        ? typedReview.response as ResumeDiagnosticsEvaluateResponse | null
        : emptyReview.response,
    errorMessage:
      typeof typedReview.errorMessage === 'string'
        ? typedReview.errorMessage
        : emptyReview.errorMessage,
    lastEvaluatedResumeId:
      typeof typedReview.lastEvaluatedResumeId === 'string'
        ? typedReview.lastEvaluatedResumeId
        : emptyReview.lastEvaluatedResumeId,
    lastEvaluatedAt:
      typeof typedReview.lastEvaluatedAt === 'string'
        ? typedReview.lastEvaluatedAt
        : emptyReview.lastEvaluatedAt,
    highlightedSections:
      Array.isArray(typedReview.highlightedSections)
        ? typedReview.highlightedSections as ResumeBuilderSection[]
        : emptyReview.highlightedSections,
  };
}

function stateToPersist(state: ResumeWorkspaceState): PersistedResumeWorkspaceState {
  return {
    activeResumeId: state.activeResumeId,
    resumes: state.resumes,
    resumeDrafts: state.resumeDrafts,
    creationFlow: state.creationFlow,
    builder: state.builder,
    review: state.review,
    ui: state.ui,
  };
}

function loadPersistedState(): ResumeWorkspaceState {
  const raw = storageGetJSON<Record<string, unknown>>(RESUME_WORKSPACE_STORAGE_KEY, {});
  if (
    !raw ||
    !Array.isArray(raw.resumes) ||
    typeof raw.creationFlow !== 'object' ||
    typeof raw.builder !== 'object' ||
    typeof raw.review !== 'object' ||
    typeof raw.ui !== 'object'
  ) {
    return buildSeedState();
  }
  const typedRaw = raw as unknown as PersistedResumeWorkspaceState;
  return {
    activeResumeId: typedRaw.activeResumeId,
    resumes: typedRaw.resumes,
    resumeDrafts: typedRaw.resumeDrafts,
    creationFlow: typedRaw.creationFlow,
    builder: typedRaw.builder,
    review: normalizePersistedReviewState(typedRaw.review),
    ui: typedRaw.ui,
  };
}

function updateResumeSummary(
  resumes: ResumeDraftSummary[],
  resumeId: string,
  updater: (summary: ResumeDraftSummary) => ResumeDraftSummary,
): ResumeDraftSummary[] {
  const next: ResumeDraftSummary[] = [];
  for (let i = 0; i < resumes.length; i++) {
    const current = resumes[i];
    if (current.id === resumeId) {
      next.push(updater(current));
    } else {
      next.push(current);
    }
  }
  return next;
}

function getActiveDraft(state: ResumeWorkspaceState): ResumeDraft {
  if (state.activeResumeId === null) {
    return createDefaultDraft();
  }
  const draft = state.resumeDrafts[state.activeResumeId];
  if (draft) {
    return draft;
  }
  return createDefaultDraft();
}

function getActiveSummary(state: ResumeWorkspaceState): ResumeDraftSummary | null {
  if (state.activeResumeId === null) {
    return null;
  }
  for (let i = 0; i < state.resumes.length; i++) {
    if (state.resumes[i].id === state.activeResumeId) {
      return state.resumes[i];
    }
  }
  return null;
}

function refreshDerivedState(state: ResumeWorkspaceState): Partial<ResumeWorkspaceState> {
  const activeDraft = getActiveDraft(state);
  const activeSummary = getActiveSummary(state);
  const sectionCompletion = deriveSectionCompletion(activeDraft);
  let nextResumes = state.resumes;
  if (activeSummary !== null) {
    nextResumes = updateResumeSummary(state.resumes, activeSummary.id, function (summary) {
      return Object.assign({}, summary, {
        updatedAt: new Date().toISOString(),
        status: deriveStatusForSummary(summary.mode, sectionCompletion),
      });
    });
  }
  return {
    resumes: nextResumes,
    builder: {
      activeSection: state.builder.activeSection,
      sectionCompletion: sectionCompletion,
    },
    review: createEmptyReviewState(),
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState = loadPersistedState();

export const useResumeWorkspaceStore = create<ResumeWorkspaceStore>(function (set, get) {
  return {
    activeResumeId: initialState.activeResumeId,
    resumes: initialState.resumes,
    resumeDrafts: initialState.resumeDrafts,
    creationFlow: initialState.creationFlow,
    builder: initialState.builder,
    review: initialState.review,
    ui: initialState.ui,

    hydrate: function () {
      const persisted = loadPersistedState();
      set({
        activeResumeId: persisted.activeResumeId,
        resumes: persisted.resumes,
        resumeDrafts: persisted.resumeDrafts,
        creationFlow: persisted.creationFlow,
        builder: persisted.builder,
        review: persisted.review,
        ui: persisted.ui,
      });
    },

    persist: function () {
      storageSetJSON(RESUME_WORKSPACE_STORAGE_KEY, stateToPersist(get()));
    },

    setCurrentView: function (view) {
      set({
        ui: Object.assign({}, get().ui, { currentView: view }),
      });
      get().persist();
    },

    setActiveResumeId: function (resumeId) {
      const state = get();
      const nextState: ResumeWorkspaceState = Object.assign({}, state, {
        activeResumeId: resumeId,
      });
      const derived = refreshDerivedState(nextState);
      set(
        Object.assign({}, derived, {
          activeResumeId: resumeId,
          ui: Object.assign({}, state.ui, { toastMessage: null }),
        })
      );
      get().persist();
    },

    setCreationStep: function (step) {
      set({
        creationFlow: Object.assign({}, get().creationFlow, { currentStep: step }),
      });
      get().persist();
    },

    setStartMethod: function (method) {
      set({
        creationFlow: Object.assign({}, get().creationFlow, {
          startMethod: method,
        }),
      });
      get().persist();
    },

    setGoalMode: function (goal) {
      set({
        creationFlow: Object.assign({}, get().creationFlow, {
          goalMode: goal,
        }),
      });
      get().persist();
    },

    updateTargetContextField: function (field, value) {
      const state = get();
      const nextContext = cloneTargetContext(state.creationFlow.targetContext);
      setTargetContextFieldValue(nextContext, field, value);
      set({
        creationFlow: Object.assign({}, state.creationFlow, {
          targetContext: nextContext,
        }),
      });
      get().persist();
    },

    createResumeFromFlow: function () {
      const state = get();
      const resumeId = generateResumeId();
      const mode: ResumeMode =
        state.creationFlow.goalMode === 'build-master' ? 'master' : 'tailored';
      const baseDraft =
        state.creationFlow.startMethod === 'from-master'
          ? deepCloneDraft(buildSeedMasterDraft())
          : createDefaultDraft();
      const sectionCompletion = deriveSectionCompletion(baseDraft);
      const summary: ResumeDraftSummary = {
        id: resumeId,
        name: buildWorkspaceName(mode, state.creationFlow.goalMode, state.creationFlow.targetContext),
        mode: mode,
        status: deriveStatusForSummary(mode, sectionCompletion),
        updatedAt: new Date().toISOString(),
        targetContext: cloneTargetContext(state.creationFlow.targetContext),
        linkedToResumeId: mode === 'tailored' ? 'resume-master-seed' : null,
      };
      const nextResumes: ResumeDraftSummary[] = [];
      for (let i = 0; i < state.resumes.length; i++) {
        nextResumes.push(state.resumes[i]);
      }
      nextResumes.unshift(summary);

      const nextDrafts: Record<string, ResumeDraft> = Object.assign({}, state.resumeDrafts);
      nextDrafts[resumeId] = baseDraft;

      set({
        activeResumeId: resumeId,
        resumes: nextResumes,
        resumeDrafts: nextDrafts,
        creationFlow: {
          currentStep: 'document-type',
          documentType: 'resume',
          startMethod: 'build-from-scratch',
          goalMode: 'general-purpose',
          targetContext: createEmptyTargetContext(),
        },
        builder: {
          activeSection: 'contact',
          sectionCompletion: sectionCompletion,
        },
        review: createEmptyReviewState(),
        ui: Object.assign({}, state.ui, {
          currentView: 'builder',
          toastMessage: 'Resume workspace created.',
        }),
      });
      get().persist();
      return resumeId;
    },

    setActiveSection: function (section) {
      set({
        builder: Object.assign({}, get().builder, { activeSection: section }),
      });
      get().persist();
    },

    setRightRailTab: function (tab) {
      set({
        ui: Object.assign({}, get().ui, { rightRailTab: tab }),
      });
      get().persist();
    },

    updateContactField: function (field, value) {
      const state = get();
      if (state.activeResumeId === null) {
        return;
      }
      const draft = deepCloneDraft(getActiveDraft(state));
      draft.contact[field] = value;
      const nextDrafts = Object.assign({}, state.resumeDrafts);
      nextDrafts[state.activeResumeId] = draft;
      const nextState = Object.assign({}, state, { resumeDrafts: nextDrafts });
      const derived = refreshDerivedState(nextState);
      set(Object.assign({}, derived, { resumeDrafts: nextDrafts }));
      get().persist();
    },

    updateSummary: function (value) {
      const state = get();
      if (state.activeResumeId === null) {
        return;
      }
      const draft = deepCloneDraft(getActiveDraft(state));
      draft.summary = value;
      const nextDrafts = Object.assign({}, state.resumeDrafts);
      nextDrafts[state.activeResumeId] = draft;
      const nextState = Object.assign({}, state, { resumeDrafts: nextDrafts });
      const derived = refreshDerivedState(nextState);
      set(Object.assign({}, derived, { resumeDrafts: nextDrafts }));
      get().persist();
    },

    updateExperienceText: function (value) {
      const state = get();
      if (state.activeResumeId === null) {
        return;
      }
      const draft = deepCloneDraft(getActiveDraft(state));
      if (draft.experience.length === 0) {
        draft.experience.push({
          id: 'exp-' + Date.now().toString(36),
          jobTitle: 'Experience Entry',
          employer: 'Organization',
          location: '',
          startDate: '',
          endDate: '',
          hoursPerWeek: '',
          grade: '',
          duties: value,
        });
      } else {
        draft.experience[0].duties = value;
      }
      const nextDrafts = Object.assign({}, state.resumeDrafts);
      nextDrafts[state.activeResumeId] = draft;
      const nextState = Object.assign({}, state, { resumeDrafts: nextDrafts });
      const derived = refreshDerivedState(nextState);
      set(Object.assign({}, derived, { resumeDrafts: nextDrafts }));
      get().persist();
    },

    updateEducationText: function (value) {
      const state = get();
      if (state.activeResumeId === null) {
        return;
      }
      const draft = deepCloneDraft(getActiveDraft(state));
      if (draft.education.length === 0) {
        draft.education.push({
          id: 'edu-' + Date.now().toString(36),
          institution: value,
          degree: '',
          field: '',
          graduationDate: '',
          gpa: '',
        });
      } else {
        draft.education[0].institution = value;
      }
      const nextDrafts = Object.assign({}, state.resumeDrafts);
      nextDrafts[state.activeResumeId] = draft;
      const nextState = Object.assign({}, state, { resumeDrafts: nextDrafts });
      const derived = refreshDerivedState(nextState);
      set(Object.assign({}, derived, { resumeDrafts: nextDrafts }));
      get().persist();
    },

    updateSkillsText: function (value) {
      const state = get();
      if (state.activeResumeId === null) {
        return;
      }
      const draft = deepCloneDraft(getActiveDraft(state));
      const parts = value
        .split(',')
        .map(function (item) {
          return item.trim();
        })
        .filter(function (item) {
          return item.length > 0;
        });
      draft.skills = [];
      for (let i = 0; i < parts.length; i++) {
        draft.skills.push({
          id: 'skill-' + i.toString(),
          name: parts[i],
        });
      }
      const nextDrafts = Object.assign({}, state.resumeDrafts);
      nextDrafts[state.activeResumeId] = draft;
      const nextState = Object.assign({}, state, { resumeDrafts: nextDrafts });
      const derived = refreshDerivedState(nextState);
      set(Object.assign({}, derived, { resumeDrafts: nextDrafts }));
      get().persist();
    },

    saveAsMasterResume: function () {
      const state = get();
      if (state.activeResumeId === null) {
        return;
      }
      const nextResumes = updateResumeSummary(state.resumes, state.activeResumeId, function (summary) {
        return Object.assign({}, summary, {
          mode: 'master' as ResumeMode,
          name: 'Master Resume',
          linkedToResumeId: null,
        });
      });
      const nextState = Object.assign({}, state, { resumes: nextResumes });
      const derived = refreshDerivedState(nextState);
      set(
        Object.assign({}, derived, {
          resumes: nextResumes,
          ui: Object.assign({}, state.ui, {
            activeDialog: null,
            toastMessage: 'Saved as master resume.',
          }),
        })
      );
      get().persist();
    },

    saveAsTailoredVariant: function () {
      const state = get();
      if (state.activeResumeId === null) {
        return null;
      }
      const currentSummary = getActiveSummary(state);
      if (currentSummary === null) {
        return null;
      }
      const resumeId = generateResumeId();
      const nextDrafts = Object.assign({}, state.resumeDrafts);
      nextDrafts[resumeId] = deepCloneDraft(getActiveDraft(state));
      const nextContext = cloneTargetContext(currentSummary.targetContext);
      const nextSectionCompletion = deriveSectionCompletion(nextDrafts[resumeId]);
      const nextResumes: ResumeDraftSummary[] = [];
      nextResumes.push({
        id: resumeId,
        name: buildWorkspaceName('tailored', 'tailor-to-job', nextContext),
        mode: 'tailored',
        status: deriveStatusForSummary('tailored', nextSectionCompletion),
        updatedAt: new Date().toISOString(),
        targetContext: nextContext,
        linkedToResumeId: currentSummary.mode === 'master' ? currentSummary.id : currentSummary.linkedToResumeId,
      });
      for (let i = 0; i < state.resumes.length; i++) {
        nextResumes.push(state.resumes[i]);
      }
      set({
        activeResumeId: resumeId,
        resumes: nextResumes,
        resumeDrafts: nextDrafts,
        builder: {
          activeSection: state.builder.activeSection,
          sectionCompletion: nextSectionCompletion,
        },
        review: createEmptyReviewState(),
        ui: Object.assign({}, state.ui, {
          activeDialog: null,
          toastMessage: 'Tailored variant created.',
        }),
      });
      get().persist();
      return resumeId;
    },

    duplicateForAnotherTarget: function () {
      const state = get();
      if (state.activeResumeId === null) {
        return null;
      }
      const currentSummary = getActiveSummary(state);
      if (currentSummary === null) {
        return null;
      }
      const duplicateId = generateResumeId();
      const duplicateDraft = deepCloneDraft(getActiveDraft(state));
      const duplicateContext = cloneTargetContext(currentSummary.targetContext);
      duplicateContext.targetRoleTitle = '';
      duplicateContext.jobAnnouncementText = '';
      duplicateContext.plainLanguageGoal = '';
      duplicateContext.linkedJobId = null;
      const nextDrafts = Object.assign({}, state.resumeDrafts);
      nextDrafts[duplicateId] = duplicateDraft;
      const duplicateSectionCompletion = deriveSectionCompletion(duplicateDraft);
      const duplicateSummary: ResumeDraftSummary = {
        id: duplicateId,
        name: currentSummary.name + ' Copy',
        mode: currentSummary.mode,
        status: deriveStatusForSummary(currentSummary.mode, duplicateSectionCompletion),
        updatedAt: new Date().toISOString(),
        targetContext: duplicateContext,
        linkedToResumeId: currentSummary.linkedToResumeId,
      };
      const nextResumes: ResumeDraftSummary[] = [];
      nextResumes.push(duplicateSummary);
      for (let i = 0; i < state.resumes.length; i++) {
        nextResumes.push(state.resumes[i]);
      }
      set({
        activeResumeId: duplicateId,
        resumes: nextResumes,
        resumeDrafts: nextDrafts,
        builder: {
          activeSection: state.builder.activeSection,
          sectionCompletion: duplicateSectionCompletion,
        },
        review: createEmptyReviewState(),
        ui: Object.assign({}, state.ui, {
          activeDialog: null,
          toastMessage: 'Duplicate created for a new target.',
        }),
      });
      get().persist();
      return duplicateId;
    },

    markExportReady: function () {
      const state = get();
      if (state.activeResumeId === null) {
        return;
      }
      const nextResumes = updateResumeSummary(state.resumes, state.activeResumeId, function (summary) {
        return Object.assign({}, summary, {
          status: 'ready-to-export' as ResumeWorkspaceStatus,
          updatedAt: new Date().toISOString(),
        });
      });
      set({
        resumes: nextResumes,
        ui: Object.assign({}, state.ui, {
          activeDialog: null,
          toastMessage: 'Export entry point recorded. Live export hardening is still out of scope.',
        }),
      });
      get().persist();
    },

    evaluateActiveResumeDiagnostics: async function () {
      const state = get();
      const summary = getActiveSummary(state);
      if (summary === null) {
        set({
          review: Object.assign({}, createEmptyReviewState(), {
            status: 'error' as ResumeDiagnosticsStatus,
            errorMessage: 'Select a resume before running diagnostics.',
          }),
        });
        get().persist();
        return;
      }

      const request = buildResumeDiagnosticsRequest(summary, getActiveDraft(state));
      set({
        review: Object.assign({}, createEmptyReviewState(), {
          status: 'loading' as ResumeDiagnosticsStatus,
          request: request,
          lastEvaluatedResumeId: summary.id,
        }),
      });
      get().persist();

      const result = await evaluateResumeDiagnostics(request);
      if (!result.ok || result.response === null) {
        set({
          review: Object.assign({}, createEmptyReviewState(), {
            status: result.unavailable ? 'unavailable' as ResumeDiagnosticsStatus : 'error' as ResumeDiagnosticsStatus,
            request: request,
            errorMessage: result.errorMessage,
            lastEvaluatedResumeId: summary.id,
            lastEvaluatedAt: new Date().toISOString(),
          }),
        });
        get().persist();
        return;
      }

      set({
        review: Object.assign({}, createEmptyReviewState(), {
          status: result.response.response_state,
          request: request,
          response: result.response,
          lastEvaluatedResumeId: summary.id,
          lastEvaluatedAt: new Date().toISOString(),
        }),
      });
      get().persist();
    },

    focusDiagnosticsTargetRefs: function (targetRefs) {
      const targetedSections = collectTargetedBuilderSections(targetRefs);
      const nextActiveSection =
        targetedSections.length > 0 ? targetedSections[0] : 'review';
      set({
        builder: Object.assign({}, get().builder, {
          activeSection: nextActiveSection,
        }),
        review: Object.assign({}, get().review, {
          highlightedSections: targetedSections,
        }),
      });
      get().persist();
    },

    clearDiagnosticsHighlights: function () {
      set({
        review: Object.assign({}, get().review, {
          highlightedSections: [],
        }),
      });
      get().persist();
    },

    openDialog: function (dialog) {
      set({
        ui: Object.assign({}, get().ui, { activeDialog: dialog }),
      });
      get().persist();
    },

    closeDialog: function () {
      set({
        ui: Object.assign({}, get().ui, { activeDialog: null }),
      });
      get().persist();
    },

    clearToast: function () {
      set({
        ui: Object.assign({}, get().ui, { toastMessage: null }),
      });
      get().persist();
    },
  };
});
