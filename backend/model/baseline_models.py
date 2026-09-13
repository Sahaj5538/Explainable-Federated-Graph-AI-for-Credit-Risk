from pathlib import Path
from sklearn.ensemble import HistGradientBoostingClassifier
import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
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


# ============================================================
# Configuration
# ============================================================

RANDOM_STATE = 42

FEATURE_COLUMNS = [
    "transaction_count",
    "successful_transactions",
    "failed_transactions",
    "failed_tx_ratio",
    "total_volume",
    "borrow_count",
    "borrow_volume",
    "repay_count",
    "repay_volume",
    "repayment_ratio",
    "deposit_volume",
    "withdrawal_volume",
    "net_deposit_flow",
    "unique_counterparties",
    "unique_tokens",
    "unique_protocols",
    "active_days",
    "historical_liquidation_count",
    "borrow_to_repay_ratio",
    "withdrawal_to_deposit_ratio",
    "liquidation_rate",
    "borrow_intensity",
    "transactions_per_active_day",
]

LABEL_COLUMN = "risk_label"


# ============================================================
# Load dataset
# ============================================================

def load_data():

    print("Loading dataset...")

    df = pd.read_csv(DATA_FILE)

    print(f"Accounts: {len(df)}")
    print(f"Features: {len(FEATURE_COLUMNS)}")

    X = df[FEATURE_COLUMNS].copy()

    label_mapping = {
        "LOW": 0,
        "MEDIUM": 1,
        "HIGH": 2,
    }

    y = df[LABEL_COLUMN].map(label_mapping)

    if y.isna().any():
        raise ValueError("Unknown or missing risk labels.")

    y = y.astype(int)

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
    # Same stratified split strategy as graph construction
    # --------------------------------------------------------

    X_train, X_temp, y_train, y_temp = train_test_split(
        X,
        y,
        test_size=0.30,
        random_state=RANDOM_STATE,
        stratify=y,
    )

    X_val, X_test, y_val, y_test = train_test_split(
        X_temp,
        y_temp,
        test_size=0.50,
        random_state=RANDOM_STATE,
        stratify=y_temp,
    )

    print("\nSplit sizes:")
    print(f"Training:   {len(X_train)}")
    print(f"Validation:  {len(X_val)}")
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