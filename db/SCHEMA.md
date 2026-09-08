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
| plan_id | int FK → plans.id | |
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

300–800 customers, proportionally scaled related rows, spread over ~18 months, skewed toward growth over time. Includes realistic messiness: some churned customers, some overdue/failed invoices, some open tickets, some nulls (`ended_at`, `paid_at`, `closed_at`). See `db/seed.py`.
