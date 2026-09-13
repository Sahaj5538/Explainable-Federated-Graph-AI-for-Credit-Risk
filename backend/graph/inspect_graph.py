import torch


GRAPH_PATH = "datasets/processed/graph.pt"


def inspect_graph():

    print()
    print("========== GRAPH INSPECTION ==========")

    graph = torch.load(
        GRAPH_PATH,
        weights_only=False,
    )

    # --------------------------------------------------------
    # Node information
    # --------------------------------------------------------

    total_nodes = sum(
        graph[node_type].num_nodes
        for node_type in graph.node_types
    )

    print(f"Number of nodes: {total_nodes}")

    # --------------------------------------------------------
    # Node counts and feature dimensions
    # --------------------------------------------------------

    print()

    for node_type in graph.node_types:

        node_data = graph[node_type]

        print(
            f"{node_type.capitalize()} nodes: "
            f"{node_data.num_nodes}"
        )

        if hasattr(node_data, "x"):

            print(
                f"  Feature dimensions: "
                f"{node_data.x.shape}"
            )

    # --------------------------------------------------------
    # Edge information
    # --------------------------------------------------------

    print()
    print("Edge relations:")

    total_edges = 0

    for edge_type in graph.edge_types:

        edge_data = graph[edge_type]

        num_edges = edge_data.edge_index.shape[1]

        total_edges += num_edges

        print(
            f"  {edge_type}: "
            f"{num_edges} edges"
        )

        if hasattr(edge_data, "edge_attr"):

            print(
                f"    Edge features: "
                f"{edge_data.edge_attr.shape}"
            )

    print()

    print(
        f"Total edges: {total_edges}"
    )

    # --------------------------------------------------------
    # Account labels
    # --------------------------------------------------------

    if hasattr(graph["account"], "y"):

        labels = graph["account"].y

        print()
        print("Risk label distribution:")

        print(
            f"LOW:     {(labels == 0).sum().item()}"
        )

        print(
            f"MEDIUM:  {(labels == 1).sum().item()}"
        )

        print(
            f"HIGH:    {(labels == 2).sum().item()}"
        )

    # --------------------------------------------------------
    # Train / validation / test split
    # --------------------------------------------------------

    account_data = graph["account"]

    if hasattr(account_data, "train_mask"):

        print()

        print(
            f"Training accounts: "
            f"{account_data.train_mask.sum().item()}"
        )

        print(
            f"Validation accounts: "
            f"{account_data.val_mask.sum().item()}"
        )

        print(
            f"Test accounts: "
            f"{account_data.test_mask.sum().item()}"
        )

    print()
    print("=====================================")


if __name__ == "__main__":

    inspect_graph()