"""Phase 2 test harness: runs the fixed question set through the NL->SQL
engine and reports whether each produced syntactically valid, executable
SQL (semantic correctness against the seeded data still needs a manual
eyeball pass per BUILD_PLAN.md Phase 2 acceptance criteria).

Usage:
    python -m app.run_test_questions
"""

from app.db import get_connection
from app.nl_to_sql import ask
from app.test_questions import ADVERSARIAL_QUESTIONS, OUT_OF_SCOPE_QUESTIONS, QUESTIONS


def run_group(conn, label: str, questions: list[str]) -> None:
    print(f"\n=== {label} ===")
    for q in questions:
        result = ask(conn, q)
        print(f"\nQ: {q}")
        if result.sql:
            print(f"  SQL ({result.attempts} attempt(s)): {result.sql}")
        else:
            print(f"  REFUSED/FAILED ({result.attempts} attempt(s)): {result.refusal_reason}")


def main() -> None:
    conn = get_connection()
    try:
        run_group(conn, "Legitimate questions (1-14)", QUESTIONS)
        run_group(conn, "Adversarial questions (15-16)", ADVERSARIAL_QUESTIONS)
        run_group(conn, "Out-of-scope questions (17)", OUT_OF_SCOPE_QUESTIONS)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
