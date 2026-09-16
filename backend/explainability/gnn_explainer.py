from __future__ import annotations

"""
GNN EXPLAINER (LOCAL, PER-ACCOUNT EXPLANATIONS)
===============================================

Answers:  "WHY is this account HIGH RISK?"

For a single account, produces FICO-style REASON CODES:

  * z-score of each feature vs the LOW-RISK population
    (interpretable: "failed_tx_ratio = 0.023, z = +4.1")

  * weighted by global permutation importance, and

  * gradient x input attribution (model-faithful: how much each
    feature value contributed to THIS account's logit).

Used by the CLI report, the API (/api/accounts/{id}) and can be
re-applied to the federated model for consistency checks.
"""

import numpy as np
import torch

from backend.graph.build_graph import NODE_FEATURE_COLUMNS
from backend.explainability.feature_importance import (
    predict_logits,
)


TOP_K_REASONS = 5


# ============================================================
# PER-ACCOUNT EXPLANATION
# ============================================================

def explain_account(
    account_index,
    model=None,
    x_dict=None,
    edge_index_dict=None,
    edge_attr_dict=None,
    account_features=None,
    labels=None,
    importance=None,
    top_k=TOP_K_REASONS,
    use_gradients=True,
):

    # --------------------------------------------------------
    # Raw feature values for this account.
    # --------------------------------------------------------

    raw = account_features.iloc[account_index]

    raw_values = {
        feature: float(raw[feature])
        for feature in NODE_FEATURE_COLUMNS
    }

    # --------------------------------------------------------
    # z-scores vs the LOW-RISK population (interpretable).
    # --------------------------------------------------------

    labels_np = (
        labels.numpy()
        if torch.is_tensor(labels)
        else np.asarray(labels)
    )

    low_rows = account_features[
        labels_np == 0
    ][NODE_FEATURE_COLUMNS]

    low_mean = low_rows.mean()
    low_std = low_rows.std().replace(0, 1e-12)

    z_scores = (
        (raw[NODE_FEATURE_COLUMNS] - low_mean) / low_std
    )

    # --------------------------------------------------------
    # Global importance weights (uniform if not provided).
    # --------------------------------------------------------

    if importance is not None:

        weight = {
            item["feature"]: max(
                item["importance_drop"],
                0.0,
            )
            for item in importance["features"]
        }

        total = sum(weight.values())

        if total > 0:
            weight = {
                k: v / total
                for k, v in weight.items()
            }
    else:

        weight = {
            f: 1.0 / len(NODE_FEATURE_COLUMNS)
            for f in NODE_FEATURE_COLUMNS
        }

    # --------------------------------------------------------
    # Model prediction + probability for this account.
    # --------------------------------------------------------

    prediction = None
    probability = None
    gradient_attribution = None

    if model is not None and x_dict is not None:

        logits = predict_logits(
            model,
            x_dict,
            edge_index_dict,
            edge_attr_dict,
        )

        logit_pair = logits[account_index]

        probabilities = torch.softmax(
            logit_pair,
            dim=0,
        )

        prediction = int(logit_pair.argmax().item())
        probability = float(
            probabilities[prediction].item()
        )

        # ------------------------------------------------
        # Gradient x input attribution (model-faithful).
        # ------------------------------------------------

        if use_gradients:

            account_x = (
                x_dict["account"]
                .clone()
                .detach()
                .requires_grad_(True)
            )

            x_dict_grad = dict(x_dict)
            x_dict_grad["account"] = account_x

            model.eval()

            out = model(
                x_dict_grad,
                edge_index_dict,
                edge_attr_dict,
            )

            target = out[account_index, prediction]

            target.backward()

            attribution = (
                account_x.grad[account_index]
                * account_x[account_index]
            ).detach()

            total_attr = (
                attribution.abs().sum().item()
            )

            if total_attr > 0:
                gradient_attribution = {
                    NODE_FEATURE_COLUMNS[j]: float(
                        attribution[j].item()
                    )
                    for j in range(
                        len(NODE_FEATURE_COLUMNS)
                    )
                }

    # --------------------------------------------------------
    # Build ranked reason codes.
    # --------------------------------------------------------

    reasons = []

    for feature in NODE_FEATURE_COLUMNS:

        z = float(z_scores[feature])

        reasons.append(
            {
                "feature": feature,
                "value": raw_values[feature],
                "z_vs_low_risk": z,
                "importance_weight": weight[feature],
                "reason_score": abs(z)
                * weight[feature],
                "gradient_attribution": (
                    gradient_attribution.get(feature)
                    if gradient_attribution
                    else None
                ),
            }
        )

    reasons.sort(
        key=lambda r: r["reason_score"],
        reverse=True,
    )

    return {
        "account_index": int(account_index),
        "account_id": int(raw["account_id"]),
        "prediction": prediction,
        "prediction_label": (
            "HIGH RISK"
            if prediction == 1
            else "LOW RISK"
            if prediction == 0
            else None
        ),
        "probability": probability,
        "reasons": reasons[:top_k],
    }
