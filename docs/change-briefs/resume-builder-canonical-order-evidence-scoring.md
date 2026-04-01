# Resume Builder: Canonical Section Order + Evidence-Based Scoring

**Date:** March 31, 2026
**Branch:** feature/resumeBuilderv2
**Status:** Implementation complete, not committed

---

## What Changed

### 1. One Consistent Section Order Everywhere

The Resume Builder now uses a single canonical section order that is enforced
across every surface: the left rail, the centered resume document, callout
targeting and prioritization, overview mode, and guidance grouping.

Previously, the section order was defined separately in several places —
the section metadata registry, the progress hook, and indirectly in callout
definitions. If these drifted apart, the left rail could show one order
while the document showed another.

Now there is one source of truth (`federal-section-meta.ts`) and all
surfaces read from it. The canonical order is:

1. Contact / Eligibility
2. Summary
3. Work Experience
4. Education
5. Certifications / Licenses
6. Skills
7. Federal Details
8. Supporting Evidence

This order matches USAJOBS conventions and reflects how federal HR
reviewers typically read resumes. Federal Details is now correctly
positioned before Supporting Evidence.

### 2. Scores Are More Grounded in Actual Resume Evidence

Section scores are now computed by a deterministic evidence-based scoring
engine that evaluates four explicit dimensions:

- **Field Completion**: are the expected fields present?
- **Evidence Strength**: how specific and quantified is the content?
- **Target-Job Relevance**: does the content align with the target announcement?
- **Federal Requirement Coverage**: are federal-specific fields present?

Each dimension contributes to a weighted composite score based on the
section's nature. Contact/Eligibility weights field presence most heavily.
Work Experience and Summary weight evidence quality most heavily.
Education and Certifications use a balanced weighting.

The scoring engine uses explicit, documented rules and weights — not vague
heuristics. Every section score can be explained by listing the specific
issues that caused deductions.

### 3. The Builder Now Distinguishes Missing Information from Weak Proof

Previously, the builder treated "Veteran preference not specified"
(a missing required field) and "Bullet lacks quantified impact" (weak
evidence quality) as the same kind of problem. Now they are structurally
distinct:

- **Missing Field**: a required or expected field has no content
- **Weak Evidence**: content exists but lacks specificity or metrics
- **Keyword Gap**: target job language is missing from the resume
- **Federal Requirement**: a federal-specific convention or field is absent
- **Optional Enhancement**: a nice-to-have improvement

These categories influence scoring weights, prioritization, and how issues
are labeled in the builder. Federal requirement issues are prioritized
highest; optional enhancements are lowest.

### 4. The Overall Readiness Score Is More Explainable

The overall readiness percentage is now derived from the evidence-based
section scores rather than a disconnected heuristic. Required sections
(Contact, Work Experience, Federal Details) contribute more weight.
Unresolved critical federal requirement issues impose an additional penalty
that cannot be hidden by high scores in other sections.

The result is a readiness number that feels more defensible: if three
sections show "Complete" and five show "Needs Work," the overall score
lands in the middle — not at 90%.

---

## What Did Not Change

- The document-centered layout is preserved
- Section selection, callout lines, and editing all work as before
- PathAdvisor shell is unchanged
- No unrelated routes were modified
- Suggestion application and inline editing are preserved
- No commits or pushes were made

---

## Technical Summary

### New Files
- `packages/ui/src/resume-builder/types/issue-categories.ts` — typed issue classification system
- `packages/ui/src/resume-builder/utils/evidence-scoring.ts` — deterministic scoring engine

### Modified Files
- `packages/ui/src/resume-builder/types/federal-section-meta.ts` — added scoringMode, fixed canonical order, added getCanonicalUIOrder
- `packages/ui/src/resume-builder/hooks/useSectionProgress.ts` — refactored to consume canonical order from single source
- `packages/ui/src/resume-builder/types/canonical-callout-defs.ts` — added evidence-informed overview prioritization
- `packages/ui/src/resume-builder/index.ts` — barrel exports for new modules
- `packages/ui/src/screens/ResumeBuilderScreen.tsx` — integrated evidence scoring, updated readiness and overview

### Tests Added
- Canonical section order consistency (8 UI sections, correct order, monotonic displayOrder)
- Section metadata is single source of truth for labels and scoring mode
- Issue categories: missing_field vs weak_evidence are structurally distinct
- Sorting: federal_requirement issues prioritized above all others
- Evidence scoring: empty sections score low, populated sections score high
- Work Experience scoring reflects both field completion and evidence quality
- Contact scoring reflects actual federal-required field coverage
- Overall readiness changes coherently when section evidence changes
- Readiness is penalized by unresolved federal requirement issues
