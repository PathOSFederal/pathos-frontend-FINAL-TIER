/**
 * ============================================================================
 * CANONICAL CALLOUT DEFINITIONS — Section-aware callout target registry
 * ============================================================================
 *
 * PURPOSE: Defines the canonical set of callout targets for every major
 * resume section. Instead of ad-hoc "should this section have a callout?"
 * logic, this module answers "which callout(s) are active for this section
 * right now?" by providing a declarative, maintainable registry.
 *
 * DESIGN:
 *   - Each major section has one or more canonical callout targets.
 *   - Each target describes a specific guidance concern (missing data,
 *     weak content, alignment gaps, etc.).
 *   - Targets include the data-callout-anchor ID that maps to a DOM
 *     element inside the resume document.
 *   - Targets are ordered by priority (lower number = higher priority).
 *   - The system filters active targets based on resume content state.
 *
 * SECTIONS COVERED:
 *   1. contact / identity (eligibility)
 *   2. summary / professional summary
 *   3. experience / work experience (USAJOBS field-level awareness)
 *   4. education (expanded for federal education requirements)
 *   5. skills
 *   6. certifications / licenses
 *   7. training (future-ready placeholder)
 *   8. language-skills (future-ready placeholder)
 *   9. publications (future-ready placeholder)
 *  10. federal-details
 *  11. supporting-evidence
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

import type { AnchorSectionId } from './anchor-types';
import type { ResumeDraft } from '@pathos/core';
import type { SectionEvidenceScore } from '../utils/evidence-scoring';
import { buildFederalSectionMeta, getCanonicalUIOrder } from './federal-section-meta';

// ---------------------------------------------------------------------------
// Canonical callout target — one potential callout for a resume region
// ---------------------------------------------------------------------------

/**
 * A single canonical callout target. Represents a specific guidance concern
 * that can produce a callout line when active.
 *
 * The target is "canonical" because it is predefined in the registry —
 * it is not dynamically computed from arbitrary annotation logic. The set
 * of possible targets per section is fixed and known. Whether a given
 * target is ACTIVE depends on the resume content state.
 */
export interface CanonicalCalloutTarget {
  /** Unique ID for this target. Format: "cct-{sectionId}-{concern}". */
  id: string;

  /** Which resume section owns this target. */
  sectionId: AnchorSectionId;

  /** The data-callout-anchor value on the DOM element this target
   *  attaches to inside the resume document. */
  anchorId: string;

  /** Short guidance headline shown on hover/activation. */
  headline: string;

  /** Brief guidance description (1-2 sentences). */
  description: string;

  /** Annotation class driving the line color and card treatment. */
  annotationClass: 'evidence' | 'alignment' | 'compression';

  /** Severity for priority ordering. high = show first. */
  severity: 'high' | 'medium' | 'low';

  /** Priority for display ordering within the section.
   *  Lower number = shown first when max-lines cap applies. */
  priority: number;

  /** Human-readable label for the anchor region (used in aria-label). */
  anchorLabel: string;
}

// ---------------------------------------------------------------------------
// Section callout config — all canonical targets for one section
// ---------------------------------------------------------------------------

/**
 * All canonical callout targets for a single resume section.
 * The callout system reads this to determine which lines to render
 * when the section is selected.
 */
export interface SectionCalloutConfig {
  sectionId: AnchorSectionId;
  targets: CanonicalCalloutTarget[];
}

// ---------------------------------------------------------------------------
// Full canonical registry — all sections
// ---------------------------------------------------------------------------

/**
 * The complete canonical callout registry. Keyed by section ID for
 * O(1) lookup. Each section has an ordered list of callout targets.
 */
export type CanonicalCalloutRegistry = Record<string, SectionCalloutConfig>;

// ---------------------------------------------------------------------------
// Builder: builds the full canonical registry
// ---------------------------------------------------------------------------

/**
 * Build the canonical callout registry with all section targets.
 * This is the single source of truth for "what callouts can appear
 * for each section." Adding a new section or callout target means
 * adding it here.
 */
export function buildCanonicalCalloutRegistry(): CanonicalCalloutRegistry {
  const registry: CanonicalCalloutRegistry = {};

  /* ---- CONTACT / IDENTITY ---- */
  registry['contact'] = {
    sectionId: 'contact',
    targets: [
      {
        id: 'cct-contact-missing-info',
        sectionId: 'contact',
        anchorId: 'contact-header',
        headline: 'Incomplete contact information',
        description: 'Federal applications require full name, location, citizenship status, and employment eligibility. Missing details can cause screening rejection.',
        annotationClass: 'alignment',
        severity: 'high',
        priority: 0,
        anchorLabel: 'Contact header',
      },
      {
        id: 'cct-contact-weak-identity',
        sectionId: 'contact',
        anchorId: 'contact-citizenship',
        headline: 'Citizenship/eligibility not specified',
        description: 'U.S. citizenship and veteran preference are required fields on most federal resumes. Omitting them can delay processing.',
        annotationClass: 'alignment',
        severity: 'medium',
        priority: 1,
        anchorLabel: 'Citizenship and eligibility',
      },
    ],
  };

  /* ---- PROFESSIONAL SUMMARY ----
   * Summary is one of the most important sections for federal resume
   * screening. HR reads it first. The canonical targets cover:
   *   1. Missing summary entirely (blocking)
   *   2. Weak opening fit statement (high impact)
   *   3. Missing target keywords in summary text
   *   4. Weak federal framing (relevant when targeting federal roles) */
  registry['summary'] = {
    sectionId: 'summary',
    targets: [
      {
        id: 'cct-summary-missing',
        sectionId: 'summary',
        anchorId: 'summary-text',
        headline: 'Summary missing or weak',
        description: 'The professional summary is the first thing HR reads. A targeted opening fit statement significantly improves screening outcomes.',
        annotationClass: 'alignment',
        severity: 'high',
        priority: 0,
        anchorLabel: 'Professional Summary',
      },
      {
        id: 'cct-summary-fit-statement',
        sectionId: 'summary',
        anchorId: 'summary-text',
        headline: 'Weak opening fit statement',
        description: 'The summary should explicitly connect your qualifications to the target position requirements within the first two sentences.',
        annotationClass: 'alignment',
        severity: 'medium',
        priority: 1,
        anchorLabel: 'Professional Summary',
      },
      {
        id: 'cct-summary-missing-keywords',
        sectionId: 'summary',
        anchorId: 'summary-text',
        headline: 'Missing target keywords in summary',
        description: 'The summary should include key terms from the target announcement — specialized experience phrases, required technologies, and core competencies that automated screening tools look for.',
        annotationClass: 'alignment',
        severity: 'medium',
        priority: 2,
        anchorLabel: 'Professional Summary',
      },
      {
        id: 'cct-summary-federal-framing',
        sectionId: 'summary',
        anchorId: 'summary-text',
        headline: 'Weak federal framing',
        description: 'For federal roles, the summary should reference your GS-equivalent experience level, clearance status, and specialized experience that directly matches the announcement language.',
        annotationClass: 'alignment',
        severity: 'low',
        priority: 3,
        anchorLabel: 'Professional Summary',
      },
    ],
  };

  /* ---- WORK EXPERIENCE ----
   * Experience is the most complex resume section and needs field-level
   * callout coverage. Targets attach to both section-level and
   * field-level anchors so guidance can point at specific sub-elements:
   *   - Section-level: overall experience section
   *   - Field-level: job titles, date ranges, employer, hours/week,
   *     individual bullets (quantified outcomes, leadership, federal lang)
   *
   * Field-level anchor IDs follow the pattern:
   *   experience-title-{expId}     — job title for one entry
   *   experience-dates-{expId}     — date range for one entry
   *   experience-employer-{expId}  — employer/agency for one entry
   *   experience-hours-{expId}     — hours per week for one entry
   *   bullet-{expId}-{bulletIdx}   — individual bullet item
   *
   * Section-level targets use 'experience-section-anchor' as their
   * anchor ID. These serve as fallback when no field-specific target
   * is more appropriate. */
  registry['experience'] = {
    sectionId: 'experience',
    targets: [
      /* ---- Section-level targets ---- */
      {
        id: 'cct-experience-weak-bullet',
        sectionId: 'experience',
        anchorId: 'experience-section-anchor',
        headline: 'Weak or vague bullet',
        description: 'One or more experience bullets lack specific outcomes, quantified results, or federal-grade scope language.',
        annotationClass: 'evidence',
        severity: 'high',
        priority: 0,
        anchorLabel: 'Work Experience',
      },
      {
        id: 'cct-experience-missing-metrics',
        sectionId: 'experience',
        anchorId: 'experience-section-anchor',
        headline: 'Missing quantified outcome',
        description: 'Federal resumes benefit from specific numbers: staff managed, budgets controlled, percent improvements, incident volumes handled.',
        annotationClass: 'evidence',
        severity: 'high',
        priority: 1,
        anchorLabel: 'Work Experience',
      },
      {
        id: 'cct-experience-leadership-gap',
        sectionId: 'experience',
        anchorId: 'experience-section-anchor',
        headline: 'Missing leadership/scope language',
        description: 'GS-13+ positions require demonstrated supervisory scope. Add team sizes, program scope, and organizational impact.',
        annotationClass: 'alignment',
        severity: 'medium',
        priority: 2,
        anchorLabel: 'Work Experience',
      },
      {
        id: 'cct-experience-specialized-gap',
        sectionId: 'experience',
        anchorId: 'experience-section-anchor',
        headline: 'Specialized experience gap',
        description: 'The target announcement requires specific specialized experience. Ensure at least one entry explicitly addresses each requirement.',
        annotationClass: 'alignment',
        severity: 'medium',
        priority: 3,
        anchorLabel: 'Work Experience',
      },
      /* ---- Field-level targets: job title ---- */
      {
        id: 'cct-experience-title-generic',
        sectionId: 'experience',
        anchorId: 'experience-title-exp-1',
        headline: 'Job title too generic',
        description: 'Federal HR matches job titles against the announcement. Use the exact title from your SF-50 or a title that clearly maps to the target series and grade.',
        annotationClass: 'alignment',
        severity: 'medium',
        priority: 4,
        anchorLabel: 'Job Title',
      },
      /* ---- Field-level targets: date range ---- */
      {
        id: 'cct-experience-dates-formatting',
        sectionId: 'experience',
        anchorId: 'experience-dates-exp-1',
        headline: 'Date range formatting',
        description: 'Federal resumes require month/year format for start and end dates. Ensure each entry clearly shows the duration of employment.',
        annotationClass: 'alignment',
        severity: 'low',
        priority: 5,
        anchorLabel: 'Date Range',
      },
      /* ---- Field-level targets: employer ---- */
      {
        id: 'cct-experience-employer-detail',
        sectionId: 'experience',
        anchorId: 'experience-employer-exp-1',
        headline: 'Employer detail incomplete',
        description: 'Include the full agency or organization name, city, and state. For federal positions, include the agency and sub-component.',
        annotationClass: 'alignment',
        severity: 'low',
        priority: 6,
        anchorLabel: 'Employer / Agency',
      },
      /* ---- Field-level targets: hours per week ---- */
      {
        id: 'cct-experience-hours-missing',
        sectionId: 'experience',
        anchorId: 'experience-hours-exp-1',
        headline: 'Hours per week missing',
        description: 'Federal resumes require hours per week for each position. Missing this field can result in experience not being credited at the correct level.',
        annotationClass: 'alignment',
        severity: 'medium',
        priority: 7,
        anchorLabel: 'Hours per Week',
      },
      /* ---- Field-level targets: bullet quality ---- */
      {
        id: 'cct-experience-bullet-no-federal-lang',
        sectionId: 'experience',
        anchorId: 'experience-section-anchor',
        headline: 'Bullet lacks federal language',
        description: 'One or more bullets use private-sector phrasing. Federal HR expects scope, complexity, and impact language that maps to GS requirements.',
        annotationClass: 'alignment',
        severity: 'medium',
        priority: 8,
        anchorLabel: 'Work Experience',
      },
      /* ---- Compression ---- */
      {
        id: 'cct-experience-compression',
        sectionId: 'experience',
        anchorId: 'experience-section-anchor',
        headline: 'Consider compressing',
        description: 'One or more bullets are lengthy. Tightening could help fit the federal resume page budget without losing impact.',
        annotationClass: 'compression',
        severity: 'low',
        priority: 9,
        anchorLabel: 'Work Experience',
      },
    ],
  };

  /* ---- EDUCATION ----
   * Education is critical for many federal positions. When the announcement
   * specifies education requirements, incomplete education records can
   * cause disqualification. The first target is HIGH severity so that
   * education issues are eligible for Resume Overview prioritization. */
  registry['education'] = {
    sectionId: 'education',
    targets: [
      {
        id: 'cct-education-missing-detail',
        sectionId: 'education',
        anchorId: 'education-section-anchor',
        headline: 'Incomplete education record',
        description: 'Federal HR requires complete education records: degree type, field of study, institution name, and graduation date. Missing any field may cause disqualification when the announcement specifies education requirements.',
        annotationClass: 'alignment',
        severity: 'high',
        priority: 0,
        anchorLabel: 'Education',
      },
      {
        id: 'cct-education-relevance',
        sectionId: 'education',
        anchorId: 'education-section-anchor',
        headline: 'Education relevance to target',
        description: 'If the announcement lists a preferred degree or field, ensure your education section highlights the match explicitly.',
        annotationClass: 'alignment',
        severity: 'medium',
        priority: 1,
        anchorLabel: 'Education',
      },
      {
        id: 'cct-education-accreditation',
        sectionId: 'education',
        anchorId: 'education-section-anchor',
        headline: 'Accreditation status unclear',
        description: 'Federal positions require degrees from accredited institutions. Ensure your institution is recognized by a Department of Education-approved accrediting body.',
        annotationClass: 'alignment',
        severity: 'low',
        priority: 2,
        anchorLabel: 'Education',
      },
    ],
  };

  /* ---- SKILLS ---- */
  registry['skills'] = {
    sectionId: 'skills',
    targets: [
      {
        id: 'cct-skills-keyword-coverage',
        sectionId: 'skills',
        anchorId: 'skills-block',
        headline: 'Target keyword coverage gap',
        description: 'Key skills from the job announcement are missing from your skills section. Automated screening may filter resumes without these terms.',
        annotationClass: 'alignment',
        severity: 'high',
        priority: 0,
        anchorLabel: 'Technical Skills',
      },
      {
        id: 'cct-skills-weak-mapping',
        sectionId: 'skills',
        anchorId: 'skills-block',
        headline: 'Weak skills mapping',
        description: 'Skills are listed but lack specificity. Use exact technology names, frameworks, and proficiency levels where relevant.',
        annotationClass: 'evidence',
        severity: 'medium',
        priority: 1,
        anchorLabel: 'Technical Skills',
      },
    ],
  };

  /* ---- CERTIFICATIONS / LICENSES ----
   * Many federal positions (IT, healthcare, engineering) explicitly require
   * specific certifications. The first target is HIGH severity so certs
   * are eligible for Resume Overview prioritization when a target-relevant
   * certification is missing. */
  registry['certifications'] = {
    sectionId: 'certifications',
    targets: [
      {
        id: 'cct-certifications-missing-relevant',
        sectionId: 'certifications',
        anchorId: 'certifications-section-anchor',
        headline: 'Target-relevant certification missing',
        description: 'The job announcement references certifications you have not listed. Missing required certifications can cause disqualification for credentialed positions.',
        annotationClass: 'alignment',
        severity: 'high',
        priority: 0,
        anchorLabel: 'Certifications / Licenses',
      },
      {
        id: 'cct-certifications-underspecified',
        sectionId: 'certifications',
        anchorId: 'certifications-section-anchor',
        headline: 'Certification details under-specified',
        description: 'Include certification issuing body, date earned, and expiration if applicable. Incomplete entries may not be credited by federal HR.',
        annotationClass: 'evidence',
        severity: 'medium',
        priority: 1,
        anchorLabel: 'Certifications / Licenses',
      },
      {
        id: 'cct-certifications-expired',
        sectionId: 'certifications',
        anchorId: 'certifications-section-anchor',
        headline: 'Check certification expiration dates',
        description: 'Expired certifications may not satisfy announcement requirements. Verify all listed certifications are current or note renewal status.',
        annotationClass: 'alignment',
        severity: 'low',
        priority: 2,
        anchorLabel: 'Certifications / Licenses',
      },
    ],
  };

  /* ---- TRAINING ----
   * Future-ready section. Training is valued in federal context,
   * especially recent professional development and agency-mandated
   * training. Placeholder targets for when UI support is added. */
  registry['training'] = {
    sectionId: 'training',
    targets: [
      {
        id: 'cct-training-relevant-missing',
        sectionId: 'training',
        anchorId: 'training-section-anchor',
        headline: 'Relevant training not listed',
        description: 'Recent professional training or certifiable courses that match the announcement requirements should be included. Federal agencies value continuous learning.',
        annotationClass: 'alignment',
        severity: 'low',
        priority: 0,
        anchorLabel: 'Training',
      },
    ],
  };

  /* ---- LANGUAGE SKILLS ----
   * Future-ready section. Required for certain positions (State Dept,
   * intelligence community, international organizations). */
  registry['language-skills'] = {
    sectionId: 'language-skills',
    targets: [
      {
        id: 'cct-language-proficiency-missing',
        sectionId: 'language-skills',
        anchorId: 'language-skills-section-anchor',
        headline: 'Language proficiency not specified',
        description: 'If the announcement requires language skills, include proficiency levels (ILR scale or DLPT scores when available).',
        annotationClass: 'alignment',
        severity: 'low',
        priority: 0,
        anchorLabel: 'Language Skills',
      },
    ],
  };

  /* ---- PUBLICATIONS ----
   * Future-ready section. Relevant for research, policy, and senior
   * technical positions. */
  registry['publications'] = {
    sectionId: 'publications',
    targets: [
      {
        id: 'cct-publications-relevant-missing',
        sectionId: 'publications',
        anchorId: 'publications-section-anchor',
        headline: 'Relevant publications not listed',
        description: 'If you have published works relevant to the target position, listing them strengthens your qualification evidence for research and policy roles.',
        annotationClass: 'evidence',
        severity: 'low',
        priority: 0,
        anchorLabel: 'Publications',
      },
    ],
  };

  /* ---- FEDERAL DETAILS ---- */
  registry['federal-details'] = {
    sectionId: 'federal-details',
    targets: [
      {
        id: 'cct-federal-missing-required',
        sectionId: 'federal-details',
        anchorId: 'federal-details-section-anchor',
        headline: 'Missing required federal fields',
        description: 'Federal resumes require security clearance level, veteran preference, federal employee status, and highest grade held. Missing any may cause rejection.',
        annotationClass: 'alignment',
        severity: 'high',
        priority: 0,
        anchorLabel: 'Federal Details',
      },
      {
        id: 'cct-federal-clearance-gap',
        sectionId: 'federal-details',
        anchorId: 'federal-details-section-anchor',
        headline: 'Clearance level not specified',
        description: 'Many federal IT positions require an active security clearance. Specify your clearance level and status.',
        annotationClass: 'alignment',
        severity: 'medium',
        priority: 1,
        anchorLabel: 'Federal Details',
      },
    ],
  };

  /* ---- SUPPORTING EVIDENCE ---- */
  registry['supporting-evidence'] = {
    sectionId: 'supporting-evidence',
    targets: [
      {
        id: 'cct-evidence-missing-quantified',
        sectionId: 'supporting-evidence',
        anchorId: 'supporting-evidence-section-anchor',
        headline: 'Missing quantified support',
        description: 'Claims in your resume lack supporting evidence. Add specific metrics, awards, publications, or project outcomes.',
        annotationClass: 'evidence',
        severity: 'high',
        priority: 0,
        anchorLabel: 'Supporting Evidence',
      },
      {
        id: 'cct-evidence-gap',
        sectionId: 'supporting-evidence',
        anchorId: 'supporting-evidence-section-anchor',
        headline: 'Evidence gap for key claims',
        description: 'Your strongest experience claims would benefit from a dedicated supporting evidence section with named projects, outcomes, or recognitions.',
        annotationClass: 'evidence',
        severity: 'medium',
        priority: 1,
        anchorLabel: 'Supporting Evidence',
      },
    ],
  };

  return registry;
}

// ---------------------------------------------------------------------------
// Helper: get active callout targets for a section
// ---------------------------------------------------------------------------

/**
 * Get the canonical callout targets for a specific section from the registry.
 * Returns an empty array if the section is not found.
 */
export function getCanonicalTargetsForSection(
  registry: CanonicalCalloutRegistry,
  sectionId: string
): CanonicalCalloutTarget[] {
  const config = registry[sectionId];
  if (!config) return [];
  return config.targets;
}

/**
 * Get all section IDs that have canonical callout targets defined.
 * Useful for validation and testing.
 */
export function getCanonicalCoverageSections(
  registry: CanonicalCalloutRegistry
): string[] {
  return Object.keys(registry);
}

// ---------------------------------------------------------------------------
// Content-aware target filtering — prevents false-positive guidance
// ---------------------------------------------------------------------------

/**
 * Filter canonical callout targets for a section based on actual resume
 * content. Removes targets whose conditions are already met in the draft.
 *
 * CORE FIX FOR FALSE-POSITIVE GUIDANCE: The raw canonical registry
 * declares all POSSIBLE callout targets. Without filtering, targets like
 * "Citizenship/eligibility not specified" appear even when the document
 * visibly shows "U.S. Citizen". This function inspects the draft and
 * removes targets that no longer apply.
 *
 * CONTACT SECTION RULES:
 *   - cct-contact-missing-info: Remove when all core contact fields
 *     (name, email, phone, location) are present.
 *   - cct-contact-weak-identity: Remove when citizenship is present.
 *     If only veteranStatus is missing, replace the target headline
 *     with a precise label ("Veteran preference not specified").
 *
 * OTHER SECTIONS: Currently pass through unfiltered. Future passes can
 * add section-specific content rules here.
 */
export function filterCanonicalTargetsForContent(
  targets: CanonicalCalloutTarget[],
  sectionId: string,
  draft: ResumeDraft | null
): CanonicalCalloutTarget[] {
  if (!draft) return targets;

  if (sectionId === 'contact') {
    return filterContactTargets(targets, draft);
  }

  /* Other sections: pass through unfiltered for now */
  return targets;
}

/**
 * Content-aware filtering for the contact section. Evaluates each
 * canonical target against the actual draft state and removes or
 * adjusts targets that are no longer relevant.
 *
 * FIELD-LEVEL EVALUATION:
 *   - fullName, email, phone, location → core contact fields
 *   - citizenship → identity/eligibility field
 *   - veteranStatus → eligibility detail
 *
 * When all core contact fields are filled, cct-contact-missing-info
 * is removed. When citizenship is present, cct-contact-weak-identity
 * is either removed (if veteran pref is also present) or its headline
 * is updated to reflect the actual missing field.
 */
function filterContactTargets(
  targets: CanonicalCalloutTarget[],
  draft: ResumeDraft
): CanonicalCalloutTarget[] {
  const contact = draft.contact;

  /* Evaluate each subfield independently */
  const hasName = contact.fullName !== undefined && contact.fullName !== null && contact.fullName.trim().length > 0;
  const hasEmail = contact.email !== undefined && contact.email !== null && contact.email.trim().length > 0;
  const hasPhone = contact.phone !== undefined && contact.phone !== null && contact.phone.trim().length > 0;
  const hasLocation = (contact.city !== undefined && contact.city !== null && contact.city.trim().length > 0) ||
    (contact.state !== undefined && contact.state !== null && contact.state.trim().length > 0);
  const hasCitizenship = contact.citizenship !== undefined && contact.citizenship !== null && contact.citizenship.trim().length > 0;
  const hasVeteranPref = contact.veteranStatus !== undefined && contact.veteranStatus !== null &&
    contact.veteranStatus.trim().length > 0 && contact.veteranStatus.trim() !== 'N/A';

  const coreContactComplete = hasName && hasEmail && hasPhone && hasLocation;
  const allIdentityComplete = hasCitizenship && hasVeteranPref;

  const filtered: CanonicalCalloutTarget[] = [];

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];

    if (target.id === 'cct-contact-missing-info') {
      /* Remove when all core contact fields are present */
      if (coreContactComplete) continue;

      /* Otherwise keep, but sharpen the headline to name the missing field(s) */
      const missingCore: string[] = [];
      if (!hasName) missingCore.push('name');
      if (!hasEmail) missingCore.push('email');
      if (!hasPhone) missingCore.push('phone');
      if (!hasLocation) missingCore.push('location');

      if (missingCore.length > 0) {
        const sharpTarget = Object.assign({}, target, {
          headline: missingCore.length === 1
            ? (missingCore[0].charAt(0).toUpperCase() + missingCore[0].slice(1)) + ' missing'
            : missingCore.length + ' contact fields missing',
          description: 'Missing: ' + missingCore.join(', ') + '. Federal applications require full contact details.',
        });
        filtered.push(sharpTarget);
      }
      continue;
    }

    if (target.id === 'cct-contact-weak-identity') {
      /* If citizenship AND veteran pref are present, remove entirely */
      if (allIdentityComplete) continue;

      /* If citizenship is present but veteran pref is not, sharpen label */
      if (hasCitizenship && !hasVeteranPref) {
        const sharpTarget = Object.assign({}, target, {
          headline: 'Veteran preference not specified',
          description: 'Veteran preference is a required field on most federal resumes. Specifying your status helps HR route your application correctly.',
          severity: 'low' as const,
        });
        filtered.push(sharpTarget);
        continue;
      }

      /* If citizenship is NOT present, keep as-is */
      if (!hasCitizenship) {
        filtered.push(target);
        continue;
      }

      continue;
    }

    /* Non-contact targets: keep as-is */
    filtered.push(target);
  }

  return filtered;
}

// ---------------------------------------------------------------------------
// Overview mode: cross-section prioritized callout selection
// ---------------------------------------------------------------------------

/**
 * Maximum number of callout targets to show in Resume Overview mode.
 * Raised from 6 to 8 to accommodate the expanded federal section
 * taxonomy. With 11 total sections (8 UI-supported + 3 future-ready),
 * a cap of 8 ensures important sections like Education and Certifications
 * are not excluded from overview when they have meaningful issues.
 */
const OVERVIEW_MAX_CALLOUTS = 8;

/**
 * Sections that must always be eligible for overview consideration
 * when they have high or medium severity issues. Education and
 * Certifications were previously at risk of exclusion because their
 * targets were all medium/low severity. Now that they have high-severity
 * first targets, this list serves as a safety net to prevent future
 * regressions where important sections are accidentally filtered out.
 */
const OVERVIEW_PRIORITY_SECTIONS: string[] = [
  'contact',
  'summary',
  'experience',
  'education',
  'certifications',
  'federal-details',
];

/**
 * Build a prioritized set of callout targets for Resume Overview mode.
 *
 * Resume Overview shows the most important issues across the entire
 * resume, not every possible annotation. The selection strategy:
 *   1. From each section, pick the single highest-priority target
 *      with severity 'high'. If none exists, pick the first target.
 *   2. Sort all selected targets by severity (high > medium > low).
 *      Within the same severity, priority sections appear first to
 *      ensure education and certifications are not crowded out.
 *   3. Cap the result at OVERVIEW_MAX_CALLOUTS.
 *
 * This produces a readable set of cross-section callouts that tells
 * the user "here are the most important things to fix." Education
 * and Certifications are now explicitly eligible for overview
 * prioritization when they have meaningful issues.
 *
 * @param registry - The full canonical callout registry
 * @returns An array of CanonicalCalloutTarget for overview rendering
 */
export function getOverviewCalloutTargets(
  registry: CanonicalCalloutRegistry
): CanonicalCalloutTarget[] {
  const sectionIds = Object.keys(registry);
  const candidates: CanonicalCalloutTarget[] = [];

  /* For each section, pick the single most important target.
   * Prefer high-severity targets; fall back to the first target. */
  for (let i = 0; i < sectionIds.length; i++) {
    const config = registry[sectionIds[i]];
    if (!config || config.targets.length === 0) continue;

    let bestTarget: CanonicalCalloutTarget | null = null;

    for (let j = 0; j < config.targets.length; j++) {
      const target = config.targets[j];
      if (target.severity === 'high') {
        bestTarget = target;
        break;
      }
    }

    /* If no high-severity target, prefer medium over low */
    if (!bestTarget) {
      for (let j = 0; j < config.targets.length; j++) {
        const target = config.targets[j];
        if (target.severity === 'medium') {
          bestTarget = target;
          break;
        }
      }
    }

    /* Final fallback: use the first (highest-priority) target */
    if (!bestTarget) {
      bestTarget = config.targets[0];
    }

    candidates.push(bestTarget);
  }

  /* Build a lookup for priority sections for tie-breaking */
  const prioritySectionLookup: Record<string, boolean> = {};
  for (let i = 0; i < OVERVIEW_PRIORITY_SECTIONS.length; i++) {
    prioritySectionLookup[OVERVIEW_PRIORITY_SECTIONS[i]] = true;
  }

  /* Sort candidates: high severity first, then medium, then low.
   * Within the same severity, priority sections appear first so that
   * education and certifications are not crowded out by optional
   * sections. Within the same severity + priority tier, preserve
   * natural section order. */
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  candidates.sort(function (a, b) {
    const aVal = severityOrder[a.severity] !== undefined ? severityOrder[a.severity] : 2;
    const bVal = severityOrder[b.severity] !== undefined ? severityOrder[b.severity] : 2;
    if (aVal !== bVal) return aVal - bVal;

    /* Tie-break: priority sections first */
    const aIsPriority = prioritySectionLookup[a.sectionId] === true ? 0 : 1;
    const bIsPriority = prioritySectionLookup[b.sectionId] === true ? 0 : 1;
    return aIsPriority - bIsPriority;
  });

  /* Cap at max overview callouts */
  if (candidates.length > OVERVIEW_MAX_CALLOUTS) {
    return candidates.slice(0, OVERVIEW_MAX_CALLOUTS);
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Evidence-informed overview: prioritize using scored issue data
// ---------------------------------------------------------------------------

/**
 * Build overview callout targets using evidence-based scoring data to
 * inform prioritization. When evidence scores are available, sections
 * with lower composite scores (more issues) are prioritized higher.
 *
 * This function enhances getOverviewCalloutTargets by using the actual
 * scored section data to break ties and promote sections that the
 * evidence engine has flagged as needing the most attention.
 *
 * PRIORITIZATION RULES (strongest to weakest):
 *   1. Sections with unresolved federal_requirement issues
 *   2. Sections with lowest composite scores (most issues overall)
 *   3. Sections with unresolved missing_field issues
 *   4. Sections with unresolved weak_evidence or keyword_gap issues
 *   5. Sections with only optional_enhancement issues
 *
 * Falls back to getOverviewCalloutTargets when no evidence scores provided.
 */
export function getEvidenceInformedOverviewTargets(
  registry: CanonicalCalloutRegistry,
  evidenceScores: SectionEvidenceScore[]
): CanonicalCalloutTarget[] {
  /* Fallback to standard overview when no evidence data available */
  if (!evidenceScores || evidenceScores.length === 0) {
    return getOverviewCalloutTargets(registry);
  }

  /* Build a score lookup by section ID for O(1) access during sorting */
  const scoreLookup: Record<string, SectionEvidenceScore> = {};
  for (let i = 0; i < evidenceScores.length; i++) {
    scoreLookup[evidenceScores[i].sectionId] = evidenceScores[i];
  }

  /* Use canonical order for deterministic section iteration */
  const canonicalOrder = getCanonicalUIOrder(buildFederalSectionMeta());
  const candidates: CanonicalCalloutTarget[] = [];

  /* For each section in canonical order, pick the best target */
  for (let i = 0; i < canonicalOrder.length; i++) {
    const sectionId = canonicalOrder[i].sectionId;
    const config = registry[sectionId];
    if (!config || config.targets.length === 0) continue;

    /* Pick the highest-severity target as the section representative */
    let bestTarget: CanonicalCalloutTarget | null = null;
    for (let j = 0; j < config.targets.length; j++) {
      const target = config.targets[j];
      if (target.severity === 'high') {
        bestTarget = target;
        break;
      }
    }
    if (!bestTarget) {
      for (let j = 0; j < config.targets.length; j++) {
        if (config.targets[j].severity === 'medium') {
          bestTarget = config.targets[j];
          break;
        }
      }
    }
    if (!bestTarget) {
      bestTarget = config.targets[0];
    }
    candidates.push(bestTarget);
  }

  /* Sort using evidence-informed priority:
   * Lower composite score = more issues = higher priority in overview.
   * Federal requirement issues get extra priority boost. */
  candidates.sort(function (a, b) {
    const aScore = scoreLookup[a.sectionId];
    const bScore = scoreLookup[b.sectionId];

    /* Sections with federal requirement issues sort first */
    const aHasFederal = aScore && aScore.unresolvedCounts.federal_requirement > 0 ? 0 : 1;
    const bHasFederal = bScore && bScore.unresolvedCounts.federal_requirement > 0 ? 0 : 1;
    if (aHasFederal !== bHasFederal) return aHasFederal - bHasFederal;

    /* Lower composite score = more problems = higher overview priority */
    const aComposite = aScore ? aScore.compositeScore : 100;
    const bComposite = bScore ? bScore.compositeScore : 100;
    if (aComposite !== bComposite) return aComposite - bComposite;

    /* Tie-break: use target severity */
    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const aVal = severityOrder[a.severity] !== undefined ? severityOrder[a.severity] : 2;
    const bVal = severityOrder[b.severity] !== undefined ? severityOrder[b.severity] : 2;
    return aVal - bVal;
  });

  /* Cap at max overview callouts */
  if (candidates.length > OVERVIEW_MAX_CALLOUTS) {
    return candidates.slice(0, OVERVIEW_MAX_CALLOUTS);
  }

  return candidates;
}
