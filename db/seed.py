"""Seed script for the AI Analytics Copilot demo database.

Populates plans, customers, subscriptions, invoices, usage_events, and
support_tickets with ~18 months of realistic, deliberately messy data
(churn, overdue invoices, open tickets, nulls) so aggregate questions
produce plausible, non-trivial answers. See db/SCHEMA.md and
REQUIREMENTS.md §2 for the schema this fills.

Usage:
    python db/seed.py [--customers N] [--dsn postgresql://...]
"""

import argparse
import random
from datetime import date, timedelta

import psycopg2
from faker import Faker

fake = Faker()

TODAY = date.today()
HISTORY_DAYS = 18 * 30  # ~18 months
START_DATE = TODAY - timedelta(days=HISTORY_DAYS)

PLANS = [
    ("Starter", 29.00, "starter"),
    ("Pro", 99.00, "pro"),
    ("Enterprise", 299.00, "enterprise"),
]

COUNTRIES = [
    "United States", "United Kingdom", "Canada", "Germany", "France",
    "Australia", "India", "Netherlands", "Sweden", "Brazil",
]

EVENT_TYPES = ["login", "api_call", "export", "dashboard_view", "invite_sent"]


def weighted_signup_date() -> date:
    """Skew signups toward more recent months so growth trends look real."""
    days_ago = int(random.triangular(0, HISTORY_DAYS, 0))
    return TODAY - timedelta(days=days_ago)


def build_customer(plan_ids: list[int]) -> dict:
    signup_date = weighted_signup_date()
    months_active = (TODAY - signup_date).days / 30
    # Older customers are more likely to have churned; recent ones more likely trial/active.
    if months_active > 3 and random.random() < 0.18:
        status = "churned"
    elif months_active < 1 and random.random() < 0.3:
        status = "trial"
    else:
        status = "active"
    return {
        "name": fake.name(),
        "company": fake.company(),
        "signup_date": signup_date,
        "country": random.choice(COUNTRIES),
        "plan_id": random.choice(plan_ids),
        "status": status,
    }


def build_subscription(customer_id: int, plan_id: int, signup_date: date, status: str) -> dict:
    started_at = signup_date
    ended_at = None
    sub_status = "active"
    if status == "churned":
        churn_days = random.randint(30, max(31, (TODAY - signup_date).days))
        ended_at = min(TODAY, signup_date + timedelta(days=churn_days))
        sub_status = "ended"
    return {
        "customer_id": customer_id,
        "plan_id": plan_id,
        "started_at": started_at,
        "ended_at": ended_at,
        "status": sub_status,
    }


def build_invoices(customer_id: int, amount: float, signup_date: date, status: str) -> list[dict]:
    invoices = []
    end = ended_boundary = TODAY
    cursor = signup_date + timedelta(days=random.randint(1, 5))
    while cursor <= end:
        issued_at = cursor
        roll = random.random()
        if roll < 0.85:
            inv_status = "paid"
            paid_at = issued_at + timedelta(days=random.randint(0, 10))
        elif roll < 0.95:
            inv_status = "overdue"
            paid_at = None
        else:
            inv_status = "failed"
            paid_at = None
        invoices.append({
            "customer_id": customer_id,
            "amount": amount,
            "issued_at": issued_at,
            "paid_at": paid_at,
            "status": inv_status,
        })
        cursor += timedelta(days=30)
        if status == "churned" and random.random() < 0.3:
            break
    return invoices


def build_usage_events(customer_id: int, signup_date: date, status: str) -> list[dict]:
    if status == "trial":
        n = random.randint(1, 10)
    elif status == "churned":
        n = random.randint(0, 20)
    else:
        n = random.randint(5, 120)
    events = []
    window_end = TODAY if status != "churned" else min(TODAY, signup_date + timedelta(days=random.randint(30, HISTORY_DAYS)))
    span_days = max(1, (window_end - signup_date).days)
    for _ in range(n):
        occurred_at = signup_date + timedelta(days=random.randint(0, span_days), hours=random.randint(0, 23))
        events.append({
            "customer_id": customer_id,
            "event_type": random.choice(EVENT_TYPES),
            "occurred_at": occurred_at,
        })
    return events


def build_support_tickets(customer_id: int, signup_date: date) -> list[dict]:
    n = random.choices([0, 1, 2, 3], weights=[0.5, 0.3, 0.15, 0.05])[0]
    tickets = []
    for _ in range(n):
        opened_at = signup_date + timedelta(days=random.randint(0, max(1, (TODAY - signup_date).days)))
        is_closed = random.random() < 0.75
        closed_at = None
        status = "open"
        if is_closed:
            closed_at = opened_at + timedelta(days=random.randint(0, 14))
            if closed_at > TODAY:
                closed_at = TODAY
            status = "closed"
        tickets.append({
            "customer_id": customer_id,
            "opened_at": opened_at,
            "closed_at": closed_at,
            "priority": random.choices(["low", "medium", "high"], weights=[0.5, 0.35, 0.15])[0],
            "status": status,
        })
    return tickets


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--customers", type=int, default=500)
    parser.add_argument(
        "--dsn",
        default="postgresql://aac:aac_dev_password@127.0.0.1:5434/aac",
    )
    args = parser.parse_args()

    conn = psycopg2.connect(args.dsn)
    cur = conn.cursor()

    cur.execute("TRUNCATE support_tickets, usage_events, invoices, subscriptions, customers, plans RESTART IDENTITY CASCADE")

    cur.executemany(
        "INSERT INTO plans (name, monthly_price, tier) VALUES (%s, %s, %s)",
        PLANS,
    )
    conn.commit()
    cur.execute("SELECT id FROM plans")
    plan_ids = [row[0] for row in cur.fetchall()]
    plan_price_by_id = dict(zip(plan_ids, [p[1] for p in PLANS]))

    for _ in range(args.customers):
        c = build_customer(plan_ids)
        cur.execute(
            """INSERT INTO customers (name, company, signup_date, country, plan_id, status)
               VALUES (%(name)s, %(company)s, %(signup_date)s, %(country)s, %(plan_id)s, %(status)s)
               RETURNING id""",
            c,
        )
        customer_id = cur.fetchone()[0]

        sub = build_subscription(customer_id, c["plan_id"], c["signup_date"], c["status"])
        cur.execute(
            """INSERT INTO subscriptions (customer_id, plan_id, started_at, ended_at, status)
               VALUES (%(customer_id)s, %(plan_id)s, %(started_at)s, %(ended_at)s, %(status)s)""",
            sub,
        )

        amount = plan_price_by_id[c["plan_id"]]
        for inv in build_invoices(customer_id, amount, c["signup_date"], c["status"]):
            cur.execute(
                """INSERT INTO invoices (customer_id, amount, issued_at, paid_at, status)
                   VALUES (%(customer_id)s, %(amount)s, %(issued_at)s, %(paid_at)s, %(status)s)""",
                inv,
            )

        for ev in build_usage_events(customer_id, c["signup_date"], c["status"]):
            cur.execute(
                """INSERT INTO usage_events (customer_id, event_type, occurred_at)
                   VALUES (%(customer_id)s, %(event_type)s, %(occurred_at)s)""",
                ev,
            )

        for t in build_support_tickets(customer_id, c["signup_date"]):
            cur.execute(
                """INSERT INTO support_tickets (customer_id, opened_at, closed_at, priority, status)
                   VALUES (%(customer_id)s, %(opened_at)s, %(closed_at)s, %(priority)s, %(status)s)""",
                t,
            )

    conn.commit()
    cur.close()
    conn.close()
    print(f"Seeded {args.customers} customers and related rows.")


if __name__ == "__main__":
    main()
