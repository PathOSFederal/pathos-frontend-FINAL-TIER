# Resume Builder — Multi-Page Rendering Parity Hardening

## What Changed

Hardened the page-first Resume Builder so that all document surfaces — live editor canvas, review modal, and print/export — use the same multi-page rendering contract. Fixed four trust-breaking defects that remained after the initial pagination-integrity refactor.

## Why

The page-first pagination engine was architecturally correct, but the review modal and print surfaces had not been updated to consume its output. Users saw split words in review, only page 1 in print, missing callout lines on subsequent pages, and text overflow in the canvas. These inconsistencies undermined trust in the document.

## Defects Fixed

### 1. Text Wrapping

**Before**: Long unbroken strings (URLs, long words) overflowed the page surface boundary, extending beyond the visible page.

**After**: Page surface containers on all three surfaces apply `overflow-wrap: break-word` and `word-break: break-word`, ensuring text wraps within the page column.

### 2. Review Modal Page Boundaries

**Before**: `ResumePreviewOverlay` rendered the entire resume as one continuous block and used CSS `overflow: hidden` with `translateY` to clip it into pseudo-pages. This caused words to split at arbitrary pixel boundaries.

**After**: `ResumePreviewOverlay` consumes the `PaginatedDocument` from the pagination engine and renders each `DocumentPage` as a distinct DOM container showing only its assigned blocks. Pages are visually separated with labeled boundaries. Continuation headers ("Work Experience (continued)") appear automatically.

### 3. Print / Export Parity

**Before**: Print CSS hid pages beyond page 1 (`print:hidden`). No `page-break-before` rules existed. Scrollbar artifacts and app chrome could appear in print output.

**After**: `@media print` rules now target the page-first structure. All pages are visible. Page 2+ gets `page-break-before: always`. App chrome, page boundary labels, and scrollbars are suppressed. Page surfaces render edge-to-edge with clean document margins.

### 4. Multi-Page Callout Coverage

**Before**: `useCalloutLines` measured anchor positions once synchronously. When the pagination engine added a second page, the new DOM surfaces mounted asynchronously and their anchor elements were not discovered until the user scrolled or resized.

**After**: `useCalloutLines` uses a two-phase delayed remeasure (50ms + 200ms) to discover anchors after multi-page DOM renders. An explicit remeasure trigger fires when `canvasMeasuredPageCount` changes.

## Files Changed

| File | Change |
|------|--------|
| `LiveResumeCanvas.tsx` | Added text wrapping CSS to page surface |
| `ResumeBuilderScreen.tsx` | Refactored `ResumePreviewOverlay` to true per-page rendering; added page-count remeasure trigger |
| `globals.css` | Rewrote `@media print` rules for page-first model |
| `useCalloutLines.ts` | Two-phase delayed remeasure for multi-page anchor discovery |
| `resume-builder-architecture.test.ts` | +15 new tests for multi-page parity |

## Testing

15 new tests added covering:
- Multi-page pagination produces correct page count and block distribution
- All sections represented across pages
- Block grouping and section heading identification
- Sequential page numbering and total block count preservation
- Page content height stays within effective page area
- Canonical overview targets map to document section IDs
- Sections on page 2 remain discoverable via sectionId
- Long text and long unbroken words do not crash pagination
- Preview page-first contract: each page renders only its assigned blocks

## Known Follow-ups

1. Post-render height correction for estimation drift
2. Federal details in preview renderer
3. Exact `@page` margin fine-tuning for different paper sizes
4. Pre-existing typecheck errors in test fixtures need separate cleanup
