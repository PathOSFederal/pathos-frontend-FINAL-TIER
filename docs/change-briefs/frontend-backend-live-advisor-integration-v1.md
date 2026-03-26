# Frontend Backend Live Advisor Integration v1

## What Changed

- The Saved Jobs page now loads live canonical stored jobs from the backend instead of seeding mock saved-job data for this integration path.
- Selecting a live stored job now requests the real backend advisor evaluation for that job and renders the backend decision, warnings, gaps, missing evidence, next actions, and explainability metadata.
- The frontend now uses a thin integration boundary:
  - a same-origin frontend proxy route for backend stored jobs
  - a same-origin frontend proxy route for stored-job evaluation
  - one adapter layer that translates backend fields into the UI contract
- The Saved Jobs detail panel now shows honest loading, empty, error, and partial-evidence states instead of implying certainty.

## Why It Matters

- This is the first narrow end-to-end live advisor flow in the frontend.
- It validates the real backend contract without wiring the whole app at once.
- It removes mock saved-job evaluation from the primary integration surface, which makes product review and backend evaluation more trustworthy.

## User Impact

- Users reviewing Saved Jobs now see backend-generated advisor output for live stored jobs already persisted in the backend.
- If the backend has no stored jobs, no evaluation, or incomplete evidence, the UI says that directly.
- The page no longer pretends local mock saved jobs are real backend-backed opportunities on the integrated path.

## Trust UX Impact

- The frontend now preserves backend certainty, missing evidence, and warnings instead of replacing them with frontend-made conclusions.
- Explainability fields stay visible so the product can show why PathOS reached a conclusion.
- The integration keeps backend credentials on the server-side proxy routes rather than exposing them to the browser.

## Intentionally Deferred

- Job Search still remains outside the live backend path for this phase.
- Dashboard and Career Readiness did not receive broad live-data wiring in this slice.
- The older generic mocked PathAdvisor stub route still exists, but the integrated Saved Jobs flow does not rely on it.

## Running Frontend And Backend Together

- Start the backend locally so the frontend proxy can reach `PATHOS_BACKEND_BASE_URL` or the default `http://127.0.0.1:8000`.
- Set `PATHOS_BACKEND_API_KEY` in the frontend environment, or provide a usable first key in `PATHOS_API_KEYS`.
- Open Saved Jobs and use the live stored-job list already persisted in the backend database.
