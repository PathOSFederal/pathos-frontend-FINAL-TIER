# Change Brief — Resume Builder Editor-Integrity Pass

**Date:** 2026-03-31
**Branch:** `feature/resumeBuilderv2`
**Status:** Complete (not committed)

## Goal

Make the Resume Builder behave like a trustworthy document editor before adding deeper AI layers. The builder previously broke under real editing use: multi-entry editing was unstable, document flow was absent, new resume creation gave wrong choices, validation trapped users, and print/export produced blank pages.

## Core Decisions

1. Center pane remains the source of truth
2. Every section and item must be directly editable
3. Every user-created item must have a visible removal path
4. Document content must flow across pages with visual indicators
5. Mode system must be understandable and escapable
6. Export/preview must reflect actual rendered content

## Changes

### 1. New Resume Creation Flow
- Replaced single-option new-resume modal with two clear choices: "Start from Default Resume" (clones current draft) and "Start blank from federal template" (creates empty scaffold with standard section structure)
- New resumes immediately become the active/selected version

### 2. Document Flow & Page-Break Indicators
- Added `PageBreakIndicator` component using `ResizeObserver` to measure rendered document height
- Renders dashed lines with "Page X" labels at each page boundary (based on 976px US Letter equivalent)
- Dynamically updates as content is added/removed

### 3. Complete Add/Remove for All Sections
- Every experience entry has a "Remove job" button and each bullet has a "Remove bullet" button
- Each experience section has an "Add Bullet" button
- Education, certifications, and supporting evidence entries each have individual "Remove" buttons
- `onRemoveItem` callback introduced in `LiveResumeCanvas` for clean data flow to parent

### 4. Section-Specific Action Labels
- Replaced generic "Add here" with contextual labels: "Add Job", "Add Education", "Add Certification", "Add Skill", "Add Evidence"

### 5. Validation Mode Escape
- Added "Back to Editing" button within validation preflight area
- Clicking resets `builderStage` to `'partial'`, providing clear exit from validation

### 6. Export/Preview Fix
- Fixed `@media print` CSS that was hiding `#__next` (making preview blank)
- Now hides only specific app chrome elements while preserving the resume render surface
- Added `page-break-inside: avoid` for content sections

### 7. Resume Review Modal Refinement
- Centered modal vertically (`items-center` instead of `items-start`)
- Increased max height for workspace feel

### 8. Version Label Fix
- Changed "Saved draft" autosave label to "Draft snapshot — [date]" for clarity

## Files Touched

| File | Nature of Change |
|------|-----------------|
| `app/globals.css` | Fixed print CSS, added page-break rules |
| `packages/ui/src/screens/ResumeBuilderScreen.tsx` | New resume flow, validation exit, remove handler, modal fix, version label |
| `packages/ui/src/resume-builder/components/LiveResumeCanvas.tsx` | Add/remove buttons, PageBreakIndicator, section labels |

## Validation

- `pnpm lint` — pass (0 errors)
- `pnpm typecheck` — pre-existing errors only
- `pnpm test` — 1561 passed, 0 failures

## Known Follow-Ups

- Pre-existing typecheck errors in test fixtures
- Field-level inline editing granularity for experience entries
- Individual skill chip removal
- PathAdvisor conversation integration in review modal
- Top-bar page budget should derive from measured page count
- "Strengthen" / "Compress" need AI backend
