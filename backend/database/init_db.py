from __future__ import annotations

from .models import Base
from .session import engine


def init_database() -> None:
    """Create all database tables."""
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_database()
    print("Database tables created successfully.")