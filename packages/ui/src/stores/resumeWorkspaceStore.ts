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
import {
  applyResumeRewriteCandidateToDraft,
  createEmptyResumeRewriteState,
  type ResumeRewriteRequest,
  type ResumeRewriteState,
} from '../resume-workspace/resumeRewrite';
import { requestResumeRewriteCandidates } from '../resume-workspace/resumeRewriteClient';

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

/**
 * BUILDER VIEW MODE — controls the primary workspace composition.
 *
 * 'canvas'          — Default. Document is central and dominant. Right rail is
 *                     hidden. Guidance cues are subtle (badges, indicators).
 * 'focus_guidance'  — Right rail is open showing section-specific guidance and
 *                     rewrite actions for the active section.
 * 'diagnostics'     — Right rail is open showing backend diagnostics snapshot
 *                     and status for the current draft.
 * 'review'          — Not used directly here; the review route view is separate.
 *                     This mode is reserved for future inline review activation.
 */
export type ResumeBuilderViewMode = 'canvas' | 'focus_guidance' | 'diagnostics' | 'review';

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

/**
 * Resume variants are the durable unit the workspace operates on. The store
 * still keeps the legacy `id` field for existing callers, but Day 81 makes the
 * variant identity, revision identity, and latest saved diagnostics snapshot
 * explicit so later comparison/history work has stable anchors.
 */
export interface ResumeVariantSummary {
  id: string;
  variantId: string;
  name: string;
  mode: ResumeMode;
  status: ResumeWorkspaceStatus;
  updatedAt: string;
  targetContext: ResumeTargetContext;
  linkedToResumeId: string | null;
  sourceVariantId: string | null;
  currentRevisionId: string;
  latestSnapshotId: string | null;
}

export type ResumeDraftSummary = ResumeVariantSummary;

export interface ResumeSnapshotMeta {
  engineVersion: string;
  rulesetVersion: string;
  explainabilityVersion: string;
  knowledgePackVersion: string | null;
}

export interface ResumeDiagnosticsSnapshot {
  snapshotId: string;
  variantId: string;
  revisionId: string | null;
  diagnosticsId: string;
  inputHash: string;
  responseState: ResumeDiagnosticsEvaluateResponse['response_state'];
  readinessBand: ResumeDiagnosticsEvaluateResponse['overall']['readiness_band'];
  overallSummary: string;
  response: ResumeDiagnosticsEvaluateResponse;
  evaluatedAt: string;
  meta: ResumeSnapshotMeta;
}

/**
 * Day 83 adds the smallest safe prerequisite for real revision diffing:
 * persisted content snapshots keyed by actual revision id. This keeps content
 * history grounded in saved resume-body state instead of trying to infer body
 * changes from diagnostics snapshots.
 */
export interface ResumeRevisionContentSnapshot {
  revisionId: string;
  variantId: string;
  savedAt: string;
  draft: ResumeDraft;
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
  selectedSnapshotId: string | null;
  compareSnapshotId: string | null;
  isCompareMode: boolean;
}

/**
 * Day 85d keeps rewrite assistance state explicit and builder-native. The
 * store persists the resume workspace, but rewrite candidate state is still
 * intentionally transient so stale candidate text does not silently survive
 * unrelated edits.
 */
export type ResumeRewriteReviewState = ResumeRewriteState;

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
  /**
   * Controls the builder workspace composition mode. 'canvas' keeps the
   * document dominant with the right rail hidden. Other modes open the right
   * rail with the corresponding content. Defaults to 'canvas' so the user
   * sees the resume first.
   */
  builderViewMode: ResumeBuilderViewMode;
  activeDialog: ResumeDialogType;
  toastMessage: string | null;
}

export interface ResumeWorkspaceState {
  activeResumeId: string | null;
  resumes: ResumeDraftSummary[];
  resumeDrafts: Record<string, ResumeDraft>;
  diagnosticsSnapshots: Record<string, ResumeDiagnosticsSnapshot>;
  diagnosticsSnapshotIdsByVariant: Record<string, string[]>;
  revisionContentSnapshots: Record<string, ResumeRevisionContentSnapshot>;
  revisionContentIdsByVariant: Record<string, string[]>;
  creationFlow: ResumeCreationFlowState;
  builder: ResumeBuilderState;
  review: ResumeReviewState;
  rewrite: ResumeRewriteReviewState;
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
  setBuilderViewMode: (mode: ResumeBuilderViewMode) => void;
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
  selectReviewSnapshot: (snapshotId: string | null) => void;
  setCompareSnapshotId: (snapshotId: string | null) => void;
  setCompareMode: (isCompareMode: boolean) => void;
  clearSnapshotCompare: () => void;
  requestResumeRewrite: (request: ResumeRewriteRequest) => Promise<void>;
  dismissResumeRewrite: () => void;
  applyResumeRewriteCandidate: (candidateId: string) => void;
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

function generateRevisionId(): string {
  return 'revision-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function generateSnapshotId(): string {
  return 'snapshot-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
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
    selectedSnapshotId: null,
    compareSnapshotId: null,
    isCompareMode: false,
  };
}

function createEmptyRewriteReviewState(): ResumeRewriteReviewState {
  return createEmptyResumeRewriteState();
}

function buildSnapshotMetaFromResponse(
  response: ResumeDiagnosticsEvaluateResponse
): ResumeSnapshotMeta {
  return {
    engineVersion: response.meta.engine_version,
    rulesetVersion: response.meta.ruleset_version,
    explainabilityVersion: response.meta.explainability_version,
    knowledgePackVersion:
      typeof response.meta.knowledge_pack_version === 'string'
        ? response.meta.knowledge_pack_version
        : null,
  };
}

export function buildResumeDiagnosticsSnapshot(
  variantId: string,
  revisionId: string | null,
  response: ResumeDiagnosticsEvaluateResponse,
  evaluatedAt: string
): ResumeDiagnosticsSnapshot {
  return {
    snapshotId: generateSnapshotId(),
    variantId: variantId,
    revisionId:
      typeof response.revision_id === 'string' && response.revision_id.trim().length > 0
        ? response.revision_id
        : revisionId,
    diagnosticsId: response.diagnostics_id,
    inputHash: response.meta.input_hash,
    responseState: response.response_state,
    readinessBand: response.overall.readiness_band,
    overallSummary: response.overall.summary,
    response: response,
    evaluatedAt: evaluatedAt,
    meta: buildSnapshotMetaFromResponse(response),
  };
}

export function getLatestDiagnosticsSnapshotForVariant(
  snapshots: Record<string, ResumeDiagnosticsSnapshot>,
  variant: ResumeDraftSummary | null
): ResumeDiagnosticsSnapshot | null {
  if (variant === null || variant.latestSnapshotId === null) {
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(snapshots, variant.latestSnapshotId)) {
    return snapshots[variant.latestSnapshotId];
  }
  return null;
}

/**
 * Day 82 history and compare UX needs a stable way to fetch the full saved
 * snapshot list for one variant without re-deriving ids in every component.
 * The store already persists the canonical ordering with newest first, so this
 * helper simply resolves ids into snapshot objects and ignores stale ids.
 */
export function getDiagnosticsSnapshotsForVariant(
  snapshots: Record<string, ResumeDiagnosticsSnapshot>,
  snapshotIdsByVariant: Record<string, string[]>,
  variantId: string | null
): ResumeDiagnosticsSnapshot[] {
  if (variantId === null || !Object.prototype.hasOwnProperty.call(snapshotIdsByVariant, variantId)) {
    return [];
  }
  const ids = snapshotIdsByVariant[variantId];
  const resolved: ResumeDiagnosticsSnapshot[] = [];
  for (let i = 0; i < ids.length; i++) {
    const snapshotId = ids[i];
    if (Object.prototype.hasOwnProperty.call(snapshots, snapshotId)) {
      resolved.push(snapshots[snapshotId]);
    }
  }
  return resolved;
}

export function getDiagnosticsSnapshotById(
  snapshots: Record<string, ResumeDiagnosticsSnapshot>,
  snapshotId: string | null
): ResumeDiagnosticsSnapshot | null {
  if (snapshotId === null || !Object.prototype.hasOwnProperty.call(snapshots, snapshotId)) {
    return null;
  }
  return snapshots[snapshotId];
}

export function buildResumeRevisionContentSnapshot(
  variantId: string,
  revisionId: string,
  draft: ResumeDraft,
  savedAt: string
): ResumeRevisionContentSnapshot {
  return {
    revisionId: revisionId,
    variantId: variantId,
    savedAt: savedAt,
    draft: deepCloneDraft(draft),
  };
}

export function getRevisionContentSnapshotById(
  snapshots: Record<string, ResumeRevisionContentSnapshot>,
  revisionId: string | null
): ResumeRevisionContentSnapshot | null {
  if (revisionId === null || !Object.prototype.hasOwnProperty.call(snapshots, revisionId)) {
    return null;
  }
  return snapshots[revisionId];
}

export function getRevisionContentSnapshotsForVariant(
  snapshots: Record<string, ResumeRevisionContentSnapshot>,
  revisionIdsByVariant: Record<string, string[]>,
  variantId: string | null
): ResumeRevisionContentSnapshot[] {
  if (variantId === null || !Object.prototype.hasOwnProperty.call(revisionIdsByVariant, variantId)) {
    return [];
  }
  const revisionIds = revisionIdsByVariant[variantId];
  const resolved: ResumeRevisionContentSnapshot[] = [];
  for (let i = 0; i < revisionIds.length; i++) {
    const revisionId = revisionIds[i];
    if (Object.prototype.hasOwnProperty.call(snapshots, revisionId)) {
      resolved.push(snapshots[revisionId]);
    }
  }
  return resolved;
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
  const masterRevisionId = generateRevisionId();
  const tailoredRevisionId = generateRevisionId();
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
        variantId: masterId,
        name: 'Master Resume',
        mode: 'master',
        status: deriveStatusForSummary('master', masterSectionCompletion),
        updatedAt: new Date().toISOString(),
        targetContext: masterContext,
        linkedToResumeId: null,
        sourceVariantId: null,
        currentRevisionId: masterRevisionId,
        latestSnapshotId: null,
      },
      {
        id: tailoredId,
        variantId: tailoredId,
        name: 'Program Analyst Variant',
        mode: 'tailored',
        status: deriveStatusForSummary('tailored', tailoredSectionCompletion),
        updatedAt: new Date().toISOString(),
        targetContext: tailoredContext,
        linkedToResumeId: masterId,
        sourceVariantId: masterId,
        currentRevisionId: tailoredRevisionId,
        latestSnapshotId: null,
      },
    ],
    resumeDrafts: {
      'resume-master-seed': masterDraft,
      'resume-tailored-seed': tailoredDraft,
    },
    diagnosticsSnapshots: {},
    diagnosticsSnapshotIdsByVariant: {},
    revisionContentSnapshots: {
      [masterRevisionId]: buildResumeRevisionContentSnapshot(
        masterId,
        masterRevisionId,
        masterDraft,
        new Date().toISOString()
      ),
      [tailoredRevisionId]: buildResumeRevisionContentSnapshot(
        tailoredId,
        tailoredRevisionId,
        tailoredDraft,
        new Date().toISOString()
      ),
    },
    revisionContentIdsByVariant: {
      [masterId]: [masterRevisionId],
      [tailoredId]: [tailoredRevisionId],
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
    rewrite: createEmptyRewriteReviewState(),
    ui: {
      currentView: 'home',
      rightRailTab: 'guidance',
      builderViewMode: 'canvas',
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
  diagnosticsSnapshots: Record<string, ResumeDiagnosticsSnapshot>;
  diagnosticsSnapshotIdsByVariant: Record<string, string[]>;
  revisionContentSnapshots: Record<string, ResumeRevisionContentSnapshot>;
  revisionContentIdsByVariant: Record<string, string[]>;
  creationFlow: ResumeCreationFlowState;
  builder: ResumeBuilderState;
  review: ResumeReviewState;
  ui: ResumeWorkspaceUiState;
}

function normalizePersistedResumeSummary(
  summary: unknown
): ResumeDraftSummary | null {
  if (summary === null || summary === undefined || typeof summary !== 'object') {
    return null;
  }
  const typedSummary = summary as Record<string, unknown>;
  if (
    typeof typedSummary.id !== 'string' ||
    typeof typedSummary.name !== 'string' ||
    typeof typedSummary.mode !== 'string' ||
    typeof typedSummary.status !== 'string' ||
    typeof typedSummary.updatedAt !== 'string' ||
    typeof typedSummary.targetContext !== 'object' ||
    typedSummary.targetContext === null
  ) {
    return null;
  }
  const typedContext = typedSummary.targetContext as ResumeTargetContext;
  return {
    id: typedSummary.id,
    variantId:
      typeof typedSummary.variantId === 'string'
        ? typedSummary.variantId
        : typedSummary.id,
    name: typedSummary.name,
    mode: typedSummary.mode as ResumeMode,
    status: typedSummary.status as ResumeWorkspaceStatus,
    updatedAt: typedSummary.updatedAt,
    targetContext: typedContext,
    linkedToResumeId:
      typeof typedSummary.linkedToResumeId === 'string'
        ? typedSummary.linkedToResumeId
        : null,
    sourceVariantId:
      typeof typedSummary.sourceVariantId === 'string'
        ? typedSummary.sourceVariantId
        : (
            typeof typedSummary.linkedToResumeId === 'string'
              ? typedSummary.linkedToResumeId
              : null
          ),
    currentRevisionId:
      typeof typedSummary.currentRevisionId === 'string'
        ? typedSummary.currentRevisionId
        : generateRevisionId(),
    latestSnapshotId:
      typeof typedSummary.latestSnapshotId === 'string'
        ? typedSummary.latestSnapshotId
        : null,
  };
}

function normalizePersistedSnapshot(
  snapshot: unknown
): ResumeDiagnosticsSnapshot | null {
  if (snapshot === null || snapshot === undefined || typeof snapshot !== 'object') {
    return null;
  }
  const typedSnapshot = snapshot as Record<string, unknown>;
  if (
    typeof typedSnapshot.snapshotId !== 'string' ||
    typeof typedSnapshot.variantId !== 'string' ||
    typeof typedSnapshot.diagnosticsId !== 'string' ||
    typeof typedSnapshot.inputHash !== 'string' ||
    typeof typedSnapshot.responseState !== 'string' ||
    typeof typedSnapshot.readinessBand !== 'string' ||
    typeof typedSnapshot.overallSummary !== 'string' ||
    typeof typedSnapshot.evaluatedAt !== 'string' ||
    typeof typedSnapshot.response !== 'object' ||
    typedSnapshot.response === null ||
    typeof typedSnapshot.meta !== 'object' ||
    typedSnapshot.meta === null
  ) {
    return null;
  }
  const typedMeta = typedSnapshot.meta as Record<string, unknown>;
  return {
    snapshotId: typedSnapshot.snapshotId,
    variantId: typedSnapshot.variantId,
    revisionId:
      typeof typedSnapshot.revisionId === 'string'
        ? typedSnapshot.revisionId
        : null,
    diagnosticsId: typedSnapshot.diagnosticsId,
    inputHash: typedSnapshot.inputHash,
    responseState:
      typedSnapshot.responseState as ResumeDiagnosticsEvaluateResponse['response_state'],
    readinessBand:
      typedSnapshot.readinessBand as ResumeDiagnosticsEvaluateResponse['overall']['readiness_band'],
    overallSummary: typedSnapshot.overallSummary,
    response: typedSnapshot.response as ResumeDiagnosticsEvaluateResponse,
    evaluatedAt: typedSnapshot.evaluatedAt,
    meta: {
      engineVersion:
        typeof typedMeta.engineVersion === 'string'
          ? typedMeta.engineVersion
          : '',
      rulesetVersion:
        typeof typedMeta.rulesetVersion === 'string'
          ? typedMeta.rulesetVersion
          : '',
      explainabilityVersion:
        typeof typedMeta.explainabilityVersion === 'string'
          ? typedMeta.explainabilityVersion
          : '',
      knowledgePackVersion:
        typeof typedMeta.knowledgePackVersion === 'string'
          ? typedMeta.knowledgePackVersion
          : null,
    },
  };
}

function normalizePersistedRevisionContentSnapshot(
  snapshot: unknown
): ResumeRevisionContentSnapshot | null {
  if (snapshot === null || snapshot === undefined || typeof snapshot !== 'object') {
    return null;
  }
  const typedSnapshot = snapshot as Record<string, unknown>;
  if (
    typeof typedSnapshot.revisionId !== 'string' ||
    typeof typedSnapshot.variantId !== 'string' ||
    typeof typedSnapshot.savedAt !== 'string' ||
    typeof typedSnapshot.draft !== 'object' ||
    typedSnapshot.draft === null
  ) {
    return null;
  }
  return {
    revisionId: typedSnapshot.revisionId,
    variantId: typedSnapshot.variantId,
    savedAt: typedSnapshot.savedAt,
    draft: deepCloneDraft(typedSnapshot.draft as ResumeDraft),
  };
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
    selectedSnapshotId:
      typeof typedReview.selectedSnapshotId === 'string'
        ? typedReview.selectedSnapshotId
        : emptyReview.selectedSnapshotId,
    compareSnapshotId:
      typeof typedReview.compareSnapshotId === 'string'
        ? typedReview.compareSnapshotId
        : emptyReview.compareSnapshotId,
    isCompareMode:
      typeof typedReview.isCompareMode === 'boolean'
        ? typedReview.isCompareMode
        : emptyReview.isCompareMode,
  };
}

function stateToPersist(state: ResumeWorkspaceState): PersistedResumeWorkspaceState {
  return {
    activeResumeId: state.activeResumeId,
    resumes: state.resumes,
    resumeDrafts: state.resumeDrafts,
    diagnosticsSnapshots: state.diagnosticsSnapshots,
    diagnosticsSnapshotIdsByVariant: state.diagnosticsSnapshotIdsByVariant,
    revisionContentSnapshots: state.revisionContentSnapshots,
    revisionContentIdsByVariant: state.revisionContentIdsByVariant,
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
  const normalizedResumes: ResumeDraftSummary[] = [];
  for (let i = 0; i < typedRaw.resumes.length; i++) {
    const normalizedSummary = normalizePersistedResumeSummary(typedRaw.resumes[i]);
    if (normalizedSummary !== null) {
      normalizedResumes.push(normalizedSummary);
    }
  }
  const normalizedSnapshots: Record<string, ResumeDiagnosticsSnapshot> = {};
  const rawSnapshots =
    typedRaw.diagnosticsSnapshots !== null &&
    typedRaw.diagnosticsSnapshots !== undefined &&
    typeof typedRaw.diagnosticsSnapshots === 'object'
      ? typedRaw.diagnosticsSnapshots as Record<string, unknown>
      : {};
  const rawSnapshotKeys = Object.keys(rawSnapshots);
  for (let i = 0; i < rawSnapshotKeys.length; i++) {
    const snapshotKey = rawSnapshotKeys[i];
    const normalizedSnapshot = normalizePersistedSnapshot(rawSnapshots[snapshotKey]);
    if (normalizedSnapshot !== null) {
      normalizedSnapshots[snapshotKey] = normalizedSnapshot;
    }
  }
  const normalizedSnapshotIdsByVariant: Record<string, string[]> = {};
  const rawSnapshotIdMap =
    typedRaw.diagnosticsSnapshotIdsByVariant !== null &&
    typedRaw.diagnosticsSnapshotIdsByVariant !== undefined &&
    typeof typedRaw.diagnosticsSnapshotIdsByVariant === 'object'
      ? typedRaw.diagnosticsSnapshotIdsByVariant as Record<string, unknown>
      : {};
  const variantKeys = Object.keys(rawSnapshotIdMap);
  for (let i = 0; i < variantKeys.length; i++) {
    const variantKey = variantKeys[i];
    const rawIds = rawSnapshotIdMap[variantKey];
    if (!Array.isArray(rawIds)) {
      continue;
    }
    const nextIds: string[] = [];
    for (let idIndex = 0; idIndex < rawIds.length; idIndex++) {
      if (typeof rawIds[idIndex] === 'string') {
        nextIds.push(rawIds[idIndex]);
      }
    }
    normalizedSnapshotIdsByVariant[variantKey] = nextIds;
  }
  const normalizedRevisionContentSnapshots: Record<string, ResumeRevisionContentSnapshot> = {};
  const rawRevisionContentSnapshots =
    typedRaw.revisionContentSnapshots !== null &&
    typedRaw.revisionContentSnapshots !== undefined &&
    typeof typedRaw.revisionContentSnapshots === 'object'
      ? typedRaw.revisionContentSnapshots as Record<string, unknown>
      : {};
  const rawRevisionContentKeys = Object.keys(rawRevisionContentSnapshots);
  for (let i = 0; i < rawRevisionContentKeys.length; i++) {
    const revisionContentKey = rawRevisionContentKeys[i];
    const normalizedRevisionContentSnapshot = normalizePersistedRevisionContentSnapshot(
      rawRevisionContentSnapshots[revisionContentKey]
    );
    if (normalizedRevisionContentSnapshot !== null) {
      normalizedRevisionContentSnapshots[revisionContentKey] = normalizedRevisionContentSnapshot;
    }
  }
  const normalizedRevisionContentIdsByVariant: Record<string, string[]> = {};
  const rawRevisionIdMap =
    typedRaw.revisionContentIdsByVariant !== null &&
    typedRaw.revisionContentIdsByVariant !== undefined &&
    typeof typedRaw.revisionContentIdsByVariant === 'object'
      ? typedRaw.revisionContentIdsByVariant as Record<string, unknown>
      : {};
  const revisionVariantKeys = Object.keys(rawRevisionIdMap);
  for (let i = 0; i < revisionVariantKeys.length; i++) {
    const revisionVariantKey = revisionVariantKeys[i];
    const rawIds = rawRevisionIdMap[revisionVariantKey];
    if (!Array.isArray(rawIds)) {
      continue;
    }
    const nextIds: string[] = [];
    for (let idIndex = 0; idIndex < rawIds.length; idIndex++) {
      if (typeof rawIds[idIndex] === 'string') {
        nextIds.push(rawIds[idIndex]);
      }
    }
    normalizedRevisionContentIdsByVariant[revisionVariantKey] = nextIds;
  }
  const seededRevisionContent = ensureRevisionContentSnapshotsExist(
    normalizedResumes,
    typedRaw.resumeDrafts,
    normalizedRevisionContentSnapshots,
    normalizedRevisionContentIdsByVariant
  );
  return {
    activeResumeId: typedRaw.activeResumeId,
    resumes: normalizedResumes,
    resumeDrafts: typedRaw.resumeDrafts,
    diagnosticsSnapshots: normalizedSnapshots,
    diagnosticsSnapshotIdsByVariant: normalizedSnapshotIdsByVariant,
    revisionContentSnapshots: seededRevisionContent.snapshots,
    revisionContentIdsByVariant: seededRevisionContent.revisionIdsByVariant,
    creationFlow: typedRaw.creationFlow,
    builder: typedRaw.builder,
    review: normalizePersistedReviewState(typedRaw.review),
    rewrite: createEmptyRewriteReviewState(),
    ui: normalizePersistedUiState(typedRaw.ui),
  };
}

/**
 * Normalizes the persisted UI state to ensure newer fields (like
 * builderViewMode) get safe defaults when loading state saved before
 * those fields existed.
 */
function normalizePersistedUiState(
  raw: ResumeWorkspaceUiState
): ResumeWorkspaceUiState {
  const VALID_VIEW_MODES: ResumeBuilderViewMode[] = [
    'canvas', 'focus_guidance', 'diagnostics', 'review',
  ];
  const rawMode = (raw as unknown as Record<string, unknown>).builderViewMode;
  const isValidMode =
    typeof rawMode === 'string' &&
    VALID_VIEW_MODES.indexOf(rawMode as ResumeBuilderViewMode) >= 0;
  return {
    currentView: raw.currentView,
    rightRailTab: raw.rightRailTab,
    builderViewMode: isValidMode ? rawMode as ResumeBuilderViewMode : 'canvas',
    activeDialog: raw.activeDialog,
    toastMessage: raw.toastMessage,
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

function getResumeSummaryById(
  resumes: ResumeDraftSummary[],
  resumeId: string
): ResumeDraftSummary | null {
  for (let i = 0; i < resumes.length; i++) {
    if (resumes[i].id === resumeId) {
      return resumes[i];
    }
  }
  return null;
}

function upsertDiagnosticsSnapshotForVariant(
  resumes: ResumeDraftSummary[],
  snapshots: Record<string, ResumeDiagnosticsSnapshot>,
  snapshotIdsByVariant: Record<string, string[]>,
  summary: ResumeDraftSummary,
  snapshot: ResumeDiagnosticsSnapshot
): {
  snapshots: Record<string, ResumeDiagnosticsSnapshot>;
  snapshotIdsByVariant: Record<string, string[]>;
  resumes: ResumeDraftSummary[];
} {
  const nextSnapshots = Object.assign({}, snapshots);
  nextSnapshots[snapshot.snapshotId] = snapshot;

  const nextSnapshotIdsByVariant = Object.assign({}, snapshotIdsByVariant);
  const previousIds =
    Object.prototype.hasOwnProperty.call(snapshotIdsByVariant, summary.variantId)
      ? snapshotIdsByVariant[summary.variantId]
      : [];
  const nextIds: string[] = [snapshot.snapshotId];
  for (let i = 0; i < previousIds.length; i++) {
    if (previousIds[i] !== snapshot.snapshotId) {
      nextIds.push(previousIds[i]);
    }
  }
  nextSnapshotIdsByVariant[summary.variantId] = nextIds;

  const nextResumes = updateResumeSummary(
    resumes,
    summary.id,
    function (currentSummary) {
      return Object.assign({}, currentSummary, {
        latestSnapshotId: snapshot.snapshotId,
      });
    }
  );

  return {
    snapshots: nextSnapshots,
    snapshotIdsByVariant: nextSnapshotIdsByVariant,
    resumes: nextResumes,
  };
}

function upsertRevisionContentSnapshotForVariant(
  snapshots: Record<string, ResumeRevisionContentSnapshot>,
  revisionIdsByVariant: Record<string, string[]>,
  summary: ResumeDraftSummary,
  draft: ResumeDraft,
  savedAt: string
): {
  snapshots: Record<string, ResumeRevisionContentSnapshot>;
  revisionIdsByVariant: Record<string, string[]>;
} {
  const snapshot = buildResumeRevisionContentSnapshot(
    summary.variantId,
    summary.currentRevisionId,
    draft,
    savedAt
  );
  const nextSnapshots = Object.assign({}, snapshots);
  nextSnapshots[snapshot.revisionId] = snapshot;

  const nextRevisionIdsByVariant = Object.assign({}, revisionIdsByVariant);
  const previousIds =
    Object.prototype.hasOwnProperty.call(revisionIdsByVariant, summary.variantId)
      ? revisionIdsByVariant[summary.variantId]
      : [];
  const nextIds: string[] = [snapshot.revisionId];
  for (let i = 0; i < previousIds.length; i++) {
    if (previousIds[i] !== snapshot.revisionId) {
      nextIds.push(previousIds[i]);
    }
  }
  nextRevisionIdsByVariant[summary.variantId] = nextIds;

  return {
    snapshots: nextSnapshots,
    revisionIdsByVariant: nextRevisionIdsByVariant,
  };
}

function ensureRevisionContentSnapshotsExist(
  resumes: ResumeDraftSummary[],
  drafts: Record<string, ResumeDraft>,
  snapshots: Record<string, ResumeRevisionContentSnapshot>,
  revisionIdsByVariant: Record<string, string[]>
): {
  snapshots: Record<string, ResumeRevisionContentSnapshot>;
  revisionIdsByVariant: Record<string, string[]>;
} {
  let nextSnapshots = snapshots;
  let nextRevisionIdsByVariant = revisionIdsByVariant;
  for (let i = 0; i < resumes.length; i++) {
    const summary = resumes[i];
    const draft =
      Object.prototype.hasOwnProperty.call(drafts, summary.id)
        ? drafts[summary.id]
        : null;
    if (draft === null || Object.prototype.hasOwnProperty.call(nextSnapshots, summary.currentRevisionId)) {
      continue;
    }
    const upserted = upsertRevisionContentSnapshotForVariant(
      nextSnapshots,
      nextRevisionIdsByVariant,
      summary,
      draft,
      summary.updatedAt
    );
    nextSnapshots = upserted.snapshots;
    nextRevisionIdsByVariant = upserted.revisionIdsByVariant;
  }
  return {
    snapshots: nextSnapshots,
    revisionIdsByVariant: nextRevisionIdsByVariant,
  };
}

/**
 * Review-shell selection is variant-scoped. When the active variant changes or
 * when snapshot history mutates, this helper keeps the selection deterministic:
 * - prefer an explicitly selected snapshot when it still exists for the variant
 * - otherwise fall back to the variant's latest snapshot
 * - clear compare mode when the compare target disappears or matches the main
 *   selected snapshot
 */
function syncReviewSnapshotSelection(
  review: ResumeReviewState,
  summary: ResumeDraftSummary | null,
  snapshots: Record<string, ResumeDiagnosticsSnapshot>,
  snapshotIdsByVariant: Record<string, string[]>
): ResumeReviewState {
  const nextReview = Object.assign({}, review);
  const variantId = summary !== null ? summary.variantId : null;
  const variantSnapshots = getDiagnosticsSnapshotsForVariant(
    snapshots,
    snapshotIdsByVariant,
    variantId
  );
  let selectedSnapshotId: string | null = null;
  if (review.selectedSnapshotId !== null) {
    for (let i = 0; i < variantSnapshots.length; i++) {
      if (variantSnapshots[i].snapshotId === review.selectedSnapshotId) {
        selectedSnapshotId = review.selectedSnapshotId;
        break;
      }
    }
  }
  if (selectedSnapshotId === null && summary !== null && summary.latestSnapshotId !== null) {
    selectedSnapshotId = summary.latestSnapshotId;
  }

  let compareSnapshotId: string | null = null;
  if (review.compareSnapshotId !== null && review.compareSnapshotId !== selectedSnapshotId) {
    for (let i = 0; i < variantSnapshots.length; i++) {
      if (variantSnapshots[i].snapshotId === review.compareSnapshotId) {
        compareSnapshotId = review.compareSnapshotId;
        break;
      }
    }
  }

  nextReview.selectedSnapshotId = selectedSnapshotId;
  nextReview.compareSnapshotId = compareSnapshotId;
  nextReview.isCompareMode = review.isCompareMode && compareSnapshotId !== null;
  return nextReview;
}

function refreshDerivedState(
  state: ResumeWorkspaceState,
  options?: {
    bumpRevisionId?: boolean;
  }
): Partial<ResumeWorkspaceState> {
  const activeDraft = getActiveDraft(state);
  const activeSummary = getActiveSummary(state);
  const sectionCompletion = deriveSectionCompletion(activeDraft);
  let nextResumes = state.resumes;
  let nextRevisionContentSnapshots = state.revisionContentSnapshots;
  let nextRevisionContentIdsByVariant = state.revisionContentIdsByVariant;
  const shouldBumpRevisionId =
    options !== undefined && options.bumpRevisionId === true;
  if (activeSummary !== null) {
    nextResumes = updateResumeSummary(state.resumes, activeSummary.id, function (summary) {
      return Object.assign({}, summary, {
        updatedAt: new Date().toISOString(),
        status: deriveStatusForSummary(summary.mode, sectionCompletion),
        currentRevisionId:
          shouldBumpRevisionId ? generateRevisionId() : summary.currentRevisionId,
      });
    });
    const nextActiveSummary = getResumeSummaryById(nextResumes, activeSummary.id);
    if (nextActiveSummary !== null) {
      const revisionSnapshotResult = upsertRevisionContentSnapshotForVariant(
        state.revisionContentSnapshots,
        state.revisionContentIdsByVariant,
        nextActiveSummary,
        activeDraft,
        nextActiveSummary.updatedAt
      );
      nextRevisionContentSnapshots = revisionSnapshotResult.snapshots;
      nextRevisionContentIdsByVariant = revisionSnapshotResult.revisionIdsByVariant;
    }
  }
  return {
    resumes: nextResumes,
    revisionContentSnapshots: nextRevisionContentSnapshots,
    revisionContentIdsByVariant: nextRevisionContentIdsByVariant,
    builder: {
      activeSection: state.builder.activeSection,
      sectionCompletion: sectionCompletion,
    },
    review: syncReviewSnapshotSelection(
      createEmptyReviewState(),
      activeSummary !== null
        ? getResumeSummaryById(nextResumes, activeSummary.id)
        : null,
      state.diagnosticsSnapshots,
      state.diagnosticsSnapshotIdsByVariant
    ),
    rewrite: createEmptyRewriteReviewState(),
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
    diagnosticsSnapshots: initialState.diagnosticsSnapshots,
    diagnosticsSnapshotIdsByVariant: initialState.diagnosticsSnapshotIdsByVariant,
    revisionContentSnapshots: initialState.revisionContentSnapshots,
    revisionContentIdsByVariant: initialState.revisionContentIdsByVariant,
    creationFlow: initialState.creationFlow,
    builder: initialState.builder,
    review: initialState.review,
    rewrite: initialState.rewrite,
    ui: initialState.ui,

    hydrate: function () {
      const persisted = loadPersistedState();
      const hydratedSummary =
        persisted.activeResumeId !== null
          ? getResumeSummaryById(persisted.resumes, persisted.activeResumeId)
          : null;
      set({
        activeResumeId: persisted.activeResumeId,
        resumes: persisted.resumes,
        resumeDrafts: persisted.resumeDrafts,
        diagnosticsSnapshots: persisted.diagnosticsSnapshots,
        diagnosticsSnapshotIdsByVariant: persisted.diagnosticsSnapshotIdsByVariant,
        revisionContentSnapshots: persisted.revisionContentSnapshots,
        revisionContentIdsByVariant: persisted.revisionContentIdsByVariant,
        creationFlow: persisted.creationFlow,
        builder: persisted.builder,
        review: syncReviewSnapshotSelection(
          persisted.review,
          hydratedSummary,
          persisted.diagnosticsSnapshots,
          persisted.diagnosticsSnapshotIdsByVariant
        ),
        rewrite: createEmptyRewriteReviewState(),
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
      const nextSummary =
        resumeId !== null ? getResumeSummaryById(state.resumes, resumeId) : null;
      const nextReview = syncReviewSnapshotSelection(
        createEmptyReviewState(),
        nextSummary,
        state.diagnosticsSnapshots,
        state.diagnosticsSnapshotIdsByVariant
      );
      set(
        Object.assign({}, derived, {
          activeResumeId: resumeId,
          review: nextReview,
          rewrite: createEmptyRewriteReviewState(),
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
        variantId: resumeId,
        name: buildWorkspaceName(mode, state.creationFlow.goalMode, state.creationFlow.targetContext),
        mode: mode,
        status: deriveStatusForSummary(mode, sectionCompletion),
        updatedAt: new Date().toISOString(),
        targetContext: cloneTargetContext(state.creationFlow.targetContext),
        linkedToResumeId: mode === 'tailored' ? 'resume-master-seed' : null,
        sourceVariantId: mode === 'tailored' ? 'resume-master-seed' : null,
        currentRevisionId: generateRevisionId(),
        latestSnapshotId: null,
      };
      const nextResumes: ResumeDraftSummary[] = [];
      for (let i = 0; i < state.resumes.length; i++) {
        nextResumes.push(state.resumes[i]);
      }
      nextResumes.unshift(summary);

      const nextDrafts: Record<string, ResumeDraft> = Object.assign({}, state.resumeDrafts);
      nextDrafts[resumeId] = baseDraft;
      const seededRevisionContent = upsertRevisionContentSnapshotForVariant(
        state.revisionContentSnapshots,
        state.revisionContentIdsByVariant,
        summary,
        baseDraft,
        summary.updatedAt
      );

      set({
        activeResumeId: resumeId,
        resumes: nextResumes,
        resumeDrafts: nextDrafts,
        diagnosticsSnapshots: state.diagnosticsSnapshots,
        diagnosticsSnapshotIdsByVariant: state.diagnosticsSnapshotIdsByVariant,
        revisionContentSnapshots: seededRevisionContent.snapshots,
        revisionContentIdsByVariant: seededRevisionContent.revisionIdsByVariant,
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
        rewrite: createEmptyRewriteReviewState(),
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

    /**
     * Switches the builder workspace between canvas (document-dominant, rail
     * hidden), focus_guidance (rail open with section guidance), and
     * diagnostics (rail open with diagnostics). Also syncs the right rail tab
     * to match the selected mode so the rail content is immediately relevant.
     */
    setBuilderViewMode: function (mode) {
      const nextUi = Object.assign({}, get().ui, {
        builderViewMode: mode,
      });
      if (mode === 'focus_guidance') {
        nextUi.rightRailTab = 'guidance';
      } else if (mode === 'diagnostics') {
        nextUi.rightRailTab = 'diagnostics';
      }
      set({ ui: nextUi });
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
      const derived = refreshDerivedState(nextState, {
        bumpRevisionId: true,
      });
      set(
        Object.assign({}, derived, {
          resumeDrafts: nextDrafts,
          rewrite: createEmptyRewriteReviewState(),
        })
      );
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
      const derived = refreshDerivedState(nextState, {
        bumpRevisionId: true,
      });
      set(
        Object.assign({}, derived, {
          resumeDrafts: nextDrafts,
          rewrite: createEmptyRewriteReviewState(),
        })
      );
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
      const derived = refreshDerivedState(nextState, {
        bumpRevisionId: true,
      });
      set(
        Object.assign({}, derived, {
          resumeDrafts: nextDrafts,
          rewrite: createEmptyRewriteReviewState(),
        })
      );
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
      const derived = refreshDerivedState(nextState, {
        bumpRevisionId: true,
      });
      set(
        Object.assign({}, derived, {
          resumeDrafts: nextDrafts,
          rewrite: createEmptyRewriteReviewState(),
        })
      );
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
      const derived = refreshDerivedState(nextState, {
        bumpRevisionId: true,
      });
      set(
        Object.assign({}, derived, {
          resumeDrafts: nextDrafts,
          rewrite: createEmptyRewriteReviewState(),
        })
      );
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
          sourceVariantId: null,
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
        variantId: resumeId,
        name: buildWorkspaceName('tailored', 'tailor-to-job', nextContext),
        mode: 'tailored',
        status: deriveStatusForSummary('tailored', nextSectionCompletion),
        updatedAt: new Date().toISOString(),
        targetContext: nextContext,
        linkedToResumeId: currentSummary.mode === 'master' ? currentSummary.id : currentSummary.linkedToResumeId,
        sourceVariantId:
          currentSummary.mode === 'master'
            ? currentSummary.id
            : currentSummary.variantId,
        currentRevisionId: generateRevisionId(),
        latestSnapshotId: null,
      });
      const createdSummary = nextResumes[0];
      const seededRevisionContent = upsertRevisionContentSnapshotForVariant(
        state.revisionContentSnapshots,
        state.revisionContentIdsByVariant,
        createdSummary,
        nextDrafts[resumeId],
        createdSummary.updatedAt
      );
      for (let i = 0; i < state.resumes.length; i++) {
        nextResumes.push(state.resumes[i]);
      }
      set({
        activeResumeId: resumeId,
        resumes: nextResumes,
        resumeDrafts: nextDrafts,
        diagnosticsSnapshots: state.diagnosticsSnapshots,
        diagnosticsSnapshotIdsByVariant: state.diagnosticsSnapshotIdsByVariant,
        revisionContentSnapshots: seededRevisionContent.snapshots,
        revisionContentIdsByVariant: seededRevisionContent.revisionIdsByVariant,
        builder: {
          activeSection: state.builder.activeSection,
          sectionCompletion: nextSectionCompletion,
        },
        review: createEmptyReviewState(),
        rewrite: createEmptyRewriteReviewState(),
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
        variantId: duplicateId,
        name: currentSummary.name + ' Copy',
        mode: currentSummary.mode,
        status: deriveStatusForSummary(currentSummary.mode, duplicateSectionCompletion),
        updatedAt: new Date().toISOString(),
        targetContext: duplicateContext,
        linkedToResumeId: currentSummary.linkedToResumeId,
        sourceVariantId: currentSummary.variantId,
        currentRevisionId: generateRevisionId(),
        latestSnapshotId: null,
      };
      const seededRevisionContent = upsertRevisionContentSnapshotForVariant(
        state.revisionContentSnapshots,
        state.revisionContentIdsByVariant,
        duplicateSummary,
        duplicateDraft,
        duplicateSummary.updatedAt
      );
      const nextResumes: ResumeDraftSummary[] = [];
      nextResumes.push(duplicateSummary);
      for (let i = 0; i < state.resumes.length; i++) {
        nextResumes.push(state.resumes[i]);
      }
      set({
        activeResumeId: duplicateId,
        resumes: nextResumes,
        resumeDrafts: nextDrafts,
        diagnosticsSnapshots: state.diagnosticsSnapshots,
        diagnosticsSnapshotIdsByVariant: state.diagnosticsSnapshotIdsByVariant,
        revisionContentSnapshots: seededRevisionContent.snapshots,
        revisionContentIdsByVariant: seededRevisionContent.revisionIdsByVariant,
        builder: {
          activeSection: state.builder.activeSection,
          sectionCompletion: duplicateSectionCompletion,
        },
        review: createEmptyReviewState(),
        rewrite: createEmptyRewriteReviewState(),
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
        rewrite: createEmptyRewriteReviewState(),
        review: Object.assign({}, createEmptyReviewState(), {
          status: 'error' as ResumeDiagnosticsStatus,
          errorMessage: 'Select a resume before running diagnostics.',
          }),
        });
        get().persist();
        return;
      }

      const request = buildResumeDiagnosticsRequest(summary, getActiveDraft(state));
      const requestedVariantId = summary.variantId;
      const requestedRevisionId = summary.currentRevisionId;
      set({
        rewrite: createEmptyRewriteReviewState(),
        review: Object.assign({}, createEmptyReviewState(), {
          status: 'loading' as ResumeDiagnosticsStatus,
          request: request,
          lastEvaluatedResumeId: summary.id,
        }),
      });
      get().persist();

      const result = await evaluateResumeDiagnostics(request);
      if (!result.ok || result.response === null) {
        const latestState = get();
        const latestSummary = getResumeSummaryById(latestState.resumes, summary.id);
        const isStillCurrent =
          latestSummary !== null &&
          latestSummary.variantId === requestedVariantId &&
          latestSummary.currentRevisionId === requestedRevisionId;
        if (isStillCurrent) {
          set({
            rewrite: createEmptyRewriteReviewState(),
            review: Object.assign({}, createEmptyReviewState(), {
              status: result.unavailable ? 'unavailable' as ResumeDiagnosticsStatus : 'error' as ResumeDiagnosticsStatus,
              request: request,
              errorMessage: result.errorMessage,
              lastEvaluatedResumeId: summary.id,
              lastEvaluatedAt: new Date().toISOString(),
            }),
          });
        }
        get().persist();
        return;
      }

      const evaluatedAt = new Date().toISOString();
      const latestState = get();
      const latestSummary = getResumeSummaryById(latestState.resumes, summary.id);
      if (latestSummary === null) {
        get().persist();
        return;
      }
      const snapshot = buildResumeDiagnosticsSnapshot(
        latestSummary.variantId,
        latestSummary.currentRevisionId,
        result.response,
        evaluatedAt
      );
      const snapshotResult = upsertDiagnosticsSnapshotForVariant(
        latestState.resumes,
        latestState.diagnosticsSnapshots,
        latestState.diagnosticsSnapshotIdsByVariant,
        latestSummary,
        snapshot
      );
      const isStillCurrent =
        latestSummary.variantId === requestedVariantId &&
        latestSummary.currentRevisionId === requestedRevisionId;
      const nextState: Partial<ResumeWorkspaceState> = {
        resumes: snapshotResult.resumes,
        diagnosticsSnapshots: snapshotResult.snapshots,
        diagnosticsSnapshotIdsByVariant: snapshotResult.snapshotIdsByVariant,
      };
      if (isStillCurrent) {
        nextState.review = syncReviewSnapshotSelection(
          Object.assign({}, createEmptyReviewState(), {
          status: result.response.response_state,
          request: request,
          response: result.response,
          lastEvaluatedResumeId: summary.id,
          lastEvaluatedAt: evaluatedAt,
          selectedSnapshotId: snapshot.snapshotId,
        }),
          snapshotResult.resumes[0].id === latestSummary.id
            ? snapshotResult.resumes[0]
            : getResumeSummaryById(snapshotResult.resumes, latestSummary.id),
          snapshotResult.snapshots,
          snapshotResult.snapshotIdsByVariant
        );
      }
      nextState.rewrite = createEmptyRewriteReviewState();
      set(nextState);
      get().persist();
    },

    selectReviewSnapshot: function (snapshotId) {
      const state = get();
      const activeSummary = getActiveSummary(state);
      const syncedReview = syncReviewSnapshotSelection(
        Object.assign({}, state.review, {
          selectedSnapshotId: snapshotId,
        }),
        activeSummary,
        state.diagnosticsSnapshots,
        state.diagnosticsSnapshotIdsByVariant
      );
      set({
        review: syncedReview,
      });
      get().persist();
    },

    setCompareSnapshotId: function (snapshotId) {
      const state = get();
      const activeSummary = getActiveSummary(state);
      const syncedReview = syncReviewSnapshotSelection(
        Object.assign({}, state.review, {
          compareSnapshotId: snapshotId,
          isCompareMode: snapshotId !== null,
        }),
        activeSummary,
        state.diagnosticsSnapshots,
        state.diagnosticsSnapshotIdsByVariant
      );
      set({
        review: syncedReview,
      });
      get().persist();
    },

    setCompareMode: function (isCompareMode) {
      const state = get();
      const activeSummary = getActiveSummary(state);
      const syncedReview = syncReviewSnapshotSelection(
        Object.assign({}, state.review, {
          isCompareMode: isCompareMode,
        }),
        activeSummary,
        state.diagnosticsSnapshots,
        state.diagnosticsSnapshotIdsByVariant
      );
      set({
        review: syncedReview,
      });
      get().persist();
    },

    clearSnapshotCompare: function () {
      set({
        review: Object.assign({}, get().review, {
          compareSnapshotId: null,
          isCompareMode: false,
        }),
      });
      get().persist();
    },

    requestResumeRewrite: async function (request) {
      const currentBuilder = get().builder;
      const targetSection =
        request.target.section_id === 'summary' ||
        request.target.section_id === 'experience' ||
        request.target.section_id === 'skills'
          ? request.target.section_id
          : currentBuilder.activeSection;
      set({
        builder: Object.assign({}, currentBuilder, {
          activeSection: targetSection,
        }),
        rewrite: {
          status: 'loading',
          request: request,
          candidates: [],
          errorMessage: null,
          appliedCandidateId: null,
        },
      });
      get().persist();

      const result = await requestResumeRewriteCandidates(request);
      if (!result.ok || result.response === null) {
        set({
          rewrite: {
            status: result.unavailable ? 'unavailable' : 'error',
            request: request,
            candidates: [],
            errorMessage: result.errorMessage,
            appliedCandidateId: null,
          },
        });
        get().persist();
        return;
      }

      set({
        rewrite: {
          status: 'ready',
          request: request,
          candidates: result.response.candidates,
          errorMessage: null,
          appliedCandidateId: null,
        },
      });
      get().persist();
    },

    dismissResumeRewrite: function () {
      set({
        rewrite: {
          status: 'dismissed',
          request: null,
          candidates: [],
          errorMessage: null,
          appliedCandidateId: null,
        },
      });
      get().persist();
    },

    applyResumeRewriteCandidate: function (candidateId) {
      const state = get();
      if (state.activeResumeId === null || state.rewrite.request === null) {
        return;
      }

      let selectedCandidate = null;
      for (let i = 0; i < state.rewrite.candidates.length; i++) {
        if (state.rewrite.candidates[i].candidate_id === candidateId) {
          selectedCandidate = state.rewrite.candidates[i];
          break;
        }
      }
      if (selectedCandidate === null) {
        return;
      }

      const applyResult = applyResumeRewriteCandidateToDraft(
        getActiveDraft(state),
        state.rewrite.request,
        selectedCandidate
      );
      if (applyResult.nextDraft === null || applyResult.appliedSectionId === null) {
        set({
          rewrite: Object.assign({}, state.rewrite, {
            status: 'error' as const,
            errorMessage:
              'PathOS could not apply that rewrite to the current draft. Re-run diagnostics and request a fresh suggestion.',
          }),
        });
        get().persist();
        return;
      }

      const nextDrafts = Object.assign({}, state.resumeDrafts);
      nextDrafts[state.activeResumeId] = applyResult.nextDraft;
      const nextState = Object.assign({}, state, { resumeDrafts: nextDrafts });
      const derived = refreshDerivedState(nextState, {
        bumpRevisionId: true,
      });
      set(
        Object.assign({}, derived, {
          resumeDrafts: nextDrafts,
          builder: Object.assign({}, state.builder, {
            activeSection: applyResult.appliedSectionId,
          }),
          rewrite: {
            status: 'applied',
            request: state.rewrite.request,
            candidates: state.rewrite.candidates,
            errorMessage: null,
            appliedCandidateId: candidateId,
          },
          ui: Object.assign({}, state.ui, {
            toastMessage: 'Rewrite applied. Re-run diagnostics to refresh backend guidance.',
          }),
        })
      );
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
