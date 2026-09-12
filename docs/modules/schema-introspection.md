# Module: Schema Introspection & Context Builder (Phase 1)

Files: `backend/app/whitelist.py`, `backend/app/introspection.py`, `backend/app/schema_context.py`, `backend/config/schema_whitelist.yaml`, `backend/app/print_schema_context.py`

## What it does

Turns the live Postgres schema into a compact, LLM-ready text block — without hardcoding any table/column description in a prompt string. This is what makes the engine "schema-aware" rather than a pile of query templates, and it's the piece to point at if a client asks "how does it actually know the schema."

## Why it exists (design intent)

Two independent things read the same whitelist file (`schema_whitelist.yaml`):
1. **Introspection** (this module) — controls what the LLM is *told about*.
2. **Validation** (`guardrail.py`, Phase 3) — controls what generated SQL is *allowed to touch*.

Editing the whitelist changes both, with zero code changes elsewhere. This was explicitly verified during Phase 1: removing `usage_events` from the YAML and re-running immediately excluded it from the generated schema context.

## Files

### `whitelist.py`
Loads `backend/config/schema_whitelist.yaml` into `{table_name: [column_name, ...]}`. Single function, `load_whitelist()`. No caching — re-reads the file every call, which is fine at this traffic level and means a whitelist edit takes effect on the very next request with no restart.

### `introspection.py`
Two raw SQL queries against `information_schema`:
- Columns: `information_schema.columns` filtered to `table_schema = 'public'`.
- Foreign keys: a 3-way join across `table_constraints` / `key_column_usage` / `constraint_column_usage`.

`introspect_schema(conn, whitelist)` runs both, filters every row through the whitelist (table AND column must both be listed), and returns `{table_name: Table}` dataclasses (`Table` has `columns: list[Column]` and `foreign_keys: list[ForeignKey]`).

A foreign key is only kept if **both ends** are whitelisted — a FK pointing at a non-whitelisted table/column is silently dropped rather than exposed partially.

`fetch_sample_rows(conn, table, limit=3)` — deliberately builds an **explicit column list** (`SELECT "id", "name", ... FROM "table" LIMIT 3`), never `SELECT *`. This means even if a table gains a new column later, sample-row fetching can't leak it before the whitelist is updated — the column list is derived from the already-filtered `Table.columns`, not the raw table.

### `schema_context.py`
`build_schema_context(conn, whitelist, sample_rows=3)` formats the introspection result into plain text:

```
Table: customers
  Columns: id integer, name text, company text, ...
  Foreign keys: customers.plan_id -> plans.id
  Sample rows (['id', 'name', ...]):
    [1, 'Daniel Wilkinson', ...]
    ...
```

Kept deliberately terse — no markdown tables, no verbose prose — to stay well under the ~2000 token budget. **Verified actual size**: the full 6-table whitelisted schema renders to ~741 tokens.

### `print_schema_context.py`
CLI harness: `python -m app.print_schema_context` — prints the exact text the LLM will see, plus a char/token-estimate footer. Use this any time you touch the whitelist or the formatter, to eyeball the result before it reaches a prompt.

## The whitelist file itself

`backend/config/schema_whitelist.yaml`:

```yaml
tables:
  plans:
    columns: [id, name, monthly_price, tier]
  customers:
    columns: [id, name, company, signup_date, country, plan_id, status]
  subscriptions:
    columns: [id, customer_id, plan_id, started_at, ended_at, status]
  invoices:
    columns: [id, customer_id, amount, issued_at, paid_at, status]
  usage_events:
    columns: [id, customer_id, event_type, occurred_at]
  support_tickets:
    columns: [id, customer_id, opened_at, closed_at, priority, status]
```

Currently whitelists every column of every table (matches REQUIREMENTS.md's fixed 6-table schema exactly). To narrow exposure later (e.g. hide a sensitive column), remove it from the relevant table's `columns` list — both introspection AND validation (Phase 3) respect this immediately.

## Verified behavior (Phase 1 acceptance criteria)

- Full whitelisted schema → correct 6-table context, ~741 tokens.
- Removing `usage_events` from the YAML → immediately excluded from `print_schema_context` output, no code changes needed.

## If you need to change something here

- **Add a table to the demo schema**: add the migration, add it to the whitelist YAML, done — introspection picks it up automatically.
- **Hide a column from the LLM without dropping it from the DB**: remove it from the whitelist YAML column list only.
- **Change how many sample rows are shown**: `build_schema_context(..., sample_rows=N)`.
- **Change the prompt framing/header text**: edit the `header` string in `build_schema_context`.
