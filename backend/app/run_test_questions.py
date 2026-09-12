"""Phase 2/3 test harness: runs the fixed question set through the full
NL->SQL->guardrail->execute pipeline and reports the outcome (success,
refused by the model, blocked by AST validation, or execution error).

Usage:
    python -m app.run_test_questions
"""

from app.db import get_connection
from app.nl_to_sql import ask
from app.restricted_db import get_restricted_connection
from app.test_questions import ADVERSARIAL_QUESTIONS, OUT_OF_SCOPE_QUESTIONS, QUESTIONS


def run_group(admin_conn, restricted_conn, label: str, questions: list[str]) -> None:
    print(f"\n=== {label} ===")
    for q in questions:
        result = ask(admin_conn, restricted_conn, q)
        print(f"\nQ: {q}")
        if result.sql:
            print(f"  SQL ({result.attempts} attempt(s)): {result.sql}")
            print(f"  Rows returned: {len(result.rows)}")
        else:
            print(f"  BLOCKED/REFUSED ({result.attempts} attempt(s)): {result.refusal_reason}")


def main() -> None:
    admin_conn = get_connection()
    restricted_conn = get_restricted_connection()
    try:
        run_group(admin_conn, restricted_conn, "Legitimate questions (1-14)", QUESTIONS)
        run_group(admin_conn, restricted_conn, "Adversarial questions (15-16)", ADVERSARIAL_QUESTIONS)
        run_group(admin_conn, restricted_conn, "Out-of-scope questions (17)", OUT_OF_SCOPE_QUESTIONS)
    finally:
        admin_conn.close()
        restricted_conn.close()


if __name__ == "__main__":
    main()
