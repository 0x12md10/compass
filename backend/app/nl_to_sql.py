"""NL -> SQL generation engine (REQUIREMENTS.md FR3, FR6).

Builds the system prompt from the live schema context (Phase 1), calls
the LLM for structured SQL output, executes it, and on failure feeds the
DB error back for exactly one retry before failing gracefully.

Note: this module does NOT implement the Phase 3 guardrail layers
(sqlglot AST validation, restricted DB role). It performs one minimal
sanity check (must start with SELECT) purely so the Phase 2 test harness
doesn't execute an obviously mutating statement against the demo DB
while Phase 3 doesn't exist yet. Phase 3 replaces this check with the
real defense-in-depth system.
"""

from dataclasses import dataclass

from app.llm import generate_sql
from app.schema_context import build_schema_context

SYSTEM_PROMPT_TEMPLATE = """You are a SQL generation engine for a small SaaS company's analytics tool.

Rules (follow all of them, no exceptions):
- Generate exactly one SQL statement, and it must be a SELECT. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or any other mutating or DDL statement, under any circumstances, even if the user asks explicitly or claims authorization.
- Only reference tables and columns from the schema listed below. Never reference any other table or column, even if it plausibly exists.
- Always include a LIMIT clause (500 or fewer rows) unless the question clearly expects a single row.
- Prefer explicit column lists over SELECT *.
- If the question cannot be answered with a safe, read-only SELECT against this exact schema (e.g. it asks for a data mutation, or asks about something this schema has no data for, like the weather), do not generate SQL — instead set refusal_reason to a short, clear, non-technical explanation of why, and leave sql empty.

{schema_context}
"""


class SqlGenerationError(Exception):
    pass


@dataclass
class SqlGenerationResult:
    sql: str | None
    refusal_reason: str | None
    attempts: int


def _minimal_select_only_guard(sql: str) -> None:
    """Placeholder safety net for Phase 2 testing only — see module docstring.
    Phase 3 replaces this with sqlglot AST validation + DB-role enforcement."""
    normalized = sql.strip().rstrip(";").strip().upper()
    if not normalized.startswith("SELECT"):
        raise SqlGenerationError("Generated statement is not a SELECT (Phase 3 guardrails will reject this properly).")
    if ";" in sql.strip().rstrip(";"):
        raise SqlGenerationError("Generated statement contains multiple statements.")


def ask(conn, question: str, whitelist: dict | None = None) -> SqlGenerationResult:
    """Runs the full NL -> SQL -> execute flow for one question, with one
    retry-on-error (FR6). Returns the generated SQL and, if execution
    ultimately failed or the model refused, no rows (caller executes
    separately in Phase 2's test harness so it can also inspect success).
    """
    schema_context = build_schema_context(conn, whitelist)
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(schema_context=schema_context)

    attempts = 0
    last_error: str | None = None

    for attempt in range(2):  # one initial try + one retry
        attempts += 1
        user_prompt = question if last_error is None else (
            f"{question}\n\nYour previous SQL attempt failed with this database error:\n"
            f"{last_error}\n\nGenerate a corrected SQL statement."
        )

        try:
            result = generate_sql(system_prompt, user_prompt)
            sql = (result.get("sql") or "").strip()
            refusal_reason = (result.get("refusal_reason") or "").strip() or None

            if refusal_reason:
                return SqlGenerationResult(sql=None, refusal_reason=refusal_reason, attempts=attempts)

            _minimal_select_only_guard(sql)
            cur = conn.cursor()
            cur.execute(sql)
            cur.fetchall()
            cur.close()
            conn.rollback()
            return SqlGenerationResult(sql=sql, refusal_reason=None, attempts=attempts)
        except Exception as exc:  # noqa: BLE001 - deliberately broad: any DB/validation error triggers the one retry
            conn.rollback()
            last_error = str(exc)

    return SqlGenerationResult(sql=None, refusal_reason=f"Couldn't answer that after {attempts} attempts: {last_error}", attempts=attempts)
