# Merge Notes — Resume Builder v2

---

## Run: PathAdvisor Conversation API Wiring v1 (2026-04-03)

### Branch

`feature/pathadvisor-conversation-api-wiring-v1`

### Summary

Replaced the temporary local PathAdvisor conversation reply bridge with a real
frontend-to-backend conversation path. The shared dashboard rail now sends the
composer message plus bounded structured governed context through a same-origin
conversation proxy route, receives a backend reply, and keeps the governed
panel visible as the evidence surface.

### Why this change was made

The local conversation bridge was acceptable as a placeholder, but it still let
the frontend act like a second reasoning engine. This slice restores the proper
architecture: the frontend assembles bounded request context only, while the
backend conversation layer produces the conversational explanation.

### Files changed

- `app/(shared)/dashboard/_components/SharedDashboardRouteShell.tsx`
- `app/api/pathadvisor/_shared.ts`
- `app/api/pathadvisor/conversation/route.ts`
- `lib/pathadvisor-governed/client.ts`
- `lib/pathadvisor-governed/client.test.ts`
- `lib/pathadvisor-governed/conversation-context.ts`
- `lib/pathadvisor-governed/conversation-context.test.ts`
- `packages/ui/src/index.ts`
- `packages/ui/src/shell/PathAdvisorCard.tsx`
- `packages/ui/src/shell/PathAdvisorCard.test.tsx`
- `packages/ui/src/shell/PathAdvisorRail.tsx`
- `packages/ui/src/shell/pathadvisor-governed-types.ts`
- `docs/change-briefs/pathadvisor-conversation-api-wiring-v1.md`

### Behavior changes

- Governed-mode composer now sends through `/api/pathadvisor/conversation`
  instead of using a local reply generator.
- Added a thin frontend proxy route for PathAdvisor conversation that validates
  a bounded structured payload before forwarding to the backend.
- `conversation-context.ts` now remains request assembly only and no longer
  generates frontend replies.
- The conversation shell now shows a distinct loading state while the backend
  conversation request is in flight.
- A conversation technical failure now shows as a separate conversation-layer
  error without blurring governed refusal or governed panel error states.
- The governed panel remains visible and unchanged as the structured evidence
  surface.

### Validation performed

- `pnpm test -- packages/ui/src/shell/PathAdvisorCard.test.tsx packages/ui/src/shell/PathAdvisorGovernedPanel.test.tsx lib/pathadvisor-governed/client.test.ts lib/pathadvisor-governed/conversation-context.test.ts`
  - 25 tests passed
- `pnpm eslint 'app/(shared)/dashboard/_components/SharedDashboardRouteShell.tsx' 'app/api/pathadvisor/_shared.ts' 'app/api/pathadvisor/conversation/route.ts' 'packages/ui/src/shell/PathAdvisorCard.tsx' 'packages/ui/src/shell/PathAdvisorCard.test.tsx' 'packages/ui/src/shell/PathAdvisorRail.tsx' 'packages/ui/src/shell/PathAdvisorGovernedPanel.tsx' 'packages/ui/src/shell/PathAdvisorGovernedPanel.test.tsx' 'packages/ui/src/shell/pathadvisor-governed-types.ts' 'packages/ui/src/index.ts' 'lib/pathadvisor-governed/client.ts' 'lib/pathadvisor-governed/client.test.ts' 'lib/pathadvisor-governed/conversation-context.ts' 'lib/pathadvisor-governed/conversation-context.test.ts'`
  - no errors, no warnings in touched files
- `pnpm typecheck`
  - failed due to pre-existing resume-builder test/type errors unrelated to this slice
  - after fixing the one new proxy-helper type issue, no remaining typecheck errors came from the touched PathAdvisor files
- `pnpm lint`
  - failed due to pre-existing repo-wide lint issues in resume-builder, desktop, and other legacy areas unrelated to this slice

### Known risks / follow-ups

- The backend conversation contract was not documented in this frontend repo, so
  the response adapter is intentionally strict and will fail honestly if the
  backend returns an unexpected shape.
- This slice still does not add memory, thread persistence, or a broader chat
  system.
- Mobile sanity was reviewed at the code/layout level only. The composer and
  governed panel still use the existing shared rail layout and no new fixed-width
  assumptions were added.

### git status

```text
On branch feature/pathadvisor-conversation-api-wiring-v1
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
  modified:   app/(shared)/dashboard/_components/SharedDashboardRouteShell.tsx
  modified:   app/api/pathadvisor/_shared.ts
  modified:   docs/merge-notes/current.md
  modified:   lib/pathadvisor-governed/client.test.ts
  modified:   lib/pathadvisor-governed/client.ts
  modified:   lib/pathadvisor-governed/conversation-context.test.ts
  modified:   lib/pathadvisor-governed/conversation-context.ts
  modified:   packages/ui/src/index.ts
  modified:   packages/ui/src/shell/PathAdvisorCard.test.tsx
  modified:   packages/ui/src/shell/PathAdvisorCard.tsx
  modified:   packages/ui/src/shell/PathAdvisorRail.tsx
  modified:   packages/ui/src/shell/pathadvisor-governed-types.ts

Untracked files:
  (use "git add <file>..." to include in what will be committed)
  app/api/pathadvisor/conversation/
  docs/change-briefs/pathadvisor-conversation-api-wiring-v1.md

no changes added to commit (use "git add" and/or "git commit -a")
```

### git branch --show-current

```text
feature/pathadvisor-conversation-api-wiring-v1
```

### git diff --name-status develop...HEAD

```text
(no output)
```

### git diff --stat develop...HEAD

```text
(no output)
```

### Patch artifacts

Note: `git diff develop...HEAD` is empty because this slice remains uncommitted
in the working tree. The incremental artifact contains the actual working-tree
diff for this run.

```text
-rwxrwxrwx 1 joriel joriel 0 Apr  3 10:42 artifacts/pathadvisor-conversation-api-wiring-v1.patch
-rwxrwxrwx 1 joriel joriel 51K Apr  3 10:42 artifacts/pathadvisor-conversation-api-wiring-v1-this-run.patch
```

---

## Run: PathAdvisor Conversational Shell Restoration (2026-04-03)

### Branch

`feature/pathadvisor-conversational-shell-restoration-v1`

### Summary

Restored a visible conversational PathAdvisor entry point in the shared
dashboard rail while keeping the governed panel as the structured evidence
surface. The rail now:

- shows a lightweight conversation surface again in the Guidance view
- keeps the governed panel visible underneath the conversation layer
- restores the composer in governed mode
- assembles future conversation context from structured governed state only
- preserves the existing trust-state distinctions and refresh stability

### Why this change was made

The governed integration and trust-state rendering were correct, but the rail
had drifted too far toward a governed-results inspector. This slice restores the
intended PathAdvisor product posture: conversational on top, governed evidence
underneath, with no weakening of the backend truth boundary.

### Files changed

- `app/(shared)/dashboard/_components/SharedDashboardRouteShell.tsx`
- `packages/ui/src/shell/PathAdvisorCard.tsx`
- `packages/ui/src/shell/PathAdvisorCard.test.tsx`
- `lib/pathadvisor-governed/conversation-context.ts`
- `lib/pathadvisor-governed/conversation-context.test.ts`
- `docs/change-briefs/pathadvisor-conversational-shell-restoration-v1.md`

### Behavior changes

- Governed mode now keeps a visible PathAdvisor composer instead of suppressing
  it.
- Guidance now shows a compact conversation surface above the governed panel so
  the rail feels conversational again.
- The governed panel still renders summary, explanation, key factors, missing
  inputs, next steps, and trust metadata as the evidence surface.
- Shared dashboard send behavior now builds a bounded context object from the
  current governed draft and response, then generates a temporary local reply
  from that structured context only.
- Refresh stability remains in place: the prior governed response stays visible
  while the next governed request is loading.

### Validation performed

- `pnpm test -- packages/ui/src/shell/PathAdvisorCard.test.tsx packages/ui/src/shell/PathAdvisorGovernedPanel.test.tsx lib/pathadvisor-governed/client.test.ts lib/pathadvisor-governed/conversation-context.test.ts`
  - 21 tests passed
- `pnpm eslint 'app/(shared)/dashboard/_components/SharedDashboardRouteShell.tsx' 'packages/ui/src/shell/PathAdvisorCard.tsx' 'packages/ui/src/shell/PathAdvisorCard.test.tsx' 'packages/ui/src/shell/PathAdvisorGovernedPanel.tsx' 'packages/ui/src/shell/PathAdvisorGovernedPanel.test.tsx' 'lib/pathadvisor-governed/conversation-context.ts' 'lib/pathadvisor-governed/conversation-context.test.ts'`
  - no errors, no warnings in touched files
- `pnpm typecheck`
  - failed due to pre-existing resume-builder test/type errors unrelated to this slice
  - no remaining typecheck errors came from the touched PathAdvisor files after the helper fix
- `pnpm lint`
  - failed due to pre-existing repo-wide lint issues in resume-builder, desktop, and other legacy areas unrelated to this slice

### Known risks / follow-ups

- The restored conversation replies are still a bounded local bridge, not a real
  backend conversation endpoint.
- The branch was created from a dirty PathAdvisor trust-refinement worktree, so
  the current working tree and generated incremental patch include both the
  carried-forward refinement edits and this conversational-shell restoration.
- Mobile sanity was reviewed at the code/layout level only in this run. The
  restored composer uses the existing rail layout and no new fixed-width
  assumptions, but no browser-device pass was run here.

### git status

```text
On branch feature/pathadvisor-conversational-shell-restoration-v1
Changes not staged for commit:
  modified:   app/(shared)/dashboard/_components/SharedDashboardRouteShell.tsx
  modified:   docs/merge-notes/current.md
  modified:   packages/ui/src/shell/PathAdvisorCard.test.tsx
  modified:   packages/ui/src/shell/PathAdvisorCard.tsx
  modified:   packages/ui/src/shell/PathAdvisorGovernedPanel.test.tsx
  modified:   packages/ui/src/shell/PathAdvisorGovernedPanel.tsx

Untracked files:
  docs/change-briefs/pathadvisor-conversational-shell-restoration-v1.md
  docs/change-briefs/pathadvisor-trust-input-completion-refinement-v1.md
  lib/pathadvisor-governed/conversation-context.test.ts
  lib/pathadvisor-governed/conversation-context.ts

no changes added to commit
```

### git branch --show-current

```text
feature/pathadvisor-conversational-shell-restoration-v1
```

### git diff --name-status develop...HEAD

```text
(no output)
```

### git diff --stat develop...HEAD

```text
(no output)
```

### Patch artifacts

Note: `git diff develop...HEAD` is empty because this branch still has only
uncommitted working-tree changes. The incremental patch contains the current
working-tree diff, which in this branch includes both the carried-forward
PathAdvisor trust-refinement changes and this restoration slice.

```text
-rwxrwxrwx 1 joriel joriel 0 Apr  3 10:12 artifacts/pathadvisor-conversational-shell-restoration-v1.patch
-rwxrwxrwx 1 joriel joriel 63K Apr  3 10:12 artifacts/pathadvisor-conversational-shell-restoration-v1-this-run.patch
```

---

## Run: PathAdvisor Trust & Input Completion Refinement (2026-04-01)

### Branch

`feature/pathadvisor-trust-input-completion-refinement-v1`

### Summary

Refined the governed PathAdvisor rail so incomplete and refused responses read
more honestly and are easier to act on, without changing the backend contract
or redesigning the rail. This pass keeps the same governed structure but:

- labels partial responses as incomplete
- makes missing inputs the explicit reason an answer is incomplete
- makes refused responses feel intentional instead of broken
- keeps the prior governed answer visible during refresh
- tightens the compact trust footer without hiding governed metadata

### Why this change was made

The governed PathAdvisor integration was already structurally correct, but the
current rail still let partial and refused states feel too similar to normal
success. This refinement makes the trust boundary more obvious while staying
calm, professional, and low-noise.

### Files changed

- `app/(shared)/dashboard/_components/SharedDashboardRouteShell.tsx`
- `packages/ui/src/shell/PathAdvisorGovernedPanel.tsx`
- `packages/ui/src/shell/PathAdvisorGovernedPanel.test.tsx`
- `docs/change-briefs/pathadvisor-trust-input-completion-refinement-v1.md`

### Behavior changes

- `partial` responses now render with an explicit `Incomplete` trust label.
- Missing inputs now render as clearer guided cards instead of a plain raw list.
- Lightweight missing-input actions point users back to the bounded request
  inputs instead of introducing a larger workflow.
- `refused` responses now explain that the answer is intentionally being held at
  a trust boundary, not failing technically.
- Loading now preserves the previous governed answer during refresh so the rail
  does not flash empty.
- The trust footer stays compact while still rendering domain, state, grounded
  flag, pack reference, and freshness.

### Validation performed

- `pnpm test -- packages/ui/src/shell/PathAdvisorCard.test.tsx packages/ui/src/shell/PathAdvisorGovernedPanel.test.tsx lib/pathadvisor-governed/client.test.ts`
  - 18 tests passed
- `pnpm eslint 'app/(shared)/dashboard/_components/SharedDashboardRouteShell.tsx' 'packages/ui/src/shell/PathAdvisorGovernedPanel.tsx' 'packages/ui/src/shell/PathAdvisorGovernedPanel.test.tsx'`
  - no errors, no warnings in touched files
- `pnpm typecheck`
  - failed due to pre-existing resume-builder test errors unrelated to this slice
  - no new PathAdvisor-specific typecheck issue surfaced in this run
- `pnpm lint`
  - failed due to pre-existing repo-wide lint issues in resume-builder, desktop,
    and other legacy areas unrelated to this slice

### Known risks / follow-ups

- Missing-input actions only redirect users back to the bounded request inputs;
  they do not add orchestration or auto-fill behavior.
- Cross-domain refresh still relies on the existing single-rail local state; no
  persistence or thread memory was added in this slice.
- Mobile sanity was reviewed at the code/layout level only in this run. The
  refinement keeps single-column form sections, wrap-safe badges, and no new
  fixed-width layout assumptions, but no browser-device pass was run here.

### git status

```text
On branch feature/pathadvisor-trust-input-completion-refinement-v1
Changes not staged for commit:
  modified:   app/(shared)/dashboard/_components/SharedDashboardRouteShell.tsx
  modified:   packages/ui/src/shell/PathAdvisorGovernedPanel.test.tsx
  modified:   packages/ui/src/shell/PathAdvisorGovernedPanel.tsx

Untracked files:
  docs/change-briefs/pathadvisor-trust-input-completion-refinement-v1.md

no changes added to commit
```

### git branch --show-current

```text
feature/pathadvisor-trust-input-completion-refinement-v1
```

### git diff --name-status develop...HEAD

```text
(no output)
```

### git diff --stat develop...HEAD

```text
(no output)
```

### Patch artifacts

Note: `git diff develop...HEAD` is empty because this slice remains uncommitted
in the working tree. The incremental artifact contains the actual working-tree
changes from this run.

```text
-rwxrwxrwx 1 joriel joriel 0 Apr  1 17:25 artifacts/pathadvisor-trust-input-completion-refinement-v1.patch
-rwxrwxrwx 1 joriel joriel 38K Apr  1 17:25 artifacts/pathadvisor-trust-input-completion-refinement-v1-this-run.patch
```

---

## Run: Deterministic PDF Final Visual-Parity Pass (2026-04-01)

### Branch

```
feature/resumeBuilderv2
```

### Summary

Final visual-parity tuning pass for the deterministic PDF export. Compared
against testResume3.pdf (the gold-standard print reference), the previous
export was structurally correct but still visibly more cramped. This pass
adjusts 11 spacing tokens and adds a new page-continuation token so the
exported PDF matches the professional spacing rhythm of the print reference.

### What changed

1. **Header rhythm (4 tokens)** — SPACING_AFTER_NAME_PT 6→8, SPACING_AFTER_CONTACT_LINE_PT
   3→4, SPACING_BEFORE_HEADER_RULE_PT 8→10, SPACING_AFTER_HEADER_RULE_PT 14→18.
   The header block now has generous breathing room. The 18pt after-rule gap is the
   highest-impact change for page 1.

2. **Work Experience density (4 tokens)** — SPACING_AFTER_JOB_TITLE_ROW_PT 3→4,
   SPACING_AFTER_EMPLOYER_ROW_PT 5→6, SPACING_BETWEEN_ENTRIES_PT 12→15,
   SPACING_BETWEEN_BULLETS_PT 2→3. Entries now have their own visual territory.

3. **Section rhythm (3 tokens)** — SECTION_GAP_PT 22→24, SPACING_HEADING_TO_UNDERLINE_PT
   5→6, SPACING_AFTER_HEADING_UNDERLINE_PT 10→12. Sections feel deliberate and calm.

4. **Page 2+ opening (1 new token)** — PAGE_CONTINUATION_TOP_EXTRA_PT = 6pt. Pages
   after page 1 get extra top padding so continuation sections don't start abruptly.

5. **3 new tests** — PAGE_CONTINUATION_TOP_EXTRA_PT value/budget verification,
   multi-page continuation padding export validation.

### Files changed (this run)

- `packages/ui/src/resume-builder/utils/pdf-export.ts` — 11 spacing tokens adjusted, 1 new token, renderPage uses continuation padding
- `packages/ui/src/resume-builder/__tests__/pdf-export.test.ts` — 3 new tests, updated specific-value and budget tests
- `packages/ui/src/resume-builder/index.ts` — barrel export for PAGE_CONTINUATION_TOP_EXTRA_PT
- `docs/change-briefs/resume-builder-deterministic-pdf-final-visual-parity.md` — new change brief

### git status

```
On branch feature/resumeBuilderv2
Modified:   packages/ui/src/resume-builder/utils/pdf-export.ts (untracked — new file)
Modified:   packages/ui/src/resume-builder/__tests__/pdf-export.test.ts (untracked — new file)
Modified:   packages/ui/src/resume-builder/index.ts
New:        docs/change-briefs/resume-builder-deterministic-pdf-final-visual-parity.md
```

### git branch --show-current

```
feature/resumeBuilderv2
```

### git diff --name-status develop...HEAD

68 files across the branch (see cumulative patch).

### git diff --stat develop...HEAD

68 files changed, ~28,900 insertions, ~7,200 deletions.

### Patch artifacts

| Artifact | Size |
|----------|------|
| `artifacts/resume-builder-deterministic-pdf-final-visual-parity.patch` | 1,894.5 KB (cumulative: develop → working tree) |
| `artifacts/resume-builder-deterministic-pdf-final-visual-parity-this-run.patch` | 277.1 KB (incremental: this run only) |

### Validation performed

- `vitest run packages/ui/src/resume-builder/__tests__/pdf-export.test.ts` — 55 passed (52 existing + 3 new)
- `vitest run packages/ui/src/resume-builder/__tests__/pagination-engine.test.ts` — 48 passed (no regression)
- `vitest run packages/ui/src/resume-builder/` — 686 passed across 5 test files
- `vitest run packages/ui/src/screens/ResumeBuilderScreen.test.tsx` — 169 passed
- Linter: no errors on modified files
- No commit, no push

### Spacing token changes (before → after)

| Token | Before | After | Delta |
|-------|--------|-------|-------|
| `SPACING_AFTER_NAME_PT` | 6pt | 8pt | +2pt |
| `SPACING_AFTER_CONTACT_LINE_PT` | 3pt | 4pt | +1pt |
| `SPACING_BEFORE_HEADER_RULE_PT` | 8pt | 10pt | +2pt |
| `SPACING_AFTER_HEADER_RULE_PT` | 14pt | 18pt | +4pt |
| `SECTION_GAP_PT` | 22pt | 24pt | +2pt |
| `SPACING_HEADING_TO_UNDERLINE_PT` | 5pt | 6pt | +1pt |
| `SPACING_AFTER_HEADING_UNDERLINE_PT` | 10pt | 12pt | +2pt |
| `SPACING_AFTER_JOB_TITLE_ROW_PT` | 3pt | 4pt | +1pt |
| `SPACING_AFTER_EMPLOYER_ROW_PT` | 5pt | 6pt | +1pt |
| `SPACING_BETWEEN_ENTRIES_PT` | 12pt | 15pt | +3pt |
| `SPACING_BETWEEN_BULLETS_PT` | 2pt | 3pt | +1pt |
| `PAGE_CONTINUATION_TOP_EXTRA_PT` | (new) | 6pt | +6pt |

### Known follow-ups

- Manual visual comparison of the deterministic export vs testResume3.pdf is recommended
- Font fidelity (Helvetica vs on-screen font) remains a future improvement
- A4 paper size support for international users remains a follow-up

### Human Simulation Gate

Visual PDF comparison is strongly recommended before merge. Automated tests verify
structural contracts, spacing hierarchy, margin budgets, and page-count parity. But
a human should export the PDF and visually compare it against testResume3.pdf to
confirm the spacing changes produce the intended breathing room improvement.

---

## Run: Deterministic PDF Visual Parity (2026-04-01)

### Branch

```
feature/resumeBuilderv2
```

### Summary

Tuned the deterministic PDF export so its visual output matches the cleaner browser-print
reference (testResume3.pdf). The previous export looked compressed — cramped header,
tight section spacing, jammed work experience entries. This pass adjusts 12 spacing
constants in the PDF renderer and increases the pagination engine's safety margin so
the engine allocates fewer blocks per page, producing a more comfortable page rhythm.

### What changed

1. **MARGIN_TOP_PT: 30pt → 40pt** — Increased top margin to match the print reference's
   more generous header positioning. Now exported as a named constant.

2. **Header block spacing** — SPACING_AFTER_NAME_PT 4→6, SPACING_AFTER_CONTACT_LINE_PT
   2→3, SPACING_BEFORE_HEADER_RULE_PT 6→8, SPACING_AFTER_HEADER_RULE_PT 10→14. The
   header block no longer feels cramped; the 14pt after-rule gap is the single biggest
   improvement for "compressed page 1" perception.

3. **Section spacing** — SECTION_GAP_PT 20→22, SPACING_HEADING_TO_UNDERLINE_PT 4→5,
   SPACING_AFTER_HEADING_UNDERLINE_PT 8→10. Sections have clearer visual separation.

4. **Experience entry spacing** — SPACING_AFTER_JOB_TITLE_ROW_PT 2→3,
   SPACING_AFTER_EMPLOYER_ROW_PT 4→5, SPACING_BETWEEN_ENTRIES_PT 8→12,
   SPACING_BETWEEN_BULLETS_PT 1→2. Each work experience entry now breathes properly.

5. **PAGE_SAFETY_MARGIN_PX: 48px → 72px** — Increased the pagination engine's per-page
   safety margin by 24px. This causes the engine to allocate slightly fewer blocks per
   page, which gives the PDF renderer room for its more generous spacing tokens and
   produces page-break pacing that matches the print reference.

6. **17 new tests** — Specific value verification (8), margin budget integrity (4),
   export wiring with new spacing (5). Total PDF export tests: 52.

### Files changed (this run)

- `packages/ui/src/resume-builder/utils/pdf-export.ts` — 12 spacing constants adjusted, MARGIN_TOP_PT and MARGIN_BOTTOM_PT now exported
- `packages/ui/src/resume-builder/types/document-block-types.ts` — PAGE_SAFETY_MARGIN_PX 48→72
- `packages/ui/src/resume-builder/__tests__/pdf-export.test.ts` — 17 new tests, updated safety margin test to use constant
- `packages/ui/src/resume-builder/index.ts` — barrel exports for MARGIN_TOP_PT, MARGIN_BOTTOM_PT
- `docs/change-briefs/resume-builder-deterministic-pdf-visual-parity.md` — new change brief

### git status

```
On branch feature/resumeBuilderv2
Modified:   packages/ui/src/resume-builder/utils/pdf-export.ts (untracked — new file)
Modified:   packages/ui/src/resume-builder/types/document-block-types.ts (untracked — new file)
Modified:   packages/ui/src/resume-builder/__tests__/pdf-export.test.ts (untracked — new file)
Modified:   packages/ui/src/resume-builder/index.ts
New:        docs/change-briefs/resume-builder-deterministic-pdf-visual-parity.md
```

### git branch --show-current

```
feature/resumeBuilderv2
```

### git diff --name-status develop...HEAD

See cumulative patch for full list (68 files across the branch).

### git diff --stat develop...HEAD

See cumulative patch for full stats (~28,900 insertions, ~7,200 deletions across 68 files).

### Patch artifacts

| Artifact | Size |
|----------|------|
| `artifacts/resume-builder-deterministic-pdf-visual-parity.patch` | ~1,889 KB (cumulative: develop → working tree) |
| `artifacts/resume-builder-deterministic-pdf-visual-parity-this-run.patch` | ~271 KB (incremental: this run only) |

### Validation performed

- `vitest run packages/ui/src/resume-builder/__tests__/pdf-export.test.ts` — 52 passed (35 existing + 17 new)
- `vitest run packages/ui/src/resume-builder/__tests__/pagination-engine.test.ts` — 48 passed (all existing, no regression)
- `vitest run packages/ui/src/resume-builder/` — 683 passed across 5 test files
- Linter: no errors on modified files
- No commit, no push

### Spacing token changes (before → after)

| Token | Before | After | Change |
|-------|--------|-------|--------|
| `MARGIN_TOP_PT` | 30pt | 40pt | +10pt |
| `SPACING_AFTER_NAME_PT` | 4pt | 6pt | +2pt |
| `SPACING_AFTER_CONTACT_LINE_PT` | 2pt | 3pt | +1pt |
| `SPACING_BEFORE_HEADER_RULE_PT` | 6pt | 8pt | +2pt |
| `SPACING_AFTER_HEADER_RULE_PT` | 10pt | 14pt | +4pt |
| `SECTION_GAP_PT` | 20pt | 22pt | +2pt |
| `SPACING_HEADING_TO_UNDERLINE_PT` | 4pt | 5pt | +1pt |
| `SPACING_AFTER_HEADING_UNDERLINE_PT` | 8pt | 10pt | +2pt |
| `SPACING_AFTER_JOB_TITLE_ROW_PT` | 2pt | 3pt | +1pt |
| `SPACING_AFTER_EMPLOYER_ROW_PT` | 4pt | 5pt | +1pt |
| `SPACING_BETWEEN_ENTRIES_PT` | 8pt | 12pt | +4pt |
| `SPACING_BETWEEN_BULLETS_PT` | 1pt | 2pt | +1pt |
| `PAGE_SAFETY_MARGIN_PX` | 48px | 72px | +24px |

### Known follow-ups

- Manual visual comparison of deterministic export vs testResume3.pdf is recommended
- Manual visual comparison of deterministic export vs Alexandra-Chen-2026-04-01 (5).pdf
- Font fidelity (Helvetica vs on-screen font) remains a follow-up
- A4 paper size support for international users remains a follow-up

### Human Simulation Gate

Visual PDF comparison is recommended before merge. Automated tests verify structural
contracts, spacing hierarchy, margin budgets, and page-count parity. But a human should
visually compare the exported PDF against testResume3.pdf to confirm the spacing changes
produce the intended visual improvement.

---

## Run: PDF Polish and UI Cleanup (2026-04-01)

### Branch

```
feature/resumeBuilderv2
```

### Summary

Polish pass for the deterministic PDF export and preview overlay UI. Improved
document spacing and hierarchy in the PDF renderer so exported resumes have
proper breathing room between the name, contact block, section headings, and
content rows. Removed the user-facing "Export JSON" button from the preview
overlay action bar since it is a developer tool, not a user-facing action.

### What changed

1. **Central spacing tokens in `pdf-export.ts`** — Introduced 11 named, exported
   spacing constants (`SPACING_AFTER_NAME_PT`, `SECTION_GAP_PT`, etc.) that
   control every vertical gap in the exported PDF. All spacing is now tunable
   from one location instead of scattered magic numbers.

2. **Improved PDF header block spacing** — Added explicit gaps after the
   candidate name (4pt), after the contact line (2pt), before the header rule
   (6pt), and after the header rule (10pt). The header block no longer feels
   cramped.

3. **Improved section heading spacing** — Heading-to-underline gap increased
   from 3pt to 4pt; underline-to-content gap increased from 6pt to 8pt. Section
   headings are easier to scan.

4. **Improved experience entry spacing** — Added 2pt after job-title row, 4pt
   after employer row, 1pt between bullets, 8pt between entries. Content rows
   within experience entries are no longer jammed together.

5. **Inter-section gap increase** — `SECTION_GAP_PT` increased from 18pt to
   20pt for better visual separation between sections.

6. **Removed Export JSON button** — The "Export JSON" button was removed from
   the preview overlay action bar. The `handleExportJSON` function and
   `exportResumeJSON` import are retained internally for dev/debug use.

7. **13 new tests** — Spacing token existence/sanity (2), hierarchy
   relationships (5), page-count parity after spacing changes (4), continued
   section handling (2).

### Files changed (this run)

- `packages/ui/src/resume-builder/utils/pdf-export.ts` — spacing tokens and renderer updates
- `packages/ui/src/resume-builder/index.ts` — barrel exports for spacing tokens
- `packages/ui/src/resume-builder/__tests__/pdf-export.test.ts` — 13 new tests
- `packages/ui/src/screens/ResumeBuilderScreen.tsx` — removed Export JSON button, updated JSDoc

### git status

```
On branch feature/resumeBuilderv2
Modified:   packages/ui/src/resume-builder/utils/pdf-export.ts (untracked — new file)
Modified:   packages/ui/src/resume-builder/index.ts
Modified:   packages/ui/src/resume-builder/__tests__/pdf-export.test.ts (untracked — new file)
Modified:   packages/ui/src/screens/ResumeBuilderScreen.tsx
```

### git diff --stat develop...HEAD

See cumulative patch for full stats.

### Patch artifacts

| Artifact | Size |
|----------|------|
| `artifacts/resume-builder-pdf-polish-and-ui-cleanup.patch` | ~1,668 KB |
| `artifacts/resume-builder-pdf-polish-and-ui-cleanup-this-run.patch` | ~267 KB |

### Validation performed

- `vitest run packages/ui/src/resume-builder/__tests__/pdf-export.test.ts` — 35 passed (22 existing + 13 new)
- `vitest run packages/ui/src/resume-builder/__tests__/` — 666 passed across 5 test files
- `vitest run packages/ui/src/screens/ResumeBuilderScreen.test.tsx` — 169 passed
- Linter: no errors on modified files
- No commit, no push

### Known follow-ups

- Manual visual validation of 1/2/3-page PDF exports with the new spacing
- Potential further tuning of spacing values based on real content review
- The `handleExportJSON` function remains in the codebase for dev use; could be
  removed entirely in a future cleanup if not needed

---

## Run: Deterministic PDF Export (2026-04-01)

### Branch

```
feature/resumeBuilderv2
```

### Summary

Replaced browser-print-based PDF export with a deterministic, application-owned PDF
generation pipeline using jsPDF. The "Export Resume PDF" button now generates and
downloads a clean PDF directly from the paginated resume model — no browser dialog,
no browser-injected metadata. Browser print is retained as a clearly labeled fallback.

### Root cause of previous issues

The browser print path (`window.print()`) could not produce deterministic output:
- Browsers inject metadata (date, URL, page title, headers/footers)
- Browser print dialog settings vary per user/browser/OS
- Page count could diverge between app preview and browser print
- No programmatic control over browser chrome in printed output

### What changed

1. **New `pdf-export.ts` module** — Deterministic PDF renderer that takes the
   same `PaginatedDocument` model used by the workspace canvas and preview. Uses
   jsPDF to produce text-based, ATS-safe PDFs with no browser dependencies.

2. **Updated export flow** — The "Export Resume PDF" button calls the new
   deterministic pipeline. On success, the PDF downloads immediately. On failure,
   an error is shown with guidance to use the browser print fallback.

3. **Updated UI copy** — Primary button is "Export Resume PDF" (deterministic).
   Secondary button is "Print" (browser fallback). Hint text updated to reflect
   the new behavior.

4. **Barrel exports** — `PdfFederalDetails`, `PdfExportInput`, `PdfExportResult`,
   `exportResumePdf`, `downloadResumePdf` added to the resume-builder barrel.

5. **22 new tests** — Comprehensive PDF export test suite covering one-page,
   two-page, three-page, long content, error handling, canonical section order,
   no duplicates, preview/export parity, and input contract validation.

6. **jsPDF dependency** — Added `jspdf ^4.2.1` to workspace root `package.json`.

### Files changed

| File | Change |
|------|--------|
| `packages/ui/src/resume-builder/utils/pdf-export.ts` | NEW — deterministic PDF export module |
| `packages/ui/src/resume-builder/__tests__/pdf-export.test.ts` | NEW — 22 export tests |
| `packages/ui/src/resume-builder/index.ts` | MODIFIED — added barrel exports |
| `packages/ui/src/screens/ResumeBuilderScreen.tsx` | MODIFIED — new import, export handler, UI wiring |
| `package.json` | MODIFIED — added jspdf dependency |
| `pnpm-lock.yaml` | MODIFIED — lockfile updated |
| `docs/change-briefs/resume-builder-deterministic-pdf-export-v1.md` | NEW — change brief |
| `docs/merge-notes/current.md` | MODIFIED — this entry |

### Behavior changes

| Surface | Before | After |
|---------|--------|-------|
| Export Resume PDF button | Opens browser print dialog | Generates and downloads PDF directly |
| Browser metadata in export | Present (date, URL, etc.) | Absent — clean PDF |
| Page-count parity | Unstable (browser could add pages) | Deterministic — matches paginated model |
| Export fallback | None (browser print was primary) | "Print" button for browser fallback |
| Error handling | Silent (browser dialog just opened) | Error message with fallback guidance |
| ATS safety | Depended on browser print output | Guaranteed — text-based PDF via jsPDF |

### Validation

```
66 test files passed
1681 tests passed (22 new)
0 failures
```

### Git state

```
Branch: feature/resumeBuilderv2
```

### Patch artifacts

| File | Size |
|------|------|
| `artifacts/resume-builder-deterministic-pdf-export-v1.patch` | 1,880.7 KB |
| `artifacts/resume-builder-deterministic-pdf-export-v1-this-run.patch` | 261.3 KB |

### Change brief

`docs/change-briefs/resume-builder-deterministic-pdf-export-v1.md`

### Known follow-ups

1. **Font support** — Current version uses Helvetica. Custom/embedded fonts would
   improve visual fidelity with the on-screen preview.
2. **Line wrapping parity** — jsPDF text wrapping may differ slightly from CSS text
   layout. A future pass could use exact width measurements to match pixel-perfectly.
3. **A4 paper size** — Currently hardcoded to US Letter. International users may
   want A4 support.
4. **Visual verification** — Human should export a 1-page, 2-page, and 3-page resume
   and verify the PDF output matches expectations.
5. **Accessibility** — PDF metadata (title, author, language) could be set for better
   accessibility compliance.

---

## Run: Print Page-Count Parity Fix (2026-04-01)

### Branch

```
feature/resumeBuilderv2
```

### Summary

Fixed the final print/export parity issue: "Export Resume PDF" produced 3 pages when the resume should have been 2. Root cause was missing `@page { margin: 0 }` CSS rule and no fixed height on print page containers, causing browser default margins to shrink the printable area and push content onto extra physical pages. Added `@page` rule, fixed page container sizing to exactly PAGE_HEIGHT_PX (1056px) with box-sizing:border-box and overflow:hidden, and zeroed out margin/padding on print root and wrapper elements.

### Root Cause

Missing `@page { size: letter; margin: 0 }` meant browsers used default ~0.4in margins, reducing printable area to ~960px. Page content at 1008px (928px content + 80px padding) overflowed, splitting page 1 across two physical pages and pushing page 2 to a 3rd sheet.

### Files Changed

- `app/globals.css` — Added @page rule, page container height/box-sizing/overflow/margin, print root/wrapper zero-space rules, removed blanket overflow:visible
- `packages/ui/src/screens/ResumeBuilderScreen.tsx` — Inline height/box-sizing/overflow/margin on print page containers
- `packages/ui/src/screens/ResumeBuilderScreen.test.tsx` — 8 new page-count parity tests
- `packages/ui/src/resume-builder/__tests__/pagination-engine.test.ts` — 5 new print parity tests

### Behavior Changes

- Export/print page count now exactly matches the paginated resume model
- No blank or fragmentary trailing pages
- No app-generated chrome in print output
- Browser metadata (headers/footers) documented as browser-controlled, not app-controlled

### Validation

- 1659 tests pass (65 test files), 0 failures
- No lint errors
- No regressions to live canvas, preview overlay, or export flow

### Git State

```
Branch: feature/resumeBuilderv2
Status: working tree modified (not committed)
```

### Patch Artifacts

| Artifact | Size |
|----------|------|
| `artifacts/resume-builder-print-parity-cumulative.patch` | 1,770 KB |
| `artifacts/resume-builder-print-parity-this-run.patch` | 98 KB |

### Change Brief

`docs/change-briefs/resume-builder-print-parity.md`

### Follow-ups

1. Human visual verification: export a 2-page resume and confirm exactly 2 pages in PDF
2. Test with A4 paper size for international users
3. Consider adding print preview showing exact page boundaries
4. Browser metadata is browser-controlled — no app code chase required

### Human Simulation Gate

Visual print-export verification is recommended before merge. Automated tests verify the structural contracts and pagination model parity, but a manual print-to-PDF confirms the browser @page rule is respected.

---

## Run: Single Print Root Fix — Export PDF Deduplication (2026-04-01)

### Branch

```
feature/resumeBuilderv2
```

### Summary

Fixed duplicate/fragmented pages in "Export Resume PDF" output. The exported PDF was 5 pages instead of the intended 2 because both the preview overlay (position:fixed) and the print portal were contributing to print output. Browser print engines (Chrome, Edge) have a known quirk where position:fixed elements can escape an ancestor's display:none. Three layers of print-hiding defense were added to ensure exactly one printable resume tree exists at export time.

### Root Cause

The preview overlay uses `position: fixed` with `inset: 0`. The blanket CSS rule `body > *:not(#resume-print-root) { display: none !important }` hides the overlay's ancestor, but Chrome/Edge print engines can render fixed-position children of display:none ancestors. Additionally, the wildcard `* { overflow: visible !important }` in print CSS applied to ALL elements (including those meant to be hidden), creating conditions where the browser print layout rendered the overlay content.

### Architecture Decision

The **print portal** (`#resume-print-root`) remains the sole source of printed content. The **preview overlay** renders resume pages for on-screen review only and is explicitly excluded from print via three defense layers:

1. Blanket CSS: `body > *:not(#resume-print-root) { display: none !important }`
2. Explicit CSS: `[data-testid="resume-preview-overlay"], [data-print-hide] { display: none !important; visibility: hidden !important; position: static !important; width: 0 !important; height: 0 !important; }`
3. Tailwind: `print:hidden` class on the overlay div

### Files Changed (this run)

| File | Change |
|------|--------|
| `app/globals.css` | Added explicit preview overlay print-hide rule; scoped wildcard overflow to `#resume-print-root` only |
| `packages/ui/src/screens/ResumeBuilderScreen.tsx` | Added `data-print-hide` + `print:hidden` to preview overlay; added `data-resume-print-source` to print portal content; added `assertSinglePrintableRoot()` dev assertion before `window.print()` |
| `packages/ui/src/screens/ResumeBuilderScreen.test.tsx` | Added 8 new tests for single-printable-root invariant |

### Commands Run

```
npx vitest run packages/ui/src/screens/ResumeBuilderScreen.test.tsx --reporter=verbose
npx vitest run packages/ui/src/resume-builder
pnpm typecheck
```

### Validation

- 161 ResumeBuilderScreen tests pass (8 new, 153 existing)
- 626 resume-builder architecture/pagination tests pass (no regression)
- 787 total tests pass across changed suites
- No new lint errors
- Pre-existing typecheck errors in unrelated test files only (no new errors in changed files)

### Git State

```
Branch: feature/resumeBuilderv2
Status: working tree has uncommitted changes (not committed, not pushed)
```

### Patch Artifacts

| Artifact | Size | Description |
|----------|------|-------------|
| `artifacts/resume-builder-single-print-root-fix.patch` | ~1.8 MB | Cumulative: develop → working tree (all branch changes) |
| `artifacts/resume-builder-single-print-root-fix-this-run.patch` | ~87 KB | Incremental: this run only (3 files) |

### Known Follow-ups

- The dev assertion `assertSinglePrintableRoot()` logs a console warning only; a future pass could make it throw in test environments
- Browser print headers/footers remain browser-controlled (documented honestly in UI)
- Pre-existing typecheck errors in `hardening-pass.test.ts`, `resume-builder-architecture.test.ts`, `stabilization-pass.test.ts` are unrelated to this change

---

## Run: Multi-Page Rendering Parity Hardening (2026-04-01)

### Branch

```
feature/resumeBuilderv2
```

### Summary

Hardening pass ensuring live canvas, review modal, and print/export all share the same multi-page rendering contract. Fixes four trust-breaking defects left after the pagination-integrity refactor: broken text wrapping, clipped review pages, single-page print output, and missing callout lines on page 2+.

### Why

The page-first architecture was correct, but surfaces downstream of the canvas (review modal, print, callout overlay) had not been updated to consume the pagination engine output. The review modal still rendered one long clipped document. Print emitted only page 1. Callout anchors on subsequent pages were not discovered after multi-page DOM renders.

### Root Causes

| Defect | Root Cause |
|--------|-----------|
| Text not wrapping | Page surface containers lacked `overflow-wrap` / `word-break`; long unbroken strings overflowed |
| Review modal splitting content | `ResumePreviewOverlay` used CSS `overflow:hidden` + `translateY` to fake pages instead of consuming the pagination engine |
| Print showing only page 1 | Print CSS hid pages 2+ (`print:hidden`), lacked `page-break-before`, and did not reference new page-surface test IDs |
| Overview callout lines missing on page 2+ | `useCalloutLines` measured once synchronously; newly-mounted page surfaces with new anchors were not discovered until user scroll/resize |

### Files Changed (this run)

| File | Change |
|------|--------|
| `packages/ui/src/resume-builder/components/LiveResumeCanvas.tsx` | Added `overflow-wrap` / `word-break` to page surface |
| `packages/ui/src/screens/ResumeBuilderScreen.tsx` | Refactored `ResumePreviewOverlay` to true per-page rendering; added `canvasMeasuredPageCount` remeasure trigger |
| `app/globals.css` | Rewrote `@media print` for page-first model: all pages visible, page breaks, scrollbar suppression |
| `packages/ui/src/resume-builder/hooks/useCalloutLines.ts` | Two-phase delayed remeasure (50ms + 200ms) for multi-page anchor discovery |
| `packages/ui/src/resume-builder/__tests__/resume-builder-architecture.test.ts` | +15 new tests for multi-page parity |

### Commands Run

```
pnpm test       → exit 0 (1625/1625 pass, 65 files — 15 new parity tests)
pnpm lint       → exit 1 (pre-existing warnings only, none introduced)
pnpm typecheck  → exit 2 (pre-existing errors only, none in changed source files)
```

### Patch Artifacts

| Artifact | Size |
|----------|------|
| `artifacts/resume-builder-multipage-parity-hardening.patch` | ~1797 KB (cumulative from develop) |
| `artifacts/resume-builder-multipage-parity-hardening-this-run.patch` | ~153 KB (this run only) |

### Git Status

```
Branch: feature/resumeBuilderv2
Modified (this run):
  M app/globals.css
  M packages/ui/src/resume-builder/__tests__/resume-builder-architecture.test.ts
  M packages/ui/src/resume-builder/components/LiveResumeCanvas.tsx
  M packages/ui/src/resume-builder/hooks/useCalloutLines.ts
  M packages/ui/src/screens/ResumeBuilderScreen.tsx
```

### Manual Verification Required

1. Create/edit a resume with enough content to span two pages
2. Verify long summary text wraps correctly in the live canvas
3. Verify long summary text wraps correctly in the review modal
4. Open review — confirm page 1 and page 2 render as distinct surfaces with clean boundaries
5. Confirm no split-word or clipped-text artifact at page boundary in review
6. Print preview (Ctrl+P) — confirm all pages appear, not just page 1
7. Print preview — confirm no scrollbar or app chrome artifacts
8. Overview mode — confirm callout lines appear for sections on page 2+
9. Confirm inline editing, selection, add/remove flows still work

### Known Follow-ups

- Post-render height correction for estimation drift (carried over)
- Federal details in preview renderer (carried over)
- Exact `@page` margin fine-tuning for different paper sizes
- Pre-existing typecheck errors in test fixtures need separate cleanup

---

## Run: Pagination Integrity Refactor (2026-04-01)

### Branch

```
feature/resumeBuilderv2
```

### Summary

Page-first rendering model for the Resume Builder. Replaced the continuous-canvas + absolute-positioned-backgrounds + single-spacer approach with a deterministic block-to-page pagination engine. Each page is now a real DOM container. Selection chrome, action bars, and callout anchors are page-local by construction.

### Why

The previous document model rendered content as one continuous column with overlay backgrounds. This caused section borders, action bars, and selection chrome to visually cross page boundaries. The spacer-based approach only supported one page break point and relied on DOM measurement races. Print/export used a separate measurement+clip system that drifted from the workspace.

### Files Changed (this run)

| File | Change |
|------|--------|
| `packages/ui/src/resume-builder/types/document-block-types.ts` | NEW — Block model types, page constants |
| `packages/ui/src/resume-builder/utils/pagination-engine.ts` | NEW — Deterministic pagination pipeline |
| `packages/ui/src/resume-builder/__tests__/pagination-engine.test.ts` | NEW — 43 tests for pagination logic |
| `packages/ui/src/resume-builder/components/LiveResumeCanvas.tsx` | MODIFIED — Page-first rendering |
| `packages/ui/src/resume-builder/index.ts` | MODIFIED — Added barrel exports |
| `packages/ui/src/screens/ResumeBuilderScreen.tsx` | MODIFIED — Preview uses pagination engine |
| `app/globals.css` | MODIFIED — Print CSS for page model |
| `docs/change-briefs/resume-builder-pagination-integrity.md` | NEW — Change brief |

### Commands Run

```
pnpm typecheck  → exit 2 (pre-existing errors only, none in new files)
pnpm lint       → exit 1 (pre-existing warnings only, none introduced)
pnpm test       → exit 0 (1610/1610 pass, 65 files — 43 new pagination tests)
```

### Patch Artifacts

| Artifact | Size |
|----------|------|
| `artifacts/resume-builder-pagination-integrity-cumulative.patch` | ~1768 KB (cumulative from develop) |
| `artifacts/resume-builder-pagination-integrity.patch` | ~141 KB (this run only) |

### Human Simulation Required

1. Create/edit a resume with enough content to span two pages
2. Verify page 1 and page 2 render as distinct surfaces
3. Verify no section selection chrome crosses a page boundary
4. Verify clicking a section on page 2 selects and edits correctly on page 2
5. Verify action bars appear on the correct page
6. Verify print preview shows correct page split
7. Verify export PDF produces correct multi-page output

### Known Follow-ups

1. Post-render height correction for estimation drift
2. Callout line coordinate system update for page-local anchors
3. Federal details in preview renderer
4. Fine-tuning print @page alignment

---

## Run: Document-First Pagination Pass (2026-04-01)

### Branch

```
feature/resumeBuilderv2
```

### Summary

True flowing document model with dynamic page boundary placement, contact field input guidance with validation/formatting, blank resume readiness correction (empty scaffolds no longer inflate scores), document-click-first interaction, and multi-page preview fidelity.

### Why

The previous pass fixed editor integrity issues (remove collisions, keyboard bugs, date editing, version deletion). This pass addresses the next layer: the document should paginate like a real editor, contact fields need structured guidance, blank resumes should not appear ready, and clicking the document should be the primary interaction without requiring rail clicks first.

### Files Changed

| File | Lines Changed |
|------|--------------|
| `packages/ui/src/resume-builder/utils/evidence-scoring.ts` | +76 -20 |
| `packages/ui/src/resume-builder/components/LiveResumeCanvas.tsx` | +866 -437 |
| `packages/ui/src/screens/ResumeBuilderScreen.tsx` | +713 -277 |
| `packages/ui/src/resume-builder/__tests__/resume-builder-architecture.test.ts` | +158 |
| `packages/ui/src/screens/ResumeBuilderScreen.test.tsx` | +2 |
| `app/globals.css` | +6 |
| `packages/ui/src/resume-builder/components/TopFixBanner.tsx` | +3 -3 |

### Commands Run

```
pnpm lint          → exit 1 (pre-existing warnings only)
pnpm typecheck     → exit 2 (pre-existing errors only)
pnpm test          → exit 0 (1567/1567 pass, 65/65 files)
```

### Patch Artifacts

| Artifact | Size |
|----------|------|
| `artifacts/resume-builder-document-first-pagination-pass.patch` | ~1685 KB (cumulative from develop) |
| `artifacts/resume-builder-document-first-pagination-pass-this-run.patch` | ~117 KB (this run only) |

### Manual Verification Required

1. Create/edit a resume with enough content to span two pages
2. Confirm page boundary spacer appears at the correct section boundary (dynamic, not hardcoded)
3. Confirm preview shows discrete page surfaces matching the canvas
4. Enter a malformed email — confirm amber warning dot appears on the saved field
5. Enter a 10-digit phone number — confirm it formats to (xxx) xxx-xxxx on save
6. Confirm email field shows hint "e.g. jane.doe@email.com" while editing
7. Create a blank resume and confirm readiness shows low/poor, not fair/good
8. Click a section directly in the document — confirm it activates immediately without needing rail click
9. Confirm empty sections emphasize Add action, populated sections show Edit

### Known Follow-ups

- Phone formatting handles only 10/11-digit US numbers; international not supported
- Email validation is basic pattern match
- Contact field dropdowns for citizenship/veteran status still use free text
- Print rendering uses CSS transform offset; native print pagination would be more robust

---

## Run: Editor-Integrity Follow-Up Pass (2026-04-01)

### Branch

```
feature/resumeBuilderv2
```

### Summary

Eliminated remaining editing and pagination trust breaks: true multi-page workspace surfaces, remove control collision fix, version deletion, space bar keyboard fix, split date editing, empty section action hierarchy, contact/eligibility editability, preview multi-page fidelity, and hover/focus/active pass.

### Why

The previous pass addressed creation flow, add/remove coverage, page markers, validation exit, and export preview. This pass targets the remaining blockers that prevent the builder from feeling like a stable document editor: overlapping controls, broken keyboard handling, unintuitive dates, non-editable fields, and fake pagination.

### Files Changed

| File | Lines Changed |
|------|--------------|
| `app/globals.css` | +6 |
| `packages/ui/src/resume-builder/components/LiveResumeCanvas.tsx` | +654 -402 (net restructure) |
| `packages/ui/src/screens/ResumeBuilderScreen.tsx` | +582 -402 (net restructure) |

### Commands Run

```
pnpm lint          → exit 1 (pre-existing warnings only)
pnpm typecheck     → exit 2 (pre-existing test file errors only)
pnpm test          → exit 0 (1561/1561 pass, 64/64 files)
```

### Patch Artifacts

| Artifact | Size |
|----------|------|
| `artifacts/resume-builder-editor-integrity-followup.patch` | ~1688 KB (cumulative from develop) |
| `artifacts/resume-builder-editor-integrity-followup-this-run.patch` | ~74 KB (this run only) |

### Manual Verification Required

1. Create enough content to produce a true second page in the workspace
2. Confirm page 1 and page 2 both render as distinct visual surfaces
3. Confirm print preview reflects the same multi-page layout
4. Remove controls do not overlap dates or content
5. Delete a non-default resume version successfully
6. Confirm Default Resume cannot be deleted
7. Space bar works normally in inline editing
8. Edit job dates naturally from left to right (separate Start/End)
9. Empty sections emphasize Add, not Edit
10. Edit citizenship field successfully
11. All touched controls have visible hover/focus/active feedback

### Known Follow-ups

- Page boundary spacer position is structurally fixed (between Federal Details and Supporting Evidence)
- Page budget indicator in top bar uses heuristic count, not DOM-measured count
- Citizenship could benefit from structured dropdown
- Veteran status could use structured dropdown

---

## Run: Editor-Integrity Pass (2026-03-31)

### Branch

```
feature/resumeBuilderv2
```

### Summary

This pass transforms the Resume Builder from a visual mock into a trustworthy document editor. Every resume section is now directly editable, every user-created item is removable, document flow handles multi-page content with visual page-break indicators, the mode system has a clear exit from validation, print/export renders actual content instead of blank pages, and the new-resume creation flow gives users a meaningful choice between cloning their current draft and starting from a federal template scaffold.

### Why Each Change Was Made

| Change | Reason |
|--------|--------|
| New resume creation flow (default clone vs blank federal template) | Previous "new resume" produced confusing results; users need a real starting choice |
| Document flow & page-break indicators | Long resumes had no visual page awareness; users couldn't tell when content overflowed |
| Complete add/remove for all sections | Jobs, bullets, education, certs, skills, evidence were partially or fully unremovable |
| Section-specific action labels | Generic "Add here" gave no context; "Add Job", "Add Education" etc. are self-documenting |
| Validation mode escape button | Users could enter validation mode with no visible way to return to editing |
| Export/preview print fix | `@media print` rules hid `#__next`, making preview blank; now hides only app chrome |
| Resume Review modal centering | Modal was top-aligned and felt like a card, not a review workspace |
| Version switching label fix | "Saved draft" label was confusing; changed to "Draft snapshot" with date |
| Hover/focus/active states on all new controls | Interactive controls must visibly respond per house rules |

### Files Changed

```
M  app/(shared)/dashboard/_components/SharedDashboardRouteShell.tsx
M  app/(shared)/dashboard/resume-builder/page.tsx
M  app/globals.css
M  packages/core/src/index.ts
M  packages/core/src/resume-types.ts
M  packages/ui/src/screens/CareerScreen.tsx
M  packages/ui/src/screens/ResumeBuilderScreen.tsx
M  packages/ui/src/styles/scoreTiers.ts
```

Primary changes in this pass:
- `app/globals.css` — Fixed `@media print` rules to preserve `#__next` visibility; added page-break-inside rules
- `packages/ui/src/screens/ResumeBuilderScreen.tsx` — New resume creation flow, validation exit, remove-item handler, review modal centering, version label fix
- `packages/ui/src/resume-builder/components/LiveResumeCanvas.tsx` — Section-specific add labels, remove buttons for all entries/bullets, PageBreakIndicator component, add-bullet capability

### Diff Stats

```
 SharedDashboardRouteShell.tsx  |   24 +-
 resume-builder/page.tsx        |    8 +-
 globals.css                    |   98 +
 merge-notes/current.md         | replaced
 core/index.ts                  |    2 +
 core/resume-types.ts           |   28 +
 CareerScreen.tsx               |   90 +-
 ResumeBuilderScreen.tsx        | 4272 +++++++++++--
 scoreTiers.ts                  |  140 +-
 9 files changed
```

### Commands Run

```bash
pnpm lint          # exit 0, warnings only (all pre-existing)
pnpm typecheck     # exit 2, errors only in pre-existing test fixtures (series, side, isActive, certifications/supportingEvidence)
pnpm test          # exit 0, 1561 passed across 64 test files
```

### Validation Results

| Check | Result |
|-------|--------|
| `pnpm lint` | Pass (0 errors, pre-existing warnings only) |
| `pnpm typecheck` | Pre-existing errors only — all in test files and existing coverage-map code, none in changed source files |
| `pnpm test` | 1561 tests passed, 64 test files, 0 failures |

### Manual Verification Notes

The following items require manual browser verification:
1. Add enough content to exceed one page — verify PageBreakIndicator renders dashed lines with "Page X" labels
2. Create a new resume via "Start blank from federal template" — verify it creates an empty scaffold and becomes active
3. Create a new resume via "Start from Default Resume" — verify it clones the current draft
4. Enter validation mode, then click "Back to Editing" — verify exit works cleanly
5. Open print preview (Ctrl+P) — verify resume content renders, not a blank page
6. Add a job, then remove it — verify the entry disappears
7. Add a bullet, then remove it — verify the bullet disappears
8. Remove an education entry, certification, or evidence item — verify removal
9. Check hover/focus states on all new buttons and action chips

### Known Follow-Ups

- Pre-existing typecheck errors in test fixtures need separate cleanup (missing `certifications`, `supportingEvidence`, `side`, `isActive` properties)
- Inline editing for all individual fields within experience (title, employer, dates, hours/week) is wired through existing `onInlineEditSave` but may need field-level granularity refinement
- Skills section add/remove is wired through `onSectionAction` but could benefit from individual skill chip removal
- PathAdvisor conversation placeholder in Resume Review modal is preserved but not yet interactive
- Page budget indicator in the top bar should eventually derive from the PageBreakIndicator's measured page count
- "Strengthen" and "Compress" action chips need AI backend integration to perform visible rewriting

### Patch Artifacts

```
artifacts/resume-builder-editor-integrity-pass.patch          — 583.3 KB (cumulative)
artifacts/resume-builder-editor-integrity-pass-this-run.patch — 583.3 KB (incremental)
```

---

## 2026-04-01 - Resume Builder Clean Print/Export Path

### Branch
`feature/resumeBuilderv2`

### Summary

Finished the Resume Builder print/export path so it produces a clean resume
document — not a printed screenshot of the app. The previous approach tried
to selectively hide app chrome elements by `data-testid` in `@media print`
CSS, which was fragile and could not fix the root cause: the preview overlay
sat inside ancestor containers with overflow:hidden, flex layout, and fixed
positioning that clipped print output to a single viewport-sized page.

**Solution: Dedicated print portal.** A React portal renders paginated resume
pages directly into `document.body` via `createPortal`, completely outside
the app's React DOM tree. The `@media print` CSS now uses a single blanket
rule — `body > *:not(#resume-print-root) { display: none !important }` —
to hide ALL app DOM while revealing only the print root. This approach:

1. Eliminates all app-side artifacts (chrome, scrollbar, overlays, buttons)
2. Enables multi-page print output (pages flow in normal document flow)
3. Applies correct page-break-before rules for page 2+
4. Uses the same `paginateResume()` data model as the on-screen preview
5. Does NOT introduce a second pagination logic path

### Browser Print Headers/Footers — Honest Disclosure

**Date, URL, and page title text in print output are browser-controlled**, not
app-generated. Browsers add their own header (page title, date) and footer
(URL, page number) to every printed page. This metadata comes from the
browser's print dialog settings and CANNOT be suppressed by app CSS or
JavaScript.

The app now shows a UX hint in the preview: "Tip: For a clean PDF, uncheck
'Headers and footers' in your browser's print dialog."

This is the correct and honest guidance. No fake code fix was applied.

### Files Changed (This Run)

| File | Change |
|------|--------|
| `packages/ui/src/screens/ResumeBuilderScreen.tsx` | Added `createPortal` import; added print portal (useEffect + createPortal) inside ResumePreviewOverlay; added browser print hint UX; wrapped return in fragment |
| `app/globals.css` | Rewrote `@media print` block: blanket hide via `body > *:not(#resume-print-root)`, print root reveal, page surface styling, page break rules, scrollbar suppression |
| `packages/ui/src/screens/ResumeBuilderScreen.test.tsx` | Added 13 new print/export tests: multi-page pagination, page numbering, determinism, structural contracts, app chrome exclusion, SSR regression |
| `docs/merge-notes/current.md` | This section |
| `docs/change-briefs/resume-builder-clean-print-export.md` | Non-technical change brief |

### Behavior Changes

1. **Multi-page print**: All paginated pages now appear in print preview (not just page 1)
2. **No app chrome in print**: Blanket hide approach eliminates all app artifacts
3. **No scrollbar in print**: Global overflow:visible + scrollbar suppression
4. **No overlay shell in print**: Portal renders outside overlay DOM entirely
5. **Print hint UX**: Small italic tip about browser headers/footers near export button
6. **Same pagination model**: Print uses same `paginateResume()` as preview — no divergence

### Validation Run

```
TypeScript: PASS (0 new errors; pre-existing errors in other test files only)
ResumeBuilderScreen tests: 153/153 PASS (13 new print tests)
pagination-engine tests: 43/43 PASS (no regression)
```

### Known Follow-Ups

- Ctrl+P from the editor (without preview open) does not use the print portal — the portal only exists when the preview overlay is mounted. This is expected for MVP but could be addressed by always mounting the portal when the builder has data.
- Pre-existing typecheck errors in other test files remain (missing `series`, `side`, `isActive` properties)
- Future PDF library integration could bypass browser print entirely for zero-config clean export

### App-Generated vs Browser-Generated Artifacts

| Artifact | Source | Status |
|----------|--------|--------|
| App header/sidebar | App DOM | **Eliminated** — blanket hide |
| Stage tabs / top bar | App DOM | **Eliminated** — blanket hide |
| Callout lines | App DOM | **Eliminated** — blanket hide |
| Preview buttons | App DOM | **Eliminated** — blanket hide |
| Scrollbar | App DOM | **Eliminated** — overflow:visible + scrollbar-width:none |
| Page labels ("Page 2") | App DOM | **Eliminated** — blanket hide |
| Overlay backdrop | App DOM | **Eliminated** — blanket hide |
| Page title text | Browser | **Cannot remove** — browser print header (documented) |
| Date/time | Browser | **Cannot remove** — browser print header (documented) |
| URL text | Browser | **Cannot remove** — browser print footer (documented) |
| Page number | Browser | **Cannot remove** — browser print footer (documented) |

### Git State

```
Branch: feature/resumeBuilderv2
Modified (this run):
  M app/globals.css
  M packages/ui/src/screens/ResumeBuilderScreen.tsx
  M packages/ui/src/screens/ResumeBuilderScreen.test.tsx
  M docs/merge-notes/current.md
New (this run):
  ?? docs/change-briefs/resume-builder-clean-print-export.md
  ?? artifacts/resume-builder-clean-print-export.patch
  ?? artifacts/resume-builder-clean-print-export-this-run.patch
```

### Patch Artifacts

```
artifacts/resume-builder-clean-print-export.patch           - 1,826.9 KB (cumulative, develop to working tree)
artifacts/resume-builder-clean-print-export-this-run.patch  - 93.1 KB (incremental, this run only)
```

---

## Run: PathAdvisor Frontend Governed API Integration (2026-04-01)

### Branch

`feature/pathadvisor-frontend-governed-api-integration`

### Summary

Replaced the shared dashboard rail's local-only PathAdvisor simulation with the real governed PathAdvisor frontend integration path. The rail now:

- sends bounded qualification, FEHB, and cross-domain requests through same-origin proxy routes
- renders the shaped governed response contract structurally instead of as ad hoc text
- shows grounded, partial, refused, loading, empty, and technical-error states distinctly
- surfaces compact trust metadata without hiding backend truth boundaries

### Why this change was made

- The previous shared PathAdvisor rail still used a simulated frontend reply loop and did not reflect backend truth.
- The new backend slices already expose governed qualification, FEHB, and cross-domain explain endpoints with a standardized shaped response.
- The rail now follows the same frontend integration doctrine already used elsewhere in this repo: thin proxy routes, a typed browser client boundary, and presentational UI components that do not invent certainty.

### Files changed

- `app/(shared)/dashboard/_components/SharedDashboardRouteShell.tsx`
- `app/api/pathadvisor/_shared.ts`
- `app/api/pathadvisor/qualification/explain/route.ts`
- `app/api/pathadvisor/fehb/explain/route.ts`
- `app/api/pathadvisor/cross-domain/explain/route.ts`
- `lib/pathadvisor-governed/client.ts`
- `lib/pathadvisor-governed/client.test.ts`
- `packages/ui/src/index.ts`
- `packages/ui/src/shell/PathAdvisorCard.tsx`
- `packages/ui/src/shell/PathAdvisorCard.test.tsx`
- `packages/ui/src/shell/PathAdvisorRail.tsx`
- `packages/ui/src/shell/PathAdvisorGovernedPanel.tsx`
- `packages/ui/src/shell/PathAdvisorGovernedPanel.test.tsx`
- `packages/ui/src/shell/pathadvisor-governed-types.ts`
- `docs/change-briefs/pathadvisor-frontend-governed-api-integration.md`

### Behavior changes

- The right-rail PathAdvisor experience is no longer a canned local-only preview on shared dashboard routes.
- Users can choose a bounded domain: qualification, FEHB, or cross-domain.
- The rail captures the minimum bounded inputs needed for those endpoints.
- Responses now render Summary, Explanation, Key factors, Missing inputs, Next steps, and a compact Grounding and status footer.
- Refusal from the backend is shown as a governed trust boundary, not as a technical failure.
- Technical API failure remains visible as a separate error state.

### Validation performed

- `pnpm test -- packages/ui/src/shell/PathAdvisorCard.test.tsx packages/ui/src/shell/PathAdvisorGovernedPanel.test.tsx lib/pathadvisor-governed/client.test.ts`
  - 17 tests passed
- `pnpm eslint 'app/(shared)/dashboard/_components/SharedDashboardRouteShell.tsx' 'packages/ui/src/shell/PathAdvisorCard.tsx' 'packages/ui/src/shell/PathAdvisorRail.tsx' 'packages/ui/src/shell/PathAdvisorGovernedPanel.tsx' 'packages/ui/src/shell/PathAdvisorCard.test.tsx' 'packages/ui/src/shell/PathAdvisorGovernedPanel.test.tsx' 'lib/pathadvisor-governed/client.ts' 'lib/pathadvisor-governed/client.test.ts' 'app/api/pathadvisor/_shared.ts' 'app/api/pathadvisor/qualification/explain/route.ts' 'app/api/pathadvisor/fehb/explain/route.ts' 'app/api/pathadvisor/cross-domain/explain/route.ts'`
  - no errors, no warnings in touched files
- `pnpm typecheck`
  - failed because of pre-existing `packages/ui/src/resume-builder/__tests__/*` errors unrelated to this slice
  - filtered output did not surface errors from the touched PathAdvisor files in this run
- `pnpm lint`
  - failed because of pre-existing repo-wide lint errors in unrelated resume-builder and legacy files

### Known risks / follow-ups

- The governed rail currently keeps history only in local component state; there is still no thread persistence.
- The old `app/api/pathadvisor/insights/route.ts` mock path remains in the repo for legacy surfaces that still reference the older insights contract.
- The bounded form seeds from the frontend profile's current in-memory defaults; deeper profile-to-backend PathAdvisor context synchronization remains future work.

### git status

```text
On branch feature/pathadvisor-frontend-governed-api-integration
Changes not staged for commit:
  modified:   app/(shared)/dashboard/_components/SharedDashboardRouteShell.tsx
  modified:   packages/ui/src/index.ts
  modified:   packages/ui/src/shell/PathAdvisorCard.test.tsx
  modified:   packages/ui/src/shell/PathAdvisorCard.tsx
  modified:   packages/ui/src/shell/PathAdvisorRail.tsx

Untracked files:
  app/api/pathadvisor/_shared.ts
  app/api/pathadvisor/cross-domain/
  app/api/pathadvisor/fehb/
  app/api/pathadvisor/qualification/
  docs/change-briefs/pathadvisor-frontend-governed-api-integration.md
  lib/pathadvisor-governed/
  packages/ui/src/shell/PathAdvisorGovernedPanel.test.tsx
  packages/ui/src/shell/PathAdvisorGovernedPanel.tsx
  packages/ui/src/shell/pathadvisor-governed-types.ts
```

### git branch --show-current

```text
feature/pathadvisor-frontend-governed-api-integration
```

### git diff --name-status develop...HEAD

```text
(no output)
```

### git diff --stat develop...HEAD

```text
(no output)
```

### Patch artifacts

Note: the branch-level `develop...HEAD` diff is empty because this work remains uncommitted in the working tree. The generated patch artifacts capture the actual working-tree changes and exclude `artifacts/` from their contents.

```text
pathadvisor-frontend-governed-api-integration.patch                 22128 bytes   2026-04-01 4:59:53 PM
pathadvisor-frontend-governed-api-integration-this-run.patch        22128 bytes   2026-04-01 4:59:53 PM
```
