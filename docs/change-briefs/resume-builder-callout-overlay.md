# Change Brief: Resume Builder Callout Line Overlay

**Date:** March 29, 2026
**Branch:** feature/resumeBuilderv2
**Surface:** Resume Builder

---

## What This Change Does

This update adds a precision callout line overlay to the Resume Builder. Thin lines now visually connect specific content inside the resume document to small white endpoint circles positioned just outside the document boundary.

When a user selects a section in the resume while in tailoring mode (with a target job active), the system draws subtle annotation lines from the relevant content — such as a professional summary, a work experience bullet, or the skills block — outward to guidance endpoints. This creates a clear visual map between "what PathOS is pointing at" and the resume content that needs attention.

---

## How It Connects Resume Content to Guidance

Each callout line starts from a real piece of resume content — a summary paragraph, a bullet point, a job title, a date range, an education entry, or the skills block. The line extends rightward, crosses the document boundary, and terminates in a small white circle with a subtle border. The circle is always the final point — no line continues past it, and no circle floats disconnected from a line.

The lines use a smooth curved path (Bezier curve) so they feel organic but precise. Multiple lines are vertically staggered so their endpoints do not overlap.

---

## When the Callouts Appear

Callout lines are **not** always visible. They appear only when all of these conditions are met:

1. The builder is in the **Tailoring** stage (a target job has been selected)
2. A **section is selected** in the resume canvas
3. There are **unresolved annotations** for that section

This means:
- In the Partial stage (no target job), no callout lines appear
- In the Validation stage, no callout lines appear
- If no section is selected, no callout lines appear
- Only the selected section's annotations generate lines — other sections stay clean

This prevents the overlay from becoming visual noise.

---

## How the Visual Style Stays Subtle

The lines are designed to feel like a premium, restrained annotation layer:

- **Thin lines** (1.25px) in a neutral cool gray color
- **Low default opacity** (35%) so lines recede behind the resume content
- **Small endpoint circles** (5px radius) with white fill and a subtle gray border
- **Gentle drop shadow** on the circles for just enough elevation
- On **hover or keyboard focus**, a line brightens to accent blue and increases to 70% opacity — but the change is smooth and not flashy
- The source content gets a subtle accent ring when its endpoint is hovered, showing the bidirectional connection

No loud colors, no diagram-style arrows, no decorative animations.

---

## How This Helps Users

When PathOS identifies that a resume bullet needs stronger evidence, that skills are missing target keywords, or that a section is too long, the callout lines show the user *exactly* where that guidance points. Instead of reading a guidance card and wondering "which part of my resume is this about?", the user can see the visual connection directly on the document.

The system supports three annotation classes:
- **Evidence** — content needs stronger metrics or federal-specific outcomes
- **Alignment** — content does not match the target job requirements
- **Compression** — content is too long and needs tightening for page limits

Each class uses its own color coding in the existing callout card system. The callout lines inherit these colors subtly in their source dots.

---

## Bidirectional Highlight Behavior

When the user hovers an endpoint circle, the connected line highlights and the source content in the resume receives a subtle accent outline — showing exactly which content the endpoint relates to.

When the user hovers content in the resume that has an attached callout line, the line and its endpoint highlight — showing that guidance exists for that content.

This works on keyboard focus as well: tabbing to an endpoint circle produces the same highlight effect as hovering.

---

## What Did Not Change

- The main app navigation, shell, and PathAdvisor are unchanged
- The Resume Builder's editing behavior (inline edits, section switching, proposals) is unchanged
- The existing callout card system (right-side guidance cards) continues to work alongside the new lines
- No routes, persistence logic, or data models were altered

---

## Files Involved

**New files:**
- `packages/ui/src/resume-builder/types/callout-line-types.ts` — type definitions
- `packages/ui/src/resume-builder/hooks/useCalloutLines.ts` — geometry measurement hook
- `packages/ui/src/resume-builder/components/CalloutLineOverlay.tsx` — SVG overlay component

**Modified files:**
- `packages/ui/src/resume-builder/components/LiveResumeCanvas.tsx` — added data-callout-anchor attributes and highlight props
- `packages/ui/src/screens/ResumeBuilderScreen.tsx` — integrated the overlay system
- `packages/ui/src/resume-builder/index.ts` — barrel exports for new modules
- `packages/ui/src/resume-builder/__tests__/resume-builder-architecture.test.ts` — added 40+ tests
