from __future__ import annotations

"""
COMPARE MODELS - REGENERATE THE RESULTS TABLES
==============================================

Loads every saved checkpoint in backend/model/saved_models/ and
re-evaluates it on the held-out test split, producing the final
comparison tables (binary liquidation risk + 3-class risk level)
from the actual artifacts - the numbers in the report can always
be reproduced with one command:

    python -m backend.evaluation.compare_models

Also used by backend/visualization/model_comparison.py.
"""

import torch

from backend.evaluation.metrics import (
    compute_classification_metrics,
)
from backend.model.gnn_model import HeterogeneousModel
from backend.model.train_binary import (
    MODELS,
    PROJECT_ROOT,
    build_clean_graph,
    load_binary_data,
    train_tabular_baselines,
)
from backend.explainability.feature_importance import (
    predict_logits,
)

SAVED_MODELS_DIR = (
    PROJECT_ROOT
    / "backend"
    / "model"
    / "saved_models"
)

DISPLAY_NAMES = {
    "gcn": "GCN",
    "sage": "GraphSAGE",
    "gat": "GAT",
    "transformer": "Graph Transformer",
}


# ============================================================
# MODEL LOADING
# ============================================================

def load_checkpoint(path):

    checkpoint = torch.load(
        path,
        map_location="cpu",
        weights_only=False,
    )

    model = HeterogeneousModel(
        model_type=checkpoint.get("model_type", "sage"),
        hidden_channels=checkpoint.get(
            "hidden_channels",
            32,
        ),
        num_classes=checkpoint.get("num_classes", 2),
        heads=checkpoint.get("heads", 4),
        dropout=checkpoint.get("dropout", 0.25),
    )

    model.load_state_dict(
        checkpoint["model_state_dict"]
    )

    model.eval()

    return model, checkpoint


# ============================================================
# BINARY TASK
# ============================================================

def collect_binary_results():

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

    y_true = labels[test_mask].numpy()

    results = []

    # --------------------------------------------------------
    # GNN checkpoints (including the federated one).
    # --------------------------------------------------------

    candidates = [
        (f"{m}_binary_model.pt", DISPLAY_NAMES[m])
        for m in MODELS
    ]

    federated_path = (
        SAVED_MODELS_DIR / "sage_binary_federated_model.pt"
    )

    if federated_path.exists():

        candidates.append(
            (
                "sage_binary_federated_model.pt",
                "GraphSAGE (federated)",
            )
        )

    for filename, display_name in candidates:

        path = SAVED_MODELS_DIR / filename

        if not path.exists():
            continue

        try:

            model, _ = load_checkpoint(path)

            logits = predict_logits(
                model,
                x_dict,
                edge_index_dict,
                edge_attr_dict,
            )

            y_pred = (
                logits[test_mask].argmax(dim=1).numpy()
            )

            metrics = compute_classification_metrics(
                y_true,
                y_pred,
                positive_label=1,
            )

            metrics["model"] = display_name

            results.append(metrics)

        except Exception as error:

            print(
                f"  (skipped {filename}: "
                f"{type(error).__name__}: {error})"
            )

    # --------------------------------------------------------
    # Tabular baselines (deterministic) - reuse the official
    # implementation so the numbers match exactly.
    # --------------------------------------------------------

    tabular = train_tabular_baselines(
        account_features,
        labels,
        train_mask,
        test_mask,
    )

    for item in tabular:

        results.append(
            {
                "model": item["model"],
                "accuracy": item["accuracy"],
                "macro_f1": item["macro_f1"],
                "positive_recall": item[
                    "high_risk_recall"
                ],
                "positive_f1": None,
            }
        )

    return results


# ============================================================
# 3-CLASS TASK
# ============================================================

def collect_3class_results():

    import pandas as pd

    from backend.model.train_binary import (
        FEATURES_PATH,
        PROTOCOLS_PATH,
        RISK_DATASET_PATH,
        TRANSACTIONS_PATH,
    )

    transactions = pd.read_csv(
        TRANSACTIONS_PATH,
        parse_dates=["timestamp"],
    )

    account_features = pd.read_csv(FEATURES_PATH)

    protocols = pd.read_csv(PROTOCOLS_PATH)

    risk_dataset = pd.read_csv(RISK_DATASET_PATH)

    # --------------------------------------------------------
    # 3-class labels aligned to account_features.csv row order
    # (= graph node order).
    # --------------------------------------------------------

    label_map = {
        account_id: label
        for account_id, label in zip(
            risk_dataset["account_id"],
            risk_dataset["risk_label"],
        )
    }

    class_map = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}

    y = (
        account_features["account_id"]
        .map(label_map)
        .map(class_map)
        .astype("int64")
        .values
    )

    labels = torch.tensor(y, dtype=torch.long)

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

    y_true = labels[test_mask].numpy()

    results = []

    for model_key, display_name in DISPLAY_NAMES.items():

        path = SAVED_MODELS_DIR / f"{model_key}_model.pt"

        if not path.exists():
            continue

        try:

            model, _ = load_checkpoint(path)

            logits = predict_logits(
                model,
                x_dict,
                edge_index_dict,
                edge_attr_dict,
            )

            y_pred = (
                logits[test_mask].argmax(dim=1).numpy()
            )

            metrics = compute_classification_metrics(
                y_true,
                y_pred,
                positive_label=2,
            )

            metrics["model"] = display_name

            results.append(metrics)

        except Exception as error:

            print(
                f"  (skipped {path.name}: "
                f"{type(error).__name__}: {error})"
            )

    return results


# ============================================================
# PRINTING
# ============================================================

def print_table(title, results, positive="HIGH-RISK"):

    print()
    print("=" * 70)
    print(title)
    print("=" * 70)
    print(
        f"{'Model':<26}"
        f"{'Accuracy':>10}"
        f"{'Macro F1':>11}"
        f"{f'{positive} Recall':>18}"
        f"{f'{positive} F1':>14}"
    )
    print("-" * 80)

    for m in results:

        positive_f1 = m.get("positive_f1")

        if positive_f1 is None:

            print(
                f"{m['model']:<26}"
                f"{m['accuracy']:>10.4f}"
                f"{m['macro_f1']:>11.4f}"
                f"{m['positive_recall']:>18.4f}"
                f"{'-':>14}"
            )

        else:

            print(
                f"{m['model']:<26}"
                f"{m['accuracy']:>10.4f}"
                f"{m['macro_f1']:>11.4f}"
                f"{m['positive_recall']:>18.4f}"
                f"{positive_f1:>14.4f}"
            )


def main():

    binary = collect_binary_results()

    print_table(
        "BINARY LIQUIDATION RISK - ALL MODELS (test split)",
        binary,
        positive="HIGH-RISK",
    )

    three_class = collect_3class_results()

    print_table(
        "3-CLASS RISK LEVEL - ALL MODELS (test split)",
        three_class,
        positive="HIGH",
    )

    print()
    print("COMPARISON COMPLETE - numbers regenerate from saved artifacts.")


if __name__ == "__main__":
    main()
