# Module: NL → SQL Engine (Phase 2)

Files: `backend/app/llm.py`, `backend/app/nl_to_sql.py`, `backend/app/test_questions.py`, `backend/app/run_test_questions.py`

## What it does

Takes a plain-English question, calls Gemini with the live schema context (Phase 1) and a structured-output schema, and returns exactly one validated, executed SQL result — or a clear refusal. Retries exactly once on any failure, never loops.

## `llm.py` — the only module that knows about the LLM provider

This isolation is deliberate (see `REQUIREMENTS.md` §1 note on the Anthropic→Gemini switch) — swapping or adding a provider means changing only this file.

**Provider selection**: `LLM_PROVIDER` env var, `"groq"` (default) or `"gemini"`. Switched the default to Groq on 2026-09-12 — Gemini's 20/day free-tier cap had repeatedly blocked live verification across Phases 3-5; Groq's free tier is far more generous. Gemini is kept as a working alternate provider, not removed — set `LLM_PROVIDER=gemini` to fall back to it.

Public interface (what the rest of the codebase calls — provider-agnostic):
- `generate_sql(system_instruction, user_prompt) -> dict` — returns `{"sql": str, "refusal_reason": str}` via structured/tool-call output (never free text to regex-parse). `temperature=0` for determinism.
- `generate_text(system_instruction, user_prompt, max_output_tokens=300) -> str` — plain-text call, used by `explain.py` (Phase 4). `temperature=0.3`.

**Groq implementation** (`_groq_*`): uses the `groq` SDK's OpenAI-compatible chat completions. Structured SQL output uses **forced tool calling** (`tool_choice` pinned to a single `generate_sql` function with a JSON-schema `parameters` block) rather than a generic "JSON mode," since Groq's JSON mode doesn't enforce a specific schema the way Gemini's `response_schema` does — forcing the tool call is the closer equivalent. If the model somehow doesn't return a tool call, `_groq_generate_sql` treats that as a refusal rather than crashing (`response.choices[0].message.tool_calls` empty check). Default model: `openai/gpt-oss-120b` (env-overridable via `GROQ_MODEL`).

**Gotcha hit on first live use (v2/D3, 2026-09-12)**: Groq's model catalog had changed entirely since this module was first wired up — every Llama model (including the original default, `llama-3.3-70b-versatile`) was gone, replaced by `openai/gpt-oss-*` and Qwen3 variants. Worth re-checking `client.models.list()` if you see a `model_not_found` 404. Separately, `gpt-oss-120b` is a **reasoning model** — it spends tokens on internal reasoning before producing `content`, which silently produced empty responses (`finish_reason='length'`) until `reasoning_effort="low"` was added to both Groq call sites (requires `groq` SDK ≥ some version with this param — bumped from 0.13.1 to 1.7.0 in `requirements.txt` to get it). If explanations or SQL ever come back empty again with Groq, check this first before assuming a prompt problem.

**Gemini implementation** (`_gemini_*`): calls with `response_mime_type: application/json` and an explicit `response_schema`. Default model: `gemini-3.6-flash` (env-overridable via `GEMINI_MODEL`) — the original default, `gemini-2.0-flash`, was retired by Google mid-build; if you see a `404 model no longer available` error, check Google's current model list.

Both provider implementations share the same `_SQL_TOOL_PARAMETERS` schema dict, so the `{sql, refusal_reason}` contract stays identical regardless of which provider is active — nothing downstream of `llm.py` needs to know or care which one is in use.

## `nl_to_sql.py` — the orchestrator

`SYSTEM_PROMPT_TEMPLATE` — the prompt-level guardrail (layer 1). Hard rules: single SELECT only, only whitelisted tables/columns, always LIMIT ≤500, prefer explicit column lists, refuse via `refusal_reason` rather than attempting anything unsafe. The schema context (Phase 1) is interpolated in at the end.

`ask(admin_conn, restricted_conn, question, whitelist=None) -> SqlGenerationResult`:

```python
for _ in range(2):                          # one try + one retry, hardcoded — never a loop
    call Gemini (generate_sql)
    if model set refusal_reason: log + return immediately
    try:
        stmt = validate_sql(sql, whitelist)   # guardrail layer 2 (guardrail.py)
        stmt = enforce_row_cap(stmt)
        final_sql = stmt.sql(dialect="postgres")
        columns, rows = execute_readonly(restricted_conn, final_sql)  # guardrail layer 3
        log "success"; return
    except GuardrailRejection as exc:
        log "blocked_by_validation"; feed exc back to model on next loop iteration
    except Exception as exc:
        log "execution_error"; feed exc back to model on next loop iteration
# both attempts exhausted:
return refusal with the last error message
```

Two connections are threaded through explicitly: `admin_conn` (schema introspection + audit logging only) and `restricted_conn` (the `aac_readonly` role — actual query execution). This split is what makes guardrail layer 3 real; see `docs/modules/guardrails.md`.

Every branch calls `log_attempt(...)` (see `docs/modules/guardrails.md` for the audit table) — success, model refusal, validation rejection, and execution error are all logged, including on the retry.

## The retry-on-error design (FR6)

One retry, period — not "retry until success" and not "retry per layer." A single `range(2)` loop covers a model refusal being fed back (doesn't happen — refusals return immediately), a validation rejection being fed back, or an execution error being fed back. This is a deliberate structural guarantee against runaway loops (REQUIREMENTS.md NFR-Cost), not just a soft convention.

Feeding a validation rejection back to the model is safe even for an adversarial prompt: the retry still goes through the exact same validate_sql + execute_readonly gate, so allowing one more attempt doesn't weaken the guardrails — it just gives a legitimate typo'd query one more chance to self-correct.

## `test_questions.py` — the fixed test set

Written once (per `REQUIREMENTS.md` §6 / `BUILD_PLAN.md` Phase 2), reused by every later phase's test harness:
- `QUESTIONS` — 14 legitimate questions spanning simple aggregation, time-series, comparison, and join-heavy queries.
- `ADVERSARIAL_QUESTIONS` — 2 (delete request, update request).
- `OUT_OF_SCOPE_QUESTIONS` — 1 (weather — tests graceful "I can only answer questions about this database").

Don't add new questions here casually — this list is the acceptance test across Phases 2, 3, and 4. If you widen it, update the copy in `BUILD_PLAN.md` too so they don't drift.

## `run_test_questions.py` — the harness

`python -m app.run_test_questions` — opens both DB connections, runs every question in all three groups through `ask()`, prints the resulting SQL/row-count or the block/refusal reason for each.

## Verified results (as of last full run)

14/14 (100%) legitimate questions produced syntactically valid, semantically correct SQL on manual review — comfortably above both the ≥90% syntax and ≥80% semantic acceptance floors. Adversarial question 15 ("delete...") was refused at the **prompt layer alone**, before validation/execution were even reached — useful evidence for the defense-in-depth story.

## Gotchas encountered during the build

- **Truncated JSON responses**: `max_output_tokens=1024` was too low for some longer generated queries, causing `json.decoder.JSONDecodeError: Unterminated string`. Fixed by raising to 4096.
- **That truncation exception wasn't being retried**: the original code called `generate_sql()` *outside* the `try/except` that handled retry-on-error, so a JSON parse failure crashed the whole harness instead of triggering the retry path. Fixed by moving the `generate_sql()` call inside the try block.
- **Gemini free-tier quota (20 requests/day)** is the single biggest recurring blocker for live testing this module — see `docs/ARCHITECTURE.md` §6 and `BUILD_PLAN.md`'s "Flagged for Abishek" section for current status.
