# Resume Builder — Behavior Tightening

**Date:** March 31, 2026
**Branch:** feature/resumeBuilderv2
**Type:** Behavior refinement (not a redesign)

---

## What changed

### 1. Section statuses are now easier to understand

The left rail used to show a single combined label like "Filled · Fair" that was ambiguous — the user could not tell whether the number referred to field completion or readiness.

Now each section shows up to three separate lines:
- **Completion state**: Not started, Incomplete, Mostly filled, or Fields complete
- **Quality/readiness state**: Strong, Fair, or Needs work
- **Issue count**: "1 issue", "2 issues", etc. (only shown when issues exist)

Each line answers one question. The user does not have to infer what a number or label means.

### 2. Work Experience fields can now be edited directly

Previously, only bullet descriptions could be edited inline. The job title, employer, date range, and hours per week were static text with no way to change them directly on the resume.

Now all key Work Experience subfields are directly editable:
- **Job title** — click to edit inline
- **Employer / agency** — click to edit inline
- **Date range** (start – end) — click to edit inline
- **Hours per week** — click to edit inline
- **Bullet descriptions** — already supported, unchanged

Each field shows a subtle hover affordance (pencil icon) when the section is selected. Fields are keyboard reachable with focus-visible treatment.

### 3. Callout lines now route more cleanly

Callout lines used to always route from the right edge of every anchor to the right side of the document. When an anchor sat on the left side of the resume, the line would cross the entire document body — breaking the precision-overlay feel.

Now the routing is side-aware:
- Anchors in the left portion of the document route lines to the left side
- Anchors in the right portion route to the right side (default behavior)
- Lines no longer cross large portions of the resume unnecessarily

### 4. Applying suggestions now visibly updates the resume and confirms what changed

Previously, clicking "Apply" on a suggestion updated the document but gave no clear feedback. The user could not tell whether anything happened.

Now after applying a suggestion:
- The relevant text in the document changes immediately
- The annotation is marked as resolved — it disappears from the callout system
- Section status in the rail updates (fewer issues, better health)
- Overall readiness score in the top bar updates
- A brief green confirmation toast appears ("Suggestion applied — [label]")
- The toast auto-dismisses after 3 seconds

### 5. Overall readiness score is now coherent with section statuses

The readiness score in the top bar used to be derived from coverage dimensions + an arbitrary boost. It could show "78% ready" while section statuses told a different story.

Now the readiness score is derived directly from the visible section progress — the same data that drives the rail badges. If three sections are "Complete / Strong" and five are "Not started", the score reflects that honestly.

---

## What did not change

- Document-centered layout
- Overview mode
- Section selection behavior
- Callout attachment to scroll/document
- Endpoint click → guidance card
- Section-aware filtering
- Summary editing
- Contact editing
- Federal details editing
- Target-job switching
- PathAdvisor shell
- "Edit First" workflow (now also navigates to the correct section)

---

## Testing

New tests added covering:
- `issueCountLabel` produces unambiguous "N issues" strings
- `deriveOverallReadiness` produces section-coherent readiness scores
- Section status labels are all distinct (completion ≠ quality ≠ issues)
- Callout line geometry includes side-aware routing field
- Applying a suggestion marks the annotation resolved and updates counts
- Section progress improves when annotations are resolved

All 396 tests pass.
