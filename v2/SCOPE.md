# v2/SCOPE.md — Business Dashboard + AI Analyst (v2 initiative)

## What this document is

A **separate initiative** layered on top of the v1 AI Analytics Copilot (see root `SCOPE.md`/`REQUIREMENTS.md`/`BUILD_PLAN.md`, unchanged and still the source of truth for v1). v1 stays scoped exactly as it was — this doc does not modify it, does not relax its guardrail priorities, and does not compete with it for the "most protected" slot. Read root `SCOPE.md` first; this assumes it.

## 1. One-line pitch

"Here's a real business dashboard on your data — and an AI analyst living right next to it, one click away, that can explain any chart or answer a follow-up question about what you're looking at."

## 2. Why this exists

v1 proved the safe NL→SQL pattern works. v2 answers a sharper sales question: *"Can your AI work alongside a dashboard we already look at every day, not just as a bare search box?"* This is closer to real client engagements — nobody wants you to build them a new BI tool from scratch; they want AI added next to the dashboard/data they already have. Showing both — a real dashboard, and the same guardrailed AI engine reachable contextually from it — is a stronger demo of that specific capability than either piece alone.

## 3. Decision record (why this shape, not another one)

Two build approaches were seriously evaluated and rejected before landing here — worth recording so this doesn't get silently re-litigated:

- **Embed an open-source BI tool (Metabase/Superset) instead of building a dashboard.** Rejected after actual research (not just assumption): Metabase's free/open embedding always carries a "Powered by Metabase" watermark — removing it requires a paid license. Apache Superset has no such branding restriction, but requires 2-8GB RAM and a Postgres+Redis+Celery stack of its own — it does not fit any free hosting tier, so it fails the zero-cost constraint this whole build operates under. Both also mean shipping someone else's UI as the portfolio centerpiece, which undercuts "look what we built." See the conversation log around 2026-09-12 for the full research and sources.
- **A proactive/autonomous AI analyst that scans data and surfaces insights unprompted.** Rejected for v2's first version as too large a design problem on its own (what triggers an insight? how many queries can it run unprompted? how do you keep it from generating noise?). Deliberately deferred — see §6.
- **A `campaign`/acquisition-channel dimension on customers.** Considered for D0's seed expansion, decided against: it would require an actual schema change (a new `customers` column) that v1's fixed 6-table schema didn't plan for, and §5 gates any schema change behind explicit approval. D0 shipped without it — the seed data's variety comes from `event_type`/`country`/plan-change patterns instead.

## 4. What's IN scope for v2

- A dashboard page presenting the same seeded demo data (v1's schema, plus a richer/larger seed — see §5) as a set of KPI tiles and charts: revenue trend, churn by plan, signups by country/month, current MRR, overdue-invoice rate, support ticket volume — the kind of thing a founder would actually glance at daily.
- Built entirely on the **existing Recharts component library** from v1 (`frontend/src/components/charts/`) — no new charting library, no embedded third-party BI tool.
- Dashboard tiles are backed by **fixed, hand-written SQL** (not LLM-generated per page load) — reliability and speed matter for a dashboard in a way they don't for an ad-hoc question. These fixed queries still execute through the same `aac_readonly` restricted role as v1's ad-hoc queries (see `docs/modules/guardrails.md`) — the dashboard gets no special privileged path, which is itself a small trust-building detail worth calling out in the demo.
- A **mascot AI analyst**, presented as a persistent small avatar/panel, reachable from any dashboard tile ("ask AI about this chart"). Bounded scope (see §6): **one question, one query, one answer** per interaction — literally the v1 ask-bar engine (Phases 2-4, unmodified), just invoked with the clicked tile's context pre-loaded instead of a bare empty input. No new guardrail surface — the existing three-layer system already covers this because it's the same code path.
- A larger, more varied seed dataset (see §5) so the dashboard has enough texture to look like a real medium-sized business, not a toy.

## 5. Seed data expansion (do this regardless of the dashboard decision)

Independent of the dashboard work and worth doing first since it strengthens both v1 and v2:
- Scale up from ~400 to something in the low thousands of customers, spanning a longer history (multi-year, not just 18 months) so year-over-year and seasonal patterns are visible.
- More variety: additional `event_type` values, a wider `country` spread, a plan-tier migration pattern (customers upgrading/downgrading, not just churning).
- Still governed by v1's `REQUIREMENTS.md` §2 schema unless a schema change is explicitly approved — widen the *data*, not the *schema*, without a separate decision.

## 6. What's explicitly OUT of scope for v2 (cut list)

- **No proactive/autonomous insight generation.** The AI analyst never runs a query the user didn't trigger. Deferred to a hypothetical v3 if ever pursued — needs its own scoping pass on triggers, frequency, and noise control.
- **No multi-step/chained AI reasoning** (the AI running several queries to build up one answer). Still one question in, one validated SELECT out, same as v1.
- **No embedded third-party BI tool.** Decided above; don't quietly revisit this mid-build because a chart type is annoying to build by hand.
- **No new guardrail model.** The AI analyst reuses v1's three-layer system exactly as-is. If a dashboard-specific AI feature seems to need something the current guardrails don't cover, that's a stop-and-flag moment, not a place to improvise a fourth layer.
- **No user accounts, saved dashboards, or per-user customization.** Same single-unauthenticated-instance posture as v1.
- **No real-time/streaming data.** Dashboard queries run against the same static seeded snapshot as v1's ad-hoc questions.

## 7. Priority order (mirrors v1's structure, adapted)

1. **v1's guardrails remain untouched and are never weakened to make v2 easier.** If anything in v2 seems to require loosening a v1 guardrail, that's a hard stop — flag it, don't build around it.
2. **Dashboard data correctness** — the fixed KPI queries must be as rigorously checked as v1's ad-hoc query engine (each one manually verified against the seeded data, same spirit as v1 Phase 2's acceptance criteria).
3. **Mascot AI analyst** — since it's a thin contextual wrapper over already-built, already-tested v1 machinery, this is lower marginal risk than it sounds; still verify the "context pre-loading" doesn't change generated-SQL behavior in a way that weakens guardrail rigor.
4. **Visual/UX polish of the dashboard and mascot** — same as v1's UI priority, the most disposable if a tradeoff comes up.

## 8. Definition of done

1. Seed data expanded per §5, verified with the same "plausible, non-trivial numbers" bar v1 used.
2. Dashboard page live, showing all planned tiles, each backed by a verified fixed query executed through the restricted role.
3. Mascot AI analyst reachable from at least 2 tile types, demonstrably reuses v1's guardrail pipeline (same adversarial-question protections apply — verify by trying an adversarial question through the mascot, not just the original ask bar).
4. Updated demo narrative/README section explaining the dashboard-plus-AI story, ready to fold into the eventual Phase 6 (or v2-equivalent) demo assets.
