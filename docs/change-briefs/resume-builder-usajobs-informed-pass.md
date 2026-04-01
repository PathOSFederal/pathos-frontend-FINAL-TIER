# Change Brief: USAJOBS-Informed Federal Structure + Color Consistency + Overview Coverage

**Date:** March 31, 2026
**Branch:** feature/resumeBuilderv2
**Surface:** Resume Builder (pathos-desktop-web)

---

## What Changed

This pass strengthened the Resume Builder with three connected improvements:

1. **USAJOBS-informed federal section structure**
2. **Consistent completion/severity color logic across all surfaces**
3. **Broader Resume Overview callout eligibility**

---

## What We Borrowed from USAJOBS

USAJOBS (the U.S. government's official job application platform) has clear expectations for federal resume structure that private-sector resume tools often miss. We studied the USAJOBS resume builder flow and help guidance to strengthen PathOS's internal section taxonomy.

### Structural lessons applied:

- **Section ordering** now follows federal resume conventions: Contact/Eligibility → Summary → Work Experience → Education → Certifications/Licenses → Skills → Federal Details → Supporting Evidence
- **Work Experience field expectations** now explicitly model the federal requirements: employer, title, month/year dates, hours/week, series/grade, and results-focused duty descriptions
- **Education and Certifications** are treated with higher priority, reflecting that many federal positions require specific education and certification credentials
- **A new federal section metadata system** defines requirement levels (required / recommended / optional / required-for-this-job) for every section and field
- **Future-ready sections** (Training, Language Skills, Publications) are defined in the taxonomy even though they don't have full UI support yet

### What we did NOT do:

- We did not clone the USAJOBS builder product
- We did not turn PathOS into a government form
- We kept the live document, anchored callouts, and section-aware guidance that make PathOS unique

---

## How Color Meaning Is Now More Consistent

The Resume Builder uses a 5-band completion color scale:

| Band | Range | Color | Meaning |
|------|-------|-------|---------|
| Critical | 0–20% | Red | Blocking issues, missing required content |
| Poor | 21–40% | Orange-red | Major gaps |
| Fair | 41–60% | Amber | Needs improvement |
| Good | 61–80% | Yellow-green | Mostly complete |
| Strong | 81–100% | Green | Complete, no outstanding issues |

This pass enforced that same scale consistently across:

- **Left section rail** — completion percentage text and progress badges
- **Callout endpoint circles** — now show severity-informed color (red/amber/green tints) instead of neutral white
- **Right-side guidance cards** — now show a section health indicator with the section's completion color alongside the issue-level annotation class badge
- **Section progress badges** — ring color uses the shared scale
- **Validation checklist** — preflight status colors map through the same system

The key improvement: **no more contradictory signals.** If a section shows green in the rail, the guidance card for that section also shows a green health dot — even if the active issue has a different severity. Both signals are visible and intelligible.

---

## How Resume Overview Now Better Includes Education and Certifications

Previously, Education and Certifications could be effectively excluded from the Resume Overview callout prioritization because their targets were all medium or low severity. The overview function picked only the top N targets sorted by severity, and these sections were crowded out.

### Changes:

- **Education** now has a high-severity first target: "Incomplete education record"
- **Certifications** now has a high-severity first target: "Target-relevant certification missing"
- **Overview cap raised** from 6 to 8 targets to accommodate the expanded section taxonomy
- **Priority section tie-breaking** ensures contact, summary, experience, education, certifications, and federal-details are preferred when severity ties occur
- **Medium severity fallback** — the overview function now prefers medium-severity targets over low when no high exists, so important sections with medium issues still appear

Result: Education and Certifications reliably appear in Resume Overview when they have meaningful issues, alongside the other core sections.

---

## How PathOS Still Differs

PathOS is not a USAJOBS clone. After this pass, PathOS offers:

- **A live document** — the resume is always visible as a real document, not a form
- **Anchored guidance** — callout lines connect specific content to specific guidance
- **Section-aware intelligence** — each section has its own callout layer and field-level awareness
- **"Required for THIS job"** — PathOS's key differentiator is context-specific requirement levels, not generic required/optional
- **PathAdvisor integration** — AI-powered explanations live alongside the builder
- **Consistent completion colors** — one semantic color system across every surface

The USAJOBS structural lessons make the federal resume mental model more explicit. The PathOS guidance system makes it more actionable.

---

## Files Changed

### New files:
- `packages/ui/src/resume-builder/types/federal-section-meta.ts` — USAJOBS-informed section taxonomy with requirement levels

### Modified files:
- `packages/ui/src/resume-builder/types/anchor-types.ts` — AnchorSectionId expanded for training, language-skills, publications
- `packages/ui/src/resume-builder/types/canonical-callout-defs.ts` — Education/certifications upgraded to high severity, training/language/publications added, overview cap raised to 8
- `packages/ui/src/resume-builder/hooks/useSectionProgress.ts` — Federal section ordering, updated labels
- `packages/ui/src/resume-builder/components/CalloutLineOverlay.tsx` — Endpoint circles use severity-informed colors from shared completion scale
- `packages/ui/src/resume-builder/components/PathOSCalloutCard.tsx` — Section health indicator using shared completion colors
- `packages/ui/src/resume-builder/components/ResumeCalloutLayer.tsx` — Passes section progress to guidance cards for health reconciliation
- `packages/ui/src/resume-builder/index.ts` — Barrel exports for federal section metadata
- `packages/ui/src/screens/ResumeBuilderScreen.tsx` — Passes sectionProgressList to ResumeCalloutLayer
- `packages/ui/src/resume-builder/__tests__/resume-builder-architecture.test.ts` — Updated section counts, added 50+ new tests

---

## Known Follow-ups

- Training, Language Skills, and Publications sections need UI rendering support (currently taxonomy-only)
- `required_for_job` metadata should be driven by actual target job analysis in a future pass
- Section-level completion calculations for Certifications and Federal Details are still placeholder (return 0)
- The section health indicator on guidance cards could be enhanced with a mini progress ring instead of a dot
