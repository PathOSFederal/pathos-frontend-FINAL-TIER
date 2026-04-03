# PathAdvisor Conversation History

## What changed

Users can now save and revisit PathAdvisor conversations on the Dashboard.
Conversation history is tucked into a dedicated "Recent conversations" area
at the bottom of the sidebar, keeping core navigation stable and visually
primary.

### New capabilities

- **Start new conversations**: Click "+ New conversation" near the top of the
  sidebar (just below Dashboard) to begin a fresh PathAdvisor session.

- **Automatic saving**: Conversations are automatically saved when you send your
  first message. No manual save step needed.

- **Thread navigation**: Recent conversations appear in a collapsible section at
  the bottom of the sidebar. Click any thread to return to that conversation.

- **Persistent workspace**: Conversations survive page refresh and navigation.
  Return to the Dashboard and your last conversation is still there.

### How it works

- The Dashboard remains the single PathAdvisor surface — no new pages or routes.
- Clicking "+ New conversation" clears the current conversation and shows the
  PathAdvisor empty state with suggested prompts.
- Sending your first message creates a new conversation thread with an
  auto-generated title based on your question.
- The sidebar shows your recent conversations in a collapsible section at the
  bottom, with the active one highlighted.
- Clicking a conversation in the sidebar loads it into the Dashboard.
- The "Recent conversations" section can be collapsed to keep the sidebar clean.

### Sidebar information architecture

The sidebar now has three clear zones:

1. **Top zone**: Brand header, Dashboard, Career Readiness, and the
   "+ New conversation" button. Starting a new PathAdvisor session is always
   quick and easy — it's one click from the top of the sidebar.

2. **Main navigation**: All core product routes (Job Search, Saved Jobs,
   Resume Builder, Resume Readiness, Application Confidence Center, Guided Apply,
   Explore Federal Benefits, Benefits Workspace, Alerts Center, Import Center,
   Settings). These routes are never displaced by conversation history.

3. **Bottom zone**: "Recent conversations" (collapsible) and user identity card.
   Saved threads live here because they are user-generated workspace artifacts,
   not primary navigation destinations.

### Bounded scroll for conversation history (hardening — 2026-04-03)

The Recent conversations section now stays bounded even when you have many saved
threads. The conversation list scrolls internally within a fixed-height container
so it never overwhelms the sidebar or pushes core navigation off-screen.

- Long thread lists no longer crowd the sidebar layout
- The "Recent conversations" header always stays visible above the scroll area
- Core navigation remains stable regardless of how many conversations exist
- Collapse/expand behavior is unchanged
- Active thread highlighting still works inside the scrollable list

### What didn't change

- Summary chips, governed response rendering, and action buttons work the same.
- The PathAdvisor right rail on other pages is unaffected.
- No new routes were added — the Dashboard is still `/dashboard`.
- Core navigation remains visually stable and positionally anchored regardless
  of how many conversations the user has saved.
- Thread creation, persistence, and switching logic are completely unchanged.

## Why

PathAdvisor is the primary interaction surface of the Dashboard. Without
conversation persistence, every page refresh or navigation lost the user's
context. This made PathAdvisor feel disposable rather than trustworthy. With
thread history, the Dashboard becomes a persistent workspace where users can
build on previous analysis and return to important conversations.

The original implementation placed saved threads at the top of the sidebar,
which was correct for signaling that PathAdvisor is first-class, but in
practice it pushed core product routes down. The refinement moves threads to
a collapsible bottom section so core navigation remains stable while
starting a new conversation remains quick and easy.
