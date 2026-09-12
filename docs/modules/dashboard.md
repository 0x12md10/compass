# Module: Dashboard (v2, tickets D1 + D2)

Backend files: `backend/app/dashboard.py`, dashboard endpoints in `backend/app/main.py`
Frontend files: `frontend/src/app/dashboard/page.tsx`, `frontend/src/components/dashboard/*`, `frontend/src/lib/dashboardApi.ts`

Part of the v2 initiative — see `v2/SCOPE.md`, `v2/REQUIREMENTS.md`, `v2/BUILD_PLAN.md`. Not part of v1's scope.

## What it does

Serves 8 fixed KPI tiles (MRR, customer status counts, overdue rate, revenue trend, signups by month/country, churn by plan, ticket volume) as one HTTP endpoint per tile, each backed by hand-written SQL — not LLM-generated per request, unlike v1's `/ask`.

## Why fixed SQL instead of reusing the NL→SQL engine

A dashboard needs to be fast, deterministic, and cheap to load repeatedly — properties an LLM call doesn't have. v1's `/ask` pipeline stays reserved for genuine ad-hoc questions; the dashboard's job is different (known questions, asked often), so known-good SQL is the right tool (v2/REQUIREMENTS.md FR-D1).

## The trust decision: same restricted role, no exceptions

Every tile function in `dashboard.py` executes via `restricted_db.execute_readonly()` — the exact same `aac_readonly` connection v1's guardrail layer 3 uses for LLM-generated queries (see `docs/modules/guardrails.md`). This was a deliberate choice (FR-D2), not a default: the dashboard code is developer-authored and could technically run on the admin connection with no functional downside, but doing so would mean the codebase has a "trusted path" that bypasses the read-only role — undermining the very story guardrail layer 3 tells. Verified at the code level (not just by convention): every dashboard endpoint in `main.py` funnels through a single `_run_tile()` helper that calls `get_restricted_connection()` exclusively — `get_connection()` (the admin connection) is grep-confirmed to appear only in the `/ask` endpoint.

## The 8 tiles

| Function | Endpoint | Range-filterable? | Notes |
|---|---|---|---|
| `current_mrr` | `GET /dashboard/mrr` | No | Sum of `monthly_price` across active subscriptions |
| `customer_status_counts` | `GET /dashboard/customer-status` | No | active/churned/trial counts, as-of-now |
| `overdue_invoice_rate` | `GET /dashboard/overdue-rate` | No | % of all invoices ever that are overdue |
| `revenue_trend` | `GET /dashboard/revenue-trend?days=N` | Yes | Monthly paid revenue within the lookback window |
| `signups_by_month` | `GET /dashboard/signups-by-month?days=N` | Yes | New customers per month within the window |
| `signups_by_country` | `GET /dashboard/signups-by-country?days=N` | Yes | Top 10 countries by signups within the window |
| `churn_by_plan` | `GET /dashboard/churn-by-plan?days=N` | Yes | See below — non-trivial attribution logic |
| `ticket_volume` | `GET /dashboard/ticket-volume?days=N` | Yes | Open vs. closed tickets opened within the window |

`days` defaults to 365, validated by FastAPI (`Query(ge=1, le=3650)`) — an out-of-range or non-numeric value returns a clean `422`, never reaches the SQL layer.

## `churn_by_plan`'s attribution logic (the one non-obvious query)

A churned customer's **current** `plan_id` reflects whichever plan they were on when they churned — but `subscriptions` is an append-only history (see `db/SCHEMA.md`'s note on the v2 plan-change pattern), so naively joining `customers.plan_id` would be correct but naively filtering `subscriptions` by date would double-count a customer who changed plans before churning. The query uses `DISTINCT ON (customer_id) ... ORDER BY customer_id, started_at DESC` to isolate each churned customer's **latest** subscription row, then range-filters on *that* row's `ended_at` — meaning "churned within the window" is measured correctly even for customers with a plan-change history.

## Error handling (FR-D5)

Every endpoint is independent — one tile's query failing (verified with a monkeypatched broken query during D1) returns a `502` with a friendly message for that tile only; every other tile keeps responding normally. There's no shared request or batching that could let one bad tile take the rest down.

## Verified results (D1)

All 8 tiles manually checked against the actual seeded data (2,000 customers, v2/D0's expanded dataset) — not just "a number came back":
- MRR ($246,681), status counts (1668/301/31 active/churned/trial), overdue rate (10.26%) all match D0's independently-verified numbers.
- Revenue trend and signups-by-month both show the same Q4 seasonal bump D0 verified (e.g. Oct 2025 signups spike visible in the `days=365` window).
- `ticket_volume`'s closed/open ratio (915/299 ≈ 75.4% closed) matches the seed script's designed 75% closure rate — confirms the query logic, not just plausibility.
- `days` parameter changing the result set (tested at 365 vs. 180) confirmed by actually comparing outputs, not just trusting the SQL.

## Frontend (D2)

`frontend/src/app/dashboard/page.tsx` renders the tiles in three groups:
- A point-in-time row: `StatTileCard` for MRR and overdue rate (custom currency/percent formatting), `ChartTileCard` (bar) for customer status counts.
- A range-filterable grid: `ChartTileCard` for revenue trend (line), signups by month (line), signups by country (bar), churn by plan (bar), ticket volume (bar) — all driven by one shared `days` state set by the date-range buttons at the top.

**Reuses v1's `ChartRenderer` unmodified** for every bar/line tile — the dashboard doesn't need new chart components because the chart *shape* is known statically per tile (unlike v1's `/ask`, where `chart_type` comes back from the backend at request time). `ChartTileCard` just hardcodes which shape each tile wants and passes it straight to `ChartRenderer`.

**`useDashboardTile`** (a hook, not a shared page-level fetch) is what actually delivers FR-D5 on the frontend side — each tile calls it independently with its own `path`/`days`, so one tile's loading/error state can never leak into another's. `TileFrame` wraps the bar/line tiles' loading/error/title chrome consistently; the two `StatTileCard`s intentionally don't use `TileFrame` — `StatTile` already renders its own labeled box, and wrapping it in `TileFrame` too would double the border/title (caught during D2's actual visual review, not assumed).

## Verified results (D2) — an actual screenshot pass, not a build-only check

v1 left a standing gap where charts were never visually reviewed (no screenshot tool in that session). Deliberately not repeated here: `chromium-cli` (the `run` skill's default) wasn't available on this Windows machine, so Playwright was installed ad-hoc (`npm install --no-save playwright` + `npx playwright install chromium`), used to screenshot the running dashboard, then removed again (confirmed via lockfile diff that nothing but Next.js's own pre-existing optional peer-dependency listing for `@playwright/test` remained).

What that screenshot pass actually caught:
- All 8 tiles render real data with zero console errors (one apparent "stuck on Loading..." tile on the first pass turned out to be a fetch-timing artifact of the test script, not a real bug — confirmed by re-running with a longer wait and by curling the endpoint directly, which responded in 333ms).
- **A real layout bug**: the two stat tiles were stretching to match the taller "Customers by Status" bar chart's grid-row height, leaving a large dead-space gap. Fixed with `items-start` on that row's grid container — the kind of bug a type-check or a headless HTTP fetch would never catch, only an actual look at the rendered page.
- The date-range filter was verified to genuinely re-fetch and re-render (not just toggle a visual state): compared the 365-day and 30-day views directly — month ranges, country breakdowns, and churn-by-plan numbers all changed correctly, and the active filter button's selected-state styling updated too.

## If you need to change something here

- **Add a new tile**: add a function to `dashboard.py` using `execute_readonly()`, add an endpoint in `main.py` via `_run_tile()`, add a `ChartTileCard`/`StatTileCard` to `dashboard/page.tsx`, add a row to the table above and to `v2/REQUIREMENTS.md` FR-D1.
- **Change the default lookback window**: `dashboard.DEFAULT_DAYS` (backend) — the frontend's `RANGE_OPTIONS` in `page.tsx` are independent of this and can offer whatever presets make sense regardless.
- **Change the country tile's top-N cap**: the `LIMIT 10` in `signups_by_country`.
- **Do a visual check again later**: `npm install --no-save playwright` (the downloaded Chromium binary is cached under `~/AppData/Local/ms-playwright` and persists across sessions, so this is fast) — see `v2/BUILD_PLAN.md`'s log for the exact commands used.
