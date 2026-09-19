from __future__ import annotations

"""
SHAP LOCAL EXPLANATIONS (Kernel SHAP)
=====================================

Per-account feature attribution for the production binary
GraphSAGE model using Kernel SHAP (Lundberg & Lee, 2017).

The GNN is treated as a BLACK BOX f(x) that maps ONE account's
13 node features -> P(HIGH RISK):

  * the account's row in x_dict["account"] is replaced by x
  * the WHOLE heterogeneous graph is re-run through the model
    (message passing stays intact - neighbours still influence
    the score; SHAP attributes only this account's own features)
  * the account's own probability is read out

Reference (background): the mean feature vector of LOW-RISK
TRAINING accounts, in model-input space. The base value
f(background) is therefore the expected P(HIGH RISK) for a
typical low-risk account, and the SHAP values explain the gap
between that reference and the actual prediction - the same
LOW-RISK reference used by the z-score reasons.

CLI (from the project root):

    python -m backend.explainability.shap_explainer [account_id ...]

Without arguments it picks three demo accounts (highest /
borderline / lowest predicted probability), prints their SHAP
tables, saves figures to reports/figures/ and reports the
global mean|SHAP| ranking vs permutation importance.
"""

import argparse

import numpy as np
import torch

from backend.explainability.feature_importance import (
    load_trained_model,
    permutation_importance,
    predict_logits,
)
from backend.federated.server import spearman_correlation
from backend.graph.build_graph import NODE_FEATURE_COLUMNS
from backend.model.train_binary import (
    PROJECT_ROOT,
    build_clean_graph,
    load_binary_data,
)

# ============================================================
# CONFIGURATION
# ============================================================

MODEL_TYPE = "sage"

SHAP_NSAMPLES = 400        # Kernel SHAP evaluations per account (local)

GLOBAL_SAMPLE_ACCOUNTS = 20  # test accounts sampled for the global ranking
GLOBAL_NSAMPLES = 200        # cheaper per-account budget for the global pass

SEED = 42

FIGURES_DIR = PROJECT_ROOT / "reports" / "figures"

IMPORTANCE_CSV = (
    PROJECT_ROOT
    / "datasets"
    / "processed"
    / "feature_importance_binary.csv"
)


# ============================================================
# BLACK-BOX MODEL WRAPPER
# ============================================================

class _AccountBlackBox:

    """
    Callable f(X) -> P(HIGH RISK) for the account currently being
    explained. X is (n, 13) candidate feature rows; each row is
    written into the account's node, the full graph is re-run and
    the account's own probability is returned.
    """

    def __init__(
        self,
        model,
        x_dict,
        edge_index_dict,
        edge_attr_dict,
    ):

        self.model = model
        self.x_dict = x_dict
        self.edge_index_dict = edge_index_dict
        self.edge_attr_dict = edge_attr_dict
        self.index = 0

    def __call__(self, X):

        X = np.atleast_2d(
            np.asarray(X, dtype=np.float32),
        )

        out = np.empty(len(X), dtype=np.float64)

        self.model.eval()

        with torch.no_grad():

            for k in range(len(X)):

                patched = self.x_dict["account"].clone()
                patched[self.index] = torch.from_numpy(X[k])

                patched_dict = dict(self.x_dict)
                patched_dict["account"] = patched

                logits = self.model(
                    patched_dict,
                    self.edge_index_dict,
                    self.edge_attr_dict,
                )

                probabilities = torch.softmax(
                    logits,
                    dim=1,
                )

                out[k] = float(
                    probabilities[self.index, 1]
                )

        return out


def build_background(x_dict, labels, train_mask):
    """
    Reference profile: mean (train-normalised) feature vector of
    LOW-RISK TRAINING accounts, shape (1, 13).
    """

    labels_np = (
        labels.numpy()
        if torch.is_tensor(labels)
        else np.asarray(labels)
    )

    rows = x_dict["account"][
        (train_mask.numpy() == 1)
        & (labels_np == 0)
    ]

    return (
        rows.mean(dim=0)
        .reshape(1, -1)
        .numpy()
        .astype(np.float64)
    )


def build_shap_explainer(
    model,
    x_dict,
    edge_index_dict,
    edge_attr_dict,
    labels,
    train_mask,
):
    """
    Returns (explainer, black_box). The black box's `index`
    attribute selects the account to explain, so ONE explainer
    can serve every account (built once, reused by the API).
    """

    import shap  # heavy import - kept lazy

    black_box = _AccountBlackBox(
        model,
        x_dict,
        edge_index_dict,
        edge_attr_dict,
    )

    background = build_background(
        x_dict,
        labels,
        train_mask,
    )

    explainer = shap.KernelExplainer(
        black_box,
        background,
    )

    return explainer, black_box


# ============================================================
# PER-ACCOUNT SHAP VALUES
# ============================================================

def explain_index(
    explainer,
    black_box,
    index,
    nsamples=SHAP_NSAMPLES,
    feature_names=None,
):

    """
    SHAP values for one account. Returns a dict with the base
    value, the model output, the additivity check and the
    per-feature attributions ALIGNED with `feature_names`
    (unsorted - callers sort for display).
    """

    if feature_names is None:
        feature_names = NODE_FEATURE_COLUMNS

    black_box.index = index

    x_row = (
        black_box.x_dict["account"][index]
        .reshape(1, -1)
        .numpy()
        .astype(np.float64)
    )

    np.random.seed(SEED)

    shap_values = np.asarray(
        explainer.shap_values(
            x_row,
            nsamples=nsamples,
            silent=True,
        ),
    ).ravel()

    base_value = float(
        np.asarray(explainer.expected_value)
        .ravel()[0]
    )

    fx = float(black_box(x_row)[0])

    features = [
        {
            "feature": name,
            "shap_value": float(shap_values[j]),
            "value": float(x_row[0, j]),
        }
        for j, name in enumerate(feature_names)
    ]

    return {
        "index": int(index),
        "base_value": base_value,
        "prediction_probability": fx,
        "additivity_gap": abs(
            base_value + float(shap_values.sum()) - fx
        ),
        "features": features,
    }


# ============================================================
# GLOBAL SHAP IMPORTANCE (sample of test accounts)
# ============================================================

def global_shap_importance(
    explainer,
    black_box,
    test_mask,
    n_accounts=GLOBAL_SAMPLE_ACCOUNTS,
    nsamples=GLOBAL_NSAMPLES,
    feature_names=None,
):
    """
    Mean |SHAP| per feature over a seeded sample of TEST
    accounts - the SHAP-side global ranking, comparable with
    permutation importance.
    """

    if feature_names is None:
        feature_names = NODE_FEATURE_COLUMNS

    test_indices = np.where(
        test_mask.numpy() == 1
    )[0]

    generator = np.random.default_rng(SEED)

    sample = generator.choice(
        test_indices,
        size=min(n_accounts, len(test_indices)),
        replace=False,
    )

    abs_sum = np.zeros(len(feature_names))

    for index in sample:

        result = explain_index(
            explainer,
            black_box,
            int(index),
            nsamples=nsamples,
            feature_names=feature_names,
        )

        for j, item in enumerate(result["features"]):
            abs_sum[j] += abs(item["shap_value"])

    mean_abs = abs_sum / len(sample)

    ranking = sorted(
        zip(feature_names, mean_abs),
        key=lambda pair: pair[1],
        reverse=True,
    )

    return {
        "n_accounts": int(len(sample)),
        "mean_abs_shap": {
            name: float(value)
            for name, value in ranking
        },
    }


# ============================================================
# FIGURES
# ============================================================

def save_local_figure(result, account_id, path):
    """
    Diverging horizontal bar chart of one account's SHAP values
    (red = pushes towards HIGH RISK, blue = towards LOW RISK).
    """

    import matplotlib

    matplotlib.use("Agg")

    import matplotlib.pyplot as plt

    features = sorted(
        result["features"],
        key=lambda item: abs(item["shap_value"]),
    )

    names = [item["feature"] for item in features]
    values = [item["shap_value"] for item in features]

    colors = [
        "#e4572e" if v > 0 else "#4c6ef5"
        for v in values
    ]

    _, axis = plt.subplots(
        figsize=(9, 6),
    )

    axis.barh(names, values, color=colors)

    axis.axvline(0, color="black", linewidth=0.8)

    axis.set_xlabel("SHAP value (impact on P(HIGH RISK))")

    axis.set_title(
        f"Kernel SHAP - account {account_id}\n"
        f"base value (LOW-RISK reference) = "
        f"{result['base_value']:.4f}   "
        f"prediction = {result['prediction_probability']:.4f}"
    )

    axis.tick_params(axis="y", labelsize=8)

    plt.tight_layout()

    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    plt.savefig(path, dpi=150)

    plt.close()


def save_global_figure(global_result, path):
    """
    Horizontal bar chart of the global mean |SHAP| ranking.
    """

    import matplotlib

    matplotlib.use("Agg")

    import matplotlib.pyplot as plt

    items = list(
        global_result["mean_abs_shap"].items()
    )[::-1]

    names = [name for name, _ in items]
    values = [value for _, value in items]

    _, axis = plt.subplots(figsize=(9, 6))

    axis.barh(names, values, color="#2a9d8f")

    axis.set_xlabel("mean |SHAP| over sampled test accounts")

    axis.set_title(
        "Global SHAP importance "
        f"({global_result['n_accounts']} test accounts)"
    )

    axis.tick_params(axis="y", labelsize=8)

    plt.tight_layout()

    plt.savefig(path, dpi=150)

    plt.close()


# ============================================================
# CLI
# ============================================================

def _print_account(result, account_id):

    prediction = (
        "HIGH RISK"
        if result["prediction_probability"] >= 0.5
        else "LOW RISK"
    )

    print("=" * 70)
    print(f"SHAP LOCAL EXPLANATION - ACCOUNT {account_id}")
    print("=" * 70)
    print(
        f"Prediction         : {prediction}"
        f"  (P = {result['prediction_probability']:.4f})"
    )
    print(
        f"Reference (base)   : P = {result['base_value']:.4f}"
        "   [mean LOW-RISK training profile]"
    )
    print(
        f"Additivity gap     : "
        f"{result['additivity_gap']:.4f}"
        "   (base + sum(SHAP) vs prediction)"
    )
    print()
    print(f"{'Feature':<32}{'value (z)':>12}{'SHAP':>12}")
    print("-" * 56)

    for item in sorted(
        result["features"],
        key=lambda i: abs(i["shap_value"]),
        reverse=True,
    ):
        print(
            f"{item['feature']:<32}"
            f"{item['value']:>12.3f}"
            f"{item['shap_value']:>12.4f}"
        )

    print()


def main():

    parser = argparse.ArgumentParser(
        description="Kernel SHAP explanations for the binary model",
    )

    parser.add_argument(
        "account_ids",
        type=int,
        nargs="*",
        help="optional account ids to explain (default: 3 demos)",
    )

    args = parser.parse_args()

    # --------------------------------------------------------
    # Load data, graph and the production model.
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

    model, _ = load_trained_model(MODEL_TYPE)

    # --------------------------------------------------------
    # Build ONE explainer, reused for every account.
    # --------------------------------------------------------

    print("Building Kernel SHAP explainer "
          "(reference = LOW-RISK training mean)...")

    explainer, black_box = build_shap_explainer(
        model,
        x_dict,
        edge_index_dict,
        edge_attr_dict,
        labels,
        train_mask,
    )

    # --------------------------------------------------------
    # Choose demo accounts if none were given.
    # --------------------------------------------------------

    if args.account_ids:

        account_map = {
            account_id: index
            for index, account_id in enumerate(
                account_features["account_id"].tolist()
            )
        }

        targets = []

        for account_id in args.account_ids:

            index = account_map.get(account_id)

            if index is None:
                print(f"!! account {account_id} not found - skipped")
                continue

            targets.append((account_id, index))

    else:

        logits = predict_logits(
            model,
            x_dict,
            edge_index_dict,
            edge_attr_dict,
        )

        probabilities = (
            torch.softmax(logits, dim=1)[:, 1].numpy()
        )

        order = np.argsort(probabilities)

        account_ids = account_features[
            "account_id"
        ].tolist()

        demo_indices = [
            int(order[-1]),                       # highest risk
            int(
                min(
                    range(len(probabilities)),
                    key=lambda i: abs(
                        probabilities[i] - 0.5
                    ),
                )
            ),                                    # borderline
            int(order[0]),                        # lowest risk
        ]

        targets = [
            (account_ids[i], i) for i in demo_indices
        ]

    # --------------------------------------------------------
    # Local explanations.
    # --------------------------------------------------------

    results = {}

    for position, (account_id, index) in enumerate(targets):

        print(
            f"\n({position + 1}/{len(targets)}) "
            f"explaining account {account_id} "
            f"({SHAP_NSAMPLES} kernel samples)..."
        )

        result = explain_index(
            explainer,
            black_box,
            index,
        )

        results[account_id] = result

        _print_account(result, account_id)

    if results:

        top_account = targets[0][0]

        local_path = FIGURES_DIR / "shap_local.png"

        save_local_figure(
            results[top_account],
            top_account,
            local_path,
        )

        print(f"Saved: {local_path}")

    # --------------------------------------------------------
    # Global ranking + consistency with permutation importance.
    # --------------------------------------------------------

    print(
        f"\nComputing global mean |SHAP| over "
        f"{GLOBAL_SAMPLE_ACCOUNTS} sampled test accounts "
        f"({GLOBAL_NSAMPLES} samples each)..."
    )

    global_result = global_shap_importance(
        explainer,
        black_box,
        test_mask,
    )

    print()
    print(
        f"{'Feature':<32}{'mean |SHAP|':>14}"
    )
    print("-" * 46)

    for name, value in global_result[
        "mean_abs_shap"
    ].items():
        print(f"{name:<32}{value:>14.4f}")

    global_path = FIGURES_DIR / "shap_global.png"

    save_global_figure(global_result, global_path)

    print(f"\nSaved: {global_path}")

    # --------------------------------------------------------
    # Consistency: SHAP ranking vs permutation importance.
    # --------------------------------------------------------

    if IMPORTANCE_CSV.exists():

        import pandas as pd

        permutation = pd.read_csv(IMPORTANCE_CSV)

        permutation = permutation.set_index("feature")[
            "importance_drop"
        ]

        shap_series = pd.Series(
            global_result["mean_abs_shap"]
        )

        common = [
            feature
            for feature in NODE_FEATURE_COLUMNS
            if feature in permutation.index
        ]

        rho = spearman_correlation(
            [shap_series[feature] for feature in common],
            [permutation[feature] for feature in common],
        )

        print()
        print("=" * 70)
        print("CONSISTENCY - global SHAP vs permutation importance")
        print("=" * 70)
        print(f"Spearman rank correlation: {rho:.3f}")

        if rho >= 0.8:
            print("STRONG consistency - both methods agree.")
        elif rho >= 0.5:
            print(
                "MODERATE consistency - rankings broadly agree."
            )
        else:
            print(
                "LIMITED agreement - local attributions (SHAP) and "
                "global sensitivity (permutation) emphasise different "
                "features; both are reported."
            )

    print()
    print("SHAP EXPLANATIONS COMPLETE.")


if __name__ == "__main__":
    main()
