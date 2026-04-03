# Day 51 — Qualification Pack Availability Conversation Proof

## What changed

Day 51 did not change the centered PathAdvisor UI. The blocker was backend
runtime availability: the local SQLite database had been stamped to Alembic
head while still carrying legacy RIS table layouts. That mismatch prevented
current governed qualification packs from being created or promoted, so the
dashboard correctly received:

- `response_state: refused`
- `refusal_reason: governed_qualification_pack_unavailable`

The runtime fix was applied in the backend repo, not the frontend repo:

- `C:\dev\PathOS-Repos\pathos-backend\app\db\connection.py`
- `C:\dev\PathOS-Repos\pathos-backend\tests\test_migrations_runner.py`

## Root cause

The local backend database had:

- `alembic_version = 20260401_000001`
- legacy `knowledge_pack_versions` columns
- legacy `knowledge_promotions` columns
- no qualification pack versions
- no promotions

Because of that drift, live qualification pack bootstrap failed before serving
selection even ran. The concrete failure reproduced locally was:

```text
sqlite3.OperationalError: table knowledge_pack_versions has no column named base_version_id
```

So the refusal was honest. The runtime simply had no serving-eligible governed
qualification pack to return.

## Exact fix

The backend now repairs legacy SQLite RIS pack tables during `init_db()` when:

- `knowledge_pack_versions` is missing current governed-pack columns, or
- `knowledge_promotions` is missing current review-policy columns

Repair behavior is intentionally narrow:

- only runs for SQLite
- only repairs the RIS pack tables
- only auto-repairs when `knowledge_pack_versions`,
  `knowledge_promotions`, and `knowledge_serving_audit` are empty
- recreates those tables with the current governed-pack schema
- leaves the trust boundary intact by refusing automatic destructive repair if
  persisted governed-pack rows already exist

After the repair, a governed qualification bootstrap pack was seeded locally
and promoted successfully.

## Live proof

### Refusal proof before repair

Live frontend-proxy request returned:

- `response_state: refused`
- `refusal_reason: governed_qualification_pack_unavailable`
- `pack_version_id: null`
- `grounding.serving_eligible: false`

### Happy-path proof after repair

Live frontend-proxy request to `/api/pathadvisor/qualification/explain`
returned `200` with:

- `response_state: grounded`
- `grounded: true`
- `pack_version_id: 75ec9ca8-9e46-4403-a84e-431ee90b2c95`
- `grounding.pack_key: qualification.qualification-dashboard-pack-job`
- `grounding.serving_eligible: true`
- `freshness_state: fresh`

Live partial proof also returned `200` with:

- `response_state: partial`
- `grounded: true`
- `missing_inputs: ["skills", "target_roles"]`

The bounded conversation route was then rechecked with governed context from
that live response:

- `POST /api/pathadvisor/conversation` returned `200`
- no `422`
- no refusal
- current backend runtime still returns
  `technical_failure_reason: pathadvisor_openai_disabled`

That technical failure is separate from the qualification-pack availability
problem fixed in this run.

## Validation

Frontend repo:

- `pnpm test`: passed, `73` files / `1810` tests
- `pnpm build`: passed
- `pnpm lint`: failed due pre-existing unrelated repo lint errors
- `pnpm typecheck`: failed due pre-existing unrelated resume-builder test errors

Backend repo focused validation:

- `poetry run pytest --no-cov tests/test_migrations_runner.py tests/api/test_pathadvisor_conversation_route.py`
  - passed
- `poetry run pytest --no-cov tests/pathadvisor/test_qualification_context_service.py tests/api/test_runtime_routes_v1.py tests/services/test_pathadvisor_conversation_service.py`
  - passed

## No UI changes

No frontend visual changes were made in this run:

- no layout changes
- no spacing changes
- no typography changes
- no color changes
- no label changes
- no panel movement

The centered dashboard PathAdvisor surface remained visually equivalent.
