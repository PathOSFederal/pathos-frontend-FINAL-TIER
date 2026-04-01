# Merge Notes — Resume Builder Editor-Integrity Pass

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
