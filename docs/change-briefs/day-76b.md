# Day 76b — Resume Diagnostics Contract Wiring v1

## Summary

Day 76b wires the frontend Resume Workspace to the backend-owned resume
diagnostics contract at `POST /api/v1/resume/diagnostics/evaluate`.

The frontend now:

- assembles a typed diagnostics request from the active resume workspace draft
- sends it through a same-origin frontend proxy route
- stores backend diagnostics response states in the Resume Workspace store
- renders backend-driven review results in the dedicated review page
- renders backend-driven diagnostics in the builder right rail
- maps backend `target_refs` to section-level focus and highlighting

This pass does not compute any frontend scores, readiness bands, issues, or
recommendations.

## What changed

### 1. Same-origin diagnostics API boundary

Added a frontend proxy route:

- `app/api/resume/diagnostics/evaluate/route.ts`

This route forwards a structured diagnostics request unchanged to the backend
truth endpoint:

- `POST /api/v1/resume/diagnostics/evaluate`

### 2. Typed contract helpers and browser client

Added:

- `packages/ui/src/resume-workspace/resumeDiagnostics.ts`
- `packages/ui/src/resume-workspace/resumeDiagnosticsClient.ts`

These files own:

- request and response types
- request assembly from the active resume draft
- target-ref to builder-section mapping
- the thin browser fetch client for `/api/resume/diagnostics/evaluate`

### 3. Resume Workspace store now owns transport state, not placeholder findings

Updated:

- `packages/ui/src/stores/resumeWorkspaceStore.ts`

The store now tracks:

- `idle`
- `loading`
- `evaluated`
- `insufficient_input`
- `unsupported_context`
- `error`
- `unavailable`

It also stores the last diagnostics request, backend response, error text, and
highlighted sections tied to backend `target_refs`.

The Day 75 placeholder review shell is no longer the active source of truth for
review rendering.

### 4. Review page and right rail now render backend diagnostics

Updated:

- `packages/ui/src/screens/ResumeWorkspaceScreen.tsx`

The dedicated review screen now renders:

- backend readiness band
- backend summary
- category scores
- issues
- recommendations
- warnings
- missing evidence
- engine metadata

The builder right rail diagnostics tab now renders backend diagnostics state
instead of placeholder issues.

### 5. Section targeting is wired

Backend `target_refs` are mapped into Resume Workspace section focus and
highlighting.

Current Day 76b behavior:

- users can jump to affected sections from issue and recommendation cards
- left-rail builder sections show targeted attention state
- affected document sections get bounded visual highlighting

Current limitation:

- bullet-level editor highlighting is not structurally available in the current
  Day 75 builder shell, so targeting is section-level in this pass

## Request assembly details

The request is assembled from the active resume summary and draft:

- `resume.resume_id` from the active resume summary id
- `resume.revision_id` from the current summary timestamp
- `resume.document_text` from the normalized section text
- `resume.sections` from the current draft sections
- `target_context` from current PathOS target data

Current section mapping:

- `contact`
- `summary`
- `experience`
- `education`
- `skills`
- `certifications`
- `other` for supporting evidence

Current target-context mapping:

- `canonical_job` if `linkedJobId` exists
- `role` if a target role exists without a canonical job id
- `none` otherwise

This pass uses:

- `evaluation_mode: "full_document"`

## Validation

Focused validation completed:

- `pnpm exec vitest run packages/ui/src/resume-workspace/resumeDiagnostics.test.ts packages/ui/src/stores/resumeWorkspaceStore.test.ts packages/ui/src/screens/ResumeWorkspaceScreen.test.tsx app/api/resume/diagnostics/evaluate/route.test.ts`
  - passed
  - 4 files passed, 17 tests passed
- `pnpm exec tsc --noEmit --pretty false --project packages/ui/tsconfig.json`
  - still fails only because of pre-existing `packages/ui/src/resume-builder/__tests__/...`
    errors unrelated to Day 76b

## Known limitations

- The current working tree is still on
  `feature/day-54-pathadvisor-conversation-robustness-v1`, not the requested
  `feature/day-76b-resume-diagnostics-contract-wiring-v1`.
- Review-state rendering coverage is split across screen snapshot tests and
  store contract tests because the current repo does not include a DOM-based
  React test harness.
- Bullet-level target highlighting remains out of scope for this pass.
