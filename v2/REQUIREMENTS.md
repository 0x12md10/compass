# v2/REQUIREMENTS.md — Business Dashboard + AI Analyst

Read `v2/SCOPE.md` first. This turns that scope into concrete requirements. `v2/BUILD_PLAN.md` breaks these into tickets in build order.

---

## 1. Tech stack (extends v1's, no new infra)

| Layer | Choice | Why |
|---|---|---|
| Dashboard charts | Existing `frontend/src/components/charts/` (Recharts) | Reuse, not rebuild — see SCOPE.md decision record |
| Dashboard data | New fixed-SQL backend endpoints, executed via the existing `aac_readonly` restricted connection | Reliability/speed for KPI tiles; same trust story as v1's ad-hoc queries |
| Mascot AI analyst | Existing v1 pipeline (`nl_to_sql.py` → `guardrail.py` → `restricted_db.py` → `chart_selector.py`/`explain.py`), invoked with pre-loaded context | Zero new guardrail surface, reuses everything already verified in v1 |
| Seed data | Extend `db/seed.py` (Faker) | Same tool, larger/richer output |

No new database, no new LLM provider, no new charting library, no new hosting requirement beyond what v1 already needs.

## 2. Seed data requirements

- Volume: 1,500-3,000 customers (up from v1's 300-800), spanning at least 30-36 months (up from ~18).
- New variety, without a schema change: wider `event_type` set, wider `country` distribution, a plan-tier change pattern (a customer's `plan_id` changing over their lifetime via a second `subscriptions` row — the schema already supports multiple subscription rows per customer, so this needs no migration).
- Seasonal/trend texture: at least one visible seasonal pattern (e.g. a Q4 signup bump) so a "show me the trend" chart looks like a real business, not a random walk.
- Still produces plausible, non-trivial aggregate numbers on the same spot-check queries v1 used (churn rate, MRR trend, overdue %) — re-verify after scaling up, don't assume the heuristics still hold at higher volume.

## 3. Dashboard requirements

**FR-D1 — Fixed KPI tiles.** At minimum, one backend endpoint per tile (decided over a single combined endpoint — matches FR-D5's per-tile independent loading/error requirement without the frontend having to fake independence from one shared response):

| Tile | Type | Range-filterable? (FR-D3) |
|---|---|---|
| Current MRR | stat | No — always as-of-now |
| Active / churned / trial customer counts | stat row | No — always as-of-now |
| Overdue invoice rate | stat | No — always as-of-now |
| Monthly revenue trend (last 12mo default) | line | Yes |
| Signups by month | line | Yes |
| Signups by country | bar | Yes |
| Churn rate by plan | bar | Yes (churn measured within the selected range) |
| Support ticket volume, open vs. closed | bar/stat pair | Yes |

Each tile's SQL is hand-written and reviewed, not LLM-generated at request time.

**FR-D2 — Defense-in-depth applies to the dashboard too.** Every fixed dashboard query executes through the same `aac_readonly` role as v1's ad-hoc queries (`docs/modules/guardrails.md`) — no separate "trusted" DB connection for dashboard code, even though the SQL itself is developer-authored, not LLM-generated. This is a deliberate trust-building choice, not an oversight: if the dashboard needed elevated permissions, that would be a red flag worth noticing.

**FR-D3 — Date-range control.** At least one shared filter (e.g. last 30/90/365 days, or a custom range) that re-queries and re-renders the range-filterable tiles listed in FR-D1's table above. The point-in-time stat tiles (current MRR, customer status counts, overdue rate) ignore the filter by design, not by omission.

**FR-D4 — Responsive grid layout.** Usable on a laptop and phone-width screen, consistent with v1's existing responsiveness bar.

**FR-D5 — Loading/error states per tile.** A single tile's query failing must not break the rest of the dashboard — each tile handles its own loading/error state independently (same reliability principle as v1's NFR-Reliability, applied per-tile instead of per-question).

## 4. Mascot AI analyst requirements

**FR-M1 — Contextual entry point.** Each dashboard tile has an "Ask AI about this" affordance. Clicking it opens the mascot UI with the tile's title and a short data summary (not raw SQL — a human-readable summary) pre-loaded as context.

**FR-M2 — One question, one answer, no chaining.** The mascot accepts exactly one user question per interaction and returns exactly one answer (SQL + chart + explanation, or a refusal), via the unmodified v1 pipeline. It does not automatically ask itself follow-up questions or run multiple queries to build one answer. A user can ask a second question, but that's a new, independent interaction — not the mascot autonomously continuing.

**FR-M3 — Context influences the prompt, not the guardrails.** The pre-loaded tile context is used to seed a more specific system/user prompt (e.g. "the user is looking at the 'Churn rate by plan' tile, computed as: <fixed SQL and a plain description>; they're asking: <question>") — it must NOT bypass, weaken, or add a special code path around any of the three guardrail layers. The exact same `validate_sql`, `aac_readonly` role, and row/timeout caps apply. Verify explicitly: an adversarial question asked through the mascot (not just the bare v1 ask bar) is still blocked the same way.

**FR-M4 — Mascot persona.** A lightweight visual identity (avatar, name, a few lines of consistent tone in its responses) — "acting as a business analyst" per the original ask. This is presentation, not new backend logic; keep it simple (SCOPE.md §7 priority order still puts UI polish last).

**FR-M5 — Graceful degradation.** If the underlying pipeline refuses or fails (same failure modes as v1: model refusal, guardrail rejection, execution error, LLM quota exhaustion), the mascot shows a friendly in-character message, never a raw error.

## 5. Explicit non-requirements

Everything on v2/SCOPE.md's cut list (§6): no proactive/unprompted insight generation, no multi-step AI reasoning, no embedded third-party BI tool, no new guardrail model, no user accounts/saved dashboards, no real-time data. Do not add partial versions of these "since it's easy" — flag instead, per the same discipline v1's REQUIREMENTS.md established.

## 6. Acceptance bar for "the mascot reuses v1's guardrails," concretely

Before this initiative is considered done, re-run (through the mascot's contextual entry point, not just the original ask bar) at minimum:
- One adversarial question (a delete/update attempt)
- One out-of-scope question
- One prompt-injection-style question (the kind already verified against the bare ask bar in v1 Phase 3)

All three must be blocked exactly as they are through the plain ask bar. If any behave differently through the mascot's context-seeding path, that's a bug in FR-M3, not an acceptable variance.
