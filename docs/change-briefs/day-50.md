# Day 50 — Bounded dashboard PathAdvisor conversation wiring

**Date:** April 3, 2026  
**Type:** Frontend contract fix / dashboard conversation wiring

---

## What Changed

The centered dashboard PathAdvisor composer now uses the real bounded backend
conversation route. The old local seeded reply loop remains only as a fallback
for non-dashboard preview contexts. The dashboard page owns the governed fetch,
bounded conversation request, and honest request-state handling without any
visual changes.

### 1. Fixed the 422 request-shape mismatch

- Rebuilt the bounded conversation request helper to match the backend schema
  exactly.
- The top-level request now sends only:
  - `route`
  - `domain`
  - `user_message`
  - `governed_context`
  - optional `trust_state`
  - optional `entity`
  - optional `draft_inputs`
- Removed old or invalid fields such as:
  - `context`
  - `request_id`
  - `history`
  - `messages`
  - `threadId`
  - `uiText`
  - `renderedText`
- The payload now uses snake_case only and includes the required
  `governed_context.grounding` fields:
  - `domain`
  - `response_state`
  - `grounded`
  - `partial`
  - `conversation_provider`
  - `provider_used`
- Corrected `draft_inputs` to match the backend's strict list-only contract.
- The frontend no longer sends raw nested draft objects such as:
  - `draft_inputs.qualification`
  - `draft_inputs.fehb`
- `draft_inputs` is now:
  - omitted by default for the centered dashboard PathAdvisor flow, or
  - included only with backend-accepted list fields:
    - `focus_topics`
    - `selected_missing_inputs`
    - `selected_next_steps`

### 2. Preserved the thin frontend proxy

- The same-origin route at `/api/pathadvisor/conversation` validates the exact
  bounded shape and rejects extra keys before forwarding.
- The proxy forwards the JSON body unchanged to
  `/api/v1/pathadvisor/conversation`.
- Backend response fields are passed through without frontend remapping of
  business truth.

### 3. Moved the live conversation flow onto the dashboard-centered PathAdvisor

- The primary dashboard route now owns the live governed conversation behavior.
- The centered dashboard composer triggers:
  - governed explain fetch when no governed result is present yet
  - bounded conversation request using that backend-shaped governed response
- The dashboard PathAdvisor no longer depends on the temporary local reply path.

### 4. Kept trust-boundary states honest

- Refused remains a trust-boundary state, not a technical error.
- Partial remains distinct from failure.
- Technical conversation failure does not erase current governed evidence.
- The governed evidence surface stays visible during send and after technical
  failure.
- Disabled explanation capability remains separate from refusal.

### 5. Added coverage for the corrected contract and dashboard surface

- Request-builder tests lock the exact bounded JSON shape.
- Request-builder tests verify `draft_inputs` is omitted when only raw domain
  draft state exists.
- Request-builder tests verify `draft_inputs` is included only when explicit
  backend-safe list hints are provided.
- Proxy tests assert deep-equal forwarded JSON and rejection of old widened
  shapes.
- Proxy tests verify forwarded payloads do not contain
  `draft_inputs.qualification` or `draft_inputs.fehb`.
- Client tests assert no send occurs without governed context and that the
  forwarded body matches the strict contract.
- Dashboard tests cover loading/error request-state handling and the mapping of
  partial and refused backend responses into the existing governed evidence
  surface.

---

## Why This Matters

This keeps PathAdvisor inside the trust boundary. The frontend uses governed
truth that already came from the backend, sends only the bounded structured
context the backend accepts, and treats conversation output as explanation text
rather than new truth.

---

## Technical Notes

- No layout, spacing, typography, color, animation, or structural UI changes
  were made.
- No backend schema or behavior was widened.
- No history, memory, prompt-building, or generic chat payloads were added.
- The live dashboard PathAdvisor owner for this flow is
  `app/(shared)/dashboard/page.tsx`.
