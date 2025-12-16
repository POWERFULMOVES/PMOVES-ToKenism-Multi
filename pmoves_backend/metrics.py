"""Economic metric calculations for the PMOVES simulator."""

from __future__ import annotations

import logging
import random
from typing import TYPE_CHECKING, Dict, Iterable, List, Optional

import numpy as np

if TYPE_CHECKING:
    from .models import SimMember

logger = logging.getLogger(__name__)


def calculate_gini(wealth_distribution: Iterable[float]) -> float:
    """Compute the Gini coefficient for a distribution of wealth."""
    wealth_non_negative = np.maximum(0, np.array(list(wealth_distribution)))
    wealth = np.sort(wealth_non_negative)
    n = len(wealth)
    if n == 0:
        return 0.0
    index = np.arange(1, n + 1)
    denominator = n * np.sum(wealth)
    if denominator == 0:
        return 0.0
    return float(np.sum((2 * index - n - 1) * wealth) / denominator)


class EconomicMetrics:
    """Calculates metrics describing the simulated economy."""

    def __init__(self, members: List[SimMember], params: Dict[str, float]) -> None:
        self.members = members
        self.params = params
        self.previous_metrics: Optional[Dict[str, float]] = None
        self.current_week = 0

    def calculate_metrics(
        self, wealth_A_list: List[float], wealth_B_list: List[float], week: int
    ) -> Dict[str, object]:
        self.current_week = week

        wealth_quintiles_A = (
            np.percentile(wealth_A_list, [20, 40, 60, 80]).tolist()
            if wealth_A_list
            else []
        )
        wealth_quintiles_B = (
            np.percentile(wealth_B_list, [20, 40, 60, 80]).tolist()
            if wealth_B_list
            else []
        )

        metrics: Dict[str, object] = {
            "Week": week,
            "Year": week // 52 + 1,
            "Quarter": (week % 52) // 13 + 1,
            "AvgWealth_A": np.mean(wealth_A_list) if wealth_A_list else 0,
            "AvgWealth_B": np.mean(wealth_B_list) if wealth_B_list else 0,
            "MedianWealth_A": np.median(wealth_A_list) if wealth_A_list else 0,
            "MedianWealth_B": np.median(wealth_B_list) if wealth_B_list else 0,
            "TotalWealth_A": np.sum(wealth_A_list),
            "TotalWealth_B": np.sum(wealth_B_list),
            "WealthQuintiles_A": wealth_quintiles_A,
            "WealthQuintiles_B": wealth_quintiles_B,
            "Top10Percent_A": np.percentile(wealth_A_list, 90) if wealth_A_list else 0,
            "Top10Percent_B": np.percentile(wealth_B_list, 90) if wealth_B_list else 0,
            "Bottom10Percent_A": np.percentile(wealth_A_list, 10) if wealth_A_list else 0,
            "Bottom10Percent_B": np.percentile(wealth_B_list, 10) if wealth_B_list else 0,
            "Gini_A": calculate_gini(wealth_A_list),
            "Gini_B": calculate_gini(wealth_B_list),
            "WealthGap_A": self.calculate_wealth_gap(wealth_A_list),
            "WealthGap_B": self.calculate_wealth_gap(wealth_B_list),
            "Bottom20PctShare": self.calculate_bottom_20_pct_share(wealth_B_list),
            "PovertyRate_A": self.calculate_poverty_rate(wealth_A_list),
            "PovertyRate_B": self.calculate_poverty_rate(wealth_B_list),
            "WealthMobility": self.calculate_wealth_mobility(),
            "LocalEconomyStrength": self.calculate_local_economy_strength(),
            "CommunityResilience": self.calculate_community_resilience(),
            "EconomicVelocity": self.calculate_economic_velocity(),
            "SocialSafetyNet": self.calculate_social_safety_net(),
            "InnovationIndex": self.calculate_innovation_index(),
            "SustainabilityScore": self.calculate_sustainability_score(),
            "CommunityEngagement": self.calculate_community_engagement(),
        }
        metrics.update(self.calculate_advanced_metrics())

        if self.previous_metrics:
            metrics.update(self.calculate_trends(metrics))

        self.previous_metrics = metrics.copy()
        return metrics

    def calculate_poverty_rate(self, wealth_list: List[float]) -> float:
        poverty_line = self.params.get("WEEKLY_FOOD_BUDGET_AVG", 75) * 4
        if not wealth_list:
            return 0.0
        return float(np.mean([1 if w < poverty_line else 0 for w in wealth_list]))

    def calculate_wealth_mobility(self) -> float:
        if not self.members:
            return 0.0
        return float(
            np.mean(
                [
                    m.grotoken_balance
                    * self.params.get("GROTOKEN_USD_VALUE", 2.0)
                    for m in self.members
                ]
            )
        )

    def calculate_local_economy_strength(self) -> float:
        if not self.members:
            return 0.0
        return float(np.mean([m.propensity_to_spend_internal for m in self.members]))

    def calculate_community_resilience(self) -> float:
        safety_net = self.calculate_social_safety_net()
        return safety_net

    def calculate_wealth_gap(self, wealth_list: List[float]) -> float:
        if len(wealth_list) < 5:
            return float("inf")
        try:
            top_20_idx = int(len(wealth_list) * 0.8)
            bottom_20_idx = int(len(wealth_list) * 0.2)
            sorted_wealth = np.sort(np.maximum(0, wealth_list))
            top_20_mean = np.mean(sorted_wealth[top_20_idx:])
            bottom_20_mean = np.mean(sorted_wealth[:bottom_20_idx])
            if bottom_20_mean <= 1e-6:
                return float("inf")
            return float(top_20_mean / bottom_20_mean)
        except Exception:
            logger.exception("Error calculating wealth gap")
            return float("inf")

    def calculate_bottom_20_pct_share(self, wealth_list: List[float]) -> float:
        if len(wealth_list) < 5:
            return 0.0
        try:
            total_wealth = np.sum(np.maximum(0, wealth_list))
            if total_wealth <= 1e-6:
                return 0.0
            sorted_wealth = np.sort(np.maximum(0, wealth_list))
            bottom_20_idx = int(len(wealth_list) * 0.2)
            bottom_20_wealth = np.sum(sorted_wealth[:bottom_20_idx])
            return float(bottom_20_wealth / total_wealth)
        except Exception:
            logger.exception("Error calculating bottom 20 percent share")
            return 0.0

    def calculate_economic_velocity(self) -> float:
        if not self.members:
            return 0.0
        avg_internal_spend_propensity = np.mean(
            [m.propensity_to_spend_internal for m in self.members]
        )
        return float(avg_internal_spend_propensity)

    def calculate_social_safety_net(self) -> float:
        poverty_line = self.params.get("WEEKLY_FOOD_BUDGET_AVG", 75) * 4
        if not self.members:
            return 0.0
        below_poverty = len(
            [m for m in self.members if m.wealth_scenario_B < poverty_line]
        )
        return 1.0 - (below_poverty / len(self.members))

    def calculate_innovation_index(self) -> float:
        if not self.members:
            return 0.0
        grotoken_adoption = np.mean([1 if m.grotoken_balance > 0 else 0 for m in self.members])
        local_prod_strength = self.calculate_local_economy_strength()
        return float((grotoken_adoption + local_prod_strength) / 2)

    def calculate_sustainability_score(self) -> float:
        resilience = self.calculate_community_resilience()
        return float(resilience)

    def calculate_community_engagement(self) -> float:
        if not self.members:
            return 0.0
        return float(np.mean([m.propensity_to_spend_internal for m in self.members]))

    def calculate_trends(self, current_metrics: Dict[str, float]) -> Dict[str, float]:
        trends: Dict[str, float] = {}
        trend_keys = [
            "AvgWealth_B",
            "Gini_B",
            "PovertyRate_B",
            "LocalEconomyStrength",
            "CommunityResilience",
            "EconomicVelocity",
            "SocialSafetyNet",
            "InnovationIndex",
            "SustainabilityScore",
            "CommunityEngagement",
        ]
        for key in trend_keys:
            if (
                self.previous_metrics
                and key in self.previous_metrics
                and key in current_metrics
            ):
                prev_value = self.previous_metrics[key]
                current_value = current_metrics[key]
                try:
                    if abs(prev_value) > 1e-6:
                        trends[f"{key}_Trend"] = (current_value - prev_value) / abs(prev_value)
                    elif current_value > prev_value:
                        trends[f"{key}_Trend"] = 1.0
                    elif current_value < prev_value:
                        trends[f"{key}_Trend"] = -1.0
                    else:
                        trends[f"{key}_Trend"] = 0.0
                except Exception:
                    logger.exception("Error calculating trend for %s", key)
                    trends[f"{key}_Trend"] = 0.0
            else:
                trends[f"{key}_Trend"] = 0.0
        return trends

    def calculate_market_efficiency(self) -> float:
        avg_internal_tx = np.mean(
            [getattr(m, "internal_transaction_count", 0) for m in self.members]
        )
        return float((avg_internal_tx / max(1, self.current_week)) * 10)

    def calculate_innovation_adoption(self) -> float:
        return float(
            np.mean([getattr(m, "grotoken_usage_rate", 0.1) for m in self.members])
        )

    def calculate_wealth_mobility_score(self) -> float:
        return float(random.random() * 0.4 + 0.1)

    def calculate_economic_diversity(self) -> float:
        return float(random.random() * 0.5 + 0.4)

    def calculate_risk_resilience(self) -> float:
        safety_net = self.calculate_social_safety_net()
        wealth_B = [m.wealth_scenario_B for m in self.members]
        mean_wealth = np.mean(wealth_B) if wealth_B else 0
        std_dev = np.std(wealth_B) if wealth_B else 0
        stability = 1.0 - (std_dev / mean_wealth) if mean_wealth > 1e-6 else 0
        return float((safety_net + stability) / 2.0)

    def calculate_advanced_metrics(self) -> Dict[str, float]:
        return {
            "MarketEfficiency": self.calculate_market_efficiency(),
            "InnovationAdoption": self.calculate_innovation_adoption(),
            "WealthMobilityScore": self.calculate_wealth_mobility_score(),
            "EconomicDiversity": self.calculate_economic_diversity(),
            "RiskResilience": self.calculate_risk_resilience(),
        }

    def run_simulation_period(self, duration: int) -> Dict[str, float]:
        logger.warning("run_simulation_period is a placeholder.")
        return {"placeholder_metric": random.random()}

    def calculate_recovery_metrics(self) -> Dict[str, float]:
        logger.warning("calculate_recovery_metrics is a placeholder.")
        return {
            "recovery_rate": random.random() * 0.1,
            "resilience_score": random.random(),
        }

    def simulate_economic_shock(
        self, shock_type: str, magnitude: float, duration: int
    ) -> Dict[str, float]:
        logger.warning("simulate_economic_shock is a placeholder.")
        shock_metrics = self.run_simulation_period(duration)
        recovery_metrics = self.calculate_recovery_metrics()
        return {
            "shock_impact": shock_metrics,
            "recovery_rate": recovery_metrics["recovery_rate"],
            "resilience_score": recovery_metrics["resilience_score"],
        }
