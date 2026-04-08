# Day 75 — Resume Workspace Guided Flow v1

## Summary

Day 75 adds a new frontend-first Resume Workspace foundation under the canonical
`/dashboard/resume` route family. The new slice establishes a document-centered
home, a staged new-resume flow, a builder shell, and a dedicated review shell
without pretending that live resume intelligence is already connected.

The key architectural shift is that resume work now has one typed local state
model spanning:

- workspace home
- creation flow
- builder workspace
- review workspace
- save or export entry points

This keeps the frontend contract explicit and deterministic-friendly so later
diagnostics, scoring, export, and federal-aware services can plug in without
rewriting the page flow.

## What changed

### 1. Canonical resume route family now exists

The app now has real route-level wrappers for:

- `/dashboard/resume`
- `/dashboard/resume/new`
- `/dashboard/resume/[resumeId]`
- `/dashboard/resume/[resumeId]/review`

These wrappers stay thin and delegate the real behavior to the shared
`ResumeWorkspaceScreen` in `@pathos/ui`.

### 2. New typed client store for the whole resume workspace

`packages/ui/src/stores/resumeWorkspaceStore.ts` adds the Day 75 state model:

- `ResumeWorkspaceState`
- `ResumeCreationFlowState`
- `ResumeBuilderState`
- `ResumeReviewState`
- `ResumeWorkspaceUiState`

It also models:

- master vs tailored resume summaries
- active resume id
- structured target context
- builder section selection and completion
- placeholder review issues, recommendations, and impact cards
- save/master/variant/duplicate/export entry-point dialogs

This state is local-first and persisted under a dedicated storage key:
`pathos-resume-workspace-v1`.

### 3. Resume Workspace Home

The home screen now acts as the entry point for resume work. It shows:

- existing resumes and variants
- master vs tailored labeling
- explicit workflow statuses
- create-new CTA
- a restrained PathAdvisor-style next-best-action panel inside the page

### 4. Guided New Resume Flow

The new staged flow walks the user through:

1. what they are creating
2. how they want to start
3. what their goal is
4. target context fields
5. setup confirmation

The flow intentionally stays transparent about what is real today and what is
reserved for later backend wiring.

### 5. Builder shell with left, center, and right structure

The new builder surface now provides:

- a stable top bar with fixed information slots
- a left rail for section navigation and completion
- a center resume canvas with direct editing for Day 75 sections
- a right rail with Guidance, Diagnostics, and Context tabs
- save/export/variant entry points as explicit UI actions

The builder does not claim live AI rewriting or live scoring. It is a shell and
state foundation for later integration work.

### 6. Dedicated review shell

The review route is no longer just a placeholder page. It now has its own
surface for:

- overall readiness band
- category breakdown
- top issues
- estimated gains
- export entry point

The messaging is intentionally explicit that these are bounded frontend
placeholders until live deterministic diagnostics are connected.

## Route mapping note

The repo already had older resume surfaces at:

- `/dashboard/resume-builder`
- `/dashboard/resume-readiness`

This Day 75 slice does **not** remove those legacy surfaces yet. Instead:

- the shared sidebar now points primary resume navigation to `/dashboard/resume`
- the older resume-builder and resume-readiness routes remain available for
  compatibility during the transition

## Validation

Focused validation completed:

- `pnpm exec vitest run packages/ui/src/stores/resumeWorkspaceStore.test.ts packages/ui/src/screens/ResumeWorkspaceScreen.test.tsx`
  - passed
- `pnpm exec tsc --noEmit --pretty false --project packages/ui/tsconfig.json`
  - no new Day 75 type errors
  - command still fails because of pre-existing resume-builder test issues

## Hardening follow-up

This slice also received a bounded hardening pass aimed at merge-trackability
rather than scope expansion.

The hardening updates include:

- direct builder and review route rendering now respects the route `resumeId`
  immediately, so invalid ids fall back to the explicit "Resume not found"
  state instead of silently reusing whichever resume was already active
- the new workspace controls now use clearer hover, active, and focus-visible
  states across the guided flow, builder actions, and review actions
- legacy `/dashboard/resume-builder` and `/dashboard/resume-readiness` routes
  now show lightweight transition notices pointing users toward the canonical
  Day 75 workspace entry at `/dashboard/resume`
- `app/desktop-preview/page.tsx` was tightened to avoid adding more nullish
  coalescing in a touched file while keeping preview support for the new route

Focused validation after the hardening pass:

- `pnpm exec vitest run packages/ui/src/stores/resumeWorkspaceStore.test.ts packages/ui/src/screens/ResumeWorkspaceScreen.test.tsx`
  - passed
  - 2 files passed, 9 tests passed
- `pnpm exec tsc --noEmit --pretty false --project packages/ui/tsconfig.json`
  - still fails only in pre-existing `packages/ui/src/resume-builder/__tests__/...`
    files outside the Day 75 slice

## Known limitations

- The requested Day 75 branch was not present locally; work was completed on
  the existing checked-out branch instead.
- The legacy resume-builder and resume-readiness surfaces still exist, so the
  repo currently has both the old and new resume entry paths, even though the
  legacy pages now carry compatibility guidance.
- Live diagnostics, scoring, export hardening, and backend review engines are
  intentionally out of scope for this pass.
