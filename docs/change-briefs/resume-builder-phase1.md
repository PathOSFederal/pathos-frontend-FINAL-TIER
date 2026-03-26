# Resume Builder Phase 1 — Change Brief

**Date:** March 25, 2026  
**Branch:** `feature/backend-foundation-hardening-v1`  
**Scope:** Resume Builder workspace Phase 1 implementation

---

## What changed in Resume Builder

Resume Builder was previously a simple two-pane form editor with a live preview. It has been restructured into a real workspace with:

- A **top workspace bar** with resume version selector, target job selector, autonomy mode toggle, version count, export button, and a Tailor to Job primary action.
- A **context strip** showing what you're editing, how edits are saved, and what mode is active.
- A **left sections rail** listing all resume sections (Contact, Professional Summary, Work Experience, Education, Skills, Federal Details, Certifications, Supporting Evidence) with completion bars, issue counts, and target relevance indicators.
- A **tabbed center panel** with Edit as the primary tab, plus scaffolded tabs for Suggested Changes, Coverage Map, Preview, and Version Diff.
- An **intelligence strip** above the resume canvas showing target job match score, readiness score, top gap, and proposal summary.
- A **structured resume canvas** that looks like a real federal resume document, with editable sections, a contact header, and individual bullet points.

## How target job selection now works

Users can select a target job directly from the Resume Builder top bar. The dropdown is sourced from the user's saved jobs (the same data behind the Saved Jobs screen). When a target job is selected:

- The intelligence strip updates to show match and readiness scores against that job.
- Section relevance percentages in the left rail reflect alignment to the target.
- PathAdvisor context updates to provide resume-specific guidance.

Changing the target job does **not** auto-modify the resume. It only changes what the intelligence layer evaluates against.

## How direct editing differs from suggestions

Resume Builder separates two kinds of changes:

1. **Direct edits** — The user clicks on any bullet or section and edits the text directly. These changes save immediately to the active resume version. The user is always in control.

2. **Suggestions** — In Assisted mode, the system identifies weak or generic bullets and offers inline rewrite suggestions. Each suggestion appears as a card directly below the relevant bullet with three actions:
   - **Accept** — applies the suggested text to the resume.
   - **Edit First** — loads the suggested text into an editable state so the user can modify it before saving. The original text is preserved until the user explicitly saves.
   - **Dismiss** — closes the suggestion without making any changes.

Suggestions never silently overwrite content. The user must take an explicit action for any change to apply.

## What is implemented now vs deferred for later

### Implemented in Phase 1
- Full Edit tab experience with structured resume canvas
- Target job selector from saved jobs
- Left rail with section completion, issues, and relevance
- Intelligence strip with match/readiness scores
- Work experience with individual bullet health states (Strong, Weak, Generic)
- Inline rewrite suggestion card with Accept / Edit First / Dismiss
- Professional summary missing state with high-impact messaging
- Autonomy mode toggle (Manual / Assisted)
- PathAdvisor route-aware content (insights, prompts, next best action)
- Tab structure with proper content matching
- 14 passing tests covering helpers, structure, and bullet health

### Deferred for later phases
- Suggested Changes tab (full proposal review queue)
- Coverage Map tab (resume-to-job requirement mapping)
- Preview tab (formatted resume preview for reviewers)
- Version Diff tab (compare resume versions)
- Deterministic analysis engine (match scores, health states computed from content)
- Full Tailor to Job automation (create tailored draft version)
- Federal Details and Certifications editing
- Real version management (create, restore, compare)
- Backend integration for intelligence computation

---

*This change brief describes the Resume Builder Phase 1 implementation. No commits or pushes were made.*
