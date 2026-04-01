# Resume Builder — Document-Centered Correction

**Date:** March 29, 2026
**Branch:** feature/resumeBuilderv2
**Type:** Product correction / UX redesign pass

---

## What Changed

The Resume Builder Edit experience has been corrected to center around the resume document itself rather than surrounding controls, detached panels, or dashboard-first layouts.

### The Resume Is Now the Main Object

When you open the Resume Builder, the first thing you see is your resume — centered on the screen, clearly document-like, with proper spacing and readable formatting. It looks like a real resume, not a tool interface.

### Section Selection Focuses the Document

Selecting a section (from the left rail or by clicking in the document) scrolls and highlights that section within the resume. The whole document stays visible — the selected section just gets subtle emphasis. Nothing is replaced with a separate panel or hidden behind a different view.

### Edit Mode Activates the Document Directly

A new Edit toggle in the top bar controls two clear states:

- **View mode** (default): The resume looks polished and clean. Guidance callouts may be visible but editing affordances are quiet. This is how you review your resume.

- **Edit-ready mode**: The selected section becomes visibly editable. Subtle highlights, outlines, and action chips appear directly on the document. Click any editable text to start editing in place. The layout does not change — the document simply "activates."

### Guidance Is Tied to Exact Content

Callout lines connect from specific content inside the resume to guidance points outside the document. They show you exactly which bullet, summary paragraph, or skill block needs attention. This is precision guidance anchored to your content, not detached advice cards floating in space.

Callouts are contextual — they appear only for the section you're focused on, and only when there are relevant suggestions.

### Less Noise, More Document

- The section rail is narrower and visually subordinate
- Action chips appear only in edit-ready mode, not cluttering view mode
- The document panel has proper elevation and generous spacing
- Controls support the document interaction without competing for attention

---

## What Was Not Changed

- PathAdvisor shell and behavior remain unchanged
- Target-job switching, proposal logic, and coverage analysis are preserved
- No other routes or screens were affected
- No commits or pushes — working tree only

---

## Why This Matters

This correction shifts the Resume Builder from a tool-interface-first design to a document-first experience. The user should immediately think "this is my resume" when they open Edit, not "this is a control panel that manages my resume somewhere."

Every interaction — section focus, editing, guidance — happens on or around the document itself.
