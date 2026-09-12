"""Chart-type selection heuristic (REQUIREMENTS.md FR7). Deterministic,
based purely on the result set's shape (column count/types) — no LLM
call needed, per BUILD_PLAN.md Phase 4.
"""

import datetime
from dataclasses import dataclass
from decimal import Decimal


@dataclass
class ChartSpec:
    chart_type: str  # "stat" | "bar" | "line" | "table"
    x_key: str | None = None
    y_key: str | None = None


def _is_date_like(value) -> bool:
    return isinstance(value, (datetime.date, datetime.datetime))


def _is_numeric(value) -> bool:
    return isinstance(value, (int, float, Decimal)) and not isinstance(value, bool)


def select_chart(columns: list[str], rows: list[tuple]) -> ChartSpec:
    if not rows or not columns:
        return ChartSpec(chart_type="table")

    if len(columns) == 1 and len(rows) == 1:
        return ChartSpec(chart_type="stat")

    if len(columns) == 2:
        sample = rows[0]
        if _is_numeric(sample[1]):
            if _is_date_like(sample[0]):
                return ChartSpec(chart_type="line", x_key=columns[0], y_key=columns[1])
            return ChartSpec(chart_type="bar", x_key=columns[0], y_key=columns[1])

    return ChartSpec(chart_type="table")
