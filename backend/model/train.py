from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.metrics import classification_report

from backend.model.gnn_model import HeteroGNN


PROJECT_ROOT = Path(__file__).resolve().parents[2]

GRAPH_FILE = (
    PROJECT_ROOT
    / "datasets"
    / "processed"
    / "graph_normalized.pt"
)

MODEL_FILE = (
    PROJECT_ROOT
    / "backend"
    / "model"
    / "gnn_model.pt"
)


# --------------------------------------------------
# Configuration
# --------------------------------------------------

HIDDEN_CHANNELS = 32
NUM_CLASSES = 3

LEARNING_RATE = 0.01
WEIGHT_DECAY = 5e-4

EPOCHS = 100


# --------------------------------------------------
# Load graph
# --------------------------------------------------

print("Loading graph...")

data = torch.load(
    GRAPH_FILE,
    weights_only=False
)

print("Graph loaded.")

print(
    "Accounts:",
    data["account"].num_nodes
)

print(
    "Protocols:",
    data["protocol"].num_nodes
)

print(
    "Account → Account edge features:",
    data[
        "account",
        "transacts_with",
        "account"
    ].edge_attr.shape
)

print(
    "Account → Protocol edge features:",
    data[
        "account",
        "interacts_with",
        "protocol"
    ].edge_attr.shape
)


# --------------------------------------------------
# Create model
# --------------------------------------------------

model = HeteroGNN(
    hidden_channels=HIDDEN_CHANNELS,
    num_classes=NUM_CLASSES
)

print("\nEdge-aware GNN model created.")


# --------------------------------------------------
# Calculate class weights
# --------------------------------------------------

y_train = data["account"].y[
    data["account"].train_mask
]

class_counts = torch.bincount(
    y_train,
    minlength=NUM_CLASSES
)

print("\nTraining class distribution:")
print(class_counts)


# Inverse-frequency weighting

class_weights = (
    class_counts.sum()
    / (
        NUM_CLASSES
        * class_counts.float()
    )
)

print("\nClass weights:")
print(class_weights)

print("\nClass mapping:")
print("0 = LOW")
print("1 = MEDIUM")
print("2 = HIGH")


# --------------------------------------------------
# Weighted Focal Loss
# --------------------------------------------------

class WeightedFocalLoss(nn.Module):

    def __init__(
        self,
        alpha,
        gamma=2.0
    ):
        super().__init__()

        self.alpha = alpha
        self.gamma = gamma

    def forward(
        self,
        logits,
        targets
    ):

        log_probs = torch.log_softmax(
            logits,
            dim=1
        )

        probs = torch.exp(
            log_probs
        )

        target_log_probs = (
            log_probs.gather(
                1,
                targets.unsqueeze(1)
            ).squeeze(1)
        )

        target_probs = (
            probs.gather(
                1,
                targets.unsqueeze(1)
            ).squeeze(1)
        )

        alpha = self.alpha[
            targets
        ]

        focal_factor = (
            1 - target_probs
        ) ** self.gamma

        loss = (
            -alpha
            * focal_factor
            * target_log_probs
        )

        return loss.mean()


criterion = WeightedFocalLoss(
    alpha=class_weights,
    gamma=2.0
)


optimizer = optim.Adam(
    model.parameters(),
    lr=LEARNING_RATE,
    weight_decay=WEIGHT_DECAY
)


# --------------------------------------------------
# Training
# --------------------------------------------------

best_val_accuracy = 0.0

print("\n========== TRAINING ==========")

for epoch in range(
    1,
    EPOCHS + 1
):

    # --------------------------------------------------
    # Training mode
    # --------------------------------------------------

    model.train()

    optimizer.zero_grad()


    # --------------------------------------------------
    # Edge-aware forward pass
    # --------------------------------------------------

    out = model(
        data.x_dict,
        data.edge_index_dict,
        data.edge_attr_dict
    )


    # --------------------------------------------------
    # Training predictions
    # --------------------------------------------------

    train_output = out[
        data["account"].train_mask
    ]

    train_labels = data[
        "account"
    ].y[
        data["account"].train_mask
    ]


    # --------------------------------------------------
    # Loss
    # --------------------------------------------------

    loss = criterion(
        train_output,
        train_labels
    )

    loss.backward()

    optimizer.step()


    # --------------------------------------------------
    # Validation
    # --------------------------------------------------

    model.eval()

    with torch.no_grad():

        output = model(
            data.x_dict,
            data.edge_index_dict,
            data.edge_attr_dict
        )

        val_output = output[
            data["account"].val_mask
        ]

        val_labels = data[
            "account"
        ].y[
            data["account"].val_mask
        ]

        predictions = val_output.argmax(
            dim=1
        )

        val_accuracy = (
            predictions == val_labels
        ).float().mean().item()


    # --------------------------------------------------
    # Save best model
    # --------------------------------------------------

    if val_accuracy > best_val_accuracy:

        best_val_accuracy = val_accuracy

        torch.save(
            model.state_dict(),
            MODEL_FILE
        )


    # --------------------------------------------------
    # Print progress
    # --------------------------------------------------

    if epoch % 10 == 0:

        print(
            f"Epoch {epoch:03d} | "
            f"Loss: {loss.item():.4f} | "
            f"Validation Accuracy: "
            f"{val_accuracy:.4f}"
        )


# --------------------------------------------------
# Training complete
# --------------------------------------------------

print("\nTraining complete.")

print(
    f"Best validation accuracy: "
    f"{best_val_accuracy:.4f}"
)

print(
    f"Best model saved to: "
    f"{MODEL_FILE}"
)


# --------------------------------------------------
# Test
# --------------------------------------------------

print("\n========== TESTING ==========")


model.load_state_dict(
    torch.load(
        MODEL_FILE,
        weights_only=True
    )
)

model.eval()


with torch.no_grad():

    output = model(
        data.x_dict,
        data.edge_index_dict,
        data.edge_attr_dict
    )

    test_output = output[
        data["account"].test_mask
    ]

    test_labels = data[
        "account"
    ].y[
        data["account"].test_mask
    ]

    test_predictions = (
        test_output.argmax(
            dim=1
        )
    )


# --------------------------------------------------
# Accuracy
# --------------------------------------------------

test_accuracy = (
    test_predictions == test_labels
).float().mean().item()


print(
    f"\nTest Accuracy: "
    f"{test_accuracy:.4f}"
)


# --------------------------------------------------
# Classification report
# --------------------------------------------------

print("\nClassification Report:")

print(
    classification_report(
        test_labels.numpy(),
        test_predictions.numpy(),
        target_names=[
            "LOW",
            "MEDIUM",
            "HIGH"
        ],
        zero_division=0
    )
)

print("==============================")