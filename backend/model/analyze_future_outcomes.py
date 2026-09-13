from pathlib import Path

import pandas as pd
import numpy as np


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_FILE = PROJECT_ROOT / "datasets" / "processed" / "account_risk_dataset.csv"


def main():
    df = pd.read_csv(DATA_FILE)

    print("=" * 75)
    print("FUTURE OUTCOME DISTRIBUTION ANALYSIS")
    print("=" * 75)

    outcome_columns = [
        "future_liquidation_count",
        "future_borrow_count",
        "future_repay_count",
        "future_failed_tx_ratio",
    ]

    print("\nDataset shape:", df.shape)

    # ---------------------------------------------------------
    # Basic distributions
    # ---------------------------------------------------------
    for column in outcome_columns:
        print("\n" + "-" * 75)
        print(column)
        print("-" * 75)

        print("Min:", df[column].min())
        print("Max:", df[column].max())
        print("Mean:", df[column].mean())
        print("Median:", df[column].median())

        print("\nValue counts:")
        print(df[column].value_counts().sort_index())

    # ---------------------------------------------------------
    # Future liquidation groups
    # ---------------------------------------------------------
    print("\n" + "=" * 75)
    print("FUTURE LIQUIDATION GROUPS")
    print("=" * 75)

    liquidation_groups = pd.cut(
        df["future_liquidation_count"],
        bins=[-1, 0, 1, np.inf],
        labels=[
            "No liquidation",
            "One liquidation",
            "Multiple liquidations"
        ]
    )

    print(liquidation_groups.value_counts().sort_index())

    # ---------------------------------------------------------
    # Future failed transaction groups
    # ---------------------------------------------------------
    print("\n" + "=" * 75)
    print("FUTURE FAILED TRANSACTION GROUPS")
    print("=" * 75)

    failed_groups = pd.cut(
        df["future_failed_tx_ratio"],
        bins=[-0.001, 0, 0.10, 0.20, 0.50, 1.0],
        labels=[
            "0%",
            "0-10%",
            "10-20%",
            "20-50%",
            "50%+"
        ]
    )

    print(failed_groups.value_counts().sort_index())

    # ---------------------------------------------------------
    # Candidate natural risk groups
    # ---------------------------------------------------------
    print("\n" + "=" * 75)
    print("COMBINED FUTURE OUTCOME PATTERNS")
    print("=" * 75)

    patterns = (
        df.groupby(
            [
                "future_liquidation_count",
                "future_failed_tx_ratio"
            ]
        )
        .size()
        .reset_index(name="account_count")
        .sort_values("account_count", ascending=False)
    )

    print(patterns.head(30).to_string(index=False))

    # ---------------------------------------------------------
    # Current labels vs future outcomes
    # ---------------------------------------------------------
    print("\n" + "=" * 75)
    print("CURRENT LABEL VS FUTURE OUTCOMES")
    print("=" * 75)

    summary = (
        df.groupby("risk_label")[outcome_columns]
        .agg(["mean", "median", "max"])
    )

    print(summary.to_string())

    # ---------------------------------------------------------
    # Current label counts
    # ---------------------------------------------------------
    print("\n" + "=" * 75)
    print("CURRENT LABEL DISTRIBUTION")
    print("=" * 75)

    print(df["risk_label"].value_counts())

    print("\nAnalysis complete.")


if __name__ == "__main__":
    main()