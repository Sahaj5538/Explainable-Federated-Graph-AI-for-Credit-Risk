from __future__ import annotations

import datetime as dt
from collections import defaultdict
from decimal import Decimal

from backend.database.models import (
    Account,
    AccountFeature,
    Transaction,
    DeFiEvent,
)
from backend.database.session import SessionLocal


# ============================================================
# OBSERVATION WINDOW
# ============================================================

OBSERVATION_START = dt.datetime(2025, 1, 1)
OBSERVATION_END = dt.datetime(2025, 5, 1)


# ============================================================
# GENERATE ACCOUNT FEATURES
# ============================================================

def generate_account_features():

    db = SessionLocal()

    try:
        print("Generating account-level features...")

        # ----------------------------------------------------
        # Observation-window transactions
        # ----------------------------------------------------

        transactions = (
            db.query(Transaction)
            .filter(
                Transaction.timestamp >= OBSERVATION_START,
                Transaction.timestamp < OBSERVATION_END,
            )
            .all()
        )

        # ----------------------------------------------------
        # Observation-window DeFi events
        # ----------------------------------------------------

        defi_events = (
            db.query(DeFiEvent)
            .filter(
                DeFiEvent.timestamp >= OBSERVATION_START,
                DeFiEvent.timestamp < OBSERVATION_END,
            )
            .all()
        )

        print(f"Observation transactions: {len(transactions)}")
        print(f"Observation DeFi events: {len(defi_events)}")

        # ----------------------------------------------------
        # Feature storage
        # ----------------------------------------------------

        features = defaultdict(
            lambda: {
                "transaction_count": 0,
                "successful_transactions": 0,
                "failed_transactions": 0,
                "total_volume": Decimal("0"),
                "borrow_count": 0,
                "borrow_volume": Decimal("0"),
                "repay_count": 0,
                "repay_volume": Decimal("0"),
                "deposit_volume": Decimal("0"),
                "withdrawal_volume": Decimal("0"),
                "unique_counterparties": set(),
                "unique_tokens": set(),
                "unique_protocols": set(),
                "active_days": set(),
                "historical_liquidation_count": 0,
            }
        )

        # ----------------------------------------------------
        # Initialize ALL accounts
        # ----------------------------------------------------

        accounts = db.query(Account).all()

        for account in accounts:
            features[account.account_id]

        # ----------------------------------------------------
        # Process transactions
        # ----------------------------------------------------

        for transaction in transactions:

            account_id = transaction.from_account_id

            data = features[account_id]

            # Basic transaction statistics
            data["transaction_count"] += 1

            if transaction.status == "SUCCESS":
                data["successful_transactions"] += 1

            elif transaction.status == "FAILED":
                data["failed_transactions"] += 1

            # Transaction volume
            data["total_volume"] += transaction.amount

            # Transaction type
            if transaction.transaction_type == "BORROW":

                data["borrow_count"] += 1
                data["borrow_volume"] += transaction.amount

            elif transaction.transaction_type == "REPAY":

                data["repay_count"] += 1
                data["repay_volume"] += transaction.amount

            elif transaction.transaction_type == "DEPOSIT":

                data["deposit_volume"] += transaction.amount

            elif transaction.transaction_type == "WITHDRAW":

                data["withdrawal_volume"] += transaction.amount

            elif transaction.transaction_type == "LIQUIDATION":

                data["historical_liquidation_count"] += 1

            # ------------------------------------------------
            # Counterparties
            # ------------------------------------------------

            if transaction.to_account_id is not None:
                data["unique_counterparties"].add(
                    transaction.to_account_id
                )

            # ------------------------------------------------
            # Tokens
            # ------------------------------------------------

            if transaction.token_id is not None:
                data["unique_tokens"].add(
                    transaction.token_id
                )

            # ------------------------------------------------
            # Protocols
            # ------------------------------------------------

            if transaction.protocol_id is not None:
                data["unique_protocols"].add(
                    transaction.protocol_id
                )

            # ------------------------------------------------
            # Active days
            # ------------------------------------------------

            data["active_days"].add(
                transaction.timestamp.date()
            )

        # ----------------------------------------------------
        # Process DeFi events
        # ----------------------------------------------------

        for event in defi_events:

            account_id = event.account_id

            # Ensure account exists in feature dictionary
            data = features[account_id]

            # ------------------------------------------------
            # Tokens
            # ------------------------------------------------

            if event.token_id is not None:
                data["unique_tokens"].add(
                    event.token_id
                )

            # ------------------------------------------------
            # Protocols
            # ------------------------------------------------

            if event.protocol_id is not None:
                data["unique_protocols"].add(
                    event.protocol_id
                )

            # ------------------------------------------------
            # Active days
            # ------------------------------------------------

            data["active_days"].add(
                event.timestamp.date()
            )

        # ----------------------------------------------------
        # Convert feature dictionaries to database rows
        # ----------------------------------------------------

        rows = []

        for account_id, data in features.items():

            transaction_count = data["transaction_count"]
            successful_transactions = data[
                "successful_transactions"
            ]
            failed_transactions = data[
                "failed_transactions"
            ]

            # ------------------------------------------------
            # Failed transaction ratio
            # ------------------------------------------------

            if transaction_count > 0:

                failed_tx_ratio = (
                    Decimal(failed_transactions)
                    / Decimal(transaction_count)
                )

            else:

                failed_tx_ratio = Decimal("0")

            # ------------------------------------------------
            # Repayment ratio
            #
            # Repayment ratio is based on repayment volume
            # relative to borrowing volume.
            # It is capped at 1.0 because values above 1
            # should not be interpreted as more than 100%
            # repayment for the observation period.
            # ------------------------------------------------

            borrow_volume = data["borrow_volume"]
            repay_volume = data["repay_volume"]

            if borrow_volume > 0:

                repayment_ratio = (
                    repay_volume / borrow_volume
                )

                repayment_ratio = min(
                    repayment_ratio,
                    Decimal("1")
                )

            else:

                repayment_ratio = Decimal("0")

            # ------------------------------------------------
            # Net deposit flow
            # ------------------------------------------------

            net_deposit_flow = (
                data["deposit_volume"]
                - data["withdrawal_volume"]
            )

            # ------------------------------------------------
            # Create feature row
            # ------------------------------------------------

            rows.append(
                {
                    "account_id": account_id,

                    "transaction_count":
                        transaction_count,

                    "successful_transactions":
                        successful_transactions,

                    "failed_transactions":
                        failed_transactions,

                    "failed_tx_ratio":
                        failed_tx_ratio,

                    "total_volume":
                        data["total_volume"],

                    "borrow_count":
                        data["borrow_count"],

                    "borrow_volume":
                        borrow_volume,

                    "repay_count":
                        data["repay_count"],

                    "repay_volume":
                        repay_volume,

                    "repayment_ratio":
                        repayment_ratio,

                    "deposit_volume":
                        data["deposit_volume"],

                    "withdrawal_volume":
                        data["withdrawal_volume"],

                    "net_deposit_flow":
                        net_deposit_flow,

                    "unique_counterparties":
                        len(
                            data["unique_counterparties"]
                        ),

                    "unique_tokens":
                        len(
                            data["unique_tokens"]
                        ),

                    "unique_protocols":
                        len(
                            data["unique_protocols"]
                        ),

                    "active_days":
                        len(
                            data["active_days"]
                        ),

                    "historical_liquidation_count":
                        data[
                            "historical_liquidation_count"
                        ],
                }
            )

        print(
            f"Generated features for {len(rows)} accounts"
        )

        return rows

    finally:
        db.close()


# ============================================================
# SAVE FEATURES
# ============================================================

def save_features(features):

    db = SessionLocal()

    try:

        for feature in features:

            existing = (
                db.query(AccountFeature)
                .filter(
                    AccountFeature.account_id
                    == feature["account_id"]
                )
                .first()
            )

            if existing:

                for key, value in feature.items():

                    if key != "account_id":

                        setattr(
                            existing,
                            key,
                            value,
                        )

            else:

                db.add(
                    AccountFeature(**feature)
                )

        db.commit()

        print(
            f"Saved {len(features)} account feature records"
        )

    except Exception:

        db.rollback()
        raise

    finally:

        db.close()


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    rows = generate_account_features()

    save_features(rows)