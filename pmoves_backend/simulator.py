"""Core simulation loop and orchestration utilities."""

from __future__ import annotations

import logging
import random
from typing import Dict, List

import numpy as np
import pandas as pd

from .metrics import EconomicMetrics
from .models import DEFAULT_PARAMS, SimMember
from .narrative import generate_narrative_summary

logger = logging.getLogger(__name__)


def _initialize_members(sim_params: Dict[str, float]) -> List[SimMember]:
    initial_wealths = np.random.lognormal(
        mean=sim_params["INITIAL_WEALTH_MEAN_LOG"],
        sigma=sim_params["INITIAL_WEALTH_SIGMA_LOG"],
        size=int(sim_params["NUM_MEMBERS"]),
    )
    return [SimMember(f"M_{i}", wealth, sim_params) for i, wealth in enumerate(initial_wealths)]


def run_simulation(params: Dict[str, float]) -> Dict[str, object]:
    """Runs the economic comparison simulation with the provided parameters."""

    logger.info(
        "--- Running Simulation with params: %s ---",
        params.get("description", "Custom Params"),
    )
    sim_params = DEFAULT_PARAMS.copy()
    sim_params.update(params)

    try:
        members = _initialize_members(sim_params)
        metrics_calculator = EconomicMetrics(members, sim_params)
        simulation_history: List[Dict[str, object]] = []
        key_events: List[Dict[str, object]] = []
        logger.info("Initialized %d members.", len(members))
    except Exception as exc:
        logger.exception("Error during simulation setup")
        raise ValueError(f"Error during simulation setup: {exc}") from exc

    for week in range(int(sim_params["SIMULATION_WEEKS"])):
        current_wealth_A_list: List[float] = []
        current_wealth_B_list: List[float] = []
        # Weekly cash-flow aggregates. The Firefly export bridge
        # (adapters.firefly.transform_simulation_to_transactions) consumes
        # these keys; without them a history export produces zero transactions.
        week_external_spend_A = 0.0
        week_internal_tx_B = 0.0
        week_external_spend_B = 0.0
        week_coop_fees_B = 0.0

        for member in members:
            try:
                member.wealth_scenario_A += member.weekly_income
                member.food_usd_balance += member.weekly_income

                actual_spending_A = min(member.weekly_food_budget, member.wealth_scenario_A)
                member.wealth_scenario_A = max(0, member.wealth_scenario_A - actual_spending_A)
                week_external_spend_A += actual_spending_A

                budget_to_spend = member.weekly_food_budget
                intended_spend_internal = budget_to_spend * member.propensity_to_spend_internal
                intended_spend_external = budget_to_spend * (1.0 - member.propensity_to_spend_internal)

                avg_internal_savings_rate = (
                    sim_params["GROUP_BUY_SAVINGS_PERCENT"]
                    + sim_params["LOCAL_PRODUCTION_SAVINGS_PERCENT"]
                ) / 2
                effective_cost_internal = intended_spend_internal * (1.0 - avg_internal_savings_rate)
                effective_cost_external = intended_spend_external
                total_effective_cost = effective_cost_internal + effective_cost_external

                actual_total_spending_B = min(total_effective_cost, member.food_usd_balance)
                member.food_usd_balance = max(0, member.food_usd_balance - actual_total_spending_B)
                if total_effective_cost > 0:
                    # Balance-capped spend keeps the intended internal/external split.
                    spend_ratio = actual_total_spending_B / total_effective_cost
                    week_internal_tx_B += effective_cost_internal * spend_ratio
                    week_external_spend_B += effective_cost_external * spend_ratio

                actual_coop_fee = min(sim_params["WEEKLY_COOP_FEE_B"], member.food_usd_balance)
                member.food_usd_balance = max(0, member.food_usd_balance - actual_coop_fee)
                week_coop_fees_B += actual_coop_fee

                reward = max(
                    0,
                    random.gauss(
                        sim_params["GROTOKEN_REWARD_PER_WEEK_AVG"],
                        sim_params["GROTOKEN_REWARD_STDDEV"],
                    ),
                )
                member.grotoken_balance += reward

                current_wealth_B = member.food_usd_balance + (
                    member.grotoken_balance * sim_params["GROTOKEN_USD_VALUE"]
                )
                member.wealth_scenario_B = current_wealth_B

                current_wealth_A_list.append(member.wealth_scenario_A)
                current_wealth_B_list.append(current_wealth_B)
            except Exception as exc:
                logger.exception(
                    "Error processing member %s in week %d", member.id, week + 1
                )
                current_wealth_A_list.append(member.wealth_scenario_A)
                current_wealth_B_list.append(member.wealth_scenario_B)

        try:
            weekly_metrics = metrics_calculator.calculate_metrics(
                current_wealth_A_list, current_wealth_B_list, week + 1
            )
            # Scenario A has no internal economy, so InternalTx_A is deliberately
            # absent — the export transformer treats missing keys as no-flow.
            weekly_metrics["ExternalSpend_A"] = round(week_external_spend_A, 2)
            weekly_metrics["InternalTx_B"] = round(week_internal_tx_B, 2)
            weekly_metrics["ExternalSpend_B"] = round(week_external_spend_B, 2)
            weekly_metrics["CoopFees_B"] = round(week_coop_fees_B, 2)
            simulation_history.append(weekly_metrics)

            if week > 0:
                prev_metrics = simulation_history[-2]
                if weekly_metrics.get("Gini_B", 1) < prev_metrics.get("Gini_B", 1) * 0.95:
                    key_events.append(
                        {
                            "week": week + 1,
                            "type": "equality_improvement",
                            "description": (
                                "Significant reduction in wealth inequality (Gini B < "
                                f"{prev_metrics.get('Gini_B', 1) * 0.95:.3f})"
                            ),
                        }
                    )
                if weekly_metrics.get("PovertyRate_B", 1) < prev_metrics.get("PovertyRate_B", 1) * 0.9:
                    key_events.append(
                        {
                            "week": week + 1,
                            "type": "poverty_reduction",
                            "description": (
                                "Significant poverty reduction (Rate B < "
                                f"{prev_metrics.get('PovertyRate_B', 1) * 0.9:.1%})"
                            ),
                        }
                    )
        except Exception:
            logger.exception("Error calculating metrics for week %d", week + 1)

    logger.info("--- Simulation Loop Finished ---")

    try:
        final_member_data = [
            {
                "ID": m.id,
                "Income": m.weekly_income,
                "Budget": m.weekly_food_budget,
                "Wealth_A": m.wealth_scenario_A,
                "Wealth_B": m.wealth_scenario_B,
                "FoodUSD_B": m.food_usd_balance,
                "GroToken_B": m.grotoken_balance,
            }
            for m in members
        ]
        final_members_df = pd.DataFrame(final_member_data)
        summary_narrative = generate_narrative_summary(simulation_history, key_events)
        results: Dict[str, object] = {
            "history": simulation_history,
            "final_members": final_members_df.to_dict(orient="records"),
            "key_events": key_events,
            "summary": summary_narrative,
        }
        return results
    except Exception as exc:
        logger.exception("Error preparing results")
        raise ValueError(f"Error preparing results: {exc}") from exc
