# Resume Builder — Smartness & Editability Correction

**Date:** March 31, 2026  
**Branch:** feature/resumeBuilderv2  
**Type:** Behavior correction + UX improvement

---

## What Changed

### 1. Guidance is now more accurate

The Resume Builder's section guidance labels are now computed from actual document content instead of static assumptions. Previously, the guidance could say "Citizenship missing" even when the resume visibly showed "U.S. Citizen." This false-positive has been fixed.

Now, each contact/eligibility field is evaluated independently:
- If citizenship is present, the guidance never claims it is missing.
- If only veteran preference is missing, the guidance says exactly "Veteran preference not specified."
- Multiple missing fields produce a combined, prioritized label rather than a generic one.

### 2. Completion and quality are shown more clearly

The old section rail showed a raw percentage (e.g. "100%") alongside a health color that could be amber — confusing when fields are filled but quality needs work.

Now, completion and readiness/fit are shown as separate, explicit concepts:
- **"Strong"** — fields are complete and the section is healthy.
- **"Filled · Fair"** — all fields are present, but quality/alignment issues remain. This clearly explains why a "complete" section might not be green.
- **"Incomplete"** — fields are still missing.
- **"Not started"** — the section has no content.

Raw percentages have been removed from the section rail where they caused confusion.

### 3. The resume can now be edited directly in the document

Previously, editing a field inside the resume required two steps: selecting a section AND toggling a separate "edit ready" mode from the top bar. Now, clicking any editable content within a selected section starts editing immediately. The resume is the object being edited — no detached form workflow is needed.

Contact information fields (name, email, phone, location) are now individually editable inline, matching the pattern already used by summary, experience bullets, skills, and federal details.

### 4. Suggestions can now be applied, not just read

When a guidance card includes a concrete suggestion (e.g. a stronger bullet rewrite), the card now offers:
- **Apply** — inserts the suggested text directly into the document.
- **Edit first** — loads the suggestion into the inline editor so the user can refine it before saving.
- **Dismiss** — closes the card without action.

A preview of the suggested text is shown in the guidance card so the user knows exactly what "Apply" will do before clicking.

---

## Files Changed

### Core types and logic
- `packages/ui/src/resume-builder/types/section-progress-types.ts` — Added `completionLabel`, `fitLabel`, and `combinedStatusLabel` functions.
- `packages/ui/src/resume-builder/types/canonical-callout-defs.ts` — Added `filterCanonicalTargetsForContent` for content-aware callout filtering.
- `packages/ui/src/resume-builder/types/annotation-types.ts` — Added optional `suggestedText` field to `TailoringAnnotation`.
- `packages/ui/src/resume-builder/hooks/useSectionProgress.ts` — Added `getMissingContactFields` and `buildContactGuidanceLabel` for field-level evaluation.
- `packages/ui/src/resume-builder/index.ts` — Updated barrel exports.

### UI components
- `packages/ui/src/resume-builder/components/ResumeSectionRail.tsx` — Replaced raw percentage with explicit combined status labels.
- `packages/ui/src/resume-builder/components/LiveResumeCanvas.tsx` — Removed edit-ready gate for inline editing; added contact field editing.
- `packages/ui/src/resume-builder/components/ResumeCalloutLayer.tsx` — Added Apply/Edit First/Dismiss action pattern with suggestion preview.

### Screen integration
- `packages/ui/src/screens/ResumeBuilderScreen.tsx` — Dynamic content-aware annotations; content-filtered canonical targets; wired suggestion apply/edit actions; added contact field edit persistence.

### Tests
- `packages/ui/src/resume-builder/__tests__/resume-builder-architecture.test.ts` — Added 30+ tests covering field-level evaluation, label generation, content-aware filtering, and completion/fit separation.

---

## What Was NOT Changed

- PathAdvisor shell remains unchanged.
- Document-centered layout preserved.
- Overview mode, section selection, callout interaction model unchanged.
- No routes or unrelated surfaces were modified.
- No commits or pushes.
