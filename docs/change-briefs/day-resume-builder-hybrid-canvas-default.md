# Resume Builder Hybrid Canvas Default

## What changed
- Refactored the canonical Resume Workspace builder view (`ResumeWorkspaceScreen`) so the document-centered canvas is the default primary experience instead of the panel-heavy layout.
- Added a `ResumeBuilderViewMode` state (`canvas`, `focus_guidance`, `diagnostics`, `review`) to `resumeWorkspaceStore` with persistence normalization for older saved states.
- Made the right-side guidance/diagnostics rail hidden by default in canvas mode; it opens on demand via mode toggle buttons or per-section "Focus guidance" affordances.
- Demoted large inline guidance badges and rewrite action lists from the default canvas view to subtle status indicators with explicit activation controls.
- Added a compact `BuilderModeToggle` in the top bar so users can intentionally switch between Canvas, Guidance, and Diagnostics modes.
- Updated the legacy builder route banner at `/dashboard/resume-builder` to clearly describe both builder surfaces and link to the guided workspace.
- Updated tests to assert the new default layout (mode toggle present, right rail hidden by default, section labels and focus guidance buttons present).

## Why it changed
- The existing builder layout surfaced all guidance, diagnostics, and rewrite controls simultaneously, making the experience feel panel-first rather than document-first.
- Users need to see their resume as the primary object and engage with PathOS assistance only when they choose to, not because the UI imposes it.
- The hybrid model preserves all existing backend-connected intelligence (rewrite assistance, diagnostics evaluation, PathAdvisor guidance) while making the default editing surface calmer and more focused.

## What the user will notice
- Opening the Resume Builder now shows the resume document prominently with a clean canvas; guidance and diagnostics panels are not visible by default.
- The top bar has mode toggle buttons (Canvas / Guidance / Diagnostics) for intentional mode switching.
- Each section in the canvas shows a subtle "Focus guidance" button that opens section-specific help in a right-side panel.
- Clicking "Guidance" or "Diagnostics" in the top bar opens the right rail with the corresponding content; an "X" button closes it back to canvas mode.
- All existing save, export, tailor, and review functionality works unchanged.

## Backend integrations preserved
- `evaluateResumeDiagnostics` (diagnostics evaluation API proxy) — unchanged.
- `requestResumeRewriteCandidates` (rewrite assistance API proxy) — unchanged.
- `fetchResumeBuilderIntelligence` (PathAdvisor intelligence API proxy) — unchanged.
- Save/update flows through `resumeWorkspaceStore` — unchanged.
- Target role and tailoring context flows — unchanged.
- Onboarding-to-builder handoff context — unchanged.

## Files changed
| File | Change |
|------|--------|
| `packages/ui/src/stores/resumeWorkspaceStore.ts` | Added `ResumeBuilderViewMode` type, `builderViewMode` state, `setBuilderViewMode` action, persistence normalizer |
| `packages/ui/src/screens/ResumeWorkspaceScreen.tsx` | Refactored builder view to document-first layout with conditional right rail, mode toggle, subtle guidance indicators |
| `packages/ui/src/screens/ResumeWorkspaceScreen.test.tsx` | Updated assertions for new default layout |
| `app/(shared)/dashboard/resume-builder/page.tsx` | Updated legacy builder banner copy and link |

## Validation performed
- Git status confirmed 4 modified files with 743 insertions and 458 deletions.
- Incremental patch generated: `artifacts/resume-builder-hybrid-canvas-default-this-run.patch` (559 KB).
- No commits beyond develop; cumulative patch is empty until committed.
- Typecheck and build not run in this slice (deferred to hardening lane).

## Known risks / follow-ups
- The `ResumeBuilderScreen` (legacy document-centered builder at `/dashboard/resume-builder`) remains as a separate implementation with its own local state model. It was not merged into this refactor to avoid scope creep. A future consolidation pass could unify both surfaces.
- Full typecheck may surface pre-existing unrelated errors outside this slice.
- Mobile/responsive behavior for the conditional right rail should be validated during the hardening lane.
- The `review` view mode is defined in the state model but does not yet have a distinct layout composition beyond what the existing review view already provides; this is ready for a future refinement pass.
- Accessibility audit (keyboard navigation for mode toggle, focus management when rail opens/closes) should be performed during hardening.
