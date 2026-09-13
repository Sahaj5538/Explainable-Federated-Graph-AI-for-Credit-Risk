from pathlib import Path

import torch


PROJECT_ROOT = Path(__file__).resolve().parents[2]

GRAPH_FILE = (
    PROJECT_ROOT
    / "datasets"
    / "processed"
    / "graph_normalized.pt"
)


data = torch.load(
    GRAPH_FILE,
    weights_only=False
)

y = data["account"].y
train_mask = data["account"].train_mask
val_mask = data["account"].val_mask
test_mask = data["account"].test_mask


print("Class mapping:")
print("0 = LOW")
print("1 = MEDIUM")
print("2 = HIGH")


print("\nTraining distribution:")

print(
    torch.bincount(
        y[train_mask],
        minlength=3
    )
)


print("\nValidation distribution:")

print(
    torch.bincount(
        y[val_mask],
        minlength=3
    )
)


print("\nTest distribution:")

print(
    torch.bincount(
        y[test_mask],
        minlength=3
    )
)