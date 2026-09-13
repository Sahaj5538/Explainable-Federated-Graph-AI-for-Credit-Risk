from pathlib import Path
import pandas as pd
import numpy as np


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_FILE = PROJECT_ROOT / "datasets" / "processed" / "account_risk_dataset.csv"


def evaluate_candidate(name, df, labels):
    result = df.copy()
    result["candidate_label"] = labels

    counts = result["candidate_label"].value_counts()

    summary = (
        result.groupby("candidate_label")
        [
            [
                "future_liquidation_count",
                "future_failed_tx_ratio",
                "future_borrow_count",
                "future_repay_count",
            ]
        ]
        .agg(["mean", "median"])
    )

    print("\n" + "=" * 75)
    print(name)
    print("=" * 75)

    print("\nClass distribution:")
    print(counts)

    print("\nClass percentages:")
    print((counts / len(df) * 100).round(2))

    print("\nFuture outcome statistics:")
    print(summary.round(4).to_string())


def main():

    df = pd.read_csv(DATA_FILE)

    print("=" * 75)
    print("RISK LABEL CANDIDATE EVALUATION")
    print("=" * 75)

    # ---------------------------------------------------------
    # Candidate A
    #
    # HIGH   = future liquidation
    # MEDIUM = no liquidation + future failure >= 10%
    # LOW    = everything else
    # ---------------------------------------------------------

    labels_a = np.select(
        [
            df["future_liquidation_count"] >= 1,
            df["future_failed_tx_ratio"] >= 0.10,
        ],
        [
            "HIGH",
            "MEDIUM",
        ],
        default="LOW",
    )

    evaluate_candidate(
        "CANDIDATE A: Liquidation + 10% Failure",
        df,
        labels_a,
    )

    # ---------------------------------------------------------
    # Candidate B
    #
    # HIGH   = future liquidation
    # MEDIUM = no liquidation + future failure >= 20%
    # LOW    = everything else
    # ---------------------------------------------------------

    labels_b = np.select(
        [
            df["future_liquidation_count"] >= 1,
            df["future_failed_tx_ratio"] >= 0.20,
        ],
        [
            "HIGH",
            "MEDIUM",
        ],
        default="LOW",
    )

    evaluate_candidate(
        "CANDIDATE B: Liquidation + 20% Failure",
        df,
        labels_b,
    )

    # ---------------------------------------------------------
    # Candidate C
    #
    # HIGH   = 2+ future liquidations
    # MEDIUM = exactly 1 future liquidation
    # LOW    = no liquidation
    #
    # This tests whether liquidation severity alone gives
    # meaningful three-level risk.
    # ---------------------------------------------------------

    labels_c = np.select(
        [
            df["future_liquidation_count"] >= 2,
            df["future_liquidation_count"] == 1,
        ],
        [
            "HIGH",
            "MEDIUM",
        ],
        default="LOW",
    )

    evaluate_candidate(
        "CANDIDATE C: Liquidation Severity",
        df,
        labels_c,
    )

    # ---------------------------------------------------------
    # Candidate D
    #
    # HIGH:
    #   liquidation OR
    #   high future failure >= 20%
    #
    # MEDIUM:
    #   no HIGH condition AND
    #   future failure >= 10%
    #
    # LOW:
    #   everything else
    # ---------------------------------------------------------

    high_d = (
        (df["future_liquidation_count"] >= 1)
        | (df["future_failed_tx_ratio"] >= 0.20)
    )

    medium_d = (
        (~high_d)
        & (df["future_failed_tx_ratio"] >= 0.10)
    )

    labels_d = np.select(
        [
            high_d,
            medium_d,
        ],
        [
            "HIGH",
            "MEDIUM",
        ],
        default="LOW",
    )

    evaluate_candidate(
        "CANDIDATE D: Severe + Warning Failure",
        df,
        labels_d,
    )

    # ---------------------------------------------------------
    # Candidate E
    #
    # HIGH:
    #   liquidation OR severe failure
    #
    # MEDIUM:
    #   either moderate failure OR one liquidation
    #
    # LOW:
    #   otherwise
    #
    # This creates a broader warning class.
    # ---------------------------------------------------------

    high_e = (
        (df["future_liquidation_count"] >= 2)
        | (df["future_failed_tx_ratio"] >= 0.20)
    )

    medium_e = (
        (~high_e)
        & (
            (df["future_liquidation_count"] == 1)
            | (df["future_failed_tx_ratio"] >= 0.10)
        )
    )

    labels_e = np.select(
        [
            high_e,
            medium_e,
        ],
        [
            "HIGH",
            "MEDIUM",
        ],
        default="LOW",
    )

    evaluate_candidate(
        "CANDIDATE E: Graduated Adverse Behavior",
        df,
        labels_e,
    )


if __name__ == "__main__":
    main()