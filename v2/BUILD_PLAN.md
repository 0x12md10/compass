# v2/BUILD_PLAN.md — Business Dashboard + AI Analyst: Phased Build Plan

Read `v2/SCOPE.md` and `v2/REQUIREMENTS.md` first. This is a separate initiative from the root `BUILD_PLAN.md` (v1) — do not start v2 work until v1's Phases 0-5 are in a state you're comfortable calling stable (they don't need to be fully live-verified, per the deferred verification noted in root `BUILD_PLAN.md`, but the code should be settled — v2 builds directly on top of v1's pipeline and reuses it unmodified).

## How to use this file

Same conventions as root `BUILD_PLAN.md`: work top to bottom, update the status table as you go, add a line under "Flagged for Abishek" instead of quietly building something on the cut list, log material plan changes at the bottom.

## Status tracker

| Ticket | Name | Status | Notes |
|---|---|---|---|
| D0 | Seed data expansion | Done | 2,000 customers, 3-year window, verified: real Q4 seasonal bump per-year (not just aggregate recency skew), ~15% churn, ~10.3% overdue rate, 208 customers (~10%) with a genuine plan-change history (invoice amounts correctly step-change at the switch date), zero orphaned FKs. `db/SCHEMA.md` updated for the new `subscriptions` multi-row pattern and new seed volume target. |
| D1 | Dashboard data layer (fixed KPI queries) | Done | 8 tiles, one endpoint each, all manually verified against real data (MRR $246,681; 1668/301/31 active/churned/trial; 10.26% overdue — matches D0's independent numbers). FR-D2 confirmed at code level (single `_run_tile()` helper, grep-verified to only ever call `get_restricted_connection()`). FR-D5 proven with an actual monkeypatched broken-tile test, not just reasoning about it — other tiles kept responding normally. `days` param validated (422 on bad input, never reaches SQL). |
| D2 | Dashboard frontend (grid + tiles + filter) | Done | Built on `useDashboardTile` hook + `TileFrame`/`StatTileCard`/`ChartTileCard`, reusing v1's `ChartRenderer` unmodified for the bar/line tiles. **Actually visually verified this time** (v1's standing gap explicitly not repeated) via a real headless-Chromium screenshot pass (Playwright, since `chromium-cli` wasn't available on this Windows box) — all 8 tiles render real data, zero console errors, date-range filter genuinely re-fetches and re-renders (365d vs 30d compared directly). Caught and fixed one real layout bug from the screenshot (stat tiles stretching to match a taller sibling's grid row height) that wouldn't have been caught by a build-only check. |
| D3 | Mascot AI analyst — backend context-seeding | Done | `nl_to_sql.ask()` takes optional `context: str`, prepended to the user prompt only — confirmed by code inspection that zero branching exists around `validate_sql`/`execute_readonly` regardless of context. Live-tested against Groq (see log below for the model-catalog surprise this surfaced) with 4 real spot-checks — see notes below and in `docs/modules/mascot-analyst.md`. |
| D4 | Mascot AI analyst — frontend UI | Done | `MascotContext`/`MascotPanel`/`MascotToggleButton`/`AskAiButton`, wired into every dashboard tile with context strings that bake in the actual selected `days` value (per D3's finding). Live-verified end-to-end with a real Playwright + Groq test: tile-anchored question → correct SQL (using the "last 365 days" from context) → grounded correct explanation → chart + SQL toggle rendered, all reusing v1's `ChartRenderer` unmodified. Also verified: the bare floating-avatar entry point (no tile anchor), and one refusal case (a delete request through a tile-anchored mascot) rendering the same amber refusal styling as v1's ask bar. Two real bugs found and fixed during testing — see log below (one in my own test script, one a genuine stale-process infra issue, not app code). |
| D5 | Guardrail re-verification through the mascot | Done | All 3 required categories (adversarial delete/update, out-of-scope, prompt-injection) run BOTH bare and context-seeded, back-to-back, via `test_d5_mascot_guardrails.py` — all 6 blocked correctly, identical outcome bare vs. mascot-anchored for every case. Confirmed in `query_log` too: context-seeded entries logged with the effective (context+question) text, outcome `refused_by_model` for all. |
| D6 | Polish & demo narrative update | Done | Mascot copy: added a one-line idle-state hint ("Ask a question and I'll dig into the numbers behind {tile}") — kept deliberately minimal per SCOPE.md's UI-polish-last priority. Root `README.md` updated with a "The demo, in two parts" section explaining the ask-bar + dashboard-and-mascot story together, linking to the guardrail/mascot docs for the trust argument. |
| D7 | Docs: dashboard.md + mascot.md module docs | Done | `docs/modules/dashboard.md` (D1+D2) and `docs/modules/mascot-analyst.md` (D3+D4) both complete and cross-linked from `docs/README.md`/`docs/ARCHITECTURE.md`. |

Status values: `Not started`, `In progress`, `Blocked (reason)`, `Done`.

---

## D0 — Seed data expansion

**Why:** A richer dataset makes both v1's ad-hoc questions and v2's dashboard look like a real medium-sized business rather than a toy. Do this first — it benefits everything downstream and has no dependency on the dashboard decision.

**Tasks:**
- Extend `db/seed.py`: raise default volume to 1,500-3,000 customers, extend the time window to 30-36 months.
- Add a plan-tier-change pattern: some fraction of customers get a second `subscriptions` row reflecting an upgrade/downgrade partway through their lifetime (no schema change — `subscriptions` already supports multiple rows per customer).
- Widen `event_type` and `country` value sets for more visual variety in category-based charts.
- Introduce at least one deliberate seasonal pattern (e.g., signups bump in a specific quarter) so a trend chart has real shape.
- Re-verify the same spot-check queries v1's Phase 0 used (churn rate, MRR trend, overdue %) still produce plausible, non-degenerate numbers at the new scale.

**Acceptance criteria:**
- `python db/seed.py` at the new default volume completes without error and `db/SCHEMA.md`-documented constraints still hold (no orphaned FKs, status/enum values still valid).
- Manual spot-check queries produce plausible numbers, re-verified fresh (don't assume v1's Phase 0 numbers still apply at 5-7x the volume).
- `db/SCHEMA.md` updated if the plan-tier-change pattern changes how `subscriptions` should be described.

---

## D1 — Dashboard data layer (fixed KPI queries)

**Why:** The dashboard needs to be fast and reliable — LLM-generating dashboard tile queries on every page load would be slow, costly, and non-deterministic in a way a KPI dashboard shouldn't be. Hand-written, reviewed SQL is the right tool here, per REQUIREMENTS.md FR-D1.

**Tasks:**
- New backend module (e.g. `backend/app/dashboard.py`) with one function per tile, each returning `(columns, rows)` via `restricted_db.execute_readonly()` — same restricted connection as v1's ad-hoc pipeline (FR-D2), not the admin connection.
- Implement the tile set from REQUIREMENTS.md FR-D1 at minimum: current MRR, monthly revenue trend, customer counts by status, churn rate by plan, signups by month, signups by country, overdue invoice rate, ticket volume.
- Each tile function accepts an optional date-range parameter (FR-D3) where it's meaningful.
- **Decided**: one endpoint per tile in `main.py` (e.g. `GET /dashboard/mrr`, `GET /dashboard/revenue-trend`, ...), not one combined endpoint — matches FR-D5 cleanly and lets the frontend fetch/fail each tile independently.

**Acceptance criteria:**
- Every tile query manually verified against the seeded data (same rigor as v1 Phase 2's manual semantic check) — numbers must be traceably correct, not just "a number came back."
- Confirmed every tile query executes via `aac_readonly`, not the admin connection (grep/test for this — don't just trust it by convention).
- A single tile's query failing (simulate with a broken query temporarily) doesn't take down the other tiles' endpoints.

---

## D2 — Dashboard frontend (grid + tiles + filter)

**Why:** This is the visible "here's a real dashboard" half of the demo.

**Tasks:**
- New page (e.g. `frontend/src/app/dashboard/page.tsx`), grid layout, responsive per FR-D4.
- Reuse `StatTile`/`BarChartView`/`LineChartView`/`DataTable` from `frontend/src/components/charts/` unmodified where they fit; add new chart components only if a tile genuinely needs a shape v1 doesn't have (e.g. a donut/pie for status distribution) — check against the `dataviz` skill's guidance before adding a new mark type.
- Date-range filter control (FR-D3), wired to re-fetch the tiles it affects.
- Per-tile loading and error states (FR-D5) — each tile is its own independent fetch, not one big blocking request for the whole page.

**Acceptance criteria:**
- All planned tiles render with real data.
- Filter changes visibly update the relevant tiles without a full page reload.
- Verified on a laptop-width and phone-width viewport.
- Visual review actually done this time (see the standing gap in root `BUILD_PLAN.md` about charts never being visually checked in v1 — don't repeat that gap here; use the `run` skill or a manual look before calling this done).

---

## D3 — Mascot AI analyst: backend context-seeding

**Why:** This is where the "AI analyst" capability actually lives, and it needs to be built carefully to satisfy REQUIREMENTS.md FR-M3 — context-aware, but with zero new guardrail surface.

**Tasks:**
- Extend (not replace) the existing `/ask` request shape with an optional `context` field: `{tile_name, tile_description, tile_sql_summary}` or similar — a human-readable summary of what the user is looking at, not raw SQL injected verbatim into a place that could confuse the guardrail's whitelist checks.
- In `nl_to_sql.py` (or a thin wrapper around it — decide based on how invasive the change is once you're looking at the actual code), prepend the context to the user-facing prompt only, never to the system prompt's rules section, and never in a way that changes which whitelist/validator/role is used.
- Explicitly do NOT add a separate code path, separate whitelist, or separate DB role for mascot-originated questions — same `ask()` function, same `validate_sql()`, same `aac_readonly` connection.

**Acceptance criteria:**
- A context-seeded question produces correctly-scoped, relevant SQL more often than the same question asked bare (spot-check a handful of tile-anchored questions, e.g. "why did this spike?" asked from the revenue-trend tile).
- Code-level confirmation that context-seeded requests flow through the exact same `validate_sql`/`execute_readonly` calls as bare ask-bar requests — no branching.

---

## D4 — Mascot AI analyst: frontend UI

**Tasks:**
- A lightweight persistent mascot affordance (avatar + name, simple personality per FR-M4) — small floating panel or docked sidebar, opened from a dashboard tile's "Ask AI about this" action.
- Reuses the existing ask-bar result rendering (`ChartRenderer`, explanation text, SQL toggle) — don't rebuild result presentation from scratch.
- Graceful degradation states (FR-M5) — same refusal/error/loading patterns as v1's ask bar, styled to fit the mascot's presentation.
- **Finding from D3's live testing, feed into the context string here**: a context description that only names the tile generically (e.g. "the Signups by Country tile, showing top 10 countries within the selected range") isn't always enough — one D3 spot-check question was correctly refused by the model for lacking a *concrete* date range. Build the context string to include the actual selected value (e.g. "...within the last 90 days" using the real `days` state), not just a static per-tile description.

**Acceptance criteria:**
- A person can click "Ask AI about this" on at least 2 different tile types, ask a question, and get an answer without leaving the dashboard.
- Failure modes (refusal, error, quota exhaustion) show a friendly in-character message, never a raw error.

---

## D5 — Guardrail re-verification through the mascot

**Why:** REQUIREMENTS.md §6's explicit acceptance bar — the mascot must not be a weaker path than the plain ask bar, and this has to be proven, not assumed.

**Tasks:**
- Re-run, through the mascot's contextual entry point specifically: one adversarial (delete/update) question, one out-of-scope question, one prompt-injection-style question.
- Confirm identical blocking behavior to the equivalent v1 ask-bar tests (cross-reference `docs/modules/guardrails.md` and `backend/app/test_guardrails.py` for the originals).

**Acceptance criteria:**
- All three blocked exactly as they are via the plain ask bar. Any difference is treated as a bug, not a documented variance.

**Note:** this ticket is blocked on the same LLM-quota-related live-verification deferral already logged in root `BUILD_PLAN.md`'s "Flagged for Abishek" section — don't attempt D5 until that's resolved, since it'll consume the same constrained quota.

---

## D6 — Polish & demo narrative update

**Tasks:**
- Tighten mascot personality/copy (still bounded by SCOPE.md §7's "UI polish is most disposable" priority — don't over-invest here).
- Update whatever demo assets exist (README section, Loom script if one exists by this point) to include the "dashboard + AI analyst" story alongside v1's ask-bar story.

**Acceptance criteria:** matches `v2/SCOPE.md` §8 Definition of Done.

---

## D7 — Docs: dashboard.md + mascot.md module docs

**Why:** v1 established a real discipline of a `docs/modules/*.md` per structural piece (what it does, why, verified results, gotchas) — easy for this to quietly slip on a "later" ticket. Doing it alongside D1-D4 rather than only at the end, per module as it's built.

**Tasks:**
- `docs/modules/dashboard.md` — written alongside/immediately after D1-D2: the tile list, the per-tile-endpoint decision and why, the FR-D3 range-filterable table, how FR-D2's restricted-role execution is enforced/verified.
- `docs/modules/mascot-analyst.md` — written alongside/immediately after D3-D4: how context-seeding works (FR-M3), what was verified in D5, the persona/UX decisions from D4.
- Cross-link both from `docs/ARCHITECTURE.md`'s "where to look next" section, same as the other module docs.

**Acceptance criteria:** both docs exist and are accurate as of D6's completion — not written from memory after the fact once details are fuzzy.

---

## Flagged for Abishek

*(Same convention as root BUILD_PLAN.md — a line here any time a build decision needs a human call, or scope threatens to expand beyond v2/SCOPE.md.)*

- *(none yet)*

## Log of changes

- 2026-09-12 (D4): While live-testing the mascot via Playwright, hit two real bugs, both now understood and fixed: (1) my own test script's `button:has-text("Ask")` selector was a substring match that also matched "Ask AI about this" buttons, clicking the wrong tile's button — fixed with `getByRole('button', { name: 'Ask', exact: true })`. (2) The backend process serving HTTP requests was stale — started before D3's model/env fixes were saved to disk — because my earlier "kill the backend" commands used `pgrep`, which silently doesn't exist in this bash (no error, just a no-op). Fixed by killing the exact PID found via `Get-NetTCPConnection`/`Stop-Process` in PowerShell instead. Saved as a standing memory (`pgrep-unavailable-use-powershell`) so this isn't rediscovered next session. Also added a `data-tile-title` attribute to `TileFrame` — harmless in production, but what made it possible to prove bug (1) was a test artifact and not an app bug.
- 2026-09-12 (D3): First real live test against Groq since it was wired up — surfaced that Groq's model catalog had changed entirely since `llm.py` was written: `llama-3.3-70b-versatile` (and Llama generally) is gone, replaced by `openai/gpt-oss-120b`/`gpt-oss-20b`, Qwen3 variants, and Groq's own `compound` models. Switched the default to `openai/gpt-oss-120b`. That model is a **reasoning model** — it spends tokens "thinking" before answering, which silently ate the entire `max_tokens` budget on early tests (empty `content`, `finish_reason='length'`). Fixed two ways: added `reasoning_effort="low"` to both Groq call sites in `llm.py` (only available after upgrading the `groq` SDK from 0.13.1 to 1.7.0 — bumped in `requirements.txt`), and this is worth remembering if explanations ever come back empty again. See `docs/modules/mascot-analyst.md` for the D3 test results this same session produced.
- 2026-09-12 (D2): `chromium-cli` (the `run` skill's preferred browser driver) isn't available on this Windows dev machine. Fell back to Playwright directly (`npm install --no-save playwright`, `npx playwright install chromium`), screenshotted, then removed the npm package again afterward (confirmed via lockfile diff it left no trace beyond Next.js's own pre-existing optional peerDependency listing for `@playwright/test`). The downloaded Chromium binary itself is cached under `~/AppData/Local/ms-playwright` and persists across sessions — only the npm package needs reinstalling (`npm install --no-save playwright`) next time a visual check is needed.
- 2026-09-12: v2 initiative created. Decision to build the dashboard on the existing Recharts stack rather than embed Metabase (free tier is watermarked) or Superset (doesn't fit free hosting — needs 2-8GB RAM + its own Postgres/Redis/Celery stack) made after actual research, not assumption — see `v2/SCOPE.md` §3 and the conversation log around this date for sources. Mascot AI analyst scoped as bounded (one question/one answer, reusing v1's pipeline unmodified) rather than proactive/autonomous, per explicit decision.
