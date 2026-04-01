# Resume Builder — Clean Print/Export Path

## What Changed

The Resume Builder's "Export Resume PDF" feature now produces a clean resume
document instead of a printed screenshot of the application.

## Why

When a user clicked "Export Resume PDF", the browser's print dialog showed:
- Only the first page of a multi-page resume
- App UI elements like the sidebar, top bar, buttons, and scrollbar
- The dark overlay background from the preview modal

This made the export unusable as a professional resume document.

## What Was Done

A **dedicated print root** was created that renders only the resume pages
directly into the HTML body, completely outside the app's interface. When
the browser prints, it now sees only the resume content — nothing else.

Key improvements:
1. **All pages print** — a 2-page or 3-page resume now exports all pages
2. **No app chrome** — no sidebar, buttons, overlays, or scrollbar in output
3. **Clean page breaks** — page 2+ starts on a new sheet automatically
4. **Same content** — the printed pages use the same data as the on-screen preview

## Browser Headers/Footers

The date, URL, and page title that may appear at the top/bottom of printed
pages are **controlled by the browser**, not by the app. The app cannot
remove them.

To get a completely clean PDF:
- In the browser's print dialog, uncheck **"Headers and footers"**
- This option is available in Chrome, Edge, Firefox, and most browsers

A small tip about this is now shown in the preview near the export button.

## Files Changed

| File | What |
|------|------|
| `ResumeBuilderScreen.tsx` | Added print portal rendering |
| `globals.css` | Rewrote print CSS rules |
| `ResumeBuilderScreen.test.tsx` | Added 13 print-related tests |

## Testing

- 153 tests pass (including 13 new print tests)
- 43 pagination engine tests pass (no regression)
- TypeScript typecheck passes (no new errors)
