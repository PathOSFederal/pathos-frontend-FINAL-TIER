# Change Brief — Deterministic PDF Final Visual-Parity Pass

## What happened

The deterministic PDF export now produces output that is visibly closer to the
print-reference resume (testResume3.pdf). Eleven spacing tokens were tuned
upward and one new token was added to handle page-2+ top breathing room. The
changes affect only the PDF renderer's spacing constants — no architecture,
scoring, editor workflow, or browser-print fallback changes.

## Why

After the previous pass, the exported PDF was structurally correct (right
section order, right page count, text-based/ATS-safe) but still looked
noticeably more cramped than the print reference. The header block felt tight,
work experience entries were jammed together, section transitions were abrupt,
and page 2 opened without comfortable top spacing. This pass closes that
visual gap.

## What changed

### Header rhythm
- **Name to contact gap** increased from 6pt to 8pt — the large bold name now
  has generous separation from the smaller contact details below.
- **Contact to citizenship gap** increased from 3pt to 4pt — the citizenship
  line reads as a distinct sub-line.
- **Citizenship to rule gap** increased from 8pt to 10pt — the header block
  has a clean, finished bottom edge.
- **Rule to first section gap** increased from 14pt to 18pt — the single
  most impactful change for eliminating the "cramped page 1" feel.

### Work Experience density
- **Job title to employer row** increased from 3pt to 4pt — cleaner pairing.
- **Employer to first bullet** increased from 5pt to 6pt — metadata rows
  are visually separated from accomplishment bullets.
- **Between experience entries** increased from 12pt to 15pt — each entry
  now occupies its own visual territory.
- **Between bullets** increased from 2pt to 3pt — individually scannable.

### Section rhythm
- **Section gap** increased from 22pt to 24pt — deliberate, calm transitions.
- **Heading to underline** increased from 5pt to 6pt — cleaner heading geometry.
- **Underline to body** increased from 10pt to 12pt — heading reads as a clear
  label for the content below.

### Page 2+ opening
- **New: PAGE_CONTINUATION_TOP_EXTRA_PT = 6pt** — pages after page 1 get
  extra top padding so continuation sections don't start abruptly. Page 1
  has the contact block for natural breathing; page 2+ now matches that feel.

## What did not change

- Pagination engine logic and safety margin (PAGE_SAFETY_MARGIN_PX stays at 72px)
- Section order, scoring, PathAdvisor behavior, or editor workflow
- Browser-print fallback
- ATS safety (still text-based, selectable, no rasterization)
- Page count parity between preview and export

## Validation

- 55 PDF export tests passed (3 new: continuation padding tests)
- 48 pagination engine tests passed (no regression)
- 686 resume-builder tests passed across 5 test files
- 169 ResumeBuilderScreen tests passed
- Page-count parity confirmed for 1-page, 2-page, and 3-page examples
- Canonical section order preserved
- No duplicate pages or blocks
- No linter errors on modified files
