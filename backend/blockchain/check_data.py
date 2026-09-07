from collections import Counter

from backend.database.models import (
    Account,
    Block,
    Token,
    Protocol,
    Transaction,
    DeFiEvent,
)
from backend.database.session import SessionLocal


def check_data():
    db = SessionLocal()

    try:
        print("\n========== DATASET CHECK ==========")

        # Basic counts
        print(f"Accounts:     {db.query(Account).count()}")
        print(f"Blocks:       {db.query(Block).count()}")
        print(f"Tokens:       {db.query(Token).count()}")
        print(f"Protocols:    {db.query(Protocol).count()}")
        print(f"Transactions: {db.query(Transaction).count()}")
        print(f"DeFi Events:  {db.query(DeFiEvent).count()}")

        # Transaction types
        print("\n========== TRANSACTION TYPES ==========")

        transaction_types = (
            db.query(Transaction.transaction_type)
            .all()
        )

        type_counts = Counter(
            row[0] for row in transaction_types
        )

        for tx_type, count in sorted(type_counts.items()):
            print(f"{tx_type:<15} {count}")

        # Transaction status
        print("\n========== TRANSACTION STATUS ==========")

        statuses = (
            db.query(Transaction.status)
            .all()
        )

        status_counts = Counter(
            row[0] for row in statuses
        )

        for status, count in sorted(status_counts.items()):
            print(f"{status:<15} {count}")

        print("\n========================================")

    finally:
        db.close()


if __name__ == "__main__":
    check_data()