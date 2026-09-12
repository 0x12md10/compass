"""Orchestrates the full pipeline: NL -> SQL -> guardrails -> execute
(Phases 2-3) -> chart type -> explanation (Phase 4). This is what the
future /ask API endpoint (Phase 5) calls.
"""

from dataclasses import dataclass

from app.chart_selector import ChartSpec, select_chart
from app.explain import generate_explanation
from app.nl_to_sql import ask as generate_and_execute


@dataclass
class Answer:
    question: str
    sql: str | None
    columns: list[str] | None
    rows: list[tuple] | None
    chart: ChartSpec | None
    explanation: str | None
    refusal_reason: str | None
    attempts: int


def answer_question(admin_conn, restricted_conn, question: str, context: str | None = None) -> Answer:
    result = generate_and_execute(admin_conn, restricted_conn, question, context=context)

    if result.sql is None:
        return Answer(
            question=question,
            sql=None,
            columns=None,
            rows=None,
            chart=None,
            explanation=None,
            refusal_reason=result.refusal_reason,
            attempts=result.attempts,
        )

    chart = select_chart(result.columns, result.rows)
    explanation = generate_explanation(question, result.columns, result.rows)

    return Answer(
        question=question,
        sql=result.sql,
        columns=result.columns,
        rows=result.rows,
        chart=chart,
        explanation=explanation,
        refusal_reason=None,
        attempts=result.attempts,
    )
