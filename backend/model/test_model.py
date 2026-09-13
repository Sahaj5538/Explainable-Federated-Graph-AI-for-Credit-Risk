from pathlib import Path

import torch

from backend.model.gnn_model import HeteroGNN


PROJECT_ROOT = Path(__file__).resolve().parents[2]

GRAPH_FILE = (
    PROJECT_ROOT
    / "datasets"
    / "processed"
    / "graph_normalized.pt"
)


# =========================================================
# Load graph
# =========================================================

print("Loading normalized graph...")

data = torch.load(
    GRAPH_FILE,
    weights_only=False
)

print("Graph loaded successfully.")


# =========================================================
# Create model
# =========================================================

model = HeteroGNN(
    hidden_channels=32,
    num_classes=3
)

print("Edge-aware GNN model created.")


# =========================================================
# Display graph information
# =========================================================

print(
    "\nAccount features:",
    data["account"].x.shape
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


# =========================================================
# Forward pass
# =========================================================

print("\nRunning edge-aware forward pass...")

model.eval()

with torch.no_grad():

    output = model(
        data.x_dict,
        data.edge_index_dict,
        data.edge_attr_dict
    )


# =========================================================
# Verify output
# =========================================================

print(
    "\nForward pass successful!"
)

print(
    "Output shape:",
    output.shape
)

print(
    "Expected shape:",
    (1000, 3)
)

print(
    "\nSample predictions:"
)

print(
    output[:5]
)