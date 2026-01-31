"""Adapters for external service integrations."""

from .firefly import (
    AccountInfo,
    AccountType,
    BudgetAnalysis,
    CategorySpending,
    ConnectionTestResult,
    FireflyClient,
    FireflyConfig,
    PiggyBank,
    SavingsMetrics,
    Transaction,
    TransactionType,
    WealthDistribution,
)

__all__ = [
    "AccountInfo",
    "AccountType",
    "BudgetAnalysis",
    "CategorySpending",
    "ConnectionTestResult",
    "FireflyClient",
    "FireflyConfig",
    "PiggyBank",
    "SavingsMetrics",
    "Transaction",
    "TransactionType",
    "WealthDistribution",
]
