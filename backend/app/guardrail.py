"""Guardrail layer 2: sqlglot AST validation (REQUIREMENTS.md FR4 / NFR-Security).

Parses the LLM's SQL output and rejects anything that isn't a single,
whitelist-scoped SELECT. This is independent of and does not trust the
prompt-level instruction (layer 1, in nl_to_sql.py) — a validation bypass
at the prompt level must still be caught here, and a bypass here must
still be caught by the DB-role permission layer (layer 3, restricted_db.py).
"""

import sqlglot
from sqlglot import exp

DEFAULT_ROW_CAP = 500

# Any of these appearing anywhere in the parsed tree (including inside a
# data-modifying CTE like `WITH x AS (DELETE FROM ... RETURNING *) ...`)
# is an automatic rejection.
_MUTATING_NODE_TYPES = (
    exp.Insert,
    exp.Update,
    exp.Delete,
    exp.Drop,
    exp.Alter,
    exp.Create,
    exp.TruncateTable,
    exp.Command,
    exp.Merge,
)


class GuardrailRejection(Exception):
    """Raised when generated SQL fails validation. Never reaches the database."""


def validate_sql(sql: str, whitelist: dict[str, list[str]]) -> exp.Select:
    """Returns the parsed, validated SELECT AST, or raises GuardrailRejection
    with a clear, specific reason.
    """
    try:
        statements = [s for s in sqlglot.parse(sql, dialect="postgres") if s is not None]
    except Exception as exc:  # noqa: BLE001 - any parse failure is a rejection, not a crash
        raise GuardrailRejection(f"Could not parse the generated SQL: {exc}") from exc

    if len(statements) != 1:
        raise GuardrailRejection(
            f"Expected exactly one SQL statement, found {len(statements)} "
            "(possible statement-stacking attempt)."
        )

    stmt = statements[0]

    if not isinstance(stmt, exp.Select):
        raise GuardrailRejection("Only SELECT statements are allowed.")

    if list(stmt.find_all(*_MUTATING_NODE_TYPES)):
        raise GuardrailRejection(
            "Generated SQL contains a mutating or DDL operation (possibly inside a "
            "CTE), which is never allowed."
        )

    if stmt.args.get("locks"):
        raise GuardrailRejection(
            "Row-locking clauses (e.g. FOR UPDATE) are not allowed on a read-only endpoint."
        )

    for projection in stmt.expressions:
        if isinstance(projection, exp.Star):
            raise GuardrailRejection("SELECT * is not allowed; use an explicit column list.")

    tables = {t.name for t in stmt.find_all(exp.Table)}
    for table in tables:
        if table not in whitelist:
            raise GuardrailRejection(f"Table '{table}' is not part of the allowed schema.")

    allowed_columns: set[str] = set()
    for table in tables:
        allowed_columns.update(whitelist.get(table, []))

    # Aliases (SELECT-list aliases, subquery aliases) are legitimate
    # references to already-validated expressions, not new column access —
    # exclude them so e.g. `ORDER BY churn_rate` (an alias) isn't flagged.
    known_aliases = {a.alias for a in stmt.find_all(exp.Alias) if a.alias}

    for col in stmt.find_all(exp.Column):
        name = col.name
        if not name or name in known_aliases:
            continue
        if name not in allowed_columns:
            raise GuardrailRejection(
                f"Column '{name}' is not part of the allowed schema for the referenced tables."
            )

    return stmt


def enforce_row_cap(stmt: exp.Select, cap: int = DEFAULT_ROW_CAP) -> exp.Select:
    """Auto-injects a LIMIT if missing, or clamps it down if it exceeds the cap."""
    existing = stmt.args.get("limit")
    current: int | None = None
    if existing is not None:
        try:
            current = int(existing.expression.this)
        except (AttributeError, TypeError, ValueError):
            current = None

    if existing is None or current is None or current > cap:
        stmt.set("limit", exp.Limit(expression=exp.Literal.number(cap)))

    return stmt
