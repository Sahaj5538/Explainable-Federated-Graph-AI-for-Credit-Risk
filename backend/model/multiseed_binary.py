from __future__ import annotations

"""
MULTI-SEED ROBUSTNESS CHECK - BINARY LIQUIDATION-RISK TASK
===========================================================

Purpose
-------
The single-run comparison (train_binary.py, seed 42) showed
GraphSAGE as the best test model. However, all models were
trained exactly once, and on a small test set (152 accounts)
single-run differences of 1-2 points can be checkpoint noise.

This script re-trains every GNN architecture with MULTIPLE
seeds while keeping everything else fixed:

  * same frozen dataset
  * same observation-window graph
  * same train/validation/test split
    (seed 42 inside build_clean_graph -> identical masks)
  * same hyperparameters

Only the model weight initialisation and the dropout draws
change per seed. It reports mean +/- std of accuracy and
macro-F1 per architecture, so we can state whether the
single-run results are stable or lucky.

IMPORTANT
---------
  * This script does NOT save any models. The frozen seed-42
    artifacts in saved_models/ remain untouched.
  * The seed-42 rows should reproduce the frozen train_binary
    results exactly (same machine, same seed, same data).
  * Tabular baselines are deterministic (same data, same
    split); they are trained once here for reference.
"""

import copy

import numpy as np
import torch
import torch.nn as nn

from sklearn.metrics import (
    accuracy_score,
    f1_score,
    recall_score,
)

from backend.model.gnn_model import HeterogeneousModel
from backend.model.train_binary import (
    DEVICE,
    DROPOUT,
    EPOCHS,
    HEADS,
    HIDDEN_CHANNELS,
    LEARNING_RATE,
    MODELS,
    NUM_CLASSES,
    PATIENCE,
    WEIGHT_DECAY,
    build_clean_graph,
    load_binary_data,
    train_tabular_baselines,
)


# ============================================================
# CONFIGURATION
# ============================================================

SEEDS = [42, 7, 123]

DISPLAY_NAMES = {
    "gcn": "GCN",
    "sage": "GraphSAGE",
    "gat": "GAT",
    "transformer": "Graph Transformer",
}


# ============================================================
# TRAIN ONE ARCHITECTURE WITH ONE SEED
# ============================================================

def train_one(
    model_type,
    x_dict,
    edge_index_dict,
    edge_attr_dict,
    labels,
    train_mask,
    val_mask,
    test_mask,
    seed,
):

    # --------------------------------------------------------
    # Seed controls weight initialisation and dropout draws.
    # The split is NOT re-seeded here - it stays identical
    # across seeds (created once with seed 42 in
    # build_clean_graph).
    # --------------------------------------------------------

    torch.manual_seed(seed)
    np.random.seed(seed)

    display_name = DISPLAY_NAMES.get(
        model_type,
        model_type,
    )

    model = HeterogeneousModel(
        model_type=model_type,
        hidden_channels=HIDDEN_CHANNELS,
        num_classes=NUM_CLASSES,
        heads=HEADS,
        dropout=DROPOUT,
    ).to(DEVICE)

    # --------------------------------------------------------
    # Class-weighted loss (same as train_binary.py).
    # --------------------------------------------------------

    class_counts = torch.bincount(
        labels[train_mask],
        minlength=NUM_CLASSES,
    )

    class_weights = (
        class_counts.sum().float()
        / (NUM_CLASSES * class_counts.float())
    ).to(DEVICE)

    criterion = nn.CrossEntropyLoss(
        weight=class_weights,
    )

    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=LEARNING_RATE,
        weight_decay=WEIGHT_DECAY,
    )

    # --------------------------------------------------------
    # Training loop with early stopping on validation
    # macro-F1 (identical logic to train_binary.py).
    # --------------------------------------------------------

    best_val_score = -1.0
    best_state = None
    bad_epochs = 0

    for epoch in range(1, EPOCHS + 1):

        model.train()
        optimizer.zero_grad()

        logits = model(
            x_dict,
            edge_index_dict,
            edge_attr_dict,
        )

        loss = criterion(
            logits[train_mask],
            labels[train_mask],
        )

        loss.backward()
        optimizer.step()

        model.eval()

        with torch.no_grad():

            val_predictions = (
                model(
                    x_dict,
                    edge_index_dict,
                    edge_attr_dict,
                )[val_mask]
                .argmax(dim=1)
            )

            val_score = f1_score(
                labels[val_mask].numpy(),
                val_predictions.numpy(),
                average="macro",
                zero_division=0,
            )

        if val_score > best_val_score:

            best_val_score = val_score
            best_state = copy.deepcopy(
                model.state_dict()
            )

            bad_epochs = 0

        else:

            bad_epochs += 1

            if bad_epochs >= PATIENCE:
                break

        if epoch % 100 == 0:
            print(
                f"    epoch {epoch:03d} | "
                f"loss {loss.item():.4f} | "
                f"val macro F1 {val_score:.4f}"
            )

    # --------------------------------------------------------
    # Evaluate the best checkpoint on the test split.
    # --------------------------------------------------------

    model.load_state_dict(best_state)

    model.eval()

    with torch.no_grad():

        predictions = (
            model(
                x_dict,
                edge_index_dict,
                edge_attr_dict,
            )[test_mask]
            .argmax(dim=1)
            .numpy()
        )

    y_true = labels[test_mask].numpy()

    accuracy = accuracy_score(
        y_true,
        predictions,
    )

    macro_f1 = f1_score(
        y_true,
        predictions,
        average="macro",
        zero_division=0,
    )

    high_risk_recall = recall_score(
        y_true,
        predictions,
        labels=[1],
        average="macro",
        zero_division=0,
    )

    return {
        "model": display_name,
        "seed": seed,
        "accuracy": accuracy,
        "macro_f1": macro_f1,
        "high_risk_recall": high_risk_recall,
        "best_val_macro_f1": best_val_score,
    }


# ============================================================
# MAIN
# ============================================================

def main():

    # --------------------------------------------------------
    # Load data and build the graph ONCE.
    #
    # The split is created inside build_clean_graph with
    # random_state=42, so every seed below trains and is
    # evaluated on exactly the same nodes.
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

    # --------------------------------------------------------
    # Train every architecture with every seed.
    # --------------------------------------------------------

    all_runs = []

    print()
    print("=" * 70)
    print(
        f"MULTI-SEED RUNS: "
        f"{len(MODELS)} architectures x {len(SEEDS)} seeds "
        f"= {len(MODELS) * len(SEEDS)} trainings"
    )
    print("=" * 70)

    for model_type in MODELS:

        for seed in SEEDS:

            display_name = DISPLAY_NAMES.get(
                model_type,
                model_type,
            )

            print()
            print(
                f"-> {display_name} | seed {seed}"
            )

            try:

                result = train_one(
                    model_type,
                    x_dict,
                    edge_index_dict,
                    edge_attr_dict,
                    labels,
                    train_mask,
                    val_mask,
                    test_mask,
                    seed,
                )

                all_runs.append(result)

                print(
                    f"   acc {result['accuracy']:.4f} | "
                    f"macro F1 {result['macro_f1']:.4f} | "
                    f"HR recall {result['high_risk_recall']:.4f}"
                )

            except Exception as error:

                print(
                    f"   ERROR: "
                    f"{type(error).__name__}: {error}"
                )

    # --------------------------------------------------------
    # Deterministic tabular reference (same data + split).
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("TABULAR BASELINES (deterministic reference)")
    print("=" * 70)

    tabular_results = train_tabular_baselines(
        account_features,
        labels,
        train_mask,
        test_mask,
    )

    # ========================================================
    # PER-SEED DETAIL TABLE
    # ========================================================

    print()
    print()
    print("=" * 70)
    print("PER-SEED RESULTS (binary task)")
    print("=" * 70)

    print(
        f"{'Architecture':<22}"
        f"{'Seed':>6}"
        f"{'Accuracy':>10}"
        f"{'Macro F1':>10}"
        f"{'HR Recall':>11}"
    )

    print("-" * 70)

    for run in all_runs:

        print(
            f"{run['model']:<22}"
            f"{run['seed']:>6}"
            f"{run['accuracy']:>10.4f}"
            f"{run['macro_f1']:>10.4f}"
            f"{run['high_risk_recall']:>11.4f}"
        )

    # ========================================================
    # AGGREGATED TABLE (mean +/- std over seeds)
    # ========================================================

    print()
    print("=" * 70)
    print(f"AGGREGATED OVER {len(SEEDS)} SEEDS (mean +/- std)")
    print("=" * 70)

    print(
        f"{'Architecture':<22}"
        f"{'Accuracy':>18}"
        f"{'Macro F1':>18}"
    )

    print("-" * 70)

    aggregated = {}

    for model_type in MODELS:

        display_name = DISPLAY_NAMES.get(
            model_type,
            model_type,
        )

        runs = [
            run
            for run in all_runs
            if run["model"] == display_name
        ]

        if not runs:
            continue

        accuracies = [
            run["accuracy"]
            for run in runs
        ]

        macro_f1s = [
            run["macro_f1"]
            for run in runs
        ]

        acc_mean = float(
            np.mean(accuracies)
        )

        acc_std = float(
            np.std(
                accuracies,
                ddof=1,
            )
        )

        f1_mean = float(
            np.mean(macro_f1s)
        )

        f1_std = float(
            np.std(
                macro_f1s,
                ddof=1,
            )
        )

        aggregated[display_name] = {
            "acc_mean": acc_mean,
            "acc_std": acc_std,
            "f1_mean": f1_mean,
            "f1_std": f1_std,
            "runs": runs,
        }

        print(
            f"{display_name:<22}"
            f"{acc_mean:>12.4f} ±{acc_std:>5.4f}"
            f"{f1_mean:>12.4f} ±{f1_std:>5.4f}"
        )

    print("-" * 70)

    for result in tabular_results:

        print(
            f"{result['model'] + ' (tabular)':<22}"
            f"{result['accuracy']:>12.4f}     "
            f"{result['macro_f1']:>12.4f}"
        )

    # ========================================================
    # HONEST VERDICT
    # ========================================================

    print()
    print("=" * 70)
    print("VERDICT")
    print("=" * 70)

    if aggregated:

        best_f1_name = max(
            aggregated,
            key=lambda name: (
                aggregated[name]["f1_mean"]
            ),
        )

        best_acc_name = max(
            aggregated,
            key=lambda name: (
                aggregated[name]["acc_mean"]
            ),
        )

        print(
            f"Best mean accuracy:  {best_acc_name} "
            f"({aggregated[best_acc_name]['acc_mean']:.4f} "
            f"± {aggregated[best_acc_name]['acc_std']:.4f})"
        )

        print(
            f"Best mean Macro F1:  {best_f1_name} "
            f"({aggregated[best_f1_name]['f1_mean']:.4f} "
            f"± {aggregated[best_f1_name]['f1_std']:.4f})"
        )

        best_tabular = max(
            tabular_results,
            key=lambda r: r["macro_f1"],
        )

        print()
        print(
            f"Seeds beating best tabular "
            f"({best_tabular['model']}: "
            f"macro F1 {best_tabular['macro_f1']:.4f}):"
        )

        for name, stats in aggregated.items():

            wins = sum(
                1
                for run in stats["runs"]
                if run["macro_f1"]
                > best_tabular["macro_f1"]
            )

            print(
                f"  {name:<22} "
                f"{wins}/{len(stats['runs'])} seeds"
            )

        # ----------------------------------------------------
        # Family-level comparison (all GNN runs vs tabular).
        # ----------------------------------------------------

        gnn_f1_all = [
            run["macro_f1"]
            for run in all_runs
        ]

        gnn_acc_all = [
            run["accuracy"]
            for run in all_runs
        ]

        tab_f1_mean = float(
            np.mean(
                [
                    r["macro_f1"]
                    for r in tabular_results
                ]
            )
        )

        tab_acc_mean = float(
            np.mean(
                [
                    r["accuracy"]
                    for r in tabular_results
                ]
            )
        )

        print()
        print(
            f"GNN family (all {len(gnn_f1_all)} runs): "
            f"mean acc {np.mean(gnn_acc_all):.4f}, "
            f"mean macro F1 {np.mean(gnn_f1_all):.4f}"
        )

        print(
            f"Tabular family:               "
            f"mean acc {tab_acc_mean:.4f}, "
            f"mean macro F1 {tab_f1_mean:.4f}"
        )

        if np.mean(gnn_f1_all) > tab_f1_mean:
            print()
            print(
                "=> GNN family outperforms the tabular "
                "family on average across seeds."
            )
        else:
            print()
            print(
                "=> Tabular family outperforms the GNN "
                "family on average across seeds."
            )

    print()
    print("No models were saved (robustness check only).")
    print("MULTI-SEED CHECK COMPLETE")


if __name__ == "__main__":
    main()
