## Day 81 - Resume Variants and Diagnostics Snapshots v1

### Summary

Day 81 adds a minimal frontend persistence foundation for explicit resume
variants and backend-owned diagnostics snapshots. The Resume Workspace now
stores diagnostics and explanation payloads per variant and revision, keeps a
stable latest snapshot pointer on each variant, and can continue rendering the
last known backend evaluation while a fresh diagnostics request is in flight.

This slice stays local-first and store-oriented. It does not add a new backend
persistence architecture, does not duplicate backend diagnostics logic, and
does not attempt comparison or history UI beyond preserving the snapshot data
needed for later work.

### Goals completed

- made resume variant identity more explicit
- introduced a first-class diagnostics snapshot model
- linked snapshots to variant and revision ids
- preserved backend diagnostics and explanation payloads in snapshots
- wired the latest snapshot into Resume Workspace rendering
- kept the live review transport state separate from saved snapshot state

### Model changes

`ResumeDraftSummary` now carries explicit variant metadata:

- `variantId`
- `sourceVariantId`
- `currentRevisionId`
- `latestSnapshotId`

New snapshot types:

- `ResumeSnapshotMeta`
- `ResumeDiagnosticsSnapshot`

Snapshot fields include:

- `snapshotId`
- `variantId`
- `revisionId`
- `diagnosticsId`
- `inputHash`
- `responseState`
- `readinessBand`
- `overallSummary`
- full backend `response`
- `evaluatedAt`
- engine, ruleset, explainability, and knowledge-pack versions

### Store behavior

The existing Resume Workspace store remains the single source of truth.

New persisted state:

- `diagnosticsSnapshots`
- `diagnosticsSnapshotIdsByVariant`

Evaluation lifecycle:

1. evaluate active resume
2. receive backend diagnostics response
3. build a diagnostics snapshot tied to the active variant and revision
4. save the snapshot in the store and update the variant `latestSnapshotId`
5. keep prior snapshots available for later comparison work

Safety rules in this slice:

- stale async responses do not silently overwrite a newer active revision
- loading a new diagnostics request does not erase the last saved snapshot
- explanation rendering continues to use backend-owned explanation objects

### UI behavior

Resume Workspace now shows:

- explicit variant and revision identity
- latest saved evaluation timing
- latest snapshot id in the diagnostics rail
- snapshot-backed explanation rendering when no fresh live response is loaded
- a clear loading message when refreshing diagnostics over an existing snapshot

No visual redesign was added in this slice.

### Validation

Targeted validation:

- `pnpm test packages/ui/src/stores/resumeWorkspaceStore.test.ts packages/ui/src/resume-workspace/resumeDiagnostics.test.ts packages/ui/src/resume-workspace/PathAdvisorResumeGuidance.test.tsx packages/ui/src/screens/ResumeWorkspaceScreen.test.tsx`
- `pnpm exec eslint packages/ui/src/stores/resumeWorkspaceStore.ts packages/ui/src/stores/resumeWorkspaceStore.test.ts packages/ui/src/resume-workspace/resumeDiagnostics.ts packages/ui/src/resume-workspace/resumeDiagnostics.test.ts packages/ui/src/resume-workspace/PathAdvisorResumeGuidance.tsx packages/ui/src/resume-workspace/PathAdvisorResumeGuidance.test.tsx packages/ui/src/screens/ResumeWorkspaceScreen.tsx packages/ui/src/screens/ResumeWorkspaceScreen.test.tsx`

Full validation:

- `pnpm test` passed
- `pnpm build` passed
- `pnpm lint` still fails due pre-existing repo-wide issues outside Day 81
- `pnpm typecheck` still fails due malformed generated `.next/dev/types/*`
  files in the current environment

### Follow-ups

- add a lightweight history or comparison surface on top of preserved snapshot
  ids rather than reworking persistence again
- stabilize the repo's DOM-capable Resume Workspace test harness so snapshot
  rendering can be tested at a fuller interaction level
- clean up repo-wide lint debt and generated Next.js type output before calling
  the wider resume workspace track merge-ready
