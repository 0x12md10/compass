# ARCHITECTURE.md — Compass

Reference doc for implementers (human or agent) picking this project back up mid-build. Read this first for the big picture; `docs/modules/*.md` covers each piece in implementation detail. `SCOPE.md` / `REQUIREMENTS.md` / `BUILD_PLAN.md` at the repo root remain the source of truth for *what* to build and *why it's scoped this way* — this doc is about *how it's actually wired together* as of the current state of the code.

---

## 1. One-paragraph summary

A user types a plain-English question into a web UI. The backend introspects a live Postgres schema (filtered through a whitelist), asks an LLM to generate exactly one SELECT statement grounded in that schema, validates the SQL's AST independently of the LLM's own promise to behave, executes it through a Postgres role that is physically incapable of mutating data, picks a chart type from the result's shape, asks the LLM for a short grounded explanation of the actual result rows, and returns all of it to the browser in one response.

## 2. End-to-end request flow

```
Browser (page.tsx)
  │  POST /ask { question }
  ▼
FastAPI (main.py)
  │  opens admin_conn (full access) + restricted_conn (aac_readonly role)
  ▼
answer_question()  [answer.py]
  │
  ├─▶ ask()  [nl_to_sql.py]                         ── Phases 2 & 3 ──
  │     │
  │     ├─ build_schema_context(admin_conn)          [schema_context.py]
  │     │     └─ introspect_schema()                 [introspection.py]
  │     │           └─ information_schema queries, filtered by
  │     │              schema_whitelist.yaml          [whitelist.py]
  │     │
  │     ├─ generate_sql(system_prompt, question)      [llm.py → Gemini]
  │     │     └─ returns {sql, refusal_reason} as structured JSON
  │     │
  │     ├─ IF refusal_reason: log + return early (layer 1 caught it)
  │     │
  │     ├─ validate_sql(sql, whitelist)                [guardrail.py]  ── layer 2 (AST) ──
  │     │     └─ raises GuardrailRejection or returns a validated AST
  │     │
  │     ├─ enforce_row_cap(stmt)                       [guardrail.py]
  │     │
  │     ├─ execute_readonly(restricted_conn, sql)       [restricted_db.py] ── layer 3 (DB role) ──
  │     │
  │     ├─ log_attempt(...)                            [query_log.py]  (every branch, always)
  │     │
  │     └─ ON ANY FAILURE ABOVE: feed error back to the LLM, retry once, then give up gracefully
  │
  ├─▶ select_chart(columns, rows)                       [chart_selector.py]  ── Phase 4 ──
  │
  └─▶ generate_explanation(question, columns, rows)     [explain.py → llm.py → Gemini]
  ▼
AskResponse (JSON)
  ▼
Browser renders: explanation text + ChartRenderer (StatTile/Bar/Line/Table) + collapsible SQL
```

Two Postgres connections are opened per request and closed at the end — no pooling, per `SCOPE.md`'s explicit "no production concerns" cut.

## 3. Project structure

```
AI Analytics Copilot/
├── SCOPE.md, REQUIREMENTS.md, BUILD_PLAN.md   — source of truth: what/why/priority order
├── docs/                                       — this doc + module-level implementation docs
│
├── db/
│   ├── migrations/
│   │   ├── 001_schema.sql                     — the 6 demo tables
│   │   ├── 002_readonly_role.sql               — aac_readonly role (guardrail layer 3)
│   │   └── 003_query_log.sql                   — audit trail table
│   ├── SCHEMA.md                               — ER description of the 6 tables
│   └── seed.py                                 — Faker-based demo data generator
│
├── docker-compose.yml                          — Postgres 16, host port 5434
│
├── backend/                                    — FastAPI (Python)
│   ├── app/
│   │   ├── main.py                             — FastAPI app, /health, /ask
│   │   ├── db.py                               — admin DB connection (introspection + logging)
│   │   ├── restricted_db.py                    — aac_readonly DB connection (guardrail layer 3)
│   │   ├── whitelist.py                        — loads schema_whitelist.yaml
│   │   ├── introspection.py                    — information_schema → Table/Column/ForeignKey
│   │   ├── schema_context.py                   — Table objects → compact LLM prompt text
│   │   ├── llm.py                               — the only module that knows about Gemini
│   │   ├── guardrail.py                        — sqlglot AST validation (guardrail layer 2)
│   │   ├── nl_to_sql.py                        — orchestrates: prompt → LLM → validate → execute → retry
│   │   ├── chart_selector.py                   — result shape → chart type heuristic
│   │   ├── explain.py                          — grounded explanation prompt
│   │   ├── answer.py                           — top-level orchestrator nl_to_sql + chart + explain
│   │   ├── query_log.py                        — writes every attempt to query_log table
│   │   ├── test_questions.py                   — the fixed 17-question test set
│   │   ├── run_test_questions.py               — CLI harness: runs the set through the full pipeline
│   │   ├── test_guardrails.py                  — CLI harness: adversarial/bypass probes
│   │   └── print_schema_context.py             — CLI harness: eyeball the schema context text
│   ├── config/schema_whitelist.yaml            — single source of truth for exposed tables/columns
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/                                   — Next.js (TypeScript, App Router, Tailwind)
    ├── src/app/page.tsx                         — the ask bar UI (single page)
    ├── src/lib/api.ts                           — fetch wrapper for POST /ask
    └── src/components/charts/
        ├── types.ts                             — ChartSpec / QueryResult shared types
        ├── ChartRenderer.tsx                    — picks StatTile/Bar/Line/DataTable from chart_type
        ├── StatTile.tsx, BarChartView.tsx, LineChartView.tsx, DataTable.tsx
```

## 4. Why each major decision was made

| Decision | Why |
|---|---|
| **FastAPI + Next.js** | Matches the existing stack assumption in REQUIREMENTS.md; Python has the strongest SQL-safety tooling (`sqlglot`) and Next.js is fast to ship a single-page UI in. |
| **Gemini instead of Anthropic/OpenAI, then Groq as default over Gemini** | Changed 2026-09-07 to Gemini (free tier) to keep the build zero-cost. Changed again 2026-09-12: Gemini's 20/day cap repeatedly blocked live verification (Phases 3-5), so Groq (higher free quota, same zero-cost constraint) became the default provider. Both Gemini and Groq implementations live side by side in `llm.py`, selected via `LLM_PROVIDER` env var — see `docs/modules/nl-to-sql.md`. |
| **Why not use the user's Claude.ai subscription session instead of an API key?** | Considered and explicitly declined — a consumer chat subscription authenticates the chat product, not a metered API, and driving backend traffic through a scraped session violates Anthropic's consumer terms regardless of technical feasibility. Not something this project does, even to save cost. |
| **Whitelist YAML as single source of truth** | `schema_whitelist.yaml` is read by both introspection (Phase 1, what the LLM *sees*) and validation (Phase 3, what SQL is *allowed to touch*). One file, two independent enforcement points — editing it changes both without code changes. |
| **Two separate DB connections per request (admin vs. restricted)** | The admin connection can introspect and write audit logs; the restricted connection physically cannot mutate data or see non-whitelisted tables (enforced by Postgres itself via `aac_readonly`'s grants). This is what makes guardrail layer 3 real defense-in-depth rather than another app-level check. |
| **sqlglot AST validation instead of regex/string checks** | Regex-based SQL safety checks are notoriously bypassable (comments, whitespace tricks, encoding). Parsing to an AST and checking node types (`exp.Insert`, `exp.Delete`, etc.) — including inside CTEs — is what actually catches `WITH x AS (DELETE ... RETURNING *) SELECT * FROM x`-style bypasses. |
| **Chart-type selection is a heuristic, not an LLM call** | Free, deterministic, and BUILD_PLAN Phase 4 explicitly says it doesn't need to be its own model call. Based purely on result column count/types. |
| **Explanation prompt receives actual result rows, not just SQL** | Prevents the model from hallucinating a number that isn't in the data — it can only describe what's literally in front of it (REQUIREMENTS.md FR8). |
| **One retry, not a loop** | REQUIREMENTS.md NFR-Cost: "a runaway loop must be structurally impossible." `nl_to_sql.ask()` hardcodes `range(2)` — one initial attempt, one retry, then a graceful failure. This applies uniformly whether the failure was a model refusal, a guardrail rejection, or a DB execution error. |
| **Connections opened per-request, no pooling** | `SCOPE.md` §6 explicitly cuts production-scale concerns for this portfolio demo. |
| **Repo-local git identity instead of global** | The project intentionally uses a separate GitHub account (`0x12md10`) from the user's primary account. `git config --local` + a repo-scoped credential helper keep this fully isolated — see the commit history / conversation log for setup details, not reproduced here since it's a one-time environment fact, not architecture. |

## 5. The three guardrail layers (the core trust argument)

This is what BUILD_PLAN.md calls "the most protected phase in the project" — worth being explicit about since it's the main thing a technical reviewer will scrutinize.

1. **Prompt-level instruction** (`nl_to_sql.py` `SYSTEM_PROMPT_TEMPLATE`) — tells the model to only generate SELECT, only reference whitelisted tables/columns, always LIMIT, and to refuse (via `refusal_reason`) rather than attempt anything else. This is the weakest layer (a model can misbehave) and is never trusted alone.
2. **AST validation** (`guardrail.py` `validate_sql`) — independent of what the model *said* it would do. Parses the actual SQL text with sqlglot and rejects: multi-statement stacking, any mutating/DDL node anywhere in the tree (including inside CTEs), row-locking clauses, bare `SELECT *`, non-whitelisted tables, non-whitelisted columns (with alias-awareness so legitimate `ORDER BY <alias>` isn't false-flagged).
3. **DB role permissions** (`restricted_db.py` + `db/migrations/002_readonly_role.sql`) — the actual execution connection uses `aac_readonly`, which has `SELECT`-only grants on exactly the 6 whitelisted tables and nothing else (no `query_log` access, no DML/DDL grants at all). Verified experimentally: even SQL that completely bypasses layer 2 (sent directly to this connection) is still refused by Postgres itself.

Every attempt — success, model refusal, validation rejection, or execution error — is logged to `query_log` via the admin connection (`query_log.py`), which the restricted role cannot read or write.

## 6. Known constraints / not-yet-resolved items

Tracked live in `BUILD_PLAN.md`'s "Flagged for Abishek" section — check there for current status, this doc won't stay in sync with it. As of this writing, the standing item is: **Gemini's free tier caps at 20 requests/day**, which has repeatedly blocked live end-to-end verification during Phases 3-5. Needs a decision (second key / paid tier / different provider / accept + rate-limit) before Phase 6 deployment.

## 6a. v2 initiative: Dashboard + Mascot AI Analyst

A separate, later-stage initiative — full planning docs in `v2/SCOPE.md`, `v2/REQUIREMENTS.md`, `v2/BUILD_PLAN.md`. Not started as of this writing. Summary: a KPI dashboard built on the existing Recharts stack (not an embedded third-party BI tool — Metabase/Superset were both evaluated and rejected, see `v2/SCOPE.md` §3), plus a bounded "mascot" AI analyst reachable from any dashboard tile that reuses v1's NL→SQL pipeline completely unmodified (one question, one answer, same three guardrail layers, no new guardrail surface). Do not start v2 work by editing this file or the root `SCOPE.md`/`REQUIREMENTS.md`/`BUILD_PLAN.md` — it lives entirely under `v2/`.

## 7. Where to look next

- Building/changing the NL→SQL prompt or retry logic → `docs/modules/nl-to-sql.md`
- Touching any guardrail layer → `docs/modules/guardrails.md`
- Changing what tables/columns are exposed → `backend/config/schema_whitelist.yaml` + `docs/modules/schema-introspection.md`
- Chart type logic or the explanation prompt → `docs/modules/visualization-explanation.md`
- The API contract or adding a new endpoint → `docs/modules/api.md`
- Frontend UI/UX → `docs/modules/frontend.md`
- Dashboard KPI tiles (v2) → `docs/modules/dashboard.md`
- Mascot AI analyst context-seeding (v2) → `docs/modules/mascot-analyst.md`
- Compass rebrand, app shell, `/compass` chat UI, dashboard visual overhaul, or `/landing` (v3) → `docs/modules/compass.md`
- Seed data or schema changes → `docs/modules/database.md`
