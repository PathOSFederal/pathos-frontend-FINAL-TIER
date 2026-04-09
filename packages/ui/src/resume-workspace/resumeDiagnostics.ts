/**
 * ============================================================================
 * RESUME DIAGNOSTICS CONTRACT HELPERS
 * ============================================================================
 *
 * PURPOSE:
 * Keep the Day 76b backend diagnostics contract in one pure module so the
 * Resume Workspace store and screen can share:
 * - typed request and response models
 * - deterministic request assembly from the current resume draft
 * - target-ref to section mapping for UI focus and highlighting
 *
 * BOUNDARY RULE:
 * This file is transport-agnostic. It does not know about Next.js routes or
 * browser navigation. It only shapes data for the backend contract and maps
 * backend target references back into Resume Workspace section ids.
 */

import type { ResumeDraft } from '@pathos/core';
import type {
  ResumeBuilderSection,
  ResumeDraftSummary,
} from '../stores/resumeWorkspaceStore';

export type ResumeDiagnosticsEvaluationMode = 'full_document' | 'section_subset';
export type ResumeDiagnosticsTargetMode = 'role' | 'canonical_job' | 'none';

export interface ResumeBulletInput {
  bullet_id: string;
  text: string;
}

export interface ResumeSectionInput {
  section_id: string;
  section_type:
    | 'contact'
    | 'summary'
    | 'experience'
    | 'education'
    | 'skills'
    | 'projects'
    | 'certifications'
    | 'other';
  title?: string | null;
  content?: string | null;
  bullets?: ResumeBulletInput[];
}

export type ResumeDiagnosticsTargetContext =
  | {
      mode: 'role';
      target_role: string;
      canonical_job_id?: null;
    }
  | {
      mode: 'canonical_job';
      target_role?: string | null;
      canonical_job_id: string;
    }
  | {
      mode: 'none';
    };

export interface ResumeDiagnosticsEvaluateRequest {
  request_id?: string;
  resume: {
    resume_id?: string | null;
    revision_id?: string | null;
    document_text?: string | null;
    sections: ResumeSectionInput[];
  };
  target_context?: ResumeDiagnosticsTargetContext | null;
  scope: {
    evaluation_mode: ResumeDiagnosticsEvaluationMode;
    section_ids?: string[];
  };
  options?: {
    include_recommendations?: boolean;
    include_examples?: boolean;
  };
}

export interface ResumeTargetRef {
  section_id: string;
  bullet_id?: string | null;
}

export interface ResumeEvidenceRef {
  source: 'resume_text' | 'target_context' | 'derived_rule';
  section_id?: string | null;
  bullet_id?: string | null;
  excerpt?: string | null;
}

export interface ResumeCategoryScore {
  code:
    | 'clarity'
    | 'metrics'
    | 'completeness'
    | 'alignment'
    | 'structure'
    | 'federal_readiness';
  label: string;
  score: number | null;
  max_score: number;
}

export interface ResumeDiagnosticsIssue {
  issue_id: string;
  code:
    | 'MISSING_QUANTIFIED_OUTCOME'
    | 'RESPONSIBILITY_HEAVY_BULLET'
    | 'WEAK_ACTION_VERB'
    | 'BULLET_TOO_LONG'
    | 'SUMMARY_MISSING_TARGET_ALIGNMENT'
    | 'SKILLS_TOO_GENERIC'
    | 'SECTION_INCOMPLETE'
    | 'REPEATED_PHRASING'
    | 'MISSING_TARGET_GRADE_EVIDENCE'
    | 'INSUFFICIENT_TARGET_CONTEXT';
  category: ResumeCategoryScore['code'];
  severity: 'low' | 'medium' | 'high';
  title: string;
  detail: string;
  target_refs: ResumeTargetRef[];
  why_it_matters: string;
  evidence_refs: ResumeEvidenceRef[];
}

export interface ResumeDiagnosticsRecommendation {
  code:
    | 'ADD_RESULT_METRIC'
    | 'REWRITE_FOR_OUTCOME'
    | 'STRENGTHEN_ACTION_VERB'
    | 'SHORTEN_BULLET'
    | 'ALIGN_SUMMARY_TO_TARGET'
    | 'EXPAND_RELEVANT_SKILLS'
    | 'COMPLETE_SECTION'
    | 'REDUCE_REPETITION'
    | 'ADD_GRADE_SCOPE_EVIDENCE'
    | 'ADD_TARGET_CONTEXT';
  priority: number;
  title: string;
  detail: string;
  target_refs: ResumeTargetRef[];
}

export interface ResumeDiagnosticsWarning {
  code: string;
  text: string;
}

export interface ResumeOverallSummaryExplanation {
  headline?: string | null;
  detail?: string | null;
  top_priority?: string | null;
}

export interface ResumeKeyTakeawayExplanation {
  takeaway_id?: string | null;
  title?: string | null;
  detail?: string | null;
  target_refs?: ResumeTargetRef[] | null;
}

export interface ResumeSectionExplanation {
  section_id: string;
  title?: string | null;
  what_is_wrong?: string | null;
  why_it_matters?: string | null;
  what_to_do?: string | null;
  target_refs?: ResumeTargetRef[] | null;
}

export interface ResumeRecommendationExplanation {
  code?: string | null;
  title?: string | null;
  short_explanation?: string | null;
  action_hint?: string | null;
  target_refs?: ResumeTargetRef[] | null;
}

export interface ResumeWarningExplanation {
  code?: string | null;
  title?: string | null;
  detail?: string | null;
}

export interface ResumeDiagnosticsExplanations {
  overall_summary?: ResumeOverallSummaryExplanation | null;
  key_takeaways?: ResumeKeyTakeawayExplanation[] | null;
  section_explanations?: ResumeSectionExplanation[] | null;
  recommendation_explanations?: ResumeRecommendationExplanation[] | null;
  warning_explanations?: ResumeWarningExplanation[] | null;
}

export interface ResumeMissingEvidenceItem {
  code: string;
  text: string;
  target_refs?: ResumeTargetRef[];
}

export interface ResumeDiagnosticsMeta {
  engine_version: string;
  ruleset_version: string;
  explainability_version: string;
  knowledge_pack_version?: string | null;
  input_hash: string;
}

export interface ResumeDiagnosticsEvaluateResponse {
  response_state:
    | 'evaluated'
    | 'insufficient_input'
    | 'unsupported_context';
  diagnostics_id: string;
  resume_id?: string | null;
  revision_id?: string | null;
  scope: {
    evaluation_mode: ResumeDiagnosticsEvaluationMode;
    evaluated_section_ids: string[];
  };
  target_context?: {
    mode: ResumeDiagnosticsTargetMode;
    target_role?: string | null;
    canonical_job_id?: string | null;
  } | null;
  overall: {
    readiness_band:
      | 'strong'
      | 'workable'
      | 'needs_revision'
      | 'insufficient_evidence';
    score: number | null;
    summary: string;
  };
  category_scores: ResumeCategoryScore[];
  issues: ResumeDiagnosticsIssue[];
  recommendations: ResumeDiagnosticsRecommendation[];
  warnings: ResumeDiagnosticsWarning[];
  missing_evidence: ResumeMissingEvidenceItem[];
  explanations?: ResumeDiagnosticsExplanations | null;
  meta: ResumeDiagnosticsMeta;
}

/**
 * Resume Workspace already uses these canonical builder section ids. The
 * diagnostics contract can name a few additional sections, so the mapper keeps
 * the UI behavior bounded and explicit when no dedicated editor exists yet.
 */
export function mapDiagnosticsSectionIdToBuilderSection(
  sectionId: string
): ResumeBuilderSection {
  if (sectionId === 'contact') {
    return 'contact';
  }
  if (sectionId === 'summary') {
    return 'summary';
  }
  if (sectionId === 'experience') {
    return 'experience';
  }
  if (sectionId === 'education') {
    return 'education';
  }
  if (sectionId === 'skills') {
    return 'skills';
  }
  return 'review';
}

export function formatReadinessBandLabel(
  readinessBand: ResumeDiagnosticsEvaluateResponse['overall']['readiness_band']
): string {
  if (readinessBand === 'strong') {
    return 'Strong';
  }
  if (readinessBand === 'workable') {
    return 'Workable';
  }
  if (readinessBand === 'needs_revision') {
    return 'Needs revision';
  }
  return 'Insufficient evidence';
}

function pushIfNotEmpty(target: string[], value: string): void {
  const trimmed = value.trim();
  if (trimmed.length > 0) {
    target.push(trimmed);
  }
}

function splitMultilineText(value: string): string[] {
  const parts = value.split('\n');
  const lines: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const trimmed = parts[i].trim();
    if (trimmed.length > 0) {
      lines.push(trimmed);
    }
  }
  return lines;
}

function buildContactContent(draft: ResumeDraft): string {
  const lines: string[] = [];
  pushIfNotEmpty(lines, draft.contact.fullName);
  pushIfNotEmpty(lines, draft.contact.email);
  pushIfNotEmpty(lines, draft.contact.phone);
  if (
    draft.contact.city.trim().length > 0 ||
    draft.contact.state.trim().length > 0
  ) {
    lines.push(
      draft.contact.city.trim() + (
        draft.contact.city.trim().length > 0 &&
        draft.contact.state.trim().length > 0
          ? ', '
          : ''
      ) + draft.contact.state.trim()
    );
  }
  pushIfNotEmpty(lines, draft.contact.citizenship);
  pushIfNotEmpty(lines, draft.contact.veteranStatus);
  return lines.join('\n');
}

function buildExperienceBullets(draft: ResumeDraft): ResumeBulletInput[] {
  const bullets: ResumeBulletInput[] = [];
  for (let i = 0; i < draft.experience.length; i++) {
    const experience = draft.experience[i];
    const lines = splitMultilineText(experience.duties);
    if (lines.length === 0) {
      const summaryParts: string[] = [];
      pushIfNotEmpty(summaryParts, experience.jobTitle);
      pushIfNotEmpty(summaryParts, experience.employer);
      pushIfNotEmpty(summaryParts, experience.location);
      if (summaryParts.length > 0) {
        bullets.push({
          bullet_id: experience.id + '-summary',
          text: summaryParts.join(' | '),
        });
      }
      continue;
    }
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      bullets.push({
        bullet_id: experience.id + '-bullet-' + lineIndex.toString(),
        text: lines[lineIndex],
      });
    }
  }
  return bullets;
}

function buildEducationBullets(draft: ResumeDraft): ResumeBulletInput[] {
  const bullets: ResumeBulletInput[] = [];
  for (let i = 0; i < draft.education.length; i++) {
    const education = draft.education[i];
    const pieces: string[] = [];
    pushIfNotEmpty(pieces, education.institution);
    pushIfNotEmpty(pieces, education.degree);
    pushIfNotEmpty(pieces, education.field);
    pushIfNotEmpty(pieces, education.graduationDate);
    pushIfNotEmpty(pieces, education.gpa);
    if (pieces.length > 0) {
      bullets.push({
        bullet_id: education.id,
        text: pieces.join(' | '),
      });
    }
  }
  return bullets;
}

function buildSkillBullets(draft: ResumeDraft): ResumeBulletInput[] {
  const bullets: ResumeBulletInput[] = [];
  for (let i = 0; i < draft.skills.length; i++) {
    const skill = draft.skills[i];
    if (skill.name.trim().length > 0) {
      bullets.push({
        bullet_id: skill.id,
        text: skill.name.trim(),
      });
    }
  }
  return bullets;
}

function buildCertificationBullets(draft: ResumeDraft): ResumeBulletInput[] {
  const bullets: ResumeBulletInput[] = [];
  for (let i = 0; i < draft.certifications.length; i++) {
    const certification = draft.certifications[i];
    if (certification.name.trim().length > 0) {
      bullets.push({
        bullet_id: certification.id,
        text: certification.name.trim(),
      });
    }
  }
  return bullets;
}

function buildSupportingEvidenceBullets(draft: ResumeDraft): ResumeBulletInput[] {
  const bullets: ResumeBulletInput[] = [];
  for (let i = 0; i < draft.supportingEvidence.length; i++) {
    const item = draft.supportingEvidence[i];
    if (item.text.trim().length > 0) {
      bullets.push({
        bullet_id: item.id,
        text: item.text.trim(),
      });
    }
  }
  return bullets;
}

function maybePushSection(
  sections: ResumeSectionInput[],
  section: ResumeSectionInput
): void {
  const hasContent =
    typeof section.content === 'string' && section.content.trim().length > 0;
  const hasBullets =
    Array.isArray(section.bullets) && section.bullets.length > 0;
  if (hasContent || hasBullets) {
    sections.push(section);
  }
}

export function buildResumeDiagnosticsRequest(
  summary: ResumeDraftSummary | null,
  draft: ResumeDraft
): ResumeDiagnosticsEvaluateRequest {
  const sections: ResumeSectionInput[] = [];
  const contactContent = buildContactContent(draft);
  const experienceBullets = buildExperienceBullets(draft);
  const educationBullets = buildEducationBullets(draft);
  const skillBullets = buildSkillBullets(draft);
  const certificationBullets = buildCertificationBullets(draft);
  const supportingEvidenceBullets = buildSupportingEvidenceBullets(draft);

  maybePushSection(sections, {
    section_id: 'contact',
    section_type: 'contact',
    title: 'Contact',
    content: contactContent.length > 0 ? contactContent : null,
  });
  maybePushSection(sections, {
    section_id: 'summary',
    section_type: 'summary',
    title: 'Summary',
    content: draft.summary.trim().length > 0 ? draft.summary.trim() : null,
  });
  maybePushSection(sections, {
    section_id: 'experience',
    section_type: 'experience',
    title: 'Experience',
    bullets: experienceBullets,
  });
  maybePushSection(sections, {
    section_id: 'education',
    section_type: 'education',
    title: 'Education',
    bullets: educationBullets,
  });
  maybePushSection(sections, {
    section_id: 'skills',
    section_type: 'skills',
    title: 'Skills',
    bullets: skillBullets,
  });
  maybePushSection(sections, {
    section_id: 'certifications',
    section_type: 'certifications',
    title: 'Certifications',
    bullets: certificationBullets,
  });
  maybePushSection(sections, {
    section_id: 'other',
    section_type: 'other',
    title: 'Supporting evidence',
    bullets: supportingEvidenceBullets,
  });

  let documentText: string | null = null;
  const textParts: string[] = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (typeof section.title === 'string' && section.title.trim().length > 0) {
      textParts.push(section.title.trim());
    }
    if (typeof section.content === 'string' && section.content.trim().length > 0) {
      textParts.push(section.content.trim());
    }
    if (Array.isArray(section.bullets)) {
      for (let bulletIndex = 0; bulletIndex < section.bullets.length; bulletIndex++) {
        textParts.push(section.bullets[bulletIndex].text);
      }
    }
  }
  if (textParts.length > 0) {
    documentText = textParts.join('\n\n');
  }

  let targetContext: ResumeDiagnosticsTargetContext = { mode: 'none' };
  if (
    summary !== null &&
    summary.targetContext.linkedJobId !== null &&
    summary.targetContext.linkedJobId.trim().length > 0
  ) {
    targetContext = {
      mode: 'canonical_job',
      target_role:
        summary.targetContext.targetRoleTitle.trim().length > 0
          ? summary.targetContext.targetRoleTitle.trim()
          : null,
      canonical_job_id: summary.targetContext.linkedJobId.trim(),
    };
  } else if (
    summary !== null &&
    summary.targetContext.targetRoleTitle.trim().length > 0
  ) {
    targetContext = {
      mode: 'role',
      target_role: summary.targetContext.targetRoleTitle.trim(),
      canonical_job_id: null,
    };
  }

  return {
    resume: {
      resume_id: summary !== null ? summary.id : null,
      revision_id: summary !== null ? summary.currentRevisionId : null,
      document_text: documentText,
      sections: sections,
    },
    target_context: targetContext,
    scope: {
      evaluation_mode: 'full_document',
    },
    options: {
      include_recommendations: true,
      include_examples: false,
    },
  };
}

export function collectTargetedBuilderSections(
  targetRefs: ResumeTargetRef[]
): ResumeBuilderSection[] {
  const ordered: ResumeBuilderSection[] = [];
  for (let i = 0; i < targetRefs.length; i++) {
    const mapped = mapDiagnosticsSectionIdToBuilderSection(
      targetRefs[i].section_id
    );
    let exists = false;
    for (let orderedIndex = 0; orderedIndex < ordered.length; orderedIndex++) {
      if (ordered[orderedIndex] === mapped) {
        exists = true;
        break;
      }
    }
    if (!exists) {
      ordered.push(mapped);
    }
  }
  return ordered;
}
