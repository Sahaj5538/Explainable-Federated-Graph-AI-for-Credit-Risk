from __future__ import annotations

import datetime as dt
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)

from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all database models."""


# ============================================================
# ACCOUNT
# ============================================================

class Account(Base):
    """Blockchain wallet/account."""

    __tablename__ = "accounts"

    account_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    wallet_address: Mapped[str] = mapped_column(
        String(42),
        unique=True,
        nullable=False,
        index=True,
    )

    chain_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime,
        nullable=False,
    )

    transactions_sent: Mapped[list["Transaction"]] = relationship(
        foreign_keys="Transaction.from_account_id",
        back_populates="sender",
    )

    transactions_received: Mapped[list["Transaction"]] = relationship(
        foreign_keys="Transaction.to_account_id",
        back_populates="receiver",
    )

    defi_events: Mapped[list["DeFiEvent"]] = relationship(
        back_populates="account",
    )

    def __repr__(self) -> str:
        return f"Account(id={self.account_id}, address={self.wallet_address!r})"
    features: Mapped["AccountFeature | None"] = relationship(
        back_populates="account",
        uselist=False,
        cascade="all, delete-orphan",
    )
    risk_label: Mapped["RiskLabel | None"] = relationship(
        "RiskLabel",
        back_populates="account",
        uselist=False,
        cascade="all, delete-orphan",
    )

# ============================================================
# BLOCK
# ============================================================

class Block(Base):
    """Blockchain block."""

    __tablename__ = "blocks"

    block_number: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
    )

    block_hash: Mapped[str] = mapped_column(
        String(66),
        unique=True,
        nullable=False,
    )

    timestamp: Mapped[dt.datetime] = mapped_column(
        DateTime,
        nullable=False,
        index=True,
    )

    chain_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )

    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="block",
    )

    def __repr__(self) -> str:
        return f"Block(number={self.block_number})"


# ============================================================
# TOKEN
# ============================================================

class Token(Base):
    """Blockchain token/asset."""

    __tablename__ = "tokens"

    token_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    token_address: Mapped[str] = mapped_column(
        String(42),
        unique=True,
        nullable=False,
    )

    symbol: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    decimals: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=18,
    )

    chain_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="token",
    )

    defi_events: Mapped[list["DeFiEvent"]] = relationship(
        back_populates="token",
    )

    def __repr__(self) -> str:
        return f"Token(id={self.token_id}, symbol={self.symbol!r})"


# ============================================================
# PROTOCOL
# ============================================================

class Protocol(Base):
    """DeFi protocol."""

    __tablename__ = "protocols"

    protocol_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    protocol_address: Mapped[str] = mapped_column(
        String(42),
        unique=True,
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    protocol_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    chain_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="protocol",
    )

    defi_events: Mapped[list["DeFiEvent"]] = relationship(
        back_populates="protocol",
    )

    def __repr__(self) -> str:
        return f"Protocol(id={self.protocol_id}, name={self.name!r})"


# ============================================================
# TRANSACTION
# ============================================================

class Transaction(Base):
    """Raw blockchain transaction."""

    __tablename__ = "transactions"

    transaction_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    transaction_hash: Mapped[str] = mapped_column(
        String(66),
        unique=True,
        nullable=False,
        index=True,
    )

    block_number: Mapped[int] = mapped_column(
        ForeignKey("blocks.block_number"),
        nullable=False,
        index=True,
    )

    timestamp: Mapped[dt.datetime] = mapped_column(
        DateTime,
        nullable=False,
        index=True,
    )

    from_account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.account_id"),
        nullable=False,
        index=True,
    )

    to_account_id: Mapped[int | None] = mapped_column(
        ForeignKey("accounts.account_id"),
        nullable=True,
        index=True,
    )

    transaction_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(30, 10),
        nullable=False,
    )

    token_id: Mapped[int | None] = mapped_column(
        ForeignKey("tokens.token_id"),
        nullable=True,
        index=True,
    )

    protocol_id: Mapped[int | None] = mapped_column(
        ForeignKey("protocols.protocol_id"),
        nullable=True,
        index=True,
    )

    gas_used: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    gas_price: Mapped[Decimal] = mapped_column(
        Numeric(30, 10),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="SUCCESS",
        index=True,
    )

    chain_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )

    block: Mapped["Block"] = relationship(
        back_populates="transactions",
    )

    sender: Mapped["Account"] = relationship(
        foreign_keys=[from_account_id],
        back_populates="transactions_sent",
    )

    receiver: Mapped["Account | None"] = relationship(
        foreign_keys=[to_account_id],
        back_populates="transactions_received",
    )

    token: Mapped["Token | None"] = relationship(
        back_populates="transactions",
    )

    protocol: Mapped["Protocol | None"] = relationship(
        back_populates="transactions",
    )

    defi_events: Mapped[list["DeFiEvent"]] = relationship(
        back_populates="transaction",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"Transaction("
            f"id={self.transaction_id}, "
            f"type={self.transaction_type!r})"
        )


# ============================================================
# DEFI EVENT
# ============================================================

class DeFiEvent(Base):
    """DeFi-specific event associated with a transaction."""

    __tablename__ = "defi_events"

    event_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.transaction_id"),
        nullable=False,
        index=True,
    )

    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.account_id"),
        nullable=False,
        index=True,
    )

    protocol_id: Mapped[int] = mapped_column(
        ForeignKey("protocols.protocol_id"),
        nullable=False,
        index=True,
    )

    event_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
    )

    token_id: Mapped[int | None] = mapped_column(
        ForeignKey("tokens.token_id"),
        nullable=True,
        index=True,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(30, 10),
        nullable=False,
    )

    collateral_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(30, 10),
        nullable=True,
    )

    debt_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(30, 10),
        nullable=True,
    )

    timestamp: Mapped[dt.datetime] = mapped_column(
        DateTime,
        nullable=False,
        index=True,
    )

    transaction: Mapped["Transaction"] = relationship(
        back_populates="defi_events",
    )

    account: Mapped["Account"] = relationship(
        back_populates="defi_events",
    )

    protocol: Mapped["Protocol"] = relationship(
        back_populates="defi_events",
    )

    token: Mapped["Token | None"] = relationship(
        back_populates="defi_events",
    )

    def __repr__(self) -> str:
        return (
            f"DeFiEvent("
            f"id={self.event_id}, "
            f"type={self.event_type!r})"
        )
class AccountFeature(Base):
    __tablename__ = "account_features"

    feature_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.account_id"),
        nullable=False,
        unique=True,
        index=True,
    )

    transaction_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    successful_transactions: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    failed_transactions: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    failed_tx_ratio: Mapped[Decimal] = mapped_column(
        Numeric(10, 6),
        nullable=False,
        default=0,
    )

    total_volume: Mapped[Decimal] = mapped_column(
        Numeric(30, 10),
        nullable=False,
        default=0,
    )

    borrow_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    borrow_volume: Mapped[Decimal] = mapped_column(
        Numeric(30, 10),
        nullable=False,
        default=0,
    )

    repay_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    repay_volume: Mapped[Decimal] = mapped_column(
        Numeric(30, 10),
        nullable=False,
        default=0,
    )

    repayment_ratio: Mapped[Decimal] = mapped_column(
        Numeric(10, 6),
        nullable=False,
        default=0,
    )

    deposit_volume: Mapped[Decimal] = mapped_column(
        Numeric(30, 10),
        nullable=False,
        default=0,
    )

    withdrawal_volume: Mapped[Decimal] = mapped_column(
        Numeric(30, 10),
        nullable=False,
        default=0,
    )

    net_deposit_flow: Mapped[Decimal] = mapped_column(
        Numeric(30, 10),
        nullable=False,
        default=0,
    )

    unique_counterparties: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    unique_tokens: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    unique_protocols: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    active_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    historical_liquidation_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    account: Mapped["Account"] = relationship(
        back_populates="features",
    )
class RiskLabel(Base):
    __tablename__ = "risk_labels"

    label_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.account_id"),
        nullable=False,
        unique=True,
        index=True,
    )

    outcome_window_start: Mapped[dt.datetime] = mapped_column(
        DateTime,
        nullable=False,
    )

    outcome_window_end: Mapped[dt.datetime] = mapped_column(
        DateTime,
        nullable=False,
    )

    future_liquidation_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    future_borrow_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    future_repay_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    future_failed_tx_ratio: Mapped[Decimal] = mapped_column(
        Numeric(10, 6),
        nullable=False,
        default=0,
    )

    risk_score: Mapped[Decimal] = mapped_column(
        Numeric(10, 6),
        nullable=False,
    )

    risk_label: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )

    account: Mapped["Account"] = relationship(
        "Account",
        back_populates="risk_label",
    )
    