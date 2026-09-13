from pathlib import Path

import numpy as np
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_FILE = PROJECT_ROOT / "datasets" / "processed" / "account_features.csv"


def percentile_score(series):
    """
    Convert a feature into a 0-1 percentile-based risk score.

    Higher values = higher risk.
    """
    return series.rank(pct=True).fillna(0)


def inverse_percentile_score(series):
    """
    Higher values = lower risk.
    Therefore invert the percentile.
    """
    return 1.0 - percentile_score(series)


def main():

    print("=" * 75)
    print("DEFI RISK COMPONENT ANALYSIS")
    print("=" * 75)

    df = pd.read_csv(DATA_FILE)

    print("\nAccounts:", len(df))

    # ---------------------------------------------------------
    # 1. LIQUIDATION RISK
    # ---------------------------------------------------------

    liquidation_history = percentile_score(
        df["historical_liquidation_count"]
    )

    liquidation_rate = percentile_score(
        df["liquidation_rate"]
    )

    liquidation_risk = (
        0.60 * liquidation_history
        + 0.40 * liquidation_rate
    )

    # ---------------------------------------------------------
    # 2. BORROWING RISK
    # ---------------------------------------------------------

    borrow_intensity = percentile_score(
        df["borrow_intensity"]
    )

    borrow_volume = percentile_score(
        df["borrow_volume"]
    )

    borrow_repay_ratio = percentile_score(
        df["borrow_to_repay_ratio"]
    )

    borrowing_risk = (
        0.40 * borrow_intensity
        + 0.30 * borrow_volume
        + 0.30 * borrow_repay_ratio
    )

    # ---------------------------------------------------------
    # 3. REPAYMENT RISK
    # ---------------------------------------------------------

    repayment_ratio_risk = inverse_percentile_score(
        df["repayment_ratio"]
    )

    repay_count_risk = inverse_percentile_score(
        df["repay_count"]
    )

    repay_volume_risk = inverse_percentile_score(
        df["repay_volume"]
    )

    repayment_risk = (
        0.50 * repayment_ratio_risk
        + 0.25 * repay_count_risk
        + 0.25 * repay_volume_risk
    )

    # ---------------------------------------------------------
    # 4. TRANSACTION RISK
    # ---------------------------------------------------------

    failed_ratio_risk = percentile_score(
        df["failed_tx_ratio"]
    )

    failed_count_risk = percentile_score(
        df["failed_transactions"]
    )

    transaction_risk = (
        0.70 * failed_ratio_risk
        + 0.30 * failed_count_risk
    )

    # ---------------------------------------------------------
    # 5. CAPITAL-FLOW RISK
    # ---------------------------------------------------------

    withdrawal_ratio_risk = percentile_score(
        df["withdrawal_to_deposit_ratio"]
    )

    negative_flow = (-df["net_deposit_flow"]).clip(lower=0)

    negative_flow_risk = percentile_score(
        negative_flow
    )

    capital_flow_risk = (
        0.60 * withdrawal_ratio_risk
        + 0.40 * negative_flow_risk
    )

    # ---------------------------------------------------------
    # OVERALL RISK SCORE
    # ---------------------------------------------------------

    overall_risk = (
        0.30 * liquidation_risk
        + 0.25 * borrowing_risk
        + 0.20 * repayment_risk
        + 0.10 * transaction_risk
        + 0.15 * capital_flow_risk
    )

    # ---------------------------------------------------------
    # Create result dataframe
    # ---------------------------------------------------------

    result = pd.DataFrame({
        "account_id": df["account_id"],

        "liquidation_risk": liquidation_risk,
        "borrowing_risk": borrowing_risk,
        "repayment_risk": repayment_risk,
        "transaction_risk": transaction_risk,
        "capital_flow_risk": capital_flow_risk,

        "overall_risk": overall_risk,
    })

    # ---------------------------------------------------------
    # Print distributions
    # ---------------------------------------------------------

    print("\n" + "=" * 75)
    print("RISK COMPONENT STATISTICS")
    print("=" * 75)

    print(
        result[
            [
                "liquidation_risk",
                "borrowing_risk",
                "repayment_risk",
                "transaction_risk",
                "capital_flow_risk",
                "overall_risk",
            ]
        ].describe().round(4).to_string()
    )

    # ---------------------------------------------------------
    # Percentile bands
    # ---------------------------------------------------------

    print("\n" + "=" * 75)
    print("OVERALL RISK PERCENTILES")
    print("=" * 75)

    print(
        result["overall_risk"]
        .quantile(
            [0, .10, .20, .25, .40, .50, .60, .70, .75, .80, .90, .95, 1.0]
        )
        .round(4)
        .to_string()
    )

    # ---------------------------------------------------------
    # Highest-risk wallets
    # ---------------------------------------------------------

    print("\n" + "=" * 75)
    print("TOP 20 HIGHEST-RISK ACCOUNTS")
    print("=" * 75)

    print(
        result
        .sort_values("overall_risk", ascending=False)
        .head(20)
        .round(4)
        .to_string(index=False)
    )

    # ---------------------------------------------------------
    # Save
    # ---------------------------------------------------------

    output_file = (
        PROJECT_ROOT
        / "datasets"
        / "processed"
        / "risk_components.csv"
    )

    result.to_csv(output_file, index=False)

    print("\nSaved:", output_file)
    print("\nAnalysis complete.")


if __name__ == "__main__":
    main()