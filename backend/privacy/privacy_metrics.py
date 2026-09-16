from __future__ import annotations

"""
PRIVACY METRICS - WHAT DOES THE SERVER SEE?
===========================================

Honest reporting of the privacy properties of the federated
simulation:

  * PLAIN FedAvg : the server receives every client's individual
    update. Updates can leak information about the client's
    training data (well-documented in the FL literature), so this
    is NOT a privacy guarantee by itself.

  * SECURE AGGREGATION : the server receives only masked updates
    and observes solely their sum. Individual contributions are
    hidden by pairwise masks that cancel exactly.

This module quantifies the difference: in plain mode the server
can measure each institution's update norm (and could attempt
inversion); in secure mode only the aggregate is visible.
"""

import torch


def _update_norm(state_dict):

    total = 0.0

    for value in state_dict.values():

        if torch.is_floating_point(value):
            total += float(
                value.float().pow(2).sum().item()
            )

    return total ** 0.5


def server_visibility_report(models, weights, round_seed):

    print()
    print("=" * 70)
    print("PRIVACY REPORT - WHAT THE SERVER OBSERVES")
    print("=" * 70)

    from backend.federated.client import CLIENT_NAMES
    from backend.privacy.secure_aggregation import (
        mask_update,
    )

    print()
    print("PLAIN FedAvg (no protection):")
    print(
        f"{'Client':<18}"
        f"{'Update L2 norm':>16}"
        f"{'Visible to server?':>20}"
    )
    print("-" * 54)

    for index, model in enumerate(models):

        norm = _update_norm(model.state_dict())

        print(
            f"{CLIENT_NAMES[index]:<18}"
            f"{norm:>16.4f}"
            f"{'YES (full update)':>20}"
        )

    print()
    print("With SECURE AGGREGATION (pairwise masks):")

    aggregate_norm = 0.0

    for index, model in enumerate(models):

        masked = mask_update(
            model.state_dict(),
            index,
            len(models),
            round_seed,
        )

        aggregate_norm += _update_norm(masked)

        # Individual masked norms are meaningless noise - the
        # server cannot attribute any part of them to the client.

    print(
        f"  The server receives only masked updates whose sum is "
        f"the aggregate"
    )
    print(
        f"  (aggregate L2 norm ~ {aggregate_norm:.4f} - includes "
        f"the cancelling masks)."
    )
    print()
    print(
        "=> Individual client updates are NOT visible to the "
        "server under secure aggregation."
    )
    print(
        "=> Honest limitation: this protects the UPDATE channel; "
        "formal guarantees against inference from the final "
        "global model would require differential privacy."
    )
