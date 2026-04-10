# Change Brief: Resume Navigation — Canonical Builder Adjustment

## Date

2026-04-09

## Summary

Adjusted resume builder navigation and route ownership so that the document-centered canvas builder is the canonical editing experience, the workspace hub remains the sidebar landing page, and the newer structured builder is positioned as review/diagnostics/guidance rather than a competing primary editor.

## What Changed

### Route model (unchanged routes, changed intent)

| Route | Before | After |
|-------|--------|-------|
| `/dashboard/resume` | Workspace hub | Workspace hub (unchanged) |
| `/dashboard/resume/new` | New resume creation flow | New resume creation flow (unchanged) |
| `/dashboard/resume-builder` | Secondary/legacy canvas builder with banner | **Canonical editor** — banner removed |
| `/dashboard/resume/[resumeId]` | Primary structured builder | Structured review/diagnostics/guidance surface |
| `/dashboard/resume/[resumeId]/review` | Dedicated review shell | Dedicated review shell (unchanged) |

### Navigation changes

- **Sidebar "Resume Builder"** → `/dashboard/resume` (workspace hub) — unchanged
- **Hub "Open builder" button** → now routes to `/dashboard/resume-builder` (canvas builder) instead of `/dashboard/resume/[resumeId]`
- **Hub card click** → now routes to `/dashboard/resume-builder` (canvas builder)
- **Hub "Review" button** → `/dashboard/resume/[resumeId]/review` — unchanged
- **Creation flow "Open builder" on confirm** → now routes to `/dashboard/resume-builder`
- **Review "Back to builder"** → now routes to `/dashboard/resume-builder`
- **Review "Rewrite in Builder"** → now routes to `/dashboard/resume-builder`
- **Dashboard "Open Resume Builder"** → `/dashboard/resume` (workspace hub) — unchanged
- **Onboarding handoff** → `/dashboard/resume-builder` — already pointed here, unchanged
- **Career resume deep-links** → `/dashboard/resume-builder?resumeFocus=...` — unchanged

### Banner removal

The informational banner on `/dashboard/resume-builder` that read:

> "This is the document-centered canvas builder. The guided workspace with integrated diagnostics and rewrite assistance is at /dashboard/resume."

has been removed entirely. No replacement banner was added.

### Copy updates

- Workspace hub header changed from "Resume Workspace Home" / "Build, tailor, review, and export from one document-centered flow" to "Resume Workspace" / "Your resumes, variants, and next actions in one place."
- PathAdvisor next-best-action guidance updated to reference the builder and review as distinct surfaces.
- File-level comments updated to reflect the new route ownership model.

## What Was Preserved

- All backend API calls remain intact:
  - `GET /api/pathadvisor/intelligence/resume-builder` (canvas builder intelligence)
  - `POST /api/resume/diagnostics/evaluate` (diagnostics evaluation)
  - `POST /api/resume/rewrite-assist` (rewrite assistance)
  - `POST /api/intelligence/career-readiness` and `POST /api/intelligence/resume-readiness`
  - PathAdvisor conversation and governed response APIs
- All existing routes still resolve — no routes were deleted or renamed
- Save/update, export, rewrite, and diagnostics flows remain wired
- Target role and tailoring context behavior unchanged
- Onboarding-to-builder handoff context unchanged
- Career resume deep-links to `/dashboard/resume-builder` unchanged

## Files Changed

| File | Change |
|------|--------|
| `app/(shared)/dashboard/resume-builder/page.tsx` | Removed banner div and Link import; updated component comment |
| `packages/ui/src/screens/ResumeWorkspaceScreen.tsx` | Changed `navigateToBuilder()` target to `/dashboard/resume-builder`; updated hub copy; updated file header comment |
| `app/(shared)/dashboard/resume/[resumeId]/page.tsx` | Updated component comment to reflect review/diagnostics role |

## Risks and Follow-ups

- The canvas builder at `/dashboard/resume-builder` manages its own active-resume state via `@pathos/core` stores. When a user clicks "Open builder" from the hub for a specific resume, the canvas builder loads whatever is in its local store, not necessarily the resume the user clicked on. Store synchronization between the workspace store and the canvas builder store is a follow-up concern.
- The route `/dashboard/resume/[resumeId]` still serves the structured builder view. It remains functional but is no longer the primary navigation target. A future cleanup could rename or redirect this route to make its review/guidance role explicit in the URL.
- The `RESUME_BUILDER` route constant in `packages/ui/src/routes/routes.ts` still points to `/dashboard/resume-builder`, which is now the canonical editor. No change was needed.
