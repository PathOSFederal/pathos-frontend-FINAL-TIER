## Onboarding v3: Continuity, Memory, and Action Loop

### What changed
- Added dashboard re-entry support so completed or deferred onboarding can reopen in backend-owned refinement mode.
- Extended the onboarding view to render backend-provided profile freshness, topic threads, profile evolution signals, refinement recommendations, re-engagement prompts, and recent action feedback.
- Added frontend support for the new backend routes that reopen onboarding and record bounded action-loop events.
- Expanded onboarding tests to cover continuity rendering and continuation prompting without moving decision logic into the frontend.

### Why
- Onboarding needed to evolve from a one-time intake into a persistent PathAdvisor continuity loop.
- The frontend still stays a renderer only: freshness, thread grouping, evolution, refinement prompts, and re-engagement prompts all come from the backend contract.

### Validation
- `pnpm test -- components/dashboard/PathAdvisorOnboardingExperience.test.tsx components/dashboard/PathAdvisorOnboardingGate.test.tsx lib/onboarding/client.test.ts`: passed
- `pnpm test`: passed (`90` files, `1888` tests)
- `pnpm exec eslint components/dashboard/PathAdvisorOnboardingExperience.tsx components/dashboard/PathAdvisorOnboardingGate.tsx components/dashboard/PathAdvisorOnboardingExperience.test.tsx components/dashboard/PathAdvisorOnboardingGate.test.tsx lib/onboarding/client.ts types/onboarding.ts app/api/onboarding/session/[sessionId]/reopen/route.ts app/api/onboarding/session/[sessionId]/action/route.ts`: passed

### Deferred repo issues
- `pnpm lint` still fails outside this milestone in existing files such as `app/(shared)/dashboard/resume-builder/page.tsx`, `app/(shared)/dashboard/resume-readiness/page.tsx`, and multiple `packages/ui/src/resume-builder/**` files.
- `pnpm typecheck` still fails outside this milestone in existing `packages/ui/src/resume-builder/**` and `packages/ui/src/resume-workspace/**` files.
- The cumulative `develop...HEAD` patch artifact is empty because this branch intentionally has no commits and the worktree already carried uncommitted onboarding work before branch creation.
