"""Schema introspection: queries Postgres information_schema for tables,
columns, types, and foreign keys, then filters the result through the
whitelist config (backend/config/schema_whitelist.yaml).

This is what makes the engine schema-aware rather than a pile of
hardcoded query templates (see REQUIREMENTS.md FR1). Nothing here is a
static description of the schema — it's derived live from the database
on every call, so a migration or a whitelist edit is reflected with no
code changes.
"""

from dataclasses import dataclass, field

from app.whitelist import load_whitelist

_COLUMNS_SQL = """
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
"""

_FOREIGN_KEYS_SQL = """
    SELECT
        tc.table_name AS table_name,
        kcu.column_name AS column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name
"""


@dataclass
class Column:
    name: str
    data_type: str
    nullable: bool


@dataclass
class ForeignKey:
    column: str
    references_table: str
    references_column: str


@dataclass
class Table:
    name: str
    columns: list[Column] = field(default_factory=list)
    foreign_keys: list[ForeignKey] = field(default_factory=list)


def introspect_schema(conn, whitelist: dict[str, list[str]] | None = None) -> dict[str, Table]:
    """Returns {table_name: Table}, filtered to exactly the whitelisted
    tables/columns. Foreign keys are kept only when both the referencing
    and referenced columns are whitelisted.
    """
    whitelist = load_whitelist() if whitelist is None else whitelist

    cur = conn.cursor()

    cur.execute(_COLUMNS_SQL)
    tables: dict[str, Table] = {}
    for table_name, column_name, data_type, is_nullable in cur.fetchall():
        if table_name not in whitelist:
            continue
        if column_name not in whitelist[table_name]:
            continue
        tables.setdefault(table_name, Table(name=table_name)).columns.append(
            Column(name=column_name, data_type=data_type, nullable=(is_nullable == "YES"))
        )

    cur.execute(_FOREIGN_KEYS_SQL)
    for table_name, column_name, foreign_table, foreign_column in cur.fetchall():
        if table_name not in tables:
            continue
        if column_name not in whitelist[table_name]:
            continue
        if foreign_table not in whitelist or foreign_column not in whitelist[foreign_table]:
            continue
        tables[table_name].foreign_keys.append(
            ForeignKey(column=column_name, references_table=foreign_table, references_column=foreign_column)
        )

    cur.close()
    return tables


def fetch_sample_rows(conn, table: Table, limit: int = 3) -> list[tuple]:
    """Fetches sample rows using an explicit, whitelist-derived column
    list (never SELECT *) so the query itself can't leak a column that
    isn't whitelisted even if the table gains one later.
    """
    column_list = ", ".join(f'"{c.name}"' for c in table.columns)
    cur = conn.cursor()
    cur.execute(f'SELECT {column_list} FROM "{table.name}" LIMIT %s', (limit,))
    rows = cur.fetchall()
    cur.close()
    return rows
