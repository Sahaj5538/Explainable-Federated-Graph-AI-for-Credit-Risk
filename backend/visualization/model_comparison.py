from __future__ import annotations

"""
MODEL COMPARISON CHART (report/PPT)
===================================

Bar chart of accuracy + Macro-F1 for every model (binary task),
regenerated from the saved artifacts:

    python -m backend.visualization.model_comparison

Output: reports/figures/model_comparison.png
"""

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt

from backend.evaluation.compare_models import (
    collect_binary_results,
)
from backend.model.train_binary import PROJECT_ROOT

FIGURES_DIR = (
    PROJECT_ROOT / "reports" / "figures"
)


def main():

    results = collect_binary_results()

    results = sorted(
        results,
        key=lambda m: m["macro_f1"],
        reverse=True,
    )

    names = [m["model"] for m in results]
    accuracy = [
        m["accuracy"] * 100 for m in results
    ]
    macro_f1 = [
        m["macro_f1"] * 100 for m in results
    ]

    fig, ax = plt.subplots(
        figsize=(11, 5.5),
        dpi=150,
    )

    x = range(len(names))

    width = 0.38

    colors_acc = []
    colors_f1 = []

    for name in names:

        is_gnn = "Logistic" not in name and (
            "Hist" not in name
        )

        colors_acc.append(
            "#5b8cff" if is_gnn else "#8b98b8"
        )
        colors_f1.append(
            "#8f5bff" if is_gnn else "#b9c2d4"
        )

    bars1 = ax.bar(
        [i - width / 2 for i in x],
        accuracy,
        width,
        label="Accuracy",
        color=colors_acc,
    )

    bars2 = ax.bar(
        [i + width / 2 for i in x],
        macro_f1,
        width,
        label="Macro-F1",
        color=colors_f1,
    )

    for bars in (bars1, bars2):

        for bar in bars:

            height = bar.get_height()

            ax.annotate(
                f"{height:.1f}",
                xy=(
                    bar.get_x() + bar.get_width() / 2,
                    height,
                ),
                xytext=(0, 3),
                textcoords="offset points",
                ha="center",
                fontsize=7.5,
            )

    ax.set_xticks(list(x))
    ax.set_xticklabels(
        names,
        rotation=20,
        ha="right",
        fontsize=9,
    )

    ax.set_ylabel("Score (%)")
    ax.set_ylim(0, 100)
    ax.set_title(
        "Binary liquidation-risk prediction - all models "
        "(test split)",
        fontsize=12,
        fontweight="bold",
    )

    ax.legend()
    ax.grid(
        axis="y",
        alpha=0.25,
        linestyle="--",
    )

    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    fig.tight_layout()

    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    output = FIGURES_DIR / "model_comparison.png"

    fig.savefig(output)

    print(f"Saved: {output}")


if __name__ == "__main__":
    main()
