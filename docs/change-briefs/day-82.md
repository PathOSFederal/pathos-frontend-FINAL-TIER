# Day 82 – Resume Snapshot History and Compare UX v1

## What was added

Day 82 adds the first user-facing snapshot history and compare experience to
the Resume Workspace review shell.

The active variant can now:

- show saved diagnostics snapshots in a compact history panel
- select which saved snapshot is currently being viewed
- choose a second saved snapshot as a compare baseline
- show a bounded compare summary using saved backend data only

The compare view stays calm and high-signal. It shows:

- readiness improved, unchanged, or regressed
- category score changes
- added and resolved issue codes
- added and resolved recommendation codes
- saved PathAdvisor explanation continuity, including overall summary and top
  priority changes

## Why it matters

Day 81 established snapshot persistence, but users still had no clear way to
inspect that history.

Day 82 turns the saved backend snapshots into usable review context without:

- re-running diagnostics
- inventing new diagnostics logic in the frontend
- redesigning the whole workspace

This gives users a clear answer to:

- what was my last evaluation
- what changed since the prior one
- did readiness improve or regress

## What changed in the frontend architecture

The existing persisted Resume Workspace store now carries bounded compare UI
state inside the review shell state:

- `selectedSnapshotId`
- `compareSnapshotId`
- `isCompareMode`

This keeps snapshot history and compare mode inside the existing workspace
store instead of introducing a second store or a new persistence system.

Day 82 also adds:

- a pure snapshot compare helper for deterministic saved-value comparison
- a compact snapshot history panel
- a bounded snapshot compare panel

## What it does not do yet

This slice does not:

- recompute diagnostics during compare
- diff the actual resume body text
- add export history
- add collaboration or thread memory
- add backend changes

It also does not reinterpret backend codes or generate new explanation prose.
It only compares saved backend-owned values.

## Trust and safety posture

This slice preserves trust by staying inside the saved backend snapshot
boundary.

The frontend only computes bounded labels from saved values, such as:

- improved
- unchanged
- regressed
- added
- resolved

It does not:

- fabricate scores
- invent explanation changes
- create new diagnostics findings
- move diagnostics reasoning into the client

That keeps PathAdvisor continuity grounded in persisted backend outputs.
