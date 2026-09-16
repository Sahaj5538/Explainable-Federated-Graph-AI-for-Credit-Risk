from __future__ import annotations

"""
FEATURE IMPORTANCE CHART (report/PPT)
=====================================

Horizontal bar chart of the global permutation importance for the
binary liquidation-risk model:

    python -m backend.visualization.feature_plots

Output: reports/figures/feature_importance.png
"""

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import pandas as pd

from backend.model.train_binary import PROJECT_ROOT

IMPORTANCE_CSV = (
    PROJECT_ROOT
    / "datasets"
    / "processed"
    / "feature_importance_binary.csv"
)

FIGURES_DIR = (
    PROJECT_ROOT / "reports" / "figures"
)


def main():

    df = pd.read_csv(IMPORTANCE_CSV)

    df = df.sort_values("importance_drop")

    fig, ax = plt.subplots(
        figsize=(9, 6),
        dpi=150,
    )

    colors = [
        "#ff5b6e"
        if value > 0
        else "#8b98b8"
        for value in df["importance_drop"]
    ]

    ax.barh(
        df["feature"],
        df["importance_drop"],
        color=colors,
    )

    ax.set_xlabel(
        "Test Macro-F1 drop when the feature is permuted"
    )
    ax.set_title(
        "Global feature importance - binary liquidation-risk model "
        "(permutation)",
        fontsize=12,
        fontweight="bold",
    )

    ax.grid(
        axis="x",
        alpha=0.25,
        linestyle="--",
    )

    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    fig.tight_layout()

    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    output = FIGURES_DIR / "feature_importance.png"

    fig.savefig(output)

    print(f"Saved: {output}")


if __name__ == "__main__":
    main()
