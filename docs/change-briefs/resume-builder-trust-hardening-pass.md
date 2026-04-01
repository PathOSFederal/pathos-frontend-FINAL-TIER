# Change Brief: Resume Builder Trust-Hardening Pass

**Date**: 2026-03-31
**Branch**: `feature/resumeBuilderv2`
**Status**: Unstaged, not committed

## Objective

Make the Resume Builder honest, predictable, and production-shaped by fixing
export correctness, version behavior, naming clarity, and Resume Review structure.

## Changes

### 1. Resume-Only Export Path

**Problem**: `window.print()` exported the entire PathOS application UI, including
navigation, sidebar, builder controls, callout lines, and overlays.

**Fix**: Added `@media print` CSS rules in `app/globals.css` that:
- Hide all page content by default (`body > *` display: none)
- Set white background on html/body for clean PDF rendering
- Show only the `[data-testid="resume-preview-overlay"]` container
- Strip card styling (shadows, rounded corners, margins) from the document

Export buttons renamed from "Print / Save as PDF" and "Export JSON" to
"Export Resume PDF" and "Export Resume JSON" for clarity.

### 2. Resume Review Evolution

**Problem**: The Review Resume modal was a static card-like overlay that felt
like a dead-end information dump rather than a workspace.

**Fix**: Restructured `FullDocumentReview` into a conversation workspace:
- Pinned header with title
- Scrollable body with compact review summary (readiness, strongest, blocker, federal)
- Recommended next steps list
- Review conversation thread area with honest PathAdvisor placeholder
- Bottom-pinned composer area — clearly disabled with "Coming soon" label
- No dead inputs pretending to be functional

### 3. Version Switching Behavior

**Problem**: "Save current changes and switch" created a version labeled
"Auto-save before switch." Switching back to Default Resume did not restore
the original draft content. The top selector label never updated.

**Fix**:
- Added `masterDraftBackupRef` to snapshot the default resume draft before
  the user switches away for the first time
- "Save and switch" now handles Default Resume correctly by restoring from backup
- "Discard and switch" to Default Resume restores the original draft
- Version label for saved drafts uses timestamped name instead of "Auto-save"

### 4. Naming Cleanup

**Problem**: "Master Resume" is jargon-heavy. "Auto-save" appeared as a
visible version name, confusing users about what it represented.

**Fix**:
- "Master Resume" → "Default Resume" everywhere (dropdown, top bar, stage
  types, legacy code, tests)
- "Auto-save before switch" → "Saved draft — [timestamp]"
- "Auto-saves" → "Changes saved locally"

### 5. Dynamic Resume Label

**Problem**: The top bar selector always showed "Master Resume" regardless
of which version was active.

**Fix**: Computed `activeResumeLabel` from `selectedResumeId` and the
versions list. Shows the actual version name when a saved version is active.

### 6. Interaction State Audit

Fixed NewResumeModal Cancel and Create buttons to include `INTERACTIVE_HOVER_CLASS`
and `focus-visible:ring-2`. Changed input focus from `:focus` to `:focus-visible`.

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| `app/globals.css` | +67 | Print CSS for resume-only export |
| `packages/ui/src/screens/ResumeBuilderScreen.tsx` | ~180 net | All behavioral fixes |
| `packages/ui/src/resume-builder/components/ResumeBuilderTopBar.tsx` | ~4 | Naming |
| `packages/ui/src/resume-builder/types/stage-types.ts` | ~4 | Naming |
| `packages/ui/src/resume-builder/__tests__/resume-builder-architecture.test.ts` | ~1 | Test assertion |

## Validation

- `pnpm lint` — no new errors (pre-existing: 15 errors, 104 warnings)
- `pnpm typecheck` — no new errors (pre-existing: 36 errors in test files)
- `pnpm test` — 1561/1561 passed across 64 test files

## Risks and Follow-ups

- `@media print` rules target `data-testid` attributes — if test IDs change,
  print export breaks. Consider adding dedicated `data-print` attributes.
- `masterDraftBackupRef` is a React ref, not persisted to localStorage.
  If the page refreshes while on a version, the backup is lost. Consider
  storing backup in the core store model.
- Review conversation composer is disabled — must be wired when PathAdvisor
  LLM layer is ready.
