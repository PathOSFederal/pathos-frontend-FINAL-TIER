# Change Brief: Summary Callout Fix + Consistent Color Mapping

**Date:** March 31, 2026
**Branch:** feature/resumeBuilderv2
**Type:** Bug fix + consistency improvement

---

## What Changed

### 1. Summary Callouts Now Appear Correctly

Previously, callout lines for the Professional Summary section were not rendering in either Resume Overview mode or Summary section mode. This happened because the callout system looked for a specific anchor point on the resume document, but that anchor only existed when the summary had text filled in. When the summary was empty or being edited, the anchor was missing and no guidance lines could appear.

Now, the anchor is always present on the summary section wrapper regardless of whether the summary is empty, being edited, or filled. Summary callouts render correctly in both modes:

- **Resume Overview**: Summary guidance appears as one of the top prioritized issues across the whole document, just like every other section.
- **Summary section mode**: When the user selects the Summary section in the left rail, the full set of Summary-specific guidance callouts render with lines pointing to the summary region.

### 2. Consistent Color Logic Across the Resume Builder

Previously, different parts of the Resume Builder used separate color mapping logic:

- The left section rail had its own severity-to-color function
- The circular progress badge had a separate color lookup
- The page budget indicator calculated colors locally
- The validation checklist had its own status color function

This meant the same completion level could look slightly different in different places, which was confusing.

Now, the Resume Builder uses one shared color mapping module that all components reference. The color scale uses an intuitive 5-band progression:

| Completion | Color | Meaning |
|-----------|-------|---------|
| 81–100% | Green | Strong — section is complete or nearly complete |
| 61–80% | Green | Good — section is in solid shape |
| 41–60% | Amber | Fair — section needs work |
| 21–40% | Red | Poor — section has significant gaps |
| 0–20% | Red | Critical — section is missing or barely started |

### What Users Can Trust

- **Same color = same meaning everywhere.** A green indicator in the left rail means the same thing as a green progress ring or a green validation check.
- **100% always looks green.** Very low completion always looks red. The progression through amber is smooth and predictable.
- **Summary guidance works.** Users who need help with their Professional Summary will now see the same quality of guidance callouts that every other section receives.

---

## What Did NOT Change

- The overall Resume Builder layout and interaction model are unchanged.
- The document-centered design is preserved.
- Callout interaction (click endpoint to open guidance) works the same way.
- No unrelated routes or features were modified.
- No commits or pushes were made.

---

## Files Changed (this run)

- `packages/ui/src/resume-builder/components/LiveResumeCanvas.tsx` — moved summary anchor to section wrapper
- `packages/ui/src/resume-builder/utils/completion-colors.ts` — new shared color mapping module
- `packages/ui/src/resume-builder/components/ResumeSectionRail.tsx` — uses shared color mapping
- `packages/ui/src/resume-builder/components/SectionProgressBadge.tsx` — uses shared color mapping
- `packages/ui/src/resume-builder/components/PageBudgetIndicator.tsx` — uses shared color mapping
- `packages/ui/src/resume-builder/components/ValidationChecklist.tsx` — uses shared color mapping
- `packages/ui/src/resume-builder/index.ts` — exports new color utilities
- `packages/ui/src/resume-builder/__tests__/resume-builder-architecture.test.ts` — new tests
