# Change Brief: Deterministic PDF Export for Resume Builder

## What changed

The Resume Builder's "Export Resume PDF" button now generates a PDF directly from the application, instead of opening the browser's print dialog. The exported PDF contains only the resume — no browser-injected dates, URLs, page titles, or headers/footers.

## Why

The previous export relied on the browser's print dialog (`window.print()`), which had several trust-breaking issues:

- Browsers inject metadata (date, URL, page title) around the resume
- Browser print dialog settings vary across users, browsers, and operating systems
- Browser print preview could show a different number of pages than the app's preview
- No way to programmatically remove browser chrome from the printed output

These issues undermined the Resume Builder's deterministic export fidelity requirement.

## How it works now

1. The user clicks **Export Resume PDF** in the preview overlay
2. The application generates the PDF directly using the same page model that drives the on-screen preview
3. The PDF downloads as a file — no browser dialog appears
4. The PDF contains only resume content: clean, selectable, ATS-readable text
5. Page count in the PDF matches the app's preview exactly (1 page, 2 pages, or more)

## What about browser print?

Browser print is still available as a clearly labeled fallback ("Print" button) next to the primary export button. This is useful if the user needs to print on paper or prefers the browser print dialog for any reason.

## What the user sees

- **Export Resume PDF** button — generates and downloads a clean PDF directly
- **Print** button — falls back to browser print dialog (clearly labeled as secondary)
- A hint line: "PDF export generates a clean file directly — no browser dialog needed."
- If the PDF export fails for any reason, an error message appears with guidance to use the Print fallback

## ATS safety

The exported PDF uses real text (not screenshots or images). All resume content is selectable and searchable, preserving compatibility with Applicant Tracking Systems.

## Limitations

- The PDF uses standard Helvetica font. Custom fonts are not supported in this version.
- Very long duty bullets may wrap slightly differently between the on-screen preview and the PDF due to differences between CSS text layout and PDF text layout. Content integrity is preserved.
- The browser print fallback still shows browser-injected metadata if the user does not disable "Headers and footers" in their print dialog.

## Files involved

- `packages/ui/src/resume-builder/utils/pdf-export.ts` — new PDF export module
- `packages/ui/src/resume-builder/index.ts` — barrel exports for the new module
- `packages/ui/src/screens/ResumeBuilderScreen.tsx` — UI wiring and updated export flow
- `packages/ui/src/resume-builder/__tests__/pdf-export.test.ts` — 22 new tests
- `package.json` / `pnpm-lock.yaml` — jsPDF dependency added
