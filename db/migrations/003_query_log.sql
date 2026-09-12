-- Audit trail of every question and generated query (REQUIREMENTS.md
-- NFR-Observability). Written only via the admin connection — the
-- aac_readonly role has no grants on this table.

CREATE TABLE query_log (
    id                  SERIAL PRIMARY KEY,
    question            TEXT NOT NULL,
    generated_sql       TEXT,
    outcome             TEXT NOT NULL CHECK (outcome IN (
                            'success', 'refused_by_model',
                            'blocked_by_validation', 'execution_error'
                        )),
    reason              TEXT,
    attempts            INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
