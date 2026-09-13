from __future__ import annotations

import datetime as dt
import hashlib
import random
from collections import Counter
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
NUM_TRANSACTIONS = 20000

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
    """Generate a random timestamp inside the dataset period."""
    total_seconds = int(
        (END_DATE - START_DATE).total_seconds()
    )

    return START_DATE + dt.timedelta(
        seconds=random.randint(0, total_seconds)
    )


def random_amount(
    minimum: float,
    maximum: float,
) -> Decimal:
    """Generate a synthetic transaction amount."""
    return Decimal(
        str(
            round(
                random.uniform(
                    minimum,
                    maximum,
                ),
                6,
            )
        )
    )


# ============================================================
# ACCOUNT BEHAVIOR PROFILES
# ============================================================

BEHAVIOR_PROFILES = {

    "CONSERVATIVE": {
        "weight": 0.30,
        "borrow_probability": 0.05,
        "repay_probability": 0.90,
        "liquidation_probability": 0.01,
        "risk_multiplier": 0.50,
        "fail_probability": 0.01,
    },

    "NORMAL": {
        "weight": 0.40,
        "borrow_probability": 0.15,
        "repay_probability": 0.75,
        "liquidation_probability": 0.03,
        "risk_multiplier": 0.80,
        "fail_probability": 0.02,
    },

    "ACTIVE_TRADER": {
        "weight": 0.15,
        "borrow_probability": 0.25,
        "repay_probability": 0.65,
        "liquidation_probability": 0.05,
        "risk_multiplier": 1.00,
        "fail_probability": 0.04,
    },

    "HIGH_RISK_BORROWER": {
        "weight": 0.10,
        "borrow_probability": 0.45,
        "repay_probability": 0.40,
        "liquidation_probability": 0.15,
        "risk_multiplier": 1.50,
        "fail_probability": 0.07,
    },

    "HIGHLY_LEVERAGED": {
        "weight": 0.05,
        "borrow_probability": 0.60,
        "repay_probability": 0.30,
        "liquidation_probability": 0.25,
        "risk_multiplier": 2.00,
        "fail_probability": 0.12,
    },
}


def choose_behavior_profile() -> str:
    """Assign one hidden behavioral profile to an account."""

    profiles = list(BEHAVIOR_PROFILES.keys())

    weights = [
        BEHAVIOR_PROFILES[profile]["weight"]
        for profile in profiles
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

    for i in range(
        1,
        NUM_ACCOUNTS + 1,
    ):

        wallet_address = (
            "0x" + f"{i:040x}"
        )

        account = Account(
            wallet_address=wallet_address,
            chain_id=CHAIN_ID,
            created_at=(
                START_DATE
                + dt.timedelta(
                    days=random.randint(
                        0,
                        30,
                    )
                )
            ),
        )

        db.add(account)
        accounts.append(account)

    db.flush()

    print(
        f"Created {len(accounts)} accounts"
    )

    return accounts


# ============================================================
# GENERATE BLOCKS
# ============================================================

def generate_blocks(db) -> list[Block]:

    blocks = []

    current_time = START_DATE
    block_number = 10000000

    # Synthetic blockchain:
    # one block every 5 minutes.

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

        current_time += dt.timedelta(
            minutes=5
        )

    db.flush()

    print(
        f"Created {len(blocks)} blocks"
    )

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

    for i, (
        symbol,
        decimals,
    ) in enumerate(
        token_data,
        start=1,
    ):

        token = Token(
            token_address=(
                "0x" + f"{i + 1000:040x}"
            ),

            symbol=symbol,

            decimals=decimals,

            chain_id=CHAIN_ID,
        )

        db.add(token)
        tokens.append(token)

    db.flush()

    print(
        f"Created {len(tokens)} tokens"
    )

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

    for i, (
        name,
        protocol_type,
    ) in enumerate(
        protocol_data,
        start=1,
    ):

        protocol = Protocol(
            protocol_address=(
                "0x" + f"{i + 2000:040x}"
            ),

            name=name,

            protocol_type=protocol_type,

            chain_id=CHAIN_ID,
        )

        db.add(protocol)
        protocols.append(protocol)

    db.flush()

    print(
        f"Created {len(protocols)} protocols"
    )

    return protocols


# ============================================================
# TRANSACTION TYPE
# ============================================================

def choose_transaction_type(
    profile: str,
    outstanding_debt: Decimal,
) -> str:

    settings = BEHAVIOR_PROFILES[profile]

    # --------------------------------------------------------
    # Accounts with outstanding debt face liquidation risk.
    #
    # Risk depends on:
    #   1. Behavioral profile
    #   2. Outstanding debt
    #
    # This creates a stronger relationship between observable
    # borrowing behavior and future liquidation risk.
    # --------------------------------------------------------

    if outstanding_debt > 0:

        # ----------------------------------------------------
        # Convert debt into a normalized pressure value.
        #
        # 0      -> no additional pressure
        # 20000+ -> maximum pressure
        # ----------------------------------------------------

        debt_pressure = min(
            float(outstanding_debt) / 20000.0,
            1.0,
        )

        # ----------------------------------------------------
        # Base liquidation probability
        # ----------------------------------------------------

        liquidation_probability = (
            settings["liquidation_probability"]
            * settings["risk_multiplier"]
            * (1.0 + debt_pressure)
        )

        # ----------------------------------------------------
        # Prevent unrealistic probabilities.
        # ----------------------------------------------------

        liquidation_probability = min(
            liquidation_probability,
            0.60,
        )

        # ----------------------------------------------------
        # Liquidation decision
        # ----------------------------------------------------

        if random.random() < liquidation_probability:
            return "LIQUIDATION"

        # ----------------------------------------------------
        # Repayment decision
        # ----------------------------------------------------

        if random.random() < settings["repay_probability"]:
            return "REPAY"

    # --------------------------------------------------------
    # Borrowing behavior
    # --------------------------------------------------------

    if random.random() < settings["borrow_probability"]:
        return "BORROW"

    # --------------------------------------------------------
    # Normal blockchain activity
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Assign each account a hidden behavior profile.
    #
    # IMPORTANT:
    # This profile is NOT inserted into the ML features.
    # It exists only to control synthetic behavior.
    # --------------------------------------------------------

    account_profiles = {
        account.account_id:
            choose_behavior_profile()
        for account in accounts
    }

    # --------------------------------------------------------
    # Display profile distribution for validation.
    # --------------------------------------------------------

    profile_counts = Counter(
        account_profiles.values()
    )

    print()

    print("Behavior profile distribution:")

    for profile, count in profile_counts.items():
        print(
            f"{profile}: {count}"
        )

    print()

    # --------------------------------------------------------
    # Track outstanding debt for every account.
    # --------------------------------------------------------

    outstanding_debt = {
        account.account_id: Decimal("0")
        for account in accounts
    }

    # ========================================================
    # GENERATE TIMESTAMPS
    # ========================================================

    timestamps = [
        random_timestamp()
        for _ in range(
            NUM_TRANSACTIONS
        )
    ]

    timestamps.sort()

    # ========================================================
    # GENERATE TRANSACTIONS CHRONOLOGICALLY
    # ========================================================

    for i, timestamp in enumerate(
        timestamps
    ):

        sender = random.choice(
            accounts
        )

        account_id = sender.account_id

        profile = account_profiles[
            account_id
        ]

        # ----------------------------------------------------
        # Choose transaction type using the account's
        # current financial state.
        # ----------------------------------------------------

        tx_type = choose_transaction_type(
            profile,
            outstanding_debt[account_id],
        )

        receiver = None

        if tx_type in {
            "TRANSFER",
            "SWAP",
        }:

            receiver = random.choice(
                accounts
            )

            while (
                receiver.account_id
                == sender.account_id
            ):

                receiver = random.choice(
                    accounts
                )

        # ----------------------------------------------------
        # Find blockchain block corresponding to timestamp.
        # ----------------------------------------------------

        elapsed_seconds = int(
            (
                timestamp
                - START_DATE
            ).total_seconds()
        )

        block_index = (
            elapsed_seconds
            // (5 * 60)
        )

        block = blocks[
            min(
                block_index,
                len(blocks) - 1,
            )
        ]

        # ----------------------------------------------------
        # Select token.
        # ----------------------------------------------------

        token = random.choice(
            tokens
        )

        # ----------------------------------------------------
        # Select protocol for DeFi transactions.
        # ----------------------------------------------------

        protocol = None

        if tx_type in {
            "BORROW",
            "REPAY",
            "LIQUIDATION",
            "DEPOSIT",
            "WITHDRAW",
            "SWAP",
        }:

            protocol = random.choice(
                protocols
            )

        # ====================================================
        # GENERATE AMOUNT
        # ====================================================

        if tx_type == "REPAY":

            max_repayment = min(
                outstanding_debt[
                    account_id
                ],
                Decimal("10000"),
            )

            if max_repayment <= 0:

                amount = Decimal("0")

            else:

                minimum_repayment = (
                    max_repayment
                    * Decimal("0.10")
                )

                amount = Decimal(
                    str(
                        round(
                            random.uniform(
                                float(
                                    minimum_repayment
                                ),
                                float(
                                    max_repayment
                                ),
                            ),
                            6,
                        )
                    )
                )

        elif tx_type == "LIQUIDATION":

            amount = outstanding_debt[
                account_id
            ]

        elif tx_type == "BORROW":

            amount = random_amount(
                100,
                10000,
            )

        else:

            amount = random_amount(
                10,
                10000,
            )

        # ====================================================
        # TRANSACTION STATUS
        #
        # Failure probability depends on the account's hidden
        # behavior profile AND its current debt pressure.
        #
        # Rationale: risky / over-leveraged accounts submit
        # transactions that revert more often (insufficient
        # collateral, aggressive positions, gas issues).
        #
        # This makes failed-transaction behaviour a LEARNABLE
        # behavioural risk signal (like liquidations), instead
        # of uniform random noise that no model can predict.
        # ====================================================

        debt_pressure = min(
            float(outstanding_debt[account_id]) / 20000.0,
            1.0,
        )

        fail_probability = min(
            BEHAVIOR_PROFILES[profile]["fail_probability"]
            * (1.0 + debt_pressure),
            0.50,
        )

        status = (
            "SUCCESS"
            if random.random() >= fail_probability
            else "FAILED"
        )

        # ====================================================
        # UPDATE ACCOUNT DEBT
        # ====================================================

        if status == "SUCCESS":

            if tx_type == "BORROW":

                outstanding_debt[
                    account_id
                ] += amount

            elif tx_type == "REPAY":

                outstanding_debt[
                    account_id
                ] -= amount

                if (
                    outstanding_debt[
                        account_id
                    ]
                    < 0
                ):

                    outstanding_debt[
                        account_id
                    ] = Decimal("0")

            elif tx_type == "LIQUIDATION":

                outstanding_debt[
                    account_id
                ] = Decimal("0")

        # ====================================================
        # CREATE TRANSACTION
        # ====================================================

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

            status=status,

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

def generate_defi_events(
    db,
    transaction_data,
):

    event_count = 0

    for (
        transaction,
        profile,
        protocol,
        token,
    ) in transaction_data:

        # ----------------------------------------------------
        # No protocol -> no DeFi event.
        # ----------------------------------------------------

        if protocol is None:
            continue

        # ----------------------------------------------------
        # Only DeFi-related transactions create events.
        # ----------------------------------------------------

        if transaction.transaction_type not in {
            "BORROW",
            "REPAY",
            "LIQUIDATION",
            "DEPOSIT",
            "WITHDRAW",
        }:

            continue

        # ----------------------------------------------------
        # Failed transactions do not create successful
        # financial events.
        # ----------------------------------------------------

        if transaction.status != "SUCCESS":
            continue

        event_type = (
            transaction.transaction_type
        )

        collateral_amount = None
        debt_amount = None

        # ----------------------------------------------------
        # BORROW
        # ----------------------------------------------------

        if event_type == "BORROW":

            debt_amount = (
                transaction.amount
            )

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

        # ----------------------------------------------------
        # REPAY
        # ----------------------------------------------------

        elif event_type == "REPAY":

            debt_amount = (
                transaction.amount
            )

        # ----------------------------------------------------
        # LIQUIDATION
        # ----------------------------------------------------

        elif event_type == "LIQUIDATION":

            debt_amount = (
                transaction.amount
            )

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

        # ----------------------------------------------------
        # DEPOSIT
        # ----------------------------------------------------

        elif event_type == "DEPOSIT":

            collateral_amount = (
                transaction.amount
            )

        # ----------------------------------------------------
        # CREATE DEFI EVENT
        # ----------------------------------------------------

        event = DeFiEvent(

            transaction_id=(
                transaction.transaction_id
            ),

            account_id=(
                transaction.from_account_id
            ),

            protocol_id=(
                protocol.protocol_id
            ),

            event_type=event_type,

            token_id=token.token_id,

            amount=transaction.amount,

            collateral_amount=(
                collateral_amount
            ),

            debt_amount=(
                debt_amount
            ),

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

        print(
            "Starting synthetic DeFi dataset generation..."
        )

        accounts = generate_accounts(
            db
        )

        blocks = generate_blocks(
            db
        )

        tokens = generate_tokens(
            db
        )

        protocols = generate_protocols(
            db
        )

        transaction_data = (
            generate_transactions(
                db,
                accounts,
                blocks,
                tokens,
                protocols,
            )
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

        print(
            f"Accounts:     {len(accounts)}"
        )

        print(
            f"Transactions: {len(transaction_data)}"
        )

        print()

    except Exception:

        db.rollback()

        raise

    finally:

        db.close()


if __name__ == "__main__":
    main()