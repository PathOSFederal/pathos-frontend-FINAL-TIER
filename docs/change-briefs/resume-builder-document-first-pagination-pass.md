# Change Brief — Resume Builder Document-First Pagination Pass

**Date:** 2026-04-01
**Branch:** `feature/resumeBuilderv2`
**Status:** Complete (not committed)

## Goal

Make the Resume Builder behave like a true document editor with real pagination, correct readiness for blank resumes, structured input guidance for contact fields, and document-click-first interaction.

## Core Decisions

1. Dynamic page boundary placement based on DOM measurement, not hardcoded section positions
2. Contact fields get structured validation and formatting at save time
3. Blank resumes must start with realistically low readiness (empty scaffold is not meaningful content)
4. Document click is the primary interaction; rail follows document, not the reverse
5. Preview/print reflect the same multi-page model as the editing canvas

## Changes

### 1. Dynamic Page Boundary Placement

- Replaced hardcoded page break between Federal Details and Supporting Evidence with DOM-measured positioning
- `ResizeObserver` measures all `[data-section-id]` elements and identifies the section whose top is closest to the page boundary threshold
- `pageBreakBeforeSectionId` state drives conditional `PageBoundarySpacer` rendering before any qualifying section
- Page count communicated to parent via `onPageCountChange` callback
- Screen-level `computedPageCount` now prioritizes canvas-measured count over heuristic

### 2. Preview Multi-Page Fidelity

- Preview overlay renders discrete visual page surfaces using clip-and-offset technique
- Each page uses `overflow: hidden` and `transform: translateY` to show the correct slice of content
- Multiple page surfaces separated by visual gap, matching the editing canvas feel
- Print CSS updated accordingly

### 3. Contact Field Input Guidance

- `InlineEditor` extended with `hint` and `validationMessage` props for inline guidance below the editor
- Email fields: hint text "e.g. jane.doe@email.com", real-time validation for basic format
- Phone fields: hint text "10-digit US number", formatting guidance
- `getEmailValidation` and `getPhoneValidation` helper functions in `ContactCanvasSection`
- Warning indicator (amber dot) on `ContactEditableField` when saved email/phone looks malformed
- Phone numbers auto-formatted to `(xxx) xxx-xxxx` on save
- Email values trimmed on save

### 4. Blank Resume Readiness Correction

- `detectCertificationsIssues`: empty certifications now classified as `missing_field` (low severity) instead of `optional_enhancement`
- `detectSupportingEvidenceIssues`: empty supporting evidence now classified as `missing_field` (low severity) instead of `optional_enhancement`
- This causes `computeFieldCompletionScore` to correctly penalize empty sections rather than returning 100%
- `scoreSection` and `scoreAllSections` signatures updated to accept `supportingEvidence` parameter

### 5. Document-First Interaction

- `isEditReady` default changed from `false` to `true`
- Sections are immediately editable when clicked in the document, without needing to toggle edit mode first
- Rail syncs to document selection; action bar updates; empty sections emphasize Add

### 6. Scoring Tests

- Added "Blank resume readiness — scoring credibility" test suite
- Tests: blank resume has low readiness, empty certifications/supporting evidence don't score 100%, readiness increases monotonically with content
- Updated `buildTestDraft` and `buildEmptyDraft` to include `certifications` and `supportingEvidence` fields

## Files Changed

| File | Nature of Change |
|------|-----------------|
| `packages/ui/src/resume-builder/utils/evidence-scoring.ts` | Reclassified empty optional sections; updated signatures for supportingEvidence |
| `packages/ui/src/resume-builder/components/LiveResumeCanvas.tsx` | Dynamic page boundary, InlineEditor hints/validation, contact warnings, onPageCountChange |
| `packages/ui/src/screens/ResumeBuilderScreen.tsx` | Phone formatting, email trimming, isEditReady default, preview multi-page, canvas page count |
| `packages/ui/src/resume-builder/__tests__/resume-builder-architecture.test.ts` | Blank resume scoring tests, updated test helpers |
| `packages/ui/src/screens/ResumeBuilderScreen.test.tsx` | Updated test draft with certifications/supportingEvidence |
| `app/globals.css` | Print CSS for new page model |
| `packages/ui/src/resume-builder/components/TopFixBanner.tsx` | Minor adjustment |

## Validation

- `pnpm lint`: warnings only (all pre-existing)
- `pnpm typecheck`: pre-existing errors only, no new errors from this pass
- `pnpm test`: 1567/1567 tests pass (519 in resume-builder architecture suite)

## Known Follow-ups

- Phone formatting only handles 10/11-digit US numbers; international format not supported
- Email validation is basic pattern match; could use more robust validation
- Page boundary calculation assumes single-column layout; complex layouts may need refinement
- Contact field dropdowns for citizenship and veteran status still use free text
- Print rendering uses CSS transform offset; native print pagination would be more robust
