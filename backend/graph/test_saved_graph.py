from pathlib import Path
import torch


PROJECT_ROOT = Path(__file__).resolve().parents[2]

GRAPH_FILE = (
    PROJECT_ROOT
    / "datasets"
    / "processed"
    / "graph.pt"
)


print("Loading saved graph...")

data = torch.load(
    GRAPH_FILE,
    weights_only=False
)

print("\nSaved graph loaded successfully!")

print(data)

print("\nAccount nodes:", data["account"].num_nodes)
print("Protocol nodes:", data["protocol"].num_nodes)

print(
    "Account → Account edges:",
    data["account", "transacts_with", "account"].num_edges
)

print(
    "Account → Protocol edges:",
    data["account", "interacts_with", "protocol"].num_edges
)

print(
    "Account features:",
    data["account"].x.shape
)

print(
    "Risk labels:",
    data["account"].y.shape
)