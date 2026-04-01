# Resume Builder: PathAdvisor On-Demand Explanations

**Date:** March 31, 2026
**Branch:** feature/resumeBuilderv2
**Type:** Feature enhancement — explanation density reduction + PathAdvisor integration

---

## What Changed

The Resume Builder now shows less explanatory text by default. Instead of verbose guidance cards, the default state prioritizes:

- A short issue title
- A brief one-line impact statement (truncated to ~120 characters)
- An issue category badge (e.g., "Weak Evidence", "Missing Field", "Keyword Gap")
- Direct action buttons (Apply, Strengthen, Dismiss)
- A secondary "Why this matters" trigger for deeper reasoning

The builder's guidance layer is now calmer and more scannable. Detailed explanations are still available — they just require an intentional action from the user.

## PathAdvisor On-Demand Triggers

Three new trigger points let users ask PathAdvisor for deeper explanations:

1. **Issue-level:** "Why this matters" — appears inside each guidance card, below the action buttons. Explains why a specific issue matters for a federal resume.

2. **Section-level:** "Ask PathAdvisor about this section" — appears in the compact issue summary when a section is selected. Helps users understand what to focus on in a particular section.

3. **Overview-level:** "What should I fix first?" — appears in the overview compact summary. Gives prioritization guidance across the whole resume.

These triggers are visually restrained — small text, muted color, Sparkles icon. They invite without demanding.

## Grounded Context

When a user clicks a PathAdvisor trigger, the builder automatically sends the relevant context:

- Which screen and mode the user is in (overview vs. section)
- Which section is selected
- Which issue is active (annotation class, category, severity, label)
- Any suggested fix text
- Section health percentage
- Overall resume readiness score
- Target job title and ID

PathAdvisor receives a pre-composed natural-language prompt so it opens already understanding what the user is asking about.

## Top Fix Banner

A new "Top fix" banner highlights the single most impactful next action when no guidance card is expanded. It uses priority sorting (federal requirements first, then missing fields, keyword gaps, weak evidence, and enhancements last) to identify the one thing the user should address next.

The banner is short and directive — no explanation prose. Just "Top fix: Add hours/week to entry 1" with a category badge.

## Issue Category Badges

Guidance cards now show dual badges:
- **Annotation class badge** (Evidence / Alignment / Compression) — the visual treatment
- **Issue category badge** (Missing Field / Weak Evidence / Keyword Gap / etc.) — the structural nature of the problem

This lets users understand the type of issue at a glance without reading a full paragraph.

## What Did Not Change

- The document-centered layout is preserved
- The resume remains the primary object
- PathAdvisor's shell-level integration is unchanged
- Editing and suggestion application behavior is unchanged
- Callout line interactions work as before
- The left rail remains scannable (no added text)
- Existing routes are not affected

## Files Changed

### New files
- `packages/ui/src/resume-builder/types/pathadvisor-context.ts` — PathAdvisor context payload type and prompt builder
- `packages/ui/src/resume-builder/components/PathAdvisorExplainTrigger.tsx` — Compact on-demand explanation trigger
- `packages/ui/src/resume-builder/components/TopFixBanner.tsx` — Top fix signaling component

### Modified files
- `packages/ui/src/resume-builder/components/PathOSCalloutCard.tsx` — Reduced description verbosity, added category badge, added explain trigger
- `packages/ui/src/resume-builder/components/ResumeCalloutLayer.tsx` — Added triggers at section/overview levels, wired TopFixBanner, reduced compact summary text
- `packages/ui/src/resume-builder/index.ts` — Exported new types and components
- `packages/ui/src/screens/ResumeBuilderScreen.tsx` — Wired grounded context, scopeIssues, handleExplainRequest
- `packages/ui/src/resume-builder/__tests__/resume-builder-architecture.test.ts` — Added 10 new tests

## Testing

All 449 architecture tests pass, including 10 new tests covering:
- PathAdvisor trigger labels for each intent
- Prompt composition with issue, section, and overview context
- Suggested fix inclusion in prompts
- Context payload structure validation
- Scope issues priority sorting
- Issue category metadata completeness
