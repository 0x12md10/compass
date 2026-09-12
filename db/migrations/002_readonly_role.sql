-- Dedicated read-only role for executing LLM-generated queries.
-- This is guardrail layer 3 (REQUIREMENTS.md NFR-Security / BUILD_PLAN Phase 3):
-- even if the sqlglot AST validation (layer 2) is somehow bypassed, this
-- role physically cannot mutate data or see non-whitelisted tables.
--
-- Must stay in sync with backend/config/schema_whitelist.yaml — if a table
-- is added to or removed from the whitelist, update the GRANT below to match.

CREATE ROLE aac_readonly WITH LOGIN PASSWORD 'aac_readonly_dev_password';

-- Deny everything by default, then grant back only what's needed.
REVOKE ALL ON SCHEMA public FROM aac_readonly;
GRANT USAGE ON SCHEMA public TO aac_readonly;

GRANT SELECT ON
    plans,
    customers,
    subscriptions,
    invoices,
    usage_events,
    support_tickets
TO aac_readonly;

-- No INSERT/UPDATE/DELETE/TRUNCATE/DDL grants of any kind, and no access
-- to query_log (that table is written only by the admin connection).

-- Defense-in-depth: cap statement duration at the role level too, not
-- just in application code.
ALTER ROLE aac_readonly SET statement_timeout = '5s';
