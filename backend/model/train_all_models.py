import os
import copy

import torch
import torch.nn as nn

from sklearn.metrics import (
    accuracy_score,
    recall_score,
    f1_score,
    classification_report,
)

from backend.model.gnn_model import HeterogeneousModel


# ============================================================
# CONFIGURATION
# ============================================================

GRAPH_PATH = "datasets/processed/graph_normalized.pt"

SAVE_DIR = "backend/model/saved_models"

MODELS = [
    "gcn",
    "sage",
    "gat",
    "transformer",
]

HIDDEN_CHANNELS = 32

NUM_CLASSES = 3

LEARNING_RATE = 0.01

WEIGHT_DECAY = 5e-4

EPOCHS = 150

HEADS = 4

DROPOUT = 0.25


# ============================================================
# DEVICE
# ============================================================

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)


# ============================================================
# LOAD GRAPH
# ============================================================

print("Loading graph...")

graph = torch.load(
    GRAPH_PATH,
    weights_only=False,
)

print("Graph loaded successfully.")

print(
    f"Accounts: {graph['account'].x.shape[0]}"
)

print(
    f"Protocols: {graph['protocol'].x.shape[0]}"
)


# ============================================================
# MOVE GRAPH TO DEVICE
# ============================================================

x_dict = {
    key: value.x.to(DEVICE)
    for key, value in graph.node_items()
}

edge_index_dict = {
    key: value.edge_index.to(DEVICE)
    for key, value in graph.edge_items()
}

edge_attr_dict = {
    key: value.edge_attr.to(DEVICE)
    for key, value in graph.edge_items()
}


# ============================================================
# LABELS
# ============================================================

labels = graph["account"].y.to(DEVICE)

train_mask = graph["account"].train_mask.to(DEVICE)

val_mask = graph["account"].val_mask.to(DEVICE)

test_mask = graph["account"].test_mask.to(DEVICE)


# ============================================================
# CLASS INFORMATION
# ============================================================

train_labels = labels[train_mask]

class_counts = torch.bincount(
    train_labels,
    minlength=NUM_CLASSES,
)

print("\nTraining class distribution:")

print(class_counts)


# ============================================================
# CLASS WEIGHTS
# ============================================================

# Inverse-frequency weighting.
#
# More weight is given to MEDIUM/HIGH because they have
# fewer training examples than LOW.

class_weights = (
    class_counts.sum().float()
    / (
        NUM_CLASSES
        * class_counts.float()
    )
)

class_weights = class_weights.to(
    DEVICE
)

print("\nClass weights:")

print(class_weights)


# ============================================================
# CLASS MAPPING
# ============================================================

print("\nClass mapping:")

print("0 = LOW")

print("1 = MEDIUM")

print("2 = HIGH")


# ============================================================
# CREATE SAVE DIRECTORY
# ============================================================

os.makedirs(
    SAVE_DIR,
    exist_ok=True,
)


# ============================================================
# TRAIN ONE MODEL
# ============================================================

def train_model(model_type):

    print("\n")
    print("=" * 70)

    if model_type == "sage":

        display_name = "GraphSAGE"

    elif model_type == "gcn":

        display_name = "GCN"

    elif model_type == "gat":

        display_name = "GAT"

    elif model_type == "transformer":

        display_name = "Graph Transformer"

    else:

        display_name = model_type

    print(
        f"TRAINING: {display_name}"
    )

    print("=" * 70)


    # ========================================================
    # CREATE MODEL
    # ========================================================

    model = HeterogeneousModel(
        model_type=model_type,
        hidden_channels=HIDDEN_CHANNELS,
        num_classes=NUM_CLASSES,
        heads=HEADS,
        dropout=DROPOUT,
    ).to(DEVICE)

    print("Model created.")


    # ========================================================
    # LOSS
    # ========================================================

    # IMPORTANT:
    #
    # We intentionally use weighted CrossEntropyLoss.
    #
    # We are NOT using focal loss here because the previous
    # focal-loss experiment caused excessive minority-class
    # emphasis and unstable predictions.

    criterion = nn.CrossEntropyLoss(
        weight=class_weights
    )


    # ========================================================
    # OPTIMIZER
    # ========================================================

    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=LEARNING_RATE,
        weight_decay=WEIGHT_DECAY,
    )


    # ========================================================
    # BEST MODEL TRACKING
    # ========================================================

    best_val_accuracy = -1.0

    best_state = None


    # ========================================================
    # TRAINING
    # ========================================================

    for epoch in range(
        1,
        EPOCHS + 1,
    ):

        model.train()

        optimizer.zero_grad()


        # ----------------------------------------------------
        # Forward
        # ----------------------------------------------------

        logits = model(
            x_dict,
            edge_index_dict,
            edge_attr_dict,
        )


        # ----------------------------------------------------
        # Training loss
        # ----------------------------------------------------

        loss = criterion(
            logits[train_mask],
            labels[train_mask],
        )


        # ----------------------------------------------------
        # Backpropagation
        # ----------------------------------------------------

        loss.backward()

        optimizer.step()


        # ====================================================
        # VALIDATION
        # ====================================================

        model.eval()

        with torch.no_grad():

            val_logits = model(
                x_dict,
                edge_index_dict,
                edge_attr_dict,
            )

            val_predictions = (
                val_logits[val_mask]
                .argmax(dim=1)
            )

            val_accuracy = accuracy_score(
                labels[val_mask]
                .cpu()
                .numpy(),
                val_predictions
                .cpu()
                .numpy(),
            )


        # ====================================================
        # SAVE BEST MODEL
        # ====================================================

        if val_accuracy > best_val_accuracy:

            best_val_accuracy = val_accuracy

            best_state = copy.deepcopy(
                model.state_dict()
            )


        # ====================================================
        # PRINT PROGRESS
        # ====================================================

        if epoch % 10 == 0:

            print(
                f"Epoch {epoch:03d} | "
                f"Loss: {loss.item():.4f} | "
                f"Val Accuracy: {val_accuracy:.4f}"
            )


    # ========================================================
    # RESTORE BEST MODEL
    # ========================================================

    if best_state is not None:

        model.load_state_dict(
            best_state
        )


    # ========================================================
    # TESTING
    # ========================================================

    model.eval()

    with torch.no_grad():

        logits = model(
            x_dict,
            edge_index_dict,
            edge_attr_dict,
        )

        predictions = (
            logits[test_mask]
            .argmax(dim=1)
        )


    # ========================================================
    # CONVERT TO NUMPY
    # ========================================================

    y_true = (
        labels[test_mask]
        .cpu()
        .numpy()
    )

    y_pred = (
        predictions
        .cpu()
        .numpy()
    )


    # ========================================================
    # METRICS
    # ========================================================

    test_accuracy = accuracy_score(
        y_true,
        y_pred,
    )

    macro_recall = recall_score(
        y_true,
        y_pred,
        average="macro",
        zero_division=0,
    )

    macro_f1 = f1_score(
        y_true,
        y_pred,
        average="macro",
        zero_division=0,
    )

    high_recall = recall_score(
        y_true,
        y_pred,
        labels=[2],
        average="macro",
        zero_division=0,
    )

    high_f1 = f1_score(
        y_true,
        y_pred,
        labels=[2],
        average="macro",
        zero_division=0,
    )


    # ========================================================
    # RESULTS
    # ========================================================

    print("\n")

    print("-" * 70)

    print(
        f"{display_name} RESULTS"
    )

    print("-" * 70)

    print(
        f"Best Validation Accuracy: "
        f"{best_val_accuracy:.4f}"
    )

    print(
        f"Test Accuracy: "
        f"{test_accuracy:.4f}"
    )

    print(
        f"Macro Recall: "
        f"{macro_recall:.4f}"
    )

    print(
        f"Macro F1: "
        f"{macro_f1:.4f}"
    )

    print(
        f"HIGH Risk Recall: "
        f"{high_recall:.4f}"
    )

    print(
        f"HIGH Risk F1: "
        f"{high_f1:.4f}"
    )


    print("\nClassification Report:")

    print(
        classification_report(
            y_true,
            y_pred,
            target_names=[
                "LOW",
                "MEDIUM",
                "HIGH",
            ],
            zero_division=0,
        )
    )


    # ========================================================
    # SAVE MODEL
    # ========================================================

    model_path = os.path.join(
        SAVE_DIR,
        f"{model_type}_model.pt",
    )

    torch.save(
        {
            "model_state_dict":
                model.state_dict(),

            "model_type":
                model_type,

            "hidden_channels":
                HIDDEN_CHANNELS,

            "num_classes":
                NUM_CLASSES,

            "heads":
                HEADS,

            "dropout":
                DROPOUT,

            "test_accuracy":
                test_accuracy,

            "macro_recall":
                macro_recall,

            "macro_f1":
                macro_f1,

            "high_recall":
                high_recall,

            "high_f1":
                high_f1,
        },
        model_path,
    )


    return {
        "model": display_name,

        "accuracy": test_accuracy,

        "macro_recall": macro_recall,

        "macro_f1": macro_f1,

        "high_recall": high_recall,

        "high_f1": high_f1,

        "best_val_accuracy":
            best_val_accuracy,
    }


# ============================================================
# TRAIN ALL MODELS
# ============================================================

results = []


for model_type in MODELS:

    try:

        result = train_model(
            model_type
        )

        results.append(
            result
        )

    except Exception as error:

        print("\n")

        print(
            f"ERROR while training "
            f"{model_type}:"
        )

        print(
            f"{type(error).__name__}: "
            f"{error}"
        )


# ============================================================
# FINAL COMPARISON
# ============================================================

print("\n")

print("=" * 90)

print(
    "FINAL GNN ARCHITECTURE COMPARISON"
)

print("=" * 90)

print(
    f"{'Model':<25}"
    f"{'Accuracy':>12}"
    f"{'Macro F1':>12}"
    f"{'HIGH Recall':>15}"
    f"{'HIGH F1':>12}"
)

print("-" * 90)


for result in results:

    print(
        f"{result['model']:<25}"
        f"{result['accuracy']:>12.4f}"
        f"{result['macro_f1']:>12.4f}"
        f"{result['high_recall']:>15.4f}"
        f"{result['high_f1']:>12.4f}"
    )


print("=" * 90)


# ============================================================
# BEST MODEL BY MACRO F1
# ============================================================

if results:

    best_model = max(
        results,
        key=lambda x: x["macro_f1"],
    )

    print("\n")

    print(
        f"Best model by Macro F1: "
        f"{best_model['model']}"
    )

    print(
        f"Macro F1: "
        f"{best_model['macro_f1']:.4f}"
    )

    print(
        f"Test Accuracy: "
        f"{best_model['accuracy']:.4f}"
    )

else:

    print(
        "\nNo models completed successfully."
    )


print("\n")

print(
    "All models saved in:"
)

print(
    os.path.abspath(SAVE_DIR)
)