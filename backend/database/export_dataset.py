from __future__ import annotations

from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

from backend.database.config import DATABASE_URL


OUTPUT_DIR = Path("datasets") / "processed"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


TABLES = [
    "accounts",
    "blocks",
    "tokens",
    "protocols",
    "transactions",
    "defi_events",
    "account_features",
    "risk_labels",
]


def export_table(engine, table_name: str) -> None:

    df = pd.read_sql(
        text(f'SELECT * FROM "{table_name}"'),
        engine,
    )

    output_file = OUTPUT_DIR / f"{table_name}.csv"

    df.to_csv(
        output_file,
        index=False,
    )

    print(
        f"{table_name}: "
        f"{len(df):,} rows -> {output_file}"
    )


def export_combined_account_dataset(engine) -> None:

    query = text("""
        SELECT

            -- ==================================================
            -- Account identifier
            -- ==================================================

            af.account_id,

            -- ==================================================
            -- Existing behavioral features
            -- ==================================================

            af.transaction_count,
            af.successful_transactions,
            af.failed_transactions,
            af.failed_tx_ratio,

            af.total_volume,

            af.borrow_count,
            af.borrow_volume,

            af.repay_count,
            af.repay_volume,
            af.repayment_ratio,

            af.deposit_volume,
            af.withdrawal_volume,
            af.net_deposit_flow,

            af.unique_counterparties,
            af.unique_tokens,
            af.unique_protocols,

            af.active_days,
            af.historical_liquidation_count,

            -- ==================================================
            -- Existing DeFi risk features
            -- ==================================================

            af.borrow_to_repay_ratio,
            af.withdrawal_to_deposit_ratio,
            af.liquidation_rate,
            af.borrow_intensity,
            af.transactions_per_active_day,

            -- ==================================================
            -- Feature Engineering V2
            -- ==================================================

            af.borrow_volume_ratio,
            af.repay_to_borrow_ratio,
            af.borrow_frequency,
            af.repay_frequency,
            af.withdrawal_pressure,
            af.deposit_retention_ratio,
            af.average_transaction_value,
            af.average_borrow_value,
            af.average_repay_value,

            -- ==================================================
            -- Future outcome information
            --
            -- These MUST NOT be used as model input features.
            -- They are retained only for evaluation/label analysis.
            -- ==================================================

            rl.future_liquidation_count,
            rl.future_borrow_count,
            rl.future_repay_count,
            rl.future_failed_tx_ratio,

            rl.risk_label

        FROM account_features af

        LEFT JOIN risk_labels rl
            ON af.account_id = rl.account_id

        ORDER BY af.account_id
    """)

    df = pd.read_sql(
        query,
        engine,
    )

    output_file = (
        OUTPUT_DIR /
        "account_risk_dataset.csv"
    )

    df.to_csv(
        output_file,
        index=False,
    )

    print(
        f"account_risk_dataset: "
        f"{len(df):,} rows -> {output_file}"
    )

    print(
        f"Total columns: {len(df.columns)}"
    )


def main() -> None:

    print(
        "Exporting PostgreSQL dataset to CSV..."
    )

    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
    )

    try:

        # ------------------------------------------------
        # Export individual database tables
        # ------------------------------------------------

        for table in TABLES:

            export_table(
                engine,
                table,
            )

        # ------------------------------------------------
        # Export combined account dataset
        # ------------------------------------------------

        export_combined_account_dataset(
            engine
        )

        print(
            "Dataset export completed successfully."
        )

    finally:

        engine.dispose()


if __name__ == "__main__":

    main()