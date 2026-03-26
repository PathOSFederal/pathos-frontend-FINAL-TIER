# Job Search Live Results v1

## What Changed

- The Job Search Search button now runs a real backend-backed search instead of seeding local mock results for the main search flow.
- The frontend now sends Job Search requests through a same-origin frontend proxy, which then calls the PathOS backend search endpoint backed by the official USAJOBS integration.
- Real search results are adapted into the existing Job Search UI model so the results list and the selected-job live evaluation flow work together.
- Job Search now shows honest live-search loading, empty, error, and stale-selection behavior instead of silently falling back to sample data in the live path.

## Why It Matters

- Job Search now behaves like a real product workflow instead of a mostly mocked search demo.
- This closes a major gap between the live backend intelligence work and the main frontend search experience.
- It keeps PathOS trustworthy by ensuring search requests still go through the backend instead of the browser talking to USAJOBS directly.

## User Impact

- When a user clicks Search in Job Search, PathOS now returns live backend-backed job results.
- Selecting one of those live results still triggers the real backend advisor evaluation flow that was added in the previous Job Search integration slice.
- If the backend returns no jobs or the live search fails, the UI says that directly instead of showing stale or fake results.

## Trust UX Impact

- The browser does not call USAJOBS directly. Search stays behind the backend and frontend proxy boundary.
- The UI now makes it clearer when live search is unavailable and when certain filters are not yet fully mapped into the backend search contract.
- Search results and evaluation are now aligned on the same backend-backed source path, which makes the Job Search experience more defensible and auditable.

## Intentionally Deferred

- The Job Search agency filter still stores display names, while the backend search contract expects official USAJOBS organization codes. That filter is called out honestly instead of being silently faked.
- Some auxiliary Job Search guide datasets and document-style detail content remain local deterministic frontend content.
- Dashboard and Career Readiness still remain outside live job-search result wiring in this slice.

## Running Frontend And Backend Together

- Start the backend locally so the frontend proxy can reach `PATHOS_BACKEND_BASE_URL` or the default `http://127.0.0.1:8000`.
- Set `PATHOS_BACKEND_API_KEY` in the frontend environment, or provide a usable first key in `PATHOS_API_KEYS`.
- Open Job Search, enter keywords, run Search, verify the results list is populated from live backend-backed data, then select a result and confirm the live advisor panel still evaluates it.

## Config And Setup Follow-Up

### What Was Added

- The frontend repo now includes `.env.local.example` with the local live integration values that Job Search and Saved Jobs expect.
- The shared live-advisor backend config helper now gives a clearer operator-facing error when the backend key is missing.
- The frontend README now explains the exact env values, backend alignment, and local verification steps for running frontend and backend together.
- The committed example env file now uses placeholder-only values so no local backend secret is shipped in the tracked diff.

### Why It Matters

- The live Job Search and Saved Jobs flows were already wired, but local developers still had to infer the required frontend env setup from code and merge notes.
- This follow-up turns that implicit setup into an explicit, repeatable local configuration path.

### What A Developer Must Do Locally

- Copy `.env.local.example` to `.env.local`.
- Set `PATHOS_BACKEND_BASE_URL` to the local backend URL if it differs from `http://127.0.0.1:8000`.
- Set `PATHOS_BACKEND_API_KEY` to a key that the backend accepts through its `PATHOS_API_KEYS` configuration.
- Restart the frontend dev server after changing env values.

### Trust UX Impact

- When env values are missing, the frontend proxy now fails with a more direct setup error instead of leaving the operator to infer what is wrong.
- When env values are present, the live search and live evaluation paths can run without introducing fake fallback data.

### Intentionally Deferred

- This follow-up does not broaden into new backend config behavior or additional live page wiring.
- The backend remains the source of truth for accepted API keys and live USAJOBS-backed search behavior.
