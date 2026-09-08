"""Loads the schema whitelist config (backend/config/schema_whitelist.yaml).

This is the single source of truth for which tables/columns the LLM is
allowed to see (Phase 1) and which generated queries are allowed to touch
(Phase 3 validation layer). Both phases read the same file so there is
exactly one place to add/remove exposed schema surface.
"""

from pathlib import Path

import yaml

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "schema_whitelist.yaml"


def load_whitelist(path: Path = CONFIG_PATH) -> dict[str, list[str]]:
    """Returns {table_name: [column_name, ...]}."""
    with open(path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)
    tables = raw.get("tables", {}) or {}
    return {table: (spec.get("columns") or []) for table, spec in tables.items()}
