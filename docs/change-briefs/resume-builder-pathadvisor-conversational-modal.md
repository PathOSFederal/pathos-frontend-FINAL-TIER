# Resume Builder — PathAdvisor Conversational Modal

## What changed

The Resume Builder's PathAdvisor modal now supports real follow-up conversation. Previously, clicking "Ask follow-up" in the modal opened an input field but the response went nowhere — the modal was a dead-end explainer. Now it is a live, scoped conversation surface.

## How it works

1. **Explanation first**: When you open PathAdvisor from any trigger (issue, section, or overview), the modal still shows the same four structured explanation sections immediately:
   - What PathOS sees
   - Why it matters
   - What to do next
   - Suggested change (when available)

2. **Ask a follow-up**: Below the explanation, a compact text input lets you type a question. Press Enter or click Send.

3. **Get a contextual response**: PathAdvisor replies in-thread inside the modal. The response is grounded in your current Resume Builder context — it knows which section you are in, what issue you were looking at, your readiness score, and your target job.

4. **Keep asking**: You can ask multiple follow-up questions. All turns persist while the modal is open. When you close the modal and reopen it, you get a fresh start.

5. **Take action from replies**: When PathAdvisor's reply includes a concrete suggestion, action buttons appear below the response — Apply suggestion, Edit first, Copy text. These use the same plumbing as the existing modal footer buttons.

## What stays the same

- The main Resume Builder stays visually quiet and document-first
- PathAdvisor only appears when you ask for it
- The deterministic explanation is always the first thing you see
- Apply suggestion and Edit first buttons still work from the modal footer
- No new permanent UI surfaces were added to the builder layout
- The modal closes cleanly and returns focus to the document

## Who this is for

Users who want to go deeper than the initial explanation. The structured explainer answers the obvious question; the conversation thread handles the "but what about…" and "show me how" follow-ups.

## Technical notes

- The conversation uses a deterministic response generator grounded in Resume Builder context. It is not a generic chatbot — it references your specific issue, section, severity, and suggested fix.
- The architecture has a clean adapter boundary so a real PathAdvisor conversation API can be connected in a future pass without changing the modal UI.
- Conversation state is local to the modal lifecycle — no global store or server persistence.
