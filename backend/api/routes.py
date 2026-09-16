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

from fastapi import APIRouter, HTTPException

from backend.api.dependencies import (
    STATE,
    short_wallet,
    top_reasons,
)
from backend.api.schemas import (
    AccountDetail,
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
    StatsResponse,
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

    return AccountDetail(
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
