# Module: Database

Files: `docker-compose.yml`, `db/migrations/*.sql`, `db/SCHEMA.md`, `db/seed.py`

## What it does

Boots a local Postgres 16 instance, applies three migrations on first init, and seeds it with realistic, deliberately messy demo data for a fictional small SaaS company.

## Files and responsibilities

| File | Responsibility |
|---|---|
| `docker-compose.yml` | Single `db` service, Postgres 16, host port **5434** (not 5432 — a native Windows Postgres service already owns 5432 on the dev machine this was built on; see README note). Mounts `db/migrations/` into `/docker-entrypoint-initdb.d`. |
| `db/migrations/001_schema.sql` | Creates the 6 demo tables + indexes. |
| `db/migrations/002_readonly_role.sql` | Creates the `aac_readonly` role — guardrail layer 3. See `docs/modules/guardrails.md`. |
| `db/migrations/003_query_log.sql` | Creates `query_log`, the audit trail table. |
| `db/SCHEMA.md` | Human-readable ER description — table list, columns, FK diagram. |
| `db/seed.py` | Faker-based generator: customers, subscriptions, invoices, usage events, support tickets. |

## Important behavior: migrations only run on a FRESH volume

Postgres's `docker-entrypoint-initdb.d` mechanism only executes on first initialization of an empty data directory. **If you add a new migration file after the volume already exists, it will NOT run automatically.** You must either:

```bash
docker compose down -v   # -v removes the volume — fresh init next time
docker compose up -d
python db/seed.py
```

...or apply the new migration manually via `docker exec aac_postgres psql -U aac -d aac -f /path/to/new_migration.sql`. This has bitten this build multiple times during development — always assume a fresh volume is needed after adding a migration.

## The schema (6 tables, fixed for v1 — see REQUIREMENTS.md §2)

```
plans ──< customers ──< subscriptions >── plans
              │
              ├──< invoices
              ├──< usage_events
              └──< support_tickets
```

- `plans(id, name, monthly_price, tier)`
- `customers(id, name, company, signup_date, country, plan_id→plans.id, status)`
- `subscriptions(id, customer_id→customers.id, plan_id→plans.id, started_at, ended_at, status)`
- `invoices(id, customer_id→customers.id, amount, issued_at, paid_at, status)`
- `usage_events(id, customer_id→customers.id, event_type, occurred_at)`
- `support_tickets(id, customer_id→customers.id, opened_at, closed_at, priority, status)`

Full column-level detail is in `db/SCHEMA.md` — don't duplicate it here, it'll drift.

## Seeding logic (`db/seed.py`)

Generates 300-800 customers (default 400) over an ~18-month window, with:
- **Signup dates skewed toward recent months** (`random.triangular`) so growth-trend questions have a real trend to show.
- **Status distribution driven by customer age**: older customers more likely churned, very recent ones more likely trial.
- **Invoices**: monthly cadence from signup, ~85% paid / ~10% overdue / ~5% failed, cut short if the customer churned.
- **Usage events**: volume varies by status (trial customers get few, active customers get many).
- **Support tickets**: 0-3 per customer (weighted toward 0-1), ~75% closed.

Run with `python db/seed.py --customers 400` (or any count in the 300-800 target range). It `TRUNCATE ... RESTART IDENTITY CASCADE`s first, so it's safe to re-run.

**Verified result quality** (from an actual seeded run, 400 customers): ~11.75% churn rate, a real month-over-month MRR growth trend, ~11% overdue invoices — non-trivial numbers, not degenerate 0%/100% cases. This was an explicit acceptance criterion for Phase 0.

## Connection details

- Admin/superuser: `aac` / `aac_dev_password` — used for introspection, seeding, and audit logging.
- Restricted: `aac_readonly` / `aac_readonly_dev_password` — used only to execute LLM-generated queries. See `docs/modules/guardrails.md`.
- Default host/port in all backend code: `127.0.0.1:5434` (not `localhost` — Docker Desktop on this dev machine had an IPv6 loopback forwarding issue; `127.0.0.1` sidesteps it).

## Gotchas encountered during the build

- **Port 5432 conflict**: a native Windows Postgres 18 service was already listening on 5432, silently intercepting connections meant for the Docker container (auth failures that looked like wrong-password errors, not connection-refused). Resolved by remapping to 5434.
- **`localhost` vs `127.0.0.1`**: `localhost` resolves to `::1` first on this machine, and Docker Desktop's port forwarding didn't handle that IPv6 loopback path correctly (connections silently died). All defaults now use `127.0.0.1` explicitly.
