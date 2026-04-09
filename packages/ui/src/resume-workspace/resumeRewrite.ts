/**
 * ============================================================================
 * RESUME REWRITE CONTRACT + HELPERS — Day 85 bounded rewrite assistance
 * ============================================================================
 *
 * PURPOSE:
 * Keep the Day 85 rewrite-assistance logic explicit, reviewable, and grounded
 * in backend-owned diagnostics. This module owns:
 * - the bounded rewrite request/response contract
 * - launch eligibility rules for the current builder/review handoff
 * - target resolution from backend target refs into current resume text
 * - strict matching between backend recommendations and explanation cards
 * - builder-native rewrite action shaping for specific sections
 * - deterministic apply helpers for approved rewrite candidates
 *
 * IMPORTANT TRUST BOUNDARY:
 * This file does not generate rewrite candidates. It only shapes grounded
 * requests, resolves the exact text being rewritten, and applies an explicitly
 * chosen candidate back into the draft.
 */

import type { ResumeDraft } from '@pathos/core';
import type {
  ResumeDraftSummary,
  ResumeDiagnosticsSnapshot,
} from '../stores/resumeWorkspaceStore';
import type {
  ResumeDiagnosticsEvaluateResponse,
  ResumeDiagnosticsIssue,
  ResumeDiagnosticsRecommendation,
  ResumeRecommendationExplanation,
  ResumeTargetRef,
} from './resumeDiagnostics';

export type ResumeRewriteStatus =
   | 'idle'
   | 'loading'
   | 'ready'
   | 'applied'
   | 'dismissed'
   | 'error'
   | 'unavailable';

export interface ResumeRewriteCandidate {
   candidate_id: string;
   label: string | null;
   text: string;
   rationale: string | null;
 }

export interface ResumeRewriteRequest {
   rewrite_request_id: string;
   resume: {
     resume_id: string | null;
     variant_id: string;
     revision_id: string;
     snapshot_id: string;
     diagnostics_id: string;
   };
   target: {
     section_id: string;
     bullet_id: string | null;
     original_text: string;
   };
   grounding: {
     issue_code: ResumeDiagnosticsIssue['code'] | null;
     recommendation_code: ResumeDiagnosticsRecommendation['code'] | null;
     explanation_title: string | null;
     explanation_detail: string | null;
     action_hint: string | null;
     target_role: string | null;
   };
 }

export interface ResumeRewriteResponse {
   rewrite_request_id: string;
   status: 'ready';
   candidates: ResumeRewriteCandidate[];
 }

export interface ResumeRewriteState {
   status: ResumeRewriteStatus;
   request: ResumeRewriteRequest | null;
   candidates: ResumeRewriteCandidate[];
   errorMessage: string | null;
   appliedCandidateId: string | null;
 }

export interface ResumeRewriteEligibility {
   canRewrite: boolean;
   reason: string | null;
 }

export interface ResumeResolvedRewriteTarget {
   sectionId: string;
   bulletId: string | null;
   originalText: string;
 }

export interface BuildResumeRewriteRequestOptions {
   summary: ResumeDraftSummary;
   draft: ResumeDraft;
   latestSnapshot: ResumeDiagnosticsSnapshot | null;
   selectedSnapshot: ResumeDiagnosticsSnapshot | null;
   diagnosticsResponse: ResumeDiagnosticsEvaluateResponse | null;
   recommendation: ResumeDiagnosticsRecommendation | null;
  explanation: ResumeRecommendationExplanation | null;
 }

export interface ResumeSectionRewriteAction {
  request: ResumeRewriteRequest;
  recommendation: ResumeDiagnosticsRecommendation;
  explanation: ResumeRecommendationExplanation | null;
  targetLabel: string;
}

export interface ApplyResumeRewriteResult {
  nextDraft: ResumeDraft | null;
  appliedSectionId: 'summary' | 'skills' | 'experience' | null;
}

 function cloneDraft(draft: ResumeDraft): ResumeDraft {
   return JSON.parse(JSON.stringify(draft)) as ResumeDraft;
 }

 function trimToNull(value: string | null | undefined): string | null {
   if (typeof value !== 'string') {
     return null;
   }
   const trimmed = value.trim();
   if (trimmed.length === 0) {
     return null;
   }
   return trimmed;
 }

function buildRewriteRequestId(): string {
  return 'rewrite-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function isRewriteCapableRecommendationCode(
  code: ResumeDiagnosticsRecommendation['code'] | null | undefined
): boolean {
  return (
    code === 'ADD_RESULT_METRIC' ||
    code === 'REWRITE_FOR_OUTCOME' ||
    code === 'STRENGTHEN_ACTION_VERB' ||
    code === 'SHORTEN_BULLET' ||
    code === 'ALIGN_SUMMARY_TO_TARGET' ||
    code === 'EXPAND_RELEVANT_SKILLS'
  );
}

 /**
  * Day 85 is intentionally strict about trust. Rewrite launches are allowed
  * only when the user is looking at the latest saved snapshot and that
  * snapshot still matches the current revision.
  */
export function getResumeRewriteEligibility(
   summary: ResumeDraftSummary,
   latestSnapshot: ResumeDiagnosticsSnapshot | null,
   selectedSnapshot: ResumeDiagnosticsSnapshot | null,
   diagnosticsResponse: ResumeDiagnosticsEvaluateResponse | null
 ): ResumeRewriteEligibility {
   if (latestSnapshot === null || diagnosticsResponse === null) {
     return {
       canRewrite: false,
       reason: 'Run diagnostics before requesting rewrite suggestions.',
     };
   }

   if (selectedSnapshot === null || selectedSnapshot.snapshotId !== latestSnapshot.snapshotId) {
     return {
       canRewrite: false,
       reason: 'Rewrite suggestions require the latest saved evaluation, not a historical snapshot.',
     };
   }

   if (latestSnapshot.revisionId !== summary.currentRevisionId) {
     return {
       canRewrite: false,
       reason: 'This resume changed after the last evaluation. Re-run diagnostics before requesting rewrites.',
     };
   }

   if (diagnosticsResponse.response_state !== 'evaluated') {
     return {
       canRewrite: false,
       reason: 'Rewrite suggestions are available only when the backend returned an evaluated diagnostics result.',
     };
   }

   return {
     canRewrite: true,
     reason: null,
   };
 }

 function splitLines(value: string): string[] {
   return value.split('\n');
 }

 function parseExperienceBulletId(bulletId: string): {
   experienceId: string;
   bulletIndex: number;
 } | null {
   const marker = '-bullet-';
   const markerIndex = bulletId.lastIndexOf(marker);
   if (markerIndex <= 0) {
     return null;
   }
   const experienceId = bulletId.slice(0, markerIndex);
   const indexText = bulletId.slice(markerIndex + marker.length);
   if (experienceId.trim().length === 0 || indexText.trim().length === 0) {
     return null;
   }
   const parsedIndex = Number(indexText);
   if (!Number.isInteger(parsedIndex) || parsedIndex < 0) {
     return null;
   }
   return {
     experienceId: experienceId,
     bulletIndex: parsedIndex,
   };
 }

 /**
  * Resolve the exact visible text being rewritten. The Day 85 request payload
  * must carry the original text so the server can generate bounded candidates
  * without inventing what the user currently sees.
  */
export function resolveResumeRewriteTarget(
   draft: ResumeDraft,
   targetRef: ResumeTargetRef
 ): ResumeResolvedRewriteTarget | null {
   if (targetRef.section_id === 'summary') {
     const summaryText = trimToNull(draft.summary);
     if (summaryText === null) {
       return null;
     }
     return {
       sectionId: 'summary',
       bulletId: null,
       originalText: summaryText,
     };
   }

   if (targetRef.section_id === 'skills') {
     if (targetRef.bullet_id !== null && targetRef.bullet_id !== undefined) {
       for (let i = 0; i < draft.skills.length; i++) {
         if (draft.skills[i].id === targetRef.bullet_id) {
           const skillName = trimToNull(draft.skills[i].name);
           if (skillName === null) {
             return null;
           }
           return {
             sectionId: 'skills',
             bulletId: targetRef.bullet_id,
             originalText: skillName,
           };
         }
       }
       return null;
     }

     const skillNames: string[] = [];
     for (let i = 0; i < draft.skills.length; i++) {
       const skillName = trimToNull(draft.skills[i].name);
       if (skillName !== null) {
         skillNames.push(skillName);
       }
     }
     if (skillNames.length === 0) {
       return null;
     }
     return {
       sectionId: 'skills',
       bulletId: null,
       originalText: skillNames.join(', '),
     };
   }

   if (
     targetRef.section_id === 'experience' &&
     typeof targetRef.bullet_id === 'string' &&
     targetRef.bullet_id.trim().length > 0
   ) {
     const parsedBullet = parseExperienceBulletId(targetRef.bullet_id);
     if (parsedBullet === null) {
       return null;
     }
     for (let i = 0; i < draft.experience.length; i++) {
       const entry = draft.experience[i];
       if (entry.id !== parsedBullet.experienceId) {
         continue;
       }
       const lines = splitLines(entry.duties);
       if (parsedBullet.bulletIndex >= lines.length) {
         return null;
       }
       const resolvedLine = trimToNull(lines[parsedBullet.bulletIndex]);
       if (resolvedLine === null) {
         return null;
       }
       return {
         sectionId: 'experience',
         bulletId: targetRef.bullet_id,
         originalText: resolvedLine,
       };
     }
   }

   return null;
 }

function targetRefMatches(
  issueTargetRefs: ResumeTargetRef[],
  targetRef: ResumeTargetRef
 ): boolean {
   for (let i = 0; i < issueTargetRefs.length; i++) {
     const issueTarget = issueTargetRefs[i];
     if (issueTarget.section_id !== targetRef.section_id) {
       continue;
     }
     if ((issueTarget.bullet_id ? issueTarget.bullet_id : null) === (targetRef.bullet_id ? targetRef.bullet_id : null)) {
       return true;
     }
   }
  return false;
 }

function normalizeBulletId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

function normalizeTargetRef(
  targetRef: ResumeTargetRef
): ResumeTargetRef {
  return {
    section_id: targetRef.section_id,
    bullet_id: normalizeBulletId(targetRef.bullet_id),
  };
}

function targetRefEquals(
  left: ResumeTargetRef,
  right: ResumeTargetRef
): boolean {
  const normalizedLeft = normalizeTargetRef(left);
  const normalizedRight = normalizeTargetRef(right);
  return (
    normalizedLeft.section_id === normalizedRight.section_id &&
    normalizedLeft.bullet_id === normalizedRight.bullet_id
  );
}

function targetRefsOverlap(
  left: ResumeTargetRef[] | null | undefined,
  right: ResumeTargetRef[] | null | undefined
): boolean {
  if (!Array.isArray(left) || !Array.isArray(right)) {
    return false;
  }
  for (let leftIndex = 0; leftIndex < left.length; leftIndex++) {
    for (let rightIndex = 0; rightIndex < right.length; rightIndex++) {
      if (targetRefEquals(left[leftIndex], right[rightIndex])) {
        return true;
      }
    }
  }
  return false;
}

function buildRewriteTargetLabel(
  recommendation: ResumeDiagnosticsRecommendation
): string {
  if (
    Array.isArray(recommendation.target_refs) &&
    recommendation.target_refs.length > 0
  ) {
    const targetRef = recommendation.target_refs[0];
    if (
      typeof targetRef.bullet_id === 'string' &&
      targetRef.bullet_id.trim().length > 0
    ) {
      return 'Target ' + targetRef.bullet_id;
    }
    return 'Target ' + targetRef.section_id;
  }
  return 'Target section';
}

 function severityRank(severity: ResumeDiagnosticsIssue['severity']): number {
   if (severity === 'high') {
     return 3;
   }
   if (severity === 'medium') {
     return 2;
   }
   return 1;
 }

 /**
  * Recommendation cards are the Day 85 launch point, but the request remains
  * anchored to issue codes when a matching issue exists for the same target.
  */
export function findGroundingIssueForRecommendation(
   diagnosticsResponse: ResumeDiagnosticsEvaluateResponse | null,
   recommendation: ResumeDiagnosticsRecommendation | null
 ): ResumeDiagnosticsIssue | null {
   if (diagnosticsResponse === null || recommendation === null) {
     return null;
   }
   let bestMatch: ResumeDiagnosticsIssue | null = null;
   for (let i = 0; i < diagnosticsResponse.issues.length; i++) {
     const issue = diagnosticsResponse.issues[i];
     if (!targetRefMatches(issue.target_refs, recommendation.target_refs[0])) {
       continue;
     }
     if (
       bestMatch === null ||
       severityRank(issue.severity) > severityRank(bestMatch.severity)
     ) {
       bestMatch = issue;
     }
   }
  return bestMatch;
 }

export function findMatchingDiagnosticsRecommendationForExplanation(
  diagnosticsRecommendations: ResumeDiagnosticsRecommendation[] | null | undefined,
  explanation: ResumeRecommendationExplanation | null | undefined
): ResumeDiagnosticsRecommendation | null {
  if (
    !Array.isArray(diagnosticsRecommendations) ||
    explanation === null ||
    explanation === undefined ||
    typeof explanation.code !== 'string'
  ) {
    return null;
  }

  const explanationCode = explanation.code.trim();
  if (explanationCode.length === 0) {
    return null;
  }

  let fallbackMatch: ResumeDiagnosticsRecommendation | null = null;
  for (let recommendationIndex = 0; recommendationIndex < diagnosticsRecommendations.length; recommendationIndex++) {
    const recommendation = diagnosticsRecommendations[recommendationIndex];
    if (recommendation.code !== explanationCode) {
      continue;
    }
    if (
      targetRefsOverlap(recommendation.target_refs, explanation.target_refs)
    ) {
      return recommendation;
    }
    if (fallbackMatch === null) {
      fallbackMatch = recommendation;
    }
  }
  return fallbackMatch;
}

export function buildResumeRewriteRequest(
   options: BuildResumeRewriteRequestOptions
 ): ResumeRewriteRequest | null {
   if (
     options.latestSnapshot === null ||
     options.selectedSnapshot === null ||
     options.diagnosticsResponse === null ||
     options.recommendation === null
   ) {
     return null;
   }

   if (!Array.isArray(options.recommendation.target_refs) || options.recommendation.target_refs.length === 0) {
     return null;
   }

   const resolvedTarget = resolveResumeRewriteTarget(
     options.draft,
     options.recommendation.target_refs[0]
   );
   if (resolvedTarget === null) {
     return null;
   }

   const groundingIssue = findGroundingIssueForRecommendation(
     options.diagnosticsResponse,
     options.recommendation
   );
   const targetContext = options.diagnosticsResponse.target_context;

   return {
     rewrite_request_id: buildRewriteRequestId(),
     resume: {
       resume_id: options.summary.id,
       variant_id: options.summary.variantId,
       revision_id: options.summary.currentRevisionId,
       snapshot_id: options.latestSnapshot.snapshotId,
       diagnostics_id: options.latestSnapshot.diagnosticsId,
     },
     target: {
       section_id: resolvedTarget.sectionId,
       bullet_id: resolvedTarget.bulletId,
       original_text: resolvedTarget.originalText,
     },
     grounding: {
       issue_code: groundingIssue !== null ? groundingIssue.code : null,
       recommendation_code: options.recommendation.code,
       explanation_title:
         options.explanation !== null ? trimToNull(options.explanation.title) : null,
       explanation_detail:
         options.explanation !== null
           ? trimToNull(options.explanation.short_explanation)
           : null,
       action_hint:
         options.explanation !== null
           ? trimToNull(options.explanation.action_hint)
           : null,
       target_role:
         targetContext !== null && targetContext !== undefined && targetContext.mode === 'role'
           ? trimToNull(targetContext.target_role)
           : null,
     },
  };
 }

export function listResumeSectionRewriteActions(
  options: BuildResumeRewriteRequestOptions,
  sectionId: string
): ResumeSectionRewriteAction[] {
  if (options.diagnosticsResponse === null) {
    return [];
  }

  const actions: ResumeSectionRewriteAction[] = [];
  for (
    let recommendationIndex = 0;
    recommendationIndex < options.diagnosticsResponse.recommendations.length;
    recommendationIndex++
  ) {
    const recommendation =
      options.diagnosticsResponse.recommendations[recommendationIndex];
    if (!isRewriteCapableRecommendationCode(recommendation.code)) {
      continue;
    }
    if (
      !Array.isArray(recommendation.target_refs) ||
      recommendation.target_refs.length === 0 ||
      recommendation.target_refs[0].section_id !== sectionId
    ) {
      continue;
    }

    let matchedExplanation: ResumeRecommendationExplanation | null = null;
    if (
      options.diagnosticsResponse.explanations !== null &&
      options.diagnosticsResponse.explanations !== undefined &&
      Array.isArray(options.diagnosticsResponse.explanations.recommendation_explanations)
    ) {
      for (
        let explanationIndex = 0;
        explanationIndex < options.diagnosticsResponse.explanations.recommendation_explanations.length;
        explanationIndex++
      ) {
        const currentExplanation =
          options.diagnosticsResponse.explanations.recommendation_explanations[explanationIndex];
        const matchedRecommendation =
          findMatchingDiagnosticsRecommendationForExplanation(
            [recommendation],
            currentExplanation
          );
        if (matchedRecommendation !== null) {
          matchedExplanation = currentExplanation;
          break;
        }
      }
    }

    const request = buildResumeRewriteRequest({
      summary: options.summary,
      draft: options.draft,
      latestSnapshot: options.latestSnapshot,
      selectedSnapshot: options.selectedSnapshot,
      diagnosticsResponse: options.diagnosticsResponse,
      recommendation: recommendation,
      explanation: matchedExplanation,
    });
    if (request === null) {
      continue;
    }

    actions.push({
      request: request,
      recommendation: recommendation,
      explanation: matchedExplanation,
      targetLabel: buildRewriteTargetLabel(recommendation),
    });
  }

  return actions;
}

 function splitSkillsCandidateText(value: string): string[] {
   const normalized = value.replace(/\n/g, ',');
   const parts = normalized.split(',');
   const skills: string[] = [];
   for (let i = 0; i < parts.length; i++) {
     const trimmed = trimToNull(parts[i]);
     if (trimmed !== null) {
       skills.push(trimmed);
     }
   }
   return skills;
 }

 /**
  * Apply an explicitly approved candidate into the current draft.
  *
  * Why this stays explicit:
  * The store never chooses a candidate automatically. This helper only applies
  * the exact candidate text the user selected.
  */
export function applyResumeRewriteCandidateToDraft(
   draft: ResumeDraft,
   request: ResumeRewriteRequest,
   candidate: ResumeRewriteCandidate
 ): ApplyResumeRewriteResult {
   const nextDraft = cloneDraft(draft);
   const nextText = candidate.text.trim();

   if (nextText.length === 0) {
     return {
       nextDraft: null,
       appliedSectionId: null,
     };
   }

   if (request.target.section_id === 'summary') {
     nextDraft.summary = nextText;
     return {
       nextDraft: nextDraft,
       appliedSectionId: 'summary',
     };
   }

   if (request.target.section_id === 'skills') {
     if (request.target.bullet_id !== null) {
       for (let i = 0; i < nextDraft.skills.length; i++) {
         if (nextDraft.skills[i].id === request.target.bullet_id) {
           nextDraft.skills[i].name = nextText;
           return {
             nextDraft: nextDraft,
             appliedSectionId: 'skills',
           };
         }
       }
       return {
         nextDraft: null,
         appliedSectionId: null,
       };
     }

     const nextSkills = splitSkillsCandidateText(nextText);
     if (nextSkills.length === 0) {
       return {
         nextDraft: null,
         appliedSectionId: null,
       };
     }
     nextDraft.skills = [];
     for (let i = 0; i < nextSkills.length; i++) {
       nextDraft.skills.push({
         id: 'skill-' + i.toString(),
         name: nextSkills[i],
       });
     }
     return {
       nextDraft: nextDraft,
       appliedSectionId: 'skills',
     };
   }

   if (
     request.target.section_id === 'experience' &&
     request.target.bullet_id !== null
   ) {
     const parsedBullet = parseExperienceBulletId(request.target.bullet_id);
     if (parsedBullet === null) {
       return {
         nextDraft: null,
         appliedSectionId: null,
       };
     }
     for (let i = 0; i < nextDraft.experience.length; i++) {
       const entry = nextDraft.experience[i];
       if (entry.id !== parsedBullet.experienceId) {
         continue;
       }
       const lines = splitLines(entry.duties);
       if (parsedBullet.bulletIndex >= lines.length) {
         return {
           nextDraft: null,
           appliedSectionId: null,
         };
       }
       lines[parsedBullet.bulletIndex] = nextText;
       entry.duties = lines.join('\n');
       return {
         nextDraft: nextDraft,
         appliedSectionId: 'experience',
       };
     }
   }

   return {
     nextDraft: null,
     appliedSectionId: null,
   };
 }

export function createEmptyResumeRewriteState(): ResumeRewriteState {
   return {
     status: 'idle',
     request: null,
     candidates: [],
     errorMessage: null,
     appliedCandidateId: null,
   };
 }
