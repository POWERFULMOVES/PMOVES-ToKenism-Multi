"""
Firefly-iii API Client for Python

Handles all interactions with PMOVES-Firefly-iii API.
Mirrors the TypeScript client in integrations/firefly/firefly-client.ts

Production-hardened with:
- Immutable dataclasses with validation
- Enum types for constrained values
- Comprehensive logging for debugging
- Explicit error handling and reporting
"""

import logging
import os
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)


# ============================================
# Enums for Type Safety
# ============================================


class TransactionType(str, Enum):
    """Valid transaction types in Firefly-iii."""

    WITHDRAWAL = "withdrawal"
    DEPOSIT = "deposit"
    TRANSFER = "transfer"

    @classmethod
    def from_str(cls, value: str) -> "TransactionType":
        """Convert string to TransactionType, with fallback logging."""
        try:
            return cls(value.lower())
        except ValueError:
            logger.warning(
                "[FireflyClient] Unknown transaction type '%s', defaulting to TRANSFER",
                value,
            )
            return cls.TRANSFER


class AccountType(str, Enum):
    """Valid account types in Firefly-iii."""

    ASSET = "asset"
    EXPENSE = "expense"
    REVENUE = "revenue"
    CASH = "cash"
    LIABILITY = "liability"
    INITIAL_BALANCE = "initial-balance"
    RECONCILIATION = "reconciliation"

    @classmethod
    def from_str(cls, value: str) -> "AccountType":
        """Convert string to AccountType, with fallback logging."""
        try:
            return cls(value.lower())
        except ValueError:
            logger.warning(
                "[FireflyClient] Unknown account type '%s', defaulting to ASSET",
                value,
            )
            return cls.ASSET


# ============================================
# Configuration
# ============================================


@dataclass(frozen=True)
class FireflyConfig:
    """Configuration for Firefly-iii API client.

    Immutable configuration to prevent accidental modification during runtime.
    """

    base_url: str = "http://firefly:8080"
    api_token: str = ""
    api_version: str = "v1"
    timeout: int = 30
    retry_count: int = 3

    def __post_init__(self) -> None:
        """Validate configuration after initialization."""
        if self.timeout <= 0:
            raise ValueError(f"timeout must be positive, got {self.timeout}")
        if self.retry_count < 0:
            raise ValueError(f"retry_count must be non-negative, got {self.retry_count}")

    @classmethod
    def from_env(cls) -> "FireflyConfig":
        """Create config from environment variables.

        Raises:
            ValueError: If FIREFLY_API_TOKEN is not set or empty,
                       or if other values are invalid.
        """
        api_token = os.getenv("FIREFLY_API_TOKEN", "")
        if not api_token:
            raise ValueError(
                "FIREFLY_API_TOKEN environment variable is required. "
                "Please set it to your Firefly-iii personal access token."
            )

        try:
            timeout = int(os.getenv("FIREFLY_TIMEOUT", "30"))
        except ValueError as e:
            raise ValueError(f"FIREFLY_TIMEOUT must be an integer: {e}") from e

        try:
            retry_count = int(os.getenv("FIREFLY_RETRY_COUNT", "3"))
        except ValueError as e:
            raise ValueError(f"FIREFLY_RETRY_COUNT must be an integer: {e}") from e

        return cls(
            base_url=os.getenv("FIREFLY_BASE_URL", "http://firefly:8080"),
            api_token=api_token,
            api_version=os.getenv("FIREFLY_API_VERSION", "v1"),
            timeout=timeout,
            retry_count=retry_count,
        )


# ============================================
# Data Models (Immutable)
# ============================================


@dataclass(frozen=True)
class CategorySpending:
    """Spending by category."""

    category: str
    amount: Decimal
    count: int

    def __post_init__(self) -> None:
        """Validate spending data."""
        if self.count < 0:
            raise ValueError(f"count must be non-negative, got {self.count}")


@dataclass(frozen=True)
class BudgetAnalysis:
    """Budget vs actual analysis."""

    budget_name: str
    budgeted: Decimal
    actual: Decimal

    @property
    def variance(self) -> Decimal:
        """Calculate variance (budgeted - actual)."""
        return self.budgeted - self.actual

    @property
    def variance_percent(self) -> Decimal:
        """Calculate variance percentage."""
        if self.budgeted == 0:
            return Decimal("0")
        return (self.variance / self.budgeted) * 100


@dataclass(frozen=True)
class AccountInfo:
    """Account information."""

    name: str
    balance: Decimal
    account_type: AccountType


@dataclass(frozen=True)
class WealthDistribution:
    """Wealth distribution for a user."""

    user_id: str
    accounts: tuple[AccountInfo, ...]  # Immutable tuple instead of list

    @property
    def total_wealth(self) -> Decimal:
        """Calculate total wealth from all accounts."""
        return sum((acc.balance for acc in self.accounts), Decimal("0"))


@dataclass(frozen=True)
class PiggyBank:
    """Piggy bank (savings goal) information."""

    name: str
    target_amount: Decimal
    current_amount: Decimal

    @property
    def progress_percent(self) -> Decimal:
        """Calculate progress percentage."""
        if self.target_amount == 0:
            if self.current_amount > 0:
                logger.warning(
                    "[FireflyClient] Piggy bank '%s' has savings but no target amount",
                    self.name,
                )
                return Decimal("100")
            return Decimal("0")
        return (self.current_amount / self.target_amount) * 100


@dataclass(frozen=True)
class SavingsMetrics:
    """Savings progress metrics."""

    piggy_banks: tuple[PiggyBank, ...]  # Immutable tuple
    savings_rate: Decimal = Decimal("0")

    @property
    def total_savings(self) -> Decimal:
        """Calculate total savings from all piggy banks."""
        return sum((pb.current_amount for pb in self.piggy_banks), Decimal("0"))


@dataclass(frozen=True)
class Transaction:
    """Transaction information."""

    id: str
    amount: Decimal
    description: str
    transaction_date: date  # Use proper date type
    category: str
    source_account: str
    destination_account: str
    transaction_type: TransactionType

    def __post_init__(self) -> None:
        """Validate transaction data."""
        if not self.id:
            raise ValueError("Transaction id cannot be empty")
        if self.amount < 0:
            raise ValueError(f"Transaction amount must be non-negative, got {self.amount}")


# ============================================
# Connection Test Result
# ============================================


@dataclass(frozen=True)
class ConnectionTestResult:
    """Result of connection test with detailed status."""

    success: bool
    message: str
    details: Optional[dict[str, Any]] = None


# ============================================
# API Client
# ============================================


class FireflyClient:
    """
    Firefly-iii API Client.

    Provides methods for interacting with PMOVES-Firefly-iii API including:
    - Transaction management
    - Account operations
    - Budget analysis
    - Wealth distribution queries
    - Savings progress tracking

    All methods include comprehensive logging for production debugging.
    """

    def __init__(self, config: Optional[FireflyConfig] = None):
        """
        Initialize Firefly client.

        Args:
            config: Configuration for the client. If None, loads from environment.

        Raises:
            ValueError: If configuration is invalid.
        """
        self.config = config or FireflyConfig.from_env()
        self._session = self._create_session()

    def _create_session(self) -> requests.Session:
        """Create a requests session with retry logic."""
        session = requests.Session()

        # Configure retry strategy with exponential backoff
        retry_strategy = Retry(
            total=self.config.retry_count,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "POST", "PUT", "DELETE", "OPTIONS"],
        )

        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)

        # Set default headers
        session.headers.update(
            {
                "Authorization": f"Bearer {self.config.api_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        )

        return session

    @property
    def _base_api_url(self) -> str:
        """Get base API URL."""
        return f"{self.config.base_url}/api/{self.config.api_version}"

    def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[dict] = None,
        json_data: Optional[dict] = None,
        **kwargs: Any,
    ) -> requests.Response:
        """
        Make an API request with error handling.

        Args:
            method: HTTP method
            endpoint: API endpoint (without base URL)
            params: Query parameters
            json_data: JSON body data
            **kwargs: Additional request kwargs

        Returns:
            Response object

        Raises:
            requests.RequestException: On request failure
        """
        url = f"{self._base_api_url}{endpoint}"

        # Sanitize logging to prevent token exposure
        logger.debug(
            "[FireflyClient] %s %s params=%s",
            method.upper(),
            endpoint,
            params,
        )

        try:
            response = self._session.request(
                method,
                url,
                params=params,
                json=json_data,
                timeout=self.config.timeout,
                **kwargs,
            )
            response.raise_for_status()
            return response
        except requests.RequestException as e:
            logger.error(
                "[FireflyClient] Request failed: %s %s - %s",
                method.upper(),
                endpoint,
                str(e),
            )
            raise

    @staticmethod
    def _format_date(d: date | datetime) -> str:
        """Format date for API requests."""
        if isinstance(d, datetime):
            return d.date().isoformat()
        return d.isoformat()

    @staticmethod
    def _safe_decimal(value: Any, field_name: str, default: Decimal = Decimal("0")) -> Decimal:
        """Safely convert a value to Decimal with logging on fallback."""
        if value is None:
            logger.debug("[FireflyClient] Field '%s' is None, using default %s", field_name, default)
            return default
        try:
            return Decimal(str(value))
        except (ValueError, TypeError) as e:
            logger.warning(
                "[FireflyClient] Failed to convert '%s' value '%s' to Decimal: %s. Using default %s",
                field_name,
                value,
                e,
                default,
            )
            return default

    @staticmethod
    def _safe_int(value: Any, field_name: str, default: int = 0) -> int:
        """Safely convert a value to int with logging on fallback."""
        if value is None:
            logger.debug("[FireflyClient] Field '%s' is None, using default %s", field_name, default)
            return default
        try:
            return int(value)
        except (ValueError, TypeError) as e:
            logger.warning(
                "[FireflyClient] Failed to convert '%s' value '%s' to int: %s. Using default %s",
                field_name,
                value,
                e,
                default,
            )
            return default

    @staticmethod
    def _safe_str(value: Any, field_name: str, default: str = "") -> str:
        """Safely get string value with logging on fallback."""
        if value is None:
            logger.debug("[FireflyClient] Field '%s' is None, using default '%s'", field_name, default)
            return default
        return str(value)

    def test_connection(self) -> ConnectionTestResult:
        """
        Test connection to Firefly-iii with detailed error reporting.

        Returns:
            ConnectionTestResult with success status, message, and optional details
        """
        try:
            response = self._request("GET", "/about")
            data = response.json()
            logger.info("[FireflyClient] Connection successful: %s", data)
            return ConnectionTestResult(
                success=True,
                message="Connection successful",
                details=data,
            )
        except requests.Timeout:
            msg = f"Connection timed out after {self.config.timeout}s - check if Firefly is running"
            logger.error("[FireflyClient] %s", msg)
            return ConnectionTestResult(success=False, message=msg)
        except requests.ConnectionError as e:
            msg = f"Cannot connect to {self.config.base_url} - check URL and network: {e}"
            logger.error("[FireflyClient] %s", msg)
            return ConnectionTestResult(success=False, message=msg)
        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code == 401:
                msg = "Authentication failed - check FIREFLY_API_TOKEN"
            else:
                status = e.response.status_code if e.response is not None else "unknown"
                msg = f"HTTP error {status}: {e}"
            logger.error("[FireflyClient] %s", msg)
            return ConnectionTestResult(success=False, message=msg)
        except requests.RequestException as e:
            msg = f"Request failed: {e}"
            logger.error("[FireflyClient] %s", msg)
            return ConnectionTestResult(success=False, message=msg)

    def get_spending_by_category(
        self, start_date: date, end_date: date
    ) -> list[CategorySpending]:
        """
        Get spending by category for a date range.

        Args:
            start_date: Start of date range
            end_date: End of date range

        Returns:
            List of CategorySpending objects
        """
        response = self._request(
            "GET",
            "/insight/expense/category",
            params={
                "start": self._format_date(start_date),
                "end": self._format_date(end_date),
            },
        )

        results = []
        for idx, item in enumerate(response.json()):
            # Log missing fields
            if "name" not in item:
                logger.warning(
                    "[FireflyClient] Category item %d missing 'name' field, using '[unknown-%d]'",
                    idx,
                    idx,
                )
            if "sum" not in item:
                logger.warning(
                    "[FireflyClient] Category '%s' missing 'sum' field, using 0",
                    item.get("name", f"[unknown-{idx}]"),
                )

            results.append(
                CategorySpending(
                    category=item.get("name", f"[unknown-{idx}]"),
                    amount=self._safe_decimal(item.get("sum"), f"category[{idx}].sum"),
                    count=self._safe_int(item.get("count"), f"category[{idx}].count"),
                )
            )

        return results

    def get_budget_vs_actual(
        self, start_date: date, end_date: date
    ) -> list[BudgetAnalysis]:
        """
        Get budget vs actual analysis.

        Args:
            start_date: Start of date range
            end_date: End of date range

        Returns:
            List of BudgetAnalysis objects
        """
        response = self._request(
            "GET",
            "/insight/expense/budget",
            params={
                "start": self._format_date(start_date),
                "end": self._format_date(end_date),
            },
        )

        results = []
        for idx, item in enumerate(response.json()):
            budget_name = item.get("name", f"[unknown-{idx}]")

            if "budgeted" not in item:
                logger.warning(
                    "[FireflyClient] Budget '%s' missing 'budgeted' field",
                    budget_name,
                )
            if "sum" not in item:
                logger.warning(
                    "[FireflyClient] Budget '%s' missing 'sum' (actual) field",
                    budget_name,
                )

            budgeted = self._safe_decimal(item.get("budgeted"), f"budget[{idx}].budgeted")
            actual = self._safe_decimal(item.get("sum"), f"budget[{idx}].sum")

            if budgeted == 0 and actual != 0:
                logger.warning(
                    "[FireflyClient] Budget '%s' has $%s actual spending but $0 budgeted",
                    budget_name,
                    actual,
                )

            results.append(
                BudgetAnalysis(
                    budget_name=budget_name,
                    budgeted=budgeted,
                    actual=actual,
                )
            )

        return results

    def get_user_group_wealth(self, user_group_id: str) -> list[WealthDistribution]:
        """
        Get wealth distribution for a user group.

        Args:
            user_group_id: User group identifier

        Returns:
            List of WealthDistribution objects
        """
        response = self._request(
            "GET",
            "/accounts",
            params={
                "user_group_id": user_group_id,
                "type": "asset",
            },
        )

        # Group accounts by user
        accounts_by_user: dict[str, list[AccountInfo]] = {}
        for account in response.json().get("data", []):
            attrs = account.get("attributes", {})
            user_id = self._safe_str(attrs.get("user_id"), "user_id", "unknown")

            if user_id == "unknown":
                logger.warning(
                    "[FireflyClient] Account '%s' has no user_id",
                    attrs.get("name", "unknown"),
                )

            if user_id not in accounts_by_user:
                accounts_by_user[user_id] = []

            accounts_by_user[user_id].append(
                AccountInfo(
                    name=self._safe_str(attrs.get("name"), "account.name", "[unnamed]"),
                    balance=self._safe_decimal(attrs.get("current_balance"), "account.current_balance"),
                    account_type=AccountType.from_str(attrs.get("type", "asset")),
                )
            )

        # Build wealth distribution list
        return [
            WealthDistribution(
                user_id=user_id,
                accounts=tuple(accounts),  # Convert to immutable tuple
            )
            for user_id, accounts in accounts_by_user.items()
        ]

    def get_savings_progress(self) -> SavingsMetrics:
        """
        Get savings progress (piggy banks).

        Returns:
            SavingsMetrics object
        """
        response = self._request("GET", "/piggy-banks")

        piggy_banks = []
        for idx, pb in enumerate(response.json().get("data", [])):
            attrs = pb.get("attributes", {})
            name = self._safe_str(attrs.get("name"), f"piggy_bank[{idx}].name", f"[unnamed-{idx}]")

            target_amount = self._safe_decimal(attrs.get("target_amount"), f"piggy_bank[{idx}].target_amount")
            current_amount = self._safe_decimal(attrs.get("current_amount"), f"piggy_bank[{idx}].current_amount")

            if target_amount == 0 and current_amount > 0:
                logger.warning(
                    "[FireflyClient] Piggy bank '%s' has $%s saved but no target amount set",
                    name,
                    current_amount,
                )

            piggy_banks.append(
                PiggyBank(
                    name=name,
                    target_amount=target_amount,
                    current_amount=current_amount,
                )
            )

        return SavingsMetrics(
            piggy_banks=tuple(piggy_banks),  # Convert to immutable tuple
            savings_rate=Decimal("0"),  # Would need income data for accurate calculation
        )

    def get_transactions(
        self,
        start_date: date,
        end_date: date,
        transaction_type: Optional[TransactionType] = None,
    ) -> list[Transaction]:
        """
        Get transactions for a date range.

        Args:
            start_date: Start of date range
            end_date: End of date range
            transaction_type: Optional filter by transaction type

        Returns:
            List of Transaction objects
        """
        params: dict[str, str] = {
            "start": self._format_date(start_date),
            "end": self._format_date(end_date),
        }
        if transaction_type:
            params["type"] = transaction_type.value

        response = self._request("GET", "/transactions", params=params)

        transactions = []
        for group_idx, group in enumerate(response.json().get("data", [])):
            for tx_idx, tx in enumerate(group.get("attributes", {}).get("transactions", [])):
                tx_id = self._safe_str(tx.get("transaction_journal_id"), f"tx[{group_idx}][{tx_idx}].id")

                if not tx_id:
                    logger.warning(
                        "[FireflyClient] Transaction at group %d, index %d has no ID, skipping",
                        group_idx,
                        tx_idx,
                    )
                    continue

                # Parse transaction date
                date_str = tx.get("date", "")
                try:
                    tx_date = date.fromisoformat(date_str[:10]) if date_str else date.today()
                except ValueError:
                    logger.warning(
                        "[FireflyClient] Invalid date '%s' for transaction %s, using today",
                        date_str,
                        tx_id,
                    )
                    tx_date = date.today()

                transactions.append(
                    Transaction(
                        id=tx_id,
                        amount=self._safe_decimal(tx.get("amount"), f"tx[{tx_id}].amount"),
                        description=self._safe_str(tx.get("description"), f"tx[{tx_id}].description"),
                        transaction_date=tx_date,
                        category=self._safe_str(tx.get("category_name"), f"tx[{tx_id}].category", "uncategorized"),
                        source_account=self._safe_str(tx.get("source_name"), f"tx[{tx_id}].source"),
                        destination_account=self._safe_str(tx.get("destination_name"), f"tx[{tx_id}].destination"),
                        transaction_type=TransactionType.from_str(tx.get("type", "transfer")),
                    )
                )

        return transactions

    def export_transactions_csv(self, start_date: date, end_date: date) -> str:
        """
        Export transactions to CSV.

        Args:
            start_date: Start of date range
            end_date: End of date range

        Returns:
            CSV string
        """
        response = self._request(
            "GET",
            "/data/export/transactions",
            params={
                "start_date": self._format_date(start_date),
                "end_date": self._format_date(end_date),
            },
        )
        return response.text

    def get_accounts(self, account_type: AccountType = AccountType.ASSET) -> list[dict[str, Any]]:
        """
        Get all accounts of a specific type.

        Args:
            account_type: Type of accounts to retrieve

        Returns:
            List of account data dictionaries
        """
        response = self._request(
            "GET",
            "/accounts",
            params={"type": account_type.value},
        )
        return response.json().get("data", [])

    def create_account(
        self,
        name: str,
        account_type: AccountType,
        balance: Decimal = Decimal("0"),
        account_role: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Create a new account.

        Args:
            name: Account name
            account_type: Type of account
            balance: Opening balance
            account_role: Account role (required for asset accounts)

        Returns:
            Created account data
        """
        payload: dict[str, Any] = {
            "name": name,
            "type": account_type.value,
            "opening_balance": str(balance),
            "opening_balance_date": date.today().isoformat(),
        }

        # Asset accounts require an account_role
        if account_type == AccountType.ASSET:
            payload["account_role"] = account_role or "defaultAsset"

        response = self._request("POST", "/accounts", json_data=payload)
        return response.json().get("data", {})

    def create_transaction(
        self,
        transaction_type: TransactionType,
        transaction_date: date,
        amount: Decimal,
        description: str,
        source_id: Optional[str] = None,
        destination_id: Optional[str] = None,
        source_name: Optional[str] = None,
        destination_name: Optional[str] = None,
        category: Optional[str] = None,
        budget: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Create a new transaction.

        Args:
            transaction_type: Type of transaction
            transaction_date: Date of transaction
            amount: Transaction amount
            description: Transaction description
            source_id: Source account ID
            destination_id: Destination account ID
            source_name: Source account name (alternative to ID)
            destination_name: Destination account name (alternative to ID)
            category: Category name
            budget: Budget name

        Returns:
            Created transaction data
        """
        payload: dict[str, Any] = {
            "type": transaction_type.value,
            "date": self._format_date(transaction_date),
            "amount": str(amount),
            "description": description,
        }

        if source_id:
            payload["source_id"] = source_id
        if destination_id:
            payload["destination_id"] = destination_id
        if source_name:
            payload["source_name"] = source_name
        if destination_name:
            payload["destination_name"] = destination_name
        if category:
            payload["category_name"] = category
        if budget:
            payload["budget_name"] = budget

        response = self._request(
            "POST",
            "/transactions",
            json_data={"transactions": [payload]},
        )
        return response.json().get("data", {})

    def transform_simulation_to_transactions(
        self,
        simulation_data: list[dict[str, Any]],
        base_date: Optional[date] = None,
    ) -> list[dict[str, Any]]:
        """
        Transform simulation results into Firefly transaction format.

        This enables calibration between PMOVES simulation output and
        real-world Firefly financial data.

        Args:
            simulation_data: List of simulation week data
            base_date: Base date for transaction generation (defaults to today)

        Returns:
            List of transaction payloads ready for Firefly import
        """
        if base_date is None:
            base_date = date.today()

        transactions = []

        for week_idx, week in enumerate(simulation_data):
            week_date = date.fromordinal(base_date.toordinal() + (week_idx * 7))

            # Group A internal transactions
            if "InternalTx_A" in week and week["InternalTx_A"] > 0:
                transactions.append(
                    {
                        "type": TransactionType.TRANSFER.value,
                        "date": week_date.isoformat(),
                        "amount": str(week["InternalTx_A"]),
                        "description": f"Week {week.get('Week', week_idx + 1)} - Group A Internal",
                        "source_name": "Group A Pool",
                        "destination_name": "Group A Members",
                        "category_name": "Internal Transfer",
                    }
                )

            # Group B internal transactions
            if "InternalTx_B" in week and week["InternalTx_B"] > 0:
                transactions.append(
                    {
                        "type": TransactionType.TRANSFER.value,
                        "date": week_date.isoformat(),
                        "amount": str(week["InternalTx_B"]),
                        "description": f"Week {week.get('Week', week_idx + 1)} - Group B Internal",
                        "source_name": "Group B Pool",
                        "destination_name": "Group B Members",
                        "category_name": "Internal Transfer",
                    }
                )

            # External spending
            if "ExternalSpend_A" in week and week["ExternalSpend_A"] > 0:
                transactions.append(
                    {
                        "type": TransactionType.WITHDRAWAL.value,
                        "date": week_date.isoformat(),
                        "amount": str(week["ExternalSpend_A"]),
                        "description": f"Week {week.get('Week', week_idx + 1)} - Group A External",
                        "source_name": "Group A Pool",
                        "destination_name": "External Merchants",
                        "category_name": "External Spending",
                    }
                )

            if "ExternalSpend_B" in week and week["ExternalSpend_B"] > 0:
                transactions.append(
                    {
                        "type": TransactionType.WITHDRAWAL.value,
                        "date": week_date.isoformat(),
                        "amount": str(week["ExternalSpend_B"]),
                        "description": f"Week {week.get('Week', week_idx + 1)} - Group B External",
                        "source_name": "Group B Pool",
                        "destination_name": "External Merchants",
                        "category_name": "External Spending",
                    }
                )

        return transactions

    def import_simulation_results(
        self,
        simulation_data: list[dict[str, Any]],
        base_date: Optional[date] = None,
        dry_run: bool = True,
    ) -> dict[str, Any]:
        """
        Import simulation results into Firefly as transactions.

        Args:
            simulation_data: Simulation output data
            base_date: Base date for transactions
            dry_run: If True, only validate without creating transactions

        Returns:
            Import summary with transaction count and any errors
        """
        transactions = self.transform_simulation_to_transactions(
            simulation_data, base_date
        )

        if dry_run:
            logger.info(
                "[FireflyClient] Dry run: would create %d transactions",
                len(transactions),
            )
            return {
                "dry_run": True,
                "transaction_count": len(transactions),
                "transactions": transactions,
            }

        created = []
        errors = []
        total = len(transactions)

        logger.info("[FireflyClient] Starting import of %d transactions", total)

        for idx, tx in enumerate(transactions):
            try:
                result = self.create_transaction(
                    transaction_type=TransactionType(tx["type"]),
                    transaction_date=date.fromisoformat(tx["date"]),
                    amount=Decimal(tx["amount"]),
                    description=tx["description"],
                    source_name=tx.get("source_name"),
                    destination_name=tx.get("destination_name"),
                    category=tx.get("category_name"),
                )
                created.append(result)
                logger.debug(
                    "[FireflyClient] Created transaction %d/%d: %s",
                    idx + 1,
                    total,
                    tx["description"],
                )
            except requests.RequestException as e:
                logger.error(
                    "[FireflyClient] Failed to create transaction %d/%d '%s': %s",
                    idx + 1,
                    total,
                    tx["description"],
                    str(e),
                )
                errors.append({"transaction": tx, "error": str(e)})
            except (ValueError, KeyError, TypeError) as e:
                logger.error(
                    "[FireflyClient] Invalid transaction data at index %d: %s. Data: %s",
                    idx,
                    str(e),
                    tx,
                )
                errors.append({"transaction": tx, "error": f"Invalid data: {str(e)}"})

        if errors:
            logger.warning(
                "[FireflyClient] Import completed with %d errors out of %d transactions",
                len(errors),
                total,
            )
        else:
            logger.info(
                "[FireflyClient] Import completed successfully: %d transactions created",
                len(created),
            )

        return {
            "dry_run": False,
            "created_count": len(created),
            "error_count": len(errors),
            "created": created,
            "errors": errors,
        }
