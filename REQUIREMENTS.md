# REQUIREMENTS.md — AI Analytics Copilot

Read `SCOPE.md` first. This document turns that scope into concrete functional and non-functional requirements. `BUILD_PLAN.md` breaks these into buildable slices in order — this file is the reference an agent (or Abishek) checks when a requirement's exact behavior is unclear mid-build.

---

## 1. Tech stack (fixed — don't re-litigate mid-build)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (React, TypeScript) | Matches existing stack; fast to ship a single-page UI |
| Backend | FastAPI (Python) | Matches existing stack; Python has the best SQL-safety tooling (`sqlglot`) and LLM SDKs |
| Database | PostgreSQL 16 | Universally recognized by clients; realistic target for real engagements |
| LLM | Google Gemini API via function calling / structured output (deviation from original Anthropic/OpenAI pick — see note below) | Need reliable structured SQL output, not free-form text; Gemini's free tier covers build + demo at zero cost |
| Charting | Recharts | Simple, works cleanly in React, matches the `dataviz` design approach |
| SQL parsing/validation | `sqlglot` (Python) | Parses and validates SQL AST without executing it — needed for the guardrail layer |
| Deployment | Backend: Railway or Fly.io. Frontend: Vercel. DB: managed Postgres on Railway/Fly.io/Neon. | Free/cheap tiers, fast to deploy, already in the freelance system's tool list |
| Seed data | Python + `Faker` | Realistic-looking demo data, not obviously fake |

**Note on LLM choice:** the tech stack table above says "fixed — don't re-litigate mid-build," but the LLM row was changed from Anthropic/OpenAI to Google Gemini on 2026-09-07 at Abishek's explicit request, to keep this a zero-cost build (Gemini's free tier). The rest of the stack is unchanged. If cost stops being a constraint later, swapping back to Claude/GPT is a small, isolated change (one module: the LLM call wrapper) since the rest of the pipeline (introspection, validation, execution) is provider-agnostic.

## 2. Demo dataset schema (fixed for v1 — do not expand)

A small SaaS company's operational database. ~6 tables, chosen so realistic business questions ("who churned," "what's our MRR trend," "which plan has the worst retention") have real, non-trivial answers.

- `customers` (id, name, company, signup_date, country, plan_id FK, status[active/churned/trial])
- `plans` (id, name, monthly_price, tier)
- `subscriptions` (id, customer_id FK, plan_id FK, started_at, ended_at nullable, status)
- `invoices` (id, customer_id FK, amount, issued_at, paid_at nullable, status[paid/overdue/failed])
- `usage_events` (id, customer_id FK, event_type, occurred_at) — simulates product usage/engagement
- `support_tickets` (id, customer_id FK, opened_at, closed_at nullable, priority, status)

Seed volume target: 300–800 customers, proportionally scaled related rows, spread over ~18 months of dates, so time-series and cohort-style questions produce visually interesting results. Include realistic messiness (some nulls, some overdue invoices, some churned customers) — a too-clean dataset makes demo answers look scripted.

## 3. Functional requirements

**FR1 — Schema introspection.** The backend must derive its schema context by querying Postgres's information_schema (tables, columns, types, foreign keys) at startup or on a manual refresh — not by hardcoding a description of the schema in a prompt string. A YAML whitelist config controls which tables/columns are exposed to the LLM (defense in depth, and demonstrates "you control exactly what the AI can see" to clients).

**FR2 — Natural language question input.** A single text input accepts a free-form question. No structured query builder.

**FR3 — NL → SQL generation.** Given the question and the schema context (from FR1), call the LLM to produce exactly one SQL statement, which must be a `SELECT`. The system prompt must instruct: use only whitelisted tables/columns, always include a `LIMIT`, prefer explicit column lists over `SELECT *`, and never generate DDL/DML.

**FR4 — SQL validation before execution.** Before any generated SQL touches the database, parse it with `sqlglot` and reject (with a clear reason) anything that: is not a single `SELECT` statement, references a table/column not on the whitelist, contains multiple statements (`;`-separated stacking), or contains DDL/DML keywords. A rejected query returns a user-facing explanation, not a raw error.

**FR5 — Safe execution.** Execute validated queries using a dedicated Postgres role that only has `SELECT` grants on the whitelisted tables (defense in depth — even a validation bypass can't mutate data). Enforce a statement timeout (e.g. 5 seconds) and auto-inject a row cap (e.g. `LIMIT 500`) if the generated query doesn't already have a tighter one.

**FR6 — Retry-on-error.** If execution fails (e.g. the LLM referenced a column that doesn't quite match), feed the database error back to the LLM once and let it retry. After one failed retry, return a clear "couldn't answer that" message rather than looping.

**FR7 — Result visualization.** Given the query's result set and the original question, choose a chart type: single scalar → stat tile, one categorical dimension + one metric → bar chart, one date/time dimension + one metric → line chart, otherwise → fall back to a plain table. This can be a simple heuristic based on result shape (column count/types) — doesn't need to be its own LLM call.

**FR8 — Plain-English explanation.** Generate a 2–3 sentence explanation of the result, grounded strictly in the returned rows (the explanation prompt should receive the actual result data, not just the question, so it can't hallucinate numbers not present in the result set).

**FR9 — Transparency toggle.** The UI must show the generated SQL on demand (collapsed by default, one click to expand). This is a trust-building feature to call out explicitly to clients — "the AI doesn't operate as a black box."

**FR10 — Guardrail demo path.** The system must handle adversarial/off-scope prompts gracefully and visibly: a prompt asking to delete/update/drop data, or asking about a non-whitelisted table, results in a clear "I can only answer read-only questions about [whitelisted topics]" message — never a raw stack trace, never a silent failure.

**FR11 — Question history (session-only).** Keep a simple list of the current session's questions and answers visible in the UI (no persistence required across sessions/page reloads for v1).

## 4. Non-functional requirements

- **Security:** three independent guardrail layers must all be present — (1) prompt-level instruction, (2) AST-level validation via `sqlglot`, (3) DB-role-level permission restriction. No single layer alone is sufficient; do not skip #3 because #2 "should" catch everything.
- **Performance:** end-to-end response (question → chart + explanation) under ~8 seconds for the test question set on typical LLM latency.
- **Reliability:** every failure mode (LLM timeout, invalid SQL, DB timeout, empty result set) must produce a clear message in the UI, never an unhandled exception visible to the user.
- **Observability:** log every question, generated SQL, validation outcome, and execution result (success/error) to a simple table or log file — useful both for debugging during the build and as a talking point ("full audit trail of every AI-generated query") in the demo.
- **Cost awareness:** cap max tokens on LLM calls; there's no need for elaborate cost controls in a demo, but a runaway loop must be structurally impossible (see FR6 — max one retry).

## 5. Explicit non-requirements (cross-reference to SCOPE.md cut list)
Authentication, multi-tenancy, multi-turn memory, non-Postgres support, and arbitrary schema upload are out of scope — see `SCOPE.md` §6 for the full list and rationale. Do not add partial versions of these "just in case."

## 6. Test question set (used across multiple build phases — write these once, reuse them)
Draft ~15 fixed natural-language questions against the seeded schema before Phase 2 starts, spanning: simple aggregation ("how many active customers do we have"), time-series ("show monthly revenue for the last 6 months"), comparison ("which plan has the highest churn rate"), join-heavy ("which customers have open support tickets and are on the Pro plan"), and out-of-scope/adversarial ("delete all customers with overdue invoices"). These same 15 questions are the acceptance test for Phases 2, 3, and 4 — write them down once in `BUILD_PLAN.md` Phase 2 and don't redefine them per phase.
