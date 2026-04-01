# Resume Builder — Overview Mode + Callout Expansion

**Date:** March 31, 2026
**Branch:** feature/resumeBuilderv2
**Status:** Working tree only (not committed)

---

## What changed

Resume Builder now has two distinct levels of guidance:

### 1. Resume Overview — new default view

When you open Resume Builder, you now start with **Resume Overview** — a full-document view that highlights the most important issues across your entire resume. Instead of immediately drilling into one section, you first see the big picture: "Here are the top things to fix."

The overview shows a limited set of high-priority callouts — one per section at most — so the view stays calm and readable.

### 2. Section mode — focused drill-in

Clicking any section in the left rail (Contact, Summary, Experience, etc.) still works exactly as before: the selected section is highlighted in the document and more granular callouts appear for that specific section. Guidance narrows to the section's specific issues.

### 3. Summary now has real callout coverage

The Professional Summary section previously lacked real callout support. It now has canonical callout targets for:
- Missing summary (high priority)
- Weak opening fit statement
- Missing target keywords
- Weak federal framing

These callouts actually render in the document with connector lines and guidance cards — they are not just config entries.

### 4. Work Experience supports richer field-level guidance

Work Experience is the most important section on a federal resume. Previously, all callouts pointed at the section as a whole. Now the system supports field-level anchors for:
- Job title (too generic?)
- Date range (formatting issues?)
- Employer/agency (incomplete?)
- Hours per week (missing?)
- Individual bullet content (weak evidence, missing metrics, etc.)
- Federal language alignment
- Leadership/scope gaps

This means guidance can point at the specific part of an experience entry that needs attention, not just "this section has an issue."

### 5. Left rail updated

The section list in the left rail now starts with "Resume Overview" as a visually distinct first item, followed by a separator, then the individual section items (Contact, Summary, Experience, Education, Skills, Certifications, Federal Details, Evidence).

---

## How it works for the user

1. Open Resume Builder → see Resume Overview with top issues highlighted across the whole document
2. Click a callout endpoint → see a guidance card explaining the issue
3. Click a section in the left rail → drill into that section with more granular callouts
4. Click Resume Overview in the rail → return to the full-document view

---

## What did not change

- PathAdvisor shell is unchanged
- The resume document remains the main object
- The callout interaction model (endpoint circles, hover highlighting, guidance cards) is preserved
- Scroll attachment for callout lines is preserved
- Validation preflight checklist is unchanged
- No new routes or pages were added
