from __future__ import annotations

"""
RISK DISTRIBUTION CHART (report/PPT)
====================================

Class distribution of the frozen dataset - 3-class risk level and
binary liquidation risk:

    python -m backend.visualization.risk_distribution

Output: reports/figures/risk_distribution.png
"""

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import pandas as pd

from backend.model.train_binary import PROJECT_ROOT

RISK_DATASET_PATH = (
    PROJECT_ROOT
    / "datasets"
    / "processed"
    / "account_risk_dataset.csv"
)

FIGURES_DIR = (
    PROJECT_ROOT / "reports" / "figures"
)


def main():

    df = pd.read_csv(RISK_DATASET_PATH)

    three_class = (
        df["risk_label"].value_counts()
        .reindex(["LOW", "MEDIUM", "HIGH"])
    )

    binary = (
        (df["future_liquidation_count"] >= 1)
        .map({True: "HIGH RISK", False: "LOW RISK"})
        .value_counts()
        .reindex(["LOW RISK", "HIGH RISK"])
    )

    fig, axes = plt.subplots(
        1,
        2,
        figsize=(10, 4.2),
        dpi=150,
    )

    # --------------------------------------------------------
    # 3-class distribution.
    # --------------------------------------------------------

    axes[0].bar(
        three_class.index,
        three_class.values,
        color=[
            "#2ecc71",
            "#ffb454",
            "#ff5b6e",
        ],
    )

    for index, value in enumerate(three_class.values):

        axes[0].annotate(
            f"{value}",
            xy=(index, value),
            xytext=(0, 3),
            textcoords="offset points",
            ha="center",
            fontsize=10,
            fontweight="bold",
        )

    axes[0].set_title(
        "3-class risk level (frozen dataset)",
        fontweight="bold",
    )
    axes[0].set_ylabel("Accounts")

    # --------------------------------------------------------
    # Binary distribution.
    # --------------------------------------------------------

    axes[1].bar(
        binary.index,
        binary.values,
        color=["#2ecc71", "#ff5b6e"],
    )

    for index, value in enumerate(binary.values):

        axes[1].annotate(
            f"{value}",
            xy=(index, value),
            xytext=(0, 3),
            textcoords="offset points",
            ha="center",
            fontsize=10,
            fontweight="bold",
        )

    axes[1].set_title(
        "Binary liquidation risk (frozen dataset)",
        fontweight="bold",
    )

    for ax in axes:

        ax.grid(
            axis="y",
            alpha=0.25,
            linestyle="--",
        )
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)

    fig.tight_layout()

    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    output = FIGURES_DIR / "risk_distribution.png"

    fig.savefig(output)

    print(f"Saved: {output}")


if __name__ == "__main__":
    main()
