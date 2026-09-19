from __future__ import annotations

"""
API SCHEMAS - REQUEST/RESPONSE STRUCTURES
=========================================

Pydantic models defining the API contract (request bodies and
response shapes) for the frontend and external applications.
"""

from typing import List, Optional

from pydantic import BaseModel


# ============================================================
# REQUESTS
# ============================================================

class PredictRequest(BaseModel):

    account_id: int


# ============================================================
# RESPONSES
# ============================================================

class HealthResponse(BaseModel):

    status: str
    model_loaded: bool


class ReasonChip(BaseModel):

    feature: str
    z: float


class AccountSummary(BaseModel):

    account_id: int
    wallet: str
    client: str
    prediction: str
    high_risk_probability: float
    reasons: List[ReasonChip]


class PaginatedAccounts(BaseModel):

    total: int
    page: int
    pages: int
    page_size: int
    accounts: List[AccountSummary]


class Reason(BaseModel):

    feature: str
    value: float
    z_vs_low_risk: float
    importance_weight: float
    reason_score: float
    gradient_attribution: Optional[float] = None


class FeatureValue(BaseModel):

    feature: str
    value: float
    z: float


class AccountDetail(BaseModel):

    account_id: int
    wallet: str
    client: str
    actual_label: str
    prediction: str
    high_risk_probability: float
    reasons: List[Reason]
    features: List[FeatureValue]


class PredictResponse(BaseModel):

    account_id: int
    wallet: str
    prediction: str
    high_risk_probability: float
    reasons: List[ReasonChip]


class ModelInfo(BaseModel):

    type: str
    task: str
    test_accuracy: Optional[float]
    macro_f1: Optional[float]
    features: int
    seeded: bool
    leakage_free: bool


class DatasetInfo(BaseModel):

    accounts: int
    observation_window: str
    outcome_window: str
    actual_high_risk: int
    predicted_high_risk: int


class FederatedInfo(BaseModel):

    trained: bool
    method: Optional[str]
    clients: Optional[List[str]]
    rounds: Optional[int]
    test_accuracy: Optional[float]
    macro_f1: Optional[float]


class TopFeature(BaseModel):

    feature: str
    importance: float


class StatsResponse(BaseModel):

    model: ModelInfo
    dataset: DatasetInfo
    clients: Optional[FederatedInfo]
    top_features: List[TopFeature]


class ImportanceItem(BaseModel):

    feature: str
    importance_drop: float
    rank: int


class ImportanceResponse(BaseModel):

    baseline_macro_f1: float
    features: List[ImportanceItem]


class ShapFeature(BaseModel):

    feature: str
    shap_value: float
    value: float


class ShapResponse(BaseModel):

    account_id: int
    prediction: str
    high_risk_probability: float
    method: str
    base_value: float
    additivity_gap: float
    features: List[ShapFeature]
