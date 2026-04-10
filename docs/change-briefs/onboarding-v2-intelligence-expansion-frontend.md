# Onboarding v2 Intelligence Expansion Frontend

## What changed
- Added calm dashboard UI for backend-owned prioritized next-question guidance.
- Added a backend-owned profile completeness panel with section progress and valuable missing-detail prompts.
- Added post-insight guided enrichment cards and structured Job Search and Resume Builder handoff cards.
- Kept onboarding embedded inside the real dashboard shell and continued rendering only backend-provided questions, insights, enrichment, and handoff state.

## Why it changed
- Onboarding v1 could collect correct facts, but it still felt like a bounded intake form instead of an intelligent guided PathAdvisor flow.
- PathAdvisor needed to explain why a question was worth answering, what a missing detail would unlock, and which workspace should come next without shifting decision logic into the frontend.
- The frontend needed to make the backend’s deterministic prioritization and completeness model feel useful rather than bureaucratic.

## What the user will notice
- After the first insight, PathAdvisor now explains the most useful next question instead of only showing a flat next prompt.
- Users now see a compact completeness surface tied to recommendation quality rather than a generic progress bar.
- Guided enrichment stays visible after first insight, and downstream handoffs into Job Search or Resume Builder now feel connected to onboarding facts.
- The dashboard still stays calm and resumable, with answer-later and backend-owned edit flows preserved.

## Validation performed
- `pnpm test -- components/dashboard/PathAdvisorOnboardingExperience.test.tsx components/dashboard/PathAdvisorOnboardingGate.test.tsx lib/onboarding/client.test.ts` passed.
- `pnpm test` passed with `90` files and `1886` tests passing.
- Scoped onboarding eslint run passed.
- Full `pnpm lint` still fails outside this slice in existing resume-builder and resume-readiness files.
- Full `pnpm typecheck` still fails outside this slice in existing `packages/ui/src/resume-builder/**` and `packages/ui/src/resume-workspace/**` files.

## Known risks / follow-ups
- The handoff cards currently deep-link with bounded route context only; they do not yet seed richer downstream store payloads.
- The frontend intentionally does not compute any fallback prioritization if the backend omits those fields, so incomplete backend payloads degrade to a simpler UI.
- Full repo lint and typecheck remain blocked by unrelated existing failures outside onboarding.
