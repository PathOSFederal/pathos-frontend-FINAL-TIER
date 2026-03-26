# Resume Builder Phase 2 — Change Brief

**Date:** March 25, 2026  
**Branch:** `feature/backend-usajobs-ingestion-v1`  
**Scope:** Resume Builder Phase 2 — Suggested Changes, Coverage Map, target-job hardening

---

## What Suggested Changes now does

The Suggested Changes tab is now a real proposal review workspace. When a target job is selected, the system generates a set of grouped improvement proposals for the active resume. Each proposal includes:

- A clear title and the affected resume section
- A confidence level (color-coded by score tier)
- A "needs confirmation" badge when the change requires careful review
- A before/after content comparison showing the current text and the proposed replacement
- A brief reason explaining why the change is recommended
- A supported requirement cue (e.g., "Supports leadership/scope requirement")
- Three actions: **Accept** (applies the change), **Dismiss** (removes without changing the resume), and **Edit First** (loads the suggested content into the Edit tab for manual adjustment)

Proposals are grouped by section (Professional Summary, Work Experience, Federal Details, Skills). The summary header at the top shows the pending count, average confidence, and the strongest proposal category.

The proposal types currently generated include:
- Add Professional Summary (when missing)
- Strengthen Leadership Bullet in Work Experience
- Complete Federal Employment Details
- Expand Specialized Experience Phrasing
- Improve Keyword Coverage for Target Job (only when a target job is selected)

Accepting a proposal applies the suggested text to the active resume version. For summary proposals, it sets the professional summary. For bullet proposals, it finds and replaces the matching duty line. Dismiss removes the proposal from the queue without any resume changes.

## What Coverage Map now does

The Coverage Map tab is now a real actionable diagnostic surface. It shows how the active resume aligns to the active target job across five dimensions:

1. **Specialized Experience** — How well the resume demonstrates the specialized experience requirements
2. **Resume Evidence** — Overall strength of supporting evidence (boosted when a professional summary is present)
3. **Keywords Coverage** — Whether target-specific terms appear in the resume
4. **Leadership / Scope** — How clearly the resume demonstrates supervisory and leadership scope
5. **Federal Details** — Completeness of federal-specific employment fields

Each dimension shows:
- A score percentage with a color-coded progress bar
- A severity badge (Strong / Moderate / High Priority)
- A short status summary explaining what is weak or strong
- The linked resume section where the signal comes from
- Action buttons: **Review proposals** (switches to Suggested Changes), **Jump to section** (switches to Edit and scrolls), **Edit section** (same)

The overall summary header shows the average coverage score, the number of high-priority gaps, and which dimension is weakest.

When no target job is selected, all dimensions show 0% with a "select a target job" prompt.

## How target-job switching affects guidance without rewriting the resume

When the user selects a different target job from the dropdown:

1. The broader proposal set is **regenerated from scratch** — all proposals reset to pending with content tailored to the new target
2. Coverage Map dimensions are **recalculated** — the Resume Evidence dimension responds to whether a summary exists; dimension scores and status summaries update
3. The intelligence strip updates match score, readiness score, and top gap to reflect the new target context
4. PathAdvisor rail content updates to reflect the active tab
5. The context strip proposal count updates
6. The tab badge on Suggested Changes updates

**The resume text itself is never changed by switching targets.** Only the analysis and recommendations change. This preserves the trust-first principle: the user's content is never silently modified.

## What changed in PathAdvisor integration

PathAdvisor rail content is now tab-aware:
- In **Edit**: emphasizes the weakest bullet and suggests rewriting it
- In **Suggested Changes**: emphasizes proposal review and the highest-confidence proposal
- In **Coverage Map**: emphasizes the biggest gap (Federal Details at 30%) and suggests fixing it first

Quick prompts remain the same across all tabs since they are generic resume improvement actions.

## Phase 1 hardening included in this run

- Removed static `badge: 8` from the Suggested Changes tab definition; badge count is now driven by live proposal state
- Fixed version count pluralization ("1 version" vs "2 versions")
- Replaced all hardcoded mock intelligence values (match score, readiness, top gap, proposal count) with computed values derived from the proposal and coverage dimension state
- Tab placeholder for Suggested Changes and Coverage Map replaced with real implementations
- Preview and Version Diff tabs now show "coming soon" messaging instead of generic placeholders

## What remains deferred for later phases

- **Preview tab** — formatted resume preview for reviewers
- **Version Diff tab** — compare changes between resume versions
- **Deterministic analysis engine** — match scores, health states, and coverage dimensions currently use deterministic local logic; a real NLP/analysis engine will replace this
- **Full Tailor to Job automation** — creating a tailored draft version from the target job
- **Federal Details editing** — accepting the federal details proposal marks it as accepted but does not yet auto-populate the underlying model fields
- **Keyword proposal auto-apply** — accepting the keywords proposal marks it as accepted but does not yet add skills to the model
- **Real version management** — create, restore, compare resume versions
- **Backend integration** — all analysis is local-only; no remote computation

---

*This change brief describes the Resume Builder Phase 2 implementation. No commits or pushes were made.*
