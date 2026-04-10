# Onboarding v5: Intelligence Distribution Frontend

## What changed
- Dashboard now renders a backend-owned intelligence summary card.
- Job Search now renders backend-owned canonical user-job match projection data instead of treating matching as a local screen concern.
- Saved Jobs now renders the same canonical match projection with decision-oriented framing through the shared live-advisor panel.
- Resume Builder now renders backend-owned alignment and readiness guidance from the same canonical intelligence fabric.
- Added frontend proxy routes and client helpers for dashboard, job-search, saved-job, and resume-builder intelligence payloads.

## Why it changed
- PathOS needs one governed intelligence system across the app, not separate matching logic per screen.
- This keeps canonical user intelligence backend-owned and reusable while letting each screen render only the projection relevant to its task.

## User-visible outcome
- Dashboard shows current fit lanes, missing items, and the next best action.
- Job Search and Saved Jobs show the same canonical “Match for this Job” logic with screen-specific framing.
- Resume Builder gets the same user intelligence context for alignment and evidence guidance.

## Guardrails preserved
- Frontend does not invent match logic, readiness meaning, or next-best actions.
- Matching intelligence is projected from backend-owned canonical context.
- The new payloads are bounded and screen-specific.

## Validation summary
- Targeted v5 screen tests passed.
- Full frontend test suite passed.
- Scoped eslint passed for all touched v5 files except the long-standing pre-existing lint debt in `packages/ui/src/screens/ResumeBuilderScreen.tsx`.
- Full repo typecheck still fails in unrelated pre-existing `packages/ui/src/resume-builder/**` and `packages/ui/src/resume-workspace/**` files.

## Deferred
- Repo-wide frontend lint/typecheck cleanup outside this milestone.
- Pre-existing lint debt inside `packages/ui/src/screens/ResumeBuilderScreen.tsx` outside the v5 logic added here.
