# Resume Builder UX Compression — Change Brief

**Date:** March 25, 2026  
**Branch:** `feature/backend-usajobs-ingestion-v1`  
**Scope:** Resume Builder UX compression and decision-first refinement pass

---

## How Resume Builder became easier to scan

Resume Builder now opens with a **Resume Brief** strip at the top of the Edit tab. This compact row shows five key numbers at a glance: readiness score, match score, biggest blocker, fastest win, and pending proposal count. Users can understand where they stand in about 3 seconds without scrolling or reading multiple panels.

The old "intelligence strip" with its dense target-job metadata has been replaced by this calmer summary layer. The same data is still available — it just leads with what matters instead of showing everything at once.

Copy across the workspace has been trimmed. Labels like "Direct edits save to this version" are now just "Auto-saves." Bullet action buttons say "Expand" and "Add federal detail" instead of longer phrases. PathAdvisor coaching text is shorter and more direct.

## How suggestions are now easier to review without overwhelm

The Suggested Changes tab defaults to **collapsed proposal rows** instead of fully expanded cards. Each row shows the proposal title, impacted section, confidence percentage, impact level (High / Medium / Low), estimated score gain, and three quick buttons: Apply, Review, and Explain.

Only one proposal can be expanded at a time. When the user clicks Review, the full detail panel opens below that row with the before/after comparison, reason, supported requirement, and Edit First / Dismiss / Apply actions. Expanding a different proposal automatically collapses the previous one.

This means the user sees the full queue as a scannable list and only dives into detail when they choose to. The summary header above the queue still shows the pending count, average confidence, and top category.

## How Coverage Map is more visual and less text-heavy

The Coverage Map tab now defaults to **compact dimension cards** that show just three things: score chip, severity/action badge (Fix now / Review / On track), and a one-line action hint. The full detail — progress bar, status summary, source section, and action buttons — only appears when the user expands a dimension.

Like Suggested Changes, only one dimension can be expanded at a time. This keeps the default view short and decisive. The user sees all five dimensions on screen without scrolling and can quickly identify which one needs attention.

## How PathAdvisor continues to provide deeper explanations

The page no longer carries long explanatory paragraphs in proposal cards or dimension descriptions by default. Instead, the **Explain** button on each collapsed proposal row and PathAdvisor's rail content handle deeper "why" questions.

PathAdvisor's tab-aware content has been tightened:
- In Edit: points at the weakest bullet and says "Fix now"
- In Suggested Changes: points at the top proposal and says "Review fixes"
- In Coverage Map: points at the biggest gap and says "Fix now"

The role split is clearer: **the page summarizes, prioritizes, and surfaces actions.** PathAdvisor explains, justifies, and coaches.

## What remains for later phases

- Preview tab (formatted resume view for reviewers)
- Version Diff tab (compare resume versions)
- Deterministic analysis engine (real NLP-based scores replacing mock values)
- Full Tailor to Job automation
- Federal Details editing and keyword auto-apply
- Real version management
- Backend integration for intelligence computation
- Further interaction polish (animations, drag-to-reorder proposals)

---

*This change brief describes the Resume Builder UX compression pass. No commits or pushes were made.*
