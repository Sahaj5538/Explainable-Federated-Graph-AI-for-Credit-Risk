from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch_geometric.data import HeteroData


# ============================================================
# PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parents[2]

PROCESSED_DIR = PROJECT_ROOT / "datasets" / "processed"

TRANSACTIONS_PATH = PROCESSED_DIR / "transactions.csv"
FEATURES_PATH = PROCESSED_DIR / "account_features.csv"
PROTOCOLS_PATH = PROCESSED_DIR / "protocols.csv"
RISK_DATASET_PATH = PROCESSED_DIR / "account_risk_dataset.csv"


# ============================================================
# TEMPORAL CUTOFF
# ============================================================

# Features are engineered from the observation window
# 2025-01-01 .. 2025-05-01 (see backend/features/account_features.py).
#
# Transactions on/after this cutoff belong to the FUTURE OUTCOME
# window and are used ONLY to build risk labels
# (see backend/features/risk_labels.py).
#
# They must NEVER enter the graph as edges or edge features,
# otherwise the model could read future outcomes (e.g. future
# LIQUIDATION transactions) directly from the graph structure.

OBSERVATION_END = pd.Timestamp("2025-05-01")


# ============================================================
# FINAL NODE FEATURES
# ============================================================

NODE_FEATURE_COLUMNS = [
    "historical_liquidation_count",
    "borrow_frequency",
    "borrow_volume",
    "liquidation_rate",
    "borrow_intensity",
    "unique_counterparties",
    "deposit_volume",
    "borrow_to_repay_ratio",
    "repayment_ratio",
    "repay_count",
    "total_volume",
]


# ============================================================
# EDGE FEATURES
# ============================================================

TRANSACTION_EDGE_NUMERIC_COLUMNS = [
    "amount",
    "gas_used",
    "gas_price",
    "token_id",
    "protocol_id",
    "chain_id",
]


# ============================================================
# LOAD DATA
# ============================================================

def load_data():

    print("=" * 70)
    print("LOADING DATA")
    print("=" * 70)

    transactions = pd.read_csv(
        TRANSACTIONS_PATH
    )

    account_features = pd.read_csv(
        FEATURES_PATH
    )

    protocols = pd.read_csv(
        PROTOCOLS_PATH
    )

    risk_dataset = pd.read_csv(
        RISK_DATASET_PATH
    )

    print(
        f"Transactions: {len(transactions):,}"
    )

    print(
        f"Account features: {len(account_features):,}"
    )

    print(
        f"Protocols: {len(protocols):,}"
    )

    print(
        f"Risk dataset: {len(risk_dataset):,}"
    )

    return (
        transactions,
        account_features,
        protocols,
        risk_dataset,
    )


# ============================================================
# VALIDATE FEATURES
# ============================================================

def validate_features(account_features):

    print("\n" + "=" * 70)
    print("VALIDATING NODE FEATURES")
    print("=" * 70)

    missing = [
        column
        for column in NODE_FEATURE_COLUMNS
        if column not in account_features.columns
    ]

    if missing:

        raise ValueError(
            "Missing node feature columns:\n"
            + "\n".join(
                f"  - {column}"
                for column in missing
            )
        )

    print(
        f"Using {len(NODE_FEATURE_COLUMNS)} node features:"
    )

    for i, feature in enumerate(
        NODE_FEATURE_COLUMNS,
        start=1,
    ):
        print(
            f"{i:2d}. {feature}"
        )


# ============================================================
# CREATE ACCOUNT MAPPING
# ============================================================

def create_account_mapping(
    account_features,
):

    account_ids = (
        account_features["account_id"]
        .astype(int)
        .tolist()
    )

    account_to_index = {
        account_id: index
        for index, account_id in enumerate(account_ids)
    }

    return account_to_index


# ============================================================
# BUILD ACCOUNT FEATURES
# ============================================================

def build_account_features(
    account_features,
):

    X = (
        account_features[
            NODE_FEATURE_COLUMNS
        ]
        .apply(pd.to_numeric, errors="coerce")
        .replace([np.inf, -np.inf], np.nan)
        .fillna(0)
    )

    X = X.to_numpy(
        dtype=np.float32
    )

    return torch.tensor(
        X,
        dtype=torch.float32,
    )


# ============================================================
# BUILD LABELS
# ============================================================

def build_labels(
    account_features,
    risk_dataset,
):

    label_mapping = {
        "LOW": 0,
        "MEDIUM": 1,
        "HIGH": 2,
    }

    # Prefer risk dataset labels because this is the
    # dataset used for the current prediction task.

    risk_labels = (
        risk_dataset[
            [
                "account_id",
                "risk_label",
            ]
        ]
        .drop_duplicates(
            "account_id"
        )
    )

    label_map = (
        risk_labels
        .set_index("account_id")[
            "risk_label"
        ]
        .map(label_mapping)
    )

    labels = []

    for account_id in account_features[
        "account_id"
    ]:

        if account_id not in label_map.index:

            raise ValueError(
                f"No risk label found for account "
                f"{account_id}"
            )

        labels.append(
            int(label_map.loc[account_id])
        )

    return torch.tensor(
        labels,
        dtype=torch.long,
    )


# ============================================================
# CREATE STRATIFIED MASKS
# ============================================================

def create_masks(
    labels,
    train_ratio=0.70,
    val_ratio=0.15,
    random_state=42,
):

    rng = np.random.default_rng(
        random_state
    )

    labels_np = labels.numpy()

    train_indices = []
    val_indices = []
    test_indices = []

    for class_id in np.unique(labels_np):

        class_indices = np.where(
            labels_np == class_id
        )[0]

        rng.shuffle(
            class_indices
        )

        n = len(class_indices)

        n_train = int(
            n * train_ratio
        )

        n_val = int(
            n * val_ratio
        )

        train_indices.extend(
            class_indices[:n_train]
        )

        val_indices.extend(
            class_indices[
                n_train:
                n_train + n_val
            ]
        )

        test_indices.extend(
            class_indices[
                n_train + n_val:
            ]
        )

    train_mask = torch.zeros(
        len(labels),
        dtype=torch.bool,
    )

    val_mask = torch.zeros(
        len(labels),
        dtype=torch.bool,
    )

    test_mask = torch.zeros(
        len(labels),
        dtype=torch.bool,
    )

    train_mask[
        train_indices
    ] = True

    val_mask[
        val_indices
    ] = True

    test_mask[
        test_indices
    ] = True

    return (
        train_mask,
        val_mask,
        test_mask,
    )


# ============================================================
# BUILD ACCOUNT → ACCOUNT EDGES
# ============================================================

def build_account_edges(
    transactions,
    account_to_index,
):

    valid = transactions[
        transactions["to_account_id"].notna()
    ].copy()

    valid = valid[
        valid["from_account_id"].isin(
            account_to_index
        )
        &
        valid["to_account_id"].isin(
            account_to_index
        )
    ]

    sources = (
        valid["from_account_id"]
        .astype(int)
        .map(account_to_index)
        .to_numpy()
    )

    destinations = (
        valid["to_account_id"]
        .astype(int)
        .map(account_to_index)
        .to_numpy()
    )

    edge_index = torch.tensor(
        np.vstack(
            [
                sources,
                destinations,
            ]
        ),
        dtype=torch.long,
    )

    return (
        valid,
        edge_index,
    )


# ============================================================
# BUILD ACCOUNT → PROTOCOL EDGES
# ============================================================

def build_protocol_edges(
    transactions,
    account_to_index,
    protocols,
):

    valid = transactions[
        transactions["protocol_id"].notna()
    ].copy()

    valid = valid[
        valid["from_account_id"].isin(
            account_to_index
        )
    ]

    protocol_ids = (
        protocols["protocol_id"]
        .astype(int)
        .tolist()
    )

    protocol_to_index = {
        protocol_id: index
        for index, protocol_id
        in enumerate(protocol_ids)
    }

    valid = valid[
        valid["protocol_id"].astype(int).isin(
            protocol_to_index
        )
    ]

    account_indices = (
        valid["from_account_id"]
        .astype(int)
        .map(account_to_index)
        .to_numpy()
    )

    protocol_indices = (
        valid["protocol_id"]
        .astype(int)
        .map(protocol_to_index)
        .to_numpy()
    )

    edge_index = torch.tensor(
        np.vstack(
            [
                account_indices,
                protocol_indices,
            ]
        ),
        dtype=torch.long,
    )

    return (
        valid,
        edge_index,
        protocol_to_index,
    )


# ============================================================
# BUILD TRANSACTION EDGE FEATURES
# ============================================================

def build_edge_features(
    transactions,
    categorical_columns=None,
):

    if categorical_columns is None:
        categorical_columns = [
            "transaction_type",
            "status",
        ]

    numeric = (
        transactions[
            TRANSACTION_EDGE_NUMERIC_COLUMNS
        ]
        .apply(
            pd.to_numeric,
            errors="coerce",
        )
        .fillna(0)
    )

    numeric_values = numeric.to_numpy(
        dtype=np.float32
    )

    categorical_parts = []

    for column in categorical_columns:

        encoded = pd.get_dummies(
            transactions[column].astype(str),
            prefix=column,
        )

        categorical_parts.append(
            encoded.astype(np.float32)
        )

    if categorical_parts:

        categorical = pd.concat(
            categorical_parts,
            axis=1,
        )

        categorical_values = (
            categorical.to_numpy(
                dtype=np.float32
            )
        )

        edge_features = np.concatenate(
            [
                numeric_values,
                categorical_values,
            ],
            axis=1,
        )

    else:

        edge_features = numeric_values

    return torch.tensor(
        edge_features,
        dtype=torch.float32,
    )


# ============================================================
# NORMALIZE EDGE FEATURES
# ============================================================

def normalize_edge_features(
    edge_attr,
    train_mask,
    edge_source_nodes,
):

    edge_attr = edge_attr.clone()

    train_nodes = set(
        torch.where(
            train_mask
        )[0].tolist()
    )

    train_edge_mask = torch.tensor(
        [
            int(source.item())
            in train_nodes
            for source in edge_source_nodes
        ],
        dtype=torch.bool,
    )

    if train_edge_mask.sum() == 0:

        print(
            "Warning: no training edges found. "
            "Skipping normalization."
        )

        return edge_attr

    train_edges = edge_attr[
        train_edge_mask
    ]

    mean = train_edges.mean(
        dim=0,
        keepdim=True,
    )

    std = train_edges.std(
        dim=0,
        keepdim=True,
    )

    std[
        std < 1e-8
    ] = 1.0

    edge_attr = (
        edge_attr - mean
    ) / std

    return edge_attr


# ============================================================
# BUILD GRAPH
# ============================================================

def build_graph():

    (
        transactions,
        account_features,
        protocols,
        risk_dataset,
    ) = load_data()

    # --------------------------------------------------------
    # Keep only observation-window transactions for edges.
    #
    # This enforces the temporal setup:
    #
    #   past behaviour -> features + graph -> prediction
    #   future behaviour -> risk label only
    # --------------------------------------------------------

    transactions["timestamp"] = pd.to_datetime(
        transactions["timestamp"]
    )

    n_all_transactions = len(transactions)

    transactions = transactions[
        transactions["timestamp"] < OBSERVATION_END
    ].copy()

    print(
        f"\nTransactions total: {n_all_transactions:,}"
    )

    print(
        f"Observation-window transactions used for edges: "
        f"{len(transactions):,}"
    )

    print(
        f"Future-window transactions excluded from graph: "
        f"{n_all_transactions - len(transactions):,}"
    )

    validate_features(
        account_features
    )

    account_to_index = (
        create_account_mapping(
            account_features
        )
    )

    # --------------------------------------------------------
    # Account node features
    # --------------------------------------------------------

    account_x = build_account_features(
        account_features
    )

    # --------------------------------------------------------
    # Labels
    # --------------------------------------------------------

    labels = build_labels(
        account_features,
        risk_dataset,
    )

    # --------------------------------------------------------
    # Train / validation / test masks
    # --------------------------------------------------------

    (
        train_mask,
        val_mask,
        test_mask,
    ) = create_masks(
        labels
    )

    # --------------------------------------------------------
    # Account → Account edges
    # --------------------------------------------------------

    (
        account_transactions,
        account_edge_index,
    ) = build_account_edges(
        transactions,
        account_to_index,
    )

    account_edge_attr = build_edge_features(
        account_transactions
    )

    # --------------------------------------------------------
    # Account → Protocol edges
    # --------------------------------------------------------

    (
        protocol_transactions,
        protocol_edge_index,
        protocol_to_index,
    ) = build_protocol_edges(
        transactions,
        account_to_index,
        protocols,
    )

    protocol_edge_attr = build_edge_features(
        protocol_transactions
    )

    # --------------------------------------------------------
    # Reverse edges
    # --------------------------------------------------------

    reverse_account_edge_index = (
        account_edge_index.flip(0)
    )

    reverse_protocol_edge_index = (
        protocol_edge_index.flip(0)
    )

    # --------------------------------------------------------
    # Protocol node features
    # --------------------------------------------------------

    protocol_x = torch.ones(
        (
            len(protocol_to_index),
            1,
        ),
        dtype=torch.float32,
    )

    # --------------------------------------------------------
    # Create Heterogeneous Graph
    # --------------------------------------------------------

    data = HeteroData()

    data["account"].x = account_x

    data["account"].y = labels

    data["account"].train_mask = train_mask

    data["account"].val_mask = val_mask

    data["account"].test_mask = test_mask

    data["protocol"].x = protocol_x

    # Account → Account
    data[
        "account",
        "transacts_with",
        "account",
    ].edge_index = account_edge_index

    data[
        "account",
        "transacts_with",
        "account",
    ].edge_attr = account_edge_attr

    # Account → Account reverse
    data[
        "account",
        "rev_transacts_with",
        "account",
    ].edge_index = reverse_account_edge_index

    data[
        "account",
        "rev_transacts_with",
        "account",
    ].edge_attr = account_edge_attr.clone()

    # Account → Protocol
    data[
        "account",
        "interacts_with",
        "protocol",
    ].edge_index = protocol_edge_index

    data[
        "account",
        "interacts_with",
        "protocol",
    ].edge_attr = protocol_edge_attr

    # Protocol → Account
    data[
        "protocol",
        "rev_interacts_with",
        "account",
    ].edge_index = reverse_protocol_edge_index

    data[
        "protocol",
        "rev_interacts_with",
        "account",
    ].edge_attr = protocol_edge_attr.clone()

    # --------------------------------------------------------
    # Print graph statistics
    # --------------------------------------------------------

    print("\n" + "=" * 70)
    print("GRAPH SUMMARY")
    print("=" * 70)

    print(
        f"Account nodes: "
        f"{data['account'].num_nodes}"
    )

    print(
        f"Protocol nodes: "
        f"{data['protocol'].num_nodes}"
    )

    print(
        f"Account feature dimension: "
        f"{data['account'].x.shape[1]}"
    )

    print(
        f"Account → Account edges: "
        f"{account_edge_index.shape[1]}"
    )

    print(
        f"Account → Protocol edges: "
        f"{protocol_edge_index.shape[1]}"
    )

    print(
        f"Train nodes: "
        f"{train_mask.sum().item()}"
    )

    print(
        f"Validation nodes: "
        f"{val_mask.sum().item()}"
    )

    print(
        f"Test nodes: "
        f"{test_mask.sum().item()}"
    )

    print("\nClass distribution:")

    for class_id, class_name in [
        (0, "LOW"),
        (1, "MEDIUM"),
        (2, "HIGH"),
    ]:

        count = (
            labels == class_id
        ).sum().item()

        print(
            f"{class_name}: {count}"
        )

    # --------------------------------------------------------
    # Save raw graph
    # --------------------------------------------------------

    graph_path = (
        PROCESSED_DIR / "graph.pt"
    )

    torch.save(
        data,
        graph_path,
    )

    print(
        f"\nSaved graph: {graph_path}"
    )

    # --------------------------------------------------------
    # Normalize edge features
    # --------------------------------------------------------

    account_edge_source = (
        account_edge_index[0]
    )

    account_edge_attr_normalized = (
        normalize_edge_features(
            account_edge_attr,
            train_mask,
            account_edge_source,
        )
    )

    protocol_edge_source = (
        protocol_edge_index[0]
    )

    protocol_edge_attr_normalized = (
        normalize_edge_features(
            protocol_edge_attr,
            train_mask,
            protocol_edge_source,
        )
    )

    normalized_data = data.clone()

    normalized_data[
        "account",
        "transacts_with",
        "account",
    ].edge_attr = (
        account_edge_attr_normalized
    )

    normalized_data[
        "account",
        "rev_transacts_with",
        "account",
    ].edge_attr = (
        account_edge_attr_normalized.clone()
    )

    normalized_data[
        "account",
        "interacts_with",
        "protocol",
    ].edge_attr = (
        protocol_edge_attr_normalized
    )

    normalized_data[
        "protocol",
        "rev_interacts_with",
        "account",
    ].edge_attr = (
        protocol_edge_attr_normalized.clone()
    )

    # --------------------------------------------------------
    # Normalize account node features
    # (training-node statistics only, to avoid test leakage)
    #
    # Without this, raw features such as total_volume
    # (scale ~10^4-10^5) are mixed with ratios (scale 0-1),
    # which destabilises training.
    # --------------------------------------------------------

    account_x = normalized_data["account"].x

    train_x = account_x[train_mask]

    node_mean = train_x.mean(
        dim=0,
        keepdim=True,
    )

    node_std = train_x.std(
        dim=0,
        keepdim=True,
    )

    node_std[node_std < 1e-8] = 1.0

    normalized_data["account"].x = (
        (account_x - node_mean) / node_std
    )

    print(
        "\nAccount node features normalized "
        "(train statistics)."
    )

    normalized_path = (
        PROCESSED_DIR
        / "graph_normalized.pt"
    )

    torch.save(
        normalized_data,
        normalized_path,
    )

    print(
        f"Saved normalized graph: "
        f"{normalized_path}"
    )

    print(
        "\n" + "=" * 70
    )

    print(
        "GRAPH BUILD COMPLETED SUCCESSFULLY"
    )

    print(
        "=" * 70
    )


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    build_graph()