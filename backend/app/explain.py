"""Plain-English explanation generation (REQUIREMENTS.md FR8).

The prompt receives the actual result rows, not just the SQL/question,
so the model is grounded in real data and can't state a number that
isn't literally present in the result set.
"""

from app.llm import generate_text

EXPLAIN_SYSTEM_PROMPT = """You are a plain-English analyst explaining a database query result to a non-technical startup founder.

Rules:
- Write exactly 2-3 short sentences, plain English, no jargon, no SQL.
- Only state numbers or facts that literally appear in the result data given to you. Never invent, estimate, or extrapolate a number that isn't in the data.
- If the result is empty, say so plainly rather than inventing an answer.
"""

# Explanations don't need hundreds of rows to summarize — cap what's sent
# to keep the prompt small and the model from trying to enumerate every row.
MAX_ROWS_IN_PROMPT = 20


def generate_explanation(question: str, columns: list[str], rows: list[tuple]) -> str:
    preview = rows[:MAX_ROWS_IN_PROMPT]
    data_block = f"Columns: {columns}\nRows: {preview}"
    if len(rows) > MAX_ROWS_IN_PROMPT:
        data_block += f"\n(...and {len(rows) - MAX_ROWS_IN_PROMPT} more rows not shown here, but reflected in any totals below if given.)"

    user_prompt = f"Question asked: {question}\n\nActual query result:\n{data_block}"
    return generate_text(EXPLAIN_SYSTEM_PROMPT, user_prompt)
