# Day 84 – Export Readiness Gate v1

## What was added

Day 84 adds the first bounded export-readiness gate to the Resume Workspace
review shell.

The gate answers a narrow trust question:

- is this variant ready to export right now
- are the latest diagnostics still current
- what is blocking export confidence
- what is worth reviewing before export

The gate uses saved backend diagnostics plus known revision state only.

## Readiness model

Day 84 introduces a small frontend display model with these states:

- `not_evaluated`
- `stale_evaluation`
- `not_ready`
- `caution`
- `ready`

These states are derived from:

- the latest saved diagnostics snapshot
- the active variant `currentRevisionId`
- the latest snapshot `revisionId`
- saved backend issue severity
- saved backend missing evidence
- saved backend warnings
- saved backend readiness band and response state

## Why it matters

Before this slice, the workspace could show diagnostics, history, and revision
diffs, but it still did not answer the user’s practical export question in one
clear place.

Day 84 adds that trust layer without:

- building the export engine
- recomputing diagnostics
- inventing frontend scoring
- hiding stale evaluations

## Blocking versus caution

Blocking is intentionally narrow and deterministic:

- no saved evaluation
- stale evaluation relative to the current revision
- backend `insufficient_input`
- backend `unsupported_context`
- backend `insufficient_evidence`
- high-severity backend issues

Caution is also bounded:

- medium-severity backend issues
- backend missing evidence items
- backend warnings
- current evaluation with remaining non-blocking concerns

Low-severity issues are not upgraded into blockers by the frontend.

## UI behavior

The export-readiness card lives near the top of review mode so it is visible
before the user has to inspect compare history or deeper guidance.

It shows:

- current export-readiness state
- last evaluated timestamp
- whether the evaluation is current or stale
- revision linkage
- blocking items
- caution items
- a clear next action

## What this does not do yet

This slice does not add:

- PDF or DOCX export implementation
- backend changes
- new diagnostics rules
- automatic re-evaluation
- any attempt to guess current readiness when diagnostics are stale

## Trust and safety posture

Day 84 preserves trust by refusing to treat stale diagnostics as current.

If the latest snapshot does not match the current revision, the UI says so
explicitly and blocks export confidence until the user re-runs evaluation.

That keeps export readiness grounded in saved backend truth plus known revision
state, instead of frontend guesswork.
