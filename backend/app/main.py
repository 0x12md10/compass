"""FastAPI entrypoint for the AI Analytics Copilot backend.

/ask wires the full pipeline: NL -> SQL (Phase 2) -> guardrails ->
execution (Phase 3) -> chart type + explanation (Phase 4). Connections
are opened per-request and closed afterward — fine for a demo's traffic
level (SCOPE.md explicitly excludes connection pooling / production
scaling concerns).
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Callable

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app import dashboard
from app.answer import answer_question
from app.db import get_connection
from app.restricted_db import get_restricted_connection

app = FastAPI(title="AI Analytics Copilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    question: str
    # Optional mascot-analyst context (v2/REQUIREMENTS.md FR-M1/FR-M3): a
    # short, human-readable description of the dashboard tile the user is
    # looking at. Deliberately a plain string, not structured sub-fields —
    # it only ever seeds the LLM's user-facing prompt (see nl_to_sql.ask),
    # never the guardrail-relevant system prompt, so there's nothing here
    # for the backend to parse or branch on.
    context: str | None = None


class AskResponse(BaseModel):
    question: str
    sql: str | None
    columns: list[str] | None
    rows: list[list[Any]] | None
    chart_type: str | None
    x_key: str | None
    y_key: str | None
    explanation: str | None
    refusal_reason: str | None


def _json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


class DashboardTileResponse(BaseModel):
    columns: list[str]
    rows: list[list[Any]]


def _run_tile(fn: Callable, *args) -> DashboardTileResponse:
    """Shared plumbing for every dashboard tile endpoint (v2/REQUIREMENTS.md
    FR-D1/FR-D2): opens the SAME restricted connection v1's ad-hoc queries
    use (never the admin connection, even for developer-authored SQL),
    runs one tile function, and fails gracefully — one tile's failure
    must not take down the others (FR-D5), so each endpoint is independent.
    """
    try:
        conn = get_restricted_connection()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail="The database is unavailable right now. Please try again shortly.") from exc

    try:
        columns, rows = fn(conn, *args)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="Couldn't load this tile right now. Please try again.") from exc
    finally:
        conn.close()

    return DashboardTileResponse(columns=columns, rows=[[_json_safe(v) for v in row] for row in rows])


DaysParam = Query(dashboard.DEFAULT_DAYS, ge=1, le=3650)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/ask", response_model=AskResponse)
def ask(payload: AskRequest) -> AskResponse:
    question = payload.question.strip()
    context = payload.context.strip() if payload.context else None
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        admin_conn = get_connection()
        restricted_conn = get_restricted_connection()
    except Exception as exc:  # noqa: BLE001 - DB unreachable etc. must not leak a stack trace to the UI
        raise HTTPException(status_code=503, detail="The database is unavailable right now. Please try again shortly.") from exc

    try:
        result = answer_question(admin_conn, restricted_conn, question, context=context)
    except Exception as exc:  # noqa: BLE001 - any unexpected failure must still produce a clear message, not a 500 stack trace
        raise HTTPException(status_code=502, detail="Something went wrong answering that question. Please try again.") from exc
    finally:
        admin_conn.close()
        restricted_conn.close()

    rows = [[_json_safe(v) for v in row] for row in result.rows] if result.rows is not None else None

    return AskResponse(
        question=result.question,
        sql=result.sql,
        columns=result.columns,
        rows=rows,
        chart_type=result.chart.chart_type if result.chart else None,
        x_key=result.chart.x_key if result.chart else None,
        y_key=result.chart.y_key if result.chart else None,
        explanation=result.explanation,
        refusal_reason=result.refusal_reason,
    )


# --- Dashboard tiles (v2) ---------------------------------------------------
# One endpoint per tile (v2/BUILD_PLAN.md D1 decision) so a single broken
# tile can't take down the others — see _run_tile above.

@app.get("/dashboard/mrr", response_model=DashboardTileResponse)
def dashboard_mrr() -> DashboardTileResponse:
    return _run_tile(dashboard.current_mrr)


@app.get("/dashboard/customer-status", response_model=DashboardTileResponse)
def dashboard_customer_status() -> DashboardTileResponse:
    return _run_tile(dashboard.customer_status_counts)


@app.get("/dashboard/overdue-rate", response_model=DashboardTileResponse)
def dashboard_overdue_rate() -> DashboardTileResponse:
    return _run_tile(dashboard.overdue_invoice_rate)


@app.get("/dashboard/revenue-trend", response_model=DashboardTileResponse)
def dashboard_revenue_trend(days: int = DaysParam) -> DashboardTileResponse:
    return _run_tile(dashboard.revenue_trend, days)


@app.get("/dashboard/signups-by-month", response_model=DashboardTileResponse)
def dashboard_signups_by_month(days: int = DaysParam) -> DashboardTileResponse:
    return _run_tile(dashboard.signups_by_month, days)


@app.get("/dashboard/signups-by-country", response_model=DashboardTileResponse)
def dashboard_signups_by_country(days: int = DaysParam) -> DashboardTileResponse:
    return _run_tile(dashboard.signups_by_country, days)


@app.get("/dashboard/churn-by-plan", response_model=DashboardTileResponse)
def dashboard_churn_by_plan(days: int = DaysParam) -> DashboardTileResponse:
    return _run_tile(dashboard.churn_by_plan, days)


@app.get("/dashboard/ticket-volume", response_model=DashboardTileResponse)
def dashboard_ticket_volume(days: int = DaysParam) -> DashboardTileResponse:
    return _run_tile(dashboard.ticket_volume, days)
