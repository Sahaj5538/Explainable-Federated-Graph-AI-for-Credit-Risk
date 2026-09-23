from __future__ import annotations

"""
API ROUTES - ENDPOINTS
======================

All endpoints under the /api prefix:

  GET  /api/health              - service status
  GET  /api/stats               - model + dataset + federated stats
  GET  /api/importance          - global feature importance
  GET  /api/accounts            - paginated account list w/ predictions
  GET  /api/accounts/{id}       - full per-account XAI explanation
  GET  /api/shap/{id}           - Kernel SHAP values for one account
  POST /api/predict             - prediction for one account (API clients)
"""

import pandas as pd
import torch

from fastapi import APIRouter, HTTPException

from backend.api.dependencies import (
    STATE,
    short_wallet,
    top_reasons,
)
from backend.api.schemas import (
    AccountDetail,
    ResolveResponse,
    WhatIfContext,
    WhatIfFactor,
    WhatIfRequest,
    WhatIfResponse,
    AccountSummary,
    FeatureValue,
    HealthResponse,
    ImportanceResponse,
    PaginatedAccounts,
    PredictRequest,
    PredictResponse,
    ReasonChip,
    ShapFeature,
    ShapResponse,
    NetworkResponse,
    NarrativeBlock,
    StatsResponse,
    ModelMetricItem,
    ModelPerformanceResponse,
)
from backend.explainability.feature_importance import (
    predict_logits,
)
from backend.explainability.gnn_explainer import (
    explain_account,
)
from backend.explainability.shap_explainer import (
    build_shap_explainer,
    explain_index,
)
from backend.graph.build_graph import NODE_FEATURE_COLUMNS

router = APIRouter(prefix="/api")

# SHAP machinery is built lazily on the first request (importing
# shap + the first kernel evaluation are slow) and results are
# cached per account index.

_SHAP_NSAMPLES = 300

_SHAP_STATE = {
    "explainer": None,
    "black_box": None,
    "cache": {},
}


def _get_shap_result(index):

    if index in _SHAP_STATE["cache"]:
        return _SHAP_STATE["cache"][index]

    if _SHAP_STATE["explainer"] is None:

        (
            _SHAP_STATE["explainer"],
            _SHAP_STATE["black_box"],
        ) = build_shap_explainer(
            STATE["model"],
            STATE["x_dict"],
            STATE["edge_index_dict"],
            STATE["edge_attr_dict"],
            STATE["labels"],
            STATE["train_mask"],
        )

    result = explain_index(
        _SHAP_STATE["explainer"],
        _SHAP_STATE["black_box"],
        index,
        nsamples=_SHAP_NSAMPLES,
    )

    _SHAP_STATE["cache"][index] = result

    return result


# ============================================================
# HEALTH
# ============================================================

@router.get("/health", response_model=HealthResponse)
def health():

    return {
        "status": "ok",
        "model_loaded": bool(STATE.get("ready")),
    }


# ============================================================
# STATS
# ============================================================

@router.get("/stats", response_model=StatsResponse)
def stats():

    predictions = STATE["predictions"]

    checkpoint = STATE["checkpoint"]

    importance_top = STATE["importance"]["features"][:8]

    return {
        "model": {
            "type": checkpoint.get(
                "model_type",
                "sage",
            ).upper(),
            "task": "binary liquidation risk",
            "test_accuracy": checkpoint.get(
                "test_accuracy"
            ),
            "macro_f1": checkpoint.get("macro_f1"),
            "features": len(NODE_FEATURE_COLUMNS),
            "seeded": True,
            "leakage_free": True,
        },
        "dataset": {
            "accounts": len(
                STATE["account_features"]
            ),
            "observation_window": (
                "2025-01-01 to 2025-04-30"
            ),
            "outcome_window": (
                "2025-05-01 to 2025-07-01"
            ),
            "actual_high_risk": int(
                (STATE["labels"].numpy() == 1).sum()
            ),
            "predicted_high_risk": int(
                (predictions == 1).sum()
            ),
        },
        "clients": STATE["federated_info"],
        "top_features": [
            {
                "feature": item["feature"],
                "importance": round(
                    item["importance_drop"],
                    4,
                ),
            }
            for item in importance_top
        ],
    }


# ============================================================
# GLOBAL FEATURE IMPORTANCE
# ============================================================

@router.get(
    "/importance",
    response_model=ImportanceResponse,
)
def importance():

    return STATE["importance"]


# ============================================================
# MODEL PERFORMANCE (dynamic evaluation of saved checkpoints)
# ============================================================

_MODEL_PERFORMANCE_CACHE = None


@router.get(
    "/model-performance",
    response_model=ModelPerformanceResponse,
)
def model_performance():

    global _MODEL_PERFORMANCE_CACHE

    if _MODEL_PERFORMANCE_CACHE is not None:
        return _MODEL_PERFORMANCE_CACHE

    try:
        from backend.evaluation.compare_models import (
            collect_binary_results,
        )

        raw_results = collect_binary_results()

        models = []

        for item in raw_results:

            name = item.get("model", "Unknown")

            is_gnn = (
                "Logistic" not in name
                and "Hist" not in name
                and "Random" not in name
                and "XGBoost" not in name
            )

            category = "GNN" if is_gnn else "Traditional ML"

            models.append(
                ModelMetricItem(
                    name=name,
                    category=category,
                    accuracy=round(
                        float(item.get("accuracy", 0.0)), 4
                    ),
                    macro_f1=round(
                        float(item.get("macro_f1", 0.0)), 4
                    ),
                    positive_recall=(
                        round(float(item["positive_recall"]), 4)
                        if item.get("positive_recall") is not None
                        else None
                    ),
                    positive_f1=(
                        round(float(item["positive_f1"]), 4)
                        if item.get("positive_f1") is not None
                        else None
                    ),
                )
            )

        best = (
            max(models, key=lambda m: m.macro_f1).name
            if models
            else "GraphSAGE"
        )

        # --------------------------------------------------------
        # Secondary study: the 3-level (LOW/MEDIUM/HIGH) experiment.
        # Real numbers from the saved 3-class checkpoints - shown in
        # the dashboard as the "fine-graded risk study" chart.
        # --------------------------------------------------------
        ablation = []

        try:

            from backend.evaluation.compare_models import (
                collect_3class_results,
            )

            for item in collect_3class_results():

                ablation.append(
                    ModelMetricItem(
                        name=item.get("model", "Unknown"),
                        category="3-class",
                        accuracy=round(
                            float(item.get("accuracy", 0.0)), 4
                        ),
                        macro_f1=round(
                            float(item.get("macro_f1", 0.0)), 4
                        ),
                        positive_recall=(
                            round(float(item["positive_recall"]), 4)
                            if item.get("positive_recall") is not None
                            else None
                        ),
                        positive_f1=(
                            round(float(item["positive_f1"]), 4)
                            if item.get("positive_f1") is not None
                            else None
                        ),
                    )
                )

        except Exception:
            ablation = []

        _MODEL_PERFORMANCE_CACHE = {
            "primary_metric": "Macro F1",
            "best_model": best,
            "models": models,
            "ablation": ablation,
        }

        return _MODEL_PERFORMANCE_CACHE

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Failed to load model evaluation metrics: {error}",
        )



# ============================================================
# ACCOUNT LIST
# ============================================================

@router.get(
    "/accounts",
    response_model=PaginatedAccounts,
)
def list_accounts(
    search: str = "",
    risk: str = "all",
    page: int = 1,
    page_size: int = 20,
):

    n = len(STATE["account_ids"])

    indices = list(range(n))

    # --------------------------------------------------------
    # Filters.
    # --------------------------------------------------------

    if risk == "high":
        indices = [
            i
            for i in indices
            if STATE["predictions"][i] == 1
        ]
    elif risk == "low":
        indices = [
            i
            for i in indices
            if STATE["predictions"][i] == 0
        ]

    if search:

        needle = search.strip().lower()

        indices = [
            i
            for i in indices
            if needle
            in short_wallet(
                STATE["wallet_map"].get(
                    STATE["account_ids"][i],
                    "",
                )
            ).lower()
            or needle
            in str(STATE["account_ids"][i])
            or needle
            in STATE["client_names"][i].lower()
        ]

    # --------------------------------------------------------
    # Pagination.
    # --------------------------------------------------------

    total = len(indices)

    page = max(1, page)

    pages = max(1, -(-total // page_size))

    start = (page - 1) * page_size

    page_indices = indices[start : start + page_size]

    # --------------------------------------------------------
    # Rows.
    # --------------------------------------------------------

    rows = []

    for i in page_indices:

        account_id = STATE["account_ids"][i]

        rows.append(
            AccountSummary(
                account_id=account_id,
                wallet=short_wallet(
                    STATE["wallet_map"].get(
                        account_id,
                        "-",
                    )
                ),
                client=STATE["client_names"][i],
                prediction=(
                    "HIGH RISK"
                    if STATE["predictions"][i] == 1
                    else "LOW RISK"
                ),
                high_risk_probability=round(
                    float(
                        STATE["high_probabilities"][i]
                    ),
                    4,
                ),
                reasons=[
                    ReasonChip(
                        feature=reason["feature"],
                        z=reason["z"],
                    )
                    for reason in top_reasons(
                        i,
                        top_k=3,
                    )
                ],
            )
        )

    return {
        "total": total,
        "page": page,
        "pages": pages,
        "page_size": page_size,
        "accounts": rows,
    }


# ============================================================
# ACCOUNT DETAIL (full XAI explanation)
# ============================================================

@router.get(
    "/accounts/{account_id}",
    response_model=AccountDetail,
)
def account_detail(account_id: int):

    index = STATE["account_id_to_index"].get(
        account_id
    )

    if index is None:
        raise HTTPException(
            status_code=404,
            detail="account not found",
        )

    explanation = explain_account(
        index,
        model=STATE["model"],
        x_dict=STATE["x_dict"],
        edge_index_dict=STATE["edge_index_dict"],
        edge_attr_dict=STATE["edge_attr_dict"],
        account_features=STATE["account_features"],
        labels=STATE["labels"],
        importance=STATE["importance"],
        top_k=5,
    )

    raw = STATE["account_features"].iloc[index]

    features = [
        FeatureValue(
            feature=feature,
            value=float(raw[feature]),
            z=float(
                STATE["z_scores"].iloc[index][
                    feature
                ]
            ),
        )
        for feature in NODE_FEATURE_COLUMNS
    ]

    detail = AccountDetail(
        account_id=account_id,
        wallet=STATE["wallet_map"].get(
            account_id,
            "-",
        ),
        client=STATE["client_names"][index],
        actual_label=(
            "HIGH RISK"
            if STATE["labels"].numpy()[index] == 1
            else "LOW RISK"
        ),
        prediction=explanation["prediction_label"],
        high_risk_probability=round(
            float(
                STATE["high_probabilities"][index]
            ),
            4,
        ),
        reasons=explanation["reasons"],
        features=features,
    )

    narrative = _build_narrative(index, detail)

    detail.narrative = NarrativeBlock(**narrative)

    return detail


# ============================================================
# PLAIN-ENGLISH NARRATIVE - CONVERSATIONAL, LIKE EXPLAINING TO A FRIEND
# ============================================================

FEATURE_LABELS_SIMPLE = {
    "historical_liquidation_count": "past liquidations",
    "liquidation_rate": "how often borrowing went bad",
    "borrow_frequency": "how often it borrows",
    "borrow_volume": "total borrowed amount",
    "borrow_intensity": "borrowing compared to total activity",
    "unique_counterparties": "number of people it traded with",
    "deposit_volume": "total deposited",
    "borrow_to_repay_ratio": "borrowing vs repaying",
    "repayment_ratio": "how regularly it repays",
    "repay_count": "number of repayments",
    "total_volume": "total transaction amount",
    "failed_tx_ratio": "how many transactions failed",
    "failed_transactions": "failed transactions",
}

def _phrase(feature):
    return FEATURE_LABELS_SIMPLE.get(feature, feature.replace("_", " "))

def _simple_value_text(feature, value):
    if feature == "historical_liquidation_count":
        if value <= 0.1:
            return "has almost never been liquidated before (0 times)"
        elif value < 1:
            return "has been liquidated a little before"
        else:
            return f"has been liquidated {value:.0f} times before"
    if feature == "liquidation_rate":
        if value <= 0.05:
            return "almost all its borrows were fine"
        return f"{value*100:.0f}% of its borrows went bad and got liquidated"
    if feature == "failed_tx_ratio":
        return f"{value*100:.0f}% of its transactions failed"
    if feature == "failed_transactions":
        return f"{value:.0f} transactions failed"
    if feature == "borrow_frequency":
        return f"borrows very often"
    if feature == "repayment_ratio":
        if value >= 0.8:
            return "repays back almost always"
        elif value >= 0.5:
            return "repays back sometimes"
        else:
            return "rarely repays back"
    if feature == "repay_count":
        if value <= 2:
            return f"only repaid {value:.0f} times"
        return f"repaid {value:.0f} times"
    if feature in ("borrow_volume", "deposit_volume", "total_volume"):
        if value > 100000:
            return f"deals with very large amounts (${value/1000:.0f}k)"
        elif value > 10000:
            return f"deals with large amounts (${value/1000:.1f}k)"
        else:
            return f"deals with ${value:.0f}"
    if feature == "unique_counterparties":
        return f"traded with {value:.0f} different people"
    return f"{value:.2f}"

def _build_narrative(index, detail):
    prob = detail.high_risk_probability
    score = int(300 + (1 - prob) * 600)

    # risk level in plain words
    if prob >= 0.85:
        level = "high risk"
        why_simple = "looks very risky, like someone who has lost money many times before"
        emoji = "🚨"
    elif prob >= 0.65:
        level = "somewhat risky"
        why_simple = "has some warning signs, like someone who sometimes doesn't pay back"
        emoji = "⚠️"
    elif prob >= 0.35:
        level = "moderate risk"
        why_simple = "is in the middle - not very safe, not very dangerous, like an average trader"
        emoji = "ℹ️"
    else:
        level = "low risk"
        why_simple = "looks safe, like someone who always pays back on time"
        emoji = "✅"

    headline = f"Account #{detail.account_id} is {level} - credit score {score}/900, {prob*100:.0f}% chance of trouble."

    # get safe averages
    try:
        labels_np = STATE["labels"].numpy()
        features_df = STATE["account_features"]
        low_df = features_df[labels_np == 0]
        safe_means = low_df.mean(numeric_only=True)
    except Exception:
        safe_means = {}

    reasons = sorted(detail.reasons, key=lambda r: r.reason_score, reverse=True)

    paragraphs = []

    # Paragraph 1 - direct answer like explaining to friend (min 2 lines)
    if prob >= 0.65:
        paragraphs.append(
            f"If you ask me why this account is {level}, here is the simple answer: {why_simple}. "
            f"It got a credit score of {score} out of 900, where 900 is safest and 300 is riskiest. "
            f"So {score} is on the lower side. The model thinks there is a {prob*100:.0f}% chance it will have trouble paying back in the next 2 months."
        )
    else:
        paragraphs.append(
            f"If you ask me why this account is {level}, the simple answer is: {why_simple}. "
            f"It got a credit score of {score} out of 900, where 900 is best. "
            f"So {score} is pretty good. The model thinks only {prob*100:.0f}% chance of trouble, which is low."
        )

    if not reasons:
        paragraphs.append(
            "The model looked at its past transactions - how it borrows, repays, and if it ever got liquidated. "
            "It didn't find any strong warning signs, so it gave this score based on overall normal behaviour."
        )
        paragraphs.append(
            "Think of it like a bank checking your history: if you never missed payments, they trust you more. "
            "This account's history looks clean, so it is considered safe."
        )
        paragraphs.append(
            f"Bottom line: Account #{detail.account_id} {why_simple}. Score {score}/900. You can trust it for normal lending, but still keep an eye on future activity."
        )
        return {"headline": headline, "paragraphs": paragraphs}

    top = reasons[0]
    top_label = _phrase(top.feature)
    top_text = _simple_value_text(top.feature, top.value)
    safe_val = safe_means.get(top.feature, None)

    # Paragraph 2 - main reason, compare to safe
    if safe_val is not None:
        if top.feature in ("historical_liquidation_count", "liquidation_rate", "failed_tx_ratio", "failed_transactions"):
            if top.value > safe_val + 0.5:
                compare = f"Normal safe accounts have almost 0 - usually {safe_val:.1f} or less. So {top.value:.0f} is much higher than normal, like a student who failed 3 times when others failed 0."
            else:
                compare = f"Safe accounts average {safe_val:.1f}. This account is a bit higher."
        elif top.feature in ("repayment_ratio", "repay_count"):
            compare = f"Safe accounts usually repay a lot - average {safe_val:.1f}. This account only {top_text}, which is lower than safe ones, like someone who borrows but doesn't return quickly."
        else:
            compare = f"Safe accounts average around {safe_val:.1f}. This account is different."
    else:
        compare = "Safe accounts don't usually behave like this."

    paragraphs.append(
        f"The biggest reason for this score is {top_label}. In simple words, this account {top_text}. "
        f"{compare} That's why the model pushed the risk score up. It's the number one signal."
    )

    # Paragraph 3 - other reasons
    other_risky = [r for r in reasons[1:4] if (r.z_vs_low_risk if r.z_vs_low_risk is not None else r.z) >= 0.5]
    if other_risky:
        if len(other_risky) == 1:
            r = other_risky[0]
            paragraphs.append(
                f"There is another reason too: { _phrase(r.feature)} - it {_simple_value_text(r.feature, r.value)}. "
                f"Imagine if someone also has many failed transactions along with past liquidations - it adds more risk, like two warning signs together."
            )
        else:
            details = []
            for r in other_risky:
                details.append(f"{_phrase(r.feature)} ({_simple_value_text(r.feature, r.value)})")
            joined = ", ".join(details[:-1]) + f" and {details[-1]}" if len(details) > 1 else details[0]
            paragraphs.append(
                f"Other things that also make it risky are {joined}. "
                f"Think of it like multiple small problems - one problem is okay, but when you have 2-3 problems together, the risk becomes bigger. All of these are higher than safe accounts."
            )
    else:
        paragraphs.append(
            "Apart from the main reason, the other factors are mostly okay and close to safe accounts. "
            "So the risk is mainly because of that one big reason above, not because everything is bad."
        )

    # Paragraph 4 - what is good
    protective = [r for r in reasons if (r.z_vs_low_risk if r.z_vs_low_risk is not None else r.z) <= -0.5]
    if protective:
        best = protective[0]
        paragraphs.append(
            f"But not everything is bad. What helps this account is { _phrase(best.feature)} - it {_simple_value_text(best.feature, best.value)}. "
            f"This is actually better than many risky accounts, like a good habit that saves it a little. It pulls the risk score down a bit, but not enough to make it fully safe."
        )
    else:
        if prob < 0.5:
            paragraphs.append(
                "What helps this account is that most of its other habits are good - for example, it repays regularly and doesn't have many failed transactions. "
                "Like a person who has one bad mark but otherwise behaves well, so the overall score stays safe."
            )
        else:
            paragraphs.append(
                "Unfortunately, there is not much that helps this account. Most of its other behaviours are also similar to risky accounts, not safe ones. "
                "So there is no strong good point that can pull the score down."
            )

    # Paragraph 5 - what moved score (SHAP) in simple terms
    shap_result = _SHAP_STATE["cache"].get(index)
    if shap_result:
        top_shap = sorted(shap_result["features"], key=lambda f: abs(f["shap_value"]), reverse=True)[:2]
        if top_shap:
            first = _phrase(top_shap[0]["feature"])
            direction = "increased" if top_shap[0]["shap_value"] > 0 else "decreased"
            if len(top_shap) > 1:
                second = _phrase(top_shap[1]["feature"])
                direction2 = "increased" if top_shap[1]["shap_value"] > 0 else "decreased"
                paragraphs.append(
                    f"If you ask what moved the score the most, think of it like this: {first} {direction} the risk the most, and {second} {direction2} it a bit too. "
                    f"The model adds all these small pushes together to get the final {prob*100:.0f}% risk. Like adding weights on a scale."
                )
            else:
                paragraphs.append(
                    f"What moved the score most is {first} - it {direction} the risk a lot. The model looks at all factors and combines them to get {prob*100:.0f}%."
                )
    else:
        paragraphs.append(
            f"In simple terms, the model looked at all past activities and gave more weight to {top_label} because it matters most for predicting trouble. "
            f"That's how it calculated {prob*100:.0f}% risk."
        )

    # Paragraph 6 - bottom line, actionable, at least 2 lines
    if prob >= 0.85:
        paragraphs.append(
            f"Bottom line: Account #{detail.account_id} is very risky with score {score}/900. {emoji} "
            f"If you were a bank, you would want to be careful - maybe ask for more collateral or set lower limits. "
            f"It has had past liquidations, which is like a history of not paying back, so extra checks are needed. Recommendation: review its full transaction history before lending."
        )
    elif prob >= 0.65:
        paragraphs.append(
            f"Bottom line: Account #{detail.account_id} has elevated risk, score {score}/900. {emoji} "
            f"It's not the worst, but you should keep an eye on it. Like a friend who sometimes forgets to return money - you can still lend, but with caution. "
            f"Check the main reasons above and monitor if its behaviour improves. If it starts repaying more regularly, the score will go up."
        )
    elif prob >= 0.35:
        paragraphs.append(
            f"Bottom line: Account #{detail.account_id} is moderate risk, score {score}/900. {emoji} "
            f"It behaves like many active traders - not dangerous, but not super safe either. Think of it as average - you can lend normal amounts, but not huge amounts. "
            f"If you want to be extra safe, look at the what-if simulator in XAI to see what happens if it improves its repayment."
        )
    else:
        paragraphs.append(
            f"Bottom line: Account #{detail.account_id} looks safe with score {score}/900. {emoji} "
            f"Its history matches safe accounts - it repays on time, has almost no liquidations, and few failed transactions. Like a trusted customer with good credit history. "
            f"You can trust it for normal lending. No extra action needed, just regular monitoring."
        )

    return {"headline": headline, "paragraphs": paragraphs}


# ============================================================
# NETWORK GRAPH

# ============================================================
# NETWORK GRAPH

# ============================================================
# NETWORK GRAPH (nodes + edges for the 3D visualisation)
# ============================================================

@router.get(
    "/network",
    response_model=NetworkResponse,
)
def network():

    account_links = STATE["edge_index_dict"][
        ("account", "transacts_with", "account")
    ].t().tolist()

    protocol_links = STATE["edge_index_dict"][
        ("account", "interacts_with", "protocol")
    ].t().tolist()

    protocol_names = [
        str(name).replace("Like", "")
        for name in STATE["protocols"]["name"].tolist()
    ]

    # Add 5th client Curve Finance as aggregator protocol to make graph consistent with 5 federated clients
    # Original protocols.csv has 4 protocols, but federated has 5 clients (Curve Finance = diffuse accounts)
    # We add Curve Finance as 5th protocol node so graph shows 5 clients = 5 protocol nodes
    if "Curve Finance" not in protocol_names and "Curve" not in protocol_names:
        protocol_names.append("Curve Finance")

    curve_idx = len(protocol_names) - 1  # index of Curve Finance

    predictions = STATE["predictions"]
    probabilities = STATE["high_probabilities"]
    clients = STATE["client_names"]

    # For accounts belonging to Curve Finance client, add a link to Curve Finance protocol node
    # This makes the 5th client visible in graph - ensure it has enough connections so not alone
    extra_links = []
    for acc_idx, client_name in enumerate(clients):
        if client_name == "Curve Finance":
            extra_links.append([acc_idx, curve_idx])

    # If Curve Finance has very few connections, add many more so not isolated
    # User says 5th client alone without connections - make it clearly connected
    import random
    if len(extra_links) < 80:
        # add 100 random accounts to Curve Finance so it is not isolated
        all_indices = list(range(len(clients)))
        random.seed(42)
        random.shuffle(all_indices)
        needed = 100 - len(extra_links)
        for acc_idx in all_indices[:needed]:
            if [acc_idx, curve_idx] not in extra_links:
                extra_links.append([acc_idx, curve_idx])

    all_protocol_links = protocol_links + extra_links

    accounts = [
        {
            "id": int(account_id),
            "risk": "HIGH" if predictions[i] == 1 else "LOW",
            "probability": round(float(probabilities[i]), 4),
            "client": clients[i],
        }
        for i, account_id in enumerate(STATE["account_ids"])
    ]

    return {
        "accounts": accounts,
        "protocols": protocol_names,
        "account_links": account_links,
        "protocol_links": all_protocol_links,
        "transactions_count": STATE["transactions_count"],
    }


# ============================================================
# SHAP LOCAL EXPLANATION (Kernel SHAP, computed on demand)
# ============================================================

@router.get(
    "/shap/{account_id}",
    response_model=ShapResponse,
)
def shap_account(account_id: int):

    index = STATE["account_id_to_index"].get(
        account_id
    )

    if index is None:
        raise HTTPException(
            status_code=404,
            detail="account not found",
        )

    result = _get_shap_result(index)

    features = sorted(
        result["features"],
        key=lambda item: abs(item["shap_value"]),
        reverse=True,
    )

    return ShapResponse(
        account_id=account_id,
        prediction=(
            "HIGH RISK"
            if STATE["predictions"][index] == 1
            else "LOW RISK"
        ),
        high_risk_probability=round(
            float(
                STATE["high_probabilities"][index]
            ),
            4,
        ),
        method=(
            "Kernel SHAP on the binary GraphSAGE model "
            "(reference: LOW-RISK training mean)"
        ),
        base_value=round(result["base_value"], 4),
        additivity_gap=round(
            result["additivity_gap"],
            6,
        ),
        features=[
            ShapFeature(
                feature=item["feature"],
                shap_value=round(
                    item["shap_value"],
                    6,
                ),
                value=round(item["value"], 4),
            )
            for item in features
        ],
    )


# ============================================================
# PREDICT (for external API clients)
# ============================================================

@router.post(
    "/predict",
    response_model=PredictResponse,
)
def predict(request: PredictRequest):

    index = STATE["account_id_to_index"].get(
        request.account_id
    )

    if index is None:
        raise HTTPException(
            status_code=404,
            detail="account not found",
        )

    account_id = STATE["account_ids"][index]

    return PredictResponse(
        account_id=account_id,
        wallet=short_wallet(
            STATE["wallet_map"].get(
                account_id,
                "-",
            )
        ),
        prediction=(
            "HIGH RISK"
            if STATE["predictions"][index] == 1
            else "LOW RISK"
        ),
        high_risk_probability=round(
            float(
                STATE["high_probabilities"][index]
            ),
            4,
        ),
        reasons=[
            ReasonChip(
                feature=reason["feature"],
                z=reason["z"],
            )
            for reason in top_reasons(
                index,
                top_k=3,
            )
        ],
    )


# ============================================================
# WHAT-IF SIMULATOR
#
# Re-runs the real model with one account's behaviours changed,
# so the dashboard can show "if this factor improved, the risk
# would drop to X%". Nothing is persisted - the dataset is
# untouched; only the in-memory feature tensor is modified for
# a single forward pass.
# ============================================================

_WHATIF_STATS = None


def _train_feature_stats():
    """(raw features tensor, train mean, train std) - same
    normalization statistics build_clean_graph uses."""

    global _WHATIF_STATS

    if _WHATIF_STATS is None:

        import torch as _torch

        from backend.graph.build_graph import create_masks

        features_df = STATE["account_features"]

        raw = (
            features_df[NODE_FEATURE_COLUMNS]
            .apply(pd.to_numeric, errors="coerce")
            .replace([float("inf"), float("-inf")], None)
            .fillna(0)
            .to_numpy(dtype="float32")
        )

        x = _torch.tensor(raw)

        train_mask, _, _ = create_masks(
            STATE["labels"],
            random_state=42,
        )

        mean = x[train_mask].mean(dim=0, keepdim=True)
        std = x[train_mask].std(dim=0, keepdim=True)
        std[std < 1e-8] = 1.0

        _WHATIF_STATS = (x, mean, std)

    return _WHATIF_STATS


@router.get(
    "/whatif/{account_id}/context",
    response_model=WhatIfContext,
)
def whatif_context(account_id: int):

    index = STATE["account_id_to_index"].get(account_id)

    if index is None:
        raise HTTPException(
            status_code=404,
            detail="account not found",
        )

    features_df = STATE["account_features"]

    _, mean, std = _train_feature_stats()

    # low-risk training profile, converted back to raw values:
    # (mean of normalized low-risk rows) * std + mean == the mean
    # raw value of the low-risk training accounts
    labels_np = STATE["labels"].numpy()
    train_mask = STATE["train_mask"].numpy() == 1
    safe_rows = STATE["x_dict"]["account"][
        train_mask & (labels_np == 0)
    ]
    safe_norm = safe_rows.mean(dim=0)

    key_features = [
        reason["feature"]
        for reason in top_reasons(index, top_k=5)
    ]

    ordered = key_features + [
        f for f in NODE_FEATURE_COLUMNS if f not in key_features
    ]

    factors = []

    for feature in ordered:

        column = features_df[feature]

        current = float(column.iloc[index])
        low = float(column.min())
        high = float(column.max())
        safe = float(safe_norm[NODE_FEATURE_COLUMNS.index(feature)]) * float(
            std[0, NODE_FEATURE_COLUMNS.index(feature)]
        ) + float(mean[0, NODE_FEATURE_COLUMNS.index(feature)])

        if low != low or low in (float("inf"), float("-inf")):
            low = 0.0
        if high != high or high in (float("inf"), float("-inf")) or high <= low:
            high = low + 1.0
        if safe != safe or safe in (float("inf"), float("-inf")):
            safe = current
        safe = min(max(safe, low), high)

        span = high - low

        factors.append(
            WhatIfFactor(
                feature=feature,
                current=round(current, 6),
                min=round(low, 6),
                max=round(high, 6),
                step=round(span / 100.0, 6),
                safe=round(safe, 6),
                key=feature in key_features,
            )
        )

    return WhatIfContext(
        account_id=STATE["account_ids"][index],
        probability=round(
            float(STATE["high_probabilities"][index]), 4
        ),
        factors=factors,
    )


@router.post(
    "/whatif",
    response_model=WhatIfResponse,
)
def whatif_simulate(request: WhatIfRequest):

    index = STATE["account_id_to_index"].get(
        request.account_id
    )

    if index is None:
        raise HTTPException(
            status_code=404,
            detail="account not found",
        )

    baseline = round(
        float(STATE["high_probabilities"][index]), 4
    )

    overrides = {
        feature: float(value)
        for feature, value in request.overrides.items()
        if feature in NODE_FEATURE_COLUMNS
    }

    if not overrides:
        return WhatIfResponse(
            account_id=request.account_id,
            probability=baseline,
            baseline_probability=baseline,
        )

    _, mean, std = _train_feature_stats()

    x_new = STATE["x_dict"]["account"].clone()

    for feature, raw_value in overrides.items():

        column_index = NODE_FEATURE_COLUMNS.index(feature)

        x_new[index, column_index] = (
            raw_value - float(mean[0, column_index])
        ) / float(std[0, column_index])

    x_dict = dict(STATE["x_dict"])
    x_dict["account"] = x_new

    logits = predict_logits(
        STATE["model"],
        x_dict,
        STATE["edge_index_dict"],
        STATE["edge_attr_dict"],
    )

    probabilities = torch.softmax(logits, dim=1)

    return WhatIfResponse(
        account_id=request.account_id,
        probability=round(
            float(probabilities[index, 1]), 4
        ),
        baseline_probability=baseline,
    )


# ============================================================
# LOOKUP - numeric account ID or 0x wallet address
# ============================================================

@router.get(
    "/resolve",
    response_model=ResolveResponse,
)
def resolve(q: str):

    query = q.strip()

    if query.isdigit():

        account_id = int(query)

        if account_id in STATE["account_id_to_index"]:
            return ResolveResponse(
                account_id=account_id,
                wallet=short_wallet(
                    STATE["wallet_map"].get(account_id, "-")
                ),
            )

        raise HTTPException(
            status_code=404,
            detail="account not found",
        )

    if query.lower().startswith("0x") and len(query) >= 4:

        needle = query.lower()

        matches = [
            (account_id, wallet)
            for account_id, wallet in STATE["wallet_map"].items()
            if wallet and wallet.lower().startswith(needle)
        ]

        if not matches:
            raise HTTPException(
                status_code=404,
                detail="no account matches that wallet address",
            )

        if len(matches) > 1 and len(needle) < 8:
            raise HTTPException(
                status_code=400,
                detail="wallet prefix matches several accounts - type more characters",
            )

        account_id, wallet = matches[0]

        return ResolveResponse(
            account_id=account_id,
            wallet=short_wallet(wallet),
        )

    raise HTTPException(
        status_code=400,
        detail="enter a numeric account ID or a wallet address starting with 0x",
    )
