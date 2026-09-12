"""Dashboard data layer (v2/REQUIREMENTS.md FR-D1/FR-D2/FR-D3).

Fixed, hand-written SQL — one function per tile — executed through the
SAME restricted `aac_readonly` connection as v1's LLM-generated ad-hoc
queries (restricted_db.execute_readonly). No special/elevated DB path
for dashboard code, even though this SQL is developer-authored, not
LLM-generated: that's a deliberate trust-building choice (FR-D2), not an
oversight.

Range-filterable tiles take a `days` parameter (lookback window from
today); point-in-time tiles ignore it entirely (FR-D3) — see the table in
v2/REQUIREMENTS.md FR-D1 for which is which. `days` is always a validated
Python int (the FastAPI layer enforces this — see main.py), so it's
interpolated directly rather than routed through cursor.mogrify.
"""

from app.restricted_db import execute_readonly

DEFAULT_DAYS = 365


# --- Point-in-time tiles (not range-filterable) ---------------------------

def current_mrr(conn):
    sql = """
        SELECT SUM(p.monthly_price) AS mrr
        FROM subscriptions s
        JOIN plans p ON s.plan_id = p.id
        WHERE s.status = 'active'
    """
    return execute_readonly(conn, sql)


def customer_status_counts(conn):
    sql = """
        SELECT status, COUNT(*) AS customer_count
        FROM customers
        GROUP BY status
        ORDER BY customer_count DESC
    """
    return execute_readonly(conn, sql)


def overdue_invoice_rate(conn):
    sql = """
        SELECT 100.0 * COUNT(CASE WHEN status = 'overdue' THEN 1 END) / NULLIF(COUNT(*), 0) AS overdue_pct
        FROM invoices
    """
    return execute_readonly(conn, sql)


# --- Range-filterable tiles ------------------------------------------------

def revenue_trend(conn, days: int = DEFAULT_DAYS):
    sql = f"""
        SELECT date_trunc('month', paid_at)::date AS month, SUM(amount) AS revenue
        FROM invoices
        WHERE status = 'paid' AND paid_at >= CURRENT_DATE - ({int(days)} * INTERVAL '1 day')
        GROUP BY 1
        ORDER BY 1
    """
    return execute_readonly(conn, sql)


def signups_by_month(conn, days: int = DEFAULT_DAYS):
    sql = f"""
        SELECT date_trunc('month', signup_date)::date AS month, COUNT(*) AS new_signups
        FROM customers
        WHERE signup_date >= CURRENT_DATE - ({int(days)} * INTERVAL '1 day')
        GROUP BY 1
        ORDER BY 1
    """
    return execute_readonly(conn, sql)


def signups_by_country(conn, days: int = DEFAULT_DAYS):
    sql = f"""
        SELECT country, COUNT(*) AS customer_count
        FROM customers
        WHERE signup_date >= CURRENT_DATE - ({int(days)} * INTERVAL '1 day')
        GROUP BY country
        ORDER BY customer_count DESC
        LIMIT 10
    """
    return execute_readonly(conn, sql)


def churn_by_plan(conn, days: int = DEFAULT_DAYS):
    """Attributes each churned customer to the plan they were on when they
    churned (their latest subscription row — see db/SCHEMA.md's note on
    subscriptions being an append-only history, not 1:1 with customers),
    not just their original signup plan. Range-filters on that latest
    subscription's ended_at, i.e. "churned within the window."
    """
    sql = f"""
        WITH latest_sub AS (
            SELECT DISTINCT ON (customer_id) customer_id, plan_id, ended_at
            FROM subscriptions
            ORDER BY customer_id, started_at DESC
        )
        SELECT p.name, COUNT(*) AS churned_count
        FROM customers c
        JOIN latest_sub ls ON ls.customer_id = c.id
        JOIN plans p ON p.id = ls.plan_id
        WHERE c.status = 'churned'
          AND ls.ended_at >= CURRENT_DATE - ({int(days)} * INTERVAL '1 day')
        GROUP BY p.name
        ORDER BY churned_count DESC
    """
    return execute_readonly(conn, sql)


def ticket_volume(conn, days: int = DEFAULT_DAYS):
    sql = f"""
        SELECT status, COUNT(*) AS ticket_count
        FROM support_tickets
        WHERE opened_at >= CURRENT_DATE - ({int(days)} * INTERVAL '1 day')
        GROUP BY status
        ORDER BY ticket_count DESC
    """
    return execute_readonly(conn, sql)
