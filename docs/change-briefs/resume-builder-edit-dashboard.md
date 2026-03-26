# Resume Builder Edit Tab — Section Dashboard Redesign

**Date:** March 26, 2026
**Branch:** `feature/resumeBuilder`
**Scope:** Edit tab structural redesign — section dashboard, focused section editor, noise reduction

---

## What Changed

### Edit now starts with a Section Dashboard

Previously, opening the Edit tab immediately showed one section's editor (selected via a left sidebar). Now, Edit opens to a **Section Dashboard** — a grid of cards showing every resume section with its health status at a glance.

Each card displays:
- The section name and icon
- A status badge (Strong, Moderate, Missing, Needs Work, or Critical)
- A progress bar showing completion
- A compact metric (e.g. "2 issues", "80% complete", "Not started")

This helps the user answer: *Where should I work first? What's weakest? What's strong?*

### Users can open one section at a time for focused editing

Clicking any section card on the dashboard opens a **Focused Section Editor** that shows only that section's editing surface. A clear "Back to sections" control at the top lets the user return to the dashboard at any time.

This creates a calm two-state workflow:
1. **Dashboard** — see the big picture, pick where to work
2. **Focused Editor** — work on one section without distraction

### Redundant context bars were removed

The old "You are editing: Master Resume · Auto-saves · Assisted mode · 5 pending" strip has been removed. This information was redundant — the user already knows what they're editing from the workspace header and other controls.

Instead, a **compact Live Score Anchor** now sits at the top of the Edit workspace. It shows only:
- Match score (with color-coded chip)
- Readiness score (with color-coded chip)
- The biggest blocker (one short line)

This gives the user the most important information without consuming premium screen space.

### The left section organizer was removed

The left-side section organizer has been removed from the Edit tab layout. It behaved too much like a second navigation rail alongside the app nav, workspace tabs, and PathAdvisor rail — creating visual saturation.

The Section Dashboard now fulfills the same purpose more effectively: showing section health and letting the user choose where to work, but in the center of the workspace rather than as a competing sidebar.

### PathAdvisor still helps explain what to do next

PathAdvisor remains unchanged and continues to:
- In dashboard state: reinforce the highest-priority section to work on
- In focused editor state: explain why the current section matters and what to improve
- Handle deeper explanation so the main workspace stays calm

---

## How This Reduces Overwhelm

**Before:** Edit showed a left sidebar with section nav, multiple context/status strips, and an immediate section editor — making the workspace feel saturated with framework.

**After:** Edit shows a clean dashboard of section cards. The user sees health, picks a section, opens a focused editor, and works. One compact score anchor replaces two noisy bars. No second sidebar competing for attention.

---

## What's Preserved

- All inline intelligence (bullet health, rewrite suggestions, Accept/Edit First/Dismiss)
- Target job switching still refreshes guidance/proposals/coverage
- Suggested Changes, Coverage Map, Preview, and Version Diff tabs are unchanged
- PathAdvisor shell is unchanged
- Direct edits still modify the active resume version
- Suggestions still never silently overwrite content
