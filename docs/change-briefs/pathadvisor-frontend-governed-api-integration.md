# PathAdvisor Frontend Governed API Integration

## What changed
PathAdvisor in the shared dashboard rail now uses the real governed backend API instead of the old local-only demo reply loop.

Users can now request three bounded explanation types:
- qualification
- FEHB
- cross-domain reasoning

The rail sends only the minimum bounded inputs needed for those governed backend routes and then renders the shaped response contract directly.

## What grounded, partial, and refused mean in the UI
- `grounded` means PathAdvisor had a governed pack and enough input to give a normal answer.
- `partial` means PathAdvisor had governed pack data, but some user input was missing, so the answer is intentionally limited.
- `refused` means PathAdvisor could not answer safely because a required governed domain or required inputs were unavailable.

These states are now visible in the UI as clear labels with explanatory text. The frontend no longer implies certainty when the backend returns a partial or refused answer.

## What the UI shows now
The governed PathAdvisor panel now separates the response into:
- Summary
- Explanation
- Key factors
- Missing inputs
- Next steps
- Grounding and status metadata

The trust footer also shows:
- domain
- response state
- whether the answer is grounded
- pack version reference
- freshness state

This keeps trust signals visible without forcing users to read raw JSON or parse a wall of text.

## Why this improves trust
The old rail behavior used a simulated frontend reply that looked conversational but was not tied to governed backend truth.

The new flow makes the product more honest:
- PathAdvisor is shown as a conversational renderer over governed results
- the backend trust state is visible
- refusal and technical failure are distinct
- missing inputs are explicit instead of hidden behind vague wording

That means users can better understand when PathAdvisor is grounded, when it is limited, and when it cannot answer safely.

## What remains intentionally out of scope
This slice does not add:
- chat memory or thread persistence
- broad PathAdvisor redesign
- profile auto-load orchestration beyond the minimum frontend defaults used in the rail
- advanced FEHB optimization workflows
- broader dashboard redesign
- backend changes outside the thin frontend proxy boundary
