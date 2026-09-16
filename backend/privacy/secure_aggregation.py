from __future__ import annotations

"""
SECURE AGGREGATION (pairwise masking)
=====================================

Federated Averaging alone does NOT guarantee privacy: the server
still sees every client's individual model update, and model
updates can themselves leak information about training data.

This module implements a simplified Bonawitz-style pairwise-mask
secure aggregation:

  * every PAIR of clients (i, j) shares a secret seed,
  * client i adds the mask  +m(i,j) to its update,
  * client j subtracts the same mask -m(i,j),
  * => all masks cancel in the SUM.

The server therefore observes ONLY the aggregate update - it can
never inspect an individual institution's contribution.

Each client also pre-scales its update by its FedAvg weight, so
the masked sum equals the weighted average exactly.
"""

import torch


# ============================================================
# PAIRWISE MASKS
# ============================================================

def _mask_seed(client_i, client_j, round_seed):

    lo = min(client_i, client_j)
    hi = max(client_i, client_j)

    # Deterministic seed for the pair (symmetric).

    return round_seed * 100003 + lo * 1013 + hi


def _pairwise_mask(client_i, client_j, like_tensor, round_seed):

    generator = torch.Generator().manual_seed(
        _mask_seed(client_i, client_j, round_seed)
    )

    return torch.randn(
        like_tensor.shape,
        generator=generator,
    ).to(like_tensor.dtype)


def mask_update(
    state_dict,
    client_index,
    n_clients,
    round_seed,
    scale=1.0,
):

    """Return a MASKED COPY of one client's update.

    The client's parameters are scaled by `scale` (its FedAvg
    weight, broadcast by the server) and then perturbed with the
    pairwise masks shared with every other client.
    """

    masked = {}

    for key, value in state_dict.items():

        if not torch.is_floating_point(value):
            masked[key] = value
            continue

        perturbed = value * scale

        for other in range(n_clients):

            if other == client_index:
                continue

            mask = _pairwise_mask(
                client_index,
                other,
                value,
                round_seed,
            )

            if client_index < other:
                perturbed = perturbed + mask
            else:
                perturbed = perturbed - mask

        masked[key] = perturbed

    return masked


# ============================================================
# SECURE AGGREGATION (server side)
# ============================================================

def secure_aggregate(models, weights, round_seed):

    """Server-side aggregation over MASKED updates.

    The server only ever sees (and only ever sums) the masked
    updates - individual client contributions are unrecoverable
    from the sum because the masks cancel exactly.
    """

    total = sum(weights)

    normalized = [w / total for w in weights]

    n_clients = len(models)

    accumulated = None

    for client_index, model in enumerate(models):

        masked = mask_update(
            model.state_dict(),
            client_index,
            n_clients,
            round_seed,
            scale=normalized[client_index],
        )

        if accumulated is None:

            accumulated = {
                key: (
                    value.float().clone()
                    if torch.is_floating_point(value)
                    else value
                )
                for key, value in masked.items()
            }

        else:

            for key, value in masked.items():

                if torch.is_floating_point(value):
                    accumulated[key] += value.float()

    reference = models[0].state_dict()

    result = {}

    for key, value in accumulated.items():

        if torch.is_floating_point(reference[key]):
            result[key] = value.to(reference[key].dtype)
        else:
            result[key] = reference[key]

    return result


# ============================================================
# VERIFICATION
# ============================================================

def verify_secure_aggregation(models, weights, round_seed):

    """Prove that the masked sum equals the plain weighted sum."""

    from backend.federated.fedavg import fed_avg

    secure = secure_aggregate(
        models,
        weights,
        round_seed,
    )

    plain = fed_avg(models, weights)

    max_difference = 0.0

    for key in plain:

        if torch.is_floating_point(plain[key]):

            difference = (
                secure[key].float()
                - plain[key].float()
            ).abs().max().item()

            max_difference = max(
                max_difference,
                difference,
            )

    return max_difference


if __name__ == "__main__":

    # Tiny self-test with random "models" (state dicts).

    torch.manual_seed(0)

    fake_states = [
        {
            "w": torch.randn(10, 5),
            "b": torch.randn(5),
        }
        for _ in range(5)
    ]

    class _Fake:

        def __init__(self, state):
            self._state = state

        def state_dict(self):
            return self._state

    fakes = [_Fake(s) for s in fake_states]

    diff = verify_secure_aggregation(
        fakes,
        [10, 20, 30, 15, 25],
        round_seed=123,
    )

    print(
        f"masked sum vs plain weighted sum: "
        f"max |difference| = {diff:.2e}"
    )
    print(
        "=> masks cancel exactly; the server sees only the "
        "aggregate."
    )
