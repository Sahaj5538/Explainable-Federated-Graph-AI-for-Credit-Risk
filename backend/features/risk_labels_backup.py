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
# RISK SCORE WEIGHTS
# ============================================================

LIQUIDATION_WEIGHT = 0.60
DEBT_BEHAVIOR_WEIGHT = 0.30
FAILED_TRANSACTION_WEIGHT = 0.10


# ============================================================
# MEDIUM-RISK QUANTILE
# ============================================================
#
# Among accounts without liquidation:
#
# bottom 75%  -> LOW
# top 25%     -> MEDIUM
#
# This avoids an arbitrary fixed threshold that may produce
# zero MEDIUM examples.
# ============================================================

MEDIUM_QUANTILE = 0.75


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

        print(
            f"Outcome transactions: {len(transactions)}"
        )

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
        # Get all accounts
        # ----------------------------------------------------

        account_ids = [
            row[0]
            for row in db.query(
                Account.account_id
            ).all()
        ]

        # ====================================================
        # FIRST PASS
        # ====================================================
        #
        # Calculate continuous risk score for every account.
        #
        # We do NOT assign LOW/MEDIUM/HIGH yet because the
        # MEDIUM threshold will be determined from the actual
        # distribution of non-liquidated accounts.
        # ====================================================

        calculated_rows = []

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
            # Liquidation component
            # ------------------------------------------------

            if s["liquidations"] >= 1:

                liquidation_component = 1.0

            else:

                liquidation_component = 0.0

            # ------------------------------------------------
            # Borrow / repayment behavior
            # ------------------------------------------------

            borrow_count = s["borrows"]
            repay_count = s["repays"]

            if borrow_count == 0:

                debt_behavior_component = 0.0

            else:

                borrow_repay_ratio = (
                    borrow_count
                    / max(repay_count, 1)
                )

                debt_behavior_component = min(
                    max(
                        (borrow_repay_ratio - 1.0)
                        / 4.0,
                        0.0,
                    ),
                    1.0,
                )

            # ------------------------------------------------
            # Failed transaction component
            # ------------------------------------------------

            failed_component = min(
                failed_ratio / 0.50,
                1.0,
            )

            # =================================================
            # CONTINUOUS RISK SCORE
            # =================================================

            risk_score = (
                LIQUIDATION_WEIGHT
                * liquidation_component

                + DEBT_BEHAVIOR_WEIGHT
                * debt_behavior_component

                + FAILED_TRANSACTION_WEIGHT
                * failed_component
            )

            risk_score = min(
                max(
                    risk_score,
                    0.0,
                ),
                1.0,
            )

            calculated_rows.append(
                {
                    "account_id": account_id,

                    "liquidations":
                        s["liquidations"],

                    "borrows":
                        s["borrows"],

                    "repays":
                        s["repays"],

                    "failed_ratio":
                        failed_ratio,

                    "risk_score":
                        risk_score,
                }
            )

        # ====================================================
        # DETERMINE MEDIUM-RISK ACCOUNTS
        # ====================================================
        #
        # All accounts with a future liquidation are HIGH.
        #
        # Among the remaining accounts, rank by their continuous
        # future-risk score and assign the highest 25% to MEDIUM.
        #
        # We use ranking rather than a numerical threshold because
        # many low-risk accounts can legitimately have exactly the
        # same score (often 0.0).
        # ====================================================

        non_liquidated_rows = [
            row
            for row in calculated_rows
            if row["liquidations"] == 0
        ]

        non_liquidated_rows.sort(
            key=lambda row: row["risk_score"],
            reverse=True,
        )

        medium_count = int(
            len(non_liquidated_rows) * 0.25
        )

        medium_account_ids = {
            row["account_id"]
            for row in non_liquidated_rows[:medium_count]
        }

        print()
        print(
            "Non-liquidated accounts: "
            f"{len(non_liquidated_rows)}"
        )

        print(
            "Selected MEDIUM-risk accounts: "
            f"{len(medium_account_ids)}"
        )
        # ====================================================
        # SECOND PASS — ASSIGN RISK BANDS
        # ====================================================

        rows = []

        for row in calculated_rows:

            # ------------------------------------------------
            # Liquidation always takes priority.
            # ------------------------------------------------

            if row["liquidations"] >= 1:

                risk_label = "HIGH"

            elif row["account_id"] in medium_account_ids:

                risk_label = "MEDIUM"

            else:

                risk_label = "LOW"

            # ------------------------------------------------
            # Create database row
            # ------------------------------------------------

            rows.append(
                {
                    "account_id":
                        row["account_id"],

                    "outcome_window_start":
                        OUTCOME_START,

                    "outcome_window_end":
                        OUTCOME_END,

                    "future_liquidation_count":
                        row["liquidations"],

                    "future_borrow_count":
                        row["borrows"],

                    "future_repay_count":
                        row["repays"],

                    "future_failed_tx_ratio":
                        row["failed_ratio"],

                    "risk_score":
                        Decimal(
                            str(
                                round(
                                    row["risk_score"],
                                    6,
                                )
                            )
                        ),

                    "risk_label":
                        risk_label,
                }
            )

        # ====================================================
        # SAVE LABELS
        # ====================================================

        for row in rows:

            existing = (
                db.query(RiskLabel)
                .filter(
                    RiskLabel.account_id
                    == row["account_id"]
                )
                .first()
            )

            if existing:

                for key, value in row.items():

                    if key != "account_id":

                        setattr(
                            existing,
                            key,
                            value,
                        )

            else:

                db.add(
                    RiskLabel(**row)
                )

        db.commit()

        print(
            f"Generated risk labels for "
            f"{len(rows)} accounts"
        )

        # ====================================================
        # LABEL DISTRIBUTION
        # ====================================================

        label_counts = {
            "LOW": 0,
            "MEDIUM": 0,
            "HIGH": 0,
        }

        for row in rows:

            label_counts[
                row["risk_label"]
            ] += 1

        print()
        print(
            "========== RISK LABEL DISTRIBUTION =========="
        )

        for label in [
            "LOW",
            "MEDIUM",
            "HIGH",
        ]:

            print(
                f"{label:<10} "
                f"{label_counts[label]}"
            )

        print(
            "============================================="
        )

        # ====================================================
        # RISK SCORE STATISTICS
        # ====================================================

        scores = [
            float(row["risk_score"])
            for row in rows
        ]

        if scores:

            print()
            print(
                "========== RISK SCORE STATISTICS =========="
            )

            print(
                f"Minimum: {min(scores):.3f}"
            )

            print(
                f"Maximum: {max(scores):.3f}"
            )

            print(
                f"Mean:    "
                f"{sum(scores) / len(scores):.3f}"
            )

            print(
                "============================================"
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