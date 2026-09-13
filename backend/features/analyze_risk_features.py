from pathlib import Path

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATA_FILE = (
    PROJECT_ROOT
    / "datasets"
    / "processed"
    / "account_risk_dataset.csv"
)


FEATURE_COLUMNS = [
    "transaction_count",
    "successful_transactions",
    "failed_transactions",
    "failed_tx_ratio",
    "total_volume",
    "borrow_count",
    "borrow_volume",
    "repay_count",
    "repay_volume",
    "repayment_ratio",
    "deposit_volume",
    "withdrawal_volume",
    "net_deposit_flow",
    "unique_counterparties",
    "unique_tokens",
    "unique_protocols",
    "active_days",
    "historical_liquidation_count",
]


def main():

    print("Loading risk dataset...")

    df = pd.read_csv(DATA_FILE)

    print(
        f"Dataset shape: {df.shape}"
    )

    print(
        "\nRisk distribution:"
    )

    print(
        df["risk_label"].value_counts()
    )

    print(
        "\n========== FEATURE MEANS =========="
    )

    means = (
        df.groupby("risk_label")[
            FEATURE_COLUMNS
        ]
        .mean()
        .T
    )

    print(
        means.to_string()
    )

    print(
        "\n========== FEATURE MEDIANS =========="
    )

    medians = (
        df.groupby("risk_label")[
            FEATURE_COLUMNS
        ]
        .median()
        .T
    )

    print(
        medians.to_string()
    )

    print(
        "\n========== FEATURE STANDARD DEVIATIONS =========="
    )

    stds = (
        df.groupby("risk_label")[
            FEATURE_COLUMNS
        ]
        .std()
        .T
    )

    print(
        stds.to_string()
    )


if __name__ == "__main__":
    main()