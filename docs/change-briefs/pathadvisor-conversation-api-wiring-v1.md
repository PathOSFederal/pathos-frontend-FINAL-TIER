## PathAdvisor Conversation API Wiring

PathAdvisor in the shared dashboard rail now sends conversation requests
through a real backend conversation path.

### What changed

The PathAdvisor composer no longer relies on a temporary local frontend reply.
When someone types into the composer, the frontend now sends the user message
plus bounded structured governed context to a backend conversation route.

The governed panel still remains visible in the rail. It continues to show the
governed answer, trust state, missing inputs, next steps, and grounding
metadata.

### Why the temporary local reply path was replaced

The local reply bridge was acceptable as a short-term placeholder, but it let
the frontend act too much like a second reasoning layer.

Replacing it with a real backend conversation call keeps PathAdvisor in the
right role: a conversational explanation layer over governed truth, not a
separate truth engine in the browser.

### How this improves trust

This improves trust because the frontend is no longer generating its own
follow-up explanation locally.

Instead, it sends only structured governed context and the user’s message to
the backend conversation layer. That keeps the conversation tied to the same
governed truth boundary as the panel.

### Why the governed panel still remains important

The governed panel is still the evidence surface. It shows whether the answer is
grounded, incomplete, or intentionally refused, and it exposes the important
governed details that support trust.

The conversation layer helps explain that governed result, but it does not
replace the panel or hide the trust state.

### Still out of scope

This update does not add memory, thread persistence, a full chat system,
profile orchestration, or a broader redesign. It is a focused wiring pass that
replaces the local conversation placeholder with a real backend conversation
path while keeping the existing governed PathAdvisor rail structure.
