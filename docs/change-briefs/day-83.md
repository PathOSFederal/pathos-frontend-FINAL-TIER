# Day 83 – Resume Revision Diff UX v1

## Readiness reality

At the start of Day 83, the Resume Workspace was not yet ready for a real
content-level revision diff.

The store already had:

- explicit `currentRevisionId`
- diagnostics snapshots tied to revisions
- snapshot compare UI

But it did **not** preserve resume-body content for older revisions. That
meant the frontend could not honestly diff resume content between revisions
without adding a small revision-content snapshot model first.

## What was added

Day 83 adds the minimum safe revision-content snapshot foundation and then
builds the first calm revision diff UX on top of that real saved data.

New data foundation:

- persisted `revisionContentSnapshots`
- persisted `revisionContentIdsByVariant`
- automatic seeding of the current revision content for each variant
- automatic capture of a new revision-content snapshot whenever a draft edit
  bumps `currentRevisionId`

New UX:

- a bounded `Revision diff` panel in the review shell
- section-level changed / unchanged visibility
- item-level added / removed / edited visibility
- calm summary counts for changed sections and changed items

## Why it matters

Day 82 could explain diagnostics changes, but it could not show the actual
resume content changes that led to them.

Day 83 closes that gap without:

- inventing resume-body changes from diagnostics
- introducing a new persistence system
- turning the workspace into a raw git-style diff viewer

The diff now stays grounded in saved revision content snapshots.

## How the diff works

The revision diff uses saved revision-content snapshots only.

It compares:

- `contact`
- `summary`
- `experience`
- `education`
- `skills`

The logic is intentionally simple and auditable:

- exact / normalized text comparison
- id-based matching where structured ids already exist
- line-index comparison for experience duty bullets
- added / removed / edited classification only

It does **not** do semantic rewrite detection or AI-generated change prose.

## What this does not do yet

This slice does not add:

- a rich-text diff engine
- a full resume body side-by-side viewer
- export diffing
- backend changes
- semantic change explanations

It also does not backfill older historical revisions that were never saved as
content snapshots before this slice.

## Trust and safety posture

Day 83 preserves trust by being honest about data availability:

- revision diff only works from real saved revision-content snapshots
- diagnostics changes are not treated as proof of resume-body changes
- the diff uses deterministic comparison only

That keeps the review shell grounded in actual saved resume content instead of
frontend guesswork.
