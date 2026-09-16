from __future__ import annotations

"""
FEATURE IMPORTANCE (GLOBAL EXPLANATIONS)
========================================

Model-faithful global explanations for the binary liquidation-risk
model:

1. Permutation importance - shuffle one node feature at a time and
   measure the drop in test Macro-F1. Features whose removal hurts
   most are the ones the model relies on.

2. Class feature profiles - mean/std of each raw feature for
   LOW-RISK vs HIGH-RISK accounts (the behavioural gap the model
   exploits).

Also provides the shared model-loading and prediction helpers used
across the explainability package, the API and the federated
consistency check.
"""

import numpy as np
import pandas as pd
import torch

from sklearn.metrics import (
    accuracy_score,
    f1_score,
)

from backend.graph.build_graph import NODE_FEATURE_COLUMNS
from backend.model.gnn_model import HeterogeneousModel
from backend.model.train_binary import (
    DEVICE,
    DROPOUT,
    HEADS,
    HIDDEN_CHANNELS,
    NUM_CLASSES,
    PROJECT_ROOT,
)


# ============================================================
# CONFIGURATION
# ============================================================

MODEL_TYPE = "sage"

CHECKPOINT_PATH = (
    PROJECT_ROOT
    / "backend"
    / "model"
    / "saved_models"
    / f"{MODEL_TYPE}_binary_model.pt"
)

IMPORTANCE_CSV_PATH = (
    PROJECT_ROOT
    / "datasets"
    / "processed"
    / "feature_importance_binary.csv"
)

N_PERMUTATIONS = 5


# ============================================================
# LOAD TRAINED MODEL
# ============================================================

def load_trained_model(model_type=MODEL_TYPE, checkpoint_name=None):

    path = (
        PROJECT_ROOT
        / "backend"
        / "model"
        / "saved_models"
        / (checkpoint_name or f"{model_type}_binary_model.pt")
    )

    checkpoint = torch.load(
        path,
        map_location=DEVICE,
        weights_only=False,
    )

    model = HeterogeneousModel(
        model_type=checkpoint.get("model_type", model_type),
        hidden_channels=checkpoint.get(
            "hidden_channels",
            HIDDEN_CHANNELS,
        ),
        num_classes=checkpoint.get("num_classes", NUM_CLASSES),
        heads=checkpoint.get("heads", HEADS),
        dropout=checkpoint.get("dropout", DROPOUT),
    ).to(DEVICE)

    model.load_state_dict(checkpoint["model_state_dict"])

    model.eval()

    return model, checkpoint


# ============================================================
# PREDICTION HELPERS
# ============================================================

def predict_logits(
    model,
    x_dict,
    edge_index_dict,
    edge_attr_dict,
):

    model.eval()

    with torch.no_grad():

        return model(
            x_dict,
            edge_index_dict,
            edge_attr_dict,
        )


def evaluate_test(
    model,
    x_dict,
    edge_index_dict,
    edge_attr_dict,
    labels,
    test_mask,
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
# 1. PERMUTATION IMPORTANCE
# ============================================================

def permutation_importance(
    model,
    x_dict,
    edge_index_dict,
    edge_attr_dict,
    labels,
    test_mask,
    feature_names=None,
    n_repeats=N_PERMUTATIONS,
    seed=42,
):

    if feature_names is None:
        feature_names = NODE_FEATURE_COLUMNS

    generator = torch.Generator().manual_seed(seed)

    baseline = evaluate_test(
        model,
        x_dict,
        edge_index_dict,
        edge_attr_dict,
        labels,
        test_mask,
    )["macro_f1"]

    n_features = x_dict["account"].shape[1]

    drops = np.zeros(n_features)

    for j in range(n_features):

        permuted_scores = []

        for _ in range(n_repeats):

            permutation = torch.randperm(
                x_dict["account"].shape[0],
                generator=generator,
            )

            account_x = x_dict["account"].clone()
            account_x[:, j] = account_x[:, j][permutation]

            x_dict_permuted = dict(x_dict)
            x_dict_permuted["account"] = account_x

            score = evaluate_test(
                model,
                x_dict_permuted,
                edge_index_dict,
                edge_attr_dict,
                labels,
                test_mask,
            )["macro_f1"]

            permuted_scores.append(score)

        drops[j] = baseline - float(
            np.mean(permuted_scores)
        )

    order = np.argsort(drops)[::-1]

    results = [
        {
            "feature": feature_names[j],
            "importance_drop": float(drops[j]),
            "rank": position + 1,
        }
        for position, j in enumerate(order)
    ]

    return {
        "baseline_macro_f1": baseline,
        "features": results,
    }


# ============================================================
# 2. CLASS FEATURE PROFILES
# ============================================================

def class_feature_profiles(account_features, labels):

    features_df = account_features[
        NODE_FEATURE_COLUMNS
    ].copy()

    features_df["label"] = (
        labels.numpy()
        if torch.is_tensor(labels)
        else np.asarray(labels)
    )

    profiles = {}

    for feature in NODE_FEATURE_COLUMNS:

        low_values = features_df.loc[
            features_df["label"] == 0,
            feature,
        ]

        high_values = features_df.loc[
            features_df["label"] == 1,
            feature,
        ]

        low_mean = float(low_values.mean())
        high_mean = float(high_values.mean())

        ratio = (
            high_mean / low_mean
            if abs(low_mean) > 1e-12
            else float("inf")
            if abs(high_mean) > 1e-12
            else 1.0
        )

        profiles[feature] = {
            "low_mean": low_mean,
            "low_std": float(low_values.std()),
            "high_mean": high_mean,
            "high_std": float(high_values.std()),
            "high_vs_low_ratio": ratio,
        }

    return profiles
