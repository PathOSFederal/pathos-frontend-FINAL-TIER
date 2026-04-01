/**
 * ============================================================================
 * FEDERAL SECTION METADATA — USAJOBS-informed section taxonomy + requirements
 * ============================================================================
 *
 * PURPOSE: Defines the canonical federal resume section structure informed
 * by USAJOBS resume builder conventions. This module is the SINGLE SOURCE
 * OF TRUTH for section order, section identity, and section metadata
 * across the entire Resume Builder. All surfaces — left rail, document
 * canvas, callout targeting, overview prioritization, guidance grouping —
 * must derive their section order from this module.
 *
 * This module provides:
 *   1. A typed requirement level system (required / recommended / optional /
 *      required-for-job) that enables intelligent section-level guidance.
 *   2. An ordered section taxonomy reflecting real federal resume expectations.
 *   3. Per-section metadata including federal field expectations, USAJOBS
 *      alignment notes, and PathOS-specific enhancement opportunities.
 *   4. A scoring-mode classification that tells the scoring engine whether
 *      a section is primarily about field completion, evidence quality,
 *      or a combination of both.
 *
 * CANONICAL ORDER (enforced via displayOrder):
 *   0. Contact / Eligibility
 *   1. Summary
 *   2. Work Experience
 *   3. Education
 *   4. Certifications / Licenses
 *   5. Skills
 *   6. Federal Details
 *   7. Supporting Evidence
 *   (future: Training, Language Skills, Publications)
 *
 * ONE-ORDER RULE: No component may define its own section order. The
 * left rail must match the document rendering order, which must match
 * the callout prioritization order. All read from getCanonicalUIOrder.
 *
 * USAJOBS STRUCTURAL LESSONS:
 *   USAJOBS help guidance (help.usajobs.gov) and the USAJOBS builder flow
 *   make specific structural expectations clear for federal resumes:
 *     - Contact / eligibility information (always required)
 *     - Professional summary (strongly recommended)
 *     - Work experience with employer, title, dates (month/year),
 *       hours/week, federal series/grade, results-focused descriptions
 *     - Education with degree, institution, dates, GPA when recent
 *     - Certifications / licenses when the job requires them
 *     - Training, language skills, publications when relevant
 *     - Federal-specific details (clearance, veteran preference, grade)
 *
 *   PathOS borrows these structural lessons without cloning the USAJOBS
 *   builder product. The key PathOS differentiator is:
 *     "required for THIS target job" — not just generic required/optional.
 *
 * DESIGN RULE: This file defines the section metadata model. It does NOT
 * render any UI. Components read from this model to inform their behavior.
 *
 * BOUNDARY RULE: This file MUST NOT import from next/* or electron/*.
 */

// ---------------------------------------------------------------------------
// Requirement level — how necessary is a section for a given context?
// ---------------------------------------------------------------------------

/**
 * Requirement level for a resume section or field. This is the core
 * metadata that PathOS uses to provide intelligent section guidance.
 *
 *   required:          Always required for any federal resume. Omitting
 *                      this section risks automatic screening rejection.
 *                      Example: contact info, work experience.
 *
 *   recommended:       Strongly recommended for most federal applications.
 *                      Not technically blocking, but omission weakens the
 *                      application significantly.
 *                      Example: professional summary, education.
 *
 *   optional:          Useful when present, but not expected on every
 *                      resume. Include when you have relevant content.
 *                      Example: publications, language skills.
 *
 *   required_for_job:  Not universally required, but the TARGET JOB
 *                      specifically requires or strongly prefers it.
 *                      This is the key PathOS differentiator — generic
 *                      builders say "optional," PathOS says "required
 *                      for THIS announcement."
 *                      Example: CISSP for a cybersecurity posting.
 */
export type RequirementLevel =
  | 'required'
  | 'recommended'
  | 'optional'
  | 'required_for_job';

// ---------------------------------------------------------------------------
// Scoring mode — how a section's score is primarily computed
// ---------------------------------------------------------------------------

/**
 * Scoring mode tells the scoring engine what kind of assessment is most
 * meaningful for a section. This drives which scoring dimensions receive
 * the most weight when computing section health.
 *
 *   field_completion:  Section health is primarily about whether expected
 *                      fields are present. Example: Contact / Eligibility
 *                      and Federal Details — the quality of the content
 *                      matters less than its presence.
 *
 *   evidence_quality:  Section health is primarily about the STRENGTH of
 *                      the content, not just its presence. Example: Work
 *                      Experience, Summary — having a summary is not enough;
 *                      the summary must contain a fit statement, targeted
 *                      keywords, and federal framing.
 *
 *   hybrid:            Both field presence and content quality matter roughly
 *                      equally. Example: Education — the degree/institution
 *                      fields must be present (field_completion) but the
 *                      relevance to the target job also matters (evidence).
 */
export type ScoringMode = 'field_completion' | 'evidence_quality' | 'hybrid';

// ---------------------------------------------------------------------------
// Federal section ID — the canonical ordered section identifiers
// ---------------------------------------------------------------------------

/**
 * All canonical section identifiers for a USAJOBS-informed federal resume.
 * This is a superset of AnchorSectionId — it includes sections that may
 * not yet have full UI support but are recognized in the taxonomy.
 *
 * The order here reflects the recommended federal resume section flow:
 *   1. Contact / Eligibility (always first)
 *   2. Summary (HR reads first after contact)
 *   3. Work Experience (the core of the federal resume)
 *   4. Education (required when the announcement specifies)
 *   5. Certifications / Licenses (required for credentialed positions)
 *   6. Skills (important for keyword matching)
 *   7. Training (valued in federal context, especially recent training)
 *   8. Language Skills (required for certain positions)
 *   9. Publications (relevant for research/policy positions)
 *  10. Supporting Evidence / Additional Information
 *  11. Federal Details (clearance, vet pref, grade — often last section)
 */
export type FederalSectionId =
  | 'contact'
  | 'summary'
  | 'experience'
  | 'education'
  | 'certifications'
  | 'skills'
  | 'training'
  | 'language-skills'
  | 'publications'
  | 'supporting-evidence'
  | 'federal-details';

// ---------------------------------------------------------------------------
// Federal section metadata — per-section structural information
// ---------------------------------------------------------------------------

/**
 * Metadata for a single federal resume section. Describes the section's
 * role in the federal resume structure, its default requirement level,
 * and the federal field expectations within it.
 */
export interface FederalSectionMeta {
  /** Section identifier. */
  sectionId: FederalSectionId;

  /** Display label shown in the rail and section headers. */
  label: string;

  /** Short description of the section's purpose in a federal resume. */
  description: string;

  /** Default requirement level (without target job context).
   *  When a target job is active, PathOS may upgrade 'optional' or
   *  'recommended' sections to 'required_for_job'. */
  defaultRequirement: RequirementLevel;

  /** Whether this section is currently supported in the UI.
   *  Sections marked false are part of the taxonomy for future-readiness
   *  but do not yet render in the builder. */
  uiSupported: boolean;

  /** Display order in the section rail (lower = higher in the list).
   *  THIS IS THE CANONICAL ORDER. All surfaces — rail, document, callout
   *  targeting, overview prioritization — must use this order. */
  displayOrder: number;

  /** Scoring mode tells the evidence scoring engine which assessment
   *  dimensions are most important for this section. Sections with
   *  'field_completion' are primarily about presence of required fields.
   *  Sections with 'evidence_quality' are primarily about strength of
   *  content. Sections with 'hybrid' care about both equally. */
  scoringMode: ScoringMode;

  /** Federal field expectations within this section. Each field
   *  describes a specific piece of information that federal HR
   *  reviewers expect to find. */
  federalFields: FederalFieldExpectation[];

  /** USAJOBS alignment note — how this section maps to the USAJOBS
   *  builder flow and help guidance. For internal reference. */
  usajobsNote: string;
}

// ---------------------------------------------------------------------------
// Federal field expectation — what HR expects inside a section
// ---------------------------------------------------------------------------

/**
 * A specific field-level expectation within a section. Federal resumes
 * have more granular field requirements than private-sector resumes —
 * for example, hours/week and series/grade are expected per experience entry.
 */
export interface FederalFieldExpectation {
  /** Short field identifier. Example: 'hours-per-week'. */
  fieldId: string;

  /** Human-readable field label. Example: 'Hours per Week'. */
  label: string;

  /** Requirement level for this specific field. */
  requirement: RequirementLevel;

  /** Brief explanation of why this field matters for federal applications. */
  rationale: string;
}

// ---------------------------------------------------------------------------
// Canonical federal section definitions — the full metadata registry
// ---------------------------------------------------------------------------

/**
 * Build the canonical federal section metadata registry. Returns all
 * sections in recommended display order with their metadata.
 *
 * This is the single source of truth for "what sections make up a
 * federal resume and what does each require." Components read from
 * this to inform rail display, callout logic, and completion calculations.
 */
export function buildFederalSectionMeta(): FederalSectionMeta[] {
  return [
    /* ----------------------------------------------------------------
     * 1. CONTACT / ELIGIBILITY
     * Always required. Federal applications need full contact info
     * plus citizenship and eligibility details that private-sector
     * resumes typically omit.
     * ---------------------------------------------------------------- */
    {
      sectionId: 'contact',
      label: 'Contact / Eligibility',
      description: 'Full name, contact details, citizenship, and employment eligibility.',
      defaultRequirement: 'required',
      uiSupported: true,
      displayOrder: 0,
      scoringMode: 'field_completion',
      federalFields: [
        { fieldId: 'full-name', label: 'Full Name', requirement: 'required', rationale: 'Legal name as it appears on government records.' },
        { fieldId: 'email', label: 'Email', requirement: 'required', rationale: 'Primary communication channel for application status.' },
        { fieldId: 'phone', label: 'Phone', requirement: 'required', rationale: 'Required for scheduling and verification.' },
        { fieldId: 'address', label: 'City / State', requirement: 'required', rationale: 'Location determines geographic eligibility for some postings.' },
        { fieldId: 'citizenship', label: 'Citizenship Status', requirement: 'required', rationale: 'U.S. citizenship is required for most federal positions.' },
        { fieldId: 'veteran-preference', label: 'Veteran Preference', requirement: 'recommended', rationale: 'Veterans receive preference points in federal hiring.' },
      ],
      usajobsNote: 'USAJOBS collects contact and eligibility as the first step. Citizenship and veteran status are separate questions in the USAJOBS flow.',
    },

    /* ----------------------------------------------------------------
     * 2. PROFESSIONAL SUMMARY
     * Strongly recommended. The summary is the first content HR reads
     * after contact details. A targeted fit statement significantly
     * improves screening outcomes.
     * ---------------------------------------------------------------- */
    {
      sectionId: 'summary',
      label: 'Summary',
      description: 'Professional summary with a targeted fit statement connecting qualifications to the target position.',
      defaultRequirement: 'recommended',
      uiSupported: true,
      displayOrder: 1,
      scoringMode: 'evidence_quality',
      federalFields: [
        { fieldId: 'fit-statement', label: 'Fit Statement', requirement: 'recommended', rationale: 'Opens with explicit connection to target position requirements.' },
        { fieldId: 'specialized-experience', label: 'Specialized Experience Claim', requirement: 'recommended', rationale: 'States years and type of specialized experience matching the announcement.' },
        { fieldId: 'clearance-mention', label: 'Clearance Mention', requirement: 'optional', rationale: 'Mention active clearance early if the position requires one.' },
      ],
      usajobsNote: 'USAJOBS does not have a dedicated summary field but help guidance recommends opening with relevant qualifications.',
    },

    /* ----------------------------------------------------------------
     * 3. WORK EXPERIENCE
     * Always required. The most important section of a federal resume.
     * USAJOBS expects significantly more detail than private-sector:
     * employer, title, dates (month/year), hours/week, series/grade,
     * and results-focused duty descriptions.
     * ---------------------------------------------------------------- */
    {
      sectionId: 'experience',
      label: 'Work Experience',
      description: 'Detailed employment history with federal-grade field coverage per entry.',
      defaultRequirement: 'required',
      uiSupported: true,
      displayOrder: 2,
      scoringMode: 'evidence_quality',
      federalFields: [
        { fieldId: 'employer', label: 'Employer / Agency', requirement: 'required', rationale: 'Full organization name, city, and state. For federal positions, include agency and sub-component.' },
        { fieldId: 'job-title', label: 'Job Title', requirement: 'required', rationale: 'Use the exact title from your SF-50 or a title that maps to the target series.' },
        { fieldId: 'date-range', label: 'Start / End Date (Month/Year)', requirement: 'required', rationale: 'Federal HR requires month/year format to calculate qualifying experience duration.' },
        { fieldId: 'hours-per-week', label: 'Hours per Week', requirement: 'required', rationale: 'Experience not credited at full-time level without hours/week. Missing this field can reduce credited experience.' },
        { fieldId: 'series-grade', label: 'Federal Series / Grade', requirement: 'recommended', rationale: 'Include GS series and grade for current/prior federal positions. Helps HR assess qualification level.' },
        { fieldId: 'salary', label: 'Salary', requirement: 'optional', rationale: 'Some agencies use salary to verify grade equivalency for non-federal applicants.' },
        { fieldId: 'supervisor-info', label: 'Supervisor Name / Phone', requirement: 'optional', rationale: 'May be requested on some federal applications for verification.' },
        { fieldId: 'duties-results', label: 'Duties with Results / Metrics', requirement: 'required', rationale: 'Use results-focused descriptions with similar terms to the announcement. Include scope, complexity, and quantified outcomes.' },
      ],
      usajobsNote: 'USAJOBS work experience form collects employer, title, dates, hours/week, series/grade, salary, supervisor, and free-text duties. This is the most field-intensive section.',
    },

    /* ----------------------------------------------------------------
     * 4. EDUCATION
     * Required when the announcement specifies an education requirement.
     * Even when not strictly required, education strengthens many
     * federal applications.
     * ---------------------------------------------------------------- */
    {
      sectionId: 'education',
      label: 'Education',
      description: 'Degree, institution, dates, and field of study. Required when the announcement specifies education requirements.',
      defaultRequirement: 'recommended',
      uiSupported: true,
      displayOrder: 3,
      scoringMode: 'hybrid',
      federalFields: [
        { fieldId: 'institution', label: 'Institution Name', requirement: 'required', rationale: 'Full name of the accredited institution.' },
        { fieldId: 'degree', label: 'Degree Type', requirement: 'required', rationale: 'E.g., Bachelor of Science, Master of Arts. Must match accredited program.' },
        { fieldId: 'field-of-study', label: 'Field of Study / Major', requirement: 'required', rationale: 'Must align with degree requirements in the announcement if specified.' },
        { fieldId: 'graduation-date', label: 'Graduation Date', requirement: 'required', rationale: 'Month/year of completion or expected completion.' },
        { fieldId: 'gpa', label: 'GPA', requirement: 'optional', rationale: 'Include if recent graduate (within 2 years) or if the announcement specifies a GPA minimum.' },
        { fieldId: 'relevant-coursework', label: 'Relevant Coursework', requirement: 'optional', rationale: 'Helpful when coursework directly maps to specialized experience requirements.' },
      ],
      usajobsNote: 'USAJOBS education section collects institution, degree, dates, and GPA. The system validates education requirements against the announcement.',
    },

    /* ----------------------------------------------------------------
     * 5. CERTIFICATIONS / LICENSES
     * Required when the announcement specifies certification requirements.
     * Many federal IT, healthcare, and engineering positions require
     * specific certifications.
     * ---------------------------------------------------------------- */
    {
      sectionId: 'certifications',
      label: 'Certifications / Licenses',
      description: 'Professional certifications and licenses with issuing body, date, and expiration.',
      defaultRequirement: 'recommended',
      uiSupported: true,
      displayOrder: 4,
      scoringMode: 'hybrid',
      federalFields: [
        { fieldId: 'cert-name', label: 'Certification Name', requirement: 'required', rationale: 'Full name of the certification or license.' },
        { fieldId: 'issuing-body', label: 'Issuing Organization', requirement: 'required', rationale: 'The body that issued the certification.' },
        { fieldId: 'date-earned', label: 'Date Earned', requirement: 'required', rationale: 'When the certification was obtained.' },
        { fieldId: 'expiration', label: 'Expiration Date', requirement: 'recommended', rationale: 'Expired certifications may not be credited.' },
        { fieldId: 'license-number', label: 'License Number', requirement: 'optional', rationale: 'Include if verifiable and relevant.' },
      ],
      usajobsNote: 'USAJOBS has a dedicated certifications section. Many federal positions explicitly require or prefer specific certifications (CISSP, PMP, etc.).',
    },

    /* ----------------------------------------------------------------
     * 6. SKILLS
     * Recommended for keyword matching. Automated screening tools
     * check skills against announcement language.
     * ---------------------------------------------------------------- */
    {
      sectionId: 'skills',
      label: 'Skills',
      description: 'Technical and professional skills for keyword matching and qualification evidence.',
      defaultRequirement: 'recommended',
      uiSupported: true,
      displayOrder: 5,
      scoringMode: 'hybrid',
      federalFields: [
        { fieldId: 'technical-skills', label: 'Technical Skills', requirement: 'recommended', rationale: 'Exact technology names, frameworks, and tools from the announcement.' },
        { fieldId: 'proficiency-level', label: 'Proficiency Level', requirement: 'optional', rationale: 'Self-assessed proficiency helps HR gauge depth (e.g., Advanced, Intermediate).' },
      ],
      usajobsNote: 'USAJOBS does not have a separate skills section in the builder, but skills appear in experience descriptions and questionnaire responses.',
    },

    /* ----------------------------------------------------------------
     * 7. TRAINING
     * Optional but valued in federal context. Recent training shows
     * continued professional development and can count toward
     * qualification requirements.
     * ---------------------------------------------------------------- */
    {
      sectionId: 'training',
      label: 'Training',
      description: 'Relevant professional training courses, workshops, and development programs.',
      defaultRequirement: 'optional',
      uiSupported: false,
      displayOrder: 8,
      scoringMode: 'hybrid',
      federalFields: [
        { fieldId: 'course-name', label: 'Course / Program Name', requirement: 'required', rationale: 'Name of the training program or course.' },
        { fieldId: 'provider', label: 'Training Provider', requirement: 'recommended', rationale: 'Organization that delivered the training.' },
        { fieldId: 'completion-date', label: 'Completion Date', requirement: 'recommended', rationale: 'When the training was completed.' },
        { fieldId: 'hours', label: 'Hours / Credits', requirement: 'optional', rationale: 'Duration helps HR assess depth of training.' },
      ],
      usajobsNote: 'USAJOBS includes training as part of the resume profile. Particularly valued for recent professional development.',
    },

    /* ----------------------------------------------------------------
     * 8. LANGUAGE SKILLS
     * Optional for most positions, required for positions with
     * language proficiency requirements.
     * ---------------------------------------------------------------- */
    {
      sectionId: 'language-skills',
      label: 'Language Skills',
      description: 'Foreign language proficiencies with self-assessed or tested proficiency levels.',
      defaultRequirement: 'optional',
      uiSupported: false,
      displayOrder: 9,
      scoringMode: 'field_completion',
      federalFields: [
        { fieldId: 'language', label: 'Language', requirement: 'required', rationale: 'The language in which you have proficiency.' },
        { fieldId: 'proficiency', label: 'Proficiency Level', requirement: 'recommended', rationale: 'ILR scale or DLPT score where available.' },
      ],
      usajobsNote: 'USAJOBS collects language skills as part of the profile. Important for State Department, intelligence community, and international positions.',
    },

    /* ----------------------------------------------------------------
     * 9. PUBLICATIONS
     * Optional for most positions. Relevant for research, policy, and
     * senior technical positions.
     * ---------------------------------------------------------------- */
    {
      sectionId: 'publications',
      label: 'Publications',
      description: 'Published works, papers, and presentations relevant to the target position.',
      defaultRequirement: 'optional',
      uiSupported: false,
      displayOrder: 10,
      scoringMode: 'evidence_quality',
      federalFields: [
        { fieldId: 'title', label: 'Publication Title', requirement: 'required', rationale: 'Title of the published work.' },
        { fieldId: 'venue', label: 'Publication Venue', requirement: 'recommended', rationale: 'Journal, conference, or publisher.' },
        { fieldId: 'date', label: 'Publication Date', requirement: 'recommended', rationale: 'When the work was published.' },
      ],
      usajobsNote: 'USAJOBS does not have a dedicated publications section, but guidance recommends including them in a resume when relevant.',
    },

    /* ----------------------------------------------------------------
     * 8. SUPPORTING EVIDENCE / ADDITIONAL INFORMATION
     * Optional but strengthens claims. Awards, projects, metrics.
     * Ordered after Federal Details in the canonical section flow.
     * ---------------------------------------------------------------- */
    {
      sectionId: 'supporting-evidence',
      label: 'Supporting Evidence',
      description: 'Awards, recognitions, projects, and quantified outcomes that support qualification claims.',
      defaultRequirement: 'optional',
      uiSupported: true,
      displayOrder: 7,
      scoringMode: 'evidence_quality',
      federalFields: [
        { fieldId: 'awards', label: 'Awards / Recognitions', requirement: 'optional', rationale: 'Named awards strengthen credibility for competitive positions.' },
        { fieldId: 'project-outcomes', label: 'Key Project Outcomes', requirement: 'optional', rationale: 'Specific project results with quantified impact.' },
      ],
      usajobsNote: 'USAJOBS guidance recommends additional information that supports qualification claims. PathOS surfaces this as a structured section.',
    },

    /* ----------------------------------------------------------------
     * 7. FEDERAL DETAILS
     * Required for federal applications. Includes clearance level,
     * veteran preference, federal employee status, and highest
     * grade held. Canonical position: after Skills, before Evidence.
     * ---------------------------------------------------------------- */
    {
      sectionId: 'federal-details',
      label: 'Federal Details',
      description: 'Security clearance, veteran preference, federal employee status, and highest grade held.',
      defaultRequirement: 'required',
      uiSupported: true,
      displayOrder: 6,
      scoringMode: 'field_completion',
      federalFields: [
        { fieldId: 'clearance-level', label: 'Security Clearance Level', requirement: 'required', rationale: 'Many federal positions require an active or eligible clearance. Specify current level and status.' },
        { fieldId: 'veteran-preference', label: 'Veteran Preference', requirement: 'required', rationale: 'Veterans receive hiring preference points. Must declare status accurately.' },
        { fieldId: 'federal-status', label: 'Federal Employee Status', requirement: 'required', rationale: 'Current or former federal employee status affects eligibility paths (reinstatement, transfer, etc.).' },
        { fieldId: 'highest-grade', label: 'Highest Grade Held', requirement: 'required', rationale: 'Highest GS grade and dates held. Used to determine qualification level and pay setting.' },
        { fieldId: 'series', label: 'Occupational Series', requirement: 'recommended', rationale: 'The GS occupational series for current/prior federal positions.' },
      ],
      usajobsNote: 'USAJOBS collects these as part of the eligibility and preferences sections. They are separate from the resume content but essential for federal applications.',
    },
  ];
}

// ---------------------------------------------------------------------------
// Helpers — look up section metadata by ID
// ---------------------------------------------------------------------------

/**
 * Get the metadata for a specific section by ID.
 * Returns null if the section is not found in the registry.
 */
export function getFederalSectionMeta(
  registry: FederalSectionMeta[],
  sectionId: string
): FederalSectionMeta | null {
  for (let i = 0; i < registry.length; i++) {
    if (registry[i].sectionId === sectionId) {
      return registry[i];
    }
  }
  return null;
}

/**
 * Get all UI-supported sections from the registry, in display order.
 * These are the sections that currently render in the builder.
 */
export function getUISupportedSections(
  registry: FederalSectionMeta[]
): FederalSectionMeta[] {
  const supported: FederalSectionMeta[] = [];
  for (let i = 0; i < registry.length; i++) {
    if (registry[i].uiSupported) {
      supported.push(registry[i]);
    }
  }
  return supported;
}

/**
 * Get all section IDs in canonical display order.
 */
export function getFederalSectionOrder(
  registry: FederalSectionMeta[]
): FederalSectionId[] {
  const ids: FederalSectionId[] = [];
  for (let i = 0; i < registry.length; i++) {
    ids.push(registry[i].sectionId);
  }
  return ids;
}

/**
 * Get the federal field expectations for a section's work experience entries.
 * Convenience helper that returns the field expectations for 'experience'.
 */
export function getExperienceFieldExpectations(
  registry: FederalSectionMeta[]
): FederalFieldExpectation[] {
  const meta = getFederalSectionMeta(registry, 'experience');
  if (!meta) return [];
  return meta.federalFields;
}

/**
 * Get UI-supported sections sorted in canonical display order. This is the
 * ONE function that all surfaces must use for section ordering. Calling
 * this once and mapping over the result guarantees that the left rail,
 * the document canvas, the callout system, and the overview all present
 * sections in the same order.
 *
 * Returns an array of { sectionId, label, displayOrder, scoringMode,
 * defaultRequirement } objects — just enough metadata for ordering
 * and scoring decisions without needing the full FederalSectionMeta.
 */
export function getCanonicalUIOrder(
  registry: FederalSectionMeta[]
): Array<{
  sectionId: FederalSectionId;
  label: string;
  displayOrder: number;
  scoringMode: ScoringMode;
  defaultRequirement: RequirementLevel;
}> {
  /* Filter to UI-supported sections and sort by displayOrder */
  const supported: FederalSectionMeta[] = [];
  for (let i = 0; i < registry.length; i++) {
    if (registry[i].uiSupported) {
      supported.push(registry[i]);
    }
  }
  supported.sort(function (a, b) { return a.displayOrder - b.displayOrder; });

  const result: Array<{
    sectionId: FederalSectionId;
    label: string;
    displayOrder: number;
    scoringMode: ScoringMode;
    defaultRequirement: RequirementLevel;
  }> = [];

  for (let i = 0; i < supported.length; i++) {
    result.push({
      sectionId: supported[i].sectionId,
      label: supported[i].label,
      displayOrder: supported[i].displayOrder,
      scoringMode: supported[i].scoringMode,
      defaultRequirement: supported[i].defaultRequirement,
    });
  }

  return result;
}

/**
 * Look up the scoring mode for a given section by ID.
 * Returns 'hybrid' as a safe default if the section is not found.
 */
export function getScoringMode(
  registry: FederalSectionMeta[],
  sectionId: string
): ScoringMode {
  for (let i = 0; i < registry.length; i++) {
    if (registry[i].sectionId === sectionId) {
      return registry[i].scoringMode;
    }
  }
  return 'hybrid';
}

/**
 * Compute the requirement label for display in the UI.
 * Maps the requirement level to a short human-readable string.
 */
export function requirementLevelLabel(level: RequirementLevel): string {
  if (level === 'required') return 'Required';
  if (level === 'recommended') return 'Recommended';
  if (level === 'optional') return 'Optional';
  return 'Required for this job';
}

/**
 * Compute the requirement level color using the shared completion scale
 * logic. Required = red/danger, recommended = amber/warning,
 * optional = gray/dim, required_for_job = danger with accent.
 */
export function requirementLevelColor(level: RequirementLevel): string {
  if (level === 'required') return 'var(--p-danger, #ef4444)';
  if (level === 'required_for_job') return 'var(--p-danger, #ef4444)';
  if (level === 'recommended') return 'var(--p-warning, #eab308)';
  return 'var(--p-text-dim)';
}
