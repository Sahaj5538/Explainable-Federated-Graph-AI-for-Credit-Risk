import torch
import torch.nn as nn
import torch.nn.functional as F

from torch_geometric.nn import (
    MessagePassing,
    GATConv,
    TransformerConv,
)


# ============================================================
# PROJECT GRAPH DIMENSIONS
# ============================================================

ACCOUNT_FEATURES = 11
PROTOCOL_FEATURES = 1

ACCOUNT_EDGE_FEATURES = 10
PROTOCOL_EDGE_FEATURES = 14

NUM_CLASSES = 3


# ============================================================
# Edge-aware GraphSAGE Convolution
# ============================================================

class EdgeSAGEConv(MessagePassing):

    def __init__(
        self,
        in_src,
        in_dst,
        out_channels,
        edge_dim,
    ):
        super().__init__(aggr="mean")

        self.neighbor_lin = nn.Linear(
            in_src,
            out_channels,
        )

        self.root_lin = nn.Linear(
            in_dst,
            out_channels,
        )

        self.edge_encoder = nn.Sequential(
            nn.Linear(
                edge_dim,
                out_channels,
            ),
            nn.ReLU(),
            nn.Linear(
                out_channels,
                out_channels,
            ),
        )

        self.norm = nn.LayerNorm(
            out_channels
        )

    def forward(
        self,
        x,
        edge_index,
        edge_attr,
    ):

        # ----------------------------------------------------
        # Same-node relation
        # ----------------------------------------------------

        if isinstance(x, torch.Tensor):

            x_src = x
            x_dst = x

        # ----------------------------------------------------
        # Bipartite relation
        # ----------------------------------------------------

        else:

            x_src, x_dst = x

        out = self.propagate(
            edge_index,
            x=(x_src, x_dst),
            edge_attr=edge_attr,
            size=(
                x_src.size(0),
                x_dst.size(0),
            ),
        )

        root = self.root_lin(
            x_dst
        )

        return self.norm(
            root + out
        )

    def message(
        self,
        x_j,
        edge_attr,
    ):

        neighbor = self.neighbor_lin(
            x_j
        )

        edge_message = self.edge_encoder(
            edge_attr
        )

        return neighbor + edge_message


# ============================================================
# Simple Edge-aware GCN
# ============================================================

class EdgeGCNConv(MessagePassing):
    """
    GCN-style convolution that supports both:

        node -> same node type

    and:

        source node type -> destination node type

    This is needed because the project graph is heterogeneous.
    """

    def __init__(
        self,
        in_src,
        in_dst,
        out_channels,
        edge_dim=None,
    ):

        super().__init__(aggr="mean")

        self.lin = nn.Linear(
            in_src,
            out_channels,
            bias=False,
        )

        self.root_lin = nn.Linear(
            in_dst,
            out_channels,
            bias=True,
        )

        self.edge_encoder = None

        if edge_dim is not None:

            self.edge_encoder = nn.Sequential(
                nn.Linear(
                    edge_dim,
                    out_channels,
                ),
                nn.ReLU(),
                nn.Linear(
                    out_channels,
                    out_channels,
                ),
            )

        self.norm = nn.LayerNorm(
            out_channels
        )

    def forward(
        self,
        x,
        edge_index,
        edge_attr=None,
    ):

        if isinstance(x, torch.Tensor):

            x_src = x
            x_dst = x

        else:

            x_src, x_dst = x

        out = self.propagate(
            edge_index,
            x=(x_src, x_dst),
            edge_attr=edge_attr,
            size=(
                x_src.size(0),
                x_dst.size(0),
            ),
        )

        root = self.root_lin(
            x_dst
        )

        return self.norm(
            root + out
        )

    def message(
        self,
        x_j,
        edge_attr=None,
    ):

        message = self.lin(
            x_j
        )

        if (
            edge_attr is not None
            and self.edge_encoder is not None
        ):

            message = (
                message
                + self.edge_encoder(
                    edge_attr
                )
            )

        return message


# ============================================================
# Relation Aggregator
# ============================================================

class RelationAggregator(nn.Module):

    def __init__(
        self,
        hidden_channels,
    ):

        super().__init__()

        attention_hidden = max(
            hidden_channels // 2,
            8,
        )

        self.attention = nn.Sequential(
            nn.Linear(
                hidden_channels,
                attention_hidden,
            ),
            nn.ReLU(),
            nn.Linear(
                attention_hidden,
                1,
            ),
        )

    def forward(
        self,
        messages,
    ):

        # messages:
        #
        # [num_accounts, 3, hidden]

        scores = self.attention(
            messages
        ).squeeze(-1)

        weights = torch.softmax(
            scores,
            dim=1,
        )

        aggregated = (
            messages
            * weights.unsqueeze(-1)
        ).sum(dim=1)

        return aggregated, weights


# ============================================================
# Heterogeneous GNN
# ============================================================

class HeterogeneousModel(nn.Module):

    def __init__(
        self,
        model_type="sage",
        hidden_channels=64,
        num_classes=NUM_CLASSES,
        heads=4,
        dropout=0.25,
    ):

        super().__init__()

        self.model_type = model_type
        self.hidden_channels = hidden_channels
        self.dropout = dropout

        # ====================================================
        # INPUT PROJECTIONS
        # ====================================================

        self.account_input = nn.Linear(
            ACCOUNT_FEATURES,
            hidden_channels,
        )

        self.protocol_input = nn.Linear(
            PROTOCOL_FEATURES,
            hidden_channels,
        )

        # ====================================================
        # GRAPH SAGE
        # ====================================================

        if model_type == "sage":

            self.conv1_aa = EdgeSAGEConv(
                ACCOUNT_FEATURES,
                ACCOUNT_FEATURES,
                hidden_channels,
                ACCOUNT_EDGE_FEATURES,
            )

            self.conv1_rev_aa = EdgeSAGEConv(
                ACCOUNT_FEATURES,
                ACCOUNT_FEATURES,
                hidden_channels,
                ACCOUNT_EDGE_FEATURES,
            )

            self.conv1_pa = EdgeSAGEConv(
                PROTOCOL_FEATURES,
                ACCOUNT_FEATURES,
                hidden_channels,
                PROTOCOL_EDGE_FEATURES,
            )

            self.conv1_ap = EdgeSAGEConv(
                ACCOUNT_FEATURES,
                PROTOCOL_FEATURES,
                hidden_channels,
                PROTOCOL_EDGE_FEATURES,
            )

            self.conv2_aa = EdgeSAGEConv(
                hidden_channels,
                hidden_channels,
                hidden_channels,
                ACCOUNT_EDGE_FEATURES,
            )

            self.conv2_rev_aa = EdgeSAGEConv(
                hidden_channels,
                hidden_channels,
                hidden_channels,
                ACCOUNT_EDGE_FEATURES,
            )

            self.conv2_pa = EdgeSAGEConv(
                hidden_channels,
                hidden_channels,
                hidden_channels,
                PROTOCOL_EDGE_FEATURES,
            )

            self.conv2_ap = EdgeSAGEConv(
                hidden_channels,
                hidden_channels,
                hidden_channels,
                PROTOCOL_EDGE_FEATURES,
            )

        # ====================================================
        # GCN
        # ====================================================

        elif model_type == "gcn":

            self.conv1_aa = EdgeGCNConv(
                ACCOUNT_FEATURES,
                ACCOUNT_FEATURES,
                hidden_channels,
                ACCOUNT_EDGE_FEATURES,
            )

            self.conv1_rev_aa = EdgeGCNConv(
                ACCOUNT_FEATURES,
                ACCOUNT_FEATURES,
                hidden_channels,
                ACCOUNT_EDGE_FEATURES,
            )

            self.conv1_pa = EdgeGCNConv(
                PROTOCOL_FEATURES,
                ACCOUNT_FEATURES,
                hidden_channels,
                PROTOCOL_EDGE_FEATURES,
            )

            self.conv1_ap = EdgeGCNConv(
                ACCOUNT_FEATURES,
                PROTOCOL_FEATURES,
                hidden_channels,
                PROTOCOL_EDGE_FEATURES,
            )

            self.conv2_aa = EdgeGCNConv(
                hidden_channels,
                hidden_channels,
                hidden_channels,
                ACCOUNT_EDGE_FEATURES,
            )

            self.conv2_rev_aa = EdgeGCNConv(
                hidden_channels,
                hidden_channels,
                hidden_channels,
                ACCOUNT_EDGE_FEATURES,
            )

            self.conv2_pa = EdgeGCNConv(
                hidden_channels,
                hidden_channels,
                hidden_channels,
                PROTOCOL_EDGE_FEATURES,
            )

            self.conv2_ap = EdgeGCNConv(
                hidden_channels,
                hidden_channels,
                hidden_channels,
                PROTOCOL_EDGE_FEATURES,
            )

        # ====================================================
        # GAT
        # ====================================================

        elif model_type == "gat":

            self.conv1_aa = GATConv(
                (
                    ACCOUNT_FEATURES,
                    ACCOUNT_FEATURES,
                ),
                hidden_channels,
                heads=heads,
                concat=False,
                add_self_loops=False,
                edge_dim=ACCOUNT_EDGE_FEATURES,
            )

            self.conv1_rev_aa = GATConv(
                (
                    ACCOUNT_FEATURES,
                    ACCOUNT_FEATURES,
                ),
                hidden_channels,
                heads=heads,
                concat=False,
                add_self_loops=False,
                edge_dim=ACCOUNT_EDGE_FEATURES,
            )

            self.conv1_pa = GATConv(
                (
                    PROTOCOL_FEATURES,
                    ACCOUNT_FEATURES,
                ),
                hidden_channels,
                heads=heads,
                concat=False,
                add_self_loops=False,
                edge_dim=PROTOCOL_EDGE_FEATURES,
            )

            self.conv1_ap = GATConv(
                (
                    ACCOUNT_FEATURES,
                    PROTOCOL_FEATURES,
                ),
                hidden_channels,
                heads=heads,
                concat=False,
                add_self_loops=False,
                edge_dim=PROTOCOL_EDGE_FEATURES,
            )

            self.conv2_aa = GATConv(
                (
                    hidden_channels,
                    hidden_channels,
                ),
                hidden_channels,
                heads=heads,
                concat=False,
                add_self_loops=False,
                edge_dim=ACCOUNT_EDGE_FEATURES,
            )

            self.conv2_rev_aa = GATConv(
                (
                    hidden_channels,
                    hidden_channels,
                ),
                hidden_channels,
                heads=heads,
                concat=False,
                add_self_loops=False,
                edge_dim=ACCOUNT_EDGE_FEATURES,
            )

            self.conv2_pa = GATConv(
                (
                    hidden_channels,
                    hidden_channels,
                ),
                hidden_channels,
                heads=heads,
                concat=False,
                add_self_loops=False,
                edge_dim=PROTOCOL_EDGE_FEATURES,
            )

            self.conv2_ap = GATConv(
                (
                    hidden_channels,
                    hidden_channels,
                ),
                hidden_channels,
                heads=heads,
                concat=False,
                add_self_loops=False,
                edge_dim=PROTOCOL_EDGE_FEATURES,
            )

        # ====================================================
        # GRAPH TRANSFORMER
        # ====================================================

        elif model_type == "transformer":

            self.conv1_aa = TransformerConv(
                (
                    ACCOUNT_FEATURES,
                    ACCOUNT_FEATURES,
                ),
                hidden_channels,
                heads=heads,
                concat=False,
                beta=True,
                root_weight=True,
                edge_dim=ACCOUNT_EDGE_FEATURES,
            )

            self.conv1_rev_aa = TransformerConv(
                (
                    ACCOUNT_FEATURES,
                    ACCOUNT_FEATURES,
                ),
                hidden_channels,
                heads=heads,
                concat=False,
                beta=True,
                root_weight=True,
                edge_dim=ACCOUNT_EDGE_FEATURES,
            )

            self.conv1_pa = TransformerConv(
                (
                    PROTOCOL_FEATURES,
                    ACCOUNT_FEATURES,
                ),
                hidden_channels,
                heads=heads,
                concat=False,
                beta=True,
                root_weight=True,
                edge_dim=PROTOCOL_EDGE_FEATURES,
            )

            self.conv1_ap = TransformerConv(
                (
                    ACCOUNT_FEATURES,
                    PROTOCOL_FEATURES,
                ),
                hidden_channels,
                heads=heads,
                concat=False,
                beta=True,
                root_weight=True,
                edge_dim=PROTOCOL_EDGE_FEATURES,
            )

            self.conv2_aa = TransformerConv(
                (
                    hidden_channels,
                    hidden_channels,
                ),
                hidden_channels,
                heads=heads,
                concat=False,
                beta=True,
                root_weight=True,
                edge_dim=ACCOUNT_EDGE_FEATURES,
            )

            self.conv2_rev_aa = TransformerConv(
                (
                    hidden_channels,
                    hidden_channels,
                ),
                hidden_channels,
                heads=heads,
                concat=False,
                beta=True,
                root_weight=True,
                edge_dim=ACCOUNT_EDGE_FEATURES,
            )

            self.conv2_pa = TransformerConv(
                (
                    hidden_channels,
                    hidden_channels,
                ),
                hidden_channels,
                heads=heads,
                concat=False,
                beta=True,
                root_weight=True,
                edge_dim=PROTOCOL_EDGE_FEATURES,
            )

            self.conv2_ap = TransformerConv(
                (
                    hidden_channels,
                    hidden_channels,
                ),
                hidden_channels,
                heads=heads,
                concat=False,
                beta=True,
                root_weight=True,
                edge_dim=PROTOCOL_EDGE_FEATURES,
            )

        else:

            raise ValueError(
                f"Unknown model type: {model_type}. "
                f"Expected: sage, gcn, gat, transformer"
            )

        # ====================================================
        # RELATION AGGREGATORS
        # ====================================================

        self.relation1 = RelationAggregator(
            hidden_channels
        )

        self.relation2 = RelationAggregator(
            hidden_channels
        )

        # ====================================================
        # RESIDUAL PROJECTIONS
        # ====================================================

        self.residual1 = nn.Linear(
            ACCOUNT_FEATURES,
            hidden_channels,
        )

        # ====================================================
        # NORMALIZATION
        # ====================================================

        self.norm1 = nn.LayerNorm(
            hidden_channels
        )

        self.norm2 = nn.LayerNorm(
            hidden_channels
        )

        self.norm3 = nn.LayerNorm(
            hidden_channels
        )

        # ====================================================
        # CLASSIFIER
        # ====================================================

        classifier_hidden = max(
            hidden_channels // 2,
            16,
        )

        self.classifier = nn.Sequential(

            nn.Linear(
                hidden_channels,
                hidden_channels,
            ),

            nn.ReLU(),

            nn.Dropout(dropout),

            nn.Linear(
                hidden_channels,
                classifier_hidden,
            ),

            nn.ReLU(),

            nn.Dropout(dropout),

            nn.Linear(
                classifier_hidden,
                num_classes,
            ),
        )

    # ========================================================
    # Apply selected convolution
    # ========================================================

    def _apply_conv(
        self,
        conv,
        x,
        edge_index,
        edge_attr,
    ):

        if self.model_type in (
            "sage",
            "gcn",
        ):

            return conv(
                x,
                edge_index,
                edge_attr,
            )

        return conv(
            x,
            edge_index,
            edge_attr=edge_attr,
        )

    # ========================================================
    # Forward
    # ========================================================

    def forward(
        self,
        x_dict,
        edge_index_dict,
        edge_attr_dict,
    ):

        account_x = x_dict[
            "account"
        ]

        protocol_x = x_dict[
            "protocol"
        ]

        # ====================================================
        # Relation keys
        # ====================================================

        aa_key = (
            "account",
            "transacts_with",
            "account",
        )

        rev_aa_key = (
            "account",
            "rev_transacts_with",
            "account",
        )

        ap_key = (
            "account",
            "interacts_with",
            "protocol",
        )

        pa_key = (
            "protocol",
            "rev_interacts_with",
            "account",
        )

        # ====================================================
        # Edge indices
        # ====================================================

        aa_index = edge_index_dict[
            aa_key
        ]

        rev_aa_index = edge_index_dict[
            rev_aa_key
        ]

        ap_index = edge_index_dict[
            ap_key
        ]

        pa_index = edge_index_dict[
            pa_key
        ]

        # ====================================================
        # Edge attributes
        # ====================================================

        aa_attr = edge_attr_dict[
            aa_key
        ]

        rev_aa_attr = edge_attr_dict[
            rev_aa_key
        ]

        ap_attr = edge_attr_dict[
            ap_key
        ]

        pa_attr = edge_attr_dict[
            pa_key
        ]

        # ====================================================
        # Input residual
        # ====================================================

        residual = self.residual1(
            account_x
        )

        # ====================================================
        # FIRST LAYER
        # ====================================================

        # Account -> Account
        aa = self._apply_conv(
            self.conv1_aa,
            account_x,
            aa_index,
            aa_attr,
        )

        # Reverse Account -> Account
        rev_aa = self._apply_conv(
            self.conv1_rev_aa,
            account_x,
            rev_aa_index,
            rev_aa_attr,
        )

        # Protocol -> Account
        pa = self._apply_conv(
            self.conv1_pa,
            (
                protocol_x,
                account_x,
            ),
            pa_index,
            pa_attr,
        )

        # Account -> Protocol
        ap = self._apply_conv(
            self.conv1_ap,
            (
                account_x,
                protocol_x,
            ),
            ap_index,
            ap_attr,
        )

        # ====================================================
        # Protocol representation
        # ====================================================

        protocol_x = F.relu(
            ap
        )

        # ====================================================
        # Account relation aggregation
        # ====================================================

        messages = torch.stack(
            [
                aa,
                rev_aa,
                pa,
            ],
            dim=1,
        )

        account_x, _ = self.relation1(
            messages
        )

        # ====================================================
        # Residual
        # ====================================================

        account_x = (
            account_x
            + residual
        )

        account_x = self.norm1(
            account_x
        )

        account_x = F.relu(
            account_x
        )

        account_x = F.dropout(
            account_x,
            p=self.dropout,
            training=self.training,
        )

        # ====================================================
        # SECOND LAYER
        # ====================================================

        aa = self._apply_conv(
            self.conv2_aa,
            account_x,
            aa_index,
            aa_attr,
        )

        rev_aa = self._apply_conv(
            self.conv2_rev_aa,
            account_x,
            rev_aa_index,
            rev_aa_attr,
        )

        pa = self._apply_conv(
            self.conv2_pa,
            (
                protocol_x,
                account_x,
            ),
            pa_index,
            pa_attr,
        )

        ap = self._apply_conv(
            self.conv2_ap,
            (
                account_x,
                protocol_x,
            ),
            ap_index,
            ap_attr,
        )

        # ====================================================
        # Updated protocol representation
        # ====================================================

        protocol_x = F.relu(
            ap
        )

        # ====================================================
        # Second relation aggregation
        # ====================================================

        messages = torch.stack(
            [
                aa,
                rev_aa,
                pa,
            ],
            dim=1,
        )

        account_x, _ = self.relation2(
            messages
        )

        # ====================================================
        # Residual
        # ====================================================

        account_x = (
            account_x
            + residual
        )

        account_x = self.norm2(
            account_x
        )

        account_x = F.relu(
            account_x
        )

        account_x = F.dropout(
            account_x,
            p=self.dropout,
            training=self.training,
        )

        # ====================================================
        # Final normalization
        # ====================================================

        account_x = self.norm3(
            account_x
        )

        # ====================================================
        # Classification
        # ====================================================

        logits = self.classifier(
            account_x
        )

        return logits


# ============================================================
# Backward-compatible HeteroGNN
# ============================================================

class HeteroGNN(HeterogeneousModel):

    def __init__(
        self,
        hidden_channels=64,
        num_classes=NUM_CLASSES,
        heads=4,
        dropout=0.25,
    ):

        super().__init__(
            model_type="sage",
            hidden_channels=hidden_channels,
            num_classes=num_classes,
            heads=heads,
            dropout=dropout,
        )


# ============================================================
# Convenience constructor
# ============================================================

def create_model(
    model_type="sage",
    hidden_channels=64,
    num_classes=NUM_CLASSES,
    heads=4,
    dropout=0.25,
):

    return HeterogeneousModel(
        model_type=model_type,
        hidden_channels=hidden_channels,
        num_classes=num_classes,
        heads=heads,
        dropout=dropout,
    )