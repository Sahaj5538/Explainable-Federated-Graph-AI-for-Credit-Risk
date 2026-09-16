from __future__ import annotations

"""
FEDERATED LEARNING - MAIN ENTRY POINT
=====================================

Run the full federated simulation:

    python -m backend.federated.federated_train
"""

from backend.federated.server import run_federated


def main():

    run_federated()


if __name__ == "__main__":
    main()
