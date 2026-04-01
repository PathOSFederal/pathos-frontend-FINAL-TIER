# Change Brief — Deterministic PDF Visual Parity

## What changed

The deterministic PDF export now produces output that visually matches the cleaner
browser-print reference. Previously, the exported PDF looked compressed — the header
felt cramped, sections were jammed together, and work experience entries ran into each
other. Now the exported PDF has professional spacing that matches the print-style layout.

## Why this matters

The deterministic PDF export is the primary export path. It produces clean, metadata-free
PDFs without browser-injected headers, footers, URLs, or page titles. But it needs to
look as good as — or better than — the browser-print fallback. Before this change, users
would notice the deterministic PDF felt "denser" and less polished than printing from
the browser preview.

## What users will notice

- **More breathing room at the top of each page** — the name and contact block sit
  lower on the page, matching the print reference feel
- **Cleaner separation between resume sections** — Work Experience, Education,
  Certifications, and Skills are clearly separated from each other
- **Work Experience entries breathe** — each job entry has clear space between it
  and the next, making the resume easier to scan
- **Better page 2 start** — content transitions to page 2 more naturally, without
  the feeling of being mechanically chopped
- **No change to export behavior** — the same "Export Resume PDF" button produces
  the PDF. The file is still metadata-free, ATS-safe, and deterministic

## What did not change

- The browser print fallback still works the same way
- The preview overlay is unchanged
- The live canvas editing experience is unchanged
- Section order, content, and text are identical
- One-page, two-page, and three-page exports all still work correctly

## Technical summary

- Tuned 12 spacing constants in the PDF renderer for visual parity with the
  browser-print reference
- Increased the pagination engine's safety margin from 48px to 72px so the engine
  allocates slightly fewer blocks per page, giving the PDF renderer room for its
  more generous spacing and improving page-break pacing
- Added 17 new tests verifying the specific spacing values, margin budget integrity,
  visual hierarchy relationships, and export wiring correctness

---

*April 2026*
