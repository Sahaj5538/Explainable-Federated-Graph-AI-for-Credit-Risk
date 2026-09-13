from pathlib import Path

import numpy as np
import pandas as pd

from sklearn.feature_selection import f_classif, mutual_info_classif


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

PROCESSED_DIR = PROJECT_ROOT / "datasets" / "processed"

DATASET_PATH = PROCESSED_DIR / "account_risk_dataset.csv"


# ============================================================
# LOAD DATA
# ============================================================

print("=" * 70)
print("FEATURE SEPARABILITY ANALYSIS")
print("=" * 70)

df = pd.read_csv(DATASET_PATH)

print(f"\nDataset shape: {df.shape}")


# ============================================================
# CLASS DISTRIBUTION
# ============================================================

print("\nClass distribution:")
print(df["risk_label"].value_counts())


# ============================================================
# FEATURE COLUMNS
# ============================================================

excluded_columns = [
    "account_id",
    "risk_label",
    "risk_label_id",
    "future_liquidation_count",
    "future_borrow_count",
    "future_repay_count",
    "future_failed_tx_ratio",
]

feature_columns = [
    column
    for column in df.columns
    if column not in excluded_columns
]

numeric_features = (
    df[feature_columns]
    .select_dtypes(include=[np.number])
    .columns
    .tolist()
)


# ============================================================
# INVALID VALUES
# ============================================================

nan_count = df[numeric_features].isna().sum().sum()

inf_count = np.isinf(
    df[numeric_features].to_numpy(dtype=float)
).sum()

print("\nInvalid values:")
print(f"NaN: {nan_count}")
print(f"Inf: {inf_count}")


# ============================================================
# CLASS-WISE MEDIANS
# ============================================================

print("\n" + "=" * 70)
print("CLASS-WISE MEDIANS")
print("=" * 70)

median_table = (
    df.groupby("risk_label")[numeric_features]
    .median()
    .T
)

print(median_table.to_string())


# ============================================================
# CLASS-WISE MEANS
# ============================================================

print("\n" + "=" * 70)
print("CLASS-WISE MEANS")
print("=" * 70)

mean_table = (
    df.groupby("risk_label")[numeric_features]
    .mean()
    .T
)

print(mean_table.to_string())


# ============================================================
# PREPARE DATA FOR FEATURE SELECTION
# ============================================================

label_mapping = {
    "LOW": 0,
    "MEDIUM": 1,
    "HIGH": 2,
}

y = df["risk_label"].map(label_mapping)

X = df[numeric_features].copy()

X = X.replace([np.inf, -np.inf], np.nan)

X = X.fillna(0)


# ============================================================
# ANOVA F-SCORE
# ============================================================

print("\n" + "=" * 70)
print("TOP FEATURES BY ANOVA F-SCORE")
print("=" * 70)

f_scores, p_values = f_classif(
    X,
    y,
)

anova_results = pd.DataFrame(
    {
        "feature": numeric_features,
        "f_score": f_scores,
        "p_value": p_values,
    }
)

anova_results = (
    anova_results
    .sort_values(
        "f_score",
        ascending=False,
    )
    .reset_index(drop=True)
)

print(
    anova_results
    .head(15)
    .to_string(index=False)
)


# ============================================================
# MUTUAL INFORMATION
# ============================================================

print("\n" + "=" * 70)
print("TOP FEATURES BY MUTUAL INFORMATION")
print("=" * 70)

mi_scores = mutual_info_classif(
    X,
    y,
    random_state=42,
)

mi_results = pd.DataFrame(
    {
        "feature": numeric_features,
        "mutual_information": mi_scores,
    }
)

mi_results = (
    mi_results
    .sort_values(
        "mutual_information",
        ascending=False,
    )
    .reset_index(drop=True)
)

print(
    mi_results
    .head(15)
    .to_string(index=False)
)


# ============================================================
# SAVE FEATURE SEPARABILITY RESULTS
# ============================================================

separability_results = anova_results.merge(
    mi_results,
    on="feature",
    how="outer",
)

separability_path = (
    PROCESSED_DIR / "feature_separability.csv"
)

separability_results.to_csv(
    separability_path,
    index=False,
)

print(f"\nSaved: {separability_path}")


# ============================================================
# FEATURE CORRELATION ANALYSIS
# ============================================================

print("\n" + "=" * 70)
print("FEATURE CORRELATION ANALYSIS")
print("=" * 70)


# Shortlisted features based on the previous
# ANOVA and Mutual Information analysis.

selected_features = [
    "historical_liquidation_count",
    "borrow_count",
    "borrow_volume",
    "liquidation_rate",
    "borrow_intensity",
    "unique_counterparties",
    "deposit_volume",
    "borrow_to_repay_ratio",
    "repayment_ratio",
    "repay_count",
    "total_volume",
]


# ============================================================
# CHECK FEATURES
# ============================================================

missing_features = [
    feature
    for feature in selected_features
    if feature not in df.columns
]

if missing_features:

    print("\nERROR: Missing selected features:")

    for feature in missing_features:
        print(f"  - {feature}")

else:

    # --------------------------------------------------------
    # Correlation matrix
    # --------------------------------------------------------

    correlation_matrix = (
        df[selected_features]
        .corr()
    )

    print("\nCorrelation matrix:")

    print(
        correlation_matrix
        .round(3)
        .to_string()
    )


    # --------------------------------------------------------
    # Find highly correlated pairs
    # --------------------------------------------------------

    print("\n" + "-" * 70)
    print("HIGH CORRELATION PAIRS (|r| >= 0.80)")
    print("-" * 70)

    high_corr_pairs = []

    for i in range(len(selected_features)):

        for j in range(i + 1, len(selected_features)):

            feature_a = selected_features[i]

            feature_b = selected_features[j]

            correlation = correlation_matrix.loc[
                feature_a,
                feature_b,
            ]

            if abs(correlation) >= 0.80:

                high_corr_pairs.append(
                    {
                        "feature_1": feature_a,
                        "feature_2": feature_b,
                        "correlation": correlation,
                    }
                )

                print(
                    f"{feature_a:35s} <-> "
                    f"{feature_b:35s} "
                    f"r = {correlation:.3f}"
                )

    if not high_corr_pairs:
        print("No highly correlated feature pairs found.")


    # --------------------------------------------------------
    # Save correlation results
    # --------------------------------------------------------

    correlation_df = pd.DataFrame(
        high_corr_pairs
    )

    correlation_path = (
        PROCESSED_DIR / "feature_correlations.csv"
    )

    correlation_df.to_csv(
        correlation_path,
        index=False,
    )

    print(f"\nSaved: {correlation_path}")


# ============================================================
# COMPLETE
# ============================================================

print("\n" + "=" * 70)
print("Analysis complete.")
print("=" * 70)