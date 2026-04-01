# Day 77 — Resume Builder Callout Architecture Cleanup

## What changed

Architecture-hardening pass that removes competing guidance surfaces, wires up
the anchor registration system, strengthens callout interactivity, and expands
test coverage.

### PathAdvisor rail removed from Resume Builder route

- `SharedDashboardRouteShell` now accepts a `hideAdvisor` prop. When set, the
  far-right PathAdvisorRail is not rendered and the shell reclaims the space.
- `resume-builder/page.tsx` passes `hideAdvisor` to the shell, permanently
  removing the competing assistant column from the Resume Builder workflow.
- The PathAdvisor `useEffect` in `ResumeBuilderScreen` is simplified to minimal
  overrides (screen ID, suggested prompts, composer placeholder). Stage-specific
  rail content generation is removed since the rail is now hidden.

### Dead legacy render block removed

- The entire `{false && (...)}` render block in `ResumeBuilderScreen.tsx`
  (~450 lines) has been deleted. This block contained the old tab-based UI
  (Edit / Suggested Changes / Coverage Map / Preview / Version Diff) that was
  previously suppressed but still present in the source.
- Removing it enforces the document-first model and prevents accidental
  regression to the old tab shell.

### Anchor registration wired to canvas

- `CanvasSectionWrapper` in `LiveResumeCanvas.tsx` now registers each section
  as an anchor via `useRef` + `useEffect` on mount. Each anchor carries typed
  metadata: `id`, `kind` (section), `owningSection`, `allowedAnnotations`
  (evidence, alignment, compression), and `priority`.
- The `useAnchorMap` hook is no longer voided — it's wired into the component
  tree and receives registrations from the canvas.

### Callout action buttons

- `PathOSCalloutCard` now supports `primaryActionLabel`, `onPrimaryAction`,
  `secondaryActionLabel`, and `onSecondaryAction` props.
- Action buttons render below the card content with a top border separator.
  Click events use `stopPropagation` so card-level click handlers are not
  triggered.

### Unused icon imports cleaned

- Removed 4 unused icon imports (`Circle`, `X`, `Info`, `Home`) from
  `ResumeBuilderScreen.tsx` that were exposed as unused by the render block
  removal.

### Test suite expanded

- **Anchor map — anchor registration model**: Validates `AnchorDef`,
  `AnchorSectionId`, `AnnotationType`, `AnchorRegistration`, and `CalloutData`
  structure and type constraints.
- **Circular progress — rendering contract**: Tests severity-to-color mapping
  (green/yellow/red/gray) for all `completionPct` × `severity` combinations.
- **PathAdvisor rail removal — single guidance surface**: Confirms
  `buildSectionAnnotationSet` correctly filters annotations per section,
  enforcing a single guidance surface.
- **Tailoring annotation classes — exhaustive behavior**: Validates
  `ANNOTATION_DISPLAY_CONFIGS` color tokens, sub-type constraints, and severity
  sorting.
- Total new tests: 28 (now 84 architecture tests total).

## Files changed

**Modified:**
- `app/(shared)/dashboard/_components/SharedDashboardRouteShell.tsx` — Added `hideAdvisor` prop, conditional PathAdvisorRail rendering
- `app/(shared)/dashboard/resume-builder/page.tsx` — Passes `hideAdvisor` to shell
- `packages/ui/src/screens/ResumeBuilderScreen.tsx` — Removed dead render block, simplified PathAdvisor effect, wired `useAnchorMap`, cleaned unused imports
- `packages/ui/src/resume-builder/components/LiveResumeCanvas.tsx` — Added anchor registration via `useRef`/`useEffect` in `CanvasSectionWrapper`
- `packages/ui/src/resume-builder/components/PathOSCalloutCard.tsx` — Added primary/secondary action button props and rendering
- `packages/ui/src/resume-builder/__tests__/resume-builder-architecture.test.ts` — Added 4 new test suites (28 tests)

**New:**
- `docs/change-briefs/day-77-resume-builder-callout-architecture-cleanup.md` — This file

## Validation

```
pnpm typecheck   → passed (0 errors)
pnpm lint        → 1 pre-existing error (react-hooks/set-state-in-effect), 78 warnings (pre-existing + legacy dead code)
pnpm test        → 1083 tests passed across 62 test files
```

## Known follow-ups

- **Legacy dead code cleanup.** The render block is gone, but many sub-component
  definitions (WorkspaceTopBar, ContextStrip, SectionOrganizer, SectionDashboard,
  etc.) and their associated state/handlers remain defined but unused in
  ResumeBuilderScreen.tsx. These should be removed in a dedicated cleanup pass.
- **Pre-existing lint error.** `setSavedJobs` in effect (line 4864) predates this
  change. Should be fixed by extracting the seed logic out of the effect.
- **Anchor registration is section-level only.** Individual bullets, education
  entries, skills, etc. are not yet registered as anchors. The architecture
  supports it; granular anchors are a follow-up.
- **Callout connector lines.** Still using simplified CSS border. SVG connectors
  are a future refinement.
- **Inline editing not yet wired to canvas.** Bullet editing, summary editing,
  and section add/remove still live in dead handler code.
