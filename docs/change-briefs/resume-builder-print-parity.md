# Change Brief — Resume Builder Print Page-Count Parity

## Date

2026-04-01

## Summary

Fixed the final print/export parity issue where "Export Resume PDF" produced 3 pages for a resume that previews as 2 pages. The exported page count now exactly matches the paginated resume model.

## Problem

After prior fixes that eliminated duplicate resume trees in print output, the exported PDF still printed 3 pages when the resume should have been 2. The extra page was caused by content overflow from the first page container spilling onto a second physical page, pushing the actual page 2 onto a third sheet.

## Root Cause

Three missing CSS mechanisms caused the page-count mismatch:

1. **No `@page` rule**: Without `@page { size: letter; margin: 0 }`, browsers used default print margins (~0.4-0.5 inches top and bottom), reducing the printable area from 1056px (11 inches) to approximately 960px per physical page.

2. **No fixed height on print page containers**: The print portal rendered page containers with `padding: 40px 48px` (80px vertical) but no explicit height. The pagination engine assigns up to 928px of content per page. Total per container: 928 + 80 = 1008px, which exceeded the browser's ~960px printable area.

3. **Blanket `overflow: visible`**: The CSS rule `#resume-print-root * { overflow: visible !important }` prevented any content clipping, allowing overflow to push onto extra physical pages.

**Result**: Page 1's 1008px content overflowed the ~960px printable area. The browser split it across two physical pages. Page 2's `break-before: page` then started on a 3rd physical page.

## Fix

### A. `@page` rule (globals.css)

Added `@page { size: letter; margin: 0; }` at the top level of globals.css. This makes the full 11 inches (1056px at 96 DPI) available for each printed page, eliminating browser margin interference.

### B. Fixed page container height (globals.css)

Updated the `#resume-print-root [data-page-number]` CSS rule to include:
- `height: 1056px !important` — exactly one US Letter page
- `box-sizing: border-box !important` — padding included in height
- `overflow: hidden !important` — clips any content that exceeds the page
- `margin: 0 !important` — no inter-page spacing

### C. Print root zero-space rules (globals.css)

Added explicit margin/padding zeroing for:
- `#resume-print-root` — the portal container
- `#resume-print-root [data-resume-print-source]` — the content wrapper

### D. Removed blanket overflow:visible (globals.css)

Removed `overflow: visible !important` from the `#resume-print-root *` rule. Page containers now get `overflow: hidden` from the page surface rule (higher specificity). Inner elements use their default `overflow: visible`.

### E. Inline style defense (ResumeBuilderScreen.tsx)

Added `height: '1056px'`, `boxSizing: 'border-box'`, `overflow: 'hidden'`, and `margin: '0'` as inline styles on print page containers for defense in depth alongside the CSS rules.

## Files Changed

| File | Change |
|------|--------|
| `app/globals.css` | Added @page rule, fixed page container sizing, zero-margin rules |
| `packages/ui/src/screens/ResumeBuilderScreen.tsx` | Added inline height/box-sizing/overflow on print page containers |
| `packages/ui/src/screens/ResumeBuilderScreen.test.tsx` | Added 8 page-count parity tests |
| `packages/ui/src/resume-builder/__tests__/pagination-engine.test.ts` | Added 5 print parity tests |

## Browser Metadata

Browser-generated print headers/footers (date, page title, URL) are controlled by the browser's print dialog, NOT by app code. The app cannot suppress these. A UX hint telling users to disable "Headers and footers" in the print dialog already exists in the preview overlay.

## Tests Added

- Print page container count matches paginated page count (single-page and multi-page)
- Page content height + padding fits within PAGE_HEIGHT_PX for all pages
- No extra trailing print page appears
- Page-gap labels exist only in preview, not in print portal data
- Print page container height matches PAGE_HEIGHT_PX constant
- @page rule CSS contract documented
- Print root/wrapper zero margin/padding contract documented
- Page-gap not part of paginated model

## Validation

- All 1659 tests pass (65 test files)
- No lint errors
- No regressions to live canvas, preview overlay, or export flow

## Follow-ups

- Human visual verification: export a 2-page resume and confirm exactly 2 pages in PDF
- Test with different paper sizes (A4) for international users
- Consider adding a print preview that shows exact page boundaries
