## PathAdvisor Conversational Shell Restoration

PathAdvisor now has a clearer conversational entry point again in the shared
dashboard rail.

### What changed

The input box was restored so people can ask PathAdvisor follow-up questions in
the same rail where the governed result appears.

The governed panel still remains in place. It still shows the structured
governed answer, including the summary, explanation, key factors, missing
inputs, next steps, and trust metadata.

The conversation and the governed panel now work together:

- the conversation is the friendly explanation layer
- the governed panel is the visible evidence layer

### Why the input was restored

The previous pass made PathAdvisor feel too much like a governed-results
inspector. That was accurate, but it drifted away from the intended product
experience.

PathAdvisor should still feel like something users can talk to. Restoring the
composer brings that conversational feel back without changing the governed
backend truth model.

### Why the governed panel still remains

The governed panel is still important because it shows where the answer comes
from and whether it is grounded, incomplete, or intentionally refused.

Keeping that panel visible helps users understand the trust boundary instead of
seeing only chat-like text.

### Why PathAdvisor explains governed results instead of replacing them

PathAdvisor is not the truth source. RIS and the governed backend contract
remain the source of truth.

The conversational layer helps users understand the current governed result, but
it does not replace the governed response or invent new certainty outside the
approved data.

### Still out of scope

This update does not add a full chat system, memory, thread persistence,
backend LLM integration, profile orchestration, or a broader dashboard redesign.
It is a focused restoration of the conversational shell on top of the existing
governed PathAdvisor rail.
