from __future__ import annotations

import os


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:PRSS2126@localhost:5432/defi_credit_risk",
)