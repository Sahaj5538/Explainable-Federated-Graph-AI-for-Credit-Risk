from __future__ import annotations

import datetime as dt
from decimal import Decimal

from backend.database.models import (
    Account,
    Block,
    DeFiEvent,
    Protocol,
    Token,
    Transaction,
)
from backend.database.session import SessionLocal


def test_database() -> None:
    db = SessionLocal()

    try:
        # 1. Create account
        account = Account(
            wallet_address="0x0000000000000000000000000000000000000001",
            chain_id=1,
            created_at=dt.datetime.now(),
        )
        db.add(account)
        db.flush()

        # 2. Create block
        block = Block(
            block_number=1000000,
            block_hash="0x" + "1" * 64,
            timestamp=dt.datetime.now(),
            chain_id=1,
        )
        db.add(block)

        # 3. Create token
        token = Token(
            token_address="0x0000000000000000000000000000000000000002",
            symbol="USDC",
            decimals=6,
            chain_id=1,
        )
        db.add(token)
        db.flush()

        # 4. Create DeFi protocol
        protocol = Protocol(
            protocol_address="0x0000000000000000000000000000000000000003",
            name="TestLend",
            protocol_type="LENDING",
            chain_id=1,
        )
        db.add(protocol)
        db.flush()

        # 5. Create transaction
        transaction = Transaction(
            transaction_hash="0x" + "a" * 64,
            block_number=block.block_number,
            timestamp=block.timestamp,
            from_account_id=account.account_id,
            to_account_id=None,
            transaction_type="DEPOSIT",
            amount=Decimal("1000.00"),
            token_id=token.token_id,
            protocol_id=protocol.protocol_id,
            gas_used=21000,
            gas_price=Decimal("30"),
            status="SUCCESS",
            chain_id=1,
        )
        db.add(transaction)
        db.flush()

        # 6. Create DeFi event
        event = DeFiEvent(
            transaction_id=transaction.transaction_id,
            account_id=account.account_id,
            protocol_id=protocol.protocol_id,
            event_type="DEPOSIT",
            token_id=token.token_id,
            amount=Decimal("1000.00"),
            collateral_amount=Decimal("1000.00"),
            debt_amount=None,
            timestamp=transaction.timestamp,
        )
        db.add(event)

        db.commit()

        print("Database smoke test PASSED")
        print(f"Account ID: {account.account_id}")
        print(f"Transaction ID: {transaction.transaction_id}")
        print(f"DeFi Event ID: {event.event_id}")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    test_database()