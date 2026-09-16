from __future__ import annotations

"""
EVALUATION METRICS
==================

Shared metric computation for every model family, so that all
comparisons (GNN vs tabular vs federated) use identical
definitions:

  * Accuracy
  * Macro Precision / Recall / F1
  * Positive-class (HIGH-RISK) Recall and F1
  * sklearn classification report (optional)
"""

from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
)


def compute_classification_metrics(
    y_true,
    y_pred,
    positive_label=1,
    report=False,
    target_names=None,
):

    metrics = {
        "accuracy": accuracy_score(y_true, y_pred),
        "macro_precision": precision_score(
            y_true,
            y_pred,
            average="macro",
            zero_division=0,
        ),
        "macro_recall": recall_score(
            y_true,
            y_pred,
            average="macro",
            zero_division=0,
        ),
        "macro_f1": f1_score(
            y_true,
            y_pred,
            average="macro",
            zero_division=0,
        ),
        "positive_recall": recall_score(
            y_true,
            y_pred,
            labels=[positive_label],
            average="macro",
            zero_division=0,
        ),
        "positive_f1": f1_score(
            y_true,
            y_pred,
            labels=[positive_label],
            average="macro",
            zero_division=0,
        ),
    }

    if report:

        metrics["report"] = classification_report(
            y_true,
            y_pred,
            target_names=target_names,
            zero_division=0,
        )

    return metrics
