# Change Brief: PathAdvisor Dashboard Conversation Redesign

## What changed

The PathOS dashboard was redesigned from a card-grid layout ("Command Center") to
a PathAdvisor-centered conversation workspace. Instead of seeing a wall of briefing
tiles, focus cards, track previews, and signal rows, users now see:

- Compact status chips at the top (Readiness, Saved jobs, Applications, Updated)
- A centered PathAdvisor conversation canvas
- Suggested prompt chips to start a conversation
- A trust attribution note

When the user asks a question, the dashboard transitions to an active thread
showing:

- The user's question
- PathAdvisor's conversational answer
- Structured governed evidence (verdict, reasons, gaps, recommended next step)
- Action buttons (Start improvement, Open Resume Builder, See full readiness breakdown)
- A follow-up input for continuing the conversation

Files touched:
- `packages/ui/src/screens/DashboardScreen.tsx` (complete rewrite)
- `packages/ui/src/screens/DashboardScreen.test.tsx` (complete rewrite)
- `app/(shared)/dashboard/page.tsx` (simplified)
- `packages/ui/src/index.ts` (new type exports)

## Why it changed

The old dashboard layout was information-dense but lacked a clear action path. Users
saw cards for saved jobs, applications, resume progress, timeline estimates, and
readiness deltas — all competing for attention. The new design puts PathAdvisor at
the center so users have one clear entry point: ask a question, get a guided answer,
take action.

This aligns PathOS with a trust-first, explainable guidance model where every
recommendation comes with visible evidence and provenance.

## What users will notice

**Immediately visible:**
- The dashboard looks and feels completely different — calm, centered, conversation-first
- Compact status chips replace the four large briefing tiles
- PathAdvisor icon and "What would you like to figure out today?" replace the old heading
- Six suggested prompts help users get started
- No more card grids, track previews, or signal rows on the main dashboard

**When interacting:**
- Clicking a prompt chip or typing a question transitions to a conversation thread
- The response shows a clear answer followed by structured evidence
- Action buttons at the bottom of responses provide concrete next steps
- A follow-up input stays available for continuing the conversation

**Intentionally not changed:**
- The left sidebar navigation remains the same
- The top bar (PathOS / DESKTOP / LOCAL ONLY, search) remains the same
- All other routes (/dashboard/job-search, /dashboard/resume-builder, etc.) are unaffected
- The right-rail PathAdvisor on other pages is unaffected

## Validation performed

- Typecheck: PASS (0 new errors)
- Tests: PASS (12/12 DashboardScreen tests, 1739/1739 full suite)
- Lint: PASS (0 errors in changed files)
- Runtime: visual validation recommended (dark theme, 1440px and 768px viewports)

## Known risks / follow-ups

1. The current thread uses seeded demo data — real governed API integration needed
2. Multi-turn follow-up responses require backend conversation endpoint
3. Mobile viewport testing recommended for chip wrapping and thread overflow
4. The old DashboardData type is kept for backward compatibility — can be removed
   when downstream consumers (mockDashboardData, buildDashboardViewModel) migrate
5. Thread state does not persist across page navigations (intentional for this slice)
