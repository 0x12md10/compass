"""Database connection helper.

Reads DATABASE_URL from the environment (see .env.example). Phase 1 uses
this for introspection; Phase 3 adds a second, restricted connection for
executing generated queries under the read-only DB role.
"""

import os

import psycopg2
from dotenv import load_dotenv

load_dotenv()

DEFAULT_DSN = "postgresql://aac:aac_dev_password@127.0.0.1:5434/aac"


def get_connection(dsn: str | None = None):
    return psycopg2.connect(dsn or os.environ.get("DATABASE_URL", DEFAULT_DSN))
