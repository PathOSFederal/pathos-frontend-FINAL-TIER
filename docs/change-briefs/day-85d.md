# Day 85d – Builder-Native Rewrite UX Fix v1

## What changed

Day 85d corrects where rewrite assistance lives in the Resume Workspace.
Rewrite help is no longer treated as a review-surface workflow. Review still
identifies that a rewrite is needed, but the actual suggestion, loading, and
apply experience now lives in the builder where the user is editing text.

The builder now:

- shows rewrite actions inside the editable summary, experience, and skills
  sections when backend recommendations support them
- opens the rewrite panel immediately when a request starts
- shows the original text and grounded target right away
- keeps loading, candidate, empty, error, and applied states inside the
  builder instead of hiding them in review
- updates the visible draft immediately when the user explicitly applies a
  candidate

Review now:

- keeps recommendation cards and section guidance
- uses rewrite copy that points back into the builder
- stops acting as the primary candidate-comparison workspace

## Why it matters

The previous flow put the rewrite trigger and candidate panel on the review
surface, even though editing only happens in the builder. That separation made
rewrite assistance feel slow, opaque, and disconnected from the text being
changed.

This fix keeps the trust model intact:

- backend diagnostics still decide whether a rewrite is grounded
- frontend still does not generate diagnostics or local rewrite scoring
- rewrites remain suggestion-only and explicit approval is still required

## What operators and reviewers should expect

- rewrite requests still require current backend diagnostics
- stale diagnostics still block rewrite launches
- review recommendations now hand users back into the builder for real editing
- apply still bumps revision state and preserves revision-content history

## What this does not do yet

- no freeform rewrite chat
- no whole-document rewrite
- no auto-apply
- no backend generation changes
- no broad builder redesign

## Trust and safety posture

This slice is a UX placement correction, not a new AI capability.

Grounding stays tied to:

- backend recommendation codes
- backend issue codes when available
- backend target refs
- current visible draft text

The frontend continues to manage only:

- request state
- panel visibility
- candidate selection
- explicit apply or dismiss behavior

## Follow-up: responsiveness and readability pass

This follow-up tightens the builder-native rewrite panel without changing the
underlying workflow placement.

What changed in this pass:

- loading now looks active immediately with a visible `Rewriting...` style
  progress cue instead of a flat waiting block
- candidate text now reveals progressively after the backend response arrives,
  so the panel feels more like a live collaborator without pretending the
  backend streamed text earlier than it actually did
- original text and candidate text now use stronger contrast treatment so both
  remain readable on the darker PathOS canvas

What did not change:

- the builder is still the only real rewrite workspace
- review is still just the handoff surface
- original text remains visible
- apply is still explicit
- no auto-apply or hidden overwrite was introduced
