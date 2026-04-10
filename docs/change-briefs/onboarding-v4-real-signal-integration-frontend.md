## Onboarding v4: Real Data Integration (USAJOBS + Resume Signals)

### What changed
- Added a bounded same-origin onboarding signal client so Job Search and Resume Builder surfaces can forward typed product events into the backend onboarding session.
- Wired Job Search to emit deterministic signals for search execution, job opens, job saves, and target-role selection.
- Wired Resume Builder to emit deterministic signals for builder/workspace entry, target-role attachment, validation completion, tailoring start, and readiness-gap detection.
- Extended the dashboard onboarding experience to render backend-provided signal-derived insights, recent signal summaries, thread updates, and signal-derived refinement messaging.

### Why
- PathAdvisor needed to refine onboarding with real product evidence instead of relying only on self-reported intake answers.
- The frontend still does not interpret meaning locally. It only forwards bounded events and renders the backend-owned explanation of what changed.

### Validation
- `pnpm test -- components/dashboard/PathAdvisorOnboardingExperience.test.tsx components/dashboard/PathAdvisorOnboardingGate.test.tsx lib/onboarding/client.test.ts packages/ui/src/lib/onboardingSignals.test.ts`: passed
- `pnpm test`: passed (`91` files, `1892` tests)
- `pnpm exec eslint ...`: only pre-existing `packages/ui/src/screens/ResumeBuilderScreen.tsx:8215` and long-standing warnings in that file remain
- `pnpm exec tsc --noEmit --pretty false`: repo-wide pre-existing failures remain outside this milestone; the v4-introduced type errors were fixed

### Deferred repo issues
- Repo-wide frontend lint and typecheck failures outside this slice remain deferred by instruction.
- The touched `ResumeBuilderScreen.tsx` still has pre-existing lint debt unrelated to the v4 signal additions.
- The cumulative `develop...HEAD` patch artifact stays empty because the branch has no commits; the incremental artifact contains the real working-tree delta.
