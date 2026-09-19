from pathlib import Path
from sklearn.ensemble import HistGradientBoostingClassifier
import pandas as pd
import numpy as np
import torch

from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.neural_network import MLPClassifier

from sklearn.metrics import (
    accuracy_score,
    f1_score,
    recall_score,
    classification_report,
)

# Use EXACTLY the same node features and the EXACT same stratified
# split as the GNN pipeline, so the comparison is fair.

from backend.graph.build_graph import (
    NODE_FEATURE_COLUMNS,
    create_masks,
)


# ============================================================
# Paths
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATA_FILE = (
    PROJECT_ROOT
    / "datasets"
    / "processed"
    / "account_risk_dataset.csv"
)

# Feature rows must be in the SAME account order the graph uses
# (account_features.csv order), so that the masks align.

FEATURES_FILE = (
    PROJECT_ROOT
    / "datasets"
    / "processed"
    / "account_features.csv"
)


# ============================================================
# Configuration
# ============================================================

RANDOM_STATE = 42

FEATURE_COLUMNS = NODE_FEATURE_COLUMNS

LABEL_COLUMN = "risk_label"


# ============================================================
# Load dataset
# ============================================================

def load_data():

    print("Loading dataset...")

    features = pd.read_csv(FEATURES_FILE)

    risk = pd.read_csv(DATA_FILE)

    print(f"Accounts: {len(features)}")
    print(f"Features: {len(FEATURE_COLUMNS)}")

    # Align labels to account_features.csv order (graph node order).

    label_mapping = {
        "LOW": 0,
        "MEDIUM": 1,
        "HIGH": 2,
    }

    label_series = (
        risk[["account_id", LABEL_COLUMN]]
        .drop_duplicates("account_id")
        .set_index("account_id")[LABEL_COLUMN]
        .map(label_mapping)
    )

    y = (
        features["account_id"]
        .map(label_series)
        .astype(int)
    )

    if y.isna().any():
        raise ValueError("Unknown or missing risk labels.")

    X = features[FEATURE_COLUMNS].copy()

    print("\nOverall class distribution:")
    print(y.value_counts().sort_index())

    return X, y


# ============================================================
# Evaluation
# ============================================================

def evaluate_model(model_name, model, X_test, y_test):

    predictions = model.predict(X_test)

    accuracy = accuracy_score(
        y_test,
        predictions
    )

    macro_f1 = f1_score(
        y_test,
        predictions,
        average="macro",
        zero_division=0
    )

    macro_recall = recall_score(
        y_test,
        predictions,
        average="macro",
        zero_division=0
    )

    high_recall = recall_score(
        y_test,
        predictions,
        labels=[2],
        average="macro",
        zero_division=0
    )

    high_f1 = f1_score(
        y_test,
        predictions,
        labels=[2],
        average="macro",
        zero_division=0
    )

    print("\n" + "=" * 70)
    print(f"{model_name} RESULTS")
    print("=" * 70)

    print(f"Accuracy:      {accuracy:.4f}")
    print(f"Macro Recall:  {macro_recall:.4f}")
    print(f"Macro F1:      {macro_f1:.4f}")
    print(f"HIGH Recall:   {high_recall:.4f}")
    print(f"HIGH F1:       {high_f1:.4f}")

    print("\nClassification Report:")
    print(
        classification_report(
            y_test,
            predictions,
            target_names=[
                "LOW",
                "MEDIUM",
                "HIGH",
            ],
            zero_division=0
        )
    )

    return {
        "model": model_name,
        "accuracy": accuracy,
        "macro_recall": macro_recall,
        "macro_f1": macro_f1,
        "high_recall": high_recall,
        "high_f1": high_f1,
    }


# ============================================================
# Main
# ============================================================

def main():

    X, y = load_data()

    # --------------------------------------------------------
    # EXACT same stratified split as the graph pipeline
    # (backend.graph.build_graph.create_masks, seed 42).
    #
    # The previous version used sklearn train_test_split, which
    # produced a DIFFERENT set of train/val/test accounts than
    # the GNN used, making the comparison unfair.
    # --------------------------------------------------------

    labels_tensor = torch.tensor(
        y.values,
        dtype=torch.long,
    )

    train_mask, val_mask, test_mask = create_masks(
        labels_tensor,
        random_state=RANDOM_STATE,
    )

    X_train = X[train_mask.numpy()]
    X_test = X[test_mask.numpy()]

    y_train = y[train_mask.numpy()]
    y_test = y[test_mask.numpy()]

    print("\nSplit sizes (identical to GNN):")
    print(f"Training:   {len(X_train)}")
    print(f"Validation: {int(val_mask.sum())}")
    print(f"Test:        {len(X_test)}")

    print("\nTraining class distribution:")
    print(y_train.value_counts().sort_index())

    # ========================================================
    # Models
    # ========================================================

    models = [

        (
            "Logistic Regression",

            Pipeline([
                (
                    "scaler",
                    StandardScaler()
                ),
                (
                    "classifier",
                    LogisticRegression(
                        max_iter=2000,
                        class_weight="balanced",
                        random_state=RANDOM_STATE
                    )
                ),
            ])
        ),

        (
            "Random Forest",

            RandomForestClassifier(
                n_estimators=300,
                max_depth=None,
                min_samples_split=2,
                class_weight="balanced",
                random_state=RANDOM_STATE,
                n_jobs=-1
            )
        ),

        (
            "MLP",

            Pipeline([
                (
                    "scaler",
                    StandardScaler()
                ),
                (
                    "classifier",
                    MLPClassifier(
                        hidden_layer_sizes=(64, 32),
                        learning_rate_init=0.001,
                        max_iter=500,
                        early_stopping=True,
                        validation_fraction=0.15,
                        random_state=RANDOM_STATE
                    )
                ),
            ])
        ),
    ]
    # ============================================================
    # HistGradientBoosting
    # ============================================================

    print("\n" + "=" * 70)
    print("HISTOGRAM GRADIENT BOOSTING")
    print("=" * 70)

    hgb = HistGradientBoostingClassifier(
        max_iter=300,
        learning_rate=0.05,
        max_leaf_nodes=15,
        l2_regularization=1.0,
        random_state=42
    )

    hgb.fit(X_train, y_train)

    y_pred = hgb.predict(X_test)

    print("\nAccuracy:", accuracy_score(y_test, y_pred))
    print("Macro Recall:", recall_score(y_test, y_pred, average="macro"))
    print("Macro F1:", f1_score(y_test, y_pred, average="macro"))

    print("\nClassification Report:")
    print(
        classification_report(
            y_test,
            y_pred,
            target_names=["LOW", "MEDIUM", "HIGH"],
            zero_division=0
        )   
    )
    # ========================================================
    # Train and evaluate
    # ========================================================

    results = []

    for model_name, model in models:

        print("\n")
        print("#" * 70)
        print(f"TRAINING: {model_name}")
        print("#" * 70)

        model.fit(
            X_train,
            y_train
        )

        result = evaluate_model(
            model_name,
            model,
            X_test,
            y_test
        )

        results.append(result)

    # ========================================================
    # Final comparison
    # ========================================================

    print("\n\n")
    print("=" * 85)
    print("FINAL BASELINE MODEL COMPARISON")
    print("=" * 85)

    print(
        f"{'Model':<22}"
        f"{'Accuracy':>12}"
        f"{'Macro F1':>12}"
        f"{'HIGH Recall':>15}"
        f"{'HIGH F1':>12}"
    )

    print("-" * 85)

    for result in results:

        print(
            f"{result['model']:<22}"
            f"{result['accuracy']:>12.4f}"
            f"{result['macro_f1']:>12.4f}"
            f"{result['high_recall']:>15.4f}"
            f"{result['high_f1']:>12.4f}"
        )

    print("=" * 85)

    best = max(
        results,
        key=lambda x: x["macro_f1"]
    )

    print(
        f"\nBest traditional baseline: "
        f"{best['model']}"
    )

    print(
        f"Macro F1: {best['macro_f1']:.4f}"
    )

    print(
        f"Accuracy: {best['accuracy']:.4f}"
    )


if __name__ == "__main__":
    main()