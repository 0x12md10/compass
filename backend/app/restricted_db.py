"""Guardrail layer 3: execution via a dedicated, SELECT-only Postgres role
(REQUIREMENTS.md FR5 / NFR-Security). This connection is never the admin
connection used for introspection/logging — even a complete bypass of
layers 1 and 2 still can't mutate data or see non-whitelisted tables,
because the database itself will refuse it (see db/migrations/002_readonly_role.sql).
"""

import os

import psycopg2
from dotenv import load_dotenv

load_dotenv()

DEFAULT_RESTRICTED_DSN = "postgresql://aac_readonly:aac_readonly_dev_password@127.0.0.1:5434/aac"
STATEMENT_TIMEOUT_MS = 5000


def get_restricted_connection(dsn: str | None = None):
    conn = psycopg2.connect(dsn or os.environ.get("RESTRICTED_DATABASE_URL", DEFAULT_RESTRICTED_DSN))
    cur = conn.cursor()
    cur.execute(f"SET statement_timeout = {STATEMENT_TIMEOUT_MS}")
    cur.close()
    return conn


def execute_readonly(conn, sql: str) -> tuple[list[str], list[tuple]]:
    """Executes SQL on the restricted connection. Any error here (including
    'permission denied' if a mutating statement somehow reached this point)
    propagates to the caller as a normal exception.
    """
    cur = conn.cursor()
    try:
        cur.execute(sql)
        columns = [desc[0] for desc in cur.description] if cur.description else []
        rows = cur.fetchall() if cur.description else []
        return columns, rows
    finally:
        conn.rollback()
        cur.close()
