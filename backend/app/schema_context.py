"""Formats introspected, whitelist-filtered schema info into a compact
text block suitable for an LLM prompt (table name, column names+types,
FK relationships, a few sample rows per table for grounding).

Kept deliberately terse — target is under ~2000 tokens for the full
6-table whitelisted schema (see REQUIREMENTS.md FR1 / BUILD_PLAN Phase 1).
"""

from app.introspection import Table, fetch_sample_rows, introspect_schema


def _format_table(conn, table: Table, sample_rows: int) -> str:
    lines = [f"Table: {table.name}"]

    columns = ", ".join(f"{c.name} {c.data_type}" for c in table.columns)
    lines.append(f"  Columns: {columns}")

    if table.foreign_keys:
        fks = ", ".join(
            f"{table.name}.{fk.column} -> {fk.references_table}.{fk.references_column}"
            for fk in table.foreign_keys
        )
        lines.append(f"  Foreign keys: {fks}")

    if sample_rows > 0:
        rows = fetch_sample_rows(conn, table, limit=sample_rows)
        if rows:
            col_names = [c.name for c in table.columns]
            lines.append(f"  Sample rows ({col_names}):")
            for row in rows:
                lines.append(f"    {list(row)}")

    return "\n".join(lines)


def build_schema_context(conn, whitelist: dict[str, list[str]] | None = None, sample_rows: int = 3) -> str:
    """Builds the full schema context text block for every whitelisted
    table, in whitelist declaration order.
    """
    tables = introspect_schema(conn, whitelist)

    header = (
        "The following is the exact set of tables and columns you are allowed to "
        "query. Do not reference any table or column not listed here."
    )
    blocks = [_format_table(conn, table, sample_rows) for table in tables.values()]

    return "\n\n".join([header, *blocks])
