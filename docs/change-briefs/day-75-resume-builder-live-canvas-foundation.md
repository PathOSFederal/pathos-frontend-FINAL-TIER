# Day 75 — Resume Builder Live Canvas Architecture Foundation

## What changed visually

- **New top bar layout.** The Resume Builder header is now a stable 7-slot strip: Master Resume selector, Target Job selector, Stage tabs (Partial / Tailoring / Validation), Page budget indicator, Readiness state, Utility actions, and a Primary CTA button. These slots never move — only their content changes as you progress through stages.

- **Left rail with section health.** A compact vertical rail appears on the left side of the builder showing each resume section (Contact, Summary, Experience, Education, Skills, Federal Details, Certifications) with a small circular progress indicator. Green means complete, yellow means needs work, red means critical issues, gray means not started. Clicking a section scrolls to it and shows its guidance.

- **Section-scoped guidance cards.** When you select a section, small callout cards appear to the right of the document with specific improvement suggestions. Only the selected section's callouts show — no visual clutter from other sections. Each card is color-coded by type: blue for evidence issues, amber for alignment gaps, violet for compression suggestions.

- **Validation preflight checklist.** In the Validation stage, a calm checklist appears below the resume showing pass/fail status for: page length, required sections, federal details, evidence coverage, and critical issues. It feels like a final pre-flight check rather than a wall of alerts.

- **Page budget indicator.** A compact display in the top bar shows current page count vs. the 2-page limit. When you're over, it turns red with an "Over limit" badge.

## What is the document-centered model

Previously, the Resume Builder showed either a grid of section cards (dashboard) or a single section at a time (focused editor). Users had to mentally reconstruct the full resume from fragments.

The new architecture treats the resume document itself as the primary workspace. All sections are always visible on a continuous canvas, similar to how the actual resume will look when exported. Guidance, annotations, and editing happen in-place on the document rather than in separate panel views.

## How this helps federal resume users

Federal resumes have a strict 2-page constraint and require specific sections (federal details, KSAs, evidence of qualification). The document-centered view lets users see their page budget in real time, spot missing sections immediately, and understand how tailoring annotations relate to actual resume content. The section progress rail gives instant visibility into which sections need work without leaving the document.

## What was NOT changed

- Routes and navigation are unchanged.
- The existing tab system (Edit, Suggested Changes, Coverage Map) still works inside the canvas area.
- Resume data storage and the Master Resume / Target Job workflow are unchanged.
- No design system tokens or theme variables were modified.
- PathAdvisor's functionality is preserved — only its UI integration point is being refined.

## What comes next

- Wire the LiveResumeCanvas as the actual primary workspace (currently the architecture is in place but the old view is still the default).
- Connect real anchor registration so callout connector lines point to exact document positions.
- Replace mock annotations with computed tailoring analysis.
- Add subtle animation to callout card transitions.
- Complete PathAdvisor context routing for section-scoped guidance.
