from __future__ import annotations

import datetime as dt
import hashlib
import random
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


# ============================================================
# CONFIGURATION
# ============================================================

NUM_ACCOUNTS = 1000
NUM_TRANSACTIONS = 10000

CHAIN_ID = 1

START_DATE = dt.datetime(2025, 1, 1)
END_DATE = dt.datetime(2025, 6, 30)

random.seed(42)


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def make_hash(value: str) -> str:
    """Create a deterministic 64-character hexadecimal hash."""
    return hashlib.sha256(value.encode()).hexdigest()


def random_timestamp() -> dt.datetime:
    """Generate a random timestamp inside the observation period."""
    total_seconds = int((END_DATE - START_DATE).total_seconds())

    return START_DATE + dt.timedelta(
        seconds=random.randint(0, total_seconds)
    )


def random_amount(minimum: float, maximum: float) -> Decimal:
    """Generate a transaction amount."""
    return Decimal(str(round(random.uniform(minimum, maximum), 6)))


# ============================================================
# ACCOUNT BEHAVIOR PROFILES
# ============================================================

BEHAVIOR_PROFILES = {
    "CONSERVATIVE": {
        "weight": 0.30,
        "borrow_probability": 0.05,
        "repay_probability": 0.90,
        "liquidation_probability": 0.01,
    },
    "NORMAL": {
        "weight": 0.40,
        "borrow_probability": 0.15,
        "repay_probability": 0.75,
        "liquidation_probability": 0.03,
    },
    "ACTIVE_TRADER": {
        "weight": 0.15,
        "borrow_probability": 0.25,
        "repay_probability": 0.65,
        "liquidation_probability": 0.05,
    },
    "HIGH_RISK_BORROWER": {
        "weight": 0.10,
        "borrow_probability": 0.45,
        "repay_probability": 0.40,
        "liquidation_probability": 0.15,
    },
    "HIGHLY_LEVERAGED": {
        "weight": 0.05,
        "borrow_probability": 0.60,
        "repay_probability": 0.30,
        "liquidation_probability": 0.25,
    },
}


def choose_behavior_profile() -> str:
    """Choose a realistic account behavior profile."""

    profiles = list(BEHAVIOR_PROFILES.keys())

    weights = [
        BEHAVIOR_PROFILES[p]["weight"]
        for p in profiles
    ]

    return random.choices(
        profiles,
        weights=weights,
        k=1,
    )[0]


# ============================================================
# GENERATE ACCOUNTS
# ============================================================

def generate_accounts(db) -> list[Account]:

    accounts = []

    for i in range(1, NUM_ACCOUNTS + 1):

        wallet_address = "0x" + f"{i:040x}"

        account = Account(
            wallet_address=wallet_address,
            chain_id=CHAIN_ID,
            created_at=START_DATE
            + dt.timedelta(
                days=random.randint(0, 30)
            ),
        )

        db.add(account)
        accounts.append(account)

    db.flush()

    print(f"Created {len(accounts)} accounts")

    return accounts


# ============================================================
# GENERATE BLOCKS
# ============================================================

def generate_blocks(db) -> list[Block]:

    blocks = []

    current_time = START_DATE
    block_number = 10000000

    # Synthetic blockchain: one block every 5 minutes
    while current_time <= END_DATE:

        block = Block(
            block_number=block_number,
            block_hash="0x" + make_hash(
                f"block-{block_number}"
            ),
            timestamp=current_time,
            chain_id=CHAIN_ID,
        )

        db.add(block)
        blocks.append(block)

        block_number += 1
        current_time += dt.timedelta(minutes=5)

    db.flush()

    print(f"Created {len(blocks)} blocks")

    return blocks


# ============================================================
# GENERATE TOKENS
# ============================================================

def generate_tokens(db) -> list[Token]:

    token_data = [
        ("USDC", 6),
        ("USDT", 6),
        ("DAI", 18),
        ("WETH", 18),
        ("WBTC", 8),
    ]

    tokens = []

    for i, (symbol, decimals) in enumerate(token_data, start=1):

        token = Token(
            token_address="0x" + f"{i + 1000:040x}",
            symbol=symbol,
            decimals=decimals,
            chain_id=CHAIN_ID,
        )

        db.add(token)
        tokens.append(token)

    db.flush()

    print(f"Created {len(tokens)} tokens")

    return tokens


# ============================================================
# GENERATE PROTOCOLS
# ============================================================

def generate_protocols(db) -> list[Protocol]:

    protocol_data = [
        ("AaveLike", "LENDING"),
        ("CompoundLike", "LENDING"),
        ("UniswapLike", "DEX"),
        ("MakerLike", "LENDING"),
    ]

    protocols = []

    for i, (name, protocol_type) in enumerate(
        protocol_data,
        start=1,
    ):

        protocol = Protocol(
            protocol_address="0x" + f"{i + 2000:040x}",
            name=name,
            protocol_type=protocol_type,
            chain_id=CHAIN_ID,
        )

        db.add(protocol)
        protocols.append(protocol)

    db.flush()

    print(f"Created {len(protocols)} protocols")

    return protocols


# ============================================================
# TRANSACTION TYPE
# ============================================================

def choose_transaction_type(
    profile: str,
    outstanding_debt: Decimal,
) -> str:

    settings = BEHAVIOR_PROFILES[profile]

    # If the account currently has debt, it can repay
    # or potentially be liquidated.
    if outstanding_debt > 0:

        liquidation_roll = random.random()

        if liquidation_roll < settings["liquidation_probability"]:
            return "LIQUIDATION"

        repay_roll = random.random()

        if repay_roll < settings["repay_probability"]:
            return "REPAY"

    # Otherwise, decide whether to borrow.
    if random.random() < settings["borrow_probability"]:
        return "BORROW"

    # Normal activity
    roll = random.random()

    if roll < 0.35:
        return "TRANSFER"

    if roll < 0.60:
        return "SWAP"

    if roll < 0.80:
        return "DEPOSIT"

    return "WITHDRAW"


# ============================================================
# GENERATE TRANSACTIONS
# ============================================================

def generate_transactions(
    db,
    accounts,
    blocks,
    tokens,
    protocols,
):

    transactions = []

    # Assign every account a behavioral profile
    account_profiles = {
        account.account_id: choose_behavior_profile()
        for account in accounts
    }

    # Track outstanding debt for every account
    outstanding_debt = {
        account.account_id: Decimal("0")
        for account in accounts
    }

    for i in range(NUM_TRANSACTIONS):

        sender = random.choice(accounts)

        account_id = sender.account_id

        profile = account_profiles[account_id]

        tx_type = choose_transaction_type(
            profile,
            outstanding_debt[account_id],
        )

        receiver = None

        if tx_type in {
            "TRANSFER",
            "SWAP",
        }:
            receiver = random.choice(accounts)

            while receiver.account_id == sender.account_id:
                receiver = random.choice(accounts)

        timestamp = random_timestamp()

        # Calculate corresponding synthetic block
        elapsed_seconds = int(
            (timestamp - START_DATE).total_seconds()
        )

        block_index = elapsed_seconds // (5 * 60)

        block = blocks[
            min(block_index, len(blocks) - 1)
        ]

        token = random.choice(tokens)

        protocol = None

        if tx_type in {
            "BORROW",
            "REPAY",
            "LIQUIDATION",
            "DEPOSIT",
            "WITHDRAW",
            "SWAP",
        }:
            protocol = random.choice(protocols)

        # ----------------------------------------------------
        # Generate transaction amount
        # ----------------------------------------------------

        if tx_type == "REPAY":

            # Repayment cannot exceed outstanding debt
            max_repayment = min(
                outstanding_debt[account_id],
                Decimal("10000"),
            )

            amount = (
                Decimal("0")
                if max_repayment <= 0
                else Decimal(
                    str(
                        round(
                            random.uniform(
                                float(max_repayment * Decimal("0.10")),
                                float(max_repayment),
                            ),
                            6,
                        )
                    )
                )
            )

            outstanding_debt[account_id] -= amount

        elif tx_type == "LIQUIDATION":

            # Liquidation clears the remaining debt
            amount = outstanding_debt[account_id]

            outstanding_debt[account_id] = Decimal("0")

        elif tx_type == "BORROW":

            amount = random_amount(
                100,
                10000,
            )

            outstanding_debt[account_id] += amount

        else:

            amount = random_amount(
                10,
                10000,
            )

        transaction = Transaction(
            transaction_hash="0x" + make_hash(
                f"transaction-{i}"
            ),

            block_number=block.block_number,

            timestamp=timestamp,

            from_account_id=sender.account_id,

            to_account_id=(
                receiver.account_id
                if receiver
                else None
            ),

            transaction_type=tx_type,

            amount=amount,

            token_id=token.token_id,

            protocol_id=(
                protocol.protocol_id
                if protocol
                else None
            ),

            gas_used=random.randint(
                21000,
                250000,
            ),

            gas_price=Decimal(
                str(
                    round(
                        random.uniform(
                            10,
                            100,
                        ),
                        4,
                    )
                )
            ),

            status=(
                "SUCCESS"
                if random.random() < 0.97
                else "FAILED"
            ),

            chain_id=CHAIN_ID,
        )

        db.add(transaction)

        transactions.append(
            (
                transaction,
                profile,
                protocol,
                token,
            )
        )

    db.flush()

    print(
        f"Created {len(transactions)} transactions"
    )

    return transactions


# ============================================================
# GENERATE DEFI EVENTS
# ============================================================

def generate_defi_events(db, transaction_data):

    event_count = 0

    for transaction, profile, protocol, token in transaction_data:

        if protocol is None:
            continue

        if transaction.transaction_type not in {
            "BORROW",
            "REPAY",
            "LIQUIDATION",
            "DEPOSIT",
            "WITHDRAW",
        }:
            continue

        event_type = transaction.transaction_type

        collateral_amount = None
        debt_amount = None

        if event_type == "BORROW":

            debt_amount = transaction.amount

            collateral_amount = (
                transaction.amount
                * Decimal(
                    str(
                        random.uniform(
                            1.2,
                            2.5,
                        )
                    )
                )
            )

        elif event_type == "REPAY":

            debt_amount = transaction.amount

        elif event_type == "LIQUIDATION":

            debt_amount = transaction.amount

            collateral_amount = (
                transaction.amount
                * Decimal(
                    str(
                        random.uniform(
                        0.8,
                        1.2,
                    )
                )
            )
        )

        elif event_type == "DEPOSIT":

            collateral_amount = transaction.amount

        event = DeFiEvent(
            transaction_id=transaction.transaction_id,

            account_id=transaction.from_account_id,

            protocol_id=protocol.protocol_id,

            event_type=event_type,

            token_id=token.token_id,

            amount=transaction.amount,

            collateral_amount=collateral_amount,

            debt_amount=debt_amount,

            timestamp=transaction.timestamp,
        )

        db.add(event)

        event_count += 1

    db.flush()

    print(
        f"Created {event_count} DeFi events"
    )


# ============================================================
# MAIN
# ============================================================

def main():

    db = SessionLocal()

    try:

        print("Starting synthetic DeFi dataset generation...")

        accounts = generate_accounts(db)

        blocks = generate_blocks(db)

        tokens = generate_tokens(db)

        protocols = generate_protocols(db)

        transaction_data = generate_transactions(
            db,
            accounts,
            blocks,
            tokens,
            protocols,
        )

        generate_defi_events(
            db,
            transaction_data,
        )

        db.commit()

        print()
        print("=" * 50)
        print("DATA GENERATION COMPLETE")
        print("=" * 50)
        print(f"Accounts:     {len(accounts)}")
        print(f"Transactions: {len(transaction_data)}")
        print()

    except Exception:

        db.rollback()
        raise

    finally:

        db.close()


if __name__ == "__main__":
    main()