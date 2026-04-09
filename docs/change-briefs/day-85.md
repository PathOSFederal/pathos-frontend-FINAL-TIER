# Day 85 – Resume AI Rewrite Assistance v1

## What was added

Day 85 adds the first bounded rewrite-assistance workflow to the Resume
Workspace review shell.

Users can now:

- launch rewrite help from grounded backend recommendation cards
- request bounded rewrite candidates for a specific summary, skills target, or
  experience bullet
- review original text alongside 1–3 candidate rewrites
- explicitly apply one candidate or dismiss the panel

The workspace also now includes a same-origin rewrite proxy route:

- `POST /api/resume/rewrite-assist`

That route validates a diagnostics-grounded payload and forwards it to the
future backend rewrite path:

- `/api/v1/resume/rewrite-assist/generate`

## Why it matters

This slice adds a real approval-based rewrite workflow without breaking the
trust model established in Days 76–84.

PathOS does not let the frontend invent rewrite logic or mutate content
silently. Every rewrite request is tied to saved backend diagnostics truth and
current revision state, and every applied rewrite creates a new revision.

## What operators and users should expect

- rewrite actions appear only on grounded recommendation cards
- rewrites are available only when the user is looking at the latest current
  diagnostics snapshot
- stale or historical diagnostics disable rewrite launching and tell the user
  to re-run diagnostics first
- if the backend rewrite path is unavailable, the panel shows an explicit
  unavailable/error state instead of fabricating local text

## What this does not do yet

- no full-document rewrite
- no autonomous editing
- no hidden frontend scoring or candidate ranking
- no backend rewrite endpoint implementation in this repo
- no use of the old deterministic resume-builder suggestion helpers

## How trust and safety are preserved

- requests are anchored to backend recommendation codes, matched issue codes,
  target refs, and original visible text
- the frontend never generates its own candidate text
- the same-origin proxy validates the bounded payload shape
- the user must explicitly choose a candidate before any draft content changes
- applying a candidate bumps revision state so stale diagnostics remain visible
  as stale until re-run
