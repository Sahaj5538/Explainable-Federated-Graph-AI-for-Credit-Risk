import torch

from backend.model.gnn_model import create_model


def main():
    print("Loading graph...")

    data = torch.load(
        "datasets/processed/graph_normalized.pt",
        weights_only=False
    )

    print("Graph loaded successfully.\n")

    model_types = [
        ("GCN", "gcn"),
        ("GraphSAGE", "sage"),
        ("GAT", "gat"),
        ("Graph Transformer", "transformer"),
    ]

    print("=" * 60)
    print("TESTING ALL GNN ARCHITECTURES")
    print("=" * 60)

    for name, model_type in model_types:
        print(f"\nTesting {name}...")

        try:
            # Create model using the actual create_model() interface
            model = create_model(
                model_type=model_type,
                hidden_channels=32,
                num_classes=3,
            )

            model.eval()

            with torch.no_grad():
                output = model(
                    data.x_dict,
                    data.edge_index_dict,
                    data.edge_attr_dict,
                )

            print("  ✓ Model created")
            print(f"  ✓ Output shape: {output.shape}")
            print("  ✓ Sample output:")
            print(output[:2])

        except Exception as e:
            print("  ✗ FAILED")
            print(f"  Error: {type(e).__name__}: {e}")

    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()