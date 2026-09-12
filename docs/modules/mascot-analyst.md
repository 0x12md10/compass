# Module: Mascot AI Analyst backend (v2, tickets D3 + D4)

Backend files: `context` parameter threaded through `backend/app/nl_to_sql.py`, `backend/app/answer.py`, `backend/app/main.py`
Frontend files (as of v2): `frontend/src/components/mascot/*` (`MascotContext`, `MascotPanel`, `MascotToggleButton`, `AskAiButton`), wired into the dashboard page and the `TileFrame`/`ChartTileCard`/`StatTileCard` dashboard components.

Part of the v2 initiative — see `v2/SCOPE.md`, `v2/REQUIREMENTS.md`, `v2/BUILD_PLAN.md`. D5 (formal adversarial re-verification through the mascot specifically) is done — see below.

> **v3 update:** the mascot was renamed **Compass** and gained an animated avatar, a full-page chat UI (`/compass`), and the app moved to a dashboard-as-home shell — none of which touched anything documented on this page (the backend `context`-seeding design below, and the file paths, are otherwise unchanged; only the dashboard page's own route moved from `/dashboard` to `/`). See `docs/modules/compass.md` for what changed and why it doesn't reopen anything below.

## What it does

Lets a question be anchored to a specific dashboard tile — "the user is looking at the Monthly Revenue Trend tile; they're asking: why did this spike?" — without adding any new backend surface. It's the exact same `/ask` → `answer_question()` → `nl_to_sql.ask()` pipeline as v1's bare ask bar, with one new optional parameter.

## The core design decision (FR-M3): context is a prompt detail, not a code path

`nl_to_sql.ask()` gained one new parameter: `context: str | None = None`. Its entire effect is one line:

```python
effective_question = f"{context}\n\nUser's question: {question}" if context else question
```

`effective_question` replaces `question` everywhere it's used to build the LLM prompt and the audit log entry. It does **not** touch `SYSTEM_PROMPT_TEMPLATE` (the guardrail-relevant rules + schema, built identically either way), and every call to `validate_sql()`, `enforce_row_cap()`, and `execute_readonly()` downstream is the exact same call whether `context` was `None` or a full sentence. This was confirmed by reading the function top to bottom, not just by design intent — there is no `if context:` anywhere near the guardrail calls.

This matters because the whole point of the mascot feature is that it must not become a second, weaker way to reach the database. A context-seeded request is not a different code path — it's a differently-worded question that happens to flow through the identical pipeline.

## The wire format (`main.py`)

`AskRequest` gained one optional field:

```python
class AskRequest(BaseModel):
    question: str
    context: str | None = None
```

Deliberately a plain string, not structured sub-fields (`{tile_name, tile_description, ...}`) — the backend never parses or branches on its contents, it only ever gets handed straight through to the LLM's user-facing prompt. Whatever composes a good context string is a frontend/D4 concern; the backend just needs *a* string.

## Live-tested against Groq (this was the first real live test since Groq was wired up)

Four spot-checks were run directly against `nl_to_sql.ask()`, not mocked:

1. **Bare, no context**: "Why did this spike?" → correctly refused ("the question is unclear") — there's no referent for "this" without a tile anchor. This is the baseline the feature is supposed to improve on.
2. **Context-seeded, revenue-trend tile**: same question, with context describing the Monthly Revenue Trend tile → produced a correct, relevant `SELECT ... FROM invoices ... GROUP BY month` query. Clear before/after contrast, which is exactly what FR-M1's acceptance criterion asks for.
3. **Context-seeded, churn-by-plan tile**: "Which one is the worst and by how much?" → the model referenced a non-existent table (`churn_per_plan`) and was correctly **blocked by guardrail layer 2** (`validate_sql`), on both the initial attempt and the one retry. This is a genuinely useful result even though it "failed": it's live proof that the guardrail applies to context-seeded requests exactly as it does to bare ones — a legitimate question with a model hallucination still gets caught, not silently let through because it came from the mascot's entry point. It's also an honest data point that `gpt-oss-120b` (Groq's free tier) is less reliable at complex multi-table SQL than Gemini was in earlier testing — consistent with the tradeoff flagged when Groq was first chosen.
4. **Context-seeded, signups-by-country tile**: "Which country grew the fastest?" → correctly refused for lacking a concrete date range. This surfaced a real design point for D4, not a bug: the context string needs to include the *actual selected* range (e.g. "within the last 90 days," using the dashboard's real `days` state), not just a generic per-tile description. Logged as a task under D4 in `v2/BUILD_PLAN.md`.

## A model-catalog gotcha this session also uncovered

Groq's available models had changed completely since `llm.py` was first written — see `docs/modules/nl-to-sql.md`'s note on the `openai/gpt-oss-120b` switch and the `reasoning_effort="low"` fix required to get non-empty responses out of it. Not specific to the mascot feature, but this was the first time any live Groq call actually ran, so it's where it was caught.

## Frontend (D4)

**`MascotContext.tsx`** — a small React context holding `{isOpen, context, tileName}` plus `openMascot(tileName, context)` / `openMascotBare()` / `closeMascot()`. This is what lets any tile trigger the same single panel instance without prop-drilling through the whole page tree.

**`AskAiButton.tsx`** — the literal "Ask AI about this" link (FR-M1's entry point). Each tile passes its own `title` and a pre-built `context` string; clicking calls `openMascot`.

**`MascotPanel.tsx`** — the actual chat-like UI: a small fixed-position card (bottom-right), showing "Looking at: {tileName}" when tile-anchored or a generic "Your business analyst" tagline otherwise, one input + submit, and a result area that **reuses `ChartRenderer` and the same explanation/SQL-toggle layout as v1's ask bar** — no new result-rendering code. Submitting a new question replaces the previous result rather than appending to a running history (FR-M2 — this is a deliberately different interaction model from v1's ask bar, which keeps a list; the mascot is a bounded, single-turn analyst, not a chat log).

**`MascotToggleButton.tsx`** — a persistent floating avatar, always visible, so the mascot is reachable even with no tile anchor (`openMascotBare()` — context and tileName both `null`).

**Context strings are built in `dashboard/page.tsx`**, one per tile, and — per D3's finding #4 — each one bakes in the *actual currently-selected* `days` value for range-filterable tiles (e.g. "...over the last 90 days", using the real state, not a placeholder). Point-in-time tiles (MRR, overdue rate, customer status) get context explicitly noting they're snapshots unaffected by the range filter.

## Live-verified end-to-end (D4) — a real Playwright + Groq pass, not a build-only check

Four things were actually driven in a real browser against a live backend, not assumed from the code:

1. **Tile-anchored question → correct answer.** Clicked "Ask AI about this" on the Monthly Revenue Trend tile, typed "What was the highest month and how much revenue?" — got back correct SQL (`SELECT DATE_TRUNC('MONTH', issued_at) ... WHERE issued_at >= CURRENT_DATE - INTERVAL '365 DAYS' ... ORDER BY total_revenue DESC LIMIT 1`, correctly using the "last 365 days" baked into the context), a grounded correct explanation ("The highest month was August 2026, and it generated $210,450.00 in revenue."), a rendered chart, and a working SQL toggle.
2. **Bare/standalone entry point.** Clicking the floating avatar directly (no tile) opens the panel with the generic "Your business analyst" tagline and no tile anchor — confirmed via DOM text checks, not just visual inspection.
3. **Refusal path (a preview of D5).** Asked "Delete all the churned customers from this plan" through the Churn by Plan tile's mascot entry — got a clean refusal ("I cannot perform data deletions; only read-only SELECT queries are allowed"), rendered in the same amber-box style as v1's ask bar. This is encouraging but is explicitly **not** a substitute for D5's dedicated, complete adversarial/injection/out-of-scope pass.
4. Zero console errors across all of the above.

### Two real bugs found and fixed during this testing pass

- **A bug in the test script, not the app**: `page.click('button:has-text("Ask")')` is a *substring* match, so it also matched every tile's "Ask AI about this" button and clicked the wrong one (whichever tile came first in the DOM). This made it briefly look like tile-anchoring was broken (the panel showed "Looking at: Current MRR" after asking a question anchored to a different tile). Confirmed it was the test, not the app, by adding a `data-tile-title` attribute to `TileFrame` for precise targeting and re-running — the app was correct all along. Fixed the test with `page.getByRole('button', { name: 'Ask', exact: true })`.
- **A genuine infra bug**: the backend process actually serving HTTP requests during testing was stale — started *before* D3's model/env fixes were saved — because the "kill the old backend" step used `pgrep`, which doesn't exist in this project's bash and fails silently (no error, just does nothing). This produced a real, confusing symptom: a `model_not_found` error for a model name that had already been fixed in the source files. Root-caused by comparing the running process's actual start time against the files' last-write time. Fixed by killing the exact PID (found via `Get-NetTCPConnection`) instead of relying on `pgrep`. Saved as a standing memory so this isn't rediscovered next session.

## D5 — formal guardrail re-verification, done

`backend/app/test_d5_mascot_guardrails.py` (`python -m app.test_d5_mascot_guardrails`) runs the three required categories — an adversarial update attempt, an out-of-scope question, and a prompt-injection-style question — **both bare and context-seeded, back-to-back**, so the comparison is apples-to-apples rather than against older differently-worded baselines. All 6 runs were blocked (`refused_by_model`), with no difference in outcome between the bare and mascot-anchored version of any of the three questions. Cross-checked against `query_log`: the context-seeded entries are recorded with the full effective (context + question) text, confirming the audit trail captures what was actually sent, not just the bare question.

This satisfies REQUIREMENTS.md §6's explicit acceptance bar — the mascot's context-seeding path is not a weaker route to the database than the plain ask bar, proven rather than assumed.

## If you need to change something here

- **Change how context is worded**: edit the per-tile strings in `dashboard/page.tsx` — the backend doesn't template it beyond the one f-string in `nl_to_sql.ask()`.
- **Add a new context-consuming feature**: reuse the same `context: str | None` parameter shape rather than inventing a second convention — `answer_question()` already threads it through.
- **Change the mascot's persona/name**: `MASCOT_NAME` in `MascotPanel.tsx`.
- **Add a new tile's "Ask AI about this"**: pass `askAiContext` to `ChartTileCard`/`StatTileCard` — omit it to leave a tile without the mascot entry point.
