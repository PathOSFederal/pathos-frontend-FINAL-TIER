# Onboarding v1 Frontend Hardening

## What changed
- Hardened the dashboard-embedded onboarding shell so it reloads authoritative backend session state before trusting local resume state.
- Removed the broad profile-store mirroring that previously copied onboarding answers into local compatibility state.
- Added explicit duplicate-submit guards, recoverable missing-session handling, backend-owned edit flows for earlier answers, and improved retry/start-fresh recovery controls.
- Added frontend tests for backend-owned edit rendering, recoverable session errors, gate-mode transitions, and governed client error parsing.

## Why it changed
- The initial onboarding slice still allowed local frontend state to drift away from backend onboarding truth.
- The dashboard needed safer handling for refresh, slow network, stale sessions, and repeated clicks without inventing client-side decision logic.
- Merge readiness required proving that lint and test outcomes tied to onboarding are clean, while unrelated repo failures are isolated with concrete evidence.

## What the user will notice
- Refresh and resume now always reload the backend session before continuing.
- Answer history is shown as backend-owned checklist items, and earlier answers can be reopened and edited without leaving the dashboard shell.
- If a saved session is missing or stale, the dashboard now restarts honestly instead of silently trusting old local state.
- Duplicate clicks are ignored while one onboarding request is already in flight.

## Validation performed
- Targeted tests: `pnpm test -- components/dashboard/PathAdvisorOnboardingExperience.test.tsx components/dashboard/PathAdvisorOnboardingGate.test.tsx lib/onboarding/client.test.ts` passed.
- Full tests: `pnpm test` passed with `90` test files and `1884` tests passing.
- Scoped lint: onboarding-related eslint run passed.
- Full lint: `pnpm lint` still fails outside this slice in pre-existing or unrelated files such as `app/(shared)/dashboard/resume-builder/page.tsx`, `app/(shared)/dashboard/resume-readiness/page.tsx`, and several `packages/ui/src/resume-builder/**` files.
- Full typecheck: `pnpm typecheck` still fails outside this slice in existing `packages/ui/src/resume-builder/**` and `packages/ui/src/resume-workspace/**` files.

## Known risks / follow-ups
- The current frontend tests remain node-environment tests, so UI interaction coverage is still expressed through backend-owned view/state helpers rather than a browser DOM harness.
- The dashboard still relies on the onboarding session id in localStorage for resume and handoff routing, but the canonical facts now remain backend-owned.
- Full repo lint and full repo typecheck remain blocked by failures outside the onboarding files touched in this milestone.
