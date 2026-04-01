# Resume Builder — Pagination Integrity Refactor

## What Changed

Refactored the Resume Builder from a continuous-canvas-with-overlays layout to a page-first rendering model where each page is a real DOM container.

## Why

The previous model rendered all resume content as one continuous column with absolutely-positioned page surface backgrounds and a single spacer injected post-hoc. This caused:

- Section selection chrome (borders, background tints) to visually cross page boundaries
- Action bars to straddle between pages
- Callout anchors to reference positions in a single continuous coordinate space that did not match the visual page break
- The spacer-based approach could only handle one page break location, limiting multi-page support
- Print/export relied on a separate measurement + clip approach that often drifted from the workspace view

## New Architecture

### Document Block Model (`document-block-types.ts`)
- Every rendered part of the resume is a typed `DocumentBlock` with metadata (sectionId, blockType, keepTogether, estimatedHeight, order)
- Blocks are built in canonical section order before rendering
- Work Experience decomposes into per-job-entry blocks for granular page splitting

### Pagination Engine (`pagination-engine.ts`)
- Deterministic: same inputs always produce same output, no DOM dependency
- Pipeline: build blocks → estimate heights → assign blocks to pages
- Rules: atomic sections (contact, summary, education, etc.) never split; experience splits only at job boundaries
- Safety margin absorbs height estimation drift

### Page-First Canvas (`LiveResumeCanvas.tsx`)
- Each page renders as a real DOM container with paper styling
- Content blocks render INSIDE their assigned page surface
- Selection chrome, action bars, and anchors are page-local by construction
- Experience can span pages with "continued" label on page 2+

### Preview/Export Alignment (`ResumeBuilderScreen.tsx`)
- Preview overlay uses the same pagination engine
- Page count matches between workspace and preview
- Print CSS updated for page-break-before on page 2+ surfaces

## Files Changed

| File | Change |
|------|--------|
| `packages/ui/src/resume-builder/types/document-block-types.ts` | NEW — Block model types and page constants |
| `packages/ui/src/resume-builder/utils/pagination-engine.ts` | NEW — Deterministic pagination pipeline |
| `packages/ui/src/resume-builder/components/LiveResumeCanvas.tsx` | MODIFIED — Page-first rendering, removed old overlay model |
| `packages/ui/src/resume-builder/index.ts` | MODIFIED — Added barrel exports for new modules |
| `packages/ui/src/screens/ResumeBuilderScreen.tsx` | MODIFIED — Preview uses pagination engine |
| `app/globals.css` | MODIFIED — Print CSS for page-first model |
| `packages/ui/src/resume-builder/__tests__/pagination-engine.test.ts` | NEW — 43 tests for pagination logic |

## Pagination Rules (v1)

- **Never split across pages**: Contact, Summary, Education, Certifications, Skills, Federal Details, Supporting Evidence
- **Split only at job boundaries**: Work Experience
- **Single job entry**: Never torn across pages
- **Selection chrome**: Stays inside the page surface that owns the block
- **Action bars**: Render inside the correct page-local wrapper

## Testing

43 new tests covering:
- Block ordering (canonical section order)
- Pagination assignment (blocks fit on pages)
- keepTogether behavior (atomic sections never split)
- Job-boundary splitting (experience splits only between jobs)
- Page count growth as content increases
- Block grouping for rendering
- Height estimation sanity
- Determinism (same input → same output)

## Known Follow-ups

1. Post-render height correction — measure actual heights after DOM paint and re-paginate if drift exceeds threshold
2. Experience mid-section continuation — show a partial section border on page 2 continuation
3. Federal details in preview — include federal details in the preview renderer
4. Callout line coordinate system — update callout lines to work correctly with page-local anchors across pages
5. Print/export may need fine-tuning for exact page-break alignment with browser @page rules
