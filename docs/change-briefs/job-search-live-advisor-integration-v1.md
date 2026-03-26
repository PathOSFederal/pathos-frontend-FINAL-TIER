# Job Search Live Advisor Integration v1

## What Changed

- Job Search now uses the real backend advisor evaluation path for the currently selected job.
- The selected-job panel no longer relies on mocked advisor output for that live evaluation path.
- The frontend reuses the same thin adapter and proxy pattern established for Saved Jobs, so backend contract mapping stays in one place instead of leaking through UI components.
- The Job Search advisor panel now shows honest loading, empty, error, stale-selection protection, warnings, missing evidence, and explainability details from the backend response.

## Why It Matters

- This makes Job Search behave like a real evaluation workflow instead of a demo-only surface.
- It proves that both Saved Jobs and Job Search can consume the deterministic backend advisor contract without inventing conclusions in the frontend.
- It reduces the gap between isolated backend intelligence and a real end-to-end PathOS experience.

## User Impact

- When a user selects a job in Job Search, PathOS now evaluates that job with the live backend and shows a real recommendation, decision band, reasons, gaps, warnings, and next actions.
- If no job is selected, the backend has no answer, or the response is incomplete, the UI says that directly instead of showing stale or fake confidence.
- Saved Jobs remains live-wired and was preserved while Job Search was integrated.

## Trust UX Impact

- The frontend now preserves backend confidence, missing evidence, and warnings for the Job Search evaluation flow instead of replacing them with frontend-made conclusions.
- Stale-selection handling prevents the wrong evaluation from lingering when the user changes jobs quickly.
- Explainability details remain visible so users can see that PathOS is grounding conclusions in specific backend evidence instead of presenting them as magic.

## Intentionally Deferred

- The Job Search results list and search dataset are still local/mock in this phase. Only the selected-job evaluation flow is live.
- Dashboard and Career Readiness did not receive broad live-data wiring in this slice.
- No broad frontend redesign or cross-app cleanup was included in this phase.

## Running Frontend And Backend Together

- Start the backend locally so the frontend proxy can reach `PATHOS_BACKEND_BASE_URL` or the default `http://127.0.0.1:8000`.
- Set `PATHOS_BACKEND_API_KEY` in the frontend environment, or provide a usable first key in `PATHOS_API_KEYS`.
- Open Job Search or Saved Jobs, select a job, and verify that the advisor panel is using the live backend-backed evaluation contract.
