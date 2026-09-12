"""Seed script for the AI Analytics Copilot demo database.

Populates plans, customers, subscriptions, invoices, usage_events, and
support_tickets with ~3 years of realistic, deliberately messy data
(churn, plan upgrades/downgrades, overdue invoices, open tickets, nulls,
a Q4 seasonal signup bump) so aggregate questions produce plausible,
non-trivial answers at a medium-business scale. See db/SCHEMA.md and
REQUIREMENTS.md §2 for the fixed schema this fills — v2/SCOPE.md §5 for
why the data got bigger without a schema change.

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
HISTORY_DAYS = 36 * 30  # ~3 years
START_DATE = TODAY - timedelta(days=HISTORY_DAYS)

PLANS = [
    ("Starter", 29.00, "starter"),
    ("Pro", 99.00, "pro"),
    ("Enterprise", 299.00, "enterprise"),
]

COUNTRIES = [
    "United States", "United Kingdom", "Canada", "Germany", "France",
    "Australia", "India", "Netherlands", "Sweden", "Brazil",
    "Japan", "Singapore", "Ireland", "Spain", "Mexico",
    "South Africa", "New Zealand", "Poland", "Italy", "South Korea",
]

EVENT_TYPES = [
    "login", "api_call", "export", "dashboard_view", "invite_sent",
    "report_generated", "integration_connected", "billing_page_view",
    "settings_changed", "search_performed",
]

# Q4 (Oct-Dec) signup bump — layered on top of the existing recency skew via
# rejection sampling: Q4 candidate dates are always accepted, non-Q4 dates
# are accepted 70% of the time (else redraw). Produces a visible, verifiable
# seasonal pattern rather than a purely random walk.
SEASONAL_BOOST_MONTHS = {10, 11, 12}

# Fraction of non-trial customers with a plan upgrade/downgrade partway
# through their lifetime (v2/SCOPE.md §5) — needs no schema change, just a
# second subscriptions row.
PLAN_CHANGE_RATE = 0.15


def weighted_signup_date() -> date:
    """Skew signups toward more recent months (growth trend) AND toward Q4
    (seasonal bump), so both trend and seasonality questions have something
    real to show.
    """
    while True:
        days_ago = int(random.triangular(0, HISTORY_DAYS, 0))
        candidate = TODAY - timedelta(days=days_ago)
        if candidate.month in SEASONAL_BOOST_MONTHS or random.random() < 0.7:
            return candidate


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


def build_subscriptions(
    customer_id: int, initial_plan_id: int, plan_ids: list[int], signup_date: date, status: str
) -> tuple[list[dict], int]:
    """Returns (subscription rows in chronological order, the customer's
    final/current plan_id). Occasionally inserts a plan upgrade/downgrade
    as a second row rather than mutating the first — subscriptions is an
    append-only history, matching how a real billing system would model it.
    """
    rows: list[dict] = []
    current_plan = initial_plan_id
    current_start = signup_date
    tenure_days = (TODAY - signup_date).days

    has_plan_change = status != "trial" and tenure_days > 180 and random.random() < PLAN_CHANGE_RATE
    if has_plan_change:
        change_offset = random.randint(90, max(91, tenure_days - 30))
        change_date = min(TODAY, signup_date + timedelta(days=change_offset))
        new_plan_id = random.choice([p for p in plan_ids if p != current_plan])
        rows.append({
            "customer_id": customer_id,
            "plan_id": current_plan,
            "started_at": current_start,
            "ended_at": change_date,
            "status": "ended",
        })
        current_plan = new_plan_id
        current_start = change_date

    ended_at = None
    sub_status = "active"
    if status == "churned":
        churn_days = random.randint(30, max(31, (TODAY - current_start).days))
        ended_at = min(TODAY, current_start + timedelta(days=churn_days))
        sub_status = "ended"

    rows.append({
        "customer_id": customer_id,
        "plan_id": current_plan,
        "started_at": current_start,
        "ended_at": ended_at,
        "status": sub_status,
    })

    return rows, current_plan


def _price_at(cursor_date: date, subscription_rows: list[dict], plan_price_by_id: dict[int, float]) -> float:
    for row in subscription_rows:
        if row["started_at"] <= cursor_date and (row["ended_at"] is None or cursor_date < row["ended_at"]):
            return plan_price_by_id[row["plan_id"]]
    return plan_price_by_id[subscription_rows[-1]["plan_id"]]


def build_invoices(
    customer_id: int, subscription_rows: list[dict], plan_price_by_id: dict[int, float], signup_date: date, status: str
) -> list[dict]:
    """Invoice amount tracks whichever plan was active at the time of
    issuance — a customer who upgraded mid-lifetime shows a real step
    change in their billing history, not a flat line.
    """
    invoices = []
    end = TODAY
    cursor = signup_date + timedelta(days=random.randint(1, 5))
    while cursor <= end:
        amount = _price_at(cursor, subscription_rows, plan_price_by_id)
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
    parser.add_argument("--customers", type=int, default=2000)
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

        # Insert with the initial plan first; corrected to the final plan
        # below once subscription history (and any plan change) is known.
        cur.execute(
            """INSERT INTO customers (name, company, signup_date, country, plan_id, status)
               VALUES (%(name)s, %(company)s, %(signup_date)s, %(country)s, %(plan_id)s, %(status)s)
               RETURNING id""",
            c,
        )
        customer_id = cur.fetchone()[0]

        subscription_rows, final_plan_id = build_subscriptions(
            customer_id, c["plan_id"], plan_ids, c["signup_date"], c["status"]
        )
        if final_plan_id != c["plan_id"]:
            cur.execute("UPDATE customers SET plan_id = %s WHERE id = %s", (final_plan_id, customer_id))

        for sub in subscription_rows:
            cur.execute(
                """INSERT INTO subscriptions (customer_id, plan_id, started_at, ended_at, status)
                   VALUES (%(customer_id)s, %(plan_id)s, %(started_at)s, %(ended_at)s, %(status)s)""",
                sub,
            )

        for inv in build_invoices(customer_id, subscription_rows, plan_price_by_id, c["signup_date"], c["status"]):
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
