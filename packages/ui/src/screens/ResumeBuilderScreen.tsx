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
  Circle,
  Plus,
  Pencil,
  Sparkles,
  X,
  ArrowRight,
  GitCompare,
  Eye,
  Map,
  TrendingUp,
  Info,
} from 'lucide-react';
import {
  loadResumeStore,
  saveResumeStore,
  updateDraft,
  createDefaultDraft,
  listVersions,
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
import { scoreTierColor } from '../styles/scoreTiers';

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
export const SECTION_DEFS: Array<{ id: SectionId; label: string; icon: typeof FileText }> = [
  { id: 'contact', label: 'Contact Information', icon: User },
  { id: 'summary', label: 'Professional Summary', icon: FileText },
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

/** Mock federal details for the canvas (not yet in core model). */
const MOCK_FEDERAL_DETAILS = {
  securityClearance: 'Secret',
  veteranPreference: 'None',
  federalEmployee: true,
  highestGrade: 'GS-12',
};

/** Mock certifications for the canvas (not yet in core model). */
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
        Master Resume
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
        <strong style={{ color: 'var(--p-accent)' }}>Master Resume</strong>
      </span>
      <span style={{ color: 'var(--p-border)' }}>·</span>
      <span>Auto-saves</span>
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
// Sub-component: Tab bar
// ---------------------------------------------------------------------------

/**
 * Workspace tab bar below the left rail + center split. Shows all workspace
 * tabs with the active tab highlighted. Suggested Changes shows a badge
 * count when proposals exist.
 *
 * Uses role="tablist" / role="tab" / role="tabpanel" semantics.
 */
function TabBar(props: {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  proposalCount: number;
}) {
  return (
    <div
      className="flex items-center gap-0 px-2 flex-shrink-0"
      style={{
        borderBottom: '1px solid var(--p-border)',
        background: 'var(--p-surface)',
      }}
      role="tablist"
      aria-label="Resume Builder views"
      data-testid="resume-builder-tabs"
    >
      {WORKSPACE_TABS.map(function (tab) {
        const isActive = tab.id === props.activeTab;
        /* For Suggested Changes, show the proposal count badge. */
        const badgeCount = tab.id === 'suggested-changes' ? props.proposalCount : (tab.badge || 0);

        return (
          <button
            key={tab.id}
            type="button"
            onClick={function () { props.onTabChange(tab.id); }}
            className="px-3 py-2 text-xs font-medium transition-colors relative"
            style={{
              color: isActive ? 'var(--p-accent)' : 'var(--p-text-muted)',
              borderBottom: isActive ? '2px solid var(--p-accent)' : '2px solid transparent',
              background: 'transparent',
            }}
            role="tab"
            aria-selected={isActive}
            aria-controls={'resume-tabpanel-' + tab.id}
            id={'resume-tab-' + tab.id}
            data-testid={'resume-tab-' + tab.id}
          >
            {tab.label}
            {badgeCount > 0 && (
              <span
                className="ml-1.5 inline-flex items-center justify-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'color-mix(in srgb, var(--p-warning, #eab308) 20%, transparent)',
                  color: 'var(--p-warning, #eab308)',
                }}
              >
                {badgeCount}
              </span>
            )}
          </button>
        );
      })}
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
 * Section editor header — identifies the active section in the center
 * editing surface. Renders the section icon, full label, and contextual
 * metadata (completion %, issue count, relevance to target).
 *
 * Calmer than the main workspace top bar — this is a section-level
 * context bar, not a workspace-level control surface.
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
      className="px-8 py-3.5 flex items-center gap-3 flex-shrink-0"
      style={{
        borderBottom: '1px solid var(--p-border)',
        background: 'var(--p-surface)',
      }}
      data-testid="section-editor-header"
    >
      <IconComponent
        className="w-5 h-5 flex-shrink-0"
        style={{ color: 'var(--p-accent)' }}
      />
      <div className="flex-1">
        <h2
          className="text-sm font-semibold"
          style={{ color: 'var(--p-text)' }}
        >
          {sectionDef.label}
        </h2>
        {props.sectionMeta && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
              {completionPct}% complete
            </span>
            {issueCount > 0 && (
              <>
                <span style={{ color: 'var(--p-border)' }}>·</span>
                <span className="text-[11px]" style={{ color: 'var(--p-danger, #ef4444)' }}>
                  {issueCount} {issueCount === 1 ? 'issue' : 'issues'}
                </span>
              </>
            )}
            {relevancePct > 0 && (
              <>
                <span style={{ color: 'var(--p-border)' }}>·</span>
                <span className="text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
                  {relevancePct}% relevant to target
                </span>
              </>
            )}
          </div>
        )}
      </div>
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
      {/* Readiness chip */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--p-text-dim)' }}>
          Ready
        </span>
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded"
          style={{
            color: scoreTierColor(props.readinessScore),
            background: 'color-mix(in srgb, ' + scoreTierColor(props.readinessScore) + ' 12%, transparent)',
          }}
        >
          {props.readinessScore}
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
}) {
  const healthColor = BULLET_HEALTH_COLORS[props.bullet.health];
  const healthLabel = BULLET_HEALTH_LABELS[props.bullet.health];
  const isWeak = props.bullet.health === 'weak';
  const isGeneric = props.bullet.health === 'generic';
  const showHealthBadge = isWeak || isGeneric || props.bullet.health === 'needs-evidence';

  return (
    <div
      className="group flex items-start gap-2 py-1.5 px-1 rounded transition-colors"
      style={{
        background: isWeak
          ? 'color-mix(in srgb, var(--p-danger, #ef4444) 5%, transparent)'
          : 'transparent',
      }}
      data-testid={'bullet-row-' + props.bullet.id}
    >
      {/* Health indicator dot */}
      <span
        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
        style={{ background: healthColor }}
        aria-label={healthLabel + ' bullet'}
      />

      {/* Bullet content */}
      <div className="flex-1 min-w-0">
        {props.isEditing ? (
          /* Edit mode: textarea */
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
            className="w-full text-xs leading-relaxed px-2 py-1.5 rounded resize-y outline-none"
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
          /* View mode: text with click-to-edit */
          <div className="flex items-start gap-2">
            <p
              className="text-xs leading-relaxed flex-1 cursor-text"
              style={{ color: 'var(--p-text)' }}
              onClick={props.onEditStart}
              role="button"
              tabIndex={0}
              onKeyDown={function (e: React.KeyboardEvent<HTMLParagraphElement>) {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  props.onEditStart();
                }
              }}
              aria-label={'Edit bullet: ' + props.bullet.text.slice(0, 40)}
            >
              {'• ' + props.bullet.text}
            </p>
            {/* Health badge for non-strong bullets */}
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

        {/* Inline actions — shown for all bullets, but emphasized for weak/generic */}
        {props.showActions && !props.isEditing && (
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
 * One experience entry in the resume canvas. Shows job title, employer,
 * dates, grade, location, and individual bullets with health states.
 * Supports inline editing of bullet text and triggering rewrite suggestions.
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
    <div className="mb-4" data-testid={'experience-block-' + exp.id}>
      {/* Experience header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h4 className="text-sm font-semibold" style={{ color: 'var(--p-text)' }}>
            {exp.jobTitle}
            {exp.grade && (
              <span className="ml-2 text-[11px] font-normal" style={{ color: 'var(--p-text-dim)' }}>
                {exp.grade}
              </span>
            )}
          </h4>
          <p className="text-xs" style={{ color: 'var(--p-text-muted)' }}>
            {exp.employer}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
            {exp.location} · {exp.startDate} - {exp.endDate} · {exp.hoursPerWeek} hours/week
          </p>
        </div>
        <button
          type="button"
          className={'p-1.5 rounded ' + INTERACTIVE_HOVER_CLASS}
          style={{ color: 'var(--p-text-dim)' }}
          aria-label={'Edit ' + exp.jobTitle + ' details'}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bullets */}
      <div className="mt-2 space-y-0.5">
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

      {/* Add bullet button */}
      <button
        type="button"
        onClick={function () { props.onAddBullet(exp.id); }}
        className={'flex items-center gap-1 mt-2 px-2 py-1 text-[11px] rounded ' + INTERACTIVE_HOVER_CLASS}
        style={{
          color: 'var(--p-text-dim)',
          border: '1px dashed var(--p-border)',
          background: 'transparent',
        }}
      >
        <Plus className="w-3 h-3" />
        Add bullet
      </button>
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
 */
function ProfessionalSummaryBlock(props: {
  summary: string;
  onEdit: (text: string) => void;
  isEditing: boolean;
  editText: string;
  onEditStart: () => void;
  onEditChange: (text: string) => void;
  onEditSave: () => void;
}) {
  const isEmpty = !props.summary || !props.summary.trim();

  return (
    <div className="mb-4" data-testid="professional-summary-block">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--p-text)' }}>
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
        /* Missing state — high-impact, trust-first messaging */
        <div
          className="flex flex-col items-center justify-center py-6 rounded-lg cursor-pointer transition-colors"
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
        /* Edit mode */
        <textarea
          value={props.editText}
          onChange={function (e: React.ChangeEvent<HTMLTextAreaElement>) {
            props.onEditChange(e.target.value);
          }}
          onBlur={props.onEditSave}
          className="w-full text-xs leading-relaxed px-3 py-2 rounded resize-y outline-none"
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
        /* Filled state — click to edit */
        <p
          className="text-xs leading-relaxed cursor-text rounded px-1 py-1 transition-colors"
          style={{ color: 'var(--p-text-muted)' }}
          onClick={props.onEditStart}
          role="button"
          tabIndex={0}
          onKeyDown={function (e: React.KeyboardEvent<HTMLParagraphElement>) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              props.onEditStart();
            }
          }}
          aria-label="Edit professional summary"
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
 * phone, and email in a compact header format.
 */
function ContactHeader(props: { draft: ResumeDraft }) {
  const c = props.draft.contact;
  const name = c.fullName || 'Your Name';
  const location = (c.city && c.state) ? c.city + ', ' + c.state : '';
  const phone = c.phone || '';
  const email = c.email || '';

  return (
    <div className="text-center mb-4 pb-3" style={{ borderBottom: '1px solid var(--p-border)' }}>
      <h2 className="text-base font-bold tracking-wide" style={{ color: 'var(--p-text)' }}>
        {name.toUpperCase()}
      </h2>
      <div className="flex items-center justify-center gap-3 mt-1 text-[11px]" style={{ color: 'var(--p-text-muted)' }}>
        {location && (
          <span>{'📍 ' + location}</span>
        )}
        {phone && (
          <span>{'📞 ' + phone}</span>
        )}
        {email && (
          <span>{'📧 ' + email}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Education section on the canvas
// ---------------------------------------------------------------------------

function EducationSection(props: { draft: ResumeDraft }) {
  if (props.draft.education.length === 0) return null;

  return (
    <div className="mb-4" data-testid="education-section">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--p-text)' }}>
          Education
        </h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
          background: 'color-mix(in srgb, var(--p-success) 12%, transparent)',
          color: 'var(--p-success)',
        }}>
          Complete
        </span>
      </div>
      {props.draft.education.map(function (edu) {
        return (
          <div key={edu.id} className="mb-2">
            <p className="text-xs font-semibold" style={{ color: 'var(--p-text)' }}>
              {edu.degree} in {edu.field}
            </p>
            <p className="text-xs" style={{ color: 'var(--p-text-muted)' }}>
              {edu.institution}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
              Graduated {edu.graduationDate}
              {edu.gpa ? ' | GPA: ' + edu.gpa : ''}
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

function SkillsSection(props: { draft: ResumeDraft }) {
  if (props.draft.skills.length === 0) return null;

  return (
    <div className="mb-4" data-testid="skills-section">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--p-text)' }}>
          Skills
        </h3>
        <span className="text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
          85% relevant
        </span>
        <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--p-text-dim)' }} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {props.draft.skills.map(function (skill) {
          return (
            <span
              key={skill.id}
              className="text-[11px] px-2 py-1 rounded"
              style={{
                background: 'var(--p-surface2)',
                color: 'var(--p-text-muted)',
                border: '1px solid var(--p-border)',
              }}
            >
              {skill.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Federal Details section on the canvas
// ---------------------------------------------------------------------------

function FederalDetailsSection() {
  return (
    <div className="mb-4" data-testid="federal-details-section">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--p-text)' }}>
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
        <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--p-text-dim)' }} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <span style={{ color: 'var(--p-text-dim)' }}>Security Clearance: </span>
          <span style={{ color: 'var(--p-text)' }}>{MOCK_FEDERAL_DETAILS.securityClearance}</span>
        </div>
        <div>
          <span style={{ color: 'var(--p-text-dim)' }}>Highest Grade: </span>
          <span style={{ color: 'var(--p-text)' }}>{MOCK_FEDERAL_DETAILS.highestGrade}</span>
        </div>
        <div>
          <span style={{ color: 'var(--p-text-dim)' }}>Federal Employee: </span>
          <span style={{ color: 'var(--p-text)' }}>Yes</span>
        </div>
        <div>
          <span style={{ color: 'var(--p-text-dim)' }}>Veteran Preference: </span>
          <span style={{ color: 'var(--p-text)' }}>{MOCK_FEDERAL_DETAILS.veteranPreference}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Certifications section on the canvas
// ---------------------------------------------------------------------------

function CertificationsSection() {
  return (
    <div className="mb-4" data-testid="certifications-section">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--p-text)' }}>
          Certifications
        </h3>
        <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--p-text-dim)' }} />
      </div>
      <div className="space-y-1">
        {MOCK_CERTIFICATIONS.map(function (cert) {
          return (
            <div key={cert} className="flex items-center gap-2 text-xs" style={{ color: 'var(--p-text-muted)' }}>
              <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--p-success)' }} />
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

function SupportingEvidenceSection() {
  return (
    <div className="mb-4" data-testid="supporting-evidence-section">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--p-text)' }}>
          Supporting Evidence
        </h3>
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{
            background: 'color-mix(in srgb, var(--p-danger, #ef4444) 15%, transparent)',
            color: 'var(--p-danger, #ef4444)',
          }}
        >
          6
        </span>
        <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--p-text-dim)' }} />
      </div>
      <p className="text-[11px]" style={{ color: 'var(--p-text-dim)' }}>
        Awards, publications, training records. Add to strengthen application.
      </p>
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
   * ---- PathAdvisor: tab-aware route overrides ----
   *
   * Phase 2 improvement: the PathAdvisor rail content now reflects the
   * active tab context. In Edit, it emphasizes the weakest bullet; in
   * Suggested Changes, it emphasizes proposal review; in Coverage Map,
   * it emphasizes the biggest gap.
   *
   * Quick prompts remain the same across tabs since they are all valid
   * resume improvement actions regardless of which tab is active.
   *
   * Depends on [setOverrides, activeTab] so the rail updates when the
   * user switches tabs. The cleanup function clears overrides on unmount
   * and on tab change; the immediate re-set in the same cycle prevents
   * visible flicker.
   */
  useEffect(function () {
    /* Build tab-specific insight bullets and next best action */
    let insightBullets: string[] = [];
    let nextBestAction = {
      title: 'Improve your resume',
      text: 'Review suggestions or make direct edits.',
      ctaLabel: 'Get started',
    };

    if (activeTab === 'edit') {
      insightBullets = [
        'Weak leadership bullet flagged — missing federal language and scope.',
        'Supervisory experience is high-emphasis at GS-13/14.',
      ];
      nextBestAction = {
        title: 'Fix weakest bullet',
        text: 'Click the weak bullet and apply the rewrite, or edit manually.',
        ctaLabel: 'Fix now',
      };
    } else if (activeTab === 'suggested-changes') {
      insightBullets = [
        'Highest-impact proposal targets Federal Details compliance.',
        'Review proposals by confidence for fastest improvement.',
      ];
      nextBestAction = {
        title: 'Review top proposal',
        text: 'Start with the highest-confidence proposal. Each accept improves coverage.',
        ctaLabel: 'Review fixes',
      };
    } else if (activeTab === 'coverage-map') {
      insightBullets = [
        'Federal Details gap could cause screening rejection.',
        'Leadership / Scope at 45% — fix 2 bullets to improve.',
      ];
      nextBestAction = {
        title: 'Fix biggest gap',
        text: 'Federal Details at 30% is your lowest score.',
        ctaLabel: 'Fix now',
      };
    }

    setOverrides({
      screenId: 'resume-builder',
      viewingLabel: 'Resume Builder',
      suggestedPrompts: RESUME_BUILDER_ADVISOR_PROMPTS,
      briefingLabel: 'From Resume Builder',
      briefingHelperText: 'Ask deeper questions here.',
      composerPlaceholder: 'Ask PathAdvisor about your resume...',
      railContent: {
        insightBullets: insightBullets,
        nextBestAction: nextBestAction,
      },
    });

    return function () {
      setOverrides(null);
    };
  }, [setOverrides, activeTab]);

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
    /* Readiness = match score + small boost for existing content completeness */
    const boost = store.draft.summary && store.draft.summary.trim() ? 6 : 0;
    return Math.min(100, computedMatchScore + boost + 14);
  }, [computedMatchScore, store.draft.summary]);

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
   * Finds the SectionMeta entry matching the currently selected section
   * so the center editing header can display contextual information
   * (completion, issues, relevance) alongside the section label.
   */
  const activeSectionMeta = useMemo(function (): SectionMeta | null {
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
   * ---- Handler: section click in left organizer ----
   * Sets the active section which controls which section is rendered
   * in the center editing surface. No scroll needed because the new
   * section-focused model renders only the selected section.
   */
  const handleSectionClick = useCallback(function (sectionId: SectionId) {
    setActiveSection(sectionId);
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

    /* Switch to Edit tab and navigate to the affected section */
    setActiveTab('edit');
    setActiveSection(targetProposal.sectionKey);

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
   * Switches to the Edit tab and sets the active section. The
   * section-focused model renders only the selected section, so
   * no scrollIntoView is needed.
   */
  const handleJumpToSection = useCallback(function (sectionId: SectionId) {
    setActiveTab('edit');
    setActiveSection(sectionId);
  }, []);

  /*
   * ---- Handler: edit section from Coverage Map ----
   * Switches to the Edit tab and sets the active section. The
   * section-focused model renders only the selected section so
   * the transition is immediate.
   */
  const handleEditSection = useCallback(function (sectionId: SectionId) {
    setActiveTab('edit');
    setActiveSection(sectionId);
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
      {/* 1) Top workspace bar */}
      <WorkspaceTopBar
        savedJobs={savedJobs}
        activeTargetJobId={activeTargetJobId}
        onTargetJobChange={handleTargetJobChange}
        autonomyMode={autonomyMode}
        onAutonomyModeChange={setAutonomyMode}
        versionCount={versionCount}
        showTargetJobDropdown={showTargetJobDropdown}
        onToggleTargetJobDropdown={function () { setShowTargetJobDropdown(!showTargetJobDropdown); }}
        onCloseTargetJobDropdown={function () { setShowTargetJobDropdown(false); }}
      />

      {/* 2) Context strip */}
      <ContextStrip autonomyMode={autonomyMode} proposalCount={pendingProposalCount} />

      {/* 3) Main body: left rail + center panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left section organizer — workspace-style section panel */}
        <SectionOrganizer
          sections={MOCK_SECTION_META}
          activeSection={activeSection}
          onSectionClick={handleSectionClick}
        />

        {/* Center panel: tabs + content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <TabBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            proposalCount={pendingProposalCount}
          />

          {/* Tab content */}
          {activeTab === 'edit' ? (
            /* ---- Edit tab: section-focused editing surface ----
             *
             * Core UX change: instead of rendering the entire resume as a
             * stacked scroll, the center editing surface shows only the
             * section selected in the left organizer. This makes the user
             * feel like they have "opened" one section for focused work.
             *
             * Structure:
             *   1. Resume Brief — compact metrics strip
             *   2. Section Editor Header — identifies the active section
             *   3. Section content — only the selected section is rendered
             */
            <div
              className="flex-1 flex flex-col overflow-hidden"
              role="tabpanel"
              id="resume-tabpanel-edit"
              aria-labelledby="resume-tab-edit"
              data-testid="resume-tabpanel-edit"
            >
              {/* Resume Brief — compact summary-first metrics layer */}
              <IntelligenceStrip
                activeJob={activeJob}
                matchScore={computedMatchScore}
                readinessScore={computedReadinessScore}
                topGap={computedTopGap}
                proposalCount={pendingProposalCount}
                fastestWin={computedFastestWin}
              />

              {/* Section editor header — identifies what is being edited */}
              <SectionEditorHeader
                sectionId={activeSection}
                sectionMeta={activeSectionMeta}
              />

              {/* Section editing surface — renders only the active section */}
              <div
                ref={canvasScrollRef}
                className="flex-1 overflow-y-auto"
                style={{ background: 'var(--p-bg)' }}
              >
                <div className="max-w-[820px] mx-auto px-8 py-6">

                  {/* ---- Contact Information ---- */}
                  {activeSection === 'contact' && (
                    <div
                      ref={function (el) { sectionRefs.current['contact'] = el; }}
                      data-testid="edit-section-contact"
                    >
                      <ContactHeader draft={store.draft} />
                    </div>
                  )}

                  {/* ---- Professional Summary ---- */}
                  {activeSection === 'summary' && (
                    <div
                      ref={function (el) { sectionRefs.current['summary'] = el; }}
                      data-testid="edit-section-summary"
                    >
                      <ProfessionalSummaryBlock
                        summary={store.draft.summary}
                        onEdit={handleSummaryEditChange}
                        isEditing={editingSummary}
                        editText={editingSummaryText}
                        onEditStart={handleSummaryEditStart}
                        onEditChange={handleSummaryEditChange}
                        onEditSave={handleSummaryEditSave}
                      />
                    </div>
                  )}

                  {/* ---- Work Experience ---- */}
                  {activeSection === 'experience' && (
                    <div
                      ref={function (el) { sectionRefs.current['experience'] = el; }}
                      data-testid="edit-section-experience"
                    >
                      {store.draft.experience.map(function (exp) {
                        const bullets = bulletMap[exp.id] || [];
                        return (
                          <ExperienceBlock
                            key={exp.id}
                            experience={exp}
                            bullets={bullets}
                            editingBulletId={editingBulletId}
                            editingBulletText={editingBulletText}
                            activeSuggestionBulletId={activeSuggestionBulletId}
                            activeSuggestion={MOCK_INLINE_SUGGESTION}
                            autonomyMode={autonomyMode}
                            proposalCount={pendingProposalCount}
                            onBulletEditStart={handleBulletEditStart}
                            onBulletEditChange={handleBulletEditChange}
                            onBulletEditSave={handleBulletEditSave}
                            onBulletRewrite={handleBulletRewrite}
                            onSuggestionAccept={handleSuggestionAccept}
                            onSuggestionEditFirst={handleSuggestionEditFirst}
                            onSuggestionDismiss={handleSuggestionDismiss}
                            onAddBullet={handleAddBullet}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* ---- Education ---- */}
                  {activeSection === 'education' && (
                    <div
                      ref={function (el) { sectionRefs.current['education'] = el; }}
                      data-testid="edit-section-education"
                    >
                      <EducationSection draft={store.draft} />
                    </div>
                  )}

                  {/* ---- Skills ---- */}
                  {activeSection === 'skills' && (
                    <div
                      ref={function (el) { sectionRefs.current['skills'] = el; }}
                      data-testid="edit-section-skills"
                    >
                      <SkillsSection draft={store.draft} />
                    </div>
                  )}

                  {/* ---- Federal Details ---- */}
                  {activeSection === 'federal-details' && (
                    <div
                      ref={function (el) { sectionRefs.current['federal-details'] = el; }}
                      data-testid="edit-section-federal-details"
                    >
                      <FederalDetailsSection />
                    </div>
                  )}

                  {/* ---- Certifications ---- */}
                  {activeSection === 'certifications' && (
                    <div
                      ref={function (el) { sectionRefs.current['certifications'] = el; }}
                      data-testid="edit-section-certifications"
                    >
                      <CertificationsSection />
                    </div>
                  )}

                  {/* ---- Supporting Evidence ---- */}
                  {activeSection === 'supporting-evidence' && (
                    <div
                      ref={function (el) { sectionRefs.current['supporting-evidence'] = el; }}
                      data-testid="edit-section-supporting-evidence"
                    >
                      <SupportingEvidenceSection />
                    </div>
                  )}

                </div>
              </div>
            </div>
          ) : activeTab === 'suggested-changes' ? (
            /* ---- Suggested Changes tab: broader proposal review queue ---- */
            <SuggestedChangesTab
              proposals={proposals}
              onAccept={handleProposalAccept}
              onReject={handleProposalReject}
              onEditFirst={handleProposalEditFirst}
              activeJob={activeJob}
            />
          ) : activeTab === 'coverage-map' ? (
            /* ---- Coverage Map tab: actionable resume-to-job diagnostics ---- */
            <CoverageMapTab
              dimensions={coverageDimensions}
              activeJob={activeJob}
              onJumpToSection={handleJumpToSection}
              onSwitchToSuggestedChanges={handleSwitchToSuggestedChanges}
              onEditSection={handleEditSection}
            />
          ) : (
            /* ---- Preview / Version Diff: still scaffolded for future phases ---- */
            <TabPlaceholder tab={activeTab} />
          )}
        </div>
      </div>
    </div>
  );
}
