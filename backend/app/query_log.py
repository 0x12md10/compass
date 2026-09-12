"""Audit trail writer (REQUIREMENTS.md NFR-Observability). Always writes
via the admin connection — the aac_readonly role has no grants on
query_log, so a compromised/bypassed generation flow can't tamper with
its own audit trail.
"""


def log_attempt(
    admin_conn,
    question: str,
    generated_sql: str | None,
    outcome: str,
    reason: str | None,
    attempts: int,
) -> None:
    cur = admin_conn.cursor()
    cur.execute(
        """INSERT INTO query_log (question, generated_sql, outcome, reason, attempts)
           VALUES (%s, %s, %s, %s, %s)""",
        (question, generated_sql, outcome, reason, attempts),
    )
    admin_conn.commit()
    cur.close()
