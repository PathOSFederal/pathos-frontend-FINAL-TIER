# Day 81 — Resume Builder Hardening Pass

## What changed

This pass fixes broken trust points, adds real export usability, completes validation behavior, and adds a full-document review entry point for PathAdvisor.

## Key changes

### 1. Validation stage enabled and meaningful
- `tailoringComplete` is now computed from real resume state (has summary + has experience) instead of being hardcoded to `false`
- Preflight checks use real data: content-based page count, actual section presence, contact completeness, unresolved high-severity callout counts
- Users can now reach and use the Validation stage via the stage tab (previously permanently disabled)

### 2. Print/PDF export replaces JSON-only
- Primary user-facing export is now "Print / Save as PDF" using browser native print dialog
- JSON export preserved as secondary "Export JSON" option for data backup
- Preview overlay now has both export actions clearly labeled

### 3. Full-document "Review Resume" action
- New "Review Resume" button in the top bar Slot 6 (before Preview)
- Opens a structured evaluation overlay with:
  - Overall readiness summary (percentage + tier label + color)
  - Strongest section
  - Weakest section
  - Missing federal requirements
  - Biggest blocker
  - Top 3 recommended fixes
- All content is deterministic in this pass; architectured as future LLM entry point

### 4. Certifications add flow fixed
- "Add certifications" empty-state placeholder now works without requiring section pre-selection
- Removed the `isSelected` guard that trapped users

### 5. Version restore with confirmation
- "Restore this version" now shows an inline confirmation step warning about overwriting current draft
- Confirm / Cancel buttons with proper interaction states
- Escape key support for the versions panel

### 6. Resume switching safety
- Selecting a different version from the dropdown triggers a confirmation dialog
- Three options: Save current + switch, Discard + switch, Cancel
- Prevents accidental data loss when switching versions

### 7. Preview readability improved
- All text colors upgraded to high-contrast values (#000 for headings, #111 for body, #444 for secondary)
- Font sizes bumped to 13px for body content
- Clean white-on-dark typography optimized for reading and print
- Escape key and backdrop click dismiss the preview
- Print CSS utility classes added for browser print compatibility

### 8. Readiness cluster cleanup
- Added a 1px vertical separator between the readiness badge and Edit toggle in the top bar
- Prevents visual crowding between "87% Ready" and the Edit button

### 9. Page budget is dynamic
- Page count estimated from actual resume content (summary length, experience entries, bullets, education, etc.)
- Replaces previous hardcoded 1.4 value
- Estimation uses 45 lines/page for federal resume conventions

### 10. Interaction states
- All new buttons have hover/focus-visible/active states
- Uses INTERACTIVE_HOVER_CLASS and focus-visible:ring-2 patterns
- Covers: print button, JSON export button, close buttons, review button, restore confirm/cancel, version switch confirm/discard/cancel

## Files changed

| File | Change |
|------|--------|
| `packages/ui/src/screens/ResumeBuilderScreen.tsx` | Validation enablement, page count estimation, print export, review resume overlay, version restore confirmation, resume switch confirmation, preview readability |
| `packages/ui/src/resume-builder/components/ResumeBuilderTopBar.tsx` | Review Resume button, Sparkles icon import, readiness/edit separator |
| `packages/ui/src/resume-builder/components/LiveResumeCanvas.tsx` | Certifications add flow fix (removed isSelected guard) |
| `packages/ui/src/resume-builder/__tests__/hardening-pass.test.ts` | 25 new tests covering all hardening requirements |

## Why

The Resume Builder had several broken trust points: permanently disabled validation, JSON-only export, no version switch protection, unresponsive certification add flow, and no way to get a full-document evaluation. These issues would prevent users from trusting the builder as a production tool.

## Testing

- 25 new tests in `hardening-pass.test.ts` — all passing
- Lint: no new errors (pre-existing errors in other files only)
- Typecheck: no new errors from this pass (pre-existing ResumeDraft type issues in other locations only)

## Follow-ups

- Wire full-document review to real PathAdvisor LLM
- Add DOM-measured page count for precise page budget
- Add version delete in versions panel
- Fix pre-existing ResumeDraft type errors in legacy code sections
- Add print-specific CSS stylesheet for optimal PDF output
