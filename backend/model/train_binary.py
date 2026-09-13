"""
Binary liquidation-risk experiment.

Task definition
---------------
    "Will this account experience at least one LIQUIDATION
    in the future outcome window (2025-05-01 .. 2025-07-01)?"

    label 1 (HIGH RISK)  -> future_liquidation_count >= 1
    label 0 (LOW RISK)   -> future_liquidation_count == 0

Why this target is defensible
-----------------------------
* Liquidation is THE credit-loss event in DeFi lending - a
  borrower's collateral is seized because they failed to
  maintain their position. Predicting it from past behaviour
  is exactly the credit-risk question.
* The label still comes ONLY from the future window.
* Node features still come ONLY from the observation window.
* Graph edges still come ONLY from observation-window
  transactions (no temporal leakage).
* The 3-class LOW/MEDIUM/HIGH experiment remains available in
  train_all_models.py as an ablation study. Nothing there is
  changed or hidden.

This script:
  1. Builds binary labels from the (regenerated) risk dataset.
  2. Rebuilds the observation-window graph with node + edge
     normalization (train statistics only).
  3. Trains the four GNN architectures with the same fixed
     training procedure as train_all_models.py.
  4. Trains tabular baselines on the SAME 11 features and the
     SAME split, so the GNN-vs-tabular comparison is fair.
"""

import copy
import os

import numpy as np
import pandas as pd
import torch
import torch.nn as nn

from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    recall_score,
    classification_report,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from backend.model.gnn_model import HeterogeneousModel
from backend.graph.build_graph import (
    NODE_FEATURE_COLUMNS,
    OBSERVATION_END,
    build_account_edges,
    build_protocol_edges,
    build_edge_features,
    normalize_edge_features,
    create_masks,
)


# ============================================================
# PATHS
# ============================================================

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]

TRANSACTIONS_PATH = PROJECT_ROOT / "datasets" / "processed" / "transactions.csv"
FEATURES_PATH = PROJECT_ROOT / "datasets" / "processed" / "account_features.csv"
PROTOCOLS_PATH = PROJECT_ROOT / "datasets" / "processed" / "protocols.csv"
RISK_DATASET_PATH = PROJECT_ROOT / "datasets" / "processed" / "account_risk_dataset.csv"

SAVE_DIR = PROJECT_ROOT / "backend" / "model" / "saved_models"


# ============================================================
# CONFIGURATION
# ============================================================

NUM_CLASSES = 2

HIDDEN_CHANNELS = 32

LEARNING_RATE = 0.003

WEIGHT_DECAY = 5e-4

EPOCHS = 300

PATIENCE = 40

HEADS = 4

DROPOUT = 0.25

SEED = 42

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

MODELS = [
    "gcn",
    "sage",
    "gat",
    "transformer",
]


# ============================================================
# LOAD DATA + BINARY LABELS
# ============================================================

def load_binary_data():

    print("=" * 70)
    print("BINARY LIQUIDATION-RISK TASK")
    print("=" * 70)

    print(
        "Target: future_liquidation_count >= 1 "
        "in the outcome window 2025-05-01 .. 2025-07-01"
    )

    transactions = pd.read_csv(
        TRANSACTIONS_PATH,
        parse_dates=["timestamp"],
    )

    account_features = pd.read_csv(FEATURES_PATH)

    protocols = pd.read_csv(PROTOCOLS_PATH)

    risk_dataset = pd.read_csv(RISK_DATASET_PATH)

    # --------------------------------------------------------
    # Binary labels, aligned to account_features.csv row order
    # (= graph node order).
    # --------------------------------------------------------

    liquidation_counts = (
        risk_dataset[["account_id", "future_liquidation_count"]]
        .drop_duplicates("account_id")
        .set_index("account_id")["future_liquidation_count"]
    )

    y = (
        account_features["account_id"]
        .map(liquidation_counts)
        .fillna(0)
        .ge(1)
        .astype(np.int64)
        .values
    )

    labels = torch.tensor(y, dtype=torch.long)

    print(f"\nLabel distribution:")
    print(f"  LOW RISK  (0 future liquidations): {(labels == 0).sum().item()}")
    print(f"  HIGH RISK (>=1 future liquidation): {(labels == 1).sum().item()}")

    return transactions, account_features, protocols, labels


# ============================================================
# BUILD OBSERVATION-WINDOW GRAPH
# ============================================================

def build_clean_graph(transactions, account_features, protocols, labels):

    print("\n" + "=" * 70)
    print("BUILDING OBSERVATION-WINDOW GRAPH")
    print("=" * 70)

    # --------------------------------------------------------
    # Edges: observation window only (no future leakage).
    # --------------------------------------------------------

    n_all = len(transactions)

    tx_obs = transactions[
        transactions["timestamp"] < OBSERVATION_END
    ].copy()

    print(f"Transactions total: {n_all:,}")
    print(f"Used for edges (observation window): {len(tx_obs):,}")
    print(f"Excluded (future window): {n_all - len(tx_obs):,}")

    account_to_index = {
        int(a): i for i, a in enumerate(account_features["account_id"])
    }

    # --------------------------------------------------------
    # Node features: the same 11 columns, z-scored with
    # TRAIN statistics only.
    # --------------------------------------------------------

    X = (
        account_features[NODE_FEATURE_COLUMNS]
        .apply(pd.to_numeric, errors="coerce")
        .replace([np.inf, -np.inf], np.nan)
        .fillna(0)
        .to_numpy(dtype=np.float32)
    )

    x = torch.tensor(X)

    train_mask, val_mask, test_mask = create_masks(
        labels,
        random_state=SEED,
    )

    node_mean = x[train_mask].mean(dim=0, keepdim=True)
    node_std = x[train_mask].std(dim=0, keepdim=True)
    node_std[node_std < 1e-8] = 1.0

    x = (x - node_mean) / node_std

    # --------------------------------------------------------
    # Edges + edge features (normalized, train-source only).
    # --------------------------------------------------------

    account_transactions, account_edge_index = build_account_edges(
        tx_obs,
        account_to_index,
    )

    protocol_transactions, protocol_edge_index, protocol_to_index = (
        build_protocol_edges(
            tx_obs,
            account_to_index,
            protocols,
        )
    )

    account_edge_attr = build_edge_features(account_transactions)
    protocol_edge_attr = build_edge_features(protocol_transactions)

    account_edge_attr = normalize_edge_features(
        account_edge_attr,
        train_mask,
        account_edge_index[0],
    )

    protocol_edge_attr = normalize_edge_features(
        protocol_edge_attr,
        train_mask,
        protocol_edge_index[0],
    )

    protocol_x = torch.ones(
        (len(protocol_to_index), 1),
        dtype=torch.float32,
    )

    # --------------------------------------------------------
    # Assemble dictionaries for the heterogeneous model.
    # --------------------------------------------------------

    x_dict = {
        "account": x,
        "protocol": protocol_x,
    }

    edge_index_dict = {
        ("account", "transacts_with", "account"): account_edge_index,
        ("account", "rev_transacts_with", "account"): account_edge_index.flip(0),
        ("account", "interacts_with", "protocol"): protocol_edge_index,
        ("protocol", "rev_interacts_with", "account"): protocol_edge_index.flip(0),
    }

    edge_attr_dict = {
        ("account", "transacts_with", "account"): account_edge_attr,
        ("account", "rev_transacts_with", "account"): account_edge_attr.clone(),
        ("account", "interacts_with", "protocol"): protocol_edge_attr,
        ("protocol", "rev_interacts_with", "account"): protocol_edge_attr.clone(),
    }

    print(f"Account -> Account edges: {account_edge_index.shape[1]:,}")
    print(f"Account -> Protocol edges: {protocol_edge_index.shape[1]:,}")
    print(f"Train: {int(train_mask.sum())} | "
          f"Val: {int(val_mask.sum())} | Test: {int(test_mask.sum())}")

    return (
        x_dict,
        edge_index_dict,
        edge_attr_dict,
        train_mask,
        val_mask,
        test_mask,
    )


# ============================================================
# TRAIN ONE GNN
# ============================================================

def train_gnn(
    model_type,
    x_dict,
    edge_index_dict,
    edge_attr_dict,
    labels,
    train_mask,
    val_mask,
    test_mask,
):

    torch.manual_seed(SEED)
    np.random.seed(SEED)

    print("\n")
    print("=" * 70)

    display_names = {
        "gcn": "GCN",
        "sage": "GraphSAGE",
        "gat": "GAT",
        "transformer": "Graph Transformer",
    }

    display_name = display_names.get(model_type, model_type)

    print(f"TRAINING (binary): {display_name}")
    print("=" * 70)

    model = HeterogeneousModel(
        model_type=model_type,
        hidden_channels=HIDDEN_CHANNELS,
        num_classes=NUM_CLASSES,
        heads=HEADS,
        dropout=DROPOUT,
    ).to(DEVICE)

    class_counts = torch.bincount(
        labels[train_mask],
        minlength=NUM_CLASSES,
    )

    class_weights = (
        class_counts.sum().float()
        / (NUM_CLASSES * class_counts.float())
    ).to(DEVICE)

    criterion = nn.CrossEntropyLoss(weight=class_weights)

    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=LEARNING_RATE,
        weight_decay=WEIGHT_DECAY,
    )

    best_val_score = -1.0
    best_state = None
    bad_epochs = 0

    for epoch in range(1, EPOCHS + 1):

        model.train()
        optimizer.zero_grad()

        logits = model(x_dict, edge_index_dict, edge_attr_dict)

        loss = criterion(logits[train_mask], labels[train_mask])

        loss.backward()
        optimizer.step()

        model.eval()

        with torch.no_grad():

            val_predictions = (
                model(x_dict, edge_index_dict, edge_attr_dict)[val_mask]
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
            best_state = copy.deepcopy(model.state_dict())
            bad_epochs = 0

        else:

            bad_epochs += 1

            if bad_epochs >= PATIENCE:
                print(
                    f"Early stopping at epoch {epoch} "
                    f"(no improvement for {PATIENCE} epochs)"
                )
                break

        if epoch % 10 == 0:
            print(
                f"Epoch {epoch:03d} | "
                f"Loss: {loss.item():.4f} | "
                f"Val Macro F1: {val_score:.4f}"
            )

    model.load_state_dict(best_state)

    model.eval()

    with torch.no_grad():

        predictions = (
            model(x_dict, edge_index_dict, edge_attr_dict)[test_mask]
            .argmax(dim=1)
            .numpy()
        )

    y_true = labels[test_mask].numpy()

    accuracy = accuracy_score(y_true, predictions)
    macro_f1 = f1_score(y_true, predictions, average="macro", zero_division=0)
    macro_recall = recall_score(y_true, predictions, average="macro", zero_division=0)

    high_risk_recall = recall_score(
        y_true, predictions, labels=[1], average="macro", zero_division=0
    )

    print("\n" + "-" * 70)
    print(f"{display_name} RESULTS (binary)")
    print("-" * 70)
    print(f"Best Validation Macro F1: {best_val_score:.4f}")
    print(f"Test Accuracy:            {accuracy:.4f}")
    print(f"Macro Recall:             {macro_recall:.4f}")
    print(f"Macro F1:                 {macro_f1:.4f}")
    print(f"HIGH-RISK Recall:         {high_risk_recall:.4f}")

    print("\nClassification Report:")
    print(
        classification_report(
            y_true,
            predictions,
            target_names=["LOW RISK", "HIGH RISK"],
            zero_division=0,
        )
    )

    model_path = SAVE_DIR / f"{model_type}_binary_model.pt"

    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "model_type": model_type,
            "task": "binary_liquidation",
            "hidden_channels": HIDDEN_CHANNELS,
            "num_classes": NUM_CLASSES,
            "heads": HEADS,
            "dropout": DROPOUT,
            "test_accuracy": accuracy,
            "macro_f1": macro_f1,
            "high_risk_recall": high_risk_recall,
        },
        model_path,
    )

    return {
        "model": display_name,
        "accuracy": accuracy,
        "macro_f1": macro_f1,
        "macro_recall": macro_recall,
        "high_risk_recall": high_risk_recall,
        "best_val_macro_f1": best_val_score,
    }


# ============================================================
# TABULAR BASELINES (same features, same split)
# ============================================================

def train_tabular_baselines(account_features, labels, train_mask, test_mask):

    print("\n" + "=" * 70)
    print("TABULAR BASELINES (same 11 features, same split)")
    print("=" * 70)

    X = (
        account_features[NODE_FEATURE_COLUMNS]
        .apply(pd.to_numeric, errors="coerce")
        .replace([np.inf, -np.inf], np.nan)
        .fillna(0)
        .to_numpy(dtype=np.float32)
    )

    X_train = X[train_mask.numpy()]
    X_test = X[test_mask.numpy()]

    y_train = labels[train_mask].numpy()
    y_test = labels[test_mask].numpy()

    baselines = {
        "Logistic Regression": Pipeline([
            ("scaler", StandardScaler()),
            ("classifier", LogisticRegression(
                max_iter=3000,
                class_weight="balanced",
                random_state=SEED,
            )),
        ]),
        "HistGradientBoosting": HistGradientBoostingClassifier(
            max_iter=300,
            random_state=SEED,
        ),
    }

    results = []

    for name, model in baselines.items():

        model.fit(X_train, y_train)

        predictions = model.predict(X_test)

        accuracy = accuracy_score(y_test, predictions)
        macro_f1 = f1_score(y_test, predictions, average="macro", zero_division=0)

        high_risk_recall = recall_score(
            y_test, predictions, labels=[1], average="macro", zero_division=0
        )

        print(
            f"{name:24s} acc={accuracy:.4f}  "
            f"macroF1={macro_f1:.4f}  "
            f"HIGH-RISK recall={high_risk_recall:.4f}"
        )

        results.append({
            "model": name,
            "accuracy": accuracy,
            "macro_f1": macro_f1,
            "macro_recall": recall_score(
                y_test, predictions, average="macro", zero_division=0
            ),
            "high_risk_recall": high_risk_recall,
            "best_val_macro_f1": -1.0,
        })

    return results


# ============================================================
# MAIN
# ============================================================

def main():

    os.makedirs(SAVE_DIR, exist_ok=True)

    transactions, account_features, protocols, labels = load_binary_data()

    (
        x_dict,
        edge_index_dict,
        edge_attr_dict,
        train_mask,
        val_mask,
        test_mask,
    ) = build_clean_graph(transactions, account_features, protocols, labels)

    results = []

    for model_type in MODELS:

        try:

            result = train_gnn(
                model_type,
                x_dict,
                edge_index_dict,
                edge_attr_dict,
                labels,
                train_mask,
                val_mask,
                test_mask,
            )

            results.append(result)

        except Exception as error:

            print(f"\nERROR while training {model_type}:")
            print(f"{type(error).__name__}: {error}")

    tabular_results = train_tabular_baselines(
        account_features,
        labels,
        train_mask,
        test_mask,
    )

    all_results = results + tabular_results

    # ========================================================
    # FINAL COMPARISON
    # ========================================================

    print("\n")
    print("=" * 90)
    print("BINARY LIQUIDATION RISK - FINAL COMPARISON (GNN vs tabular)")
    print("=" * 90)

    print(
        f"{'Model':<26}"
        f"{'Accuracy':>10}"
        f"{'Macro F1':>10}"
        f"{'HIGH-RISK Recall':>18}"
    )

    print("-" * 90)

    for result in all_results:

        print(
            f"{result['model']:<26}"
            f"{result['accuracy']:>10.4f}"
            f"{result['macro_f1']:>10.4f}"
            f"{result['high_risk_recall']:>18.4f}"
        )

    print("=" * 90)

    gnn_best = max(results, key=lambda r: r["best_val_macro_f1"])

    print(
        f"\nBest GNN by validation Macro F1: {gnn_best['model']} "
        f"(val {gnn_best['best_val_macro_f1']:.4f})"
    )

    print(
        f"Test accuracy: {gnn_best['accuracy']:.4f} | "
        f"Macro F1: {gnn_best['macro_f1']:.4f}"
    )

    best_tabular = max(tabular_results, key=lambda r: r["macro_f1"])

    print(
        f"Best tabular baseline: {best_tabular['model']} "
        f"(acc {best_tabular['accuracy']:.4f}, "
        f"macro F1 {best_tabular['macro_f1']:.4f})"
    )

    if gnn_best["macro_f1"] > best_tabular["macro_f1"]:
        print(
            "\n=> The GNN outperforms the tabular baselines: "
            "graph structure adds real predictive value."
        )
    else:
        print(
            "\n=> The tabular baseline outperforms the GNN on this split."
        )

    print(f"\nBinary models saved in: {SAVE_DIR}")


if __name__ == "__main__":
    main()