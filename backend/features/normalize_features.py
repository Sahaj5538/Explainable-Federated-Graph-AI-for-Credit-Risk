from pathlib import Path


# =========================================================
# DEPRECATED — DO NOT RUN
# =========================================================
#
# backend/graph/build_graph.py now writes graph_normalized.pt
# with BOTH normalizations in a single pass:
#
#   * account node features  (train-statistics z-score)
#   * edge features          (train-source-edge z-score)
#
# This script previously loaded graph.pt and saved a version
# with ONLY node features normalized, silently OVERWRITING the
# edge normalization written by build_graph.py. Whichever
# script ran last won, so one normalization was always lost.
#
# Kept for historical reference only — it does nothing now.


def normalize_graph():

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


if __name__ == "__main__":
    normalize_graph()