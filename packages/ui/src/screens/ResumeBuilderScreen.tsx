/**
 * ============================================================================
 * RESUME BUILDER SCREEN — Phase 1 workspace for federal resume editing
 * ============================================================================
 *
 * PURPOSE: This screen lives at /dashboard/resume-builder and provides a
 * structured workspace for building and improving federal resumes. Phase 1
 * focuses on the Edit tab as the primary working surface, with inline
 * intelligence (bullet health, suggested rewrites) and target-job awareness.
 *
 * ARCHITECTURE:
 *   Route:    app/(shared)/dashboard/resume-builder/page.tsx  (thin wrapper)
 *   Shell:    SharedDashboardRouteShell (provides app shell + PathAdvisor rail)
 *   This file: primary implementation surface for all workspace-level UX.
 *
 * WORKSPACE MODEL:
 *   One active resume version, one active target job, one autonomy mode,
 *   one active tab. Direct edits modify the active resume version.
 *   Suggestions never silently overwrite content.
 *
 * DATA SOURCE:
 *   Reads resume data from @pathos/core resume store (localStorage).
 *   Reads saved jobs from @pathos/core saved-jobs store for the target
 *   job selector. Local-first and deterministic — no remote fetch.
 *
 * VIEW MODEL:
 *   A local view-model layer adds bullet-level intelligence (health states,
 *   inline suggestions) on top of the core resume model. The core model
 *   stores duties as a single string; the VM splits them into individual
 *   bullets with metadata. Edits sync back to core on every change.
 *
 * TRUST-FIRST:
 *   No credentials, no scraping, no auto-apply. No silent mutations.
 *   User controls every edit. Suggestions require explicit acceptance.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

'use client';

import type React from 'react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  User,
  Briefcase,
  GraduationCap,
  Wrench,
  Shield,
  Award,
  FileCheck,
  Target,
  Download,
  Layers,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Pencil,
  Sparkles,
  ArrowRight,
  GitCompare,
  Eye,
  Map,
  TrendingUp,
  LayoutGrid,
  X,
} from 'lucide-react';
import {
  loadResumeStore,
  saveResumeStore,
  updateDraft,
  createDefaultDraft,
  listVersions,
  createVersion,
  restoreVersion,
  exportResumeJSON,
  loadSavedJobsStore,
  seedSavedJobsIfEmpty,
} from '@pathos/core';
import type {
  ResumeStore,
  ResumeDraft,
  ResumeExperience,
  Job,
} from '@pathos/core';
import { usePathAdvisorScreenOverridesStore } from '../stores/pathAdvisorScreenOverridesStore';
import { INTERACTIVE_HOVER_CLASS } from '../styles/interactiveHover';
import { scoreTierColor, readinessTierColor, readinessBandLabel } from '../styles/scoreTiers';

// ---------------------------------------------------------------------------
// New architecture imports — live canvas, slot-based top bar, callout system
// ---------------------------------------------------------------------------
//
// These imports bring in the document-centered architecture components
// that replace the old tab-heavy section manager model. The new system
// provides:
//   - Stable 7-slot top bar (positions never shift across stages)
//   - Compact left rail with section progress badges
//   - Live resume canvas with all sections always visible
//   - Section-scoped callout layer with typed annotation anchors
//   - Validation preflight checklist
//
import { ResumeBuilderTopBar } from '../resume-builder/components/ResumeBuilderTopBar';
import type { DropdownItem } from '../resume-builder/components/ResumeBuilderTopBar';
import { ResumeSectionRail, RESUME_OVERVIEW_ID } from '../resume-builder/components/ResumeSectionRail';
import { LiveResumeCanvas } from '../resume-builder/components/LiveResumeCanvas';
import type { EditingField } from '../resume-builder/components/LiveResumeCanvas';
import { ResumeCalloutLayer } from '../resume-builder/components/ResumeCalloutLayer';
import { CalloutLineOverlay } from '../resume-builder/components/CalloutLineOverlay';
import { ValidationChecklist } from '../resume-builder/components/ValidationChecklist';
import { useSectionProgress, getMissingContactFields, buildContactGuidanceLabel } from '../resume-builder/hooks/useSectionProgress';
import { deriveOverallReadiness } from '../resume-builder/types/section-progress-types';
import type { SectionProgress } from '../resume-builder/types/section-progress-types';
import { useAnchorMap } from '../resume-builder/hooks/useAnchorMap';
import { useCalloutLines } from '../resume-builder/hooks/useCalloutLines';
import { buildPrimaryCtaConfig } from '../resume-builder/types/stage-types';
import { buildPreflightChecks, buildPreflightState } from '../resume-builder/types/validation-types';
import { buildDefaultCalloutLineConfig } from '../resume-builder/types/callout-line-types';
import type { CalloutLineDef, CalloutLineOverlayConfig } from '../resume-builder/types/callout-line-types';
import {
  buildCanonicalCalloutRegistry,
  getCanonicalTargetsForSection,
  getOverviewCalloutTargets,
  getEvidenceInformedOverviewTargets,
  filterCanonicalTargetsForContent,
} from '../resume-builder/types/canonical-callout-defs';
import type { CanonicalCalloutRegistry } from '../resume-builder/types/canonical-callout-defs';
import type { BuilderStage } from '../resume-builder/types/stage-types';
import type { TailoringAnnotation } from '../resume-builder/types/annotation-types';
import type { PreflightState } from '../resume-builder/types/validation-types';
import { scoreAllSections, deriveEvidenceBasedReadiness } from '../resume-builder/utils/evidence-scoring';
import type { SectionEvidenceScore } from '../resume-builder/utils/evidence-scoring';
import type { SectionIssue } from '../resume-builder/types/issue-categories';
import { sortIssuesByPriority } from '../resume-builder/types/issue-categories';
import type { PathAdvisorResumeContext, PathAdvisorTriggerIntent } from '../resume-builder/types/pathadvisor-context';
import { buildPathAdvisorPrompt } from '../resume-builder/types/pathadvisor-context';
import { ResumeBuilderPathAdvisorModal } from '../resume-builder/components/ResumeBuilderPathAdvisorModal';
import type { ConversationAction } from '../resume-builder/types/conversation-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for ResumeBuilderScreen; currently no required props. */
export type ResumeBuilderScreenProps = Record<string, unknown>;

// ---------------------------------------------------------------------------
// View-model types — local intelligence layer on top of core resume model
// ---------------------------------------------------------------------------

/**
 * Bullet health classification. Determines the visual indicator and
 * available inline actions for each experience bullet.
 *   strong:         well-quantified, specific, aligned to requirements
 *   weak:           vague, too short, missing impact / scope
 *   generic:        action-verb driven but lacks specifics
 *   needs-evidence: makes a claim without supporting data
 */
export type BulletHealth = 'strong' | 'weak' | 'generic' | 'needs-evidence';

/**
 * Single bullet in the view model. Parsed from the core model's
 * duties string and enriched with a health classification.
 */
export interface ResumeBulletVM {
  id: string;
  text: string;
  health: BulletHealth;
}

/**
 * Resume section identifiers for the left rail and canvas sync.
 * Matches the ordered list of sections shown in the workspace.
 */
export type SectionId =
  | 'contact'
  | 'summary'
  | 'identity-summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'federal-details'
  | 'certifications'
  | 'supporting-evidence';

/**
 * Workspace tab identifiers. Edit is the primary working state;
 * other tabs are scaffolded for future implementation.
 */
export type WorkspaceTab =
  | 'edit'
  | 'suggested-changes'
  | 'coverage-map'
  | 'preview'
  | 'version-diff';

/**
 * Autonomy mode controls how aggressively the system suggests changes.
 *   manual:   user controls everything, no automatic suggestions
 *   assisted: suggestions appear inline but user must accept each one
 */
export type AutonomyMode = 'assisted' | 'manual';

/**
 * Pre-built inline suggestion for a specific bullet. Contains the
 * original and revised text, explanation, and support cue.
 */
interface InlineSuggestionDef {
  experienceId: string;
  bulletIndex: number;
  originalText: string;
  revisedText: string;
  explanation: string;
  supportCue: string;
}

/**
 * Metadata for a resume section shown in the left rail.
 * Includes completion percentage, issue count, and target relevance.
 */
export interface SectionMeta {
  id: SectionId;
  label: string;
  completionPct: number;
  issueCount: number;
  relevancePct: number;
}

// ---------------------------------------------------------------------------
// Broader proposal types — data model for Suggested Changes tab
// ---------------------------------------------------------------------------
//
// These types define the shape of section-level improvement proposals that
// appear in the Suggested Changes review queue. Each proposal represents
// a discrete change the system recommends, driven by the active resume
// content and the active target job. The model is deliberately lightweight
// but clean enough to support replacing the deterministic local engine
// with a real analysis backend in a later phase.
//

/**
 * Proposal type classifies the kind of improvement being suggested.
 * Used for grouping, filtering, and icon selection in the review queue.
 *   add-summary:        resume is missing a professional summary
 *   strengthen-bullet:  an existing bullet needs stronger phrasing
 *   add-federal-detail: federal-specific fields are incomplete
 *   expand-phrasing:    a bullet is too brief for federal scoring
 *   improve-keywords:   target-specific terms are missing from the resume
 */
export type ProposalType =
  | 'add-summary'
  | 'strengthen-bullet'
  | 'add-federal-detail'
  | 'expand-phrasing'
  | 'improve-keywords';

/**
 * Lifecycle status of a broader proposal in the review queue.
 *   pending:   not yet reviewed — visible in the queue
 *   accepted:  user accepted — applied to resume, removed from queue
 *   rejected:  user dismissed — removed without mutation
 *   editing:   user chose "Edit First" — loaded into editable state
 */
export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'editing';

/**
 * A broader proposal for the Suggested Changes tab.
 * Fields:
 *   id                   — stable unique identifier for keying and lookup
 *   type                 — proposal classification (for grouping/icons)
 *   title                — human-readable proposal title shown in the card
 *   sectionKey           — which resume section this proposal affects
 *   confidence           — 0–100 engine confidence that this improves fit
 *   reason               — brief explanation of why this is suggested
 *   supportedRequirement — which job requirement this change supports
 *   beforeText           — current content (empty string for additions)
 *   suggestedText        — proposed new or replacement content
 *   needsConfirmation    — if true, user should review carefully
 *   status               — lifecycle status (pending/accepted/rejected/editing)
 */
export interface ResumeProposal {
  id: string;
  type: ProposalType;
  title: string;
  sectionKey: SectionId;
  confidence: number;
  reason: string;
  supportedRequirement: string;
  beforeText: string;
  suggestedText: string;
  needsConfirmation: boolean;
  status: ProposalStatus;
}

// ---------------------------------------------------------------------------
// Coverage Map types — diagnostic dimensions for resume-to-job fit analysis
// ---------------------------------------------------------------------------
//
// Each CoverageDimension represents one axis of alignment between the
// active resume and the active target job. The Coverage Map tab renders
// these as actionable diagnostic cards, not decorative analytics.
//

/**
 * Severity classification for a coverage dimension.
 *   strong:        score >= 80, user is well-positioned on this axis
 *   moderate:      score >= 60, addressable with targeted edits
 *   high-priority: score <  60, significant gap or risk
 */
export type CoverageSeverity = 'strong' | 'moderate' | 'high-priority';

/**
 * A single dimension in the Coverage Map diagnostic view.
 * Each dimension evaluates one axis of resume-to-job alignment and
 * includes actionable pointers to the source section and available
 * improvement proposals.
 */
export interface CoverageDimension {
  id: string;
  label: string;
  scorePct: number;
  severity: CoverageSeverity;
  statusSummary: string;
  linkedSection: SectionId;
  suggestionCount: number;
  actionHint: string;
}

// ---------------------------------------------------------------------------
// Constants — tab definitions, section definitions, health labels
// ---------------------------------------------------------------------------

/**
 * Ordered tab definitions for the workspace tab bar.
 * Phase 2: badge count for suggested-changes is now driven by live
 * proposal state, so no static badge value is needed here.
 */
const WORKSPACE_TABS: Array<{ id: WorkspaceTab; label: string; badge?: number }> = [
  { id: 'edit', label: 'Edit' },
  { id: 'suggested-changes', label: 'Suggested Changes' },
  { id: 'coverage-map', label: 'Coverage Map' },
  { id: 'preview', label: 'Preview' },
  { id: 'version-diff', label: 'Version Diff' },
];

/**
 * Section definitions for the left rail. Each section maps to a canvas
 * region. Icons are from lucide-react to stay consistent with PathOS.
 */
/**
 * Full section definitions — includes all individual section IDs.
 * Used by proposal logic, coverage map, and cross-tab references that
 * still need individual section identifiers (e.g. 'contact', 'summary').
 */
export const SECTION_DEFS: Array<{ id: SectionId; label: string; icon: typeof FileText }> = [
  { id: 'contact', label: 'Contact Information', icon: User },
  { id: 'summary', label: 'Professional Summary', icon: FileText },
  { id: 'identity-summary', label: 'Identity & Summary', icon: User },
  { id: 'experience', label: 'Work Experience', icon: Briefcase },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'skills', label: 'Skills', icon: Wrench },
  { id: 'federal-details', label: 'Federal Details', icon: Shield },
  { id: 'certifications', label: 'Certifications', icon: Award },
  { id: 'supporting-evidence', label: 'Supporting Evidence', icon: FileCheck },
];

/**
 * Edit-tab section definitions — the top-level editing groups shown in the
 * Edit dashboard and section dropdown. Contact + Summary are merged into
 * "Identity & Summary" to create a more substantial first editing experience.
 * Other sections remain individual.
 */
export const EDIT_SECTION_GROUPS: Array<{ id: SectionId; label: string; icon: typeof FileText }> = [
  { id: 'identity-summary', label: 'Identity & Summary', icon: User },
  { id: 'experience', label: 'Work Experience', icon: Briefcase },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'skills', label: 'Skills', icon: Wrench },
  { id: 'federal-details', label: 'Federal Details', icon: Shield },
  { id: 'certifications', label: 'Certifications', icon: Award },
  { id: 'supporting-evidence', label: 'Supporting Evidence', icon: FileCheck },
];

/** Human-readable labels for bullet health states. */
const BULLET_HEALTH_LABELS: Record<BulletHealth, string> = {
  strong: 'Strong',
  weak: 'Weak',
  generic: 'Generic',
  'needs-evidence': 'Needs Evidence',
};

/** Theme color tokens for bullet health indicators. */
const BULLET_HEALTH_COLORS: Record<BulletHealth, string> = {
  strong: 'var(--p-success)',
  weak: 'var(--p-danger, #ef4444)',
  generic: 'var(--p-warning, #eab308)',
  'needs-evidence': 'var(--p-warning, #eab308)',
};

// ---------------------------------------------------------------------------
// Impact level — derived from proposal confidence for compact display
// ---------------------------------------------------------------------------
//
// Categorizes a proposal's expected improvement magnitude into three tiers.
// Used in the compressed Suggested Changes rows and Resume Brief to give
// the user a fast scan of which proposals matter most without reading
// the full reason text. The thresholds align with the score tier system
// (80+ = strong/high, 60–79 = moderate/medium, below 60 = low).
//

/** Impact classification for proposal compact rows and badges. */
export type ImpactLevel = 'high' | 'medium' | 'low';

/**
 * Derive an impact level from a proposal's confidence score.
 * Thresholds: >= 88 High, >= 75 Medium, below Low.
 * These are intentionally slightly higher than score-tier cutoffs
 * because confidence represents engine certainty, not resume score.
 */
export function getProposalImpactLevel(confidence: number): ImpactLevel {
  if (confidence >= 88) return 'high';
  if (confidence >= 75) return 'medium';
  return 'low';
}

/** Human-readable labels for impact levels. */
const IMPACT_LABELS: Record<ImpactLevel, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/** Color tokens for impact level badges. */
const IMPACT_COLORS: Record<ImpactLevel, string> = {
  high: 'var(--p-danger, #ef4444)',
  medium: 'var(--p-warning, #eab308)',
  low: 'var(--p-text-dim)',
};

/**
 * Estimate a rough score-gain string for a proposal based on confidence.
 * This is a deterministic placeholder — a real engine would compute
 * actual point gains from the proposal's effect on coverage dimensions.
 */
export function estimateScoreGain(confidence: number): string {
  if (confidence >= 90) return '+6–8 pts';
  if (confidence >= 80) return '+4–6 pts';
  if (confidence >= 70) return '+2–4 pts';
  return '+1–2 pts';
}

// ---------------------------------------------------------------------------
// Mock data — deterministic seed for the workspace demo
// ---------------------------------------------------------------------------

/**
 * Hardcoded bullet health assignments for the mock resume data.
 * Keyed by 'experienceId-bulletIndex'. In the future, a deterministic
 * analysis engine will compute these from bullet content + target job.
 */
const MOCK_BULLET_HEALTH: Record<string, BulletHealth> = {
  'exp-1-0': 'strong',
  'exp-1-1': 'strong',
  'exp-1-2': 'weak',
  'exp-2-0': 'strong',
  'exp-2-1': 'strong',
  'exp-2-2': 'generic',
};

/**
 * Pre-built inline suggestion for the known weak bullet (exp-1, bullet 2).
 * Demonstrates the rewrite flow with realistic federal resume content.
 */
const MOCK_INLINE_SUGGESTION: InlineSuggestionDef = {
  experienceId: 'exp-1',
  bulletIndex: 2,
  originalText: 'Managed a team of 5 security specialists.',
  revisedText:
    'Supervised and mentored a team of 5 GS-11/12 Information Security Specialists, conducting quarterly performance reviews and developing individual training plans aligned with NICE Framework competencies.',
  explanation: 'Preserved facts, improved phrasing',
  supportCue: 'Supports: Supervisory experience / high emphasis',
};

/**
 * Static section metadata for the left rail. These values represent
 * the mock resume state. A real implementation would compute these
 * from the draft content + target job analysis.
 */
export const MOCK_SECTION_META: SectionMeta[] = [
  { id: 'contact', label: 'Contact Information', completionPct: 100, issueCount: 0, relevancePct: 0 },
  { id: 'summary', label: 'Professional Summary', completionPct: 0, issueCount: 0, relevancePct: 0 },
  { id: 'experience', label: 'Work Experience', completionPct: 75, issueCount: 2, relevancePct: 85 },
  { id: 'education', label: 'Education', completionPct: 100, issueCount: 0, relevancePct: 0 },
  { id: 'skills', label: 'Skills', completionPct: 80, issueCount: 0, relevancePct: 85 },
  { id: 'federal-details', label: 'Federal Details', completionPct: 40, issueCount: 4, relevancePct: 55 },
  { id: 'certifications', label: 'Certifications', completionPct: 50, issueCount: 0, relevancePct: 0 },
  { id: 'supporting-evidence', label: 'Supporting Evidence', completionPct: 20, issueCount: 6, relevancePct: 0 },
];

/**
 * Edit-tab section metadata — uses grouped sections for the Edit dashboard.
 * "Identity & Summary" merges Contact (100%) and Summary (0%) into a single
 * entry. The composite score averages the two: (100+0)/2 = 50%. Issues are
 * summed. Relevance takes the max of the two sub-sections.
 *
 * This keeps the dashboard focused on 7 meaningful editing groups instead
 * of 8 with a too-thin Contact card.
 */
export const EDIT_SECTION_META: SectionMeta[] = [
  { id: 'identity-summary', label: 'Identity & Summary', completionPct: 50, issueCount: 0, relevancePct: 0 },
  { id: 'experience', label: 'Work Experience', completionPct: 75, issueCount: 2, relevancePct: 85 },
  { id: 'education', label: 'Education', completionPct: 100, issueCount: 0, relevancePct: 0 },
  { id: 'skills', label: 'Skills', completionPct: 80, issueCount: 0, relevancePct: 85 },
  { id: 'federal-details', label: 'Federal Details', completionPct: 40, issueCount: 4, relevancePct: 55 },
  { id: 'certifications', label: 'Certifications', completionPct: 50, issueCount: 0, relevancePct: 0 },
  { id: 'supporting-evidence', label: 'Supporting Evidence', completionPct: 20, issueCount: 6, relevancePct: 0 },
];

// ---------------------------------------------------------------------------
// Section status derivation — label + color for dashboard cards
// ---------------------------------------------------------------------------
//
// Each section card in the Edit dashboard shows a compact status label
// (Strong / Moderate / Missing / Needs Work / Critical) derived from
// the section's completion percentage and issue count. This keeps the
// dashboard scannable without overloading each card with raw numbers.
//

/**
 * Edit-mode state controls which of the two Edit tab states is active.
 *   dashboard: section overview cards — user sees all sections at once
 *   focused:   single-section editor — user is editing one section
 */
export type EditMode = 'dashboard' | 'focused';

/**
 * Derived status for a section dashboard card.
 * label: human-readable status (e.g. "Strong", "Missing")
 * color: CSS color token for the status badge
 */
export interface SectionStatusInfo {
  label: string;
  color: string;
}

/**
 * Derive a human-readable section status from section metadata.
 *
 * Thresholds:
 *   completionPct === 0                     → Missing
 *   completionPct < 30 or issueCount >= 4   → Critical
 *   issueCount > 0 or completionPct < 60    → Needs Work
 *   completionPct >= 80                     → Strong
 *   everything else                         → Moderate
 *
 * Colors use PathOS theme tokens to stay consistent with the score
 * tier system used in Saved Jobs and other surfaces.
 */
export function deriveSectionStatus(meta: SectionMeta): SectionStatusInfo {
  if (meta.completionPct === 0) {
    return { label: 'Missing', color: 'var(--p-danger, #ef4444)' };
  }
  if (meta.completionPct < 30 || meta.issueCount >= 4) {
    return { label: 'Critical', color: 'var(--p-danger, #ef4444)' };
  }
  if (meta.issueCount > 0 || meta.completionPct < 60) {
    return { label: 'Needs Work', color: 'var(--p-warning, #eab308)' };
  }
  if (meta.completionPct >= 80) {
    return { label: 'Strong', color: 'var(--p-success)' };
  }
  return { label: 'Moderate', color: 'var(--p-warning, #eab308)' };
}

/**
 * Derive a compact metric string for a section dashboard card.
 * Prefers issue count when issues exist, otherwise shows completion.
 *
 * Examples: "2 issues", "80% complete", "Not started", "" (for 100%)
 */
export function deriveSectionMetric(meta: SectionMeta): string {
  if (meta.completionPct === 0) return 'Not started';
  if (meta.issueCount > 0) {
    return meta.issueCount + (meta.issueCount === 1 ? ' issue' : ' issues');
  }
  if (meta.completionPct >= 100) return '';
  return meta.completionPct + '% complete';
}

/** Mock federal details for the canvas (not yet in core model). */
const MOCK_FEDERAL_DETAILS = {
  securityClearance: 'Secret',
  veteranPreference: 'None',
  federalEmployee: true,
  highestGrade: 'GS-12',
};

/**
 * MOCK_CERTIFICATIONS — legacy constant retained for callout/annotation
 * consumers that still reference it. The authoritative certifications
 * now live in store.draft.certifications, seeded in createMockResumeDraft().
 */
const MOCK_CERTIFICATIONS = ['CISSP', 'CompTIA Security+'];

/**
 * Create realistic mock resume data matching the workspace mockups.
 * Called once when the resume store is empty to seed a demonstrable state.
 * Professional summary is intentionally empty to show the missing state.
 */
function createMockResumeDraft(): ResumeDraft {
  return {
    contact: {
      fullName: 'Alexandra Chen',
      email: 'alexandra.chen@email.com',
      phone: '(555) 123-4567',
      city: 'Fort Meade',
      state: 'MD',
      citizenship: 'United States',
      veteranStatus: 'N/A',
    },
    summary: '',
    experience: [
      {
        id: 'exp-1',
        jobTitle: 'IT Security Analyst',
        employer: 'Department of Defense, Cyber Command',
        location: 'Fort Meade, MD',
        startDate: 'January 2021',
        endDate: 'Present',
        hoursPerWeek: '40',
        grade: 'GS-12',
        duties:
          'Led vulnerability assessments and penetration testing for DoD networks, identifying and remediating over 200 critical vulnerabilities annually.\nDeveloped security policies and procedures aligned with NIST 800-53 and FedRAMP requirements.\nManaged a team of 5 security specialists.',
      },
      {
        id: 'exp-2',
        jobTitle: 'Information Security Specialist',
        employer: 'Department of Veterans Affairs',
        location: 'Washington, DC',
        startDate: 'June 2018',
        endDate: 'December 2020',
        hoursPerWeek: '40',
        grade: 'GS-11',
        duties:
          'Implemented enterprise security monitoring solutions protecting 300,000+ endpoints across VA healthcare facilities.\nConducted security awareness training programs reaching 5,000+ employees annually.\nPerformed incident response activities and documented findings.',
      },
    ],
    education: [
      {
        id: 'edu-1',
        institution: 'University of Maryland, College Park',
        degree: 'Master of Science',
        field: 'Cybersecurity',
        graduationDate: 'May 2018',
        gpa: '3.8',
      },
      {
        id: 'edu-2',
        institution: 'Virginia Tech',
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        graduationDate: 'May 2016',
        gpa: '3.6',
      },
    ],
    skills: [
      { id: 'sk-1', name: 'NIST 800-53' },
      { id: 'sk-2', name: 'FedRAMP' },
      { id: 'sk-3', name: 'Penetration Testing' },
      { id: 'sk-4', name: 'Incident Response' },
      { id: 'sk-5', name: 'NICE Framework' },
      { id: 'sk-6', name: 'Risk Management' },
    ],
    certifications: [
      { id: 'cert-1', name: 'CISSP' },
      { id: 'cert-2', name: 'CompTIA Security+' },
    ],
    supportingEvidence: [
      { id: 'ev-1', text: 'Reduced vulnerability remediation time by 40% through automated scanning pipeline implementation (2022).' },
      { id: 'ev-2', text: 'Awarded DoD Civilian Service Medal for cybersecurity incident response excellence (2023).' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Proposal generation — deterministic local logic for Phase 2
// ---------------------------------------------------------------------------
//
// These functions produce the broader proposals shown in Suggested Changes
// and the diagnostic dimensions shown in Coverage Map. Both are driven by
// the active resume draft and the active target job. In Phase 2, the logic
// is deterministic / mock — no remote fetch, no ML. The structure is clean
// enough that swapping in a real analysis engine later only requires
// changing these two functions.
//

/**
 * Generate broader proposals for the Suggested Changes review queue.
 *
 * Logic:
 *   1. If professional summary is empty → propose adding one
 *   2. Propose strengthening the known weak leadership bullet
 *   3. Propose completing missing federal employment details
 *   4. Propose expanding the brief incident-response bullet
 *   5. If target job is set → propose improving keyword coverage
 *
 * Each proposal includes before/after text, confidence, reason, and a
 * supported-requirement cue. All proposals start in 'pending' status.
 *
 * Exported for unit testing.
 */
export function generateProposals(
  draft: ResumeDraft,
  targetJob: Job | null
): ResumeProposal[] {
  const proposals: ResumeProposal[] = [];
  let nextId = 1;

  /* --- 1. Add Professional Summary if missing --- */
  const hasSummary = draft.summary && draft.summary.trim();
  if (!hasSummary) {
    const jobContext = targetJob ? ' tailored to ' + targetJob.title : '';
    proposals.push({
      id: 'prop-' + nextId,
      type: 'add-summary',
      title: 'Add Professional Summary',
      sectionKey: 'summary',
      confidence: 92,
      reason:
        'A professional summary is the first thing HR specialists read. ' +
        'Missing it makes the resume harder to screen quickly.',
      supportedRequirement: 'Helps HR quickly assess fit',
      beforeText: '',
      suggestedText:
        'Cybersecurity professional with 8+ years of federal experience in ' +
        'vulnerability assessment, security policy development, and team ' +
        'leadership. Holds Secret clearance and CISSP certification. Proven ' +
        'track record protecting critical DoD and VA infrastructure' +
        jobContext + '.',
      needsConfirmation: false,
      status: 'pending',
    });
    nextId = nextId + 1;
  }

  /* --- 2. Strengthen weak leadership bullet --- */
  proposals.push({
    id: 'prop-' + nextId,
    type: 'strengthen-bullet',
    title: 'Strengthen Leadership Bullet in Work Experience',
    sectionKey: 'experience',
    confidence: 88,
    reason:
      'The team management bullet lacks federal-specific language, scope ' +
      'indicators, and quantified outcomes that GS-13/14 positions require.',
    supportedRequirement: 'Supports leadership/scope requirement',
    beforeText: 'Managed a team of 5 security specialists.',
    suggestedText:
      'Supervised and mentored a team of 5 GS-11/12 Information Security ' +
      'Specialists, conducting quarterly performance reviews and developing ' +
      'individual training plans aligned with NICE Framework competencies.',
    needsConfirmation: false,
    status: 'pending',
  });
  nextId = nextId + 1;

  /* --- 3. Complete missing federal details --- */
  proposals.push({
    id: 'prop-' + nextId,
    type: 'add-federal-detail',
    title: 'Complete Federal Employment Details',
    sectionKey: 'federal-details',
    confidence: 95,
    reason:
      'Federal resumes require specific details (series, grade, hours/week, ' +
      'supervisor info) that civilian resumes omit. Missing items can cause ' +
      'automatic screening rejection.',
    supportedRequirement: 'Required for federal application compliance',
    beforeText:
      'Security Clearance: Secret\nHighest Grade: GS-12\nFederal Employee: Yes',
    suggestedText:
      'Security Clearance: Secret (Active)\nHighest Grade: GS-12 Step 5\n' +
      'Federal Employee: Yes\nSupervisor: Available upon request\n' +
      'Series: 2210 (Information Technology)\nPay Plan: GS',
    needsConfirmation: true,
    status: 'pending',
  });
  nextId = nextId + 1;

  /* --- 4. Expand specialized experience phrasing --- */
  proposals.push({
    id: 'prop-' + nextId,
    type: 'expand-phrasing',
    title: 'Expand Specialized Experience Phrasing',
    sectionKey: 'experience',
    confidence: 78,
    reason:
      'The incident response bullet is too brief. Federal HR specialists ' +
      'score each experience bullet against specialized experience ' +
      'requirements in the announcement.',
    supportedRequirement: 'Improves specialized experience coverage',
    beforeText: 'Performed incident response activities and documented findings.',
    suggestedText:
      'Led incident response for 15+ security events per quarter, coordinating ' +
      'with SOC analysts and network engineers to contain threats, preserve ' +
      'forensic evidence, and produce after-action reports for leadership ' +
      'review per NIST 800-61 procedures.',
    needsConfirmation: false,
    status: 'pending',
  });
  nextId = nextId + 1;

  /* --- 5. Improve keyword coverage (only when target job is set) --- */
  if (targetJob) {
    proposals.push({
      id: 'prop-' + nextId,
      type: 'improve-keywords',
      title: 'Improve Keyword Coverage for Target Job',
      sectionKey: 'skills',
      confidence: 72,
      reason:
        'Several target-specific terms from the ' + targetJob.title +
        ' announcement are missing from your resume summary and skills section.',
      supportedRequirement: 'Improves automated screening pass rate',
      beforeText:
        'Current skills: NIST 800-53, FedRAMP, Penetration Testing, ' +
        'Incident Response, NICE Framework, Risk Management',
      suggestedText:
        'Add: Zero Trust Architecture, FISMA Compliance, Security ' +
        'Authorization (ATO), Continuous Monitoring, Cloud Security ' +
        '(FedRAMP High), STIG Implementation',
      needsConfirmation: true,
      status: 'pending',
    });
    nextId = nextId + 1;
  }

  /* Suppress unused-variable lint for nextId final increment. */
  void nextId;

  return proposals;
}

/**
 * Generate coverage dimensions for the Coverage Map diagnostic view.
 *
 * Each dimension evaluates one axis of resume-to-job alignment using
 * deterministic local logic. The scores are mock values for Phase 2
 * but are slightly responsive to resume state (e.g., whether the
 * professional summary is present).
 *
 * When no target job is selected, all dimensions show 0% with a
 * "select a target job" hint — the Coverage Map is meaningless
 * without a job to compare against.
 *
 * Exported for unit testing.
 */
export function generateCoverageDimensions(
  draft: ResumeDraft,
  targetJob: Job | null
): CoverageDimension[] {
  /* No target job → show empty-state dimensions */
  if (!targetJob) {
    return [
      { id: 'dim-spec-exp', label: 'Specialized Experience', scorePct: 0, severity: 'high-priority', statusSummary: 'Select a target job to evaluate', linkedSection: 'experience', suggestionCount: 0, actionHint: 'Select a target job above' },
      { id: 'dim-evidence', label: 'Resume Evidence', scorePct: 0, severity: 'high-priority', statusSummary: 'Select a target job to evaluate', linkedSection: 'summary', suggestionCount: 0, actionHint: 'Select a target job above' },
      { id: 'dim-keywords', label: 'Keywords Coverage', scorePct: 0, severity: 'high-priority', statusSummary: 'Select a target job to evaluate', linkedSection: 'skills', suggestionCount: 0, actionHint: 'Select a target job above' },
      { id: 'dim-leadership', label: 'Leadership / Scope', scorePct: 0, severity: 'high-priority', statusSummary: 'Select a target job to evaluate', linkedSection: 'experience', suggestionCount: 0, actionHint: 'Select a target job above' },
      { id: 'dim-federal', label: 'Federal Details', scorePct: 0, severity: 'high-priority', statusSummary: 'Select a target job to evaluate', linkedSection: 'federal-details', suggestionCount: 0, actionHint: 'Select a target job above' },
    ];
  }

  /*
   * Compute dimension scores. In Phase 2 these are deterministic mocks
   * with minor responsiveness to draft state. A real engine would compute
   * these from NLP analysis of the resume text vs job announcement text.
   */
  const hasSummary = draft.summary && draft.summary.trim();

  /* Specialized Experience: based on bullet count and specificity */
  const specExpScore = 78;
  const specSeverity: CoverageSeverity = specExpScore >= 80 ? 'strong' : (specExpScore >= 60 ? 'moderate' : 'high-priority');

  /* Resume Evidence: boosted by having a professional summary */
  const evidenceScore = hasSummary ? 72 : 55;
  const evidenceSeverity: CoverageSeverity = evidenceScore >= 80 ? 'strong' : (evidenceScore >= 60 ? 'moderate' : 'high-priority');

  /* Keywords Coverage: moderate gap in target-specific terms */
  const keywordScore = 65;
  const keywordSeverity: CoverageSeverity = keywordScore >= 80 ? 'strong' : (keywordScore >= 60 ? 'moderate' : 'high-priority');

  /* Leadership / Scope: weak — the leadership bullet is flagged */
  const leadershipScore = 45;
  const leadershipSeverity: CoverageSeverity = leadershipScore >= 80 ? 'strong' : (leadershipScore >= 60 ? 'moderate' : 'high-priority');

  /* Federal Details: lowest — multiple missing fields */
  const federalScore = 30;
  const federalSeverity: CoverageSeverity = federalScore >= 80 ? 'strong' : (federalScore >= 60 ? 'moderate' : 'high-priority');

  return [
    {
      id: 'dim-spec-exp',
      label: 'Specialized Experience',
      scorePct: specExpScore,
      severity: specSeverity,
      statusSummary: 'Strong enough but could be tightened for target language',
      linkedSection: 'experience',
      suggestionCount: 1,
      actionHint: 'Tighten phrasing to match announcement language',
    },
    {
      id: 'dim-evidence',
      label: 'Resume Evidence',
      scorePct: evidenceScore,
      severity: evidenceSeverity,
      statusSummary: hasSummary
        ? 'Summary present; work experience documented'
        : 'Professional summary missing, weakens opening impression',
      linkedSection: 'summary',
      suggestionCount: hasSummary ? 0 : 1,
      actionHint: hasSummary ? 'Continue strengthening evidence' : 'Add professional summary',
    },
    {
      id: 'dim-keywords',
      label: 'Keywords Coverage',
      scorePct: keywordScore,
      severity: keywordSeverity,
      statusSummary: 'Target-specific terms missing in summary and one bullet',
      linkedSection: 'skills',
      suggestionCount: 1,
      actionHint: 'Add missing target keywords to skills and bullets',
    },
    {
      id: 'dim-leadership',
      label: 'Leadership / Scope',
      scorePct: leadershipScore,
      severity: leadershipSeverity,
      statusSummary: '2 work experience bullets can be strengthened',
      linkedSection: 'experience',
      suggestionCount: 2,
      actionHint: 'Strengthen leadership bullets with scope and outcomes',
    },
    {
      id: 'dim-federal',
      label: 'Federal Details',
      scorePct: federalScore,
      severity: federalSeverity,
      statusSummary: '4 missing items required for federal application',
      linkedSection: 'federal-details',
      suggestionCount: 1,
      actionHint: 'Complete missing federal employment details',
    },
  ];
}

// ---------------------------------------------------------------------------
// Exported helper: parse duties string into individual bullet VMs
// ---------------------------------------------------------------------------

/**
 * Split a duties string into individual bullet view-model entries.
 * Strips leading bullet markers (•, -, *) and trims whitespace.
 * Each bullet gets a health assignment from the mock lookup table,
 * defaulting to 'generic' for unrecognized entries.
 *
 * Exported for unit testing.
 */
export function parseBulletsFromDuties(
  duties: string,
  experienceId: string
): ResumeBulletVM[] {
  if (!duties || !duties.trim()) return [];
  const lines = duties.split('\n');
  const bullets: ResumeBulletVM[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].replace(/^[•\-*]\s*/, '').trim();
    if (!trimmed) continue;
    const healthKey = experienceId + '-' + bullets.length;
    const health = MOCK_BULLET_HEALTH[healthKey] || 'generic';
    bullets.push({
      id: experienceId + '-b' + bullets.length,
      text: trimmed,
      health: health,
    });
  }
  return bullets;
}

/**
 * Join bullet VMs back into a duties string for core model persistence.
 * Each bullet is prefixed with a bullet marker.
 */
function joinBulletsToDuties(bullets: ResumeBulletVM[]): string {
  const parts: string[] = [];
  for (let i = 0; i < bullets.length; i++) {
    parts.push(bullets[i].text);
  }
  return parts.join('\n');
}

/**
 * Build the complete bullet map for all experience entries.
 * Maps experience ID to an array of bullet VMs.
 */
function buildBulletMap(experience: ResumeExperience[]): Record<string, ResumeBulletVM[]> {
  const map: Record<string, ResumeBulletVM[]> = {};
  for (let i = 0; i < experience.length; i++) {
    const exp = experience[i];
    map[exp.id] = parseBulletsFromDuties(exp.duties, exp.id);
  }
  return map;
}

// ---------------------------------------------------------------------------
// PathAdvisor screen overrides — route-aware rail content
// ---------------------------------------------------------------------------

/**
 * Quick prompts for the PathAdvisor rail when Resume Builder is active.
 * These guide users toward high-value resume improvement actions.
 */
const RESUME_BUILDER_ADVISOR_PROMPTS = [
  'Rewrite this bullet stronger',
  'What keywords am I missing?',
  'Check my specialized experience',
  'Build a professional summary',
];

// ---------------------------------------------------------------------------
// Sub-component: Workspace top bar
// ---------------------------------------------------------------------------

/**
 * Top-level workspace controls for Resume Builder. Spans the full width
 * and contains: title, local-only badge, version selector, target job
 * selector, autonomy mode, version count, export, and tailor-to-job CTA.
 *
 * The target job selector is a real dropdown sourced from saved jobs state.
 * Changing the target job updates local workspace context only — it does
 * NOT auto-mutate resume content.
 */
function WorkspaceTopBar(props: {
  savedJobs: Job[];
  activeTargetJobId: string | null;
  onTargetJobChange: (jobId: string | null) => void;
  autonomyMode: AutonomyMode;
  onAutonomyModeChange: (mode: AutonomyMode) => void;
  versionCount: number;
  showTargetJobDropdown: boolean;
  onToggleTargetJobDropdown: () => void;
  onCloseTargetJobDropdown: () => void;
}) {
  /* Find the active target job object for display label. */
  let activeJob: Job | null = null;
  if (props.activeTargetJobId) {
    for (let i = 0; i < props.savedJobs.length; i++) {
      if (props.savedJobs[i].id === props.activeTargetJobId) {
        activeJob = props.savedJobs[i];
        break;
      }
    }
  }

  /* Build the display label for the target job button. */
  const targetLabel = activeJob
    ? activeJob.title + ' - ' + activeJob.agency.split(',')[0].split(' ').slice(-1)[0]
    : 'Select target job';

  return (
    <div
      className="px-4 py-2 flex items-center gap-3 flex-wrap flex-shrink-0"
      style={{
        borderBottom: '1px solid var(--p-border)',
        background: 'var(--p-surface)',
      }}
      data-testid="resume-builder-top-bar"
    >
      {/* Title + local badge */}
      <div className="flex items-center gap-2 mr-2">
        <FileText className="w-4 h-4" style={{ color: 'var(--p-accent)' }} />
        <h2 className="text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--p-text)' }}>
          Resume Builder
        </h2>
        <span
          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap"
          style={{
            color: 'var(--p-success)',
            background: 'color-mix(in srgb, var(--p-success) 12%, transparent)',
          }}
        >
          <ShieldCheck className="w-3 h-3" />
          LOCAL ONLY
        </span>
      </div>

      {/* Version selector (simplified for Phase 1) */}
      <button
        type="button"
        className={'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded ' + INTERACTIVE_HOVER_CLASS}
        style={{
          border: '1px solid var(--p-border)',
          color: 'var(--p-text)',
          background: 'transparent',
        }}
        aria-label="Active resume version"
      >
        Default Resume
        <ChevronDown className="w-3 h-3" style={{ color: 'var(--p-text-dim)' }} />
      </button>

      {/* Target job selector — real dropdown from saved jobs */}
      <div className="relative" data-testid="target-job-selector">
        <button
          type="button"
          onClick={props.onToggleTargetJobDropdown}
          className={'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded ' + INTERACTIVE_HOVER_CLASS}
          style={{
            border: activeJob
              ? '1px solid var(--p-success)'
              : '1px solid var(--p-border)',
            color: activeJob ? 'var(--p-text)' : 'var(--p-text-muted)',
            background: activeJob
              ? 'color-mix(in srgb, var(--p-success) 8%, transparent)'
              : 'transparent',
          }}
          aria-haspopup="listbox"
          aria-expanded={props.showTargetJobDropdown}
          aria-label="Target job selector"
        >
          <Target className="w-3 h-3" style={{ color: activeJob ? 'var(--p-success)' : 'var(--p-text-dim)' }} />
          <span className="max-w-[200px] truncate">
            {activeJob ? 'Target Job: ' : ''}{targetLabel}
          </span>
          <ChevronDown className="w-3 h-3" style={{ color: 'var(--p-text-dim)' }} />
        </button>

        {/* Dropdown panel */}
        {props.showTargetJobDropdown && (
          <div
            className="absolute top-full left-0 mt-1 w-72 py-1 rounded shadow-lg z-50"
            style={{
              background: 'var(--p-surface)',
              border: '1px solid var(--p-border)',
            }}
            role="listbox"
            aria-label="Saved jobs"
          >
            {props.savedJobs.length === 0 && (
              <div className="px-3 py-2 text-xs" style={{ color: 'var(--p-text-dim)' }}>
                No saved jobs yet. Save jobs from Job Search to use as targets.
              </div>
            )}
            {/* Clear selection option */}
            {props.activeTargetJobId && (
              <button
                type="button"
                onClick={function () {
                  props.onTargetJobChange(null);
                  props.onCloseTargetJobDropdown();
                }}
                className={'w-full text-left px-3 py-2 text-xs ' + INTERACTIVE_HOVER_CLASS}
                style={{ color: 'var(--p-text-muted)' }}
                role="option"
                aria-selected={false}
              >
                Clear target job
              </button>
            )}
            {props.savedJobs.map(function (job) {
              const isSelected = job.id === props.activeTargetJobId;
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={function () {
                    props.onTargetJobChange(job.id);
                    props.onCloseTargetJobDropdown();
                  }}
                  className={'w-full text-left px-3 py-2 ' + INTERACTIVE_HOVER_CLASS}
                  style={{
                    background: isSelected
                      ? 'color-mix(in srgb, var(--p-accent) 12%, transparent)'
                      : 'transparent',
                    color: isSelected ? 'var(--p-accent)' : 'var(--p-text)',
                  }}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="text-xs font-medium truncate">{job.title}</div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--p-text-dim)' }}>
                    {job.agency}
                    {job.grade ? ' · ' + job.grade : ''}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Autonomy mode toggle */}
      <div className="flex items-center rounded overflow-hidden" style={{ border: '1px solid var(--p-border)' }}>
        <button
          type="button"
          onClick={function () { props.onAutonomyModeChange('manual'); }}
          className="px-2.5 py-1.5 text-xs font-medium transition-colors"
          style={{
            background: props.autonomyMode === 'manual'
              ? 'var(--p-accent)'
              : 'transparent',
            color: props.autonomyMode === 'manual'
              ? 'var(--p-bg)'
              : 'var(--p-text-muted)',
          }}
          aria-pressed={props.autonomyMode === 'manual'}
          data-testid="autonomy-manual"
        >
          Manual
        </button>
        <button
          type="button"
          onClick={function () { props.onAutonomyModeChange('assisted'); }}
          className="px-2.5 py-1.5 text-xs font-medium transition-colors"
          style={{
            background: props.autonomyMode === 'assisted'
              ? 'var(--p-accent)'
              : 'transparent',
            color: props.autonomyMode === 'assisted'
              ? 'var(--p-bg)'
              : 'var(--p-text-muted)',
          }}
          aria-pressed={props.autonomyMode === 'assisted'}
          data-testid="autonomy-assisted"
        >
          Assisted
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Version count button */}
      <button
        type="button"
        className={'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded ' + INTERACTIVE_HOVER_CLASS}
        style={{
          border: '1px solid var(--p-border)',
          color: 'var(--p-text-muted)',
          background: 'transparent',
        }}
        aria-label={props.versionCount + (props.versionCount === 1 ? ' version' : ' versions')}
      >
        <Layers className="w-3 h-3" />
        {props.versionCount} {props.versionCount === 1 ? 'version' : 'versions'}
      </button>

      {/* Export button */}
      <button
        type="button"
        className={'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded ' + INTERACTIVE_HOVER_CLASS}
        style={{
          border: '1px solid var(--p-border)',
          color: 'var(--p-text-muted)',
          background: 'transparent',
        }}
        aria-label="Export resume"
      >
        <Download className="w-3.5 h-3.5" />
        Export
      </button>

      {/* Tailor to Job — primary CTA */}
      <button
        type="button"
        className={'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded ' + INTERACTIVE_HOVER_CLASS}
        style={{
          background: 'var(--p-accent)',
          color: 'var(--p-bg)',
          border: '1px solid var(--p-accent)',
        }}
        aria-label="Tailor resume to target job"
        data-testid="tailor-to-job-btn"
      >
        <Zap className="w-3.5 h-3.5" />
        Tailor to Job
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Context strip — editing status and mode info
// ---------------------------------------------------------------------------

/**
 * Compact strip below the top bar showing current editing context:
 * which version is being edited, how edits are saved, what mode is active,
 * and how many proposals await review.
 */
function ContextStrip(props: {
  autonomyMode: AutonomyMode;
  proposalCount: number;
}) {
  return (
    <div
      className="px-4 py-1.5 flex items-center gap-4 flex-wrap text-[11px] flex-shrink-0"
      style={{
        borderBottom: '1px solid var(--p-border)',
        background: 'var(--p-surface2)',
        color: 'var(--p-text-dim)',
      }}
      data-testid="resume-builder-context-strip"
    >
      <span>
        You are editing:{' '}
        <strong style={{ color: 'var(--p-accent)' }}>Default Resume</strong>
      </span>
      <span style={{ color: 'var(--p-border)' }}>·</span>
      <span>Changes saved locally</span>
      <span style={{ color: 'var(--p-border)' }}>·</span>
      {props.autonomyMode === 'assisted' ? (
        <span>Assisted mode</span>
      ) : (
        <span>Manual mode</span>
      )}
      {props.proposalCount > 0 && (
        <>
          <span style={{ color: 'var(--p-border)' }}>·</span>
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
            style={{
              background: 'color-mix(in srgb, var(--p-warning, #eab308) 15%, transparent)',
              color: 'var(--p-warning, #eab308)',
            }}
          >
            {props.proposalCount} pending
          </span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Section organizer — workspace-style section control panel
// ---------------------------------------------------------------------------
//
// Replaces the previous SectionsRail (which felt like a second navigation
// sidebar) with a calmer, card-based section organizer panel. Each section
// appears as a distinct work-unit card showing completion, issues, and
// relevance. The organizer stays visually subordinate to the center editing
// surface while providing whole-resume awareness at a glance.
//

/**
 * Individual card in the section organizer. Renders one resume section
 * as a compact work-unit card with completion bar, issues badge, and
 * relevance indicator.
 *
 * Uses explicit useState hover tracking so the selected state survives
 * hover without visual conflict (per Interaction-State Standard for
 * list row / card controls). Selected state uses accent-tinted background
 * plus a 4px accent left border, which is visually stronger than hover.
 *
 * Focus-visible uses a 2px inset ring via Tailwind utilities with the
 * --tw-ring-color custom property set to --p-accent.
 */
function SectionOrganizerItem(props: {
  section: SectionMeta;
  isActive: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  /* Find the matching icon from SECTION_DEFS for this section. */
  let IconComponent = FileText;
  for (let i = 0; i < SECTION_DEFS.length; i++) {
    if (SECTION_DEFS[i].id === props.section.id) {
      IconComponent = SECTION_DEFS[i].icon;
      break;
    }
  }

  /* Determine completion bar color using the shared score tier system. */
  const barColor = scoreTierColor(props.section.completionPct);

  /*
   * Build dynamic visual styles based on active (selected) and hovered
   * states. Selected always takes precedence over hovered to prevent
   * hover from making the active item look deselected.
   */
  let bgStyle = 'transparent';
  let borderStyle = '1px solid transparent';
  let leftBorderStyle = '3px solid transparent';
  let titleColor = 'var(--p-text-muted)';
  let iconColor = 'var(--p-text-dim)';

  if (props.isActive) {
    /* Selected state: accent tint + accent left border, stronger than hover */
    bgStyle = 'color-mix(in srgb, var(--p-accent) 8%, var(--p-surface))';
    borderStyle = '1px solid color-mix(in srgb, var(--p-accent) 30%, var(--p-border))';
    leftBorderStyle = '4px solid var(--p-accent)';
    titleColor = 'var(--p-text)';
    iconColor = 'var(--p-accent)';
  } else if (isHovered) {
    /* Hover state: subtle background lift + border brightening */
    bgStyle = 'var(--p-surface2)';
    borderStyle = '1px solid var(--p-text-dim)';
    leftBorderStyle = '3px solid var(--p-text-dim)';
    titleColor = 'var(--p-text)';
    iconColor = 'var(--p-text-muted)';
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); }}
      className="w-full text-left rounded-lg transition-all outline-none focus-visible:ring-2 focus-visible:ring-inset"
      style={Object.assign(
        {
          padding: '10px 12px',
          background: bgStyle,
          border: borderStyle,
          borderLeft: leftBorderStyle,
          color: titleColor,
          cursor: 'pointer',
        },
        /* Tailwind ring color for focus-visible — uses PathOS accent token */
        { '--tw-ring-color': 'var(--p-accent)' } as unknown as React.CSSProperties
      )}
      aria-current={props.isActive ? 'true' : undefined}
      data-testid={'section-rail-' + props.section.id}
      data-selected={props.isActive ? 'true' : undefined}
      data-hovered={isHovered ? 'true' : undefined}
    >
      {/* Title row: icon, section name, issue badge */}
      <div className="flex items-center gap-2 mb-1.5">
        <IconComponent
          className="w-4 h-4 flex-shrink-0"
          style={{ color: iconColor }}
        />
        <span className={'text-xs truncate' + (props.isActive ? ' font-semibold' : ' font-medium')}>
          {props.section.label}
        </span>
        {props.section.issueCount > 0 && (
          <span
            className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{
              background: 'color-mix(in srgb, var(--p-danger, #ef4444) 15%, transparent)',
              color: 'var(--p-danger, #ef4444)',
            }}
          >
            {props.section.issueCount}
          </span>
        )}
      </div>

      {/* Completion progress bar */}
      <div style={{ marginLeft: '24px' }}>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: 'var(--p-surface2)', width: '100%' }}
          role="progressbar"
          aria-valuenow={props.section.completionPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={props.section.label + ' completion'}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: props.section.completionPct + '%',
              background: barColor,
            }}
          />
        </div>
        {/* Secondary metadata: completion percentage + relevance */}
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[10px]" style={{ color: 'var(--p-text-dim)' }}>
            {props.section.completionPct}%
          </span>
          {props.section.relevancePct > 0 && (
            <span className="text-[10px]" style={{ color: 'var(--p-text-dim)' }}>
              · {props.section.relevancePct}% relevant
            </span>
          )}
        </div>
      </div>

      {/* Active indicator: "Editing" badge for the selected section */}
      {props.isActive && (
        <div className="mt-1.5" style={{ marginLeft: '24px' }}>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              background: 'color-mix(in srgb, var(--p-accent) 15%, transparent)',
              color: 'var(--p-accent)',
            }}
          >
            Editing
          </span>
        </div>
      )}
    </button>
  );
}

/**
 * Section organizer panel — lists all resume sections as interactive
 * cards in a quieter, workspace-style layout. Replaces the previous
 * SectionsRail to feel more like a work organizer than a second nav.
 *
 * Uses wider spacing (248px width, gap between cards) and a quieter
 * --p-bg background to stay visually subordinate to the center editing
 * surface. Each card shows completion status, issue counts, and target
 * relevance so the user maintains whole-resume awareness while editing
 * one section at a time.
 *
 * Clicking a section updates the center editing surface to show only
 * that section's content (section-focused editing model).
 */
function SectionOrganizer(props: {
  sections: SectionMeta[];
  activeSection: SectionId;
  onSectionClick: (id: SectionId) => void;
}) {
  return (
    <nav
      className="flex flex-col py-3 px-2.5 overflow-y-auto flex-shrink-0"
      style={{
        width: '248px',
        minWidth: '248px',
        borderRight: '1px solid var(--p-border)',
        background: 'var(--p-bg)',
      }}
      aria-label="Resume sections"
      data-testid="resume-sections-rail"
    >
      {/* Organizer heading — quieter than nav sidebar headings */}
      <div className="px-2 py-1 mb-2">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--p-text-dim)' }}
        >
          Section Organizer
        </span>
      </div>

      {/* Section cards — separated with gap for visual clarity */}
      <div className="flex flex-col gap-1.5">
        {props.sections.map(function (section) {
          const isActive = section.id === props.activeSection;
          return (
            <SectionOrganizerItem
              key={section.id}
              section={section}
              isActive={isActive}
              onClick={function () { props.onSectionClick(section.id); }}
            />
          );
        })}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Section Dashboard Card — single section work-unit in grid
// ---------------------------------------------------------------------------
//
// Each card represents one resume section in the Edit dashboard state.
// Shows: section icon, section name, status badge, progress bar, compact
// metric. Clickable to open the focused editor for that section.
//
// Visual design priorities: scannable, calm, work-module feel (not nav item).
// Uses explicit useState hover tracking so selected state (if ever needed)
// survives hover without visual conflict.
//

/**
 * Individual section card for the Edit dashboard. Renders one resume
 * section as a clickable work-module card with a progress indicator,
 * status badge, and optional compact metric.
 *
 * Accessible: keyboard focusable, labeled, clear visual states.
 */
function SectionDashboardCard(props: {
  section: SectionMeta;
  onSelect: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  /* Find the matching icon from EDIT_SECTION_GROUPS (covers grouped
   * sections like identity-summary) then fall back to SECTION_DEFS. */
  let IconComponent = FileText;
  let foundCardIcon = false;
  for (let i = 0; i < EDIT_SECTION_GROUPS.length; i++) {
    if (EDIT_SECTION_GROUPS[i].id === props.section.id) {
      IconComponent = EDIT_SECTION_GROUPS[i].icon;
      foundCardIcon = true;
      break;
    }
  }
  if (!foundCardIcon) {
    for (let i = 0; i < SECTION_DEFS.length; i++) {
      if (SECTION_DEFS[i].id === props.section.id) {
        IconComponent = SECTION_DEFS[i].icon;
        break;
      }
    }
  }

  /* Derive status label and color from section metadata */
  const status = deriveSectionStatus(props.section);

  /* Derive compact metric string */
  const metric = deriveSectionMetric(props.section);

  /* Progress bar color from the shared score tier system */
  const barColor = scoreTierColor(props.section.completionPct);

  /* Dynamic hover styling — explicit tracking per interaction-state standard */
  const bgStyle = isHovered
    ? 'var(--p-surface2)'
    : 'var(--p-surface)';
  const borderColor = isHovered
    ? 'var(--p-text-dim)'
    : 'var(--p-border)';

  return (
    <button
      type="button"
      onClick={props.onSelect}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); }}
      className="w-full text-left rounded-lg transition-all outline-none focus-visible:ring-2 focus-visible:ring-inset"
      style={Object.assign(
        {
          padding: '14px 16px',
          background: bgStyle,
          border: '1px solid ' + borderColor,
          cursor: 'pointer',
        },
        /* Tailwind ring color for focus-visible — uses PathOS accent token */
        { '--tw-ring-color': 'var(--p-accent)' } as unknown as React.CSSProperties
      )}
      aria-label={'Open ' + props.section.label + ' section — ' + status.label}
      data-testid={'dashboard-card-' + props.section.id}
    >
      {/* Top row: icon + name + status badge */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <div
          className="flex items-center justify-center rounded-md flex-shrink-0"
          style={{
            width: '32px',
            height: '32px',
            background: 'color-mix(in srgb, var(--p-accent) 10%, transparent)',
          }}
        >
          <IconComponent
            className="w-4 h-4"
            style={{ color: 'var(--p-accent)' }}
          />
        </div>
        <span
          className="text-sm font-semibold flex-1 truncate"
          style={{ color: 'var(--p-text)' }}
        >
          {props.section.label}
        </span>
        {/* Status badge */}
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap"
          style={{
            color: status.color,
            background: 'color-mix(in srgb, ' + status.color + ' 12%, transparent)',
          }}
        >
          {status.label}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 rounded-full overflow-hidden mb-1.5"
        style={{ background: 'var(--p-surface2)', width: '100%' }}
        role="progressbar"
        aria-valuenow={props.section.completionPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={props.section.label + ' completion'}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: props.section.completionPct + '%',
            background: barColor,
          }}
        />
      </div>

      {/* Compact metric — one short piece of information */}
      {metric && (
        <div className="flex items-center gap-1">
          <span
            className="text-[11px]"
            style={{ color: 'var(--p-text-dim)' }}
          >
            {metric}
          </span>
        </div>
      )}
    </button>
  );
}

/**
 * Section Dashboard — the default Edit landing state.
 *
 * PURPOSE:
 * Renders a compact command-surface for the Edit tab. At the top, a
 * summary strip shows overall Match, Readiness, biggest blocker, and
 * fastest win so the user instantly knows what matters most. Below
 * that, a grid of section cards lets the user pick where to work.
 *
 * The summary strip replaces the need for any additional status bars
 * and makes the dashboard feel more like a high-signal command surface
 * than a flat page of boxes.
 *
 * Layout: responsive grid, 2-3 columns depending on width, with
 * controlled max-width to prevent cards from stretching too wide.
 */
function SectionDashboard(props: {
  sections: SectionMeta[];
  onSectionSelect: (id: SectionId) => void;
  matchScore: number;
  readinessScore: number;
  biggestBlocker: string;
  fastestWin: string;
  activeJob: Job | null;
}) {
  /*
   * Sort sections for the "top priorities" treatment: sections with the
   * lowest completion percentage and highest issue count should appear
   * first, making weak/high-impact areas more obvious. Completed sections
   * sink to the bottom. This ordering answers "what should I open first?"
   */
  const sortedSections: SectionMeta[] = [];
  for (let i = 0; i < props.sections.length; i++) {
    sortedSections.push(props.sections[i]);
  }
  sortedSections.sort(function (a, b) {
    /* Sections with issues first */
    if (a.issueCount > 0 && b.issueCount === 0) return -1;
    if (b.issueCount > 0 && a.issueCount === 0) return 1;
    /* Then by completion ascending (weakest first) */
    if (a.completionPct !== b.completionPct) return a.completionPct - b.completionPct;
    /* Tie-break: more issues first */
    return b.issueCount - a.issueCount;
  });

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ background: 'var(--p-bg)' }}
      data-testid="edit-section-dashboard"
    >
      <div className="max-w-[900px] mx-auto px-8 py-6">

        {/* ---- Compact summary strip: overall resume signals ----
         * Four compact data points in a single row so the user knows
         * the resume's current state before opening any section.
         */}
        <div
          className="rounded-lg mb-6 px-5 py-3.5 flex items-center gap-5 flex-wrap"
          style={{
            background: 'var(--p-surface)',
            border: '1px solid var(--p-border)',
          }}
          data-testid="dashboard-summary-strip"
        >
          {props.activeJob ? (
            <>
              {/* Match score */}
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--p-text-dim)' }}
                >
                  Match
                </span>
                <span
                  className="text-sm font-bold px-2 py-0.5 rounded"
                  style={{
                    color: scoreTierColor(props.matchScore),
                    background: 'color-mix(in srgb, ' + scoreTierColor(props.matchScore) + ' 12%, transparent)',
                  }}
                >
                  {props.matchScore}%
                </span>
              </div>

              {/* Readiness score — percentage-first with secondary band label.
               * The percentage is the primary signal; the label interprets it.
               * Uses 5-tier readinessTierColor for color consistency with
               * Career Readiness and other readiness surfaces. */}
              <div className="flex items-center gap-1.5">
                <span
                  className="text-sm font-bold px-2 py-0.5 rounded"
                  style={{
                    color: readinessTierColor(props.readinessScore),
                    background: 'color-mix(in srgb, ' + readinessTierColor(props.readinessScore) + ' 12%, transparent)',
                  }}
                >
                  {props.readinessScore}% Ready
                </span>
                <span
                  className="text-[10px] font-medium"
                  style={{ color: 'var(--p-text-muted)' }}
                >
                  {readinessBandLabel(props.readinessScore)}
                </span>
              </div>

              {/* Divider */}
              <div
                className="h-5 flex-shrink-0"
                style={{ width: '1px', background: 'var(--p-border)' }}
              />

              {/* Biggest blocker */}
              <div className="flex items-center gap-1.5">
                <AlertTriangle
                  className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: 'var(--p-danger, #ef4444)' }}
                />
                <span
                  className="text-xs font-medium truncate"
                  style={{ color: 'var(--p-text-muted)', maxWidth: '200px' }}
                >
                  {props.biggestBlocker}
                </span>
              </div>

              {/* Fastest win */}
              <div className="flex items-center gap-1.5">
                <Zap
                  className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: 'var(--p-success)' }}
                />
                <span
                  className="text-xs font-medium truncate"
                  style={{ color: 'var(--p-text-muted)', maxWidth: '200px' }}
                >
                  {props.fastestWin}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5" style={{ color: 'var(--p-text-dim)' }} />
              <span className="text-xs" style={{ color: 'var(--p-text-dim)' }}>
                Select a target job to see match and readiness scores
              </span>
            </div>
          )}
        </div>

        {/* ---- Section heading ---- */}
        <div className="mb-4">
          <h2
            className="text-sm font-semibold mb-0.5"
            style={{ color: 'var(--p-text)' }}
          >
            Sections
          </h2>
          <p
            className="text-[11px]"
            style={{ color: 'var(--p-text-dim)' }}
          >
            Ordered by priority — weakest sections first.
          </p>
        </div>

        {/* ---- Section card grid ----
         * Sorted by priority so the user sees the most impactful
         * sections at the top. 2-3 columns responsive.
         */}
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          }}
          role="list"
          aria-label="Resume sections"
        >
          {sortedSections.map(function (section) {
            return (
              <div key={section.id} role="listitem">
                <SectionDashboardCard
                  section={section}
                  onSelect={function () { props.onSectionSelect(section.id); }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Section Dropdown Menu — polished dropdown with hover states
// ---------------------------------------------------------------------------
//
// Extracted from the inline render to support both dashboard and focused
// mode. Includes:
//   - "Overview" option (returns to dashboard)
//   - All edit section groups with status badges
//   - Explicit hover tracking per item for responsive feedback
//   - focus-visible ring treatment
//   - Current section highlighted with accent bg + font weight
//

/**
 * Individual dropdown menu item with explicit hover tracking.
 * Matches the dropdown-option interaction-state standard:
 *   hover:  background shift to var(--p-surface2)
 *   focus-visible: ring-2 ring-accent inset
 *   selected: accent text + tinted bg + font-weight 600
 */
function SectionDropdownItem(props: {
  icon: typeof FileText;
  label: string;
  isCurrent: boolean;
  statusLabel: string | null;
  statusColor: string | null;
  onClick: () => void;
  testId: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const IconComponent = props.icon;

  /*
   * Layered background logic:
   *   Current item: accent tint (survives hover)
   *   Hovered item: surface2 (not current only)
   *   Default: transparent
   */
  let itemBg = 'transparent';
  if (props.isCurrent) {
    itemBg = 'color-mix(in srgb, var(--p-accent) 10%, transparent)';
  } else if (isHovered) {
    itemBg = 'var(--p-surface2)';
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); }}
      className="w-full text-left px-3 py-2 flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-inset transition-colors"
      style={Object.assign(
        {
          background: itemBg,
          color: props.isCurrent ? 'var(--p-accent)' : 'var(--p-text)',
        },
        { '--tw-ring-color': 'var(--p-accent)' } as unknown as React.CSSProperties
      )}
      role="option"
      aria-selected={props.isCurrent}
      data-testid={props.testId}
    >
      <IconComponent
        className="w-3.5 h-3.5 flex-shrink-0"
        style={{ color: props.isCurrent ? 'var(--p-accent)' : 'var(--p-text-dim)' }}
      />
      <span className={'text-xs flex-1 truncate' + (props.isCurrent ? ' font-semibold' : ' font-medium')}>
        {props.label}
      </span>
      {/* Status badge when available */}
      {props.statusLabel && props.statusColor && (
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{
            color: props.statusColor,
            background: 'color-mix(in srgb, ' + props.statusColor + ' 12%, transparent)',
          }}
        >
          {props.statusLabel}
        </span>
      )}
    </button>
  );
}

/**
 * Section dropdown menu panel — renders all Edit section groups
 * with an "Overview" option at the top. Used by the persistent
 * local Edit control row in both dashboard and focused states.
 */
function SectionDropdownMenu(props: {
  sections: SectionMeta[];
  activeSection: SectionId;
  editMode: EditMode;
  onSelectSection: (id: SectionId) => void;
  onSelectOverview: () => void;
}) {
  return (
    <div
      className="absolute top-full left-0 mt-1 py-1 rounded shadow-lg z-50"
      style={{
        background: 'var(--p-surface)',
        border: '1px solid var(--p-border)',
        minWidth: '240px',
      }}
      role="listbox"
      aria-label="Resume sections"
      data-testid="section-dropdown-menu"
    >
      {/* Overview option — always first, returns to dashboard */}
      <SectionDropdownItem
        icon={LayoutGrid}
        label="Overview"
        isCurrent={props.editMode === 'dashboard'}
        statusLabel={null}
        statusColor={null}
        onClick={props.onSelectOverview}
        testId="section-option-overview"
      />

      {/* Thin separator between Overview and sections */}
      <div
        className="my-1 mx-2"
        style={{ borderTop: '1px solid var(--p-border)' }}
      />

      {/* Section options */}
      {props.sections.map(function (section) {
        const isCurrent = section.id === props.activeSection && props.editMode === 'focused';
        /* Look up icon from EDIT_SECTION_GROUPS */
        let SectionIcon = FileText;
        for (let j = 0; j < EDIT_SECTION_GROUPS.length; j++) {
          if (EDIT_SECTION_GROUPS[j].id === section.id) {
            SectionIcon = EDIT_SECTION_GROUPS[j].icon;
            break;
          }
        }
        const sectionStatus = deriveSectionStatus(section);

        return (
          <SectionDropdownItem
            key={section.id}
            icon={SectionIcon}
            label={section.label}
            isCurrent={isCurrent}
            statusLabel={sectionStatus.label}
            statusColor={sectionStatus.color}
            onClick={function () { props.onSelectSection(section.id); }}
            testId={'section-option-' + section.id}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Live Score Anchor — compact persistent score module
// ---------------------------------------------------------------------------
//
// Replaces the noisy ContextStrip and the wider ResumeBrief with a single
// compact, persistent score area in the Edit workspace. Shows only the
// two most important scores (Match, Readiness) and one actionable cue.
// This keeps the workspace header calm while still anchoring the user's
// awareness of their resume quality.
//

/**
 * Compact live score anchor for the Edit workspace header.
 * Shows Match score, Readiness score, and one short actionable cue.
 * Updates live when edits are accepted/saved.
 */
function LiveScoreAnchor(props: {
  matchScore: number;
  readinessScore: number;
  biggestBlocker: string;
  fastestWin: string;
  activeJob: Job | null;
}) {
  /*
   * When no target job is selected, show a minimal prompt instead of
   * scores that would all be zero.
   */
  if (!props.activeJob) {
    return (
      <div
        className="px-6 py-2 flex items-center gap-2 flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--p-border)',
          background: 'var(--p-surface)',
        }}
        data-testid="live-score-anchor"
      >
        <Target className="w-3.5 h-3.5" style={{ color: 'var(--p-text-dim)' }} />
        <span className="text-xs" style={{ color: 'var(--p-text-dim)' }}>
          Select a target job to see match and readiness scores
        </span>
      </div>
    );
  }

  return (
    <div
      className="px-6 py-2 flex items-center gap-4 flex-wrap flex-shrink-0"
      style={{
        borderBottom: '1px solid var(--p-border)',
        background: 'var(--p-surface)',
      }}
      data-testid="live-score-anchor"
    >
      {/* Match score chip */}
      <div className="flex items-center gap-1.5">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--p-text-dim)' }}
        >
          Match
        </span>
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded"
          style={{
            color: scoreTierColor(props.matchScore),
            background: 'color-mix(in srgb, ' + scoreTierColor(props.matchScore) + ' 12%, transparent)',
          }}
        >
          {props.matchScore}%
        </span>
      </div>

      {/* Readiness score chip — percentage-first with secondary band label.
       * Uses 5-tier readinessTierColor for consistent readiness coloring. */}
      <div className="flex items-center gap-1.5">
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded"
          style={{
            color: readinessTierColor(props.readinessScore),
            background: 'color-mix(in srgb, ' + readinessTierColor(props.readinessScore) + ' 12%, transparent)',
          }}
        >
          {props.readinessScore}% Ready
        </span>
        <span
          className="text-[10px] font-medium"
          style={{ color: 'var(--p-text-muted)' }}
        >
          {readinessBandLabel(props.readinessScore)}
        </span>
      </div>

      {/* Divider */}
      <span style={{ color: 'var(--p-border)' }}>|</span>

      {/* Single actionable cue — biggest blocker or fastest win */}
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--p-danger, #ef4444)' }} />
        <span
          className="text-[11px] font-medium truncate"
          style={{ color: 'var(--p-text-muted)', maxWidth: '320px' }}
        >
          Biggest blocker: {props.biggestBlocker}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Tab bar — primary workspace mode switcher + overall score
// ---------------------------------------------------------------------------
//
// The tab row is the primary mode-switching surface for the Resume Builder.
// It uses a grouped / segmented-control visual treatment: tabs sit inside
// a subtle bordered container with stronger hit areas (px-4 py-2.5) and
// an accent bottom-bar for the active tab. Hover uses explicit useState
// tracking with an underline-hint pattern, consistent with the mode-switch
// interaction-state standard (not INTERACTIVE_HOVER_CLASS, which applies
// background-fill hover that conflicts with underline tab semantics).
//
// At the far end of the row, a compact overall score module shows the
// resume-level Match and Readiness scores. This replaces the need for
// a separate full-width status strip below the tabs.
//

/**
 * Individual tab button with explicit hover tracking for underline-hint
 * feedback, per the mode-switch interaction-state standard.
 */
function WorkspaceModeTabButton(props: {
  tab: { id: WorkspaceTab; label: string; badge?: number };
  isActive: boolean;
  badgeCount: number;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  /*
   * Visual styles:
   *   Active:  accent text, 2px accent bottom bar, faint accent bg tint
   *   Hovered: text brightens, faint underline hint appears
   *   Default: muted text, no decoration
   * Active must survive hover without regression.
   */
  let textColor = 'var(--p-text-muted)';
  let bottomBorder = '2px solid transparent';
  let bgTint = 'transparent';

  if (props.isActive) {
    textColor = 'var(--p-accent)';
    bottomBorder = '2px solid var(--p-accent)';
    bgTint = 'color-mix(in srgb, var(--p-accent) 6%, transparent)';
  } else if (isHovered) {
    textColor = 'var(--p-text)';
    bottomBorder = '2px solid var(--p-text-dim)';
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      onMouseEnter={function () { setIsHovered(true); }}
      onMouseLeave={function () { setIsHovered(false); }}
      className="px-4 py-2.5 text-xs font-medium transition-colors relative outline-none focus-visible:ring-2 focus-visible:ring-inset"
      style={Object.assign(
        {
          color: textColor,
          borderBottom: bottomBorder,
          background: bgTint,
        },
        { '--tw-ring-color': 'var(--p-accent)' } as unknown as React.CSSProperties
      )}
      role="tab"
      aria-selected={props.isActive}
      aria-controls={'resume-tabpanel-' + props.tab.id}
      id={'resume-tab-' + props.tab.id}
      data-testid={'resume-tab-' + props.tab.id}
    >
      {props.tab.label}
      {props.badgeCount > 0 && (
        <span
          className="ml-1.5 inline-flex items-center justify-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{
            background: 'color-mix(in srgb, var(--p-warning, #eab308) 20%, transparent)',
            color: 'var(--p-warning, #eab308)',
          }}
        >
          {props.badgeCount}
        </span>
      )}
    </button>
  );
}

/**
 * Workspace mode tab bar with grouped/segmented treatment and inline
 * overall score module. The score module sits at the far-right end of
 * the tab row so the user always sees resume-level scores without a
 * separate strip.
 */
function TabBar(props: {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  proposalCount: number;
  matchScore: number;
  readinessScore: number;
  activeJob: Job | null;
}) {
  return (
    <div
      className="flex items-center flex-shrink-0"
      style={{
        borderBottom: '1px solid var(--p-border)',
        background: 'var(--p-surface)',
      }}
      data-testid="resume-builder-tabs"
    >
      {/* Grouped tab buttons — segmented inside a shared row */}
      <div
        className="flex items-center"
        role="tablist"
        aria-label="Resume Builder views"
      >
        {WORKSPACE_TABS.map(function (tab) {
          const isActive = tab.id === props.activeTab;
          const badgeCount = tab.id === 'suggested-changes' ? props.proposalCount : (tab.badge || 0);

          return (
            <WorkspaceModeTabButton
              key={tab.id}
              tab={tab}
              isActive={isActive}
              badgeCount={badgeCount}
              onClick={function () { props.onTabChange(tab.id); }}
            />
          );
        })}
      </div>

      {/* Spacer pushes score module to far right */}
      <div className="flex-1" />

      {/* Overall resume score module — compact persistent anchor */}
      <div
        className="flex items-center gap-3 px-4 flex-shrink-0"
        data-testid="overall-score-module"
      >
        {props.activeJob ? (
          <>
            {/* Match score chip */}
            <div className="flex items-center gap-1">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--p-text-dim)' }}
              >
                Match
              </span>
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{
                  color: scoreTierColor(props.matchScore),
                  background: 'color-mix(in srgb, ' + scoreTierColor(props.matchScore) + ' 12%, transparent)',
                }}
              >
                {props.matchScore}%
              </span>
            </div>
            {/* Readiness score chip — percentage-first display with
             * 5-tier color and secondary band label. */}
            <div className="flex items-center gap-1">
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{
                  color: readinessTierColor(props.readinessScore),
                  background: 'color-mix(in srgb, ' + readinessTierColor(props.readinessScore) + ' 12%, transparent)',
                }}
              >
                {props.readinessScore}%
              </span>
              <span
                className="text-[10px] font-medium"
                style={{ color: 'var(--p-text-muted)' }}
              >
                {readinessBandLabel(props.readinessScore)}
              </span>
            </div>
          </>
        ) : (
          <span
            className="text-[11px]"
            style={{ color: 'var(--p-text-dim)' }}
          >
            No target job
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Intelligence strip (compact job-aware metrics)
// ---------------------------------------------------------------------------

/**
 * Intelligence strip removed in Phase 3 UX compression.
 * Replaced by the calmer ResumeBrief component which provides
 * the same signals (readiness, match, blocker, win, proposals)
 * in a more scannable, less dense format.
 *
 * IntelligenceStrip is kept as a thin shim that delegates to
 * ResumeBrief so existing render call sites do not need to change
 * until a full cleanup pass is done.
 */
function IntelligenceStrip(props: {
  activeJob: Job | null;
  matchScore: number;
  readinessScore: number;
  topGap: string;
  proposalCount: number;
  fastestWin?: string;
}) {
  /*
   * Derive the "fastest win" label from available props. When the
   * caller doesn't supply one, fall back to a generic suggestion
   * built from the topGap value.
   */
  const winLabel = props.fastestWin
    ? props.fastestWin
    : (props.activeJob ? 'Fix: ' + props.topGap : 'Select a target job');

  return (
    <ResumeBrief
      readinessScore={props.readinessScore}
      matchScore={props.matchScore}
      biggestBlocker={props.topGap}
      fastestWin={winLabel}
      pendingProposalCount={props.proposalCount}
      activeJob={props.activeJob}
    />
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Section editor header — active section context bar
// ---------------------------------------------------------------------------
//
// Shown at the top of the center editing surface when a section is
// selected. Provides clear identification of what section is open for
// focused editing. Includes the section icon, label, and key metadata
// (completion, issues, relevance) so the user always knows their context.
//

/**
 * Section editor header — inline element identifying the active section.
 *
 * Renders as an inline flex row (no outer container/border) so it can
 * sit inside the focused-editor breadcrumb bar. Shows the section icon,
 * label, and compact metadata (completion, issues, relevance).
 */
function SectionEditorHeader(props: {
  sectionId: SectionId;
  sectionMeta: SectionMeta | null;
}) {
  /* Look up the section definition for icon and full label. */
  let sectionDef = SECTION_DEFS[0];
  for (let i = 0; i < SECTION_DEFS.length; i++) {
    if (SECTION_DEFS[i].id === props.sectionId) {
      sectionDef = SECTION_DEFS[i];
      break;
    }
  }
  const IconComponent = sectionDef.icon;

  /* Extract metadata values with explicit null checks (no ?. operator). */
  const completionPct = props.sectionMeta ? props.sectionMeta.completionPct : 0;
  const issueCount = props.sectionMeta ? props.sectionMeta.issueCount : 0;
  const relevancePct = props.sectionMeta ? props.sectionMeta.relevancePct : 0;

  return (
    <div
      className="flex items-center gap-2.5 flex-1"
      data-testid="section-editor-header"
    >
      <IconComponent
        className="w-4.5 h-4.5 flex-shrink-0"
        style={{ color: 'var(--p-accent)' }}
      />
      <div className="flex-1 min-w-0">
        <h2
          className="text-sm font-semibold truncate"
          style={{ color: 'var(--p-text)' }}
        >
          {sectionDef.label}
        </h2>
      </div>
      {/* Compact metadata chips — inline with the section name */}
      {props.sectionMeta && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
            {completionPct}%
          </span>
          {issueCount > 0 && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                color: 'var(--p-danger, #ef4444)',
                background: 'color-mix(in srgb, var(--p-danger, #ef4444) 12%, transparent)',
              }}
            >
              {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
            </span>
          )}
          {relevancePct > 0 && (
            <span className="text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
              {relevancePct}% relevant
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Resume Brief — compact summary-first layer
// ---------------------------------------------------------------------------
//
// Replaces the cognitive load of scanning multiple panels by surfacing the
// five most important resume signals in a single calm strip. Designed to
// be readable in 3 seconds. Appears at the top of the Edit tab content
// and optionally above other tabs. All values are derived from the same
// proposal/coverage state the rest of the workspace uses.
//

/**
 * Resume Brief props. All values are pre-computed by the parent to keep
 * this component pure and testable.
 */
interface ResumeBriefProps {
  readinessScore: number;
  matchScore: number;
  biggestBlocker: string;
  fastestWin: string;
  pendingProposalCount: number;
  activeJob: Job | null;
}

/**
 * Compact summary strip that prioritizes the user's next move.
 * Renders five key signals as small inline chips/labels so the user
 * can understand where they stand without scrolling or reading panels.
 */
function ResumeBrief(props: ResumeBriefProps) {
  if (!props.activeJob) {
    return (
      <div
        className="px-4 py-2.5 flex items-center gap-3 flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--p-border)',
          background: 'var(--p-surface2)',
        }}
        data-testid="resume-brief"
      >
        <Target className="w-4 h-4" style={{ color: 'var(--p-text-dim)' }} />
        <span className="text-xs" style={{ color: 'var(--p-text-dim)' }}>
          Select a target job to see your resume brief
        </span>
      </div>
    );
  }

  return (
    <div
      className="px-4 py-2 flex items-center gap-4 flex-wrap flex-shrink-0"
      style={{
        borderBottom: '1px solid var(--p-border)',
        background: 'var(--p-surface2)',
      }}
      data-testid="resume-brief"
    >
      {/* Readiness chip — percentage-first with secondary band label.
       * Readiness is NOT completion. Completion = are fields present?
       * Readiness = how submission-ready is the overall resume?
       * The percentage is the primary signal; the band label interprets it. */}
      <div className="flex items-center gap-1.5">
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded"
          style={{
            color: readinessTierColor(props.readinessScore),
            background: 'color-mix(in srgb, ' + readinessTierColor(props.readinessScore) + ' 12%, transparent)',
          }}
        >
          {props.readinessScore}% Ready
        </span>
        <span
          className="text-[10px] font-medium"
          style={{ color: 'var(--p-text-muted)' }}
        >
          {readinessBandLabel(props.readinessScore)}
        </span>
      </div>

      {/* Match chip */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--p-text-dim)' }}>
          Match
        </span>
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded"
          style={{
            color: scoreTierColor(props.matchScore),
            background: 'color-mix(in srgb, ' + scoreTierColor(props.matchScore) + ' 12%, transparent)',
          }}
        >
          {props.matchScore}%
        </span>
      </div>

      <span style={{ color: 'var(--p-border)' }}>|</span>

      {/* Biggest blocker — one-line label */}
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3" style={{ color: 'var(--p-danger, #ef4444)' }} />
        <span className="text-[11px] font-medium" style={{ color: 'var(--p-text-muted)' }}>
          {props.biggestBlocker}
        </span>
      </div>

      <span style={{ color: 'var(--p-border)' }}>|</span>

      {/* Fastest win — one-line action cue */}
      <div className="flex items-center gap-1.5">
        <TrendingUp className="w-3 h-3" style={{ color: 'var(--p-success)' }} />
        <span className="text-[11px] font-medium" style={{ color: 'var(--p-text-muted)' }}>
          {props.fastestWin}
        </span>
      </div>

      {/* Pending proposal count — end-aligned badge */}
      {props.pendingProposalCount > 0 && (
        <span
          className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{
            background: 'color-mix(in srgb, var(--p-warning, #eab308) 15%, transparent)',
            color: 'var(--p-warning, #eab308)',
          }}
        >
          {props.pendingProposalCount} pending
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Inline suggested rewrite card
// ---------------------------------------------------------------------------

/**
 * Inline suggestion card that appears directly below a weak bullet when
 * the user triggers a rewrite. Shows the revised text, quality badges,
 * explanation, and support cue.
 *
 * Critical behavior:
 *   Accept:     applies the suggestion to the active resume version
 *   Edit First: loads the suggestion into editable state without finalizing
 *   Dismiss:    closes the card without applying
 *
 * Also includes a subtle cue about broader proposals in Suggested Changes.
 */
function InlineRewriteCard(props: {
  suggestion: InlineSuggestionDef;
  onAccept: () => void;
  onEditFirst: () => void;
  onDismiss: () => void;
  broaderProposalCount: number;
}) {
  return (
    <div
      className="mx-4 mb-3 rounded-lg overflow-hidden"
      style={{
        border: '1px solid var(--p-warning, #eab308)',
        background: 'color-mix(in srgb, var(--p-warning, #eab308) 5%, var(--p-surface))',
      }}
      data-testid="inline-rewrite-card"
    >
      {/* Header with quality badges */}
      <div
        className="px-3 py-2 flex items-center gap-2 flex-wrap"
        style={{ borderBottom: '1px solid color-mix(in srgb, var(--p-warning, #eab308) 20%, transparent)' }}
      >
        <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--p-warning, #eab308)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--p-warning, #eab308)' }}>
          Suggested rewrite
        </span>
        {/* Quality badges */}
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
          background: 'color-mix(in srgb, var(--p-success) 12%, transparent)',
          color: 'var(--p-success)',
        }}>
          Adds facts, context
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
          background: 'color-mix(in srgb, var(--p-success) 12%, transparent)',
          color: 'var(--p-success)',
        }}>
          span five scope
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
          background: 'color-mix(in srgb, var(--p-success) 12%, transparent)',
          color: 'var(--p-success)',
        }}>
          shows leadership in depth
        </span>
      </div>

      {/* Revised text */}
      <div className="px-3 py-2.5">
        <p className="text-xs leading-relaxed" style={{ color: 'var(--p-text)' }}>
          {props.suggestion.revisedText}
        </p>
        {/* Support cue */}
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--p-text-dim)' }}>
          {props.suggestion.supportCue}
        </p>
      </div>

      {/* Actions */}
      <div
        className="px-3 py-2 flex items-center gap-2"
        style={{ borderTop: '1px solid color-mix(in srgb, var(--p-warning, #eab308) 20%, transparent)' }}
      >
        <button
          type="button"
          onClick={props.onAccept}
          className={'px-3 py-1.5 text-xs font-semibold rounded ' + INTERACTIVE_HOVER_CLASS}
          style={{
            background: 'var(--p-success)',
            color: 'var(--p-bg)',
            border: 'none',
          }}
          data-testid="suggestion-accept"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={props.onEditFirst}
          className={'px-3 py-1.5 text-xs font-medium rounded ' + INTERACTIVE_HOVER_CLASS}
          style={{
            background: 'transparent',
            color: 'var(--p-text)',
            border: '1px solid var(--p-border)',
          }}
          data-testid="suggestion-edit-first"
        >
          Edit First
        </button>
        <button
          type="button"
          onClick={props.onDismiss}
          className={'px-3 py-1.5 text-xs font-medium rounded ' + INTERACTIVE_HOVER_CLASS}
          style={{
            background: 'transparent',
            color: 'var(--p-text-muted)',
            border: '1px solid var(--p-border)',
          }}
          data-testid="suggestion-dismiss"
        >
          Dismiss
        </button>

        {/* Broader proposals cue */}
        {props.broaderProposalCount > 0 && (
          <span className="ml-auto text-[10px]" style={{ color: 'var(--p-text-dim)' }}>
            {props.broaderProposalCount} more fixes in Suggested Changes
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: BulletRow — single editable bullet with health indicator
// ---------------------------------------------------------------------------

/**
 * Single bullet in a work experience block. Shows:
 * - colored health indicator dot
 * - bullet text (view mode or edit mode)
 * - health label for non-strong bullets
 * - inline action buttons (Rewrite, Expand, Federalize, Match to Job)
 *
 * When editingBulletId matches this bullet, the text appears in a textarea.
 * When activeSuggestionBulletId matches, the inline rewrite card appears below.
 */
/**
 * Single bullet row in a work experience entry.
 *
 * Renders differently depending on the view/edit-ready mode:
 *
 * View mode (sectionEditReady = false):
 *   - Clean, document-like bullet text without health dots or badges
 *   - Reads like a real resume bullet point
 *   - No inline action buttons visible
 *   - Text is not clickable (no cursor-text)
 *
 * Edit-ready mode (sectionEditReady = true):
 *   - Health indicator dot appears for non-strong bullets
 *   - Health badge appears for weak/generic bullets
 *   - Inline action buttons are visible
 *   - Text is clickable to enter editing
 *   - Subtle background tint signals editable state
 *
 * Active editing state (isEditing = true):
 *   - Always shows the textarea regardless of edit-ready mode
 */
function BulletRow(props: {
  bullet: ResumeBulletVM;
  experienceId: string;
  isEditing: boolean;
  editText: string;
  onEditStart: () => void;
  onEditChange: (text: string) => void;
  onEditSave: () => void;
  onRewrite: () => void;
  showActions: boolean;
  autonomyMode: AutonomyMode;
  sectionEditReady: boolean;
}) {
  const healthColor = BULLET_HEALTH_COLORS[props.bullet.health];
  const healthLabel = BULLET_HEALTH_LABELS[props.bullet.health];
  const isWeak = props.bullet.health === 'weak';
  const isGeneric = props.bullet.health === 'generic';
  const showHealthBadge = props.sectionEditReady && (isWeak || isGeneric || props.bullet.health === 'needs-evidence');

  /* In edit-ready mode, show actions for ALL bullets (not just weak ones).
   * In view mode, never show actions — the resume slice should read clean. */
  const showInlineActions = props.sectionEditReady && !props.isEditing;

  return (
    <div
      className="group flex items-start gap-2 py-1.5 px-1 rounded transition-colors"
      style={{
        background: props.sectionEditReady && isWeak
          ? 'color-mix(in srgb, var(--p-danger, #ef4444) 5%, transparent)'
          : 'transparent',
      }}
      data-testid={'bullet-row-' + props.bullet.id}
    >
      {/* Health indicator dot — only visible in edit-ready mode */}
      {props.sectionEditReady && (
        <span
          className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
          style={{ background: healthColor }}
          aria-label={healthLabel + ' bullet'}
        />
      )}

      {/* Bullet content */}
      <div className="flex-1 min-w-0">
        {props.isEditing ? (
          /* Active editing: textarea with accent border */
          <textarea
            value={props.editText}
            onChange={function (e: React.ChangeEvent<HTMLTextAreaElement>) {
              props.onEditChange(e.target.value);
            }}
            onBlur={props.onEditSave}
            onKeyDown={function (e: React.KeyboardEvent<HTMLTextAreaElement>) {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                props.onEditSave();
              }
              if (e.key === 'Escape') {
                props.onEditSave();
              }
            }}
            className="w-full text-sm leading-relaxed px-2 py-1.5 rounded resize-y outline-none"
            style={{
              background: 'var(--p-surface2)',
              border: '1px solid var(--p-accent)',
              color: 'var(--p-text)',
              minHeight: '60px',
            }}
            autoFocus
            aria-label="Edit bullet text"
          />
        ) : (
          /* Read state — mode-dependent presentation */
          <div className="flex items-start gap-2">
            <p
              className={'text-sm leading-relaxed flex-1' + (props.sectionEditReady ? ' cursor-text' : '')}
              style={{ color: 'var(--p-text)' }}
              onClick={props.sectionEditReady ? props.onEditStart : undefined}
              role={props.sectionEditReady ? 'button' : undefined}
              tabIndex={props.sectionEditReady ? 0 : undefined}
              onKeyDown={props.sectionEditReady ? function (e: React.KeyboardEvent<HTMLParagraphElement>) {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  props.onEditStart();
                }
              } : undefined}
              aria-label={props.sectionEditReady ? 'Edit bullet: ' + props.bullet.text.slice(0, 40) : undefined}
            >
              {'• ' + props.bullet.text}
            </p>
            {/* Health badge — only visible in edit-ready mode for non-strong bullets */}
            {showHealthBadge && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                style={{
                  background: 'color-mix(in srgb, ' + healthColor + ' 15%, transparent)',
                  color: healthColor,
                }}
              >
                {healthLabel}
              </span>
            )}
          </div>
        )}

        {/* Inline actions — visible in edit-ready mode for all bullets.
         * Rewrite is emphasized for weak/generic bullets but available
         * for all bullets when the section is in edit-ready mode. */}
        {showInlineActions && (
          <div className="flex items-center gap-1.5 mt-1">
            {props.autonomyMode === 'assisted' && (
              <button
                type="button"
                onClick={props.onRewrite}
                className={'flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded ' + INTERACTIVE_HOVER_CLASS}
                style={{
                  background: isWeak
                    ? 'color-mix(in srgb, var(--p-warning, #eab308) 15%, transparent)'
                    : 'transparent',
                  color: isWeak ? 'var(--p-warning, #eab308)' : 'var(--p-text-dim)',
                  border: '1px solid var(--p-border)',
                }}
                data-testid={'bullet-rewrite-' + props.bullet.id}
              >
                <Sparkles className="w-3 h-3" />
                Rewrite
              </button>
            )}
            <button
              type="button"
              className={'flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded ' + INTERACTIVE_HOVER_CLASS}
              style={{ color: 'var(--p-text-dim)', border: '1px solid var(--p-border)', background: 'transparent' }}
            >
              Expand
            </button>
            <button
              type="button"
              className={'flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded ' + INTERACTIVE_HOVER_CLASS}
              style={{ color: 'var(--p-text-dim)', border: '1px solid var(--p-border)', background: 'transparent' }}
            >
              Add federal detail
            </button>
            <button
              type="button"
              className={'flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded ' + INTERACTIVE_HOVER_CLASS}
              style={{ color: 'var(--p-text-dim)', border: '1px solid var(--p-border)', background: 'transparent' }}
            >
              Match to job
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Experience block — single work experience entry
// ---------------------------------------------------------------------------

/**
 * One experience entry in the resume canvas.
 *
 * Formatted to match how a real federal resume work entry looks:
 * - Job title (bold) with grade inline
 * - Employer on a separate line
 * - Location, dates, hours on a detail line
 * - Bullets underneath in a structured list
 *
 * In view mode (sectionEditReady = false):
 *   - Clean, document-like presentation with no editing affordances
 *   - The pencil icon is hidden
 *   - "Add bullet" button is hidden
 *   - Reads like a polished resume entry
 *
 * In edit-ready mode (sectionEditReady = true):
 *   - Pencil icon is visible and functional
 *   - Bullets show health indicators and inline actions
 *   - "Add bullet" button appears
 *   - Experience header gets a subtle editable highlight
 */
function ExperienceBlock(props: {
  experience: ResumeExperience;
  bullets: ResumeBulletVM[];
  editingBulletId: string | null;
  editingBulletText: string;
  activeSuggestionBulletId: string | null;
  activeSuggestion: InlineSuggestionDef | null;
  autonomyMode: AutonomyMode;
  proposalCount: number;
  sectionEditReady: boolean;
  onBulletEditStart: (bulletId: string, text: string) => void;
  onBulletEditChange: (text: string) => void;
  onBulletEditSave: () => void;
  onBulletRewrite: (bulletId: string) => void;
  onSuggestionAccept: () => void;
  onSuggestionEditFirst: () => void;
  onSuggestionDismiss: () => void;
  onAddBullet: (experienceId: string) => void;
}) {
  const exp = props.experience;

  return (
    <div
      className="mb-6 pb-4"
      style={{ borderBottom: '1px solid var(--p-border)' }}
      data-testid={'experience-block-' + exp.id}
    >
      {/* Experience header — resume-style job title block.
       * In edit-ready mode, the header gets a subtle tint and the
       * pencil icon becomes visible/functional. */}
      <div
        className="flex items-start justify-between mb-2 rounded px-2 py-1.5 transition-colors"
        style={{
          background: props.sectionEditReady
            ? 'color-mix(in srgb, var(--p-accent) 3%, transparent)'
            : 'transparent',
          marginLeft: '-0.5rem',
          marginRight: '-0.5rem',
        }}
      >
        <div>
          {/* Job title — bold, prominent, with optional grade */}
          <h4 className="text-sm font-bold" style={{ color: 'var(--p-text)' }}>
            {exp.jobTitle}
            {exp.grade ? (
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--p-text-dim)' }}>
                {'(' + exp.grade + ')'}
              </span>
            ) : null}
          </h4>
          {/* Employer name */}
          <p className="text-sm mt-0.5" style={{ color: 'var(--p-text-muted)' }}>
            {exp.employer}
          </p>
          {/* Location, dates, hours — detail line */}
          <p className="text-xs mt-0.5" style={{ color: 'var(--p-text-dim)' }}>
            {exp.location + '  ·  ' + exp.startDate + ' – ' + exp.endDate + '  ·  ' + exp.hoursPerWeek + ' hours/week'}
          </p>
        </div>
        {/* Pencil icon — only visible in edit-ready mode */}
        {props.sectionEditReady && (
          <button
            type="button"
            className={'p-1.5 rounded flex-shrink-0 ' + INTERACTIVE_HOVER_CLASS}
            style={{ color: 'var(--p-accent)' }}
            aria-label={'Edit ' + exp.jobTitle + ' details'}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Bullets — resume-like list of accomplishment statements */}
      <div className="mt-3 space-y-0.5">
        {props.bullets.map(function (bullet) {
          const isEditing = props.editingBulletId === bullet.id;
          const showSuggestion = props.activeSuggestionBulletId === bullet.id && props.activeSuggestion !== null;
          const isWeak = bullet.health === 'weak' || bullet.health === 'generic' || bullet.health === 'needs-evidence';

          return (
            <div key={bullet.id}>
              <BulletRow
                bullet={bullet}
                experienceId={exp.id}
                isEditing={isEditing}
                editText={isEditing ? props.editingBulletText : ''}
                onEditStart={function () { props.onBulletEditStart(bullet.id, bullet.text); }}
                onEditChange={props.onBulletEditChange}
                onEditSave={props.onBulletEditSave}
                onRewrite={function () { props.onBulletRewrite(bullet.id); }}
                showActions={isWeak}
                autonomyMode={props.autonomyMode}
                sectionEditReady={props.sectionEditReady}
              />
              {/* Inline rewrite card (appears below the bullet) */}
              {showSuggestion && props.activeSuggestion !== null && (
                <InlineRewriteCard
                  suggestion={props.activeSuggestion}
                  onAccept={props.onSuggestionAccept}
                  onEditFirst={props.onSuggestionEditFirst}
                  onDismiss={props.onSuggestionDismiss}
                  broaderProposalCount={props.proposalCount}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Add bullet button — only visible in edit-ready mode */}
      {props.sectionEditReady && (
        <button
          type="button"
          onClick={function () { props.onAddBullet(exp.id); }}
          className={'flex items-center gap-1 mt-3 px-2 py-1 text-[11px] rounded ' + INTERACTIVE_HOVER_CLASS}
          style={{
            color: 'var(--p-text-dim)',
            border: '1px dashed var(--p-border)',
            background: 'transparent',
          }}
        >
          <Plus className="w-3 h-3" />
          Add bullet
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Professional summary (missing state + filled state)
// ---------------------------------------------------------------------------

/**
 * Professional summary section on the resume canvas. When empty, shows a
 * high-impact missing state with trust-first, job-aware messaging. When
 * filled, shows the summary text with edit capability.
 *
 * In edit-ready mode, the filled summary text gets a subtle highlight
 * border and background tint to signal that clicking will open the
 * editor. In view mode, the text reads like a polished resume paragraph.
 */
function ProfessionalSummaryBlock(props: {
  summary: string;
  onEdit: (text: string) => void;
  isEditing: boolean;
  editText: string;
  onEditStart: () => void;
  onEditChange: (text: string) => void;
  onEditSave: () => void;
  sectionEditReady: boolean;
}) {
  const isEmpty = !props.summary || !props.summary.trim();

  return (
    <div className="mb-4" data-testid="professional-summary-block">
      {/* Section heading — uses resume-style uppercase label */}
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-xs font-bold uppercase tracking-wider"
          style={{
            color: 'var(--p-text)',
            letterSpacing: '0.08em',
          }}
        >
          Professional Summary
        </h3>
        {isEmpty && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              background: 'color-mix(in srgb, var(--p-danger, #ef4444) 15%, transparent)',
              color: 'var(--p-danger, #ef4444)',
            }}
          >
            Missing
          </span>
        )}
      </div>

      {isEmpty ? (
        /* Missing state — high-impact, trust-first messaging.
         * Sits within the resume-slice document structure so even
         * the placeholder feels like part of the resume layout. */
        <div
          className="flex flex-col items-center justify-center py-8 rounded-lg cursor-pointer transition-colors"
          style={{
            border: '1px dashed var(--p-border)',
            background: 'color-mix(in srgb, var(--p-surface2) 50%, transparent)',
          }}
          onClick={props.onEditStart}
          role="button"
          tabIndex={0}
          onKeyDown={function (e: React.KeyboardEvent<HTMLDivElement>) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              props.onEditStart();
            }
          }}
          aria-label="Add professional summary"
          data-testid="summary-missing-state"
        >
          <Plus className="w-5 h-5 mb-2" style={{ color: 'var(--p-text-dim)' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--p-text-muted)' }}>
            Add professional summary
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--p-text-dim)' }}>
            High impact · Ask PathAdvisor why
          </p>
        </div>
      ) : props.isEditing ? (
        /* Active editing state — textarea with accent border */
        <textarea
          value={props.editText}
          onChange={function (e: React.ChangeEvent<HTMLTextAreaElement>) {
            props.onEditChange(e.target.value);
          }}
          onBlur={props.onEditSave}
          className="w-full text-sm leading-relaxed px-3 py-2.5 rounded resize-y outline-none"
          style={{
            background: 'var(--p-surface2)',
            border: '1px solid var(--p-accent)',
            color: 'var(--p-text)',
            minHeight: '80px',
          }}
          autoFocus
          aria-label="Edit professional summary"
        />
      ) : (
        /* Filled state — reads like a real resume paragraph.
         * In edit-ready mode, adds a subtle border and tint so the
         * user can see that clicking will activate the editor.
         * In view mode, the paragraph is clean and unadorned. */
        <p
          className="text-sm leading-relaxed rounded px-2 py-2 transition-all"
          style={{
            color: 'var(--p-text-muted)',
            cursor: props.sectionEditReady ? 'text' : 'default',
            border: props.sectionEditReady
              ? '1px dashed var(--p-accent-muted, var(--p-border))'
              : '1px solid transparent',
            background: props.sectionEditReady
              ? 'color-mix(in srgb, var(--p-accent) 3%, transparent)'
              : 'transparent',
          }}
          onClick={props.sectionEditReady ? props.onEditStart : undefined}
          role={props.sectionEditReady ? 'button' : undefined}
          tabIndex={props.sectionEditReady ? 0 : undefined}
          onKeyDown={props.sectionEditReady ? function (e: React.KeyboardEvent<HTMLParagraphElement>) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              props.onEditStart();
            }
          } : undefined}
          aria-label={props.sectionEditReady ? 'Edit professional summary' : undefined}
        >
          {props.summary}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Contact header on the resume canvas
// ---------------------------------------------------------------------------

/**
 * Top of the resume canvas showing the applicant's name, location,
 * phone, and email in a structured contact block.
 *
 * Designed to match how a real federal resume header looks:
 * - Name in prominent uppercase tracking
 * - Contact details in a clean, emoji-free line below
 * - Citizenship and veteran status on a third line (federal-specific)
 * - Subtle bottom border to separate from the summary section
 *
 * When sectionEditReady is true, the contact block shows a faint
 * editable highlight to signal that fields can be modified.
 */
function ContactHeader(props: { draft: ResumeDraft; sectionEditReady: boolean }) {
  const c = props.draft.contact;
  const name = c.fullName || 'Your Name';
  const location = (c.city && c.state) ? c.city + ', ' + c.state : '';
  const phone = c.phone || '';
  const email = c.email || '';
  const citizenship = c.citizenship || '';
  const veteranStatus = c.veteranStatus || '';

  return (
    <div
      className="text-center mb-4 pb-4 rounded transition-colors"
      style={{
        borderBottom: '2px solid var(--p-border)',
        background: props.sectionEditReady
          ? 'color-mix(in srgb, var(--p-accent) 3%, transparent)'
          : 'transparent',
        padding: props.sectionEditReady ? '1rem' : '0',
      }}
    >
      {/* Applicant name — prominent, resume-style uppercase */}
      <h2
        className="text-lg font-bold tracking-widest"
        style={{ color: 'var(--p-text)', letterSpacing: '0.12em' }}
      >
        {name.toUpperCase()}
      </h2>

      {/* Primary contact line — location, phone, email separated by pipes */}
      <div
        className="flex items-center justify-center gap-2 mt-2 text-xs"
        style={{ color: 'var(--p-text-muted)' }}
      >
        {location && (
          <span>{location}</span>
        )}
        {location && phone && (
          <span style={{ color: 'var(--p-text-dim)' }}>|</span>
        )}
        {phone && (
          <span>{phone}</span>
        )}
        {(location || phone) && email && (
          <span style={{ color: 'var(--p-text-dim)' }}>|</span>
        )}
        {email && (
          <span>{email}</span>
        )}
      </div>

      {/* Federal-specific line — citizenship and veteran status */}
      {(citizenship || veteranStatus) && (
        <div
          className="flex items-center justify-center gap-2 mt-1 text-[11px]"
          style={{ color: 'var(--p-text-dim)' }}
        >
          {citizenship && (
            <span>{'Citizenship: ' + citizenship}</span>
          )}
          {citizenship && veteranStatus && (
            <span>|</span>
          )}
          {veteranStatus && (
            <span>{'Veteran Status: ' + veteranStatus}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Education section on the canvas
// ---------------------------------------------------------------------------

/**
 * Education section formatted like a real resume education block.
 *
 * Each entry shows degree + field on one line, institution on the next,
 * and graduation date with optional GPA on a third line. This mirrors
 * the typographic rhythm of a professional federal resume.
 *
 * In edit-ready mode, each education entry gets a subtle editable
 * highlight to signal that fields can be modified.
 */
function EducationSection(props: { draft: ResumeDraft; sectionEditReady: boolean }) {
  if (props.draft.education.length === 0) return null;

  return (
    <div className="mb-4" data-testid="education-section">
      {/* Section heading — resume-style uppercase label */}
      <div
        className="flex items-center justify-between mb-4 pb-2"
        style={{ borderBottom: '1px solid var(--p-border)' }}
      >
        <h3
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--p-text)', letterSpacing: '0.08em' }}
        >
          Education
        </h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
          background: 'color-mix(in srgb, var(--p-success) 12%, transparent)',
          color: 'var(--p-success)',
        }}>
          Complete
        </span>
      </div>

      {/* Education entries — structured like a resume education section */}
      {props.draft.education.map(function (edu) {
        return (
          <div
            key={edu.id}
            className="mb-4 rounded px-2 py-2 transition-colors"
            style={{
              background: props.sectionEditReady
                ? 'color-mix(in srgb, var(--p-accent) 3%, transparent)'
                : 'transparent',
              border: props.sectionEditReady
                ? '1px dashed var(--p-accent-muted, var(--p-border))'
                : '1px solid transparent',
            }}
          >
            {/* Degree and field — primary line, bold */}
            <p className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
              {edu.degree} in {edu.field}
            </p>
            {/* Institution name */}
            <p className="text-xs mt-0.5" style={{ color: 'var(--p-text-muted)' }}>
              {edu.institution}
            </p>
            {/* Graduation date and optional GPA */}
            <p className="text-xs mt-0.5" style={{ color: 'var(--p-text-dim)' }}>
              {'Graduated: ' + edu.graduationDate}
              {edu.gpa ? '  ·  GPA: ' + edu.gpa : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Skills section on the canvas
// ---------------------------------------------------------------------------

/**
 * Skills section formatted like a resume skills block.
 *
 * Instead of loose chips floating in space, skills are presented in a
 * denser, comma-separated line format that mirrors how skills appear
 * on a real federal resume. This reduces dead space and gives the
 * section a document-like rhythm.
 *
 * In edit-ready mode, individual skills get chip-style interactive
 * borders, and the layout shifts to the wrapped chip format so the
 * user can see discrete editing targets.
 */
function SkillsSection(props: { draft: ResumeDraft; sectionEditReady: boolean }) {
  if (props.draft.skills.length === 0) return null;

  return (
    <div className="mb-4" data-testid="skills-section">
      {/* Section heading — resume-style uppercase label */}
      <div
        className="flex items-center justify-between mb-4 pb-2"
        style={{ borderBottom: '1px solid var(--p-border)' }}
      >
        <h3
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--p-text)', letterSpacing: '0.08em' }}
        >
          Skills
        </h3>
        <span className="text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
          85% relevant
        </span>
      </div>

      {/* Skills presentation — mode-dependent layout.
       * View mode: dense comma-separated list (resume-like).
       * Edit-ready mode: wrapped chips with editable borders. */}
      {props.sectionEditReady ? (
        <div className="flex flex-wrap gap-2">
          {props.draft.skills.map(function (skill) {
            return (
              <span
                key={skill.id}
                className="text-xs px-2.5 py-1 rounded transition-colors"
                style={{
                  background: 'color-mix(in srgb, var(--p-accent) 5%, var(--p-surface2))',
                  color: 'var(--p-text-muted)',
                  border: '1px dashed var(--p-accent-muted, var(--p-border))',
                  cursor: 'pointer',
                }}
              >
                {skill.name}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="text-sm leading-relaxed" style={{ color: 'var(--p-text-muted)' }}>
          {/* Dense comma-separated format — reads like resume content */}
          {(function () {
            const names: string[] = [];
            for (let i = 0; i < props.draft.skills.length; i++) {
              names.push(props.draft.skills[i].name);
            }
            return names.join('  ·  ');
          })()}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Federal Details section on the canvas
// ---------------------------------------------------------------------------

/**
 * Federal details section — structured as a document-style data block.
 *
 * Federal resumes require specific administrative details that standard
 * resumes omit. This section presents them in a clean two-column layout
 * with labeled fields, matching how these details appear on official
 * federal resume templates.
 *
 * In edit-ready mode, each field gets a subtle editable highlight.
 */
function FederalDetailsSection(props: { sectionEditReady: boolean }) {
  return (
    <div className="mb-4" data-testid="federal-details-section">
      {/* Section heading — resume-style uppercase label */}
      <div
        className="flex items-center justify-between mb-4 pb-2"
        style={{ borderBottom: '1px solid var(--p-border)' }}
      >
        <h3
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--p-text)', letterSpacing: '0.08em' }}
        >
          Federal Details
        </h3>
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{
            background: 'color-mix(in srgb, var(--p-danger, #ef4444) 15%, transparent)',
            color: 'var(--p-danger, #ef4444)',
          }}
        >
          4 items missing
        </span>
      </div>

      {/* Two-column data grid — labeled fields in resume-like layout */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
        {[
          { label: 'Security Clearance', value: MOCK_FEDERAL_DETAILS.securityClearance },
          { label: 'Highest Grade', value: MOCK_FEDERAL_DETAILS.highestGrade },
          { label: 'Federal Employee', value: MOCK_FEDERAL_DETAILS.federalEmployee ? 'Yes' : 'No' },
          { label: 'Veteran Preference', value: MOCK_FEDERAL_DETAILS.veteranPreference },
        ].map(function (field) {
          return (
            <div
              key={field.label}
              className="rounded px-2 py-1.5 transition-colors"
              style={{
                background: props.sectionEditReady
                  ? 'color-mix(in srgb, var(--p-accent) 3%, transparent)'
                  : 'transparent',
                border: props.sectionEditReady
                  ? '1px dashed var(--p-accent-muted, var(--p-border))'
                  : '1px solid transparent',
              }}
            >
              <span className="font-medium" style={{ color: 'var(--p-text-dim)' }}>
                {field.label}
              </span>
              <span style={{ color: 'var(--p-text)' }}>
                {'  ' + field.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Certifications section on the canvas
// ---------------------------------------------------------------------------

/**
 * Certifications section — structured list with checkmarks.
 *
 * Each certification appears as a line item with a success indicator,
 * matching how certifications appear on a professional resume. The
 * heading uses the same uppercase treatment as other resume sections.
 *
 * In edit-ready mode, each cert entry gets a subtle editable highlight.
 */
function CertificationsSection(props: { sectionEditReady: boolean }) {
  return (
    <div className="mb-4" data-testid="certifications-section">
      {/* Section heading — resume-style uppercase label */}
      <div
        className="flex items-center justify-between mb-4 pb-2"
        style={{ borderBottom: '1px solid var(--p-border)' }}
      >
        <h3
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--p-text)', letterSpacing: '0.08em' }}
        >
          Certifications
        </h3>
      </div>

      {/* Certification entries */}
      <div className="space-y-2">
        {MOCK_CERTIFICATIONS.map(function (cert) {
          return (
            <div
              key={cert}
              className="flex items-center gap-2.5 text-sm rounded px-2 py-1.5 transition-colors"
              style={{
                color: 'var(--p-text-muted)',
                background: props.sectionEditReady
                  ? 'color-mix(in srgb, var(--p-accent) 3%, transparent)'
                  : 'transparent',
                border: props.sectionEditReady
                  ? '1px dashed var(--p-accent-muted, var(--p-border))'
                  : '1px solid transparent',
              }}
            >
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--p-success)' }} />
              {cert}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Supporting Evidence section on the canvas
// ---------------------------------------------------------------------------

/**
 * Supporting evidence section — placeholder for awards, publications,
 * and other supplementary resume materials.
 *
 * This section uses the same heading treatment and document framing
 * as other resume sections. The placeholder text sits within the
 * resume-slice structure so even the empty state feels like a real
 * section of a federal resume.
 *
 * In edit-ready mode, the content area gets a subtle highlight.
 */
function SupportingEvidenceSection(props: { sectionEditReady: boolean }) {
  return (
    <div className="mb-4" data-testid="supporting-evidence-section">
      {/* Section heading — resume-style uppercase label */}
      <div
        className="flex items-center justify-between mb-4 pb-2"
        style={{ borderBottom: '1px solid var(--p-border)' }}
      >
        <h3
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: 'var(--p-text)', letterSpacing: '0.08em' }}
        >
          Supporting Evidence
        </h3>
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{
            background: 'color-mix(in srgb, var(--p-danger, #ef4444) 15%, transparent)',
            color: 'var(--p-danger, #ef4444)',
          }}
        >
          6 items needed
        </span>
      </div>

      {/* Placeholder content — framed within the section structure */}
      <div
        className="rounded px-3 py-4 transition-colors"
        style={{
          background: props.sectionEditReady
            ? 'color-mix(in srgb, var(--p-accent) 3%, transparent)'
            : 'color-mix(in srgb, var(--p-surface2) 50%, transparent)',
          border: props.sectionEditReady
            ? '1px dashed var(--p-accent-muted, var(--p-border))'
            : '1px dashed var(--p-border)',
        }}
      >
        <p className="text-xs" style={{ color: 'var(--p-text-dim)' }}>
          Awards, publications, training records, and performance evaluations.
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--p-text-dim)' }}>
          Add supporting evidence to strengthen your federal application.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: ProposalCard — collapsed/expanded proposal in the queue
// ---------------------------------------------------------------------------
//
// Phase 3 UX compression: proposals render in a compact collapsed state by
// default. The collapsed row shows title, impacted section, confidence,
// impact level, optional score gain, and three action buttons (Apply,
// Review, Explain). Only when the user clicks Review or the expand toggle
// does the full detail panel open with before/after, reason, requirement,
// and Edit First / Dismiss / Accept.
//
// This "scan first, inspect second" pattern dramatically reduces the
// cognitive load of the Suggested Changes queue.
//

/**
 * Map proposal type to a lucide icon for quick visual scanning.
 * Each type gets a distinct icon so the user can pattern-match
 * without reading titles.
 */
const PROPOSAL_TYPE_ICONS: Record<ProposalType, typeof FileText> = {
  'add-summary': FileText,
  'strengthen-bullet': Zap,
  'add-federal-detail': Shield,
  'expand-phrasing': ArrowRight,
  'improve-keywords': Target,
};

/**
 * Map section keys to short labels for compact proposal rows.
 * These are intentionally shorter than the full SECTION_DEFS labels
 * to fit in the collapsed row without wrapping.
 */
const SECTION_SHORT_LABELS: Record<string, string> = {
  contact: 'Contact',
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  'federal-details': 'Federal',
  certifications: 'Certs',
  'supporting-evidence': 'Evidence',
};

function ProposalCard(props: {
  proposal: ResumeProposal;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAccept: () => void;
  onReject: () => void;
  onEditFirst: () => void;
  onExplain: () => void;
}) {
  const p = props.proposal;
  const TypeIcon = PROPOSAL_TYPE_ICONS[p.type] || Sparkles;
  const impactLevel = getProposalImpactLevel(p.confidence);
  const impactLabel = IMPACT_LABELS[impactLevel];
  const impactColor = IMPACT_COLORS[impactLevel];
  const sectionShort = SECTION_SHORT_LABELS[p.sectionKey] || p.sectionKey;
  const scoreGain = estimateScoreGain(p.confidence);

  /* ---- Collapsed state: compact summary row ---- */
  if (!props.isExpanded) {
    return (
      <div
        className="mb-2 rounded-lg overflow-hidden"
        style={{
          border: '1px solid var(--p-border)',
          background: 'var(--p-surface)',
        }}
        data-testid={'proposal-card-' + p.id}
      >
        <div className="px-3 py-2.5 flex items-center gap-2.5">
          {/* Expand toggle — keyboard accessible */}
          <button
            type="button"
            onClick={props.onToggleExpand}
            className={'p-1 rounded flex-shrink-0 ' + INTERACTIVE_HOVER_CLASS}
            style={{ color: 'var(--p-text-dim)' }}
            aria-expanded={false}
            aria-label={'Expand proposal: ' + p.title}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Type icon */}
          <TypeIcon
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: 'var(--p-accent)' }}
          />

          {/* Title — truncated for scannability */}
          <span className="text-xs font-medium truncate flex-1 min-w-0" style={{ color: 'var(--p-text)' }}>
            {p.title}
          </span>

          {/* Section badge */}
          <span
            className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
            style={{
              background: 'var(--p-surface2)',
              color: 'var(--p-text-dim)',
            }}
          >
            {sectionShort}
          </span>

          {/* Confidence chip */}
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
            style={{
              background: 'color-mix(in srgb, ' + scoreTierColor(p.confidence) + ' 12%, transparent)',
              color: scoreTierColor(p.confidence),
            }}
          >
            {p.confidence}%
          </span>

          {/* Impact level badge */}
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
            style={{
              background: 'color-mix(in srgb, ' + impactColor + ' 12%, transparent)',
              color: impactColor,
            }}
          >
            {impactLabel}
          </span>

          {/* Needs-confirmation marker */}
          {p.needsConfirmation && (
            <span
              className="text-[10px] font-semibold px-1 py-0.5 rounded flex-shrink-0"
              style={{
                background: 'color-mix(in srgb, var(--p-warning, #eab308) 15%, transparent)',
                color: 'var(--p-warning, #eab308)',
              }}
              title="Needs confirmation"
            >
              !
            </span>
          )}

          {/* Score gain estimate */}
          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--p-text-dim)' }}>
            {scoreGain}
          </span>

          {/* ---- Compact action buttons ---- */}
          <button
            type="button"
            onClick={props.onAccept}
            className={'px-2 py-1 text-[10px] font-semibold rounded flex-shrink-0 ' + INTERACTIVE_HOVER_CLASS}
            style={{
              background: 'var(--p-success)',
              color: 'var(--p-bg)',
              border: 'none',
            }}
            data-testid={'proposal-accept-' + p.id}
          >
            Apply
          </button>
          <button
            type="button"
            onClick={props.onToggleExpand}
            className={'px-2 py-1 text-[10px] font-medium rounded flex-shrink-0 ' + INTERACTIVE_HOVER_CLASS}
            style={{
              color: 'var(--p-accent)',
              border: '1px solid var(--p-border)',
              background: 'transparent',
            }}
            data-testid={'proposal-review-' + p.id}
          >
            Review
          </button>
          <button
            type="button"
            onClick={props.onExplain}
            className={'px-2 py-1 text-[10px] font-medium rounded flex-shrink-0 ' + INTERACTIVE_HOVER_CLASS}
            style={{
              color: 'var(--p-text-dim)',
              border: '1px solid var(--p-border)',
              background: 'transparent',
            }}
            data-testid={'proposal-explain-' + p.id}
          >
            Explain
          </button>
        </div>
      </div>
    );
  }

  /* ---- Expanded state: full detail panel ---- */
  const confidenceColor = scoreTierColor(p.confidence);

  return (
    <div
      className="mb-2 rounded-lg overflow-hidden"
      style={{
        border: '1px solid var(--p-accent)',
        background: 'var(--p-surface)',
      }}
      data-testid={'proposal-card-' + p.id}
    >
      {/* ---- Expanded header: collapse toggle + title + badges ---- */}
      <div
        className="px-4 py-3 flex items-start gap-3"
        style={{ borderBottom: '1px solid var(--p-border)' }}
      >
        <button
          type="button"
          onClick={props.onToggleExpand}
          className={'p-1 rounded flex-shrink-0 ' + INTERACTIVE_HOVER_CLASS}
          style={{ color: 'var(--p-accent)' }}
          aria-expanded={true}
          aria-label={'Collapse proposal: ' + p.title}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <TypeIcon
          className="w-4 h-4 mt-0.5 flex-shrink-0"
          style={{ color: 'var(--p-accent)' }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h5 className="text-xs font-semibold" style={{ color: 'var(--p-text)' }}>
              {p.title}
            </h5>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{
                background: 'color-mix(in srgb, ' + confidenceColor + ' 15%, transparent)',
                color: confidenceColor,
              }}
            >
              {p.confidence}% confidence
            </span>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{
                background: 'color-mix(in srgb, ' + impactColor + ' 12%, transparent)',
                color: impactColor,
              }}
            >
              {impactLabel} impact
            </span>
            {p.needsConfirmation && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{
                  background: 'color-mix(in srgb, var(--p-warning, #eab308) 15%, transparent)',
                  color: 'var(--p-warning, #eab308)',
                }}
              >
                Needs confirmation
              </span>
            )}
          </div>
          {/* Reason — visible only when expanded */}
          <p className="text-[11px] mt-1" style={{ color: 'var(--p-text-muted)' }}>
            {p.reason}
          </p>
        </div>
      </div>

      {/* ---- Before / After content comparison (expanded only) ---- */}
      <div className="px-4 py-3" data-testid={'proposal-detail-' + p.id}>
        {p.beforeText && (
          <div className="mb-3">
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--p-text-dim)' }}
            >
              Current
            </span>
            <p
              className="text-xs mt-1 px-3 py-2 rounded whitespace-pre-line"
              style={{
                background: 'color-mix(in srgb, var(--p-danger, #ef4444) 5%, var(--p-surface2))',
                color: 'var(--p-text-muted)',
                borderLeft: '3px solid var(--p-danger, #ef4444)',
              }}
            >
              {p.beforeText}
            </p>
          </div>
        )}
        <div>
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--p-text-dim)' }}
          >
            {p.beforeText ? 'Suggested' : 'Proposed content'}
          </span>
          <p
            className="text-xs mt-1 px-3 py-2 rounded whitespace-pre-line"
            style={{
              background: 'color-mix(in srgb, var(--p-success) 5%, var(--p-surface2))',
              color: 'var(--p-text)',
              borderLeft: '3px solid var(--p-success)',
            }}
          >
            {p.suggestedText}
          </p>
        </div>
        <p
          className="text-[11px] mt-2 flex items-center gap-1.5"
          style={{ color: 'var(--p-text-dim)' }}
        >
          <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--p-success)' }} />
          {p.supportedRequirement}
        </p>
      </div>

      {/* ---- Expanded action buttons: Edit First / Dismiss / Accept ---- */}
      <div
        className="px-4 py-2.5 flex items-center gap-2"
        style={{
          borderTop: '1px solid var(--p-border)',
          background: 'var(--p-surface2)',
        }}
      >
        <button
          type="button"
          onClick={props.onAccept}
          className={'px-3 py-1.5 text-xs font-semibold rounded ' + INTERACTIVE_HOVER_CLASS}
          style={{
            background: 'var(--p-success)',
            color: 'var(--p-bg)',
            border: 'none',
          }}
          data-testid={'proposal-accept-' + p.id}
        >
          Apply suggestion
        </button>
        <button
          type="button"
          onClick={props.onEditFirst}
          className={'px-3 py-1.5 text-xs font-medium rounded ' + INTERACTIVE_HOVER_CLASS}
          style={{
            background: 'transparent',
            color: 'var(--p-text)',
            border: '1px solid var(--p-border)',
          }}
          data-testid={'proposal-edit-first-' + p.id}
        >
          Edit First
        </button>
        <button
          type="button"
          onClick={props.onReject}
          className={'px-3 py-1.5 text-xs font-medium rounded ' + INTERACTIVE_HOVER_CLASS}
          style={{
            background: 'transparent',
            color: 'var(--p-text-muted)',
            border: '1px solid var(--p-border)',
          }}
          data-testid={'proposal-dismiss-' + p.id}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: SuggestedChangesTab — summary-first action queue
// ---------------------------------------------------------------------------
//
// Phase 3 UX compression: the Suggested Changes tab is now a scan-first
// action queue. The default view shows a compact summary header and
// collapsed proposal rows. Only one proposal can be expanded at a time,
// enforced by local expandedProposalId state. This dramatically reduces
// the cognitive load of reviewing 4–6 proposals.
//
// This is a REVIEW surface, not a direct editing surface. Proposals never
// silently overwrite content — the user explicitly accepts each one.
//

function SuggestedChangesTab(props: {
  proposals: ResumeProposal[];
  onAccept: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
  onEditFirst: (proposalId: string) => void;
  activeJob: Job | null;
}) {
  /*
   * Expanded proposal state — only one proposal can be open at a time.
   * Clicking Review or the expand toggle sets this. Clicking again or
   * expanding a different proposal collapses the previous one.
   */
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null);

  /* Count pending proposals for the summary header */
  let pendingCount = 0;
  for (let i = 0; i < props.proposals.length; i++) {
    if (props.proposals[i].status === 'pending') {
      pendingCount = pendingCount + 1;
    }
  }

  /*
   * Compute average confidence of pending proposals. Represents
   * estimated readiness improvement if all accepted.
   */
  let totalConfidence = 0;
  for (let i = 0; i < props.proposals.length; i++) {
    if (props.proposals[i].status === 'pending') {
      totalConfidence = totalConfidence + props.proposals[i].confidence;
    }
  }
  const avgImpact = pendingCount > 0 ? Math.round(totalConfidence / pendingCount) : 0;

  /* Find strongest proposal category (highest confidence among pending) */
  let strongestSectionKey = '';
  let highestConfidence = 0;
  for (let i = 0; i < props.proposals.length; i++) {
    if (
      props.proposals[i].status === 'pending' &&
      props.proposals[i].confidence > highestConfidence
    ) {
      highestConfidence = props.proposals[i].confidence;
      strongestSectionKey = props.proposals[i].sectionKey;
    }
  }

  /* Group pending proposals by sectionKey for visual organization */
  const grouped: Record<string, ResumeProposal[]> = {};
  for (let i = 0; i < props.proposals.length; i++) {
    const p = props.proposals[i];
    if (p.status !== 'pending') continue;
    if (!grouped[p.sectionKey]) {
      grouped[p.sectionKey] = [];
    }
    grouped[p.sectionKey].push(p);
  }

  /* Build a section label lookup from SECTION_DEFS */
  const sectionLabels: Record<string, string> = {};
  for (let i = 0; i < SECTION_DEFS.length; i++) {
    sectionLabels[SECTION_DEFS[i].id] = SECTION_DEFS[i].label;
  }

  const groupKeys = Object.keys(grouped);

  /**
   * Toggle expand for a proposal. If the same proposal is already expanded,
   * collapse it. If a different one is expanded, collapse it and open this.
   */
  function handleToggleExpand(proposalId: string) {
    if (expandedProposalId === proposalId) {
      setExpandedProposalId(null);
    } else {
      setExpandedProposalId(proposalId);
    }
  }

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ background: 'var(--p-bg)' }}
      role="tabpanel"
      id="resume-tabpanel-suggested-changes"
      aria-labelledby="resume-tab-suggested-changes"
      data-testid="resume-tabpanel-suggested-changes"
    >
      <div className="max-w-[820px] mx-auto px-8 py-6">
        {/* ---- Compact summary header ---- */}
        <div
          className="mb-4 px-4 py-3 rounded-lg flex items-center gap-5 flex-wrap"
          style={{
            background: 'var(--p-surface)',
            border: '1px solid var(--p-border)',
          }}
          data-testid="suggested-changes-summary"
        >
          <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--p-accent)' }} />
          {/* Pending count */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold" style={{ color: 'var(--p-text)' }}>
              {pendingCount}
            </span>
            <span className="text-xs" style={{ color: 'var(--p-text-muted)' }}>
              pending
            </span>
          </div>
          {/* Avg confidence */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold" style={{ color: scoreTierColor(avgImpact) }}>
              {avgImpact}%
            </span>
            <span className="text-xs" style={{ color: 'var(--p-text-muted)' }}>
              avg confidence
            </span>
          </div>
          {/* Strongest category — compact chip */}
          {strongestSectionKey && (
            <span className="text-xs" style={{ color: 'var(--p-text-muted)' }}>
              Top: <strong style={{ color: 'var(--p-text)' }}>{sectionLabels[strongestSectionKey] || strongestSectionKey}</strong>
            </span>
          )}
          {/* No target job hint */}
          {!props.activeJob && (
            <span className="text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
              Select a target job for job-specific proposals
            </span>
          )}
        </div>

        {/* ---- Empty state when all proposals are reviewed ---- */}
        {pendingCount === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--p-text-dim)' }}>
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">All proposals reviewed</p>
            <p className="text-xs mt-1">
              Switch to Edit or select a different target job
            </p>
          </div>
        )}

        {/* ---- Grouped compact proposal rows ---- */}
        {groupKeys.map(function (sectionKey) {
          const sectionProposals = grouped[sectionKey];
          const sectionLabel = sectionLabels[sectionKey] || sectionKey;

          return (
            <div key={sectionKey} className="mb-4" data-testid={'proposal-group-' + sectionKey}>
              {/* Section group header — compact */}
              <h4
                className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-2"
                style={{ color: 'var(--p-text-dim)' }}
              >
                {sectionLabel}
                <span
                  className="text-[10px] font-normal px-1.5 py-0.5 rounded"
                  style={{
                    background: 'var(--p-surface2)',
                    color: 'var(--p-text-dim)',
                  }}
                >
                  {sectionProposals.length}
                </span>
              </h4>

              {/* Render each proposal card — collapsed by default, one expandable */}
              {sectionProposals.map(function (proposal) {
                const isExpanded = expandedProposalId === proposal.id;
                return (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    isExpanded={isExpanded}
                    onToggleExpand={function () { handleToggleExpand(proposal.id); }}
                    onAccept={function () { props.onAccept(proposal.id); }}
                    onReject={function () { props.onReject(proposal.id); }}
                    onEditFirst={function () { props.onEditFirst(proposal.id); }}
                    onExplain={function () { handleToggleExpand(proposal.id); }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: CoverageMapTab — visual summary modules with expand
// ---------------------------------------------------------------------------
//
// Phase 3 UX compression: the Coverage Map now defaults to compact visual
// summary cards for each dimension. Each card emphasizes score, severity,
// and one next action. Only when the user expands a dimension does the
// full detail appear (source section, why weak, linked proposals, edit
// actions). Only one dimension can be expanded at a time.
//
// This is a DIAGNOSTIC surface focused on "what do I need to fix" rather
// than an explanation dump about every dimension.
//

/**
 * Compact severity labels for the default dimension card state.
 * Intentionally action-oriented rather than analytical.
 */
const SEVERITY_ACTION_LABELS: Record<CoverageSeverity, string> = {
  'strong': 'On track',
  'moderate': 'Review',
  'high-priority': 'Fix now',
};

function CoverageMapTab(props: {
  dimensions: CoverageDimension[];
  activeJob: Job | null;
  onJumpToSection: (sectionId: SectionId) => void;
  onSwitchToSuggestedChanges: () => void;
  onEditSection: (sectionId: SectionId) => void;
}) {
  /*
   * Expanded dimension state — only one dimension can be open at a time.
   * Mirrors the same accordion pattern used in Suggested Changes.
   */
  const [expandedDimensionId, setExpandedDimensionId] = useState<string | null>(null);

  /* Compute overall coverage score */
  let totalScore = 0;
  for (let i = 0; i < props.dimensions.length; i++) {
    totalScore = totalScore + props.dimensions[i].scorePct;
  }
  const overallScore = props.dimensions.length > 0
    ? Math.round(totalScore / props.dimensions.length)
    : 0;

  /* Count high-priority gaps */
  let highPriorityCount = 0;
  for (let i = 0; i < props.dimensions.length; i++) {
    if (props.dimensions[i].severity === 'high-priority') {
      highPriorityCount = highPriorityCount + 1;
    }
  }

  /* Find weakest dimension */
  let weakestDim: CoverageDimension | null = null;
  for (let i = 0; i < props.dimensions.length; i++) {
    if (weakestDim === null || props.dimensions[i].scorePct < weakestDim.scorePct) {
      weakestDim = props.dimensions[i];
    }
  }

  /* Section label lookup */
  const sectionLabels: Record<string, string> = {};
  for (let i = 0; i < SECTION_DEFS.length; i++) {
    sectionLabels[SECTION_DEFS[i].id] = SECTION_DEFS[i].label;
  }

  /* Severity label mapping for expanded detail view */
  const severityLabels: Record<CoverageSeverity, string> = {
    'strong': 'Strong',
    'moderate': 'Moderate',
    'high-priority': 'High Priority',
  };

  /** Toggle dimension expand — one at a time accordion pattern. */
  function handleToggleDimension(dimId: string) {
    if (expandedDimensionId === dimId) {
      setExpandedDimensionId(null);
    } else {
      setExpandedDimensionId(dimId);
    }
  }

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ background: 'var(--p-bg)' }}
      role="tabpanel"
      id="resume-tabpanel-coverage-map"
      aria-labelledby="resume-tab-coverage-map"
      data-testid="resume-tabpanel-coverage-map"
    >
      <div className="max-w-[820px] mx-auto px-8 py-6">
        {/* ---- Compact summary header ---- */}
        <div
          className="mb-4 px-4 py-3 rounded-lg flex items-center gap-5 flex-wrap"
          style={{
            background: 'var(--p-surface)',
            border: '1px solid var(--p-border)',
          }}
          data-testid="coverage-map-summary"
        >
          <Map className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--p-accent)' }} />
          {/* Overall score — compact chip */}
          <div className="flex items-center gap-1.5">
            <span
              className="text-lg font-bold"
              style={{ color: scoreTierColor(overallScore) }}
            >
              {overallScore}%
            </span>
            <span className="text-xs" style={{ color: 'var(--p-text-muted)' }}>
              coverage
            </span>
          </div>
          {/* High-priority badge */}
          {highPriorityCount > 0 && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{
                background: 'color-mix(in srgb, var(--p-danger, #ef4444) 12%, transparent)',
                color: 'var(--p-danger, #ef4444)',
              }}
            >
              <AlertTriangle className="w-3 h-3" />
              {highPriorityCount} gap{highPriorityCount > 1 ? 's' : ''}
            </span>
          )}
          {/* Weakest dimension — compact */}
          {weakestDim && props.activeJob && (
            <span className="text-xs" style={{ color: 'var(--p-text-dim)' }}>
              Weakest: <strong style={{ color: 'var(--p-text-muted)' }}>{weakestDim.label}</strong> ({weakestDim.scorePct}%)
            </span>
          )}
          {/* Target job chip */}
          {props.activeJob && (
            <span
              className="ml-auto text-[10px] px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--p-surface2)',
                color: 'var(--p-text-dim)',
                border: '1px solid var(--p-border)',
              }}
            >
              vs. {props.activeJob.title}
            </span>
          )}
          {/* No target hint */}
          {!props.activeJob && (
            <span className="text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
              Select a target job to see coverage
            </span>
          )}
        </div>

        {/* ---- Dimension cards: compact by default, one expandable ---- */}
        <div className="space-y-2">
          {props.dimensions.map(function (dim) {
            const barColor = scoreTierColor(dim.scorePct);
            const actionLabel = SEVERITY_ACTION_LABELS[dim.severity];
            const isExpanded = expandedDimensionId === dim.id;
            const sectionLabel = sectionLabels[dim.linkedSection] || dim.linkedSection;
            const severityLabel = severityLabels[dim.severity];

            return (
              <div
                key={dim.id}
                className="rounded-lg overflow-hidden"
                style={{
                  background: 'var(--p-surface)',
                  border: isExpanded
                    ? '1px solid var(--p-accent)'
                    : dim.severity === 'high-priority'
                      ? '1px solid var(--p-danger, #ef4444)'
                      : '1px solid var(--p-border)',
                }}
                data-testid={'coverage-dimension-' + dim.id}
              >
                {/* ---- Default compact state: score + severity + action ---- */}
                <button
                  type="button"
                  onClick={function () { handleToggleDimension(dim.id); }}
                  className="w-full text-left px-4 py-3 flex items-center gap-3"
                  style={{ background: 'transparent' }}
                  aria-expanded={isExpanded}
                  aria-label={dim.label + ' coverage: ' + dim.scorePct + '% — ' + actionLabel}
                >
                  {/* Expand/collapse chevron */}
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--p-accent)' }} />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--p-text-dim)' }} />
                  )}

                  {/* Dimension label */}
                  <span className="text-xs font-semibold flex-1 min-w-0" style={{ color: 'var(--p-text)' }}>
                    {dim.label}
                  </span>

                  {/* Mini score chip */}
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{
                      background: 'color-mix(in srgb, ' + barColor + ' 12%, transparent)',
                      color: barColor,
                    }}
                  >
                    {dim.scorePct}
                  </span>

                  {/* Severity/action badge */}
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{
                      background: 'color-mix(in srgb, ' + barColor + ' 12%, transparent)',
                      color: barColor,
                    }}
                  >
                    {actionLabel}
                  </span>

                  {/* One-line next action (collapsed only) */}
                  {!isExpanded && (
                    <span className="text-[10px] truncate max-w-[200px] flex-shrink" style={{ color: 'var(--p-text-dim)' }}>
                      {dim.actionHint}
                    </span>
                  )}
                </button>

                {/* ---- Expanded detail panel ---- */}
                {isExpanded && (
                  <div
                    className="px-4 pb-3 pt-1"
                    style={{ borderTop: '1px solid var(--p-border)' }}
                    data-testid={'coverage-detail-' + dim.id}
                  >
                    {/* Score progress bar */}
                    <div
                      className="h-1.5 rounded-full overflow-hidden mb-2"
                      style={{ background: 'var(--p-surface2)' }}
                      role="progressbar"
                      aria-valuenow={dim.scorePct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={dim.label + ' coverage'}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: dim.scorePct + '%',
                          background: barColor,
                        }}
                      />
                    </div>

                    {/* Severity + status summary */}
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{
                          background: 'color-mix(in srgb, ' + barColor + ' 15%, transparent)',
                          color: barColor,
                        }}
                      >
                        {severityLabel}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--p-text-muted)' }}>
                        {dim.statusSummary}
                      </span>
                    </div>

                    {/* Source section + action hint */}
                    <p className="text-[10px] mb-2" style={{ color: 'var(--p-text-dim)' }}>
                      Source: {sectionLabel} · {dim.actionHint}
                    </p>

                    {/* Action buttons — compact row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {dim.suggestionCount > 0 && (
                        <button
                          type="button"
                          onClick={function () { props.onSwitchToSuggestedChanges(); }}
                          className={
                            'flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded ' +
                            INTERACTIVE_HOVER_CLASS
                          }
                          style={{
                            color: 'var(--p-accent)',
                            border: '1px solid var(--p-border)',
                            background: 'transparent',
                          }}
                        >
                          <Sparkles className="w-3 h-3" />
                          Review {dim.suggestionCount} fix{dim.suggestionCount > 1 ? 'es' : ''}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={function () { props.onJumpToSection(dim.linkedSection); }}
                        className={
                          'flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded ' +
                          INTERACTIVE_HOVER_CLASS
                        }
                        style={{
                          color: 'var(--p-text-dim)',
                          border: '1px solid var(--p-border)',
                          background: 'transparent',
                        }}
                      >
                        <ArrowRight className="w-3 h-3" />
                        Jump to section
                      </button>
                      <button
                        type="button"
                        onClick={function () { props.onEditSection(dim.linkedSection); }}
                        className={
                          'flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded ' +
                          INTERACTIVE_HOVER_CLASS
                        }
                        style={{
                          color: 'var(--p-text-dim)',
                          border: '1px solid var(--p-border)',
                          background: 'transparent',
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                        Edit section
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Tab placeholder — for Preview and Version Diff tabs
// ---------------------------------------------------------------------------
//
// Phase 2 keeps Preview and Version Diff as scaffolded placeholders.
// Suggested Changes and Coverage Map are now real implemented tabs.
//

function TabPlaceholder(props: { tab: WorkspaceTab }) {
  const placeholders: Record<string, { icon: typeof FileText; title: string; description: string }> = {
    preview: {
      icon: Eye,
      title: 'Preview',
      description: 'See how your resume will appear to reviewers — coming soon',
    },
    'version-diff': {
      icon: GitCompare,
      title: 'Version Diff',
      description: 'Compare changes between resume versions — coming soon',
    },
  };

  const info = placeholders[props.tab];
  if (!info) return null;
  const IconComponent = info.icon;

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-3"
      style={{ color: 'var(--p-text-dim)' }}
      role="tabpanel"
      id={'resume-tabpanel-' + props.tab}
      aria-labelledby={'resume-tab-' + props.tab}
      data-testid={'resume-tabpanel-' + props.tab}
    >
      <IconComponent className="w-10 h-10 opacity-40" />
      <p className="text-sm font-medium">{info.title}</p>
      <p className="text-xs">{info.description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main screen component
// ---------------------------------------------------------------------------

/**
 * Resume Builder workspace — Phase 1.
 *
 * State architecture:
 *   store:                   core ResumeStore (persisted via @pathos/core)
 *   savedJobs:               Job[] from saved-jobs store (for target selector)
 *   activeTab:               which workspace tab is shown
 *   activeSection:           which resume section is selected in the left rail
 *   activeTargetJobId:       the saved job being used as the target
 *   autonomyMode:            'assisted' or 'manual'
 *   bulletMap:               view-model layer mapping experienceId -> bullets
 *   activeSuggestionBulletId: which bullet has an active inline suggestion
 *   editingBulletId:         which bullet is in edit mode
 *   editingSummary:          whether the professional summary is being edited
 *
 * Data flow:
 *   1. Load resume from core store, seed if empty
 *   2. Load saved jobs from core store, seed if empty
 *   3. Build bullet VM from experience duties
 *   4. Edits update both bullet VM and core store
 *   5. PathAdvisor overrides set on mount, cleared on unmount
 */
export function ResumeBuilderScreen(_props: ResumeBuilderScreenProps) {
  /* ---- Core resume store ---- */
  const [store, setStore] = useState<ResumeStore>({
    schemaVersion: 1,
    draft: createDefaultDraft(),
    versions: [],
  });
  const [mounted, setMounted] = useState(false);

  /* ---- Saved jobs for target selector ---- */
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);

  /* ---- Workspace view state ---- */
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('edit');
  const [activeSection, setActiveSection] = useState<SectionId>('experience');
  const [activeTargetJobId, setActiveTargetJobId] = useState<string | null>(null);
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>('assisted');
  const [showTargetJobDropdown, setShowTargetJobDropdown] = useState(false);

  /*
   * ---- Edit mode: dashboard vs focused ----
   * Controls the two-state Edit tab. Starts on 'dashboard' so the user
   * sees the section overview first and can choose which section to work on.
   *   dashboard: section cards grid — overview of all sections
   *   focused:   single-section editor — editing one section at a time
   */
  const [editMode, setEditMode] = useState<EditMode>('dashboard');

  /*
   * ---- Section edit-ready mode ----
   * When focused on a section, the user can toggle between View mode and
   * Edit-ready mode using the pencil icon in the control row.
   *
   * View mode (false):
   *   Section looks like a polished resume slice — read-first, minimal
   *   editing affordances. Content is clean and document-like.
   *
   * Edit-ready mode (true):
   *   Editable regions are visibly highlighted. Health badges, inline
   *   actions, and editing affordances appear or become more prominent.
   *   The user clearly understands the section is ready for editing.
   *
   * Resets to false when:
   *   - returning to dashboard
   *   - switching to a different section
   *   - entering focused mode on a new section
   */
  const [sectionEditReady, setSectionEditReady] = useState(false);

  /*
   * ---- Section dropdown open/close state ----
   * Controls the custom dropdown in the focused-editor header row that
   * lets the user switch between sections without going back to the
   * dashboard. Closes automatically when clicking outside (via effect).
   */
  const [showSectionDropdown, setShowSectionDropdown] = useState(false);

  /* ---- Bullet view model ---- */
  const [bulletMap, setBulletMap] = useState<Record<string, ResumeBulletVM[]>>({});

  /* ---- Inline suggestion state ---- */
  const [activeSuggestionBulletId, setActiveSuggestionBulletId] = useState<string | null>(null);

  /* ---- Bullet editing state ---- */
  const [editingBulletId, setEditingBulletId] = useState<string | null>(null);
  const [editingBulletText, setEditingBulletText] = useState('');

  /* ---- Summary editing state ---- */
  const [editingSummary, setEditingSummary] = useState(false);
  const [editingSummaryText, setEditingSummaryText] = useState('');

  /* ---- Phase 2: broader proposal state for Suggested Changes tab ---- */
  const [proposals, setProposals] = useState<ResumeProposal[]>([]);

  /* ---- Section refs for scroll-to-section behavior ---- */
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);

  // =========================================================================
  // NEW ARCHITECTURE STATE — live canvas, stage system, callouts
  // =========================================================================
  //
  // These state variables support the document-centered live canvas
  // architecture. They run alongside the existing state and power the
  // new top bar, section rail, callout layer, and validation checklist.
  //

  /**
   * Builder stage: which phase of the federal resume workflow is active.
   *   partial:    building the master resume (no target job required)
   *   tailoring:  tailoring to a specific job (target job selected)
   *   validation: final preflight before export
   */
  const [builderStage, setBuilderStage] = useState<BuilderStage>('partial');

  /**
   * Selected section in the live canvas. Drives two distinct modes:
   *
   *   RESUME_OVERVIEW_ID ('resume-overview'):
   *     The default state when the builder opens. The full resume is
   *     visible with no section highlighted. Callouts show the top
   *     cross-section issues from the canonical registry.
   *
   *   Any real section ID (e.g. 'experience', 'summary'):
   *     Section mode — the selected section is highlighted in the
   *     document, and only that section's callouts appear. Guidance
   *     narrows to the section's specific issues.
   */
  const [canvasSelectedSection, setCanvasSelectedSection] = useState<string | null>(RESUME_OVERVIEW_ID);

  /**
   * Edit-ready mode toggle. Controls two document states:
   *
   *   false (view mode):
   *     Resume looks polished and readable. Guidance may still be
   *     visible but editable affordances are quiet. This is the
   *     default state — the user sees a clean resume document.
   *
   *   true (edit-ready mode):
   *     Editable regions inside the selected section become visibly
   *     activated with subtle highlights, outlines, and edit cursors.
   *     The user understands that editing happens directly on the
   *     document. The layout does NOT change — only affordances appear.
   */
  const [isEditReady, setIsEditReady] = useState(false);

  /**
   * Preview overlay visibility. When true, a read-only clean presentation
   * of the resume replaces the editing canvas. The user can review the
   * resume before considering it finalized.
   */
  const [showPreview, setShowPreview] = useState(false);

  /**
   * Versions panel visibility. When true, a sidebar/modal shows saved
   * resume versions with restore/delete actions.
   */
  const [showVersions, setShowVersions] = useState(false);

  /**
   * New resume creation modal visibility. When true, shows a lightweight
   * form for creating a new resume version from the current draft.
   */
  const [showNewResumeModal, setShowNewResumeModal] = useState(false);

  /**
   * RESUME SWITCH CONFIRMATION — tracks pending version switch.
   *
   * When the user selects a different resume version from the dropdown
   * and the current draft may have unsaved changes, we store the
   * pending version ID here. A confirmation dialog appears giving the
   * user the option to save current changes first, discard and switch,
   * or cancel. Null means no pending switch.
   */
  const [pendingSwitchVersionId, setPendingSwitchVersionId] = useState<string | null>(null);

  /**
   * SELECTED RESUME VERSION ID — tracks which resume version is active.
   *
   * 'master' = the default resume draft.
   * Any other string = a saved version snapshot.
   * When the user restores a version or creates one, this updates
   * to reflect which version's data is currently loaded.
   */
  const [selectedResumeId, setSelectedResumeId] = useState<string>('master');

  /**
   * MASTER DRAFT BACKUP — stores a snapshot of the default resume draft
   * before the user switches to a saved version. This allows "discard
   * and switch back to Default Resume" to correctly restore the original
   * draft content, instead of leaving the user stranded with the
   * version's content labeled as "Default Resume."
   *
   * Set when switching away from master for the first time. Cleared
   * when the user explicitly saves or the backup is consumed.
   */
  const masterDraftBackupRef = useRef<ResumeDraft | null>(null);

  /**
   * FULL-DOCUMENT REVIEW — flag to show the full-resume PathAdvisor
   * review overlay. When true, the PathAdvisor modal opens with a
   * full-document review context that provides a structured evaluation
   * of the entire resume.
   */
  const [showFullReview, setShowFullReview] = useState(false);

  /**
   * Active callout ID for the callout layer. Tracks which callout
   * card is currently expanded/active.
   */
  const [activeCalloutId, setActiveCalloutId] = useState<string | null>(null);

  /**
   * RESOLVED ANNOTATION IDS — tracks which annotations have been applied.
   * When a suggestion is applied, the annotation ID is added here so it
   * gets marked as resolved in the annotations list and the section
   * status/readiness update accordingly.
   */
  const [resolvedAnnotationIds, setResolvedAnnotationIds] = useState<Record<string, boolean>>({});

  /**
   * APPLIED FEEDBACK — temporary confirmation state after applying a
   * suggestion. Shows a brief "Applied!" toast indicator. Each entry
   * contains the annotation ID and a timestamp for auto-clearing.
   */
  const [appliedFeedback, setAppliedFeedback] = useState<{
    annotationId: string;
    label: string;
    timestamp: number;
  } | null>(null);

  /**
   * PATHADVISOR MODAL STATE — controls the on-demand explanation modal.
   *
   * When a user clicks an explain trigger (issue / section / overview),
   * handleExplainRequest builds a grounded context and opens the modal.
   * The modal renders a structured explanation immediately — no typing
   * required. The user can apply suggestions, edit first, ask follow-up,
   * or close and return to the builder.
   */
  const [pathAdvisorModalOpen, setPathAdvisorModalOpen] = useState(false);
  const [pathAdvisorModalContext, setPathAdvisorModalContext] = useState<PathAdvisorResumeContext | null>(null);

  /**
   * CONTENT-AWARE TAILORING ANNOTATIONS — dynamically computed from draft.
   *
   * Instead of a static mock list that always shows "Incomplete contact"
   * or "Citizenship missing" regardless of actual document content, these
   * annotations are derived from the live resume draft. This prevents
   * false-positive guidance labels (e.g. claiming citizenship is missing
   * when the document visibly shows "U.S. Citizen").
   *
   * The contact section is evaluated at the field level — each subfield
   * (name, email, phone, location, citizenship, veteran preference) is
   * checked independently. Only genuinely missing fields produce annotations.
   */
  const tailoringAnnotations: TailoringAnnotation[] = useMemo(function () {
    const draft = store.draft;
    const annotations: TailoringAnnotation[] = [];

    /* ---- Contact / Identity: field-level evaluation ----
     * Each subfield is checked independently. This is the core fix for
     * false-positive labels. If citizenship IS present, we never generate
     * a "citizenship missing" annotation. If only veteran preference is
     * missing, the label says exactly that. */
    const missingContactFields = getMissingContactFields(draft);
    const contactLabel = buildContactGuidanceLabel(missingContactFields);
    if (contactLabel) {
      annotations.push({
        id: 'ann-contact-incomplete',
        annotationClass: 'alignment' as const,
        subType: 'requirement-gap' as const,
        anchorId: 'contact-header',
        label: contactLabel,
        description: 'Federal applications require full contact and eligibility details. Missing: ' + missingContactFields.join(', ') + '.',
        severity: missingContactFields.length >= 3 ? 'high' as const : 'medium' as const,
        resolved: false,
      });
    }

    /* ---- Professional Summary ---- */
    const hasSummary = draft.summary && draft.summary.trim().length >= 10;
    if (!hasSummary) {
      annotations.push({
        id: 'ann-summary-gap',
        annotationClass: 'alignment' as const,
        subType: 'requirement-gap' as const,
        anchorId: 'summary-summary-block-0',
        label: 'Summary missing for screening',
        description: 'A professional summary is the first thing HR reads. Missing it weakens your opening impression.',
        severity: 'high' as const,
        resolved: false,
      });
    }

    /* ---- Work Experience: content-quality annotations ---- */
    if (draft.experience.length > 0) {
      annotations.push({
        id: 'ann-exp-weak-bullet',
        annotationClass: 'evidence' as const,
        subType: 'weak-evidence' as const,
        anchorId: 'experience-bullet-exp-1-b2',
        label: 'Strengthen leadership bullet',
        description: 'This bullet lacks federal-specific scope and quantified outcomes that GS-13/14 positions require.',
        severity: 'high' as const,
        resolved: false,
        suggestedText: 'Directed vulnerability assessment and penetration testing operations across 12 DoD network enclaves, identifying and remediating 200+ critical vulnerabilities annually, reducing organizational cyber risk exposure by 35%.',
      });
      annotations.push({
        id: 'ann-exp-missing-metrics',
        annotationClass: 'evidence' as const,
        subType: 'missing-metrics' as const,
        anchorId: 'experience-bullet-exp-2-b2',
        label: 'Add metrics to incident response',
        description: 'Incident response bullet is too brief. Add frequency, scope, and documented outcomes.',
        severity: 'medium' as const,
        resolved: false,
        suggestedText: 'Performed incident response activities across 15+ VA healthcare facilities, resolving an average of 8 security incidents per month with 99.2% containment rate and documented root-cause analysis for each event.',
      });
      annotations.push({
        id: 'ann-exp-compression',
        annotationClass: 'compression' as const,
        subType: 'too-long' as const,
        anchorId: 'experience-bullet-exp-1-b0',
        label: 'Consider compressing',
        description: 'This bullet is strong but lengthy. Tightening could help fit the 2-page limit.',
        severity: 'low' as const,
        resolved: false,
      });
    }

    /* ---- Education ---- */
    if (draft.education.length > 0) {
      annotations.push({
        id: 'ann-education-detail',
        annotationClass: 'alignment' as const,
        subType: 'requirement-gap' as const,
        anchorId: 'education-entry-1',
        label: 'Education detail gap',
        description: 'Ensure degree type, field of study, institution, and graduation date are all clearly listed for federal compliance.',
        severity: 'low' as const,
        resolved: false,
      });
    }

    /* ---- Skills ---- */
    annotations.push({
      id: 'ann-skills-keyword',
      annotationClass: 'alignment' as const,
      subType: 'missing-keyword' as const,
      anchorId: 'skills-skill-item-0',
      label: 'Missing target keywords',
      description: 'Zero Trust Architecture and FISMA Compliance are in the announcement but not in your skills.',
      severity: 'high' as const,
      resolved: false,
      suggestedText: 'Zero Trust Architecture, FISMA Compliance',
    });

    /* ---- Certifications ---- */
    annotations.push({
      id: 'ann-certs-missing-relevant',
      annotationClass: 'alignment' as const,
      subType: 'requirement-gap' as const,
      anchorId: 'certifications-section-0',
      label: 'Target-relevant certification missing',
      description: 'The job announcement references CISSP and Security+ certifications. Adding relevant certs strengthens your qualification claim.',
      severity: 'medium' as const,
      resolved: false,
    });

    /* ---- Federal Details ---- */
    annotations.push({
      id: 'ann-federal-missing',
      annotationClass: 'alignment' as const,
      subType: 'requirement-gap' as const,
      anchorId: 'federal-details-field-0',
      label: 'Missing required federal fields',
      description: 'Security clearance level, veteran preference, and highest grade held are required for federal applications.',
      severity: 'high' as const,
      resolved: false,
    });

    /* ---- Supporting Evidence ---- */
    annotations.push({
      id: 'ann-evidence-missing',
      annotationClass: 'evidence' as const,
      subType: 'unquantified-claim' as const,
      anchorId: 'supporting-evidence-section-0',
      label: 'Missing quantified support',
      description: 'Key experience claims lack supporting evidence. Add specific metrics, awards, or project outcomes.',
      severity: 'medium' as const,
      resolved: false,
    });

    /* APPLIED SUGGESTION RESOLUTION: Mark annotations as resolved when
     * the user has applied the suggestion. This updates section statuses
     * and readiness score because the annotations feed into section
     * progress via useSectionProgress. The user sees immediate state
     * changes across the rail and top bar after applying. */
    for (let k = 0; k < annotations.length; k++) {
      if (resolvedAnnotationIds[annotations[k].id]) {
        annotations[k] = Object.assign({}, annotations[k], { resolved: true });
      }
    }

    return annotations;
  }, [store.draft, resolvedAnnotationIds]);

  /**
   * Anchor map hook — manages the anchor registry for callout positioning.
   * Canvas section wrappers call registerAnchor on mount. The anchor map
   * is used to determine which sections have callout-capable regions and
   * to track DOM positions for connector lines.
   */
  const anchorMapHook = useAnchorMap();

  /**
   * Canonical callout registry — declarative registry of all possible
   * callout targets per resume section. This is the single source of
   * truth for "which callouts can appear for this section." Built once
   * and stable across renders.
   */
  const canonicalRegistry: CanonicalCalloutRegistry = useMemo(function () {
    return buildCanonicalCalloutRegistry();
  }, []);

  /**
   * Section progress hook — computes progress from draft + annotations.
   */
  const { sectionProgressList } = useSectionProgress(
    store ? store.draft : null,
    tailoringAnnotations
  );

  /**
   * EVIDENCE-BASED SCORING — deterministic, explainable section scores.
   * Runs the evidence scoring engine across all canonical sections,
   * producing per-section composite scores and typed issues that
   * distinguish missing fields from weak evidence. Used for the
   * overall readiness calculation and future explainability UI.
   *
   * Uses the screen-level federal details and certifications data
   * (currently mocked, will come from core model in a future pass).
   */
  const evidenceScores: SectionEvidenceScore[] = useMemo(function () {
    if (!store) return [];
    return scoreAllSections(
      store.draft,
      MOCK_FEDERAL_DETAILS,
      MOCK_CERTIFICATIONS
    );
  }, [store]);

  // =========================================================================
  // CALLOUT LINE OVERLAY — precision annotation lines from resume to guidance
  // =========================================================================
  //
  // Callout lines visually connect specific content inside the resume to
  // small white endpoint circles outside the document boundary. They appear
  // only when a section is selected in tailoring stage, providing focused
  // guidance without cluttering the UI.

  /**
   * Ref to the resume document panel DOM element. The callout line hook
   * uses this to measure anchor positions relative to the document boundary.
   */
  const documentPanelRef = useRef<HTMLDivElement>(null);

  /**
   * Ref to the callout line overlay container. The SVG overlay is
   * absolutely positioned inside this container, which spans the
   * full canvas + right margin area.
   */
  const calloutLineOverlayRef = useRef<HTMLDivElement>(null);

  /**
   * Ref to the canvas scroll container. The callout line hook attaches
   * a scroll listener to this element so overlay geometry remeasures
   * as the user scrolls the resume document. Without this, callout
   * lines drift away from their anchor points on scroll.
   */
  const canvasScrollContainerRef = useRef<HTMLDivElement>(null);

  /**
   * Whether the builder is in Resume Overview mode. In overview mode,
   * the full resume is visible with cross-section callouts showing
   * the highest-priority issues. In section mode, callouts narrow to
   * the selected section's specific issues.
   */
  const isOverviewMode = canvasSelectedSection === RESUME_OVERVIEW_ID;

  /**
   * Callout line definitions — two distinct generation strategies:
   *
   * OVERVIEW MODE (canvasSelectedSection === RESUME_OVERVIEW_ID):
   *   Cross-section callouts from the canonical registry's overview
   *   prioritization. Shows the top N highest-priority issues across
   *   the whole resume. Calm and readable — not every possible issue.
   *
   * SECTION MODE (any real section ID):
   *   Section-filtered callouts from tailoring annotations + canonical
   *   fallbacks. More granular field-level callouts within that section.
   *   Guidance narrows to the section's specific issues.
   */
  const calloutLineDefs: CalloutLineDef[] = useMemo(function () {
    if (!canvasSelectedSection) return [];
    if (builderStage === 'validation') return [];

    /* ================================================================
     * OVERVIEW MODE: cross-section prioritized callouts
     * ================================================================
     * Shows the most important issue from each section, sorted by
     * severity, capped at 6. The user sees "here are the most
     * important things to fix" across the whole resume. */
    if (canvasSelectedSection === RESUME_OVERVIEW_ID) {
      /* Use evidence-informed prioritization when scores are available,
       * falling back to the standard severity-based overview otherwise.
       * This ensures federal requirement gaps and low-scoring sections
       * are surfaced first in the overview. */
      const overviewTargets = getEvidenceInformedOverviewTargets(canonicalRegistry, evidenceScores);
      const defs: CalloutLineDef[] = [];

      for (let i = 0; i < overviewTargets.length; i++) {
        const target = overviewTargets[i];
        defs.push({
          id: 'cl-overview-' + target.id,
          anchor: {
            anchorId: target.anchorId,
            sectionId: target.sectionId,
            label: target.anchorLabel,
            annotationClass: target.annotationClass,
          },
          headline: target.headline,
          description: target.description,
          severity: target.severity,
        });
      }

      return defs;
    }

    /* ================================================================
     * SECTION MODE: section-filtered annotation + canonical callouts
     * ================================================================
     * Build callout line definitions from two sources:
     *   1. Tailoring annotations (content-specific, higher priority)
     *   2. Canonical registry fallbacks (section-level defaults)
     *
     * Annotation-based lines are preferred when they exist because
     * they provide content-specific guidance. Canonical targets serve
     * as fallback so every section always has at least one callout. */
    const defs: CalloutLineDef[] = [];
    const usedAnchorIds: Record<string, boolean> = {};

    /* PASS 1: Build lines from tailoring annotations (content-specific).
     * These take priority over canonical targets. */
    for (let i = 0; i < tailoringAnnotations.length; i++) {
      const ann = tailoringAnnotations[i];
      if (ann.resolved) continue;

      /* Map annotation anchor IDs to data-callout-anchor values.
       * The existing annotations use IDs like "experience-bullet-exp-1-b2"
       * which map to data-callout-anchor="bullet-exp-1-2" in the canvas.
       * We also support direct anchor IDs for summary, skills, etc. */
      let calloutAnchorId = '';
      let sectionId = '';
      const anchorId = ann.anchorId;

      if (anchorId.startsWith('summary-')) {
        calloutAnchorId = 'summary-text';
        sectionId = 'summary';
      } else if (anchorId.startsWith('skills-')) {
        calloutAnchorId = 'skills-block';
        sectionId = 'skills';
      } else if (anchorId.startsWith('experience-bullet-')) {
        /* Convert "experience-bullet-exp-1-b2" → "bullet-exp-1-2" */
        const bulletPart = anchorId.replace('experience-', '');
        const bMatch = bulletPart.match(/^bullet-(exp-\d+)-b(\d+)$/);
        if (bMatch) {
          calloutAnchorId = 'bullet-' + bMatch[1] + '-' + bMatch[2];
        }
        sectionId = 'experience';
      } else if (anchorId.startsWith('education-')) {
        calloutAnchorId = 'education-section-anchor';
        sectionId = 'education';
      } else if (anchorId.startsWith('contact-')) {
        calloutAnchorId = 'contact-header';
        sectionId = 'contact';
      } else if (anchorId.startsWith('certifications-')) {
        calloutAnchorId = 'certifications-section-anchor';
        sectionId = 'certifications';
      } else if (anchorId.startsWith('federal-details-') || anchorId.startsWith('federal-')) {
        calloutAnchorId = 'federal-details-section-anchor';
        sectionId = 'federal-details';
      } else if (anchorId.startsWith('supporting-evidence-')) {
        calloutAnchorId = 'supporting-evidence-section-anchor';
        sectionId = 'supporting-evidence';
      }

      if (!calloutAnchorId) continue;
      if (sectionId !== canvasSelectedSection) continue;

      usedAnchorIds[calloutAnchorId] = true;

      defs.push({
        id: 'cl-' + ann.id,
        anchor: {
          anchorId: calloutAnchorId,
          sectionId: sectionId,
          label: ann.label,
          annotationClass: ann.annotationClass,
        },
        headline: ann.label,
        description: ann.description,
        severity: ann.severity,
      });
    }

    /* PASS 2: Fill from canonical registry if the selected section has
     * canonical targets that were not already covered by annotations.
     * Uses content-aware filtering to prevent false-positive targets
     * (e.g. "Citizenship missing" when citizenship is visibly present).
     * This ensures every section has at least one callout target, but
     * only targets that actually apply to the current document state. */
    const rawCanonicalTargets = getCanonicalTargetsForSection(canonicalRegistry, canvasSelectedSection);
    const canonicalTargets = filterCanonicalTargetsForContent(rawCanonicalTargets, canvasSelectedSection, store.draft);
    for (let i = 0; i < canonicalTargets.length; i++) {
      const target = canonicalTargets[i];
      if (usedAnchorIds[target.anchorId]) continue;

      usedAnchorIds[target.anchorId] = true;

      defs.push({
        id: 'cl-canon-' + target.id,
        anchor: {
          anchorId: target.anchorId,
          sectionId: canvasSelectedSection,
          label: target.anchorLabel,
          annotationClass: target.annotationClass,
        },
        headline: target.headline,
        description: target.description,
        severity: target.severity,
      });
    }

    return defs;
  }, [tailoringAnnotations, canvasSelectedSection, builderStage, canonicalRegistry]);

  /**
   * Callout line overlay configuration — differs between modes:
   *
   * OVERVIEW MODE:
   *   - Section filtering OFF (lines span all sections)
   *   - Max 6 lines (the overview prioritization already caps)
   *   - Calm, cross-section view
   *
   * SECTION MODE:
   *   - Section filtering ON (only the selected section's lines)
   *   - Max 4 lines (more granular, within one section)
   */
  const calloutLineConfig: CalloutLineOverlayConfig = useMemo(function () {
    if (isOverviewMode) {
      return {
        enabled: true,
        maxLines: 6,
        filterToSelectedSection: false,
      };
    }
    return buildDefaultCalloutLineConfig();
  }, [isOverviewMode]);

  /**
   * Callout lines hook — computes geometry from anchor DOM positions.
   * Handles measurement, resize tracking, and hover state management.
   */
  const calloutLinesHook = useCalloutLines(
    calloutLineDefs,
    calloutLineConfig,
    documentPanelRef,
    calloutLineOverlayRef,
    canvasSelectedSection,
    canvasScrollContainerRef
  );

  /**
   * Scroll-to-section effect. When the selected section changes (from
   * the rail or from clicking in the canvas), the document scrolls the
   * corresponding section wrapper into view. This ensures the selected
   * section is always visible without replacing the document with a
   * detached panel. Uses smooth scrolling for a calm, polished feel.
   *
   * In OVERVIEW MODE, we scroll to the top of the document instead of
   * a specific section, since the full resume should be visible.
   */
  useEffect(function () {
    if (!canvasSelectedSection) return;

    /* In overview mode, scroll to the top of the document so the user
     * sees the full resume from the beginning. */
    if (canvasSelectedSection === RESUME_OVERVIEW_ID) {
      const scrollContainer = canvasScrollContainerRef.current;
      if (scrollContainer) {
        const timer = setTimeout(function () {
          scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
        }, 60);
        return function () { clearTimeout(timer); };
      }
      return;
    }

    /* Find the section wrapper by its data-section-id attribute inside
     * the document panel. The CanvasSectionWrapper sets this attribute. */
    const panel = documentPanelRef.current;
    if (!panel) return;
    const sectionEl = panel.querySelector(
      '[data-section-id="' + canvasSelectedSection + '"]'
    );
    if (!sectionEl) return;

    /* Use a short delay so the DOM has settled after any re-render.
     * scrollIntoView with 'smooth' and 'nearest' block alignment
     * avoids jarring jumps when the section is already partially visible. */
    const timer = setTimeout(function () {
      sectionEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
    return function () { clearTimeout(timer); };
  }, [canvasSelectedSection]);

  /**
   * TAILORING COMPLETENESS — determines whether the Validation tab is enabled.
   *
   * Tailoring is considered "complete enough" to enter validation when
   * the resume has meaningful content in the core sections. This replaces
   * the previous hardcoded `false` that permanently disabled validation.
   *
   * The threshold is deliberately low — users should be able to validate
   * early and often, not only after perfecting every section. The
   * validation checklist itself will flag what's missing.
   *
   * Conditions for tailoring complete:
   *   1. At least one experience entry exists
   *   2. Summary is non-empty
   *   3. A target job is selected (already gated by hasTargetJob in stage tabs)
   */
  const computedTailoringComplete = useMemo(function () {
    if (!store) return false;
    const hasSummary = store.draft.summary !== null && store.draft.summary !== undefined && store.draft.summary.trim().length > 0;
    const hasExperience = store.draft.experience.length > 0;
    return hasSummary && hasExperience;
  }, [store]);

  /**
   * PAGE COUNT ESTIMATION — approximate page count from resume content.
   *
   * A proper page count would require measuring rendered DOM height,
   * but that is not available during the memoized computation phase.
   * Instead, we estimate based on content volume using federal resume
   * conventions: ~45 lines per page for single-spaced 11pt body text.
   *
   * The estimate counts:
   *   - Contact header: ~4 lines
   *   - Summary: ~3 lines base + 1 per 100 chars
   *   - Each experience entry: ~4 lines + 1 per bullet (split on newlines)
   *   - Each education entry: ~3 lines
   *   - Certifications: ~2 lines if present
   *   - Skills: ~2 lines if present
   *   - Federal details: ~3 lines
   *   - Supporting evidence: ~1 line per item
   *
   * This approximation rounds to 1 decimal place and clamps between
   * 0.5 and 5.0 for display sanity.
   */
  const computedPageCount = useMemo(function () {
    if (!store) return 1.0;
    const draft = store.draft;
    const LINES_PER_PAGE = 45;
    let lineCount = 4; /* contact header */

    /* Summary */
    if (draft.summary && draft.summary.trim().length > 0) {
      lineCount = lineCount + 3 + Math.floor(draft.summary.length / 100);
    }

    /* Experience entries */
    for (let i = 0; i < draft.experience.length; i++) {
      const exp = draft.experience[i];
      lineCount = lineCount + 4;
      if (exp.duties && exp.duties.trim().length > 0) {
        const bulletLines = exp.duties.split('\n');
        for (let j = 0; j < bulletLines.length; j++) {
          if (bulletLines[j].trim().length > 0) {
            lineCount = lineCount + 1 + Math.floor(bulletLines[j].length / 80);
          }
        }
      }
    }

    /* Education */
    lineCount = lineCount + (draft.education.length * 3);

    /* Certifications */
    if (draft.certifications && draft.certifications.length > 0) {
      lineCount = lineCount + 2;
    }

    /* Skills */
    if (draft.skills.length > 0) {
      lineCount = lineCount + 2;
    }

    /* Federal details (always present as a section) */
    lineCount = lineCount + 3;

    /* Supporting evidence */
    if (draft.supportingEvidence) {
      lineCount = lineCount + draft.supportingEvidence.length;
    }

    const rawPages = lineCount / LINES_PER_PAGE;
    /* Clamp between 0.5 and 5.0, round to 1 decimal */
    const clamped = Math.max(0.5, Math.min(5.0, rawPages));
    return Math.round(clamped * 10) / 10;
  }, [store]);

  /**
   * Preflight state — computed from resume state for validation stage.
   *
   * Uses real resume data where available instead of hardcoded stubs.
   * The page count comes from computedPageCount (content-based estimate).
   * Required sections are checked against what a federal resume needs.
   * Federal details completeness is approximated from contact data.
   * Evidence coverage uses summary + skills as a minimum bar.
   * Critical issues count unresolved high-severity callouts.
   */
  const computedPreflightState: PreflightState | null = useMemo(function () {
    if (builderStage !== 'validation') return null;
    if (!store) return null;

    const summaryPresent = store.draft.summary !== null && store.draft.summary !== undefined && store.draft.summary.trim().length > 0;
    const hasExperience = store.draft.experience.length > 0;
    const hasEducation = store.draft.education.length > 0;
    const hasSkills = store.draft.skills.length > 0;

    /* Federal details: check if contact has the key federal fields.
     * A real implementation would check series, grade, citizenship etc.
     * For now, check that contact has name + email + phone as minimum. */
    const c = store.draft.contact;
    const hasBasicContact = (
      c.fullName !== null && c.fullName !== undefined && c.fullName.trim().length > 0 &&
      c.email !== null && c.email !== undefined && c.email.trim().length > 0
    );
    const federalDetailsComplete = hasBasicContact && hasExperience;

    /* Critical issue count: count high-severity unresolved callouts */
    let criticalCount = 0;
    if (!summaryPresent) criticalCount = criticalCount + 1;
    for (let i = 0; i < sectionProgressList.length; i++) {
      criticalCount = criticalCount + sectionProgressList[i].highSeverityIssueCount;
    }

    const checks = buildPreflightChecks({
      pageCount: computedPageCount,
      pageLimit: 2,
      requiredSectionsPresent: hasExperience && hasEducation && summaryPresent,
      federalDetailsComplete: federalDetailsComplete,
      evidenceCoverageAcceptable: summaryPresent && hasSkills,
      criticalIssueCount: criticalCount,
    });

    return buildPreflightState(checks);
  }, [builderStage, store, computedPageCount, sectionProgressList]);

  /**
   * Primary CTA configuration — derived from current stage and state.
   */
  const primaryCtaConfig = useMemo(function () {
    const hasTarget = activeTargetJobId !== null;
    let pendingCount = 0;
    for (let i = 0; i < proposals.length; i++) {
      if (proposals[i].status === 'pending') {
        pendingCount = pendingCount + 1;
      }
    }
    return buildPrimaryCtaConfig(builderStage, hasTarget, pendingCount > 0);
  }, [builderStage, activeTargetJobId, proposals]);

  /**
   * Callout annotations filtered to the active scope.
   *
   * OVERVIEW MODE:
   *   Returns all unresolved annotations sorted by severity (high first).
   *   The callout layer shows a compact summary of cross-section issues.
   *
   * SECTION MODE:
   *   Returns only annotations for the selected section. Uses anchor ID
   *   prefix matching with special handling for compound section IDs.
   */
  const selectedSectionAnnotations = useMemo(function (): TailoringAnnotation[] {
    if (!canvasSelectedSection) return [];

    /* In overview mode, return all unresolved annotations sorted by
     * severity so the guidance layer can show cross-section summaries. */
    if (canvasSelectedSection === RESUME_OVERVIEW_ID) {
      const unresolvedAnns: TailoringAnnotation[] = [];
      for (let i = 0; i < tailoringAnnotations.length; i++) {
        if (!tailoringAnnotations[i].resolved) {
          unresolvedAnns.push(tailoringAnnotations[i]);
        }
      }
      /* Sort: high > medium > low */
      const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      unresolvedAnns.sort(function (a, b) {
        const aVal = severityOrder[a.severity] !== undefined ? severityOrder[a.severity] : 2;
        const bVal = severityOrder[b.severity] !== undefined ? severityOrder[b.severity] : 2;
        return aVal - bVal;
      });
      return unresolvedAnns;
    }

    /**
     * Determine if an annotation belongs to the selected section by
     * checking the anchor ID prefix. Most sections use their section
     * ID as the prefix, but some need special handling.
     */
    function annotationMatchesSection(anchorId: string, sectionId: string): boolean {
      if (sectionId === 'federal-details') {
        return anchorId.startsWith('federal-details-') || anchorId.startsWith('federal-');
      }
      if (sectionId === 'supporting-evidence') {
        return anchorId.startsWith('supporting-evidence-');
      }
      return anchorId.startsWith(sectionId);
    }

    const result: TailoringAnnotation[] = [];
    for (let i = 0; i < tailoringAnnotations.length; i++) {
      if (annotationMatchesSection(tailoringAnnotations[i].anchorId, canvasSelectedSection)) {
        result.push(tailoringAnnotations[i]);
      }
    }
    return result;
  }, [canvasSelectedSection, tailoringAnnotations]);

  /* ---- PathAdvisor screen overrides ---- */
  const setOverrides = usePathAdvisorScreenOverridesStore(function (s) { return s.setOverrides; });

  /* ---- Persist helper: update both React state and core localStorage ---- */
  const persist = useCallback(function (next: ResumeStore) {
    setStore(next);
    saveResumeStore(next);
  }, []);

  /* ---- Initialization: load resume + saved jobs, seed if empty ---- */
  useEffect(function () {
    /* Load resume store; seed with mock data if empty. */
    const loaded = loadResumeStore();
    let finalStore = loaded;
    const hasContent = loaded.draft.contact.fullName && loaded.draft.contact.fullName.trim();
    if (!hasContent) {
      /* Resume is empty — seed with realistic mock data for the workspace demo. */
      const mockDraft = createMockResumeDraft();
      finalStore = { schemaVersion: loaded.schemaVersion, draft: mockDraft, versions: loaded.versions };
      saveResumeStore(finalStore);
    }

    /* Load saved jobs store; seed with mock data if empty. */
    const savedJobsStore = loadSavedJobsStore();
    const seeded = seedSavedJobsIfEmpty(savedJobsStore);
    const jobs = seeded.jobs;
    setSavedJobs(jobs);

    /* Auto-select first saved job as target if available. */
    if (jobs.length > 0) {
      setActiveTargetJobId(jobs[0].id);
    }

    /* Build bullet view model from experience entries. */
    const bMap = buildBulletMap(finalStore.draft.experience);
    setBulletMap(bMap);

    /*
     * Phase 2: Generate initial proposals based on the seeded resume and
     * the auto-selected target job. This sets the starting state for the
     * Suggested Changes tab before the user has interacted.
     */
    let initialTargetJob: Job | null = null;
    if (jobs.length > 0) {
      initialTargetJob = jobs[0];
    }
    const initialProposals = generateProposals(finalStore.draft, initialTargetJob);
    setProposals(initialProposals);

    setStore(finalStore);
    setMounted(true);
  }, []);

  /*
   * ---- PathAdvisor: minimal route overrides ----
   *
   * The PathAdvisor right rail is hidden for Resume Builder (see
   * SharedDashboardRouteShell hideAdvisor). The builder uses its own
   * section-scoped callout layer instead. These overrides still set
   * screen context and suggested prompts so PathAdvisor retains
   * resume-builder awareness for any floating or mobile access paths.
   */
  useEffect(function () {
    setOverrides({
      screenId: 'resume-builder',
      viewingLabel: 'Resume Builder',
      suggestedPrompts: RESUME_BUILDER_ADVISOR_PROMPTS,
      briefingLabel: 'From Resume Builder',
      briefingHelperText: 'Ask deeper questions here.',
      composerPlaceholder: 'Ask PathAdvisor about your resume...',
    });

    return function () {
      setOverrides(null);
    };
  }, [setOverrides]);

  /* ---- Find the active target job object ---- */
  const activeJob = useMemo(function () {
    if (!activeTargetJobId) return null;
    for (let i = 0; i < savedJobs.length; i++) {
      if (savedJobs[i].id === activeTargetJobId) {
        return savedJobs[i];
      }
    }
    return null;
  }, [savedJobs, activeTargetJobId]);

  /* ---- Version count ---- */
  const versionCount = useMemo(function () {
    return listVersions(store).length;
  }, [store]);

  /*
   * ---- Phase 2: Derived proposal metrics ----
   * Computed from the live proposals array so that the context strip,
   * tab badge, intelligence strip, and coverage map all stay in sync
   * whenever a proposal is accepted, rejected, or regenerated.
   */
  const pendingProposalCount = useMemo(function () {
    let count = 0;
    for (let i = 0; i < proposals.length; i++) {
      if (proposals[i].status === 'pending') {
        count = count + 1;
      }
    }
    return count;
  }, [proposals]);

  /*
   * ---- Phase 2: Coverage dimensions ----
   * Derived from the active resume draft and target job. Recalculates
   * when the draft changes (e.g., summary added via proposal accept)
   * or when the target job changes.
   */
  const coverageDimensions = useMemo(function () {
    return generateCoverageDimensions(store.draft, activeJob);
  }, [store.draft, activeJob]);

  /*
   * ---- Phase 2: Dynamic intelligence values ----
   * Replace the Phase 1 hardcoded mock values with values derived from
   * the coverage dimensions and proposal state. Match score is the
   * average of all coverage dimensions; readiness is slightly higher
   * to reflect resume completeness vs job alignment distinction.
   */
  const computedMatchScore = useMemo(function () {
    if (!activeJob) return 0;
    let total = 0;
    for (let i = 0; i < coverageDimensions.length; i++) {
      total = total + coverageDimensions[i].scorePct;
    }
    return coverageDimensions.length > 0
      ? Math.round(total / coverageDimensions.length)
      : 0;
  }, [activeJob, coverageDimensions]);

  const computedReadinessScore = useMemo(function () {
    /* EVIDENCE-BASED READINESS: When evidence scores are available, derive
     * readiness from the deterministic scoring engine. This produces a more
     * defensible and explainable overall readiness number that considers
     * field completion, evidence strength, target relevance, and federal
     * requirement coverage — weighted by section importance.
     *
     * Falls back to the section-progress-based readiness when evidence
     * scores are not yet computed (preserving backward compatibility). */
    if (evidenceScores.length > 0) {
      return deriveEvidenceBasedReadiness(evidenceScores);
    }
    if (sectionProgressList.length > 0) {
      return deriveOverallReadiness(sectionProgressList);
    }
    /* Final fallback when nothing is computed yet */
    const boost = store.draft.summary && store.draft.summary.trim() ? 6 : 0;
    return Math.min(100, computedMatchScore + boost + 14);
  }, [evidenceScores, sectionProgressList, computedMatchScore, store.draft.summary]);

  const computedTopGap = useMemo(function () {
    /* Find the weakest dimension for the "top gap" display */
    let weakest: CoverageDimension | null = null;
    for (let i = 0; i < coverageDimensions.length; i++) {
      if (weakest === null || coverageDimensions[i].scorePct < weakest.scorePct) {
        weakest = coverageDimensions[i];
      }
    }
    if (!activeJob) return 'Select a target job';
    if (weakest) return weakest.label + ' (' + weakest.scorePct + '%)';
    return 'No gaps detected';
  }, [activeJob, coverageDimensions]);

  /*
   * ---- Phase 3: Computed "fastest win" ----
   * The highest-confidence pending proposal represents the fastest
   * improvement the user can make right now. This value feeds the
   * Resume Brief and helps the user understand their best next move
   * without scanning the full proposal queue.
   */
  const computedFastestWin = useMemo(function () {
    if (!activeJob) return 'Select a target job';
    let best: ResumeProposal | null = null;
    for (let i = 0; i < proposals.length; i++) {
      if (proposals[i].status !== 'pending') continue;
      if (best === null || proposals[i].confidence > best.confidence) {
        best = proposals[i];
      }
    }
    if (best) return best.title;
    return 'All proposals reviewed';
  }, [activeJob, proposals]);

  /*
   * ---- Active section metadata for the section editor header ----
   * Checks EDIT_SECTION_META first (for grouped sections like
   * 'identity-summary'), then falls back to MOCK_SECTION_META for
   * individual section IDs used by proposal/coverage logic.
   */
  const activeSectionMeta = useMemo(function (): SectionMeta | null {
    for (let i = 0; i < EDIT_SECTION_META.length; i++) {
      if (EDIT_SECTION_META[i].id === activeSection) {
        return EDIT_SECTION_META[i];
      }
    }
    for (let i = 0; i < MOCK_SECTION_META.length; i++) {
      if (MOCK_SECTION_META[i].id === activeSection) {
        return MOCK_SECTION_META[i];
      }
    }
    return null;
  }, [activeSection]);

  /* ---- Handler: change target job ---- */
  /*
   * Phase 2 hardening: switching target jobs now explicitly regenerates
   * the broader proposal set and coverage diagnostics. The resume text
   * is never auto-mutated — only the analysis context changes.
   */
  const handleTargetJobChange = useCallback(function (jobId: string | null) {
    setActiveTargetJobId(jobId);

    /* Resolve the new job object from saved jobs */
    let newJob: Job | null = null;
    if (jobId) {
      for (let i = 0; i < savedJobs.length; i++) {
        if (savedJobs[i].id === jobId) {
          newJob = savedJobs[i];
          break;
        }
      }
    }

    /* Regenerate proposals for the new target job context */
    const newProposals = generateProposals(store.draft, newJob);
    setProposals(newProposals);
  }, [savedJobs, store.draft]);

  /*
   * ---- Handler: section click (from dashboard card or cross-tab jump) ----
   * Sets the active section and switches Edit to focused mode so the
   * center surface renders only the selected section's editor.
   */
  const handleSectionClick = useCallback(function (sectionId: SectionId) {
    setActiveSection(sectionId);
    setEditMode('focused');
    /* Reset edit-ready mode when entering a new section so the user
     * always starts in the polished View mode for the new section. */
    setSectionEditReady(false);
  }, []);

  /*
   * ---- Handler: back to dashboard ----
   * Returns the Edit tab to the section dashboard overview. Clears any
   * in-progress editing state to prevent stale bullet or summary edits
   * from persisting across dashboard transitions.
   */
  const handleBackToDashboard = useCallback(function () {
    setEditMode('dashboard');
    setEditingBulletId(null);
    setActiveSuggestionBulletId(null);
    setEditingSummary(false);
    /* Reset edit-ready mode when returning to dashboard overview. */
    setSectionEditReady(false);
  }, []);

  /* ---- Handler: start editing a bullet ---- */
  const handleBulletEditStart = useCallback(function (bulletId: string, text: string) {
    setEditingBulletId(bulletId);
    setEditingBulletText(text);
    /* Clear any active suggestion when entering edit mode. */
    setActiveSuggestionBulletId(null);
  }, []);

  /* ---- Handler: bullet edit text change ---- */
  const handleBulletEditChange = useCallback(function (text: string) {
    setEditingBulletText(text);
  }, []);

  /* ---- Handler: save bullet edit — sync back to bullet VM and core store ---- */
  const handleBulletEditSave = useCallback(function () {
    if (!editingBulletId) return;

    /* Find which experience this bullet belongs to. */
    let targetExpId: string | null = null;
    const mapKeys = Object.keys(bulletMap);
    for (let k = 0; k < mapKeys.length; k++) {
      const expId = mapKeys[k];
      const bullets = bulletMap[expId];
      for (let b = 0; b < bullets.length; b++) {
        if (bullets[b].id === editingBulletId) {
          targetExpId = expId;
          break;
        }
      }
      if (targetExpId) break;
    }

    if (!targetExpId) {
      setEditingBulletId(null);
      return;
    }

    /* Update the bullet VM. */
    const expBullets = bulletMap[targetExpId] || [];
    const newBullets: ResumeBulletVM[] = [];
    for (let i = 0; i < expBullets.length; i++) {
      if (expBullets[i].id === editingBulletId) {
        newBullets.push({ id: expBullets[i].id, text: editingBulletText, health: expBullets[i].health });
      } else {
        newBullets.push(expBullets[i]);
      }
    }
    const newMap = Object.assign({}, bulletMap);
    newMap[targetExpId] = newBullets;
    setBulletMap(newMap);

    /* Sync back to core store: join bullets into duties string. */
    const duties = joinBulletsToDuties(newBullets);
    const newExperience: ResumeExperience[] = [];
    for (let i = 0; i < store.draft.experience.length; i++) {
      const exp = store.draft.experience[i];
      if (exp.id === targetExpId) {
        newExperience.push({
          id: exp.id,
          jobTitle: exp.jobTitle,
          employer: exp.employer,
          location: exp.location,
          startDate: exp.startDate,
          endDate: exp.endDate,
          hoursPerWeek: exp.hoursPerWeek,
          grade: exp.grade,
          duties: duties,
        });
      } else {
        newExperience.push(exp);
      }
    }
    const newDraft: ResumeDraft = {
      contact: store.draft.contact,
      summary: store.draft.summary,
      experience: newExperience,
      education: store.draft.education,
      skills: store.draft.skills,
    };
    persist(updateDraft(store, newDraft));

    setEditingBulletId(null);
    setEditingBulletText('');
  }, [editingBulletId, editingBulletText, bulletMap, store, persist]);

  /* ---- Handler: trigger rewrite for a bullet ---- */
  const handleBulletRewrite = useCallback(function (bulletId: string) {
    /*
     * Check if there's a pre-built suggestion for this bullet.
     * Match by checking the bullet's experience ID and index.
     */
    let matchFound = false;
    const mapKeys = Object.keys(bulletMap);
    for (let k = 0; k < mapKeys.length; k++) {
      const expId = mapKeys[k];
      if (expId !== MOCK_INLINE_SUGGESTION.experienceId) continue;
      const bullets = bulletMap[expId];
      for (let b = 0; b < bullets.length; b++) {
        if (bullets[b].id === bulletId && b === MOCK_INLINE_SUGGESTION.bulletIndex) {
          matchFound = true;
          break;
        }
      }
    }

    if (matchFound) {
      setActiveSuggestionBulletId(bulletId);
    }
  }, [bulletMap]);

  /* ---- Handler: accept suggestion — apply revised text to the bullet ---- */
  const handleSuggestionAccept = useCallback(function () {
    if (!activeSuggestionBulletId) return;

    /* Find which experience this bullet belongs to. */
    let targetExpId: string | null = null;
    const mapKeys = Object.keys(bulletMap);
    for (let k = 0; k < mapKeys.length; k++) {
      const expId = mapKeys[k];
      const bullets = bulletMap[expId];
      for (let b = 0; b < bullets.length; b++) {
        if (bullets[b].id === activeSuggestionBulletId) {
          targetExpId = expId;
          break;
        }
      }
      if (targetExpId) break;
    }

    if (!targetExpId) {
      setActiveSuggestionBulletId(null);
      return;
    }

    /* Update the bullet VM with the suggested text and mark as strong. */
    const expBullets = bulletMap[targetExpId] || [];
    const newBullets: ResumeBulletVM[] = [];
    for (let i = 0; i < expBullets.length; i++) {
      if (expBullets[i].id === activeSuggestionBulletId) {
        newBullets.push({
          id: expBullets[i].id,
          text: MOCK_INLINE_SUGGESTION.revisedText,
          health: 'strong',
        });
      } else {
        newBullets.push(expBullets[i]);
      }
    }
    const newMap = Object.assign({}, bulletMap);
    newMap[targetExpId] = newBullets;
    setBulletMap(newMap);

    /* Sync back to core store. */
    const duties = joinBulletsToDuties(newBullets);
    const newExperience: ResumeExperience[] = [];
    for (let i = 0; i < store.draft.experience.length; i++) {
      const exp = store.draft.experience[i];
      if (exp.id === targetExpId) {
        newExperience.push({
          id: exp.id,
          jobTitle: exp.jobTitle,
          employer: exp.employer,
          location: exp.location,
          startDate: exp.startDate,
          endDate: exp.endDate,
          hoursPerWeek: exp.hoursPerWeek,
          grade: exp.grade,
          duties: duties,
        });
      } else {
        newExperience.push(exp);
      }
    }
    const newDraft: ResumeDraft = {
      contact: store.draft.contact,
      summary: store.draft.summary,
      experience: newExperience,
      education: store.draft.education,
      skills: store.draft.skills,
    };
    persist(updateDraft(store, newDraft));

    setActiveSuggestionBulletId(null);
  }, [activeSuggestionBulletId, bulletMap, store, persist]);

  /* ---- Handler: Edit First — load suggestion into editable bullet state ---- */
  const handleSuggestionEditFirst = useCallback(function () {
    if (!activeSuggestionBulletId) return;
    /* Load the suggested text into the editing state so the user can modify it. */
    setEditingBulletId(activeSuggestionBulletId);
    setEditingBulletText(MOCK_INLINE_SUGGESTION.revisedText);
    setActiveSuggestionBulletId(null);
  }, [activeSuggestionBulletId]);

  /* ---- Handler: dismiss suggestion ---- */
  const handleSuggestionDismiss = useCallback(function () {
    setActiveSuggestionBulletId(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Phase 2 handlers: broader proposal actions (Suggested Changes tab)
  // ---------------------------------------------------------------------------

  /*
   * ---- Handler: accept a broader proposal ----
   *
   * Marks the proposal as 'accepted' in the queue and applies the
   * suggested content to the appropriate section of the active resume.
   *
   * For summary proposals: sets draft.summary to the suggested text.
   * For bullet proposals: finds the matching duty line and replaces it,
   *   then rebuilds the bullet view model from the updated experience.
   * For other types: marks as accepted without mutating the resume
   *   (Phase 2 limitation — federal details and keyword proposals are
   *   accepted conceptually but not yet auto-applied to the model).
   */
  const handleProposalAccept = useCallback(function (proposalId: string) {
    /* Find the target proposal */
    let targetProposal: ResumeProposal | null = null;
    for (let i = 0; i < proposals.length; i++) {
      if (proposals[i].id === proposalId) {
        targetProposal = proposals[i];
        break;
      }
    }
    if (!targetProposal) return;

    /* Update proposal status to 'accepted' */
    const newProposals: ResumeProposal[] = [];
    for (let i = 0; i < proposals.length; i++) {
      if (proposals[i].id === proposalId) {
        newProposals.push(
          Object.assign({}, proposals[i], { status: 'accepted' as ProposalStatus })
        );
      } else {
        newProposals.push(proposals[i]);
      }
    }
    setProposals(newProposals);

    /* Apply the change to the resume based on proposal type */
    if (targetProposal.type === 'add-summary') {
      /* Summary proposal: set draft.summary to the suggested text */
      const newDraft: ResumeDraft = {
        contact: store.draft.contact,
        summary: targetProposal.suggestedText,
        experience: store.draft.experience,
        education: store.draft.education,
        skills: store.draft.skills,
      };
      persist(updateDraft(store, newDraft));
    } else if (
      targetProposal.type === 'strengthen-bullet' ||
      targetProposal.type === 'expand-phrasing'
    ) {
      /*
       * Bullet proposal: find the experience entry containing the
       * beforeText in its duties string and replace that line.
       */
      const beforeText = targetProposal.beforeText;
      const suggestedText = targetProposal.suggestedText;
      const newExperience: ResumeExperience[] = [];
      let applied = false;

      for (let i = 0; i < store.draft.experience.length; i++) {
        const exp = store.draft.experience[i];
        if (!applied && exp.duties.indexOf(beforeText) >= 0) {
          /* Replace the matching duty line with the suggested text */
          const newDuties = exp.duties.replace(beforeText, suggestedText);
          newExperience.push({
            id: exp.id,
            jobTitle: exp.jobTitle,
            employer: exp.employer,
            location: exp.location,
            startDate: exp.startDate,
            endDate: exp.endDate,
            hoursPerWeek: exp.hoursPerWeek,
            grade: exp.grade,
            duties: newDuties,
          });
          applied = true;
        } else {
          newExperience.push(exp);
        }
      }

      if (applied) {
        const newDraft: ResumeDraft = {
          contact: store.draft.contact,
          summary: store.draft.summary,
          experience: newExperience,
          education: store.draft.education,
          skills: store.draft.skills,
        };
        const newStore = updateDraft(store, newDraft);
        persist(newStore);

        /* Rebuild bullet view model from the updated experience */
        const newBulletMap = buildBulletMap(newDraft.experience);
        setBulletMap(newBulletMap);
      }
    }
    /*
     * For add-federal-detail and improve-keywords, we mark as accepted
     * but do not auto-apply. The underlying data structures for federal
     * details and keyword lists are not yet part of the core model.
     * This is an intentional Phase 2 boundary.
     */
  }, [proposals, store, persist]);

  /*
   * ---- Handler: reject/dismiss a broader proposal ----
   *
   * Marks the proposal as 'rejected' and removes it from the visible
   * queue. Does not mutate the resume in any way.
   */
  const handleProposalReject = useCallback(function (proposalId: string) {
    const newProposals: ResumeProposal[] = [];
    for (let i = 0; i < proposals.length; i++) {
      if (proposals[i].id === proposalId) {
        newProposals.push(
          Object.assign({}, proposals[i], { status: 'rejected' as ProposalStatus })
        );
      } else {
        newProposals.push(proposals[i]);
      }
    }
    setProposals(newProposals);
  }, [proposals]);

  /*
   * ---- Handler: "Edit First" on a broader proposal ----
   *
   * Marks the proposal as 'accepted' (it has been addressed), switches
   * to the Edit tab, navigates to the affected section, and loads the
   * suggested content into the appropriate editing state so the user
   * can modify it before saving.
   */
  const handleProposalEditFirst = useCallback(function (proposalId: string) {
    /* Find the target proposal */
    let targetProposal: ResumeProposal | null = null;
    for (let i = 0; i < proposals.length; i++) {
      if (proposals[i].id === proposalId) {
        targetProposal = proposals[i];
        break;
      }
    }
    if (!targetProposal) return;

    /* Mark as accepted (user has engaged with this proposal) */
    const newProposals: ResumeProposal[] = [];
    for (let i = 0; i < proposals.length; i++) {
      if (proposals[i].id === proposalId) {
        newProposals.push(
          Object.assign({}, proposals[i], { status: 'accepted' as ProposalStatus })
        );
      } else {
        newProposals.push(proposals[i]);
      }
    }
    setProposals(newProposals);

    /* Switch to Edit tab in focused mode for the affected section */
    setActiveTab('edit');
    setActiveSection(targetProposal.sectionKey);
    setEditMode('focused');

    /* Load the suggested content into the appropriate editing state */
    if (targetProposal.type === 'add-summary') {
      setEditingSummary(true);
      setEditingSummaryText(targetProposal.suggestedText);
    } else if (
      targetProposal.type === 'strengthen-bullet' ||
      targetProposal.type === 'expand-phrasing'
    ) {
      /*
       * Find the matching bullet by text content and load the
       * suggested text into the bullet editing state.
       */
      const beforeText = targetProposal.beforeText;
      const mapKeys = Object.keys(bulletMap);
      let found = false;
      for (let k = 0; k < mapKeys.length && !found; k++) {
        const expId = mapKeys[k];
        const bullets = bulletMap[expId];
        for (let b = 0; b < bullets.length && !found; b++) {
          if (bullets[b].text === beforeText) {
            setEditingBulletId(bullets[b].id);
            setEditingBulletText(targetProposal.suggestedText);
            found = true;
          }
        }
      }
    }

    /*
     * Section-focused model: setting activeSection above is sufficient
     * because the center editing surface renders only the selected
     * section. No delayed scroll is needed.
     */
  }, [proposals, bulletMap]);

  /*
   * ---- Handler: jump to section from Coverage Map ----
   * Switches to the Edit tab in focused mode for the target section.
   * The section-focused model renders only the selected section, so
   * no scrollIntoView is needed.
   */
  const handleJumpToSection = useCallback(function (sectionId: SectionId) {
    setActiveTab('edit');
    /* Map individual contact/summary to the combined group */
    const mappedId = (sectionId === 'contact' || sectionId === 'summary')
      ? 'identity-summary' as SectionId
      : sectionId;
    setActiveSection(mappedId);
    setEditMode('focused');
  }, []);

  /*
   * ---- Handler: edit section from Coverage Map ----
   * Switches to the Edit tab in focused mode for the target section.
   * Maps contact/summary to the combined identity-summary group.
   */
  const handleEditSection = useCallback(function (sectionId: SectionId) {
    setActiveTab('edit');
    const mappedId = (sectionId === 'contact' || sectionId === 'summary')
      ? 'identity-summary' as SectionId
      : sectionId;
    setActiveSection(mappedId);
    setEditMode('focused');
  }, []);

  /*
   * ---- Handler: switch to Suggested Changes from Coverage Map ----
   * Simple tab switch for cross-tab navigation.
   */
  const handleSwitchToSuggestedChanges = useCallback(function () {
    setActiveTab('suggested-changes');
  }, []);

  /* ---- Handler: add a new bullet to an experience ---- */
  const handleAddBullet = useCallback(function (experienceId: string) {
    const expBullets = bulletMap[experienceId] || [];
    const newBullet: ResumeBulletVM = {
      id: experienceId + '-b' + expBullets.length,
      text: '',
      health: 'generic',
    };
    const newBullets = expBullets.concat([newBullet]);
    const newMap = Object.assign({}, bulletMap);
    newMap[experienceId] = newBullets;
    setBulletMap(newMap);

    /* Start editing the new bullet immediately. */
    setEditingBulletId(newBullet.id);
    setEditingBulletText('');
  }, [bulletMap]);

  /* ---- Handler: summary editing ---- */
  const handleSummaryEditStart = useCallback(function () {
    setEditingSummary(true);
    setEditingSummaryText(store.draft.summary);
  }, [store.draft.summary]);

  const handleSummaryEditChange = useCallback(function (text: string) {
    setEditingSummaryText(text);
  }, []);

  const handleSummaryEditSave = useCallback(function () {
    const newDraft: ResumeDraft = {
      contact: store.draft.contact,
      summary: editingSummaryText,
      experience: store.draft.experience,
      education: store.draft.education,
      skills: store.draft.skills,
    };
    persist(updateDraft(store, newDraft));
    setEditingSummary(false);
  }, [store, editingSummaryText, persist]);

  /* ---- Handler: close target job dropdown when clicking outside ---- */
  useEffect(function () {
    if (!showTargetJobDropdown) return;
    function handleClick() {
      setShowTargetJobDropdown(false);
    }
    /* Delay to avoid closing on the same click that opened it. */
    const timer = setTimeout(function () {
      document.addEventListener('click', handleClick);
    }, 10);
    return function () {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [showTargetJobDropdown]);

  /* ---- Handler: close section dropdown when clicking outside ---- */
  useEffect(function () {
    if (!showSectionDropdown) return;
    function handleClick() {
      setShowSectionDropdown(false);
    }
    const timer = setTimeout(function () {
      document.addEventListener('click', handleClick);
    }, 10);
    return function () {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [showSectionDropdown]);

  // =========================================================================
  // INLINE EDITING HANDLERS — Save edits from the live canvas back to store
  // =========================================================================

  /**
   * Handler for saving inline edits from the LiveResumeCanvas.
   * Routes the edit to the correct part of the resume draft and
   * persists the change. Supports:
   *   - summary:        updates draft.summary
   *   - bullet:         updates the specific bullet in experience.duties
   *   - skill:          updates draft.skills from comma-separated text
   *   - federal-field:  updates the specific federal detail field
   */
  const handleInlineEditSave = useCallback(function (field: EditingField, newValue: string) {
    if (!store) return;

    /**
     * Helper: build a new draft by spreading the current draft and
     * overriding specific fields. Every handler MUST use this helper
     * so the new certifications/supportingEvidence fields are never
     * dropped during reconstruction.
     */
    function makeDraft(overrides: Partial<ResumeDraft>): ResumeDraft {
      return Object.assign({}, store.draft, overrides);
    }

    if (field.type === 'summary') {
      persist(updateDraft(store, makeDraft({ summary: newValue })));
    } else if (field.type === 'bullet' && field.experienceId !== undefined && field.bulletIndex !== undefined) {
      /* Update a specific experience bullet by reconstructing duties string */
      const newExperience: ResumeExperience[] = [];
      for (let i = 0; i < store.draft.experience.length; i++) {
        const exp = store.draft.experience[i];
        if (exp.id === field.experienceId) {
          const rawLines = exp.duties ? exp.duties.split('\n') : [];
          const bulletLines: string[] = [];
          for (let j = 0; j < rawLines.length; j++) {
            const trimmed = rawLines[j].replace(/^[•\-*]\s*/, '').trim();
            if (trimmed) {
              bulletLines.push(trimmed);
            }
          }
          if (field.bulletIndex < bulletLines.length) {
            bulletLines[field.bulletIndex] = newValue;
          }
          const dutiesLines: string[] = [];
          for (let j = 0; j < bulletLines.length; j++) {
            dutiesLines.push('• ' + bulletLines[j]);
          }
          const updated = Object.assign({}, exp, { duties: dutiesLines.join('\n') });
          newExperience.push(updated);
        } else {
          newExperience.push(exp);
        }
      }
      persist(updateDraft(store, makeDraft({ experience: newExperience })));
    } else if (field.type === 'skill') {
      /* Update skills from comma-separated text, preserving existing IDs. */
      const parts = newValue.split(',');
      const newSkills: Array<{ id: string; name: string }> = [];
      for (let i = 0; i < parts.length; i++) {
        const name = parts[i].trim();
        if (name) {
          let existingId = '';
          for (let j = 0; j < store.draft.skills.length; j++) {
            if (store.draft.skills[j].name.toLowerCase() === name.toLowerCase()) {
              existingId = store.draft.skills[j].id;
              break;
            }
          }
          const skillId = existingId || ('skill-' + i + '-' + Date.now());
          newSkills.push({ id: skillId, name: name });
        }
      }
      persist(updateDraft(store, makeDraft({ skills: newSkills })));
    }
    else if (field.type === 'experience-field' && field.experienceId && field.fieldName) {
      /* Update a specific Work Experience subfield (jobTitle, employer,
       * dateRange, hoursPerWeek). */
      const newExperience: ResumeExperience[] = [];
      for (let i = 0; i < store.draft.experience.length; i++) {
        const exp = store.draft.experience[i];
        if (exp.id === field.experienceId) {
          const updated = Object.assign({}, exp);
          if (field.fieldName === 'jobTitle') {
            updated.jobTitle = newValue;
          } else if (field.fieldName === 'employer') {
            updated.employer = newValue;
          } else if (field.fieldName === 'dateRange') {
            const dashIdx = newValue.indexOf('\u2013');
            const hyphenIdx = dashIdx >= 0 ? dashIdx : newValue.indexOf('-');
            if (hyphenIdx >= 0) {
              updated.startDate = newValue.substring(0, hyphenIdx).trim();
              updated.endDate = newValue.substring(hyphenIdx + 1).trim();
            } else {
              updated.startDate = newValue.trim();
              updated.endDate = '';
            }
          } else if (field.fieldName === 'hoursPerWeek') {
            updated.hoursPerWeek = newValue.trim();
          }
          newExperience.push(updated);
        } else {
          newExperience.push(exp);
        }
      }
      persist(updateDraft(store, makeDraft({ experience: newExperience })));
    }
    else if (field.type === 'contact-field' && field.fieldName) {
      /* Update a specific contact field. Handles location as a special
       * case (parses "City, State" into separate city/state fields). */
      const contactCopy = Object.assign({}, store.draft.contact);
      if (field.fieldName === 'fullName') {
        contactCopy.fullName = newValue;
      } else if (field.fieldName === 'email') {
        contactCopy.email = newValue;
      } else if (field.fieldName === 'phone') {
        contactCopy.phone = newValue;
      } else if (field.fieldName === 'location') {
        const commaIdx = newValue.indexOf(',');
        if (commaIdx >= 0) {
          contactCopy.city = newValue.substring(0, commaIdx).trim();
          contactCopy.state = newValue.substring(commaIdx + 1).trim();
        } else {
          contactCopy.city = newValue.trim();
          contactCopy.state = '';
        }
      }
      persist(updateDraft(store, makeDraft({ contact: contactCopy })));
    }
    else if (field.type === 'education-field' && field.educationId && field.fieldName) {
      /* Update a specific education subfield (degree, field, institution,
       * graduationDate, gpa). Handles the 'new' sentinel for adding a
       * fresh education entry. */
      if (field.educationId === 'new') {
        const newEdu = {
          id: 'edu-' + Date.now(),
          institution: '',
          degree: newValue,
          field: '',
          graduationDate: '',
          gpa: '',
        };
        persist(updateDraft(store, makeDraft({
          education: store.draft.education.concat([newEdu]),
        })));
      } else {
        const newEducation = store.draft.education.map(function (edu) {
          if (edu.id !== field.educationId) return edu;
          const updated = Object.assign({}, edu);
          if (field.fieldName === 'degree') updated.degree = newValue;
          else if (field.fieldName === 'field') updated.field = newValue;
          else if (field.fieldName === 'institution') updated.institution = newValue;
          else if (field.fieldName === 'graduationDate') updated.graduationDate = newValue;
          else if (field.fieldName === 'gpa') updated.gpa = newValue;
          return updated;
        });
        persist(updateDraft(store, makeDraft({ education: newEducation })));
      }
    }
    else if (field.type === 'certification') {
      /* Update certifications from comma-separated text, preserving
       * existing IDs for matching names (same pattern as skills). */
      const parts = newValue.split(',');
      const newCerts: Array<{ id: string; name: string }> = [];
      const existingCerts = store.draft.certifications || [];
      for (let i = 0; i < parts.length; i++) {
        const name = parts[i].trim();
        if (name) {
          let existingId = '';
          for (let j = 0; j < existingCerts.length; j++) {
            if (existingCerts[j].name.toLowerCase() === name.toLowerCase()) {
              existingId = existingCerts[j].id;
              break;
            }
          }
          const certId = existingId || ('cert-' + i + '-' + Date.now());
          newCerts.push({ id: certId, name: name });
        }
      }
      persist(updateDraft(store, makeDraft({ certifications: newCerts })));
    }
    else if (field.type === 'supporting-evidence' && field.evidenceId) {
      /* Update or add a supporting evidence item. Handles the 'new'
       * sentinel for creating a fresh evidence entry. */
      const existingEvidence = store.draft.supportingEvidence || [];
      if (field.evidenceId === 'new') {
        if (newValue.trim()) {
          const newItem = { id: 'ev-' + Date.now(), text: newValue.trim() };
          persist(updateDraft(store, makeDraft({
            supportingEvidence: existingEvidence.concat([newItem]),
          })));
        }
      } else {
        const updated = existingEvidence.map(function (ev) {
          if (ev.id !== field.evidenceId) return ev;
          return Object.assign({}, ev, { text: newValue });
        });
        persist(updateDraft(store, makeDraft({ supportingEvidence: updated })));
      }
    }
    /* Federal field edits are stored in mock state — in a real app
     * these would update the core model. For now, the edit visually
     * demonstrates the interaction pattern. */
  }, [store, persist]);

  /**
   * Handler for section action chip clicks from the LiveResumeCanvas.
   * Routes the action to the appropriate behavior. Currently logs
   * the action — in the future, these will trigger PathOS guidance,
   * open deeper editors, or initiate AI-assisted improvements.
   */
  /**
   * Handler for section action chip clicks from the LiveResumeCanvas.
   * Routes each action to a concrete behavior using deterministic logic.
   * In a future pass these will integrate with PathOS guidance AI, but
   * right now every action produces a real, visible change:
   *
   *   edit:       Enters edit mode for the first editable field in the section.
   *   strengthen: Produces a deterministic strengthened version of the section
   *               content (adds quantifiers, action verbs, detail).
   *   compress:   Produces a deterministic compressed version of the section
   *               content (removes filler, tightens phrasing).
   *   add:        Inserts a new empty item at the correct scope (new bullet,
   *               new education entry, new certification, etc.).
   */
  const handleSectionAction = useCallback(function (sectionId: string, action: string) {
    if (!store) return;

    /**
     * Helper: build a new draft by spreading the current draft and
     * overriding specific fields, ensuring no fields are dropped.
     */
    function makeDraft(overrides: Partial<ResumeDraft>): ResumeDraft {
      return Object.assign({}, store.draft, overrides);
    }

    /* ---- EDIT: scroll-to / focus the first editable region ------------- */
    if (action === 'edit') {
      /* Set the section as selected and edit-ready so the user can
       * click any field in that section to edit it. The canvas will
       * visually highlight the section and show the inline edit hints. */
      setCanvasSelectedSection(sectionId);
      return;
    }

    /* ---- STRENGTHEN: deterministic rewrite with stronger language ----- */
    if (action === 'strengthen') {
      if (sectionId === 'summary' && store.draft.summary) {
        /* Add quantifiers and action verbs to the summary */
        let stronger = store.draft.summary;
        if (!stronger.includes('proven')) {
          stronger = 'Proven ' + stronger.charAt(0).toLowerCase() + stronger.slice(1);
        }
        if (!stronger.includes('track record')) {
          stronger = stronger.replace(/experience/i, 'track record of success');
        }
        if (stronger !== store.draft.summary) {
          persist(updateDraft(store, makeDraft({ summary: stronger })));
        }
      } else if (sectionId === 'experience' && store.draft.experience.length > 0) {
        /* Strengthen the first experience entry's duties by adding
         * quantifiers to bullets that lack them */
        const exp = store.draft.experience[0];
        const lines = exp.duties ? exp.duties.split('\n') : [];
        const strengthened: string[] = [];
        for (let i = 0; i < lines.length; i++) {
          let line = lines[i];
          if (line && !line.match(/\d+/) && !line.match(/percent|%/i)) {
            line = line.replace(/\.\s*$/, ', resulting in measurable efficiency gains.');
          }
          strengthened.push(line);
        }
        const updatedExp = Object.assign({}, exp, { duties: strengthened.join('\n') });
        const newExperience = [updatedExp].concat(store.draft.experience.slice(1));
        persist(updateDraft(store, makeDraft({ experience: newExperience })));
      }
      return;
    }

    /* ---- COMPRESS: deterministic tightening of section content --------- */
    if (action === 'compress') {
      if (sectionId === 'summary' && store.draft.summary) {
        /* Remove filler words and tighten the summary */
        let compressed = store.draft.summary;
        const fillerPatterns = [
          /\bvery\b\s*/gi,
          /\breally\b\s*/gi,
          /\bjust\b\s*/gi,
          /\bbasically\b\s*/gi,
          /\bin order to\b/gi,
        ];
        for (let i = 0; i < fillerPatterns.length; i++) {
          compressed = compressed.replace(fillerPatterns[i], '');
        }
        compressed = compressed.replace(/in order to/gi, 'to');
        compressed = compressed.replace(/\s{2,}/g, ' ').trim();
        if (compressed !== store.draft.summary) {
          persist(updateDraft(store, makeDraft({ summary: compressed })));
        }
      } else if (sectionId === 'experience' && store.draft.experience.length > 0) {
        /* Compress the first experience entry's duties */
        const exp = store.draft.experience[0];
        const lines = exp.duties ? exp.duties.split('\n') : [];
        const compressed: string[] = [];
        for (let i = 0; i < lines.length; i++) {
          let line = lines[i];
          line = line.replace(/\bvery\b\s*/gi, '');
          line = line.replace(/\breally\b\s*/gi, '');
          line = line.replace(/\bin order to\b/gi, 'to');
          line = line.replace(/\s{2,}/g, ' ').trim();
          if (line) compressed.push(line);
        }
        const updatedExp = Object.assign({}, exp, { duties: compressed.join('\n') });
        const newExperience = [updatedExp].concat(store.draft.experience.slice(1));
        persist(updateDraft(store, makeDraft({ experience: newExperience })));
      }
      return;
    }

    /* ---- ADD: insert a new item in the correct scope ------------------- */
    if (action === 'add') {
      const ts = Date.now();
      if (sectionId === 'experience') {
        const newExp: ResumeExperience = {
          id: 'exp-' + ts,
          jobTitle: '',
          employer: '',
          location: '',
          startDate: '',
          endDate: '',
          hoursPerWeek: '40',
          grade: '',
          duties: '',
        };
        persist(updateDraft(store, makeDraft({
          experience: store.draft.experience.concat([newExp]),
        })));
      } else if (sectionId === 'education') {
        const newEdu = {
          id: 'edu-' + ts,
          institution: '',
          degree: '',
          field: '',
          graduationDate: '',
          gpa: '',
        };
        persist(updateDraft(store, makeDraft({
          education: store.draft.education.concat([newEdu]),
        })));
      } else if (sectionId === 'skills') {
        const newSkill = { id: 'skill-' + ts, name: 'New Skill' };
        persist(updateDraft(store, makeDraft({
          skills: store.draft.skills.concat([newSkill]),
        })));
      } else if (sectionId === 'certifications') {
        const existingCerts = store.draft.certifications || [];
        const newCert = { id: 'cert-' + ts, name: 'New Certification' };
        persist(updateDraft(store, makeDraft({
          certifications: existingCerts.concat([newCert]),
        })));
      } else if (sectionId === 'supporting-evidence') {
        const existingEvidence = store.draft.supportingEvidence || [];
        const newEvidence = { id: 'ev-' + ts, text: '' };
        persist(updateDraft(store, makeDraft({
          supportingEvidence: existingEvidence.concat([newEvidence]),
        })));
      }
      return;
    }
  }, [store, persist]);

  /**
   * Handler for removing individual items from the resume.
   * Routes the remove to the correct section and persists the change.
   *
   * COVERAGE:
   *   experience:              remove a job entry by ID
   *   experience-add-bullet:   add a blank bullet to an experience entry
   *   education:               remove an education entry by ID
   *   certifications:          remove a certification by ID
   *   supporting-evidence:     remove an evidence item by ID
   *   experience (with extra.bulletIndex): remove a specific bullet
   *
   * TRUST RULE: Every user-created item must have a visible removal path.
   * This handler fulfills that requirement for all list-based sections.
   */
  const handleRemoveItem = useCallback(function (sectionId: string, itemId: string, extra?: { bulletIndex?: number }) {
    if (!store) return;

    function makeDraft(overrides: Partial<ResumeDraft>): ResumeDraft {
      return Object.assign({}, store.draft, overrides);
    }

    if (sectionId === 'experience' && extra && extra.bulletIndex !== undefined) {
      /* Remove a specific bullet from an experience entry */
      const newExperience: ResumeExperience[] = [];
      for (let i = 0; i < store.draft.experience.length; i++) {
        const exp = store.draft.experience[i];
        if (exp.id === itemId) {
          const rawLines = exp.duties ? exp.duties.split('\n') : [];
          const bulletLines: string[] = [];
          for (let j = 0; j < rawLines.length; j++) {
            const trimmed = rawLines[j].replace(/^[•\-*]\s*/, '').trim();
            if (trimmed) bulletLines.push(trimmed);
          }
          /* Remove the bullet at the specified index */
          const remaining: string[] = [];
          for (let j = 0; j < bulletLines.length; j++) {
            if (j !== extra.bulletIndex) {
              remaining.push('• ' + bulletLines[j]);
            }
          }
          newExperience.push(Object.assign({}, exp, { duties: remaining.join('\n') }));
        } else {
          newExperience.push(exp);
        }
      }
      persist(updateDraft(store, makeDraft({ experience: newExperience })));
      return;
    }

    if (sectionId === 'experience-add-bullet') {
      /* Add a new blank bullet to a specific experience entry */
      const newExperience: ResumeExperience[] = [];
      for (let i = 0; i < store.draft.experience.length; i++) {
        const exp = store.draft.experience[i];
        if (exp.id === itemId) {
          const currentDuties = exp.duties ? exp.duties.trim() : '';
          const newDuties = currentDuties
            ? currentDuties + '\n• New responsibility or achievement'
            : '• New responsibility or achievement';
          newExperience.push(Object.assign({}, exp, { duties: newDuties }));
        } else {
          newExperience.push(exp);
        }
      }
      persist(updateDraft(store, makeDraft({ experience: newExperience })));
      return;
    }

    if (sectionId === 'experience') {
      /* Remove a job entry */
      const filtered = store.draft.experience.filter(function (exp) { return exp.id !== itemId; });
      persist(updateDraft(store, makeDraft({ experience: filtered })));
      return;
    }

    if (sectionId === 'education') {
      /* Remove an education entry */
      const filtered = store.draft.education.filter(function (edu) { return edu.id !== itemId; });
      persist(updateDraft(store, makeDraft({ education: filtered })));
      return;
    }

    if (sectionId === 'certifications') {
      /* Remove a certification */
      const existing = store.draft.certifications || [];
      const filtered = existing.filter(function (cert) { return cert.id !== itemId; });
      persist(updateDraft(store, makeDraft({ certifications: filtered })));
      return;
    }

    if (sectionId === 'supporting-evidence') {
      /* Remove an evidence item */
      const existing = store.draft.supportingEvidence || [];
      const filtered = existing.filter(function (ev) { return ev.id !== itemId; });
      persist(updateDraft(store, makeDraft({ supportingEvidence: filtered })));
      return;
    }
  }, [store, persist]);

  /**
   * Handler for callout card actions from the ResumeCalloutLayer.
   *
   * ACTION ROUTING:
   *   'apply':      Apply the annotation's suggestedText directly to the
   *                 document. The document updates visibly.
   *   'edit-first': Load the suggestedText into the inline editor for the
   *                 relevant field, allowing the user to refine before saving.
   *   'dismiss':    Close the guidance card without action.
   *   'primary':    Navigate to the section (legacy fallback when no
   *                 suggestedText is available).
   *
   * This wiring makes suggestions actionable — the user can affect the
   * document directly from the guidance card instead of just reading advice.
   */
  const handleCalloutAction = useCallback(function (annotationId: string, action: string) {
    /* Find the source annotation */
    let targetAnnotation: TailoringAnnotation | null = null;
    for (let i = 0; i < tailoringAnnotations.length; i++) {
      if (tailoringAnnotations[i].id === annotationId) {
        targetAnnotation = tailoringAnnotations[i];
        break;
      }
    }

    /* DISMISS: Just close the active card */
    if (action === 'dismiss') {
      setActiveCalloutId(null);
      calloutLinesHook.setActiveLineId(null);
      return;
    }

    if (!targetAnnotation) return;

    /* APPLY: Insert the suggested text directly into the document.
     * After applying:
     *   1. The document field updates visibly (via handleInlineEditSave)
     *   2. The annotation is marked as resolved (updating section status)
     *   3. A confirmation toast appears briefly
     *   4. The guidance card closes */
    if (action === 'apply' && targetAnnotation.suggestedText) {
      const suggestedText = targetAnnotation.suggestedText;
      const anchorId = targetAnnotation.anchorId;

      /* Route by anchor prefix to determine which field to update */
      if (anchorId.startsWith('experience-bullet-')) {
        const bMatch = anchorId.match(/^experience-bullet-(exp-\d+)-b(\d+)$/);
        if (bMatch) {
          const expId = bMatch[1];
          const bulletIdx = parseInt(bMatch[2], 10);
          handleInlineEditSave(
            { type: 'bullet', experienceId: expId, bulletIndex: bulletIdx },
            suggestedText
          );
        }
      } else if (anchorId.startsWith('skills-')) {
        const currentNames: string[] = [];
        for (let i = 0; i < store.draft.skills.length; i++) {
          currentNames.push(store.draft.skills[i].name);
        }
        const combined = currentNames.join(', ') + ', ' + suggestedText;
        handleInlineEditSave({ type: 'skill' }, combined);
      } else if (anchorId.startsWith('summary-')) {
        handleInlineEditSave({ type: 'summary' }, suggestedText);
      }

      /* Mark this annotation as resolved so section statuses update */
      const newResolved = Object.assign({}, resolvedAnnotationIds);
      newResolved[annotationId] = true;
      setResolvedAnnotationIds(newResolved);

      /* Show confirmation feedback — auto-clears after 3 seconds */
      setAppliedFeedback({
        annotationId: annotationId,
        label: targetAnnotation.label,
        timestamp: Date.now(),
      });
      setTimeout(function () {
        setAppliedFeedback(function (prev) {
          if (prev && prev.annotationId === annotationId) {
            return null;
          }
          return prev;
        });
      }, 3000);

      /* Close the guidance card after applying */
      setActiveCalloutId(null);
      calloutLinesHook.setActiveLineId(null);
      return;
    }

    /* EDIT-FIRST: Load suggestion into the inline editor for refinement.
     * The user sees the suggested content pre-loaded into the editable
     * field so they can review and modify before saving. This makes the
     * "Edit First" workflow clear: review → modify → save. */
    if (action === 'edit-first' && targetAnnotation.suggestedText) {
      const anchorId = targetAnnotation.anchorId;
      const suggestedText = targetAnnotation.suggestedText;

      /* Navigate to the owning section and activate edit mode */
      if (anchorId.startsWith('experience-')) {
        setCanvasSelectedSection('experience');
      } else if (anchorId.startsWith('summary-')) {
        setCanvasSelectedSection('summary');
      } else if (anchorId.startsWith('skills-')) {
        setCanvasSelectedSection('skills');
      } else {
        const parts = anchorId.split('-');
        if (parts.length > 0) {
          setCanvasSelectedSection(parts[0]);
        }
      }
      setIsEditReady(true);

      /* Load the suggested text into the editing state after a short
       * delay so the section selection and scroll have time to settle. */
      if (anchorId.startsWith('experience-bullet-')) {
        const bMatch = anchorId.match(/^experience-bullet-(exp-\d+)-b(\d+)$/);
        if (bMatch) {
          const bulletId = bMatch[1] + '-b' + bMatch[2];
          setEditingBulletId(bulletId);
          setEditingBulletText(suggestedText);
        }
      } else if (anchorId.startsWith('summary-')) {
        setEditingSummary(true);
        setEditingSummaryText(suggestedText);
      }

      setActiveCalloutId(null);
      calloutLinesHook.setActiveLineId(null);
      return;
    }

    /* PRIMARY (fallback): Navigate to the section */
    const anchorId = targetAnnotation.anchorId;
    const parts = anchorId.split('-');
    if (parts.length > 0) {
      setCanvasSelectedSection(parts[0]);
    }
  }, [tailoringAnnotations, store.draft, handleInlineEditSave, calloutLinesHook, resolvedAnnotationIds]);

  // =========================================================================
  // PATHADVISOR ON-DEMAND EXPLANATION — context builder + dispatch
  // =========================================================================

  /**
   * Collects all unresolved scored issues for the current scope (overview
   * or selected section). Used by TopFixBanner to identify the single
   * most impactful next action without the parent screen needing to
   * re-sort or filter.
   */
  const scopeIssues: SectionIssue[] = useMemo(function () {
    if (evidenceScores.length === 0) return [];

    const issues: SectionIssue[] = [];

    if (isOverviewMode) {
      /* In overview mode, collect all issues across all sections */
      for (let i = 0; i < evidenceScores.length; i++) {
        const sectionScore = evidenceScores[i];
        for (let j = 0; j < sectionScore.issues.length; j++) {
          if (!sectionScore.issues[j].resolved) {
            issues.push(sectionScore.issues[j]);
          }
        }
      }
    } else if (canvasSelectedSection) {
      /* In section mode, collect issues for the selected section */
      for (let i = 0; i < evidenceScores.length; i++) {
        if (evidenceScores[i].sectionId === canvasSelectedSection) {
          for (let j = 0; j < evidenceScores[i].issues.length; j++) {
            if (!evidenceScores[i].issues[j].resolved) {
              issues.push(evidenceScores[i].issues[j]);
            }
          }
          break;
        }
      }
    }

    return sortIssuesByPriority(issues);
  }, [evidenceScores, isOverviewMode, canvasSelectedSection]);

  /**
   * Handler for PathAdvisor on-demand explanation triggers. Builds a
   * grounded context payload from the current Resume Builder state and
   * dispatches it to PathAdvisor via the screen overrides store.
   *
   * CONTEXT INJECTION DESIGN: When a user clicks "Why this matters" on
   * an issue card, this handler assembles:
   *   - the screen (resume-builder)
   *   - the current mode (overview/section)
   *   - the active section and its health
   *   - the active issue details (annotation class, category, label)
   *   - the target job context
   *   - a pre-composed natural-language prompt
   *
   * This context is injected into the PathAdvisor overrides so that
   * PathAdvisor opens already understanding what the user is asking about.
   */
  const handleExplainRequest = useCallback(function (intent: string, annotationId: string | null) {
    /* Find the annotation if one is referenced */
    let matchedAnnotation: TailoringAnnotation | null = null;
    if (annotationId !== null) {
      for (let i = 0; i < tailoringAnnotations.length; i++) {
        if (tailoringAnnotations[i].id === annotationId) {
          matchedAnnotation = tailoringAnnotations[i];
          break;
        }
      }
    }

    /* Find section health for the active section */
    let sectionHealthPct: number | null = null;
    if (canvasSelectedSection && sectionProgressList.length > 0) {
      for (let i = 0; i < sectionProgressList.length; i++) {
        if (sectionProgressList[i].sectionId === canvasSelectedSection) {
          sectionHealthPct = sectionProgressList[i].completionPct;
          break;
        }
      }
    }

    /* Build the grounded context payload */
    const ctx: PathAdvisorResumeContext = {
      screen: 'resume-builder',
      intent: intent as PathAdvisorTriggerIntent,
      mode: isOverviewMode ? 'overview' : 'section',
      selectedSection: canvasSelectedSection,
      activeCalloutId: activeCalloutId,
      issueAnnotationClass: matchedAnnotation ? matchedAnnotation.annotationClass : null,
      issueCategory: matchedAnnotation ? matchedAnnotation.subType : null,
      issueLabel: matchedAnnotation ? matchedAnnotation.label : null,
      issueDescription: matchedAnnotation ? matchedAnnotation.description : null,
      issueSeverity: matchedAnnotation ? matchedAnnotation.severity : null,
      suggestedFix: matchedAnnotation && matchedAnnotation.suggestedText ? matchedAnnotation.suggestedText : null,
      sectionHealthPct: sectionHealthPct,
      overallReadiness: computedReadinessScore,
      targetJobTitle: activeJob ? activeJob.title : null,
      targetJobId: activeJob ? activeJob.id : null,
      composedPrompt: '',
    };

    /* Build the natural-language prompt from the context */
    ctx.composedPrompt = buildPathAdvisorPrompt(ctx);

    /* Update PathAdvisor overrides with the grounded context.
     * This injects the composed prompt as the composer placeholder
     * and adds context-specific suggested prompts so PathAdvisor
     * opens already understanding the user's question. */
    setOverrides({
      screenId: 'resume-builder',
      viewingLabel: 'Resume Builder',
      suggestedPrompts: [
        ctx.composedPrompt,
        'How can I strengthen this section?',
        'What keywords am I missing?',
      ],
      briefingLabel: 'From Resume Builder',
      briefingHelperText: ctx.composedPrompt,
      composerPlaceholder: ctx.composedPrompt,
    });

    /* Open the PathAdvisor modal with the grounded context.
     * The modal renders a structured explanation immediately so
     * the user gets value without typing. The overrides above are
     * also updated for consistency with the broader PathAdvisor
     * system (future mobile rail, etc.). */
    setPathAdvisorModalContext(ctx);
    setPathAdvisorModalOpen(true);

  }, [
    tailoringAnnotations,
    canvasSelectedSection,
    sectionProgressList,
    isOverviewMode,
    activeCalloutId,
    computedReadinessScore,
    activeJob,
    setOverrides,
  ]);

  // =========================================================================
  // CALLOUT LINE — Anchor hover handler and highlighted anchor computation
  // =========================================================================

  /**
   * Handle hover on a data-callout-anchor element inside the canvas.
   * Maps the anchor ID to the corresponding callout line ID and
   * updates the line's source hover state so the line + endpoint highlight.
   */
  /**
   * PRINT/PDF EXPORT — opens the preview overlay in print-ready mode.
   *
   * The primary user-facing export is print-to-PDF via the browser's
   * built-in print dialog. This produces a clean, readable PDF without
   * requiring a third-party PDF library. The preview overlay renders
   * the resume in a print-optimized format with white background,
   * high-contrast text, and proper margins.
   *
   * The old JSON export is preserved as a secondary dev/backup option.
   */
  const handleExportPrint = useCallback(function () {
    setShowPreview(true);
  }, []);

  /**
   * JSON EXPORT — secondary/developer format for data backup.
   *
   * Exports the full resume store as a JSON file. This is NOT the
   * primary user-facing export — it's a data backup/transfer format.
   * The primary export is print-to-PDF via handleExportPrint.
   */
  const handleExportJSON = useCallback(function () {
    if (!store) return;
    const jsonStr = exportResumeJSON(store);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = 'resume-' + dateStr + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [store]);

  /**
   * Create a new resume version from the current draft. Saves a
   * snapshot with a label and refreshes the store state.
   */
  const handleCreateVersion = useCallback(function (label: string) {
    if (!store) return;
    const updated = createVersion(store, label || 'Version ' + new Date().toLocaleDateString());
    persist(updated);
    /* After creating, make the new version the active selection so the
     * user is looking at the version they just created. The newest
     * version is at index 0 in the versions array. */
    if (updated.versions.length > 0) {
      setSelectedResumeId(updated.versions[0].id);
    }
    setShowNewResumeModal(false);
  }, [store, persist]);

  /**
   * Create a blank federal resume version. Uses the core createDefaultDraft()
   * to produce empty-but-scaffolded sections (contact, summary, experience,
   * education, skills, certifications, supporting evidence). The draft is
   * replaced with the blank scaffolding and then saved as a named version.
   * This way the new version is genuinely distinct from the default resume.
   */
  const handleCreateBlankResume = useCallback(function (label: string) {
    if (!store) return;
    /* Snapshot current draft first so the user can return to it */
    const snapshotted = createVersion(store, 'Before blank — ' + new Date().toLocaleDateString());
    /* Replace draft with blank federal scaffold */
    const blankDraft = createDefaultDraft();
    const withBlank = updateDraft(snapshotted, blankDraft);
    /* Save the blank draft as a new named version */
    const withVersion = createVersion(withBlank, label || 'New Federal Resume');
    persist(withVersion);
    /* Switch to the new blank version */
    if (withVersion.versions.length > 0) {
      setSelectedResumeId(withVersion.versions[0].id);
    }
    setShowNewResumeModal(false);
  }, [store, persist]);

  const handleAnchorHover = useCallback(function (anchorId: string, hovered: boolean) {
    /* Find the callout line whose anchor matches this anchorId */
    for (let i = 0; i < calloutLineDefs.length; i++) {
      if (calloutLineDefs[i].anchor.anchorId === anchorId) {
        calloutLinesHook.setSourceHovered(calloutLineDefs[i].id, hovered);
        return;
      }
    }
  }, [calloutLineDefs, calloutLinesHook]);

  /**
   * Compute highlighted anchor IDs from callout line endpoint hover state.
   * When an endpoint circle is hovered, the source anchor in the resume
   * should receive a subtle highlight to show the visual connection.
   */
  const highlightedAnchors: Record<string, boolean> = useMemo(function () {
    const result: Record<string, boolean> = {};
    const stateKeys = Object.keys(calloutLinesHook.lineStates);
    for (let i = 0; i < stateKeys.length; i++) {
      const state = calloutLinesHook.lineStates[stateKeys[i]];
      if (state.endpointHovered) {
        /* Find the corresponding callout line def to get the anchor ID */
        for (let j = 0; j < calloutLineDefs.length; j++) {
          if (calloutLineDefs[j].id === state.lineId) {
            result[calloutLineDefs[j].anchor.anchorId] = true;
            break;
          }
        }
      }
    }
    return result;
  }, [calloutLinesHook.lineStates, calloutLineDefs]);

  // =========================================================================
  // DROPDOWN DATA — Build dropdown items for the top bar selectors
  // =========================================================================

  /**
   * Target job dropdown items — derived from the saved jobs list.
   * Each item shows the job title with the agency as a sublabel.
   */
  const targetJobDropdownItems: DropdownItem[] = useMemo(function () {
    const items: DropdownItem[] = [];
    for (let i = 0; i < savedJobs.length; i++) {
      const job = savedJobs[i];
      items.push({
        id: job.id,
        label: job.title,
        sublabel: job.agency ? job.agency.split(',')[0] : undefined,
      });
    }
    return items;
  }, [savedJobs]);

  /**
   * Resume version dropdown items. Includes "Default Resume" (the current
   * working draft) plus any saved version snapshots, plus a "New Resume
   * Version" action at the bottom for creating new snapshots.
   *
   * NAMING: "Default Resume" replaces the previous "Master Resume" label
   * to be clearer and more approachable for non-technical users.
   */
  const resumeVersionDropdownItems: DropdownItem[] = useMemo(function () {
    const items: DropdownItem[] = [
      { id: 'master', label: 'Default Resume' },
    ];
    const versions = store ? listVersions(store) : [];
    for (let i = 0; i < versions.length; i++) {
      items.push({
        id: versions[i].id,
        label: versions[i].label,
        sublabel: new Date(versions[i].createdAt).toLocaleDateString(),
      });
    }
    items.push({ id: 'new', label: '+ New Resume Version' });
    return items;
  }, [store]);

  /**
   * Active resume label — dynamically reflects the currently selected
   * resume or version. When the user is on the default draft, shows
   * "Default Resume". When on a saved version, shows that version's label.
   * This ensures the top bar selector always honestly shows what is active.
   */
  const activeResumeLabel: string = useMemo(function () {
    if (selectedResumeId === 'master') {
      return 'Default Resume';
    }
    if (store) {
      const versions = listVersions(store);
      for (let i = 0; i < versions.length; i++) {
        if (versions[i].id === selectedResumeId) {
          return versions[i].label;
        }
      }
    }
    return 'Default Resume';
  }, [selectedResumeId, store]);

  /* ---- Loading state ---- */
  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--p-text-dim)' }}>
        <p className="text-sm">Loading resume builder...</p>
      </div>
    );
  }

  /* ---- Render ---- */
  return (
    <div className="flex flex-col h-full" style={{ color: 'var(--p-text)' }} data-testid="resume-builder-screen">
      {/* 1) NEW: Stable 7-slot top bar — replaces old WorkspaceTopBar.
       *
       * Slot positions are fixed across all builder stages (Partial,
       * Tailoring, Validation). Only content inside each slot changes.
       * This eliminates the header reflow problems from the old layout.
       */}
      <ResumeBuilderTopBar
        stage={builderStage}
        onStageChange={setBuilderStage}
        resumeLabel={activeResumeLabel}
        resumeVersions={resumeVersionDropdownItems}
        selectedResumeId={selectedResumeId}
        onResumeSelect={function (resumeId: string) {
          if (resumeId === 'new') {
            setShowNewResumeModal(true);
            return;
          }
          /* If the user selects the same version they're on, no-op */
          if (resumeId === selectedResumeId) return;
          /* Show confirmation before switching — current draft may have
           * unsaved changes. The pendingSwitchVersionId triggers the
           * ResumeSwitchConfirmation dialog. */
          setPendingSwitchVersionId(resumeId);
        }}
        targetJobLabel={activeJob ? activeJob.title + ' - ' + (activeJob.agency ? activeJob.agency.split(',')[0] : '') : null}
        targetJobs={targetJobDropdownItems}
        selectedTargetJobId={activeTargetJobId}
        onTargetJobSelect={function (jobId: string | null) { handleTargetJobChange(jobId); }}
        hasTargetJob={activeTargetJobId !== null}
        tailoringComplete={computedTailoringComplete}
        pageCount={computedPageCount}
        pageLimit={2}
        readinessScore={computedReadinessScore}
        preflightState={computedPreflightState}
        hasPendingSuggestions={pendingProposalCount > 0}
        primaryCta={primaryCtaConfig}
        onPrimaryCtaClick={function () {
          if (builderStage === 'validation') {
            handleExportPrint();
          } else if (builderStage === 'tailoring') {
            setBuilderStage('validation');
          } else {
            setBuilderStage('tailoring');
          }
        }}
        onPreview={function () { setShowPreview(true); }}
        onVersions={function () { setShowVersions(!showVersions); }}
        onExport={handleExportPrint}
        onReviewResume={function () { setShowFullReview(true); }}
        isEditReady={isEditReady}
        onEditToggle={function () { setIsEditReady(!isEditReady); }}
      />

      {/* 2) Main body: section rail + center canvas + callout overlay.
       *
       * The container uses position:relative so the callout layer can
       * be absolutely positioned as an overlay. This prevents the callout
       * column from participating in flex layout, which means the resume
       * document never shifts or reflows when callouts appear/disappear. */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* NEW: Compact left rail with section progress badges.
         * Shows at-a-glance health for each section with color-coded
         * circular progress indicators. Clicking scrolls the canvas
         * to that section and activates its callouts. */}
        <ResumeSectionRail
          sections={sectionProgressList}
          selectedSectionId={canvasSelectedSection}
          onSectionSelect={function (sectionId) {
            /* Set the selected section on the live canvas. This drives
             * which section is highlighted in the document AND which
             * section's callouts appear in the right-side callout layer.
             * Clear the active callout when switching sections so stale
             * guidance cards from the previous section don't persist. */
            setCanvasSelectedSection(sectionId);
            setActiveCalloutId(null);
            calloutLinesHook.setActiveLineId(null);
          }}
          expanded={true}
        />

        {/* ================================================================
         * CENTER WORKSPACE: Live resume document — always visible.
         *
         * The document is the primary working surface across all stages
         * (Partial / Tailoring / Validation). The old tab-based shell
         * (Edit / Suggested Changes / Coverage Map / Preview / Version
         * Diff) has been removed as the primary organizer. Workflow is
         * now expressed through:
         *   - stage tabs in the top bar
         *   - the selected section in the left rail
         *   - on-document callout guidance in the right layer
         *   - validation checklist overlay at the bottom
         * ================================================================ */}
        <LiveResumeCanvas
          draft={store.draft}
          selectedSectionId={isOverviewMode ? null : canvasSelectedSection}
          onSectionSelect={function (sectionId) {
            setCanvasSelectedSection(sectionId);
            /* Clear active guidance card when switching sections —
             * guidance belongs to the callout interaction of the
             * current section, not the previous one. */
            setActiveCalloutId(null);
            calloutLinesHook.setActiveLineId(null);
            /* Trigger re-measurement of callout line positions when the
             * selected section changes, since anchor visibility may shift. */
            requestAnimationFrame(function () {
              calloutLinesHook.remeasure();
            });
          }}
          onAnchorRegister={anchorMapHook.registerAnchor}
          editMode={isEditReady}
          federalDetails={MOCK_FEDERAL_DETAILS}
          certifications={store.draft.certifications || []}
          supportingEvidence={store.draft.supportingEvidence || []}
          onInlineEditSave={handleInlineEditSave}
          onSectionAction={handleSectionAction}
          onRemoveItem={handleRemoveItem}
          documentPanelRef={documentPanelRef}
          highlightedAnchors={highlightedAnchors}
          onAnchorHover={handleAnchorHover}
          scrollContainerRef={canvasScrollContainerRef}
        />

        {/* Legacy tab-based center panel has been removed. The document-
         * centered live canvas model (LiveResumeCanvas above) is now the
         * only center workspace. All workflow is expressed through stage
         * tabs in the top bar, section selection in the left rail, and
         * on-document callout guidance. */}

        {/* ================================================================
         * CALLOUT LINE OVERLAY — Precision SVG lines from resume to guidance
         *
         * Renders thin lines originating from specific content inside the
         * resume document, extending outward past the document boundary,
         * and terminating in small white-filled circles. This overlay is
         * absolutely positioned and uses pointer-events:none for the SVG
         * background; endpoint circles re-enable pointer events for
         * hover and click interaction.
         *
         * VISIBILITY RULE: Lines appear when:
         *   1. A section is selected in the canvas
         *   2. The builder is NOT in validation stage
         *   3. There are unresolved annotations for the selected section
         *
         * Lines are contextual — they show only for the active section.
         * ================================================================ */}
        {calloutLineDefs.length > 0 && (
          <div
            ref={calloutLineOverlayRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 8,
              pointerEvents: 'none',
              overflow: 'visible',
            }}
            data-testid="callout-line-overlay-container"
          >
            <CalloutLineOverlay
              lines={calloutLineDefs}
              geometries={calloutLinesHook.geometries}
              lineStates={calloutLinesHook.lineStates}
              onEndpointHover={calloutLinesHook.setEndpointHovered}
              onSourceHover={calloutLinesHook.setSourceHovered}
              onEndpointClick={function (lineId: string) {
                /* When an endpoint is clicked, activate the corresponding
                 * callout card if there is a matching annotation. Strip
                 * the "cl-" prefix to get the annotation ID.
                 *
                 * Also set the active line in the overlay so it gets a
                 * persistent highlight while the guidance card is open. */
                const annotationId = lineId.replace('cl-', '');
                const isToggleOff = annotationId === activeCalloutId;
                setActiveCalloutId(isToggleOff ? null : annotationId);
                calloutLinesHook.setActiveLineId(isToggleOff ? null : lineId);
              }}
            />
          </div>
        )}

        {/* Section-scoped callout layer — OVERLAY POSITIONED.
         *
         * Renders callout cards for the currently selected section ONLY.
         * Shows the top 1-2 highest-priority unresolved annotations
         * with connector-line indicators. Non-selected sections do not
         * spray callouts.
         *
         * CRITICAL LAYOUT RULE: The callout layer is wrapped in an
         * absolutely positioned container so it floats over the right
         * edge of the canvas without participating in flex flow. This
         * ensures the resume document never shifts when callouts appear
         * or disappear. The wrapper uses pointer-events:none so the
         * canvas underneath remains scrollable; the inner layer re-enables
         * pointer events for card interaction. */}
        {/* CALLOUT-DRIVEN GUIDANCE SURFACE: Always present when a section
         * is selected and we're not in validation stage. The guidance layer
         * is now interaction-driven — it shows a compact issue summary by
         * default and opens a guidance card only when a callout endpoint
         * is clicked. This replaces the old always-on detached guidance
         * boxes with a calmer, more contextual model. */}
        {canvasSelectedSection && builderStage !== 'validation' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 10,
              pointerEvents: 'none',
              overflow: 'visible',
            }}
            data-testid="callout-overlay-wrapper"
          >
            <ResumeCalloutLayer
              sectionAnnotations={selectedSectionAnnotations}
              maxVisible={isOverviewMode ? 3 : 2}
              activeCalloutId={activeCalloutId}
              onCalloutClick={function (calloutId) { setActiveCalloutId(calloutId === activeCalloutId ? null : calloutId); }}
              selectedSectionId={canvasSelectedSection}
              calloutLineDefs={calloutLineDefs}
              onCalloutAction={handleCalloutAction}
              isOverviewMode={isOverviewMode}
              sectionProgressList={sectionProgressList}
              onExplainRequest={handleExplainRequest}
              scopeIssues={scopeIssues}
              onTopFixClick={function (issue) {
                /* Navigate to the issue's section when the top-fix banner
                 * is clicked, giving the user a direct path to the fix. */
                if (issue.sectionId) {
                  setCanvasSelectedSection(issue.sectionId);
                }
              }}
            />
          </div>
        )}

        {/* APPLIED SUGGESTION CONFIRMATION TOAST — brief feedback after
         * a suggestion is applied. Appears as a small floating indicator
         * at the top-right of the workspace. Auto-dismisses after 3s. */}
        {appliedFeedback !== null && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              right: '16px',
              zIndex: 20,
              pointerEvents: 'auto',
            }}
            data-testid="applied-suggestion-toast"
          >
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{
                background: 'var(--p-surface)',
                border: '1px solid var(--p-success)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                color: 'var(--p-success)',
                animation: 'fadeIn 0.2s ease',
              }}
              role="status"
              aria-live="polite"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <div>
                <div className="text-xs font-semibold">Suggestion applied</div>
                <div className="text-[10px]" style={{ color: 'var(--p-text-muted)' }}>
                  {appliedFeedback.label}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* NEW: Validation preflight checklist overlay.
       *
       * Shown only in the validation stage. Renders as a compact
       * overlay at the bottom of the workspace that does not obscure
       * the resume document. The checklist covers: page length,
       * required sections, federal details, evidence coverage, and
       * critical issues.
       */}
      {builderStage === 'validation' && computedPreflightState && (
        <div
          className="px-4 py-3 flex-shrink-0"
          style={{
            borderTop: '1px solid var(--p-border)',
            background: 'var(--p-surface)',
          }}
          data-testid="validation-preflight-area"
        >
          <div className="max-w-[600px] mx-auto">
            <ValidationChecklist preflightState={computedPreflightState} />
            {/* EXIT VALIDATION — clear path back to editing mode.
             * Without this, users can feel trapped in Validation with no
             * obvious way to return to their working draft. The button
             * switches back to the Partial stage and re-enables editing. */}
            <div className="flex items-center justify-center mt-3 pt-3" style={{ borderTop: '1px solid var(--p-border)' }}>
              <button
                type="button"
                onClick={function () { setBuilderStage('partial'); }}
                className={'flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                style={{
                  color: 'var(--p-accent)',
                  background: 'color-mix(in srgb, var(--p-accent) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--p-accent) 20%, transparent)',
                  '--tw-ring-color': 'var(--p-accent)',
                } as React.CSSProperties}
                data-testid="validation-exit-button"
                aria-label="Exit validation and return to editing"
              >
                <ArrowRight className="w-3.5 h-3.5" style={{ transform: 'rotate(180deg)' }} />
                Back to Editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PATHADVISOR EXPLANATION MODAL — on-demand explanation layer.
       *
       * Opens when a user clicks an explanation trigger at any level
       * (issue, section, or overview). Renders structured explanation
       * from grounded context immediately — no typing required.
       *
       * The modal is an INVITED LAYER (tertiary in the visual hierarchy):
       *   primary:   resume document
       *   secondary: callouts / section focus / direct actions
       *   tertiary:  this modal
       *
       * It does not compete with the document or the callout system.
       * The user opens it deliberately and closes it to return to the
       * builder with no layout disruption.
       *
       * ACTION ROUTING: Apply/Edit-first route through handleCalloutAction
       * so the existing suggestion plumbing is reused, not duplicated.
       *
       * CONVERSATION ACTIONS: Actions triggered from within the conversation
       * thread (apply, edit, copy from assistant replies) also route through
       * handleCalloutAction when they carry an annotationId. This ensures
       * the same suggestion-application plumbing is used regardless of
       * whether the action originated from the footer buttons or from a
       * conversational reply. */}
      <ResumeBuilderPathAdvisorModal
        open={pathAdvisorModalOpen}
        onOpenChange={setPathAdvisorModalOpen}
        context={pathAdvisorModalContext}
        onApplySuggestion={function (annotationId) {
          handleCalloutAction(annotationId, 'apply');
        }}
        onEditFirst={function (annotationId) {
          handleCalloutAction(annotationId, 'edit-first');
        }}
        onConversationAction={function (action) {
          if (action.type === 'apply' && action.annotationId !== null) {
            handleCalloutAction(action.annotationId, 'apply');
          } else if (action.type === 'edit' && action.annotationId !== null) {
            handleCalloutAction(action.annotationId, 'edit-first');
          }
        }}
      />

      {/* ================================================================
       * FINAL PREVIEW OVERLAY — clean read-only presentation view.
       *
       * When active, a full-screen overlay covers the workspace with a
       * polished, read-only rendering of the resume. The user can review
       * the document without editing affordances, then close the overlay
       * or export directly. This is the "final review surface" that
       * feels distinct from editing mode.
       * ================================================================ */}
      {showPreview && store && (
        <ResumePreviewOverlay
          draft={store.draft}
          onClose={function () { setShowPreview(false); }}
          onPrint={function () { window.print(); }}
          onExportJSON={handleExportJSON}
        />
      )}

      {/* ================================================================
       * VERSIONS PANEL — lightweight side panel for version management.
       *
       * Shows saved resume versions with restore and delete actions.
       * The user can snapshot the current draft or revert to a previous
       * version. Renders as an overlay to avoid layout shifts.
       * ================================================================ */}
      {showVersions && store && (
        <ResumeVersionsPanel
          store={store}
          onClose={function () { setShowVersions(false); }}
          onCreateVersion={handleCreateVersion}
          onRestoreVersion={function (versionId: string) {
            const restored = restoreVersion(store, versionId);
            persist(restored);
          }}
        />
      )}

      {/* ================================================================
       * NEW RESUME MODAL — lightweight version creation flow.
       *
       * A minimal modal that lets the user name and save a new version
       * of the current draft. Uses the core createVersion function.
       * ================================================================ */}
      {showNewResumeModal && (
        <NewResumeModal
          onClose={function () { setShowNewResumeModal(false); }}
          onCreate={handleCreateVersion}
          onCreateBlank={handleCreateBlankResume}
        />
      )}

      {/* ================================================================
       * RESUME SWITCH CONFIRMATION — dirty-state guard for version switching.
       *
       * When the user selects a different resume version from the dropdown
       * while the current draft may have unsaved changes, this dialog
       * appears. It prevents accidental data loss by offering three
       * options: save current + switch, discard + switch, or cancel.
       *
       * WHY: Users must be able to trust that switching versions won't
       * silently destroy their work. This is a trust-critical interaction.
       * ================================================================ */}
      {pendingSwitchVersionId !== null && store && (
        <ResumeSwitchConfirmation
          pendingVersionId={pendingSwitchVersionId}
          onSaveAndSwitch={function () {
            /* Save current draft as a named version, then switch.
             * The version gets a meaningful timestamp-based name instead
             * of the old "Auto-save" label which was confusing as a
             * user-visible version name. */
            const versionLabel = 'Draft snapshot — ' + new Date().toLocaleDateString();
            const saved = createVersion(store, versionLabel);

            /* If leaving master for the first time, back up the master
             * draft so we can restore it if the user switches back. */
            if (selectedResumeId === 'master' && masterDraftBackupRef.current === null) {
              masterDraftBackupRef.current = JSON.parse(JSON.stringify(store.draft));
            }

            /* Restore the target version if it exists. For 'master', the
             * draft is already the master content, so no restore needed. */
            let afterSave = saved;
            if (pendingSwitchVersionId !== 'master') {
              afterSave = restoreVersion(saved, pendingSwitchVersionId);
            } else if (masterDraftBackupRef.current !== null) {
              /* Switching back to master — restore the backed-up draft */
              afterSave = updateDraft(saved, masterDraftBackupRef.current);
              masterDraftBackupRef.current = null;
            }
            persist(afterSave);
            setSelectedResumeId(pendingSwitchVersionId);
            setPendingSwitchVersionId(null);
          }}
          onDiscardAndSwitch={function () {
            /* Switch without saving — restore the selected version directly.
             * Any unsaved edits to the current draft are lost. */
            if (pendingSwitchVersionId === 'master') {
              /* Switching back to Default Resume. If we have a backup of
               * the master draft from before the user switched away, restore
               * it. Otherwise the draft stays as-is (it IS master). */
              if (masterDraftBackupRef.current !== null) {
                const restored = updateDraft(store, masterDraftBackupRef.current);
                persist(restored);
                masterDraftBackupRef.current = null;
              }
              setPendingSwitchVersionId(null);
              setSelectedResumeId('master');
            } else {
              /* If leaving master, back up the draft first */
              if (selectedResumeId === 'master' && masterDraftBackupRef.current === null) {
                masterDraftBackupRef.current = JSON.parse(JSON.stringify(store.draft));
              }
              const restored = restoreVersion(store, pendingSwitchVersionId);
              persist(restored);
              setSelectedResumeId(pendingSwitchVersionId);
              setPendingSwitchVersionId(null);
            }
          }}
          onCancel={function () {
            setPendingSwitchVersionId(null);
          }}
        />
      )}

      {/* ================================================================
       * FULL-DOCUMENT REVIEW — PathAdvisor whole-resume evaluation.
       *
       * This overlay presents a structured, deterministic review of the
       * entire resume. It evaluates overall readiness, strongest sections,
       * weakest sections, missing federal requirements, biggest blockers,
       * and top recommended fixes.
       *
       * ARCHITECTURE: This is designed as the future entry point for the
       * real PathAdvisor LLM review. In this pass, the review content is
       * deterministically generated from the current resume state. The
       * same modal infrastructure and data contract will be used when
       * the LLM is connected.
       *
       * The review uses the existing readiness, section progress, and
       * preflight infrastructure to build its evaluation.
       * ================================================================ */}
      {showFullReview && store && (
        <FullDocumentReview
          draft={store.draft}
          readinessScore={computedReadinessScore}
          sectionProgressList={sectionProgressList}
          targetJobTitle={activeJob ? activeJob.title : null}
          onClose={function () { setShowFullReview(false); }}
        />
      )}
    </div>
  );
}

// ===========================================================================
// OVERLAY COMPONENTS — Preview, Versions, New Resume Modal
// ===========================================================================

/**
 * ============================================================================
 * RESUME PREVIEW OVERLAY — Print-ready final review surface
 * ============================================================================
 *
 * PURPOSE: Full-screen overlay for final resume review with print/PDF
 * export. This is the primary user-facing export surface — the user sees
 * a clean, readable version of their resume and can print or save as PDF
 * using the browser's native print dialog.
 *
 * EXPORT STRATEGY:
 *   Primary: "Print / Save as PDF" — uses window.print() which opens
 *            the browser's native print dialog. Users can select "Save
 *            as PDF" as their printer for a clean PDF output.
 *   Secondary: "Export JSON" — data backup format for developers or
 *              cross-device transfer. Not the main user-facing format.
 *
 * READABILITY: The preview uses a white background with high-contrast
 * dark text (#111) at comfortable reading sizes. Section headings are
 * black (#000) and bold for clear visual hierarchy. Font sizes are
 * larger than the editing canvas to optimize for reading, not editing.
 *
 * PRINT CSS: The overlay uses CSS classes that a print stylesheet can
 * target. The data-testid="resume-preview-overlay" wrapper and the
 * data-testid="resume-preview-document" inner wrapper allow @media print
 * rules to hide chrome and show only the document content.
 *
 * DISMISS: Escape key, close button, and clicking the dimmed backdrop
 * all close the overlay. The user is never trapped.
 */
function ResumePreviewOverlay(props: {
  draft: ResumeDraft;
  onClose: () => void;
  onPrint: () => void;
  onExportJSON: () => void;
}) {
  const draft = props.draft;
  const contact = draft.contact;

  /* Escape key handler — close the preview when Escape is pressed.
   * This satisfies the modal-semantics dismiss requirement. */
  useEffect(function () {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        props.onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return function () {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [props.onClose]);

  /* Build experience bullets from duties strings. Parses the duties
   * text (which may contain bullet markers) into clean list items. */
  function renderDuties(duties: string): React.ReactNode {
    const lines = duties.split('\n');
    const items: React.ReactNode[] = [];
    for (let i = 0; i < lines.length; i++) {
      const cleaned = lines[i].replace(/^[•\-*]\s*/, '').trim();
      if (cleaned) {
        items.push(
          <li key={i} className="text-[13px] leading-relaxed" style={{ color: '#111' }}>
            {cleaned}
          </li>
        );
      }
    }
    return items.length > 0 ? <ul className="list-disc pl-5 space-y-1">{items}</ul> : null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto print:relative print:overflow-visible"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={function (e: React.MouseEvent) {
        if (e.target === e.currentTarget) props.onClose();
      }}
      data-testid="resume-preview-overlay"
      role="dialog"
      aria-label="Resume preview"
    >
      <div
        className="relative my-8 mx-4 rounded-xl shadow-2xl print:my-0 print:mx-0 print:rounded-none print:shadow-none"
        style={{
          background: '#ffffff',
          color: '#111',
          maxWidth: '800px',
          width: '100%',
          padding: '48px 56px',
          minHeight: '600px',
        }}
        data-testid="resume-preview-document"
      >
        {/* ACTION BAR — Print/PDF + JSON export + Close.
         * Hidden when printing via @media print rules in globals.css. */}
        <div className="absolute top-4 right-4 flex items-center gap-2" data-print-hide>
          {/* Primary: Export Resume PDF — opens browser print dialog.
           * The @media print rules in globals.css hide all PathOS chrome
           * and render only the resume document content. Users select
           * "Save as PDF" in the print dialog for a clean PDF file. */}
          <button
            type="button"
            onClick={props.onPrint}
            className={'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
            style={{
              background: 'var(--p-accent, #3b82f6)',
              color: '#ffffff',
              border: 'none',
              '--tw-ring-color': 'var(--p-accent)',
            } as React.CSSProperties}
            data-testid="preview-print-button"
            title="Export as PDF — opens the browser print dialog. Select 'Save as PDF' for a clean resume file."
          >
            <Download className="w-3.5 h-3.5" />
            Export Resume PDF
          </button>
          {/* Secondary: Export Resume JSON — developer/backup data format.
           * Downloads the full resume store (draft + versions) as a JSON
           * file for backup, cross-device transfer, or developer use. */}
          <button
            type="button"
            onClick={props.onExportJSON}
            className={'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
            style={{
              background: '#f0f0f0',
              color: '#333',
              border: '1px solid #ddd',
              '--tw-ring-color': 'var(--p-accent)',
            } as React.CSSProperties}
            data-testid="preview-export-json-button"
            title="Export resume data as JSON (developer/backup format)"
          >
            Export Resume JSON
          </button>
          {/* Close */}
          <button
            type="button"
            onClick={props.onClose}
            className={'flex items-center justify-center w-8 h-8 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
            style={{
              background: '#f0f0f0',
              color: '#555',
              '--tw-ring-color': 'var(--p-accent)',
            } as React.CSSProperties}
            aria-label="Close preview"
            data-testid="preview-close-button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* RESUME CONTENT — clean typographic layout optimized for
         * readability and print output. Font sizes are slightly larger
         * than the editing canvas. Colors use high-contrast values
         * (not theme tokens) because this renders on a white background
         * regardless of the PathOS dark theme. */}
        <div className="space-y-6">
          {/* Header / Contact */}
          <div className="text-center border-b pb-4" style={{ borderColor: '#ccc' }}>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#000' }}>
              {contact.fullName || 'Your Name'}
            </h1>
            <div className="text-sm mt-1.5" style={{ color: '#444' }}>
              {[contact.email, contact.phone, contact.city && contact.state ? contact.city + ', ' + contact.state : '']
                .filter(Boolean)
                .join(' | ')}
            </div>
          </div>

          {/* Summary */}
          {draft.summary && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#000', letterSpacing: '0.1em' }}>
                Professional Summary
              </h2>
              <p className="text-[13px] leading-relaxed" style={{ color: '#111' }}>{draft.summary}</p>
            </div>
          )}

          {/* Experience */}
          {draft.experience.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#000', letterSpacing: '0.1em' }}>
                Work Experience
              </h2>
              {draft.experience.map(function (exp) {
                return (
                  <div key={exp.id} className="mb-4">
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-[13px] font-bold" style={{ color: '#000' }}>{exp.jobTitle}</h3>
                      <span className="text-xs" style={{ color: '#555' }}>{exp.startDate} – {exp.endDate}</span>
                    </div>
                    <div className="text-xs mb-1.5" style={{ color: '#444' }}>
                      {exp.employer}{exp.grade ? ' | ' + exp.grade : ''}{exp.hoursPerWeek ? ' | ' + exp.hoursPerWeek + ' hrs/wk' : ''}
                    </div>
                    {renderDuties(exp.duties)}
                  </div>
                );
              })}
            </div>
          )}

          {/* Education */}
          {draft.education.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#000', letterSpacing: '0.1em' }}>
                Education
              </h2>
              {draft.education.map(function (edu) {
                return (
                  <div key={edu.id} className="mb-2">
                    <div className="text-[13px] font-semibold" style={{ color: '#000' }}>
                      {edu.degree}, {edu.field}
                    </div>
                    <div className="text-xs" style={{ color: '#444' }}>
                      {edu.institution} | {edu.graduationDate}{edu.gpa ? ' | GPA: ' + edu.gpa : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Certifications */}
          {draft.certifications && draft.certifications.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#000', letterSpacing: '0.1em' }}>
                Certifications
              </h2>
              <p className="text-[13px]" style={{ color: '#111' }}>
                {draft.certifications.map(function (c) { return c.name; }).join(', ')}
              </p>
            </div>
          )}

          {/* Skills */}
          {draft.skills.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#000', letterSpacing: '0.1em' }}>
                Skills
              </h2>
              <p className="text-[13px]" style={{ color: '#111' }}>
                {draft.skills.map(function (s) { return s.name; }).join(', ')}
              </p>
            </div>
          )}

          {/* Supporting Evidence */}
          {draft.supportingEvidence && draft.supportingEvidence.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#000', letterSpacing: '0.1em' }}>
                Supporting Evidence
              </h2>
              <ul className="list-disc pl-5 space-y-1">
                {draft.supportingEvidence.map(function (ev) {
                  return (
                    <li key={ev.id} className="text-[13px] leading-relaxed" style={{ color: '#111' }}>
                      {ev.text}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * VERSIONS PANEL — Side panel for resume version management
 * ============================================================================
 *
 * PURPOSE: Shows saved resume versions with create and restore actions.
 * The user can snapshot the current draft or revert to a previous version.
 *
 * RESTORE FLOW: Restoring a version replaces the current working draft.
 * Because this is destructive (it overwrites unsaved changes), a
 * confirmation step is shown before the restore executes. The user
 * can cancel to keep their current work.
 *
 * INTERACTION: All buttons have hover/focus-visible/active states.
 * The close button, create button, and restore buttons all respond
 * visibly to user interaction per the interaction-state standard.
 *
 * DISMISS: Escape key, close button, and backdrop click all close.
 */
function ResumeVersionsPanel(props: {
  store: ResumeStore;
  onClose: () => void;
  onCreateVersion: (label: string) => void;
  onRestoreVersion: (versionId: string) => void;
}) {
  const [newLabel, setNewLabel] = useState('');

  /* RESTORE CONFIRMATION: Track which version (if any) the user is
   * about to restore. When non-null, a confirmation prompt appears
   * on that version's card instead of the restore button. */
  const [confirmingRestoreId, setConfirmingRestoreId] = useState<string | null>(null);

  const versions = listVersions(props.store);

  /* Escape key closes the panel */
  useEffect(function () {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (confirmingRestoreId !== null) {
          setConfirmingRestoreId(null);
        } else {
          props.onClose();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return function () {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [props.onClose, confirmingRestoreId]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.3)' }}
      onClick={function (e: React.MouseEvent) {
        if (e.target === e.currentTarget) props.onClose();
      }}
      data-testid="versions-panel-overlay"
      role="dialog"
      aria-label="Resume Versions"
    >
      <div
        className="w-80 h-full overflow-auto"
        style={{
          background: 'var(--p-surface)',
          borderLeft: '1px solid var(--p-border)',
          boxShadow: '-4px 0 12px rgba(0,0,0,0.15)',
        }}
        data-testid="versions-panel"
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: 'var(--p-text)' }}>
              Resume Versions
            </h2>
            <button
              type="button"
              onClick={props.onClose}
              className={'flex items-center justify-center w-6 h-6 rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
              style={{
                color: 'var(--p-text-muted)',
                '--tw-ring-color': 'var(--p-accent)',
              } as React.CSSProperties}
              aria-label="Close versions panel"
              data-testid="versions-panel-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Create new version */}
          <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--p-surface2, rgba(255,255,255,0.05))' }}>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-text-muted)' }}>
              Save current draft as version
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={function (e) { setNewLabel(e.target.value); }}
                placeholder="Version name..."
                className="flex-1 px-2 py-1.5 text-xs rounded outline-none focus-visible:ring-2 focus-visible:ring-inset"
                style={{
                  background: 'var(--p-surface)',
                  border: '1px solid var(--p-border)',
                  color: 'var(--p-text)',
                  '--tw-ring-color': 'var(--p-accent)',
                } as React.CSSProperties}
                onKeyDown={function (e) {
                  if (e.key === 'Enter') {
                    props.onCreateVersion(newLabel || 'Version ' + (versions.length + 1));
                    setNewLabel('');
                  }
                }}
                data-testid="new-version-label-input"
              />
              <button
                type="button"
                onClick={function () {
                  props.onCreateVersion(newLabel || 'Version ' + (versions.length + 1));
                  setNewLabel('');
                }}
                className={'px-3 py-1.5 text-xs font-medium rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                style={{
                  background: 'var(--p-accent)',
                  color: '#ffffff',
                  border: 'none',
                  '--tw-ring-color': 'var(--p-accent)',
                } as React.CSSProperties}
                data-testid="create-version-button"
              >
                Save
              </button>
            </div>
          </div>

          {/* Version list */}
          {versions.length === 0 ? (
            <p className="text-xs py-4 text-center" style={{ color: 'var(--p-text-dim)' }}>
              No saved versions yet. Save the current draft to create your first version.
            </p>
          ) : (
            <div className="space-y-2">
              {versions.map(function (v) {
                const isConfirming = confirmingRestoreId === v.id;
                return (
                  <div
                    key={v.id}
                    className="p-3 rounded-lg"
                    style={{
                      background: 'var(--p-surface2, rgba(255,255,255,0.05))',
                      border: isConfirming
                        ? '1px solid var(--p-warning, #eab308)'
                        : '1px solid var(--p-border)',
                    }}
                    data-testid={'version-item-' + v.id}
                  >
                    <div className="text-xs font-medium" style={{ color: 'var(--p-text)' }}>
                      {v.label}
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--p-text-dim)' }}>
                      {new Date(v.createdAt).toLocaleString()}
                    </div>

                    {isConfirming ? (
                      /* RESTORE CONFIRMATION — shown when the user clicks
                       * "Restore this version". Warns that current edits
                       * will be replaced and offers Confirm / Cancel. */
                      <div className="mt-2">
                        <p className="text-[10px] mb-1.5" style={{ color: 'var(--p-warning, #eab308)' }}>
                          This will replace your current draft. Unsaved changes will be lost.
                        </p>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={function () {
                              props.onRestoreVersion(v.id);
                              setConfirmingRestoreId(null);
                            }}
                            className={'text-[10px] font-semibold px-2 py-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                            style={{
                              background: 'var(--p-warning, #eab308)',
                              color: '#000',
                              '--tw-ring-color': 'var(--p-accent)',
                            } as React.CSSProperties}
                            data-testid={'confirm-restore-' + v.id}
                          >
                            Confirm Restore
                          </button>
                          <button
                            type="button"
                            onClick={function () { setConfirmingRestoreId(null); }}
                            className={'text-[10px] font-medium px-2 py-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                            style={{
                              color: 'var(--p-text-muted)',
                              background: 'transparent',
                              border: '1px solid var(--p-border)',
                              '--tw-ring-color': 'var(--p-accent)',
                            } as React.CSSProperties}
                            data-testid={'cancel-restore-' + v.id}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={function () { setConfirmingRestoreId(v.id); }}
                        className={'mt-2 text-[10px] font-medium px-2 py-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                        style={{
                          color: 'var(--p-accent)',
                          background: 'color-mix(in srgb, var(--p-accent) 8%, transparent)',
                          '--tw-ring-color': 'var(--p-accent)',
                        } as React.CSSProperties}
                        data-testid={'restore-version-' + v.id}
                      >
                        Restore this version
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * New Resume creation modal. Offers two starting points:
 *   1. "Start from Default Resume" — clones the current default
 *      resume content into a new named version so the user can
 *      iterate from existing work.
 *   2. "Start blank from federal template" — creates a new version
 *      with empty-but-scaffolded federal resume sections (contact,
 *      summary, experience, education, skills, certifications,
 *      supporting evidence). Not a void — the section structure is
 *      present so the user can fill in fields immediately.
 *
 * After creation the new version becomes the active resume in the
 * selector via the onCreateFromDefault or onCreateBlank callbacks.
 */
function NewResumeModal(props: {
  onClose: () => void;
  onCreate: (label: string) => void;
  onCreateBlank: (label: string) => void;
}) {
  const [step, setStep] = useState<'choose' | 'name-default' | 'name-blank'>('choose');
  const [label, setLabel] = useState('');

  /* Escape key closes */
  useEffect(function () {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') props.onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return function () { document.removeEventListener('keydown', handleKeyDown); };
  }, [props.onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={function (e: React.MouseEvent) {
        if (e.target === e.currentTarget) props.onClose();
      }}
      data-testid="new-resume-modal-overlay"
    >
      <div
        className="rounded-xl shadow-2xl p-6"
        style={{
          background: 'var(--p-surface)',
          border: '1px solid var(--p-border)',
          width: '440px',
          maxWidth: '90vw',
        }}
        data-testid="new-resume-modal"
      >
        {/* ---- STEP 1: Choose starting point ---- */}
        {step === 'choose' && (
          <div>
            <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--p-text)' }}>
              Create New Resume
            </h2>
            <p className="text-xs mb-5" style={{ color: 'var(--p-text-muted)' }}>
              Choose how to start your new resume version.
            </p>

            <div className="flex flex-col gap-3">
              {/* Option 1: Start from Default Resume */}
              <button
                type="button"
                onClick={function () { setStep('name-default'); }}
                className={'w-full text-left px-4 py-3.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                style={{
                  background: 'color-mix(in srgb, var(--p-accent) 6%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--p-accent) 20%, transparent)',
                  color: 'var(--p-text)',
                  '--tw-ring-color': 'var(--p-accent)',
                } as React.CSSProperties}
                data-testid="new-resume-from-default"
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4" style={{ color: 'var(--p-accent)' }} />
                  <span className="text-xs font-semibold">Start from Default Resume</span>
                </div>
                <p className="text-[10px] ml-6" style={{ color: 'var(--p-text-muted)' }}>
                  Clone your current resume content into a new version you can tailor independently.
                </p>
              </button>

              {/* Option 2: Start blank from federal template */}
              <button
                type="button"
                onClick={function () { setStep('name-blank'); }}
                className={'w-full text-left px-4 py-3.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                style={{
                  background: 'var(--p-surface2, rgba(255,255,255,0.04))',
                  border: '1px solid var(--p-border)',
                  color: 'var(--p-text)',
                  '--tw-ring-color': 'var(--p-accent)',
                } as React.CSSProperties}
                data-testid="new-resume-blank-federal"
              >
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4" style={{ color: 'var(--p-text-muted)' }} />
                  <span className="text-xs font-semibold">Start blank from federal template</span>
                </div>
                <p className="text-[10px] ml-6" style={{ color: 'var(--p-text-muted)' }}>
                  Empty federal resume with standard section scaffolding — fill in your own content.
                </p>
              </button>
            </div>

            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={props.onClose}
                className={'px-4 py-2 text-xs font-medium rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                style={{
                  color: 'var(--p-text-muted)',
                  background: 'transparent',
                  border: '1px solid var(--p-border)',
                  '--tw-ring-color': 'var(--p-accent)',
                } as React.CSSProperties}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ---- STEP 2: Name the new version ---- */}
        {(step === 'name-default' || step === 'name-blank') && (
          <div>
            <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--p-text)' }}>
              {step === 'name-default' ? 'Name Your Resume Copy' : 'Name Your New Resume'}
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--p-text-muted)' }}>
              {step === 'name-default'
                ? 'This will clone your Default Resume content into a new version.'
                : 'This will create a blank federal resume with standard section structure.'}
            </p>
            <input
              type="text"
              value={label}
              onChange={function (e) { setLabel(e.target.value); }}
              placeholder="e.g., GS-13 Cybersecurity Application..."
              className="w-full px-3 py-2 text-xs rounded mb-4 outline-none focus-visible:ring-2 focus-visible:ring-inset"
              style={{
                background: 'var(--p-surface2, rgba(255,255,255,0.05))',
                border: '1px solid var(--p-border)',
                color: 'var(--p-text)',
                '--tw-ring-color': 'var(--p-accent)',
              } as React.CSSProperties}
              autoFocus
              onKeyDown={function (e) {
                if (e.key === 'Enter') {
                  const versionName = label.trim() || (step === 'name-default' ? 'Resume Copy' : 'New Federal Resume');
                  if (step === 'name-default') {
                    props.onCreate(versionName);
                  } else {
                    props.onCreateBlank(versionName);
                  }
                } else if (e.key === 'Escape') {
                  props.onClose();
                }
              }}
              data-testid="new-resume-label-input"
            />
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={function () { setStep('choose'); setLabel(''); }}
                className={'px-3 py-1.5 text-xs font-medium rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                style={{
                  color: 'var(--p-text-muted)',
                  background: 'transparent',
                  '--tw-ring-color': 'var(--p-accent)',
                } as React.CSSProperties}
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={props.onClose}
                  className={'px-4 py-2 text-xs font-medium rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                  style={{
                    color: 'var(--p-text-muted)',
                    background: 'transparent',
                    border: '1px solid var(--p-border)',
                    '--tw-ring-color': 'var(--p-accent)',
                  } as React.CSSProperties}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={function () {
                    const versionName = label.trim() || (step === 'name-default' ? 'Resume Copy' : 'New Federal Resume');
                    if (step === 'name-default') {
                      props.onCreate(versionName);
                    } else {
                      props.onCreateBlank(versionName);
                    }
                  }}
                  className={'px-4 py-2 text-xs font-semibold rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
                  style={{
                    background: 'var(--p-accent)',
                    color: '#ffffff',
                    border: 'none',
                    '--tw-ring-color': 'var(--p-accent)',
                  } as React.CSSProperties}
                  data-testid="create-resume-button"
                >
                  Create Resume
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// RESUME SWITCH CONFIRMATION — dirty-state guard dialog
// ===========================================================================

/**
 * Modal dialog for confirming a resume version switch when the current
 * draft may have unsaved changes. Offers three options:
 *   - Save current changes and switch (safe path)
 *   - Discard changes and switch (destructive but intentional)
 *   - Cancel (stay on current version)
 *
 * WHY: Switching versions replaces the draft in the store. Without this
 * guard, users could lose work by accidentally clicking a different
 * version in the dropdown. This is a trust-critical interaction.
 *
 * DISMISS: Escape key or Cancel button. No backdrop click dismiss
 * because this is a destructive-action confirmation where accidental
 * dismissal should be avoided.
 */
function ResumeSwitchConfirmation(props: {
  pendingVersionId: string;
  onSaveAndSwitch: () => void;
  onDiscardAndSwitch: () => void;
  onCancel: () => void;
}) {
  /* Escape key cancels the switch */
  useEffect(function () {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        props.onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return function () {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [props.onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      data-testid="resume-switch-confirmation-overlay"
      role="alertdialog"
      aria-label="Switch resume version"
    >
      <div
        className="rounded-xl shadow-2xl p-6"
        style={{
          background: 'var(--p-surface)',
          border: '1px solid var(--p-border)',
          width: '420px',
          maxWidth: '90vw',
        }}
        data-testid="resume-switch-confirmation"
      >
        <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--p-text)' }}>
          Switch Resume Version?
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--p-text-muted)' }}>
          You may have unsaved changes in your current draft. Switching to
          another version will replace the active draft.
        </p>

        <div className="flex flex-col gap-2">
          {/* Save + Switch — safe path */}
          <button
            type="button"
            onClick={props.onSaveAndSwitch}
            className={'w-full text-left px-3 py-2.5 text-xs rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
            style={{
              background: 'color-mix(in srgb, var(--p-accent) 8%, transparent)',
              color: 'var(--p-accent)',
              border: '1px solid color-mix(in srgb, var(--p-accent) 20%, transparent)',
              '--tw-ring-color': 'var(--p-accent)',
            } as React.CSSProperties}
            data-testid="switch-save-and-switch"
          >
            <span className="font-semibold">Save current changes and switch</span>
            <br />
            <span style={{ color: 'var(--p-text-dim)', fontSize: '10px' }}>
              Saves your current draft as a named version before switching
            </span>
          </button>

          {/* Discard + Switch — destructive */}
          <button
            type="button"
            onClick={props.onDiscardAndSwitch}
            className={'w-full text-left px-3 py-2.5 text-xs rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
            style={{
              background: 'color-mix(in srgb, var(--p-danger) 6%, transparent)',
              color: 'var(--p-danger)',
              border: '1px solid color-mix(in srgb, var(--p-danger) 15%, transparent)',
              '--tw-ring-color': 'var(--p-accent)',
            } as React.CSSProperties}
            data-testid="switch-discard-and-switch"
          >
            <span className="font-semibold">Discard changes and switch</span>
            <br />
            <span style={{ color: 'var(--p-text-dim)', fontSize: '10px' }}>
              Unsaved edits will be lost
            </span>
          </button>

          {/* Cancel */}
          <button
            type="button"
            onClick={props.onCancel}
            className={'w-full text-center px-3 py-2 text-xs font-medium rounded outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
            style={{
              color: 'var(--p-text-muted)',
              background: 'transparent',
              border: '1px solid var(--p-border)',
              '--tw-ring-color': 'var(--p-accent)',
            } as React.CSSProperties}
            data-testid="switch-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// FULL-DOCUMENT REVIEW — PathAdvisor resume review workspace
// ===========================================================================

/**
 * Full-document review workspace that evaluates the entire resume. This is
 * structured as a review conversation workspace rather than a static card.
 *
 * ARCHITECTURE:
 *   1. Header with "Resume Review" title
 *   2. Deterministic review summary block (readiness, strongest, blocker,
 *      top federal issue)
 *   3. Review conversation thread area below the summary — this is where
 *      future PathAdvisor LLM conversation will appear
 *   4. Composer area at bottom — currently shows a placeholder state
 *      indicating the conversation layer is not yet connected
 *
 * The summary block provides the initial review frame. The conversation
 * area below is structurally ready for the real LLM-backed review flow.
 * Until the conversation layer is wired, the composer shows an honest
 * placeholder instead of a dead input that does nothing.
 *
 * DISMISS: Escape key, close button, and backdrop click.
 */
function FullDocumentReview(props: {
  draft: ResumeDraft;
  readinessScore: number;
  sectionProgressList: SectionProgress[];
  targetJobTitle: string | null;
  onClose: () => void;
}) {
  /* Escape key closes the review */
  useEffect(function () {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        props.onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return function () {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [props.onClose]);

  /* --- Deterministic evaluation logic ---
   * Analyzes section progress to identify strongest, weakest, missing,
   * and build prioritized fix recommendations. */

  /* Find strongest section (highest completion) */
  let strongestSection: SectionProgress | null = null;
  let weakestSection: SectionProgress | null = null;
  const missingSections: SectionProgress[] = [];
  const criticalSections: SectionProgress[] = [];
  const needsWorkSections: SectionProgress[] = [];

  for (let i = 0; i < props.sectionProgressList.length; i++) {
    const sp = props.sectionProgressList[i];
    if (sp.severity === 'missing') {
      missingSections.push(sp);
      continue;
    }
    if (sp.severity === 'critical') {
      criticalSections.push(sp);
    }
    if (sp.severity === 'needs_work') {
      needsWorkSections.push(sp);
    }
    if (strongestSection === null || sp.completionPct > strongestSection.completionPct) {
      strongestSection = sp;
    }
    if (weakestSection === null || sp.completionPct < weakestSection.completionPct) {
      weakestSection = sp;
    }
  }

  /* Build biggest blocker */
  let biggestBlocker = 'No critical blockers detected.';
  if (criticalSections.length > 0) {
    biggestBlocker = criticalSections[0].label + ' has ' + criticalSections[0].highSeverityIssueCount + ' critical issue' + (criticalSections[0].highSeverityIssueCount === 1 ? '' : 's') + ' that must be resolved.';
  } else if (!props.draft.summary || props.draft.summary.trim().length === 0) {
    biggestBlocker = 'Missing Professional Summary — required for federal resume screening.';
  } else if (missingSections.length > 0) {
    biggestBlocker = missingSections[0].label + ' section is empty and should be completed.';
  }

  /* Build top 3 fix recommendations */
  const fixes: string[] = [];
  if (!props.draft.summary || props.draft.summary.trim().length === 0) {
    fixes.push('Write a Professional Summary — this is the first section HR reviewers read.');
  }
  for (let i = 0; i < criticalSections.length && fixes.length < 3; i++) {
    fixes.push('Fix critical issues in ' + criticalSections[i].label + ' (' + criticalSections[i].highSeverityIssueCount + ' high-severity).');
  }
  for (let i = 0; i < needsWorkSections.length && fixes.length < 3; i++) {
    fixes.push('Improve ' + needsWorkSections[i].label + ' (currently at ' + needsWorkSections[i].completionPct + '% completion).');
  }
  for (let i = 0; i < missingSections.length && fixes.length < 3; i++) {
    fixes.push('Complete the ' + missingSections[i].label + ' section.');
  }
  if (fixes.length === 0) {
    fixes.push('Resume is in good shape. Review the preview and export when ready.');
  }

  /* Check for missing federal details — top federal issue for summary */
  const missingFederalItems: string[] = [];
  for (let i = 0; i < props.draft.experience.length; i++) {
    const exp = props.draft.experience[i];
    if (!exp.hoursPerWeek || exp.hoursPerWeek.trim().length === 0) {
      missingFederalItems.push('Hours/week missing for: ' + exp.jobTitle);
    }
    if (!exp.grade || exp.grade.trim().length === 0) {
      missingFederalItems.push('Grade/series missing for: ' + exp.jobTitle);
    }
  }

  /* Top federal issue — one-line summary for the review summary block */
  const topFederalIssue = missingFederalItems.length > 0
    ? missingFederalItems[0]
    : null;

  const readinessColor = readinessTierColor(props.readinessScore);
  const readinessLabel = readinessBandLabel(props.readinessScore);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-auto"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={function (e: React.MouseEvent) {
        if (e.target === e.currentTarget) props.onClose();
      }}
      data-testid="full-document-review-overlay"
      role="dialog"
      aria-label="Resume review workspace"
    >
      <div
        className="relative mx-4 rounded-xl shadow-2xl flex flex-col"
        style={{
          background: 'var(--p-surface)',
          border: '1px solid var(--p-border)',
          maxWidth: '640px',
          width: '100%',
          /* Workspace feel: substantial height, centered in viewport */
          minHeight: '520px',
          maxHeight: 'calc(100vh - 96px)',
        }}
        data-testid="full-document-review"
      >
        {/* ================================================================
         * HEADER — Resume Review title with close button.
         * Structurally separated from the review body so the header
         * stays pinned at the top of the workspace.
         * ================================================================ */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--p-border)' }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: 'var(--p-accent)' }} />
            <h2 className="text-base font-bold" style={{ color: 'var(--p-text)' }}>
              Resume Review
            </h2>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className={'flex items-center justify-center w-7 h-7 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-inset ' + INTERACTIVE_HOVER_CLASS}
            style={{
              color: 'var(--p-text-muted)',
              '--tw-ring-color': 'var(--p-accent)',
            } as React.CSSProperties}
            aria-label="Close review"
            data-testid="full-review-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ================================================================
         * SCROLLABLE BODY — Review summary + conversation thread area.
         * Flex-1 and overflow-auto so the body scrolls independently
         * of the pinned header and the bottom composer area.
         * ================================================================ */}
        <div className="flex-1 overflow-auto px-6 py-4">

          {/* Target job context */}
          {props.targetJobTitle && (
            <p className="text-xs mb-4" style={{ color: 'var(--p-text-dim)' }}>
              Reviewing for: <span className="font-medium" style={{ color: 'var(--p-text-muted)' }}>{props.targetJobTitle}</span>
            </p>
          )}

          {/* ============================================================
           * REVIEW SUMMARY BLOCK — Deterministic initial review frame.
           *
           * Compact summary with four key metrics: readiness, strongest
           * section, biggest blocker, and top federal issue. This is
           * the initial frame that PathAdvisor review starts from.
           * ============================================================ */}
          <div
            className="rounded-lg mb-5 p-4"
            style={{
              background: 'var(--p-surface2, rgba(255,255,255,0.04))',
              border: '1px solid var(--p-border)',
            }}
            data-testid="review-summary-block"
          >
            {/* Readiness score — the primary metric */}
            <div
              className="flex items-baseline gap-2 mb-3 pb-3"
              style={{ borderBottom: '1px solid var(--p-border)' }}
              data-testid="review-readiness-summary"
            >
              <span className="text-2xl font-bold" style={{ color: readinessColor }}>
                {props.readinessScore}%
              </span>
              <span className="text-sm font-semibold" style={{ color: readinessColor }}>
                Ready
              </span>
              <span className="text-xs" style={{ color: 'var(--p-text-muted)' }}>
                · {readinessLabel}
              </span>
            </div>

            {/* Summary metrics — compact key/value pairs */}
            <div className="space-y-2">
              {/* Strongest section */}
              <div className="flex items-start gap-2" data-testid="review-strongest">
                <span
                  className="flex-shrink-0 mt-1 w-2 h-2 rounded-full"
                  style={{ background: 'var(--p-success)' }}
                />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--p-text-dim)' }}>
                    Strongest
                  </span>
                  <p className="text-xs" style={{ color: 'var(--p-text-muted)' }}>
                    {strongestSection ? strongestSection.label + ' — ' + strongestSection.completionPct + '% complete' : 'Not enough data yet'}
                  </p>
                </div>
              </div>

              {/* Biggest blocker */}
              <div className="flex items-start gap-2" data-testid="review-biggest-blocker">
                <span
                  className="flex-shrink-0 mt-1 w-2 h-2 rounded-full"
                  style={{ background: 'var(--p-danger, #ef4444)' }}
                />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--p-text-dim)' }}>
                    Biggest Blocker
                  </span>
                  <p className="text-xs" style={{ color: 'var(--p-text-muted)' }}>
                    {biggestBlocker}
                  </p>
                </div>
              </div>

              {/* Top federal issue — only shown if there are gaps */}
              {topFederalIssue && (
                <div className="flex items-start gap-2" data-testid="review-federal">
                  <span
                    className="flex-shrink-0 mt-1 w-2 h-2 rounded-full"
                    style={{ background: 'var(--p-warning, #eab308)' }}
                  />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--p-text-dim)' }}>
                      Top Federal Issue
                    </span>
                    <p className="text-xs" style={{ color: 'var(--p-text-muted)' }}>
                      {topFederalIssue}
                      {missingFederalItems.length > 1 ? ' (+' + (missingFederalItems.length - 1) + ' more)' : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ============================================================
           * TOP RECOMMENDED FIXES — deterministic action items
           * ============================================================ */}
          <div className="mb-5" data-testid="review-top-fixes">
            <h3 className="text-xs font-bold mb-2" style={{ color: 'var(--p-text)' }}>
              Recommended Next Steps
            </h3>
            <ol className="space-y-1.5">
              {fixes.map(function (fix, idx) {
                return (
                  <li key={idx} className="flex gap-2 text-xs leading-relaxed" style={{ color: 'var(--p-text-muted)' }}>
                    <span className="font-bold flex-shrink-0" style={{ color: 'var(--p-accent)' }}>{idx + 1}.</span>
                    <span>{fix}</span>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* ============================================================
           * REVIEW CONVERSATION THREAD AREA
           *
           * Structurally ready for future PathAdvisor LLM review
           * conversation. Currently shows a deterministic placeholder
           * that honestly communicates what will appear here.
           *
           * When the LLM conversation layer is connected, this area
           * will render a threaded conversation where PathAdvisor
           * provides deeper analysis and the user can ask follow-up
           * questions about specific sections or recommendations.
           * ============================================================ */}
          <div
            className="rounded-lg p-4"
            style={{
              background: 'color-mix(in srgb, var(--p-accent) 4%, transparent)',
              border: '1px dashed color-mix(in srgb, var(--p-accent) 20%, transparent)',
              minHeight: '80px',
            }}
            data-testid="review-conversation-thread"
          >
            <div className="flex items-start gap-2.5">
              <div
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                style={{
                  background: 'color-mix(in srgb, var(--p-accent) 15%, transparent)',
                }}
              >
                <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--p-accent)' }} />
              </div>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--p-accent)' }}>
                  PathAdvisor Review
                </p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--p-text-dim)' }}>
                  PathAdvisor review conversation will appear here once connected.
                  You will be able to ask follow-up questions about specific sections,
                  get deeper analysis of alignment gaps, and receive tailored
                  improvement suggestions.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================
         * COMPOSER AREA — Bottom-pinned area for future conversation input.
         *
         * Currently shows a clearly disabled placeholder. The composer is
         * not functional until the PathAdvisor conversation layer is wired.
         * This is an honest placeholder, not a dead input pretending to work.
         * ================================================================ */}
        <div
          className="flex-shrink-0 px-6 py-3"
          style={{ borderTop: '1px solid var(--p-border)' }}
          data-testid="review-composer-area"
        >
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{
              background: 'var(--p-surface2, rgba(255,255,255,0.04))',
              border: '1px solid var(--p-border)',
              opacity: 0.5,
              cursor: 'not-allowed',
            }}
            aria-disabled="true"
            title="PathAdvisor conversation is not yet connected"
          >
            <span className="text-xs" style={{ color: 'var(--p-text-dim)' }}>
              Ask PathAdvisor about your resume...
            </span>
            <div className="ml-auto flex-shrink-0">
              <button
                type="button"
                disabled={true}
                className="px-2.5 py-1 text-[10px] font-medium rounded"
                style={{
                  background: 'var(--p-surface)',
                  color: 'var(--p-text-dim)',
                  border: '1px solid var(--p-border)',
                  cursor: 'not-allowed',
                }}
                aria-label="Send message (not yet available)"
                tabIndex={-1}
              >
                Coming soon
              </button>
            </div>
          </div>
          <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--p-text-dim)' }}>
            Review summary is based on deterministic analysis. Conversation with PathAdvisor coming in a future update.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ReviewSection helper removed — no longer used after the Resume Review
 * evolution from static card to conversation workspace layout. */
