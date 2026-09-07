from __future__ import annotations

import datetime as dt
from decimal import Decimal

from backend.database.models import Account, RiskLabel, Transaction
from backend.database.session import SessionLocal


# ============================================================
# OUTCOME WINDOW
# ============================================================

OUTCOME_START = dt.datetime(2025, 5, 1)
OUTCOME_END = dt.datetime(2025, 7, 1)


# ============================================================
# GENERATE RISK LABELS
# ============================================================

def generate_risk_labels():

    db = SessionLocal()

    try:
        print("Generating future risk labels...")

        # ----------------------------------------------------
        # Get outcome-window transactions
        # ----------------------------------------------------

        transactions = (
            db.query(Transaction)
            .filter(
                Transaction.timestamp >= OUTCOME_START,
                Transaction.timestamp < OUTCOME_END,
            )
            .all()
        )

        print(f"Outcome transactions: {len(transactions)}")

        # ----------------------------------------------------
        # Initialize account statistics
        # ----------------------------------------------------

        stats = {}

        for transaction in transactions:

            account_id = transaction.from_account_id

            if account_id not in stats:
                stats[account_id] = {
                    "liquidations": 0,
                    "borrows": 0,
                    "repays": 0,
                    "total_transactions": 0,
                    "failed_transactions": 0,
                }

            stats[account_id]["total_transactions"] += 1

            if transaction.status == "FAILED":
                stats[account_id]["failed_transactions"] += 1

            if transaction.transaction_type == "LIQUIDATION":
                stats[account_id]["liquidations"] += 1

            elif transaction.transaction_type == "BORROW":
                stats[account_id]["borrows"] += 1

            elif transaction.transaction_type == "REPAY":
                stats[account_id]["repays"] += 1

        # ----------------------------------------------------
        # Generate labels for ALL accounts
        # ----------------------------------------------------

        account_ids = [
            row[0]
            for row in db.query(Account.account_id).all()
        ]

        rows = []

        for account_id in account_ids:

            s = stats.get(
                account_id,
                {
                    "liquidations": 0,
                    "borrows": 0,
                    "repays": 0,
                    "total_transactions": 0,
                    "failed_transactions": 0,
                },
            )

            # ------------------------------------------------
            # Future failed transaction ratio
            # ------------------------------------------------

            if s["total_transactions"] > 0:
                failed_ratio = (
                    s["failed_transactions"]
                    / s["total_transactions"]
                )
            else:
                failed_ratio = 0.0

            # ------------------------------------------------
            # Risk score
            # ------------------------------------------------

            if s["liquidations"] >= 1:
                risk_score = 0.80

            elif failed_ratio >= 0.20:
                risk_score = 0.40

            else:
                risk_score = 0.00

            # ------------------------------------------------
            # Risk category
            # ------------------------------------------------

            if s["liquidations"] >= 1:
                risk_label = "HIGH"

            elif failed_ratio >= 0.20:
                risk_label = "MEDIUM"

            else:
                risk_label = "LOW"

            # ------------------------------------------------
            # Add row
            # ------------------------------------------------

            rows.append(
                {
                    "account_id": account_id,
                    "outcome_window_start": OUTCOME_START,
                    "outcome_window_end": OUTCOME_END,
                    "future_liquidation_count": s["liquidations"],
                    "future_borrow_count": s["borrows"],
                    "future_repay_count": s["repays"],
                    "future_failed_tx_ratio": failed_ratio,
                    "risk_score": Decimal(str(risk_score)),
                    "risk_label": risk_label,
                }
            )

        # ----------------------------------------------------
        # Save labels
        # ----------------------------------------------------

        for row in rows:

            existing = (
                db.query(RiskLabel)
                .filter(
                    RiskLabel.account_id == row["account_id"]
                )
                .first()
            )

            if existing:

                for key, value in row.items():

                    if key != "account_id":
                        setattr(existing, key, value)

            else:
                db.add(RiskLabel(**row))

        db.commit()

        print(
            f"Generated risk labels for {len(rows)} accounts"
        )

        # ----------------------------------------------------
        # Distribution
        # ----------------------------------------------------

        label_counts = {}

        for row in rows:

            label = row["risk_label"]

            label_counts[label] = (
                label_counts.get(label, 0) + 1
            )

        print(
            "\n========== RISK LABEL DISTRIBUTION =========="
        )

        for label, count in sorted(label_counts.items()):
            print(f"{label:<10} {count}")

        print(
            "============================================="
        )

        return rows

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    generate_risk_labels()