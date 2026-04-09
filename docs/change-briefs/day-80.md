# Day 80 – PathAdvisor Resume Integration v1

## Summary

Day 80 upgrades the Resume Workspace from raw diagnostics rendering to
PathAdvisor-style explanation rendering. The frontend still uses the existing
backend diagnostics request and response, but the UI now prefers the backend's
`explanations` payload for summary guidance, key takeaways, section guidance,
and right-rail recommendation cards.

## What changed

- added typed explanation models to the resume diagnostics response contract
- added reusable PathAdvisor explanation components for:
  - top summary
  - key takeaways
  - section guidance
  - recommendation cards
  - subtle warnings
- replaced the review shell's primary raw diagnostics panels with explanation
  rendering
- added section-level guidance blocks inside the builder canvas so advice stays
  visually tied to resume sections
- repurposed the builder guidance rail to show backend explanation content
  instead of raw issue cards

## Data flow

- the existing store remains the source of truth
- `evaluateActiveResumeDiagnostics()` still makes the same backend call
- `review.response` still holds the backend diagnostics payload
- the UI now reads `review.response.explanations` and renders it directly
- existing target-ref focus/highlight behavior is reused for explanation cards
  that point to resume sections

## Guardrails

- no new backend contract was introduced
- no frontend scoring or recommendation logic was added
- no chat-like behavior was introduced
- missing explanation fields fail soft and fall back to calm transport-state
  messaging instead of crashing

## Tests

- added explanation component tests for summary, takeaways, section guidance,
  recommendations, warnings, and missing-field fallbacks
- updated Resume Workspace screen tests to reflect the new review shell
- extended diagnostics store tests with explanation-bearing backend responses

## Validation

- focused Resume Workspace tests passed
- `pnpm test` passed
- `pnpm build` passed
- modified-file lint passed via targeted `eslint`
- `pnpm lint` still fails because of pre-existing unrelated repo issues
- `pnpm typecheck` still fails because generated `.next/dev/types/*` files are
  malformed in the current environment
