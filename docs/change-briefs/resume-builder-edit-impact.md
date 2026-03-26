# Resume Builder Edit Dashboard — Impact Refinement Pass

**Date:** March 26, 2026
**Branch:** `feature/resumeBuilder`
**Scope:** Edit dashboard impact, persistent local controls, section grouping, dropdown polish

---

## What Changed

### Local Edit controls now stay consistent across both states

The Edit tab now has a persistent local control row that stays visible whether the user
is on the section dashboard (overview) or inside a focused section editor. This row
includes a dashboard icon button, a section dropdown, and (when editing) the current
section's score. It no longer disappears when switching between states.

On the dashboard, the dropdown shows "Overview". When editing a section, it shows the
active section name. The home icon always returns to the dashboard.

### Contact Information and Professional Summary are now one editing group

Contact Information alone was too thin to be a standalone editing surface. It has been
combined with Professional Summary into a single group called "Identity & Summary".
When the user opens this group, they see both contact details and the professional
summary in one cohesive editing surface.

The Edit dashboard now shows 7 section cards instead of 8, and each one represents
a meaningful editing task.

### Edit dashboard now better highlights what matters most

The dashboard now includes a compact summary strip at the top showing:
- **Match score** — how well the resume matches the target job
- **Readiness score** — overall resume completeness
- **Biggest blocker** — the weakest area that needs attention
- **Fastest win** — the quickest improvement the user can make

Below the summary strip, section cards are sorted by priority — weakest sections
with the most issues appear first. This makes it immediately clear where to start.

### Section cards communicate status and priority more clearly

Each card still shows a progress bar, status badge (Strong, Moderate, Critical, etc.),
and a compact metric. The priority sorting means the most impactful sections catch
the user's eye first.

### Section dropdown is now more responsive and interactive

The dropdown menu now uses per-item hover tracking with visible background shifts,
focus-visible ring treatment, and stronger current-item highlighting (accent tint +
semibold text). It also includes an "Overview" option at the top so the user can
return to the dashboard directly from the dropdown.

---

## How This Improves Focus Without Removing Intelligence

- **One stable control pattern**: the local control row persists across states,
  so the user always knows where they are and how to navigate.
- **Stronger first impression**: the summary strip answers "how is my resume doing?"
  before the user opens any section.
- **Priority ordering**: weakest sections appear first, reducing the cognitive work
  of figuring out where to start.
- **Combined Identity & Summary**: eliminates a thin standalone card and creates a
  more substantial first editing experience.
- **Polished dropdown**: feels modern and responsive, not static.
- **All intelligence preserved**: scores, status badges, inline suggestions, proposal
  logic, coverage map — nothing was removed, just reorganized for clarity.

---

## What's Preserved

- Section dashboard landing state still works.
- Focused section editing still works for all sections.
- Inline suggestion behavior (Rewrite / Expand / Match to Job) is unchanged.
- Work Experience inline rewrite flow is unchanged.
- PathAdvisor shell is unchanged.
- Suggested Changes, Coverage Map, Preview, and Version Diff tabs are unaffected.
- Target-job switching still refreshes scores and guidance.
- Proposal generation and coverage dimension logic still use individual section IDs.
- All prior tests pass (96 existing + 16 new = 112 total).
