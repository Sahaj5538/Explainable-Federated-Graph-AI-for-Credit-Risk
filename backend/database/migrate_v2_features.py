from sqlalchemy import text

from backend.database.session import engine


# ============================================================
# Feature Engineering V2 columns
# ============================================================

V2_COLUMNS = {
    "borrow_volume_ratio": "NUMERIC(20, 6) NOT NULL DEFAULT 0",
    "repay_to_borrow_ratio": "NUMERIC(20, 6) NOT NULL DEFAULT 0",
    "borrow_frequency": "NUMERIC(20, 6) NOT NULL DEFAULT 0",
    "repay_frequency": "NUMERIC(20, 6) NOT NULL DEFAULT 0",
    "withdrawal_pressure": "NUMERIC(20, 6) NOT NULL DEFAULT 0",
    "deposit_retention_ratio": "NUMERIC(20, 6) NOT NULL DEFAULT 0",
    "average_transaction_value": "NUMERIC(30, 10) NOT NULL DEFAULT 0",
    "average_borrow_value": "NUMERIC(30, 10) NOT NULL DEFAULT 0",
    "average_repay_value": "NUMERIC(30, 10) NOT NULL DEFAULT 0",
}


def main():
    print("Adding Feature Engineering V2 columns...")

    with engine.begin() as connection:

        for column_name, column_type in V2_COLUMNS.items():

            # Check whether the column already exists
            result = connection.execute(
                text(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'account_features'
                        AND column_name = :column_name
                    )
                    """
                ),
                {"column_name": column_name},
            )

            exists = result.scalar()

            if exists:
                print(f"{column_name}: already exists")

            else:
                connection.execute(
                    text(
                        f"""
                        ALTER TABLE account_features
                        ADD COLUMN {column_name}
                        {column_type}
                        """
                    )
                )

                print(f"{column_name}: added")

    print("\nFeature Engineering V2 migration completed.")


if __name__ == "__main__":
    main()