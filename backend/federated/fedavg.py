from __future__ import annotations

"""
FedAvg - FEDERATED AVERAGING
============================

Standard federated aggregation: the server computes the
sample-weighted average of the clients' model parameters.

    Client 1 model ──┐
    Client 2 model ──┼──→  FedAvg  →  Global model
    Client 3 model ──┘

(For the privacy-preserving variant where the server can ONLY see
the aggregate - never an individual client's update - see
backend/privacy/secure_aggregation.py.)
"""

import copy

import torch


def fed_avg(models, weights):

    total = sum(weights)

    weights = [w / total for w in weights]

    global_state = copy.deepcopy(
        models[0].state_dict()
    )

    for key, value in global_state.items():

        if torch.is_floating_point(value):

            accumulated = torch.zeros_like(
                value,
                dtype=torch.float32,
            )

            for model, weight in zip(models, weights):

                accumulated += (
                    weight
                    * model.state_dict()[key]
                    .to(torch.float32)
                )

            global_state[key] = accumulated.to(
                value.dtype
            )

    return global_state
