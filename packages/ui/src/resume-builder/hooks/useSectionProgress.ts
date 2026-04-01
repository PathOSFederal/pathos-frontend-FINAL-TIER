/**
 * ============================================================================
 * USE SECTION PROGRESS — Hook for computing section progress from resume data
 * ============================================================================
 *
 * PURPOSE: Computes the section progress model from the active resume draft
 * and annotation data. Returns a SectionProgressList that drives the left
 * rail's circular progress badges.
 *
 * CANONICAL ORDER RULE: This hook does NOT define its own section order.
 * It reads the canonical order from buildFederalSectionMeta / getCanonicalUIOrder
 * and builds the progress list in that order. This guarantees the left rail
 * matches the document, callout targeting, and overview prioritization.
 *
 * ARCHITECTURE:
 *   - Takes the resume draft and annotation list as inputs
 *   - Reads canonical section order from federal-section-meta
 *   - Computes completionPct for each section based on content presence
 *   - Counts active/resolved callouts per section from annotations
 *   - Uses deriveSectionHealth to classify each section's health
 *   - Returns a stable SectionProgressList in canonical display order
 *
 * The completion percentage calculation is deterministic and local — it
 * evaluates field presence and content density, not quality. Quality
 * assessment comes from the annotation layer.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

import { useMemo } from 'react';
import type { ResumeDraft } from '@pathos/core';
import type { SectionProgressList } from '../types/section-progress-types';
import { buildSectionProgress } from '../types/section-progress-types';
import type { TailoringAnnotation } from '../types/annotation-types';
import { buildFederalSectionMeta, getCanonicalUIOrder } from '../types/federal-section-meta';

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseSectionProgressReturn {
  /** Progress data for all sections in display order. */
  sectionProgressList: SectionProgressList;
}

// ---------------------------------------------------------------------------
// Section completion calculation helpers
// ---------------------------------------------------------------------------

/**
 * Calculate the completion percentage for the contact section.
 * Checks: fullName, email, phone, city/state, citizenship, veteranStatus.
 * Each populated field contributes equally.
 *
 * FIELD-LEVEL EVALUATION: Every subfield is checked independently so
 * the completion percentage accurately reflects which fields are present.
 * This prevents false-positive labels like "Citizenship missing" when
 * citizenship IS present but another field (e.g. veteranStatus) is not.
 */
function calculateContactCompletion(draft: ResumeDraft): number {
  const contact = draft.contact;
  let filledCount = 0;
  const totalFields = 6;

  if (contact.fullName && contact.fullName.trim().length > 0) filledCount = filledCount + 1;
  if (contact.email && contact.email.trim().length > 0) filledCount = filledCount + 1;
  if (contact.phone && contact.phone.trim().length > 0) filledCount = filledCount + 1;
  if ((contact.city && contact.city.trim().length > 0) || (contact.state && contact.state.trim().length > 0)) {
    filledCount = filledCount + 1;
  }
  if (contact.citizenship && contact.citizenship.trim().length > 0) filledCount = filledCount + 1;
  if (contact.veteranStatus && contact.veteranStatus.trim().length > 0 && contact.veteranStatus.trim() !== 'N/A') {
    filledCount = filledCount + 1;
  }

  return Math.round((filledCount / totalFields) * 100);
}

/**
 * Identify which specific contact/eligibility subfields are missing.
 * Returns a list of human-readable labels for missing fields. This is
 * the field-level evaluation that prevents false-positive guidance labels.
 *
 * CORE FIX: Instead of generating a generic "Incomplete contact" label
 * for the whole section, this function produces precise labels like:
 *   - "Veteran preference not specified"
 *   - "Employment eligibility not specified"
 * so the guidance engine never claims citizenship is missing when the
 * document visibly shows "U.S. Citizen".
 */
export function getMissingContactFields(draft: ResumeDraft): string[] {
  const contact = draft.contact;
  const missing: string[] = [];

  if (!contact.fullName || contact.fullName.trim().length === 0) {
    missing.push('Full name');
  }
  if (!contact.email || contact.email.trim().length === 0) {
    missing.push('Email');
  }
  if (!contact.phone || contact.phone.trim().length === 0) {
    missing.push('Phone');
  }
  if ((!contact.city || contact.city.trim().length === 0) && (!contact.state || contact.state.trim().length === 0)) {
    missing.push('Location');
  }
  if (!contact.citizenship || contact.citizenship.trim().length === 0) {
    missing.push('Citizenship');
  }
  if (!contact.veteranStatus || contact.veteranStatus.trim().length === 0 || contact.veteranStatus.trim() === 'N/A') {
    missing.push('Veteran preference');
  }

  return missing;
}

/**
 * Build a precise, human-readable guidance label from the list of
 * missing contact fields. Returns null when no fields are missing.
 *
 * EXAMPLES:
 *   ["Veteran preference"] → "Veteran preference not specified"
 *   ["Veteran preference", "Phone"] → "2 contact/eligibility fields missing"
 *   [] → null (no label needed)
 */
export function buildContactGuidanceLabel(missingFields: string[]): string | null {
  if (missingFields.length === 0) return null;
  if (missingFields.length === 1) {
    return missingFields[0] + ' not specified';
  }
  if (missingFields.length === 2) {
    return missingFields[0] + ' and ' + missingFields[1] + ' not specified';
  }
  return missingFields.length + ' contact/eligibility fields missing';
}

/**
 * Calculate the completion percentage for the professional summary.
 * Binary: 0% if empty, 100% if present (with minimum length check).
 */
function calculateSummaryCompletion(draft: ResumeDraft): number {
  if (!draft.summary || draft.summary.trim().length < 10) return 0;
  return 100;
}

/**
 * Calculate the completion percentage for work experience.
 * Based on: having entries, each entry having title + duties.
 */
function calculateExperienceCompletion(draft: ResumeDraft): number {
  if (draft.experience.length === 0) return 0;

  let totalScore = 0;
  for (let i = 0; i < draft.experience.length; i++) {
    const exp = draft.experience[i];
    let entryScore = 0;
    const entryTotal = 4;

    if (exp.jobTitle && exp.jobTitle.trim().length > 0) entryScore = entryScore + 1;
    if (exp.employer && exp.employer.trim().length > 0) entryScore = entryScore + 1;
    if (exp.duties && exp.duties.trim().length > 0) entryScore = entryScore + 1;
    if (exp.startDate && exp.startDate.trim().length > 0) entryScore = entryScore + 1;

    totalScore = totalScore + Math.round((entryScore / entryTotal) * 100);
  }

  return Math.round(totalScore / draft.experience.length);
}

/**
 * Calculate the completion percentage for education.
 * Based on: having entries, each entry having institution + degree.
 */
function calculateEducationCompletion(draft: ResumeDraft): number {
  if (draft.education.length === 0) return 0;

  let totalScore = 0;
  for (let i = 0; i < draft.education.length; i++) {
    const edu = draft.education[i];
    let entryScore = 0;
    const entryTotal = 3;

    if (edu.institution && edu.institution.trim().length > 0) entryScore = entryScore + 1;
    if (edu.degree && edu.degree.trim().length > 0) entryScore = entryScore + 1;
    if (edu.field && edu.field.trim().length > 0) entryScore = entryScore + 1;

    totalScore = totalScore + Math.round((entryScore / entryTotal) * 100);
  }

  return Math.round(totalScore / draft.education.length);
}

/**
 * Calculate the completion percentage for skills.
 * Based on: having at least 3 skills = 100%, fewer = proportional.
 */
function calculateSkillsCompletion(draft: ResumeDraft): number {
  if (draft.skills.length === 0) return 0;
  const minSkills = 3;
  if (draft.skills.length >= minSkills) return 100;
  return Math.round((draft.skills.length / minSkills) * 100);
}

// ---------------------------------------------------------------------------
// Annotation counting helper
// ---------------------------------------------------------------------------

/**
 * Section prefix matching logic. Extracted to a helper so both
 * countAnnotationsForSection and countHighSeverityForSection
 * share the exact same matching behavior for compound section IDs
 * like "federal-details" and "supporting-evidence".
 */
function anchorMatchesSection(anchorId: string, sectionId: string): boolean {
  if (sectionId === 'federal-details') {
    return anchorId.startsWith('federal-details-') || anchorId.startsWith('federal-');
  }
  if (sectionId === 'supporting-evidence') {
    return anchorId.startsWith('supporting-evidence-');
  }
  return anchorId.startsWith(sectionId);
}

/**
 * Count active (unresolved) and resolved annotations for a given section.
 * Uses section-aware prefix matching that handles compound section IDs
 * like "federal-details" and "supporting-evidence" correctly.
 */
function countAnnotationsForSection(
  annotations: TailoringAnnotation[],
  sectionId: string
): { active: number; resolved: number } {
  let active = 0;
  let resolved = 0;
  for (let i = 0; i < annotations.length; i++) {
    if (anchorMatchesSection(annotations[i].anchorId, sectionId)) {
      if (annotations[i].resolved) {
        resolved = resolved + 1;
      } else {
        active = active + 1;
      }
    }
  }
  return { active: active, resolved: resolved };
}

/**
 * Count unresolved HIGH-SEVERITY annotations for a given section.
 *
 * PURPOSE: This feeds into deriveSectionHealth so section health
 * correctly downgrades when critical issues exist. Without this,
 * a section with 100% field fill but a blocking alignment issue
 * would display green (complete) — misleading the user.
 *
 * Only counts annotations where:
 *   - resolved === false (still an active issue)
 *   - severity === 'high' (blocking/critical level)
 *   - anchorId matches the section via the shared prefix logic
 */
function countHighSeverityForSection(
  annotations: TailoringAnnotation[],
  sectionId: string
): number {
  let count = 0;
  for (let i = 0; i < annotations.length; i++) {
    const ann = annotations[i];
    if (ann.resolved) continue;
    if (ann.severity !== 'high') continue;
    if (anchorMatchesSection(ann.anchorId, sectionId)) {
      count = count + 1;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

/**
 * Completion calculator lookup — maps section IDs to their completion
 * calculation functions. Sections not in this lookup default to 0%.
 * This keeps the completion logic in one place while allowing the
 * canonical order to drive iteration.
 */
const COMPLETION_CALCULATORS: Record<string, (draft: ResumeDraft) => number> = {
  'contact': calculateContactCompletion,
  'summary': calculateSummaryCompletion,
  'experience': calculateExperienceCompletion,
  'education': calculateEducationCompletion,
  'skills': calculateSkillsCompletion,
};

/**
 * useSectionProgress computes the section progress model from the resume
 * draft and annotation data. Returns a memoized SectionProgressList.
 *
 * CANONICAL ORDER: The list is built by iterating getCanonicalUIOrder(),
 * which reads from buildFederalSectionMeta(). This guarantees the same
 * order is used in the left rail, the document canvas, callout targeting,
 * and overview prioritization. No local section-order knowledge exists
 * in this hook.
 */
export function useSectionProgress(
  draft: ResumeDraft | null,
  annotations: TailoringAnnotation[]
): UseSectionProgressReturn {
  const sectionProgressList = useMemo(function (): SectionProgressList {
    if (!draft) return [];

    /* Read canonical section order from the single source of truth */
    const registry = buildFederalSectionMeta();
    const canonicalOrder = getCanonicalUIOrder(registry);

    /* Build progress entries in canonical order */
    const result: SectionProgressList = [];

    for (let i = 0; i < canonicalOrder.length; i++) {
      const sectionMeta = canonicalOrder[i];
      const sectionId = sectionMeta.sectionId;

      /* Calculate field completion — use calculator if available, else 0 */
      const calculator = COMPLETION_CALCULATORS[sectionId];
      const completionPct = calculator ? calculator(draft) : 0;

      /* Count active/resolved annotations for this section */
      const counts = countAnnotationsForSection(annotations, sectionId);

      /* Count high-severity unresolved issues for health derivation.
       * This feeds into deriveSectionHealth so rail colors correctly
       * downgrade when critical issues exist even at high field fill. */
      const highCount = countHighSeverityForSection(annotations, sectionId);

      result.push(
        buildSectionProgress(
          sectionId,
          sectionMeta.label,
          completionPct,
          counts.active,
          counts.resolved,
          highCount
        )
      );
    }

    return result;
  }, [draft, annotations]);

  return { sectionProgressList: sectionProgressList };
}
