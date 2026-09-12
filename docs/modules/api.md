# Module: API (Phase 5, backend half)

File: `backend/app/main.py`

## What it does

The single FastAPI app exposing the whole pipeline over HTTP. Two endpoints: `GET /health` and `POST /ask`.

## `POST /ask`

**Request**: `{"question": "<free text>"}`

**Response** (`AskResponse`):
```json
{
  "question": "...",
  "sql": "... | null",
  "columns": ["..."] | null,
  "rows": [[...]] | null,
  "chart_type": "stat" | "bar" | "line" | "table" | null,
  "x_key": "..." | null,
  "y_key": "..." | null,
  "explanation": "..." | null,
  "refusal_reason": "..." | null
}
```

`refusal_reason` non-null means everything else is null — the frontend branches on this single field to decide whether to show a result or a blocked/refused message (see `docs/modules/frontend.md`).

## Request handling flow

1. Trim and reject an empty question with `400`.
2. Open `admin_conn` (`db.get_connection()`) and `restricted_conn` (`restricted_db.get_restricted_connection()`). If either connection fails (DB down), return `503` with a friendly message — **never** a raw connection-error stack trace.
3. Call `answer.answer_question(admin_conn, restricted_conn, question)`. If this raises anything unexpected (shouldn't normally happen — `nl_to_sql.ask()` catches its own errors internally — but this is the last line of defense), return `502` with a friendly message.
4. Always close both connections in a `finally` block.
5. Convert `Decimal`/`date`/`datetime` values in `rows` to JSON-safe types (`float`, ISO string) via `_json_safe()` — psycopg2 returns these Python types directly and Pydantic/FastAPI won't serialize `Decimal` to JSON on its own.
6. Return the populated `AskResponse`.

## Why per-request connections, not a pool

`SCOPE.md` explicitly cuts connection pooling / production scaling concerns for this portfolio demo. Opening two connections per request is simple, correct, and adequate at demo traffic levels. If this ever needs to handle real concurrent load, that's the first thing to revisit — see `docs/ARCHITECTURE.md` for the broader "what's explicitly NOT built" list.

## CORS

`allow_origins=["*"]` — fine for a public demo with no auth (`SCOPE.md` explicitly has no auth/accounts in v1). Would need tightening if this were ever a real multi-tenant product.

## Error-handling design intent (NFR-Reliability)

Every failure mode must produce a clear message, never an unhandled exception visible to the user. This is enforced at two levels:
- Inside the pipeline (`nl_to_sql.ask()`) — LLM/validation/execution errors become a `refusal_reason` string, not an exception, so a **normal** `200` response with a friendly message is the common failure path.
- At the API boundary (`main.py`) — anything that somehow escapes the pipeline (DB unreachable before a connection is even established, or a genuinely unexpected bug) still gets caught and turned into a `503`/`502` with a friendly `detail`, not a raw 500 stack trace.

This was verified live: when Gemini's quota was exhausted mid-testing, `/ask` still returned a clean `200` with a readable `refusal_reason` — the full retry-and-fail-gracefully path worked correctly even under total upstream failure.

## If you need to change something here

- **Add a new endpoint** (e.g. a query-log viewer, or a schema-context debug endpoint): follow the same pattern — open connections, call into the relevant module, always close in `finally`, never let a raw exception reach the response.
- **Add auth**: explicitly out of scope for v1 (`SCOPE.md` §6) — flag it rather than quietly adding it.
- **Change the response shape**: update `AskResponse` here AND the matching TypeScript `AskResponse` interface in `frontend/src/lib/api.ts` — they're not auto-synced, must be kept manually consistent.
