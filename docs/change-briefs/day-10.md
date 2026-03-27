# Day 10 — Job Search Contract Hardening v1

## What Changed
- Hardened Job Search salary rendering so live results prefer structured pay ranges over vague placeholder copy.
- Corrected live filter mapping for agency and appointment type semantics, and replaced the tiny location dropdown with a free-text location filter.
- Preserved live search results, selected-job live evaluation, and Saved Jobs live behavior while tightening contract honesty.

## Why It Matters
- Users can now see a materially more useful salary answer when live data includes compensation.
- Job Search filters better match the real backend and USAJOBS contract instead of implying support that is not actually wired.
- The location flow is more realistic for federal job search because it no longer traps users in a short hard-coded list.

## What to Notice
- Salary cards now show real pay ranges when available and explain when structured salary is missing.
- Agency filtering uses live-mapped USAJOBS codes for the curated agencies in this screen, and appointment type labels now match actual USAJOBS categories.
- The named change brief for this run is `docs/change-briefs/job-search-contract-hardening-v1.md`.
