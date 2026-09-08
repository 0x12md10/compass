"""Test harness for Phase 1: prints the generated schema context so it
can be eyeballed for sanity (see BUILD_PLAN.md Phase 1 acceptance
criteria).

Usage:
    python -m app.print_schema_context
"""

from app.db import get_connection
from app.schema_context import build_schema_context


def main() -> None:
    conn = get_connection()
    try:
        context = build_schema_context(conn)
        print(context)
        print(f"\n--- {len(context)} chars (~{len(context) // 4} tokens) ---")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
