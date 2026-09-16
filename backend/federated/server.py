from __future__ import annotations

"""
FEDERATED SERVER - COORDINATION
===============================

Coordinates the federated training process:

    Global Model
         │  (broadcast)
    ┌────┼────┬────┬────┐
    ↓    ↓    ↓    ↓    ↓
   Aave Comp Makr Unis Curve   <- local training on private labels
    │    │    │    │    │
    └────┼────┴────┼────┘
         ↓  (masked updates only)
   SECURE AGGREGATION  ->  new Global Model

Each round:
  1. server broadcasts the global model,
  2. every client trains locally (its own labels only),
  3. clients send MASKED updates (secure aggregation),
  4. server aggregates and updates the global model.

At the end: centralized-vs-federated comparison and the
explanation-consistency check (does the federated model rely on
the same behavioural signals as the centralized one?).
"""

import copy

import numpy as np
import torch

from sklearn.metrics import (
    accuracy_score,
    f1_score,
)

from backend.explainability.feature_importance import (
    load_trained_model,
    permutation_importance,
    predict_logits,
)
from backend.federated.client import (
    CLIENT_NAMES,
    local_train,
    partition_clients,
)
from backend.federated.fedavg import fed_avg
from backend.model.gnn_model import HeterogeneousModel
from backend.model.train_binary import (
    DEVICE,
    DROPOUT,
    HEADS,
    HIDDEN_CHANNELS,
    NUM_CLASSES,
    PROJECT_ROOT,
    build_clean_graph,
    load_binary_data,
)
from backend.privacy.privacy_metrics import (
    server_visibility_report,
)
from backend.privacy.secure_aggregation import (
    secure_aggregate,
    verify_secure_aggregation,
)


# ============================================================
# CONFIGURATION
# ============================================================

MODEL_TYPE = "sage"

ROUNDS = 20

LOCAL_EPOCHS = 3

SEED = 42

USE_SECURE_AGGREGATION = True

SAVE_PATH = (
    PROJECT_ROOT
    / "backend"
    / "model"
    / "saved_models"
    / f"{MODEL_TYPE}_binary_federated_model.pt"
)


# ============================================================
# EVALUATION
# ============================================================

def evaluate(
    model,
    labels,
    test_mask,
    x_dict,
    edge_index_dict,
    edge_attr_dict,
):

    logits = predict_logits(
        model,
        x_dict,
        edge_index_dict,
        edge_attr_dict,
    )

    predictions = (
        logits[test_mask].argmax(dim=1).numpy()
    )

    y_true = labels[test_mask].numpy()

    return {
        "accuracy": accuracy_score(y_true, predictions),
        "macro_f1": f1_score(
            y_true,
            predictions,
            average="macro",
            zero_division=0,
        ),
    }


# ============================================================
# SPEARMAN RANK CORRELATION (no scipy dependency)
# ============================================================

def _ranks(values):

    order = np.argsort(values)

    ranks = np.empty_like(order, dtype=np.float64)

    ranks[order] = np.arange(
        1,
        len(values) + 1,
    )

    return ranks


def spearman_correlation(a, b):

    ra = _ranks(np.asarray(a))
    rb = _ranks(np.asarray(b))

    ra -= ra.mean()
    rb -= rb.mean()

    denominator = float(
        np.sqrt((ra ** 2).sum() * (rb ** 2).sum())
    )

    if denominator == 0:
        return 0.0

    return float((ra * rb).sum() / denominator)


# ============================================================
# FEDERATED ORCHESTRATION
# ============================================================

def run_federated(rounds=ROUNDS, local_epochs=LOCAL_EPOCHS):

    torch.manual_seed(SEED)
    np.random.seed(SEED)

    # --------------------------------------------------------
    # Load data and build the public observation-window graph.
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

    n_accounts = len(account_features)

    # --------------------------------------------------------
    # Partition accounts into the clients (non-IID).
    # --------------------------------------------------------

    client_ids = partition_clients(
        transactions,
        protocols,
        n_accounts,
    )

    print()
    print("=" * 70)
    print("FEDERATED LEARNING - FedAvg SIMULATION")
    print("=" * 70)
    print(f"Clients ({len(CLIENT_NAMES)}): {', '.join(CLIENT_NAMES)}")
    print(
        f"Rounds: {rounds} | Local epochs per round: {local_epochs}"
    )
    print(
        f"Secure aggregation: "
        f"{'ENABLED (server sees only the aggregate)' if USE_SECURE_AGGREGATION else 'OFF'}"
    )
    print()
    print("Client partition (non-IID):")
    print(
        f"{'Client':<18}"
        f"{'Accounts':>10}"
        f"{'Train':>8}"
        f"{'%HIGH-RISK':>12}"
    )
    print("-" * 50)

    labels_np = labels.numpy()

    for c, name in enumerate(CLIENT_NAMES):

        members = client_ids == c

        train_members = members & train_mask.numpy()

        high_fraction = (
            labels_np[members].mean() * 100
            if members.sum() > 0
            else 0.0
        )

        print(
            f"{name:<18}"
            f"{int(members.sum()):>10}"
            f"{int(train_members.sum()):>8}"
            f"{high_fraction:>11.1f}%"
        )

    client_train_masks = [
        torch.tensor(
            (client_ids == c) & train_mask.numpy()
        )
        for c in range(len(CLIENT_NAMES))
    ]

    client_weights = [
        int(mask.sum())
        for mask in client_train_masks
    ]

    # --------------------------------------------------------
    # Initialize the global model.
    # --------------------------------------------------------

    global_model = HeterogeneousModel(
        model_type=MODEL_TYPE,
        hidden_channels=HIDDEN_CHANNELS,
        num_classes=NUM_CLASSES,
        heads=HEADS,
        dropout=DROPOUT,
    ).to(DEVICE)

    # --------------------------------------------------------
    # Federated training rounds.
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("FEDERATED TRAINING")
    print("=" * 70)

    for round_number in range(1, rounds + 1):

        local_models = []

        for c in range(len(CLIENT_NAMES)):

            local_model = copy.deepcopy(global_model)

            local_train(
                local_model,
                x_dict,
                edge_index_dict,
                edge_attr_dict,
                labels,
                client_train_masks[c],
                epochs=local_epochs,
            )

            local_models.append(local_model)

        # ------------------------------------------------
        # Aggregation (secure by default).
        # ------------------------------------------------

        round_seed = SEED * 1000 + round_number

        if USE_SECURE_AGGREGATION:

            if round_number == 1:

                difference = verify_secure_aggregation(
                    local_models,
                    client_weights,
                    round_seed,
                )

                print()
                print(
                    f"[secure-agg check] masked sum vs plain "
                    f"weighted sum: max |diff| = {difference:.2e}"
                )

                server_visibility_report(
                    local_models,
                    client_weights,
                    round_seed,
                )

            global_state = secure_aggregate(
                local_models,
                client_weights,
                round_seed,
            )

        else:

            global_state = fed_avg(
                local_models,
                client_weights,
            )

        global_model.load_state_dict(global_state)

        metrics = evaluate(
            global_model,
            labels,
            test_mask,
            x_dict,
            edge_index_dict,
            edge_attr_dict,
        )

        print(
            f"Round {round_number:02d}/{rounds} | "
            f"test acc {metrics['accuracy']:.4f} | "
            f"macro F1 {metrics['macro_f1']:.4f}"
        )

    # --------------------------------------------------------
    # Final comparison: centralized vs federated.
    # --------------------------------------------------------

    federated_metrics = evaluate(
        global_model,
        labels,
        test_mask,
        x_dict,
        edge_index_dict,
        edge_attr_dict,
    )

    centralized_model, centralized_checkpoint = (
        load_trained_model(MODEL_TYPE)
    )

    print()
    print("=" * 70)
    print("CENTRALIZED vs FEDERATED (same test split)")
    print("=" * 70)
    print(
        f"{'Training':<28}"
        f"{'Accuracy':>10}"
        f"{'Macro F1':>10}"
    )
    print("-" * 50)
    print(
        f"{'Centralized (all labels)':<28}"
        f"{centralized_checkpoint.get('test_accuracy', float('nan')):>10.4f}"
        f"{centralized_checkpoint.get('macro_f1', float('nan')):>10.4f}"
    )
    print(
        f"{'Federated (5 clients)':<28}"
        f"{federated_metrics['accuracy']:>10.4f}"
        f"{federated_metrics['macro_f1']:>10.4f}"
    )
    print("-" * 50)
    print(
        "Privacy cost = the gap above: how much accuracy we pay"
    )
    print(
        "for never pooling the institutions' private labels."
    )

    # --------------------------------------------------------
    # Save the federated model.
    # --------------------------------------------------------

    torch.save(
        {
            "model_state_dict": (
                global_model.state_dict()
            ),
            "model_type": MODEL_TYPE,
            "task": "binary_liquidation_federated",
            "training": "FedAvg"
            + (
                " + secure aggregation"
                if USE_SECURE_AGGREGATION
                else ""
            ),
            "clients": CLIENT_NAMES,
            "rounds": rounds,
            "local_epochs": local_epochs,
            "hidden_channels": HIDDEN_CHANNELS,
            "num_classes": NUM_CLASSES,
            "heads": HEADS,
            "dropout": DROPOUT,
            "test_accuracy": federated_metrics["accuracy"],
            "macro_f1": federated_metrics["macro_f1"],
        },
        SAVE_PATH,
    )

    print()
    print(f"Federated model saved: {SAVE_PATH}")

    # ========================================================
    # EXPLANATION CONSISTENCY CHECK
    # ========================================================

    print()
    print("=" * 70)
    print("EXPLANATION CONSISTENCY (centralized vs federated)")
    print("=" * 70)

    centralized_importance = permutation_importance(
        centralized_model,
        x_dict,
        edge_index_dict,
        edge_attr_dict,
        labels,
        test_mask,
    )

    federated_importance = permutation_importance(
        global_model,
        x_dict,
        edge_index_dict,
        edge_attr_dict,
        labels,
        test_mask,
    )

    fed_by_feature = {
        item["feature"]: item
        for item in federated_importance["features"]
    }

    print(
        f"{'Feature':<32}"
        f"{'Centralized':>16}"
        f"{'Federated':>16}"
    )
    print("-" * 66)

    paired_central = []
    paired_fed = []

    for item in centralized_importance["features"]:

        feature = item["feature"]

        fed_item = fed_by_feature[feature]

        print(
            f"{feature:<32}"
            f"#{item['rank']:>3} ({item['importance_drop']:+.4f})"
            f"#{fed_item['rank']:>3} ({fed_item['importance_drop']:+.4f})"
        )

        paired_central.append(
            item["importance_drop"]
        )

        paired_fed.append(
            fed_item["importance_drop"]
        )

    rho = spearman_correlation(
        paired_central,
        paired_fed,
    )

    print("-" * 66)
    print(
        f"Spearman rank correlation: {rho:.3f}"
    )
    print()

    if rho >= 0.8:
        print(
            "=> STRONG consistency: the federated model relies on "
            "the same behavioural signals as the centralized model. "
            "Privacy did not break interpretability."
        )
    elif rho >= 0.5:
        print(
            "=> MODERATE consistency: rankings broadly agree; "
            "lower-ranked features swap places (expected with "
            "small per-feature importance differences)."
        )
    else:
        print(
            "=> WEAK consistency: federated training shifted the "
            "feature reliance - worth investigating further."
        )

    print()
    print("FEDERATED LEARNING SIMULATION COMPLETE")

    return global_model, federated_metrics
