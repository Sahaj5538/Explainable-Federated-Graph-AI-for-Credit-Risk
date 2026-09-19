from pathlib import Path

import torch


# =========================================================
# 1. File paths
# =========================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATA_DIR = PROJECT_ROOT / "datasets" / "processed"

GRAPH_FILE = DATA_DIR / "graph.pt"
NORMALIZED_GRAPH_FILE = DATA_DIR / "graph_normalized.pt"


# =========================================================
# 2. Normalize account features
# =========================================================

def normalize_account_features(data):

    # Get account features
    x = data["account"].x

    # Get training mask
    train_mask = data["account"].train_mask

    # Only use training accounts to calculate statistics
    train_x = x[train_mask]

    # Calculate mean and standard deviation
    mean = train_x.mean(dim=0)

    std = train_x.std(dim=0)

    # Avoid division by zero
    std[std == 0] = 1.0

    # Normalize ALL accounts using training statistics
    normalized_x = (x - mean) / std

    # Replace account features
    data["account"].x = normalized_x

    return data, mean, std


# =========================================================
# 3. Main preprocessing function
# =========================================================

def normalize_graph():

    # -----------------------------------------------------
    # DEPRECATED — DO NOT RUN.
    #
    # backend/graph/build_graph.py now writes graph_normalized.pt
    # with BOTH normalizations in a single pass:
    #
    #   * account node features  (train-statistics z-score)
    #   * edge features          (train-source-edge z-score)
    #
    # This script previously loaded graph.pt and saved a version
    # with ONLY node features normalized, silently OVERWRITING
    # the edge normalization written by build_graph.py. Whichever
    # script ran last won, so one normalization was always lost.
    #
    # Keep this file for history, but it must not be run.
    # -----------------------------------------------------

    print("=" * 60)

    print(
        "This script is deprecated and does nothing."
    )

    print(
        "build_graph.py now normalizes BOTH node and edge "
        "features when it saves graph_normalized.pt."
    )

    print(
        "If you need to rebuild the graph, run:\n"
        "    python -m backend.graph.build_graph"
    )

    print("=" * 60)

    return

    data = torch.load(
        GRAPH_FILE,
        weights_only=False
    )

    print("Graph loaded successfully.")

    print(
        "Original account features:",
        data["account"].x.shape
    )

    # -----------------------------------------------------
    # Normalize account features
    # -----------------------------------------------------

    data, mean, std = normalize_account_features(data)

    # -----------------------------------------------------
    # Save normalized graph
    # -----------------------------------------------------

    torch.save(
        data,
        NORMALIZED_GRAPH_FILE
    )

    print(
        "\nNormalized graph saved to:"
    )

    print(NORMALIZED_GRAPH_FILE)

    # -----------------------------------------------------
    # Verification
    # -----------------------------------------------------

    normalized_train_x = data["account"].x[
        data["account"].train_mask
    ]

    print(
        "\nTraining feature mean:"
    )

    print(
        normalized_train_x.mean(dim=0)
    )

    print(
        "\nTraining feature standard deviation:"
    )

    print(
        normalized_train_x.std(dim=0)
    )

    print(
        "\nNormalization complete."
    )


# =========================================================
# 4. Run
# =========================================================

if __name__ == "__main__":
    normalize_graph()