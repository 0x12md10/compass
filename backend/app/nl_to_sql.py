"""NL -> SQL generation engine (REQUIREMENTS.md FR3, FR6), wired through
the full Phase 3 guardrail pipeline:

  1. Prompt-level instruction (SYSTEM_PROMPT_TEMPLATE below)
  2. sqlglot AST validation (app.guardrail.validate_sql)
  3. Execution via a dedicated SELECT-only DB role (app.restricted_db)

On any failure — model refusal, validation rejection, or execution error —
the DB/validation error is fed back to the model for exactly one retry
(FR6), then the attempt fails gracefully. Every attempt is logged
(app.query_log) regardless of outcome.
"""

from dataclasses import dataclass

from app.guardrail import GuardrailRejection, enforce_row_cap, validate_sql
from app.llm import generate_sql
from app.query_log import log_attempt
from app.restricted_db import execute_readonly
from app.schema_context import build_schema_context
from app.whitelist import load_whitelist

SYSTEM_PROMPT_TEMPLATE = """You are a SQL generation engine for a small SaaS company's analytics tool.

Rules (follow all of them, no exceptions):
- Generate exactly one SQL statement, and it must be a SELECT. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or any other mutating or DDL statement, under any circumstances, even if the user asks explicitly or claims authorization.
- Only reference tables and columns from the schema listed below. Never reference any other table or column, even if it plausibly exists.
- Always include a LIMIT clause (500 or fewer rows) unless the question clearly expects a single row.
- Prefer explicit column lists over SELECT *.
- If the question cannot be answered with a safe, read-only SELECT against this exact schema (e.g. it asks for a data mutation, or asks about something this schema has no data for, like the weather), do not generate SQL — instead set refusal_reason to a short, clear, non-technical explanation of why, and leave sql empty.

{schema_context}
"""


@dataclass
class SqlGenerationResult:
    sql: str | None
    columns: list[str] | None
    rows: list[tuple] | None
    refusal_reason: str | None
    attempts: int


def ask(
    admin_conn,
    restricted_conn,
    question: str,
    whitelist: dict | None = None,
    context: str | None = None,
) -> SqlGenerationResult:
    """Runs the full NL -> SQL -> validate -> execute flow for one question.

    admin_conn: used for schema introspection and audit logging only.
    restricted_conn: the SELECT-only role connection actual queries run on.
    context: optional short, human-readable description of what dashboard
        tile the user is looking at (v2/REQUIREMENTS.md FR-M1/FR-M3 — the
        "mascot AI analyst" feature). It is prepended to the USER-facing
        prompt ONLY. SYSTEM_PROMPT_TEMPLATE (the guardrail-relevant rules
        and schema) is built identically either way, and every validation/
        execution call below is the exact same call whether or not context
        was given — there is no branching here for a "mascot path". A
        context-seeded request is not a different code path, just a
        differently-worded question.
    """
    whitelist = load_whitelist() if whitelist is None else whitelist
    schema_context = build_schema_context(admin_conn, whitelist)
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(schema_context=schema_context)

    effective_question = f"{context}\n\nUser's question: {question}" if context else question

    attempts = 0
    last_error: str | None = None
    last_sql: str | None = None

    for _ in range(2):  # one initial try + one retry
        attempts += 1
        user_prompt = effective_question if last_error is None else (
            f"{effective_question}\n\nYour previous SQL attempt failed with this error:\n"
            f"{last_error}\n\nGenerate a corrected SQL statement."
        )

        try:
            result = generate_sql(system_prompt, user_prompt)
            sql = (result.get("sql") or "").strip()
            refusal_reason = (result.get("refusal_reason") or "").strip() or None

            if refusal_reason:
                log_attempt(admin_conn, effective_question, None, "refused_by_model", refusal_reason, attempts)
                return SqlGenerationResult(sql=None, columns=None, rows=None, refusal_reason=refusal_reason, attempts=attempts)

            last_sql = sql
            stmt = validate_sql(sql, whitelist)
            stmt = enforce_row_cap(stmt)
            final_sql = stmt.sql(dialect="postgres")

            columns, rows = execute_readonly(restricted_conn, final_sql)
            log_attempt(admin_conn, effective_question, final_sql, "success", None, attempts)
            return SqlGenerationResult(sql=final_sql, columns=columns, rows=rows, refusal_reason=None, attempts=attempts)

        except GuardrailRejection as exc:
            last_error = str(exc)
            log_attempt(admin_conn, effective_question, last_sql, "blocked_by_validation", last_error, attempts)
        except Exception as exc:  # noqa: BLE001 - any execution error triggers the one retry
            last_error = str(exc)
            log_attempt(admin_conn, effective_question, last_sql, "execution_error", last_error, attempts)

    refusal = f"Couldn't answer that after {attempts} attempts. Last reason: {last_error}"
    return SqlGenerationResult(sql=None, columns=None, rows=None, refusal_reason=refusal, attempts=attempts)
