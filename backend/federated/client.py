from __future__ import annotations

"""
FEDERATED CLIENTS - DeFI INSTITUTIONS
=====================================

Represents the participating institutions. Each client is a real
DeFi protocol name; an account belongs to the institution whose
protocol it interacts with most (dominant protocol in the
observation window). Accounts with no dominant protocol belong to
the fifth client.

Each client trains locally on the PUBLIC observation-window graph
but ONLY on the loss over ITS OWN accounts' labels - labels never
leave the institution.
"""

import numpy as np
import pandas as pd
import torch
import torch.nn as nn

from backend.model.train_binary import (
    DEVICE,
    LEARNING_RATE,
    NUM_CLASSES,
)


# ============================================================
# CONFIGURATION
# ============================================================

CLIENT_NAMES = [
    "Aave",
    "Compound",
    "MakerDAO",
    "Uniswap",
    "Curve Finance",
]

PROTOCOL_TO_CLIENT = {
    "AaveLike": "Aave",
    "CompoundLike": "Compound",
    "MakerLike": "MakerDAO",
    "UniswapLike": "Uniswap",
}

NO_DOMINANT_CLIENT = "Curve Finance"


# ============================================================
# CLIENT PARTITION
# ============================================================

def partition_clients(transactions, protocols, n_accounts):

    # --------------------------------------------------------
    # Observation-window DeFi interactions only.
    # --------------------------------------------------------

    obs = transactions[
        (transactions["timestamp"] < pd.Timestamp("2025-05-01"))
        & (transactions["protocol_id"].notna())
    ]

    protocol_names = dict(
        zip(
            protocols["protocol_id"],
            protocols["name"],
        )
    )

    # --------------------------------------------------------
    # Dominant protocol per account.
    #
    # An account belongs to the institution whose protocol it
    # uses MOST - unless that dominance is weak (< 50% of its
    # DeFi interactions), in which case the account interacts
    # diffusely across venues and is assigned to the aggregator
    # client (Curve Finance).
    # --------------------------------------------------------

    interactions = (
        obs.groupby(["from_account_id", "protocol_id"])
        .size()
        .reset_index(name="count")
    )

    interactions["total"] = interactions.groupby(
        "from_account_id"
    )["count"].transform("sum")

    interactions["dominant_share"] = (
        interactions["count"] / interactions["total"]
    )

    dominant = (
        interactions[
            interactions["dominant_share"] >= 0.5
        ]
        .sort_values(
            ["from_account_id", "count"],
            ascending=[True, False],
        )
        .drop_duplicates("from_account_id")
        .set_index("from_account_id")["protocol_id"]
    )

    client_ids = np.full(
        n_accounts,
        CLIENT_NAMES.index(NO_DOMINANT_CLIENT),
        dtype=np.int64,
    )

    for account_id, protocol_id in dominant.items():

        protocol_name = protocol_names.get(
            protocol_id,
        )

        client_name = PROTOCOL_TO_CLIENT.get(
            protocol_name,
            NO_DOMINANT_CLIENT,
        )

        if 1 <= account_id <= n_accounts:
            client_ids[account_id - 1] = (
                CLIENT_NAMES.index(client_name)
            )

    return client_ids


# ============================================================
# LOCAL TRAINING (one client, one round)
# ============================================================

def local_train(
    model,
    x_dict,
    edge_index_dict,
    edge_attr_dict,
    labels,
    client_train_mask,
    epochs=3,
):

    class_counts = torch.bincount(
        labels[client_train_mask],
        minlength=NUM_CLASSES,
    ).float()

    # Guard for clients that may lack one class entirely.

    class_counts = class_counts.clamp(min=1.0)

    class_weights = (
        class_counts.sum()
        / (NUM_CLASSES * class_counts)
    ).to(DEVICE)

    criterion = nn.CrossEntropyLoss(
        weight=class_weights,
    )

    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=LEARNING_RATE,
    )

    model.train()

    for _ in range(epochs):

        optimizer.zero_grad()

        logits = model(
            x_dict,
            edge_index_dict,
            edge_attr_dict,
        )

        loss = criterion(
            logits[client_train_mask],
            labels[client_train_mask],
        )

        loss.backward()

        optimizer.step()

    return model
