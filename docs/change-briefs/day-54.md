## Day 54 — PathAdvisor conversation robustness

### What changed

Day 54 hardened backend PathAdvisor bounded conversation against noisy, vague,
and partially out-of-context user messages without changing the frontend UI.
The centered dashboard PathAdvisor surface stayed visually identical.

### What was added

- a bounded backend-only user-message normalization helper
- conservative intent narrowing for common in-context follow-ups
- bounded unsupported-topic detection for qualification conversation
- a local short-circuit for clearly unsupported asks so the system declines
  calmly instead of drifting into generic advice
- prompt hints that help the provider stay tolerant of noisy wording while
  remaining strict about conclusions

### What improved

- typo-heavy messages like `wat does this mean` now normalize safely
- vague follow-ups like `help with that thing above` now narrow to the current
  governed state more reliably
- mixed asks like `what should i do now and should i move for this job` now
  answer the supported portion and explicitly mark relocation as unsupported
- unsupported-only asks like `should i move for this job` now return a calm,
  bounded local decline without becoming a technical failure

### Trust-boundary result

- request structure is still strict
- backend-owned truth fields are unchanged
- refusal still bypasses provider invocation
- technical failure remains distinct from refusal
- no frontend truth synthesis or UI drift was introduced in this run
