# db/SCHEMA.md — Demo Dataset Schema

Fixed for v1 (see `REQUIREMENTS.md` §2). Six tables modeling a small SaaS company's operational data.

## Tables

### `plans`
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text | e.g. Starter, Pro, Enterprise |
| monthly_price | numeric(10,2) | |
| tier | text | `starter` \| `pro` \| `enterprise` |

### `customers`
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text | |
| company | text | |
| signup_date | date | |
| country | text | |
| plan_id | int FK → plans.id | **current** plan — see `subscriptions` for history if the customer has changed plans |
| status | text | `active` \| `churned` \| `trial` |

### `subscriptions`
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| customer_id | int FK → customers.id | |
| plan_id | int FK → plans.id | |
| started_at | date | |
| ended_at | date, nullable | null while subscription is active |
| status | text | `active` \| `ended` |

**A customer can have more than one row** — an append-only history, not a 1:1 mirror of `customers`. Most customers have exactly one row; a subset (~10% in the seed data) have two, reflecting a plan upgrade/downgrade partway through their lifetime: the first row is `status='ended'` with `ended_at` set to the change date, and a second row starts on that same date with the new `plan_id`. `customers.plan_id` always reflects the *latest* row's plan. Invoice amounts (`invoices.amount`) track whichever plan was active at each invoice's `issued_at` date, so a plan change shows up as a real step change in billing history, not just in `subscriptions`.

### `invoices`
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| customer_id | int FK → customers.id | |
| amount | numeric(10,2) | |
| issued_at | date | |
| paid_at | date, nullable | null if unpaid |
| status | text | `paid` \| `overdue` \| `failed` |

### `usage_events`
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| customer_id | int FK → customers.id | |
| event_type | text | e.g. login, export, api_call |
| occurred_at | timestamp | |

### `support_tickets`
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| customer_id | int FK → customers.id | |
| opened_at | date | |
| closed_at | date, nullable | null while open |
| priority | text | `low` \| `medium` \| `high` |
| status | text | `open` \| `closed` |

## Foreign key relationships

```
plans ──< customers ──< subscriptions >── plans
                │
                ├──< invoices
                ├──< usage_events
                └──< support_tickets
```

- `customers.plan_id → plans.id`
- `subscriptions.customer_id → customers.id`
- `subscriptions.plan_id → plans.id`
- `invoices.customer_id → customers.id`
- `usage_events.customer_id → customers.id`
- `support_tickets.customer_id → customers.id`

## Seed volume target

**Updated for v2 (medium-business scale)**: 1,500–3,000 customers (default 2,000), proportionally scaled related rows, spread over ~3 years, skewed toward recent growth *and* a Q4 (Oct-Dec) seasonal signup bump layered on top. Includes realistic messiness: some churned customers, some overdue/failed invoices, some open tickets, some nulls (`ended_at`, `paid_at`, `closed_at`), and a subset of customers (~10%) with a plan upgrade/downgrade partway through their lifetime (see `subscriptions` above). See `db/seed.py`.

v1's original target (300-800 customers, ~18 months, no plan changes) is superseded by this — `db/seed.py` no longer produces the smaller v1-scale dataset; re-run with `--customers 500` etc. if a smaller set is ever needed again, though the 3-year window and seasonal/plan-change logic apply regardless of `--customers`.
