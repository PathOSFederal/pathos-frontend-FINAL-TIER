# Resume Builder — Callout Integration Correction

**Branch:** `feature/resumeBuilderv2`
**Date:** March 31, 2026

---

## What changed

The Resume Builder's callout system has been corrected from an "added visual layer" to a first-class, section-aware guidance system that is mechanically attached to the resume document.

### Callouts now exist for every major resume section

Previously, only a few sections (summary, experience, skills) had callout support. Now, every major section of the resume has at least one canonical callout target:

- **Identity / Contact** — flags missing or weak contact, location, or employment identity information
- **Professional Summary** — flags missing summary or weak opening fit statement
- **Work Experience** — flags weak bullets, missing quantified outcomes, leadership gaps, specialized experience gaps
- **Education** — flags missing degree, date, or detail
- **Skills** — flags target-keyword coverage gaps and weak skills mapping
- **Certifications** — flags missing or under-specified target-relevant credentials
- **Federal Details** — flags missing required federal application details
- **Supporting Evidence** — flags missing quantified support or evidence gaps

A new canonical callout registry makes this coverage explicit and maintainable rather than ad-hoc.

### Callouts stay attached to the resume while scrolling

Previously, callout lines could detach from the document when the user scrolled. The overlay now stays visually attached to the document content at all times. Line geometry is remeasured on scroll, resize, and section changes.

### Guidance opens from the callout interaction itself

Instead of always-visible guidance boxes sitting beside the resume, guidance cards now appear only when the user interacts with a callout. Clicking a callout endpoint circle opens the corresponding guidance card. Clicking a different endpoint switches to that card. The right-side guidance area shows a compact summary of issues by default, with detail revealed on demand.

### Old detached guidance boxes were replaced

The previous pattern of always-on stacked guidance cards has been replaced by the callout-driven model. This makes the interface calmer and keeps the resume as the clear primary object. The right-side area now serves as a callout-driven detail surface rather than a competing information display.

### What this means for the experience

- The resume stays centered and readable — it is always the main object
- Callout lines are a precision annotation layer, not a visual distraction
- Guidance is contextual and calm — it appears from the callout interaction
- Changing sections naturally clears the previous section's callouts and loads the new section's relevant ones
- The overall feel is more intentional and easier to understand

## Files Changed

| Status | File |
|--------|------|
| Modified | `packages/ui/src/screens/ResumeBuilderScreen.tsx` |
| Modified | `packages/ui/src/resume-builder/components/LiveResumeCanvas.tsx` |
| Modified | `packages/ui/src/resume-builder/components/ResumeCalloutLayer.tsx` |
| Modified | `packages/ui/src/resume-builder/components/CalloutLineOverlay.tsx` |
| Modified | `packages/ui/src/resume-builder/hooks/useCalloutLines.ts` |
| Modified | `packages/ui/src/resume-builder/hooks/useSectionProgress.ts` |
| Modified | `packages/ui/src/resume-builder/types/anchor-types.ts` |
| Modified | `packages/ui/src/resume-builder/types/callout-line-types.ts` |
| New | `packages/ui/src/resume-builder/types/canonical-callout-defs.ts` |
| Modified | `packages/ui/src/resume-builder/index.ts` |
| Modified | `packages/ui/src/resume-builder/__tests__/resume-builder-architecture.test.ts` |

## Validation

- `npx vitest run` — 203 resume-builder architecture tests pass
- No linter errors introduced
- No regressions to existing builder behavior

## Governing Constraints Preserved

- Resume document remains the primary visual object
- PathAdvisor shell is unchanged
- Workflow stages preserved: Master Resume → Target Job → Tailor/Compress → Validate → Export
- Top bar, section rail, stage tabs all unchanged
- No `var`; only `const` and `let`
- No commit, no push

## Follow-ups

- Wire canonical callout targets to real tailoring annotation data when available from backend
- Animate callout line and guidance card transitions for smoother interaction
- Implement keyboard navigation between callout endpoints within a section
- Add aria-live region for guidance card content changes
