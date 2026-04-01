# Resume Builder — Single Print Root Fix

## What Changed

The Resume Builder's "Export Resume PDF" feature now produces exactly the
intended number of pages — no more duplicate or fragmented content after
the real resume pages.

## Why

When a user clicked "Export Resume PDF", the browser print output contained
5 pages instead of the intended 2:
- Pages 1–2 were the correct resume (from the print portal)
- Pages 3–5 were duplicated/fragmented resume content (from the preview overlay)

The on-screen preview overlay (position:fixed) was rendering resume pages
for visual review AND the print portal was rendering the same pages for
print. Browser print engines (Chrome, Edge) have a known quirk where
position:fixed elements can escape an ancestor's display:none during print,
so the preview overlay's content leaked into the printed output.

## What Was Done

Three layers of defense were added to ensure exactly one printable resume
tree exists at export time:

1. **Explicit print CSS** — The preview overlay is now directly targeted by
   `@media print` rules using `[data-testid="resume-preview-overlay"]` and
   `[data-print-hide]` selectors, forcing display:none regardless of browser
   quirks with position:fixed.

2. **Scoped overflow rule** — The previous wildcard `* { overflow:visible }`
   in print CSS was replaced with `#resume-print-root *` to prevent the
   aggressive overflow from interfering with display:none on hidden elements.

3. **Dev-mode assertion** — `assertSinglePrintableRoot()` runs before
   `window.print()` in development mode and warns if multiple printable
   roots (`[data-resume-print-source]`) exist.

## Architecture

- The **print portal** (`#resume-print-root`) is the sole source of printed
  content. It renders via React portal directly into document.body.
- The **preview overlay** shows resume pages on screen for visual review but
  is explicitly excluded from print via three CSS layers.
- Both Ctrl+P and "Export Resume PDF" use the same single-source strategy.

## Browser Headers/Footers

Browser-added headers/footers (date, URL, page title) are controlled by the
browser's print dialog settings, not by app code. The existing UX tip about
unchecking "Headers and footers" remains unchanged.

## Files Changed

| File | What |
|------|------|
| `app/globals.css` | Added explicit preview overlay print-hide rule; scoped overflow to print root |
| `packages/ui/src/screens/ResumeBuilderScreen.tsx` | Added data-print-hide, data-resume-print-source, print:hidden class, dev assertion |
| `packages/ui/src/screens/ResumeBuilderScreen.test.tsx` | Added 8 new single-printable-root invariant tests |

## Testing

- 161 ResumeBuilderScreen tests pass (including 8 new)
- 626 resume-builder architecture/pagination tests pass (no regression)
- All 787 tests pass across changed suites
- No new lint errors introduced
- Pre-existing typecheck errors in unrelated test files unchanged
