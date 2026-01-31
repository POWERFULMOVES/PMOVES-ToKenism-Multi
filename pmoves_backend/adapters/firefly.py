"""
Firefly-iii API Client for Python

Handles all interactions with PMOVES-Firefly-iii API.
Mirrors the TypeScript client in integrations/firefly/firefly-client.ts
"""

import logging
import os
import time
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)


@dataclass
class FireflyConfig:
    """Configuration for Firefly-iii API client."""

    base_url: str = "http://firefly:8080"
    api_token: str = ""
    api_version: str = "v1"
    timeout: int = 30
    retry_count: int = 3

    @classmethod
    def from_env(cls) -> "FireflyConfig":
        """Create config from environment variables."""
        return cls(
            base_url=os.getenv("FIREFLY_BASE_URL", "http://firefly:8080"),
            api_token=os.getenv("FIREFLY_API_TOKEN", ""),
            api_version=os.getenv("FIREFLY_API_VERSION", "v1"),
            timeout=int(os.getenv("FIREFLY_TIMEOUT", "30")),
            retry_count=int(os.getenv("FIREFLY_RETRY_COUNT", "3")),
        )


@dataclass
class CategorySpending:
    """Spending by category."""

    category: str
    amount: float
    count: int


@dataclass
class BudgetAnalysis:
    """Budget vs actual analysis."""

    budget_name: str
    budgeted: float
    actual: float
    variance: float
    variance_percent: float


@dataclass
class AccountInfo:
    """Account information."""

    name: str
    balance: float
    account_type: str


@dataclass
class WealthDistribution:
    """Wealth distribution for a user."""

    user_id: str
    total_wealth: float
    accounts: list[AccountInfo] = field(default_factory=list)


@dataclass
class PiggyBank:
    """Piggy bank (savings goal) information."""

    name: str
    target_amount: float
    current_amount: float
    progress_percent: float


@dataclass
class SavingsMetrics:
    """Savings progress metrics."""

    total_savings: float
    savings_rate: float
    piggy_banks: list[PiggyBank] = field(default_factory=list)


@dataclass
class Transaction:
    """Transaction information."""

    id: str
    amount: float
    description: str
    date: str
    category: str
    source_account: str
    destination_account: str
    transaction_type: str


class FireflyClient:
    """
    Firefly-iii API Client.

    Provides methods for interacting with PMOVES-Firefly-iii API including:
    - Transaction management
    - Account operations
    - Budget analysis
    - Wealth distribution queries
    - Savings progress tracking
    """

    def __init__(self, config: Optional[FireflyConfig] = None):
        """
        Initialize Firefly client.

        Args:
            config: Configuration for the client. If None, loads from environment.
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

    def test_connection(self) -> bool:
        """
        Test connection to Firefly-iii.

        Returns:
            True if connection successful, False otherwise
        """
        try:
            response = self._request("GET", "/about")
            logger.info("[FireflyClient] Connection successful: %s", response.json())
            return True
        except requests.RequestException:
            logger.error("[FireflyClient] Connection failed")
            return False

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

        return [
            CategorySpending(
                category=item.get("name", "unknown"),
                amount=float(item.get("sum", 0)),
                count=int(item.get("count", 0)),
            )
            for item in response.json()
        ]

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
        for item in response.json():
            budgeted = float(item.get("budgeted", 0))
            actual = float(item.get("sum", 0))
            variance = budgeted - actual

            results.append(
                BudgetAnalysis(
                    budget_name=item.get("name", "unknown"),
                    budgeted=budgeted,
                    actual=actual,
                    variance=variance,
                    variance_percent=(variance / budgeted * 100) if budgeted > 0 else 0,
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
        accounts_by_user: dict[str, list[dict]] = {}
        for account in response.json().get("data", []):
            user_id = account.get("attributes", {}).get("user_id", "unknown")
            if user_id not in accounts_by_user:
                accounts_by_user[user_id] = []
            accounts_by_user[user_id].append(account)

        # Calculate total wealth per user
        wealth_distribution = []
        for user_id, accounts in accounts_by_user.items():
            total_wealth = sum(
                float(acc.get("attributes", {}).get("current_balance", 0))
                for acc in accounts
            )

            wealth_distribution.append(
                WealthDistribution(
                    user_id=user_id,
                    total_wealth=total_wealth,
                    accounts=[
                        AccountInfo(
                            name=acc.get("attributes", {}).get("name", "unknown"),
                            balance=float(
                                acc.get("attributes", {}).get("current_balance", 0)
                            ),
                            account_type=acc.get("attributes", {}).get(
                                "type", "unknown"
                            ),
                        )
                        for acc in accounts
                    ],
                )
            )

        return wealth_distribution

    def get_savings_progress(self) -> SavingsMetrics:
        """
        Get savings progress (piggy banks).

        Returns:
            SavingsMetrics object
        """
        response = self._request("GET", "/piggy-banks")

        piggy_banks = []
        for pb in response.json().get("data", []):
            attrs = pb.get("attributes", {})
            target_amount = float(attrs.get("target_amount", 0))
            current_amount = float(attrs.get("current_amount", 0))

            piggy_banks.append(
                PiggyBank(
                    name=attrs.get("name", "unknown"),
                    target_amount=target_amount,
                    current_amount=current_amount,
                    progress_percent=(
                        (current_amount / target_amount * 100) if target_amount > 0 else 0
                    ),
                )
            )

        total_savings = sum(pb.current_amount for pb in piggy_banks)

        return SavingsMetrics(
            total_savings=total_savings,
            savings_rate=0,  # Would need income data for accurate calculation
            piggy_banks=piggy_banks,
        )

    def get_transactions(
        self,
        start_date: date,
        end_date: date,
        transaction_type: Optional[str] = None,
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
            params["type"] = transaction_type

        response = self._request("GET", "/transactions", params=params)

        transactions = []
        for group in response.json().get("data", []):
            for tx in group.get("attributes", {}).get("transactions", []):
                transactions.append(
                    Transaction(
                        id=str(tx.get("transaction_journal_id", "")),
                        amount=float(tx.get("amount", 0)),
                        description=tx.get("description", ""),
                        date=tx.get("date", ""),
                        category=tx.get("category_name", "uncategorized"),
                        source_account=tx.get("source_name", ""),
                        destination_account=tx.get("destination_name", ""),
                        transaction_type=tx.get("type", ""),
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

    def get_accounts(self, account_type: str = "asset") -> list[dict[str, Any]]:
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
            params={"type": account_type},
        )
        return response.json().get("data", [])

    def create_account(
        self,
        name: str,
        account_type: str,
        balance: float = 0,
        account_role: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Create a new account.

        Args:
            name: Account name
            account_type: Type of account (e.g., 'asset', 'expense')
            balance: Opening balance
            account_role: Account role (required for asset accounts)

        Returns:
            Created account data
        """
        payload: dict[str, Any] = {
            "name": name,
            "type": account_type,
            "opening_balance": str(balance),
            "opening_balance_date": date.today().isoformat(),
        }

        # Asset accounts require an account_role
        if account_type == "asset":
            payload["account_role"] = account_role or "defaultAsset"

        response = self._request("POST", "/accounts", json_data=payload)
        return response.json().get("data", {})

    def create_transaction(
        self,
        transaction_type: str,
        transaction_date: date,
        amount: float,
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
            transaction_type: Type of transaction ('withdrawal', 'deposit', 'transfer')
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
            "type": transaction_type,
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
                        "type": "transfer",
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
                        "type": "transfer",
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
                        "type": "withdrawal",
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
                        "type": "withdrawal",
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
            return {
                "dry_run": True,
                "transaction_count": len(transactions),
                "transactions": transactions,
            }

        created = []
        errors = []

        for tx in transactions:
            try:
                result = self.create_transaction(
                    transaction_type=tx["type"],
                    transaction_date=date.fromisoformat(tx["date"]),
                    amount=float(tx["amount"]),
                    description=tx["description"],
                    source_name=tx.get("source_name"),
                    destination_name=tx.get("destination_name"),
                    category=tx.get("category_name"),
                )
                created.append(result)
            except requests.RequestException as e:
                errors.append({"transaction": tx, "error": str(e)})

        return {
            "dry_run": False,
            "created_count": len(created),
            "error_count": len(errors),
            "created": created,
            "errors": errors,
        }
