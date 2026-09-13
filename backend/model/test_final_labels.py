from pathlib import Path

import pandas as pd
import numpy as np


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "datasets" / "processed"

FEATURES_FILE = DATA_DIR / "account_features.csv"
TRANSACTIONS_FILE = DATA_DIR / "transactions.csv"

RISK_LABELS_FILE = DATA_DIR / "risk_labels.csv"
RISK_DATASET_FILE = DATA_DIR / "account_risk_dataset.csv"


# ============================================================
# FUTURE OUTCOME WINDOW
# ============================================================

# Features represent historical behavior before this period.
# Future behavior during this period is used ONLY to create
# the ground-truth risk label.

OUTCOME_START = pd.Timestamp("2025-05-01")
OUTCOME_END = pd.Timestamp("2025-07-01")


def calculate_future_outcomes():
    """
    Calculate future borrower behavior used to create
    ground-truth risk labels.

    IMPORTANT:
    These future outcomes are NOT model input features.
    They are used only for generating the target label.
    """

    print("Generating future risk labels...")

    transactions = pd.read_csv(TRANSACTIONS_FILE)

    transactions["timestamp"] = pd.to_datetime(
        transactions["timestamp"]
    )

    # Only successful transactions contribute to future
    # behavioral outcomes.
    future_transactions = transactions[
        (transactions["timestamp"] >= OUTCOME_START)
        & (transactions["timestamp"] < OUTCOME_END)
        & (transactions["status"] == "SUCCESS")
    ].copy()

    print(
        "Outcome transactions:",
        len(future_transactions)
    )

    # --------------------------------------------------------
    # Future liquidation count
    # --------------------------------------------------------

    liquidation_counts = (
        future_transactions[
            future_transactions["transaction_type"] == "LIQUIDATION"
        ]
        .groupby("from_account_id")
        .size()
        .rename("future_liquidation_count")
    )

    # --------------------------------------------------------
    # Future borrow count
    # --------------------------------------------------------

    borrow_counts = (
        future_transactions[
            future_transactions["transaction_type"] == "BORROW"
        ]
        .groupby("from_account_id")
        .size()
        .rename("future_borrow_count")
    )

    # --------------------------------------------------------
    # Future repay count
    # --------------------------------------------------------

    repay_counts = (
        future_transactions[
            future_transactions["transaction_type"] == "REPAY"
        ]
        .groupby("from_account_id")
        .size()
        .rename("future_repay_count")
    )

    # --------------------------------------------------------
    # Future failed transaction ratio
    #
    # Calculate this from ALL transactions in the future
    # window, because failures themselves are part of the
    # outcome we want to measure.
    # --------------------------------------------------------

    future_all_transactions = transactions[
        (transactions["timestamp"] >= OUTCOME_START)
        & (transactions["timestamp"] < OUTCOME_END)
    ].copy()

    total_future_transactions = (
        future_all_transactions
        .groupby("from_account_id")
        .size()
    )

    failed_future_transactions = (
        future_all_transactions[
            future_all_transactions["status"] != "SUCCESS"
        ]
        .groupby("from_account_id")
        .size()
    )

    future_failed_ratio = (
        failed_future_transactions
        / total_future_transactions
    ).fillna(0)

    future_failed_ratio.name = "future_failed_tx_ratio"

    # --------------------------------------------------------
    # Combine outcomes
    # --------------------------------------------------------

    accounts = pd.DataFrame({
        "account_id": pd.read_csv(FEATURES_FILE)["account_id"]
    }).drop_duplicates()

    outcomes = accounts.set_index("account_id")

    outcomes = outcomes.join(liquidation_counts)
    outcomes = outcomes.join(borrow_counts)
    outcomes = outcomes.join(repay_counts)
    outcomes = outcomes.join(future_failed_ratio)

    outcomes = outcomes.fillna(0)

    return outcomes.reset_index()


def generate_risk_labels(outcomes):
    """
    Generate three-level risk labels.

    Hierarchical DeFi-inspired labeling:

    HIGH:
        - 2 or more future liquidations
        OR
        - future failed transaction ratio >= 20%

    MEDIUM:
        - exactly 1 future liquidation
        OR
        - future failed transaction ratio >= 10%

    LOW:
        - otherwise

    HIGH has priority over MEDIUM.
    """

    high_condition = (
        (outcomes["future_liquidation_count"] >= 2)
        | (outcomes["future_failed_tx_ratio"] >= 0.20)
    )

    medium_condition = (
        (~high_condition)
        & (
            (outcomes["future_liquidation_count"] == 1)
            | (outcomes["future_failed_tx_ratio"] >= 0.10)
        )
    )

    outcomes["risk_label"] = np.select(
        [
            high_condition,
            medium_condition
        ],
        [
            "HIGH",
            "MEDIUM"
        ],
        default="LOW"
    )

    # --------------------------------------------------------
    # Numeric labels for ML
    # --------------------------------------------------------

    outcomes["risk_label_id"] = outcomes["risk_label"].map({
        "LOW": 0,
        "MEDIUM": 1,
        "HIGH": 2
    })

    return outcomes


def create_risk_dataset(outcomes):
    """
    Combine historical account features with future outcomes.

    Historical features are model inputs.
    Future outcomes are target-generation information only.
    """

    features = pd.read_csv(FEATURES_FILE)

    # Remove any accidental target columns if present.
    outcome_columns = [
        "future_liquidation_count",
        "future_borrow_count",
        "future_repay_count",
        "future_failed_tx_ratio",
        "risk_label",
        "risk_label_id",
        "risk_score"
    ]

    features = features.drop(
        columns=[
            column
            for column in outcome_columns
            if column in features.columns
        ],
        errors="ignore"
    )

    dataset = features.merge(
        outcomes,
        on="account_id",
        how="left"
    )

    return dataset


def main():

    outcomes = calculate_future_outcomes()

    # --------------------------------------------------------
    # Generate labels
    # --------------------------------------------------------

    outcomes = generate_risk_labels(outcomes)

    # --------------------------------------------------------
    # Save risk labels
    # --------------------------------------------------------

    risk_labels = outcomes[
        [
            "account_id",
            "future_liquidation_count",
            "future_borrow_count",
            "future_repay_count",
            "future_failed_tx_ratio",
            "risk_label",
            "risk_label_id"
        ]
    ]

    risk_labels.to_csv(
        RISK_LABELS_FILE,
        index=False
    )

    # --------------------------------------------------------
    # Create complete dataset
    # --------------------------------------------------------

    risk_dataset = create_risk_dataset(
        outcomes
    )

    risk_dataset.to_csv(
        RISK_DATASET_FILE,
        index=False
    )

    # --------------------------------------------------------
    # Print results
    # --------------------------------------------------------

    print(
        "\nGenerated risk labels for",
        len(outcomes),
        "accounts"
    )

    print("\n========== RISK LABEL DISTRIBUTION ==========")

    distribution = (
        outcomes["risk_label"]
        .value_counts()
        .reindex(
            ["LOW", "MEDIUM", "HIGH"],
            fill_value=0
        )
    )

    print(distribution)

    print("\n========== RISK LABEL PERCENTAGES ==========")

    percentages = (
        distribution / len(outcomes) * 100
    ).round(2)

    print(percentages)

    print("\n========== FUTURE OUTCOME SUMMARY ==========")

    summary = (
        outcomes
        .groupby("risk_label")
        [
            [
                "future_liquidation_count",
                "future_borrow_count",
                "future_repay_count",
                "future_failed_tx_ratio"
            ]
        ]
        .mean()
        .reindex(["LOW", "MEDIUM", "HIGH"])
    )

    print(summary.round(4))

    print("\n=============================================")

    print("\nSaved:")
    print(RISK_LABELS_FILE)
    print(RISK_DATASET_FILE)


if __name__ == "__main__":
    main()