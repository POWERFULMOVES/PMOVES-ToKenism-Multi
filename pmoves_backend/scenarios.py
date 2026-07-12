"""Demo scenario library for business-idea testing.

Single-tenant by design: the export service resolves scenario ids ONLY against
this library (spec G1 auth contract — no caller-supplied parameters reach the
simulator). Each scenario is a named override set on top of DEFAULT_PARAMS.
"""

from __future__ import annotations

from typing import Any, Dict

from .params import get_default_params

# Demo runs use one simulated year: enough weeks for the wealth curves to
# separate, small enough that an export request answers in interactive time.
_DEMO_WEEKS = 52

SCENARIOS: Dict[str, Dict[str, Any]] = {
    "baseline": {
        "label": "Baseline Community",
        "description": (
            "Default community economy: 50 members, 60% internal spend "
            "propensity, standard co-op savings rates."
        ),
        "overrides": {
            "SIMULATION_WEEKS": _DEMO_WEEKS,
            "description": "Baseline Community",
        },
    },
    "high-coop-adoption": {
        "label": "High Co-op Adoption",
        "description": (
            "Most spending stays inside the community (85% internal "
            "propensity) with stronger group-buy savings — tests a "
            "well-adopted local service business."
        ),
        "overrides": {
            "SIMULATION_WEEKS": _DEMO_WEEKS,
            "PERCENT_SPEND_INTERNAL_AVG": 0.85,
            "GROUP_BUY_SAVINGS_PERCENT": 0.20,
            "description": "High Co-op Adoption",
        },
    },
    "token-pre-order": {
        "label": "Community Token Pre-Order",
        "description": (
            "Token rewards double and appreciate (GroToken $3): tests a "
            "pre-order/token-incentive business model."
        ),
        "overrides": {
            "SIMULATION_WEEKS": _DEMO_WEEKS,
            "GROTOKEN_REWARD_PER_WEEK_AVG": 1.0,
            "GROTOKEN_USD_VALUE": 3.0,
            "description": "Community Token Pre-Order",
        },
    },
    "lean-market": {
        "label": "Lean Market Stress Test",
        "description": (
            "Income down a third, budgets tight: tests whether the community "
            "economy cushions members through a downturn."
        ),
        "overrides": {
            "SIMULATION_WEEKS": _DEMO_WEEKS,
            "WEEKLY_INCOME_AVG": 100.0,
            "WEEKLY_FOOD_BUDGET_AVG": 60.0,
            "description": "Lean Market Stress Test",
        },
    },
}


def list_scenarios() -> list[dict[str, str]]:
    """Public metadata for the demo UI: id, label, description."""
    return [
        {"scenario_id": key, "label": value["label"], "description": value["description"]}
        for key, value in SCENARIOS.items()
    ]


def resolve_scenario(scenario_id: str) -> Dict[str, Any]:
    """Return full simulator params for a scenario id.

    Raises:
        KeyError: If the scenario id is not in the demo library.
    """
    scenario = SCENARIOS[scenario_id]
    params = get_default_params()
    params.update(scenario["overrides"])
    return params
