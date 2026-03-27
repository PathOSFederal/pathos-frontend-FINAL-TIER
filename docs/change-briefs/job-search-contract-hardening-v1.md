# Job Search Contract Hardening v1

## What Was Fixed

- Job Search salary display now uses real pay ranges from live results when structured compensation is available.
- Job Search filters now better match the live backend contract instead of implying support that was not really wired.
- The location filter now accepts normal free-text location input, which is a better fit for live federal job search than a tiny fixed dropdown.

## Why It Matters

- Users need a trustworthy first read on pay, location, and filter behavior before they decide whether a job is worth deeper review.
- When live search shows vague or misleading contract details, the product feels less dependable even if the backend integration is working.
- This pass improves the accuracy of what Job Search claims, shows, and filters without redesigning the whole workspace.

## User Impact

- More live search results now show a real salary range up front instead of pushing users straight to the announcement.
- Agency and appointment filtering are more aligned with the real USAJOBS-backed search path.
- Users can type the location they want instead of being boxed into a small preset list.
- Reset now returns Job Search to a useful live default instead of leaving the results area blank.
- Multi-location jobs now put matching searched locations first, which makes broad federal postings easier to scan.
- The USAJOBS button is more reliable because it now resolves from the currently selected job instead of falling back to a generic destination.

## Trust UX Impact

- Missing pay data is now explained directly instead of being hidden behind generic announcement copy.
- The Grade & Promotion card stays visible, but missing promotion data is now handled with compact honest copy instead of filler text.
- Unsupported or partially supported filter semantics are surfaced more honestly, which reduces false confidence.

## Intentionally Deferred

- Pay-plan detail is only shown when the structured result actually provides it; this pass does not invent pay-plan metadata that the backend does not currently return.
- Agency filtering is live-mapped for the curated agencies in this screen, not for every possible federal subelement.
- Telework and hybrid live filtering remain more limited than full remote filtering, so the UI still avoids claiming stronger work-mode support than the backend actually has.
- This phase stays focused on Job Search contract correctness and does not broaden into wider page redesign or unrelated cleanup.
