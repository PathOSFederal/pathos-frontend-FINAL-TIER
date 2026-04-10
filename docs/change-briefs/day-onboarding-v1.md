# Day Onboarding v1

## What changed
- Added a real dashboard-embedded onboarding mode for PathAdvisor instead of a detached signup-style flow.
- Added frontend onboarding client and same-origin proxy routes so the dashboard can create, resume, answer, defer, and bootstrap deterministic onboarding sessions from the backend.
- Added a PathAdvisor-led onboarding experience that renders backend-owned questions, progress, trust microcopy, first insight output, and resumable state.
- Added frontend tests covering backend-driven question rendering, answer progression, first-insight rendering, and resume behavior.

## Why it changed
- This milestone needed to prove that PathAdvisor becomes more useful through bounded structured intake rather than vague chat behavior.
- The frontend had to stay in the correct role: conversational and calm, but not a second decision engine.
- The dashboard also needed a resumable onboarding state so a refresh or interruption would not discard the user’s structured intake progress.

## What the user will notice
- A new user entering the dashboard now lands in a guided PathAdvisor onboarding mode inside the existing dashboard shell.
- The onboarding flow explains why questions matter, allows some answers to be skipped, and shows compact progress instead of a long enterprise form.
- After enough structured facts are collected, the dashboard shows a real first insight card from the backend and keeps the surrounding PathAdvisor context visible.
- The user can refresh and resume where they left off.

## Validation performed
- Typecheck: `pnpm typecheck` failed due pre-existing unrelated errors in existing resume builder and resume workspace files outside this slice.
- Build: not run in this slice.
- Tests: `pnpm test -- components/dashboard/PathAdvisorOnboardingExperience.test.tsx lib/onboarding/client.test.ts` passed.
- Manual/runtime validation: same-origin onboarding proxy routes and owner-map generation were verified locally; `npx eslint` passed on the changed onboarding files; `pnpm docs:owner-map` passed.

## Known risks / follow-ups
- The frontend intentionally mirrors only a minimal subset of backend profile facts into existing local profile state to preserve current dashboard compatibility.
- Full lint and full typecheck are still blocked by unrelated pre-existing repo issues outside the onboarding slice.
- This slice does not yet include uploads, long-form parsing, multi-person onboarding, or deeper post-insight dashboard transitions.
