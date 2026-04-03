## PathAdvisor Trust and Input Completion Refinement

PathAdvisor already used the real governed backend API. This update makes the
shared dashboard experience easier to trust and easier to act on.

### What changed

Partial answers now read as incomplete instead of final. The UI calls that out
clearly, shows the missing inputs as the reason the answer is incomplete, and
frames the next steps as the path to completion.

Refused answers now read as intentional safety boundaries instead of looking
like something broke. When the backend returns a refusal reason, the UI shows
it directly and explains that PathAdvisor is intentionally holding the answer
until governed coverage or inputs support it safely.

Missing inputs are now easier to scan. Instead of showing raw field names in a
plain list, the UI gives each missing input a clearer label, a short
explanation of why it matters, and a lightweight action that points the user
back to the existing bounded input area.

Request transitions also feel steadier. When a new governed request is loading,
the UI keeps the previous governed answer visible until the updated response
returns, so the rail does not flash empty.

The trust footer was also tightened so the governed metadata stays compact but
still visible, including domain, state, grounded flag, pack reference, and
freshness.

### Why this helps trust

This makes PathAdvisor feel more honest. Users can now tell more quickly
whether an answer is complete, incomplete, intentionally refused, or affected
by a technical failure.

The UI continues to rely only on structured backend fields. It does not invent
confidence, parse explanation text for hidden meaning, or imply that PathAdvisor
itself is the source of truth.

### States that are now clearer

- Grounded answers still read as normal governed answers.
- Partial answers now read as incomplete and point to what is missing.
- Refused answers now read as intentional trust boundaries.
- Technical failures still read as system problems, not refusals.
- Loading keeps a more stable feel during refresh.

### Still out of scope

This update does not add chat memory, thread persistence, profile
orchestration, backend contract changes, or a broader PathAdvisor redesign.
It is a focused UX refinement pass on the existing governed PathAdvisor rail.
