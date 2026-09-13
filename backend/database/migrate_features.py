from sqlalchemy import text

from .session import engine


def migrate_account_features():
    print("Updating account_features table...")

    columns = [
        (
            "borrow_to_repay_ratio",
            "NUMERIC(20,6) NOT NULL DEFAULT 0"
        ),
        (
            "withdrawal_to_deposit_ratio",
            "NUMERIC(20,6) NOT NULL DEFAULT 0"
        ),
        (
            "liquidation_rate",
            "NUMERIC(20,6) NOT NULL DEFAULT 0"
        ),
        (
            "borrow_intensity",
            "NUMERIC(20,6) NOT NULL DEFAULT 0"
        ),
        (
            "transactions_per_active_day",
            "NUMERIC(20,6) NOT NULL DEFAULT 0"
        ),
    ]

    with engine.begin() as connection:
        for column_name, column_definition in columns:
            connection.execute(
                text(
                    f"""
                    ALTER TABLE account_features
                    ADD COLUMN IF NOT EXISTS
                    {column_name} {column_definition};
                    """
                )
            )

    print("account_features table updated successfully.")


if __name__ == "__main__":
    migrate_account_features()