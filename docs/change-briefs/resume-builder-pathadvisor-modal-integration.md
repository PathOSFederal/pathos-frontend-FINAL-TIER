# Change Brief: Resume Builder PathAdvisor Modal Integration

**Date:** March 31, 2026
**Branch:** feature/resumeBuilderv2
**Scope:** Resume Builder route-local

---

## What changed

Resume Builder now opens a focused PathAdvisor explanation modal when the user asks for deeper reasoning about a specific issue, section, or the whole resume.

The main builder UI stays quieter and more visually focused on the document. When the user wants to know *why* something matters or *what to do next*, they click an explanation trigger and get a calm, structured modal instead of inline prose that competes with the resume canvas.

## Why

The builder's job is visual diagnosis and direct action — callout lines, severity badges, section health, apply-suggestion buttons. These work well.

But deeper reasoning (why does this issue matter for my target job? what should I fix first across the whole resume?) does not belong crowded into the main workspace. It belongs in a focused layer the user invites on demand.

This modal is that layer.

## How it works

Three trigger levels open the same modal with different starting context:

1. **Issue-level** — "Why this matters" on a guidance card. The modal explains the specific issue, its severity, and what to do about it.

2. **Section-level** — "Ask PathAdvisor about this section" on a section summary. The modal shows section health, what needs improvement, and where to start.

3. **Overview-level** — "What should I fix first?" on the resume overview. The modal provides prioritization guidance across the whole resume.

## What the user sees

The modal opens with four structured sections:

- **What PathOS sees** — what was detected (e.g., "Work Experience section is missing hours/week for entry 1")
- **Why it matters** — why this is important for the target job (e.g., "Federal HR screens require hours/week to verify qualifying experience")
- **What to do next** — concrete next step (e.g., "Add hours/week to each experience entry")
- **Suggested change** — when a concrete fix is available, shown with Apply and Edit First actions

The user can:
- **Apply suggestion** — applies the fix directly to the resume document
- **Edit first** — loads the suggestion into the inline editor for refinement
- **Ask follow-up** — reveals a text input for asking PathAdvisor more (placeholder for future AI wiring)
- **Close** — returns to the builder with no layout disruption

## What stays the same

- The resume document remains the primary visual object
- Callout lines, severity badges, and section health indicators still work as before
- The right-side guidance surface still summarizes and offers direct actions
- Suggestion application and inline editing plumbing is unchanged
- No changes to routes outside Resume Builder
- No changes to the global PathAdvisor shell

## Technical notes

- Modal uses Radix Dialog for accessible behavior (focus trap, escape-close, ARIA)
- Explanation content is deterministic — mapped from existing grounded context, no LLM call
- Ready for future AI-backed explanation without layout changes
- 26 new architecture tests covering all trigger levels, context wiring, and action routing
