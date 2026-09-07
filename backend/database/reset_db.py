from backend.database.models import Base
from backend.database.session import engine


def reset_database():
    print("Resetting database...")

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    print("Database reset successfully.")


if __name__ == "__main__":
    reset_database()