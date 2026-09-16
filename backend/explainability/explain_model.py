from __future__ import annotations

"""
EXPLAINABLE AI - MAIN REPORT (CLI)
==================================

Runs the full XAI report for the binary liquidation-risk model:

    python -m backend.explainability.explain_model

Produces:
  1. Global feature importance (permutation)  -> printed + CSV
  2. Class feature profiles (LOW vs HIGH)     -> printed
  3. Example per-account reason codes         -> printed + JSON
"""

import json

import pandas as pd
import torch

from backend.explainability.feature_importance import (
    IMPORTANCE_CSV_PATH,
    class_feature_profiles,
    load_trained_model,
    permutation_importance,
    predict_logits,
    N_PERMUTATIONS,
)
from backend.explainability.gnn_explainer import (
    explain_account,
)
from backend.graph.build_graph import NODE_FEATURE_COLUMNS
from backend.model.train_binary import (
    PROJECT_ROOT,
    build_clean_graph,
    load_binary_data,
)


# ============================================================
# MAIN
# ============================================================

def main():

    # --------------------------------------------------------
    # Load data, graph and the trained binary model.
    # --------------------------------------------------------

    (
        transactions,
        account_features,
        protocols,
        labels,
    ) = load_binary_data()

    (
        x_dict,
        edge_index_dict,
        edge_attr_dict,
        train_mask,
        val_mask,
        test_mask,
    ) = build_clean_graph(
        transactions,
        account_features,
        protocols,
        labels,
    )

    model, checkpoint = load_trained_model()

    print()
    print("=" * 70)
    print("EXPLAINABLE AI - BINARY LIQUIDATION-RISK MODEL")
    print("=" * 70)
    print(
        f"Model: {checkpoint.get('model_type', 'sage').upper()} "
        f"(trained test acc {checkpoint.get('test_accuracy', float('nan')):.4f}, "
        f"macro F1 {checkpoint.get('macro_f1', float('nan')):.4f})"
    )

    # ========================================================
    # 1. GLOBAL FEATURE IMPORTANCE
    # ========================================================

    print()
    print("-" * 70)
    print(
        f"1. GLOBAL FEATURE IMPORTANCE "
        f"(permutation, {N_PERMUTATIONS} repeats)"
    )
    print("-" * 70)

    importance = permutation_importance(
        model,
        x_dict,
        edge_index_dict,
        edge_attr_dict,
        labels,
        test_mask,
    )

    print(
        f"Baseline test Macro-F1: "
        f"{importance['baseline_macro_f1']:.4f}"
    )
    print()

    for item in importance["features"]:

        bar = "#" * max(
            1,
            int(
                40
                * max(
                    item["importance_drop"],
                    0,
                )
                / max(
                    importance["features"][0][
                        "importance_drop"
                    ],
                    1e-9,
                )
            ),
        )

        print(
            f"{item['rank']:>2}. {item['feature']:<32} "
            f"drop {item['importance_drop']:+.4f}  {bar}"
        )

    importance_df = pd.DataFrame(
        importance["features"]
    )

    importance_df.to_csv(
        IMPORTANCE_CSV_PATH,
        index=False,
    )

    print()
    print(f"Saved: {IMPORTANCE_CSV_PATH}")

    # ========================================================
    # 2. CLASS FEATURE PROFILES
    # ========================================================

    print()
    print("-" * 70)
    print("2. CLASS FEATURE PROFILES (LOW vs HIGH RISK)")
    print("-" * 70)

    profiles = class_feature_profiles(
        account_features,
        labels,
    )

    print(
        f"{'feature':<32}"
        f"{'LOW mean':>12}"
        f"{'HIGH mean':>12}"
        f"{'HIGH/LOW':>10}"
    )

    for feature in NODE_FEATURE_COLUMNS:

        p = profiles[feature]

        print(
            f"{feature:<32}"
            f"{p['low_mean']:>12.4f}"
            f"{p['high_mean']:>12.4f}"
            f"{p['high_vs_low_ratio']:>9.1f}x"
        )

    # ========================================================
    # 3. EXAMPLE REASON CODES
    # ========================================================

    print()
    print("-" * 70)
    print(
        "3. EXAMPLE PER-ACCOUNT EXPLANATIONS "
        "(highest-confidence HIGH-RISK test accounts)"
    )
    print("-" * 70)

    logits = predict_logits(
        model,
        x_dict,
        edge_index_dict,
        edge_attr_dict,
    )

    probabilities = torch.softmax(logits, dim=1)

    test_indices = (
        torch.nonzero(test_mask, as_tuple=True)[0]
        .numpy()
    )

    high_risk_test = [
        int(i)
        for i in test_indices
        if probabilities[i, 1].item() > 0.5
    ]

    high_risk_test.sort(
        key=lambda i: probabilities[i, 1].item(),
        reverse=True,
    )

    samples = []

    for account_index in high_risk_test[:3]:

        explanation = explain_account(
            account_index,
            model=model,
            x_dict=x_dict,
            edge_index_dict=edge_index_dict,
            edge_attr_dict=edge_attr_dict,
            account_features=account_features,
            labels=labels,
            importance=importance,
        )

        samples.append(explanation)

        print()
        print(
            f"Account id {explanation['account_id']} "
            f"-> {explanation['prediction_label']} "
            f"(p={explanation['probability']:.2f})"
        )
        print("Top reasons:")

        for reason in explanation["reasons"]:

            print(
                f"  - {reason['feature']:<32} "
                f"= {reason['value']:.4f}  "
                f"(z = {reason['z_vs_low_risk']:+.1f} "
                f"vs low-risk avg)"
            )

    sample_path = (
        PROJECT_ROOT
        / "datasets"
        / "processed"
        / "explanations_sample.json"
    )

    with open(sample_path, "w") as f:
        json.dump(samples, f, indent=2)

    print()
    print(f"Saved: {sample_path}")
    print()
    print("XAI ANALYSIS COMPLETE")


if __name__ == "__main__":
    main()
