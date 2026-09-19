from __future__ import annotations

"""
API DEPENDENCIES - SHARED STATE
===============================

Loads everything once at import time (graph + trained model +
predictions + explanations for all accounts) and exposes it to
the routes:

  * the trained binary GraphSAGE model
  * the observation-window graph
  * predictions and HIGH-RISK probabilities for all accounts
  * global permutation importance
  * z-scores vs the LOW-RISK population
  * federated model info (if trained)
  * client (institution) membership per account
  * wallet addresses
"""

import pandas as pd
import torch

from backend.explainability.feature_importance import (
    load_trained_model,
    permutation_importance,
    predict_logits,
)
from backend.federated.client import (
    CLIENT_NAMES,
    partition_clients,
)
from backend.graph.build_graph import NODE_FEATURE_COLUMNS
from backend.model.train_binary import (
    PROJECT_ROOT,
    build_clean_graph,
    load_binary_data,
)


# ============================================================
# STARTUP - BUILD EVERYTHING ONCE
# ============================================================

def _startup():

    state = {}

    # --------------------------------------------------------
    # Data + graph + labels.
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
    # Trained centralized binary model.
    # --------------------------------------------------------

    model, checkpoint = load_trained_model("sage")

    logits = predict_logits(
        model,
        x_dict,
        edge_index_dict,
        edge_attr_dict,
    )

    probabilities = torch.softmax(
        logits,
        dim=1,
    )

    predictions = logits.argmax(dim=1).numpy()

    high_probabilities = probabilities[:, 1].numpy()

    # --------------------------------------------------------
    # Global feature importance (permutation).
    # --------------------------------------------------------

    importance = permutation_importance(
        model,
        x_dict,
        edge_index_dict,
        edge_attr_dict,
        labels,
        test_mask,
        n_repeats=3,
    )

    # --------------------------------------------------------
    # z-scores vs the LOW-RISK population (vectorised).
    # --------------------------------------------------------

    labels_np = labels.numpy()

    features_df = account_features[
        NODE_FEATURE_COLUMNS
    ]

    low_rows = features_df[labels_np == 0]

    low_mean = low_rows.mean()
    low_std = low_rows.std().replace(0, 1e-12)

    z_scores = (features_df - low_mean) / low_std

    weight = {
        item["feature"]: max(
            item["importance_drop"],
            0.0,
        )
        for item in importance["features"]
    }

    total_weight = sum(weight.values()) or 1.0

    weight = {
        k: v / total_weight
        for k, v in weight.items()
    }

    reason_scores = z_scores.abs() * pd.Series(weight)

    # --------------------------------------------------------
    # Federated model info (if trained).
    # --------------------------------------------------------

    federated_path = (
        PROJECT_ROOT
        / "backend"
        / "model"
        / "saved_models"
        / "sage_binary_federated_model.pt"
    )

    federated_info = None

    if federated_path.exists():

        fed_checkpoint = torch.load(
            federated_path,
            map_location="cpu",
            weights_only=False,
        )

        federated_info = {
            "trained": True,
            "method": fed_checkpoint.get("training"),
            "clients": fed_checkpoint.get("clients"),
            "rounds": fed_checkpoint.get("rounds"),
            "test_accuracy": fed_checkpoint.get(
                "test_accuracy"
            ),
            "macro_f1": fed_checkpoint.get("macro_f1"),
        }

    # --------------------------------------------------------
    # Client (institution) membership per account.
    # --------------------------------------------------------

    try:

        client_ids = partition_clients(
            transactions,
            protocols,
            len(account_features),
        )

        client_names = [
            CLIENT_NAMES[c] for c in client_ids
        ]

    except Exception:

        client_names = ["-"] * len(account_features)

    # --------------------------------------------------------
    # Wallet addresses.
    # --------------------------------------------------------

    accounts_csv = (
        PROJECT_ROOT
        / "datasets"
        / "processed"
        / "accounts.csv"
    )

    wallet_map = {}

    if accounts_csv.exists():

        accounts_df = pd.read_csv(accounts_csv)

        wallet_map = dict(
            zip(
                accounts_df["account_id"],
                accounts_df["wallet_address"],
            )
        )

    # --------------------------------------------------------
    # Assemble the state.
    # --------------------------------------------------------

    account_ids = account_features[
        "account_id"
    ].tolist()

    state.update(
        {
            "ready": True,
            "account_features": account_features,
            "labels": labels,
            "x_dict": x_dict,
            "edge_index_dict": edge_index_dict,
            "edge_attr_dict": edge_attr_dict,
            "train_mask": train_mask,
            "test_mask": test_mask,
            "model": model,
            "checkpoint": checkpoint,
            "predictions": predictions,
            "high_probabilities": high_probabilities,
            "importance": importance,
            "z_scores": z_scores,
            "reason_scores": reason_scores,
            "federated_info": federated_info,
            "client_names": client_names,
            "wallet_map": wallet_map,
            "account_id_to_index": {
                account_id: index
                for index, account_id in enumerate(
                    account_ids
                )
            },
            "account_ids": account_ids,
        }
    )

    return state


STATE = _startup()


# ============================================================
# HELPERS
# ============================================================

def get_state():

    return STATE


def short_wallet(wallet):

    if (
        not isinstance(wallet, str)
        or len(wallet) < 12
    ):
        return wallet or "-"

    return f"{wallet[:8]}...{wallet[-6:]}"


def top_reasons(index, top_k=3):

    row = STATE["reason_scores"].iloc[index]

    top = row.sort_values(ascending=False).head(top_k)

    return [
        {
            "feature": feature,
            "z": float(
                STATE["z_scores"].iloc[index][feature]
            ),
        }
        for feature in top.index
    ]
