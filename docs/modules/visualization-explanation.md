# Module: Visualization & Explanation (Phase 4)

Files: `backend/app/chart_selector.py`, `backend/app/explain.py`, `backend/app/answer.py`

## What it does

Takes a validated, executed query result (columns + rows from Phase 2/3) and produces two things: a chart-type recommendation (deterministic heuristic) and a short plain-English explanation (grounded LLM call).

## `chart_selector.py`

`select_chart(columns, rows) -> ChartSpec` — pure function, no LLM call, no side effects. `ChartSpec` is `{chart_type: "stat"|"bar"|"line"|"table", x_key, y_key}`.

Heuristic (REQUIREMENTS.md FR7):
- Empty result or no columns → `table`
- Exactly 1 column, exactly 1 row → `stat` (a scalar answer, e.g. "current MRR")
- Exactly 2 columns, 2nd column numeric, 1st column date-like → `line`
- Exactly 2 columns, 2nd column numeric, 1st column NOT date-like → `bar`
- Anything else → `table` fallback

`_is_numeric` explicitly excludes `bool` (Python `bool` is a subclass of `int`, which would otherwise misclassify a boolean column as a numeric metric).

**Known limitation, accepted as-is**: a 3-column result like "which 5 customers paid the most" (`id, name, total_paid`) falls back to `table` rather than becoming a bar chart, because the heuristic is strictly 2-column. This matches the literal spec in `BUILD_PLAN.md` ("simple heuristic... doesn't need to be its own LLM call") — a table is still an entirely legitimate, informative fallback here, not a broken result.

## `explain.py`

`generate_explanation(question, columns, rows) -> str` (REQUIREMENTS.md FR8).

The critical design point: **the prompt receives the actual result rows, not just the question or the SQL**. This is what prevents hallucination — the model literally cannot state a number that isn't in front of it, because it has no other source of numbers to draw from.

- `MAX_ROWS_IN_PROMPT = 20` — large result sets are truncated in the prompt (with an explicit "...and N more rows not shown" note) to keep the prompt small. This was verified directly: a synthetic 600-row input correctly caps at 20 rows embedded plus a truncation notice.
- System prompt (`EXPLAIN_SYSTEM_PROMPT`) enforces: 2-3 sentences, no jargon/SQL, never invent a number not in the data, and explicitly handle an empty result by saying so plainly rather than fabricating an answer.
- Delegates the actual API call to `llm.generate_text()` (plain-text mode, `temperature=0.3` — a little more natural-language variance is acceptable here, unlike SQL generation which wants `temperature=0`).

## `answer.py` — the top-level orchestrator

`answer_question(admin_conn, restricted_conn, question) -> Answer` is what Phase 5's `/ask` endpoint actually calls. It:

1. Calls `nl_to_sql.ask()` (Phases 2/3).
2. If that returned no SQL (refused/failed), returns an `Answer` with everything else `None` and `refusal_reason` set.
3. Otherwise calls `select_chart()` and `generate_explanation()` and returns a fully-populated `Answer`.

This is the natural single entry point for the whole pipeline — if you're adding a new post-processing step (e.g. a follow-up suggestion, per the S1 stretch goal), it goes here, after the SQL result is available and before returning.

## Verified vs. not (as of last check — see `BUILD_PLAN.md` for current status)

- ✅ `select_chart()` verified against 5 realistic result shapes (scalar, date+metric, category+metric, multi-column, empty) — all correct.
- ✅ Row-capping/truncation-notice logic in `explain.py` verified directly (600-row synthetic input).
- ❌ **The actual `generate_explanation()` API call has never been observed live** — every attempt has hit Gemini's daily quota before reaching this code path. The prompt construction is verified; the actual model output quality and hallucination-resistance (the Phase 4 acceptance criteria's explicit "spot-check for hallucinated numbers") is not.

## If you need to change something here

- **Add a new chart type** (e.g. pie chart for a 2-column categorical-only result): extend `select_chart()`'s heuristic, then add a matching frontend component + wire it into `ChartRenderer.tsx` (see `docs/modules/frontend.md`).
- **Change the explanation tone/length**: edit `EXPLAIN_SYSTEM_PROMPT` in `explain.py`.
- **Change how many rows are sent to the explanation prompt**: `MAX_ROWS_IN_PROMPT`.
