"""Narrative generation helpers for summarising simulation results."""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def safe_format(value: Optional[float], format_spec: str, fallback: str = "N/A") -> str:
    """Safely format metrics that may be missing or non-numeric."""
    if value is None:
        return fallback
    try:
        return format(value, format_spec)
    except (TypeError, ValueError):
        return fallback


def generate_narrative_summary(history: List[Dict[str, float]], events: List[Dict[str, object]]) -> Dict[str, Any]:
    if not history:
        return {"title": "Error", "overview": "No simulation history data available."}
    first_period = history[0]
    last_period = history[-1]
    mid_period_index = len(history) // 2
    mid_period = history[mid_period_index] if mid_period_index < len(history) else last_period
    wealth_change = (
        (
            last_period["TotalWealth_B"] - first_period["TotalWealth_B"]
        )
        / first_period["TotalWealth_B"]
        if first_period["TotalWealth_B"] != 0
        else 0
    )
    inequality_change = last_period["Gini_B"] - first_period["Gini_B"]
    poverty_trend = (
        "decreased"
        if last_period["PovertyRate_B"] < first_period["PovertyRate_B"]
        else "increased or stayed same"
    )
    wealth_gap_b = safe_format(last_period.get("WealthGap_B"), ".1f")
    wealth_gap_a = safe_format(last_period.get("WealthGap_A"), ".1f")
    resilience_score = safe_format(last_period.get("CommunityResilience"), ".2f")
    sustainability_score = safe_format(last_period.get("SustainabilityScore"), ".2f")

    narrative = {
        "title": "Economic System Evolution Analysis",
        "overview": (
            f"Over {len(history)} weeks, the community's economic system under Scenario B (Cooperative) "
            "showed notable changes compared to Scenario A (Existing)."
        ),
        "key_findings": {
            "wealth_impact": {
                "summary": (
                    "Total wealth in Scenario B "
                    f"{'grew' if wealth_change > 0 else 'declined'} by {abs(wealth_change)*100:.1f}% compared to its start."
                ),
                "details": (
                    "Average wealth in B finished at "
                    f"${last_period['AvgWealth_B']:.2f}, compared to ${last_period['AvgWealth_A']:.2f} in A. "
                    "The wealth distribution in B became "
                    f"{'more' if inequality_change > 0 else 'less'} unequal over time."
                ),
            },
            "equality_measures": {
                "summary": (
                    "Wealth inequality in B "
                    f"{'decreased' if inequality_change < 0 else 'increased'} by {abs(inequality_change)*100:.1f}% "
                    "(absolute Gini change)."
                ),
                "gini": (
                    "Gini coefficient in B moved from "
                    f"{first_period['Gini_B']:.3f} to {last_period['Gini_B']:.3f} "
                    f"(vs {last_period['Gini_A']:.3f} in A)."
                ),
                "details": (
                    "The poorest 20% share of total wealth in B changed from "
                    f"{first_period.get('Bottom20PctShare', 0)*100:.1f}% to "
                    f"{last_period.get('Bottom20PctShare', 0)*100:.1f}%. "
                    "The wealth gap (Top 20% / Bottom 20%) finished at "
                    f"{wealth_gap_b}"
                    f"{'x' if wealth_gap_b != 'N/A' else ''} in B (vs "
                    f"{wealth_gap_a}"
                    f"{'x' if wealth_gap_a != 'N/A' else ''} in A)."
                ),
            },
            "community_health": {
                "poverty": (
                    "Poverty rate in B "
                    f"{poverty_trend}, finishing at {last_period['PovertyRate_B']*100:.1f}% "
                    f"(vs {last_period['PovertyRate_A']*100:.1f}% in A)."
                ),
                "resilience": (
                    "Community resilience index in B finished at: "
                    f"{resilience_score}"
                ),
                "details": (
                    "Economic health indicators suggest Scenario B fostered "
                    f"{'improvement' if last_period.get('CommunityResilience', 0) > first_period.get('CommunityResilience', 0) else 'challenges'} "
                    "in resilience."
                ),
                "sustainability": (
                    "Economic sustainability score in B: "
                    f"{sustainability_score}"
                ),
            },
        },
        "phase_analysis": analyze_economic_phases(history),
        "key_events": [e["description"] for e in events] if events else ["No significant key events detected."],
        "conclusion": generate_conclusion(history),
    }
    return narrative


def analyze_economic_phases(history: List[Dict[str, float]]) -> List[Dict[str, Any]]:
    if len(history) < 9:
        return []
    phase_length = len(history) // 3
    phases_data = [
        history[:phase_length],
        history[phase_length : 2 * phase_length],
        history[2 * phase_length :],
    ]
    phase_periods = [
        f"Weeks 1-{phase_length}",
        f"Weeks {phase_length+1}-{2*phase_length}",
        f"Weeks {2*phase_length+1}-{len(history)}",
    ]
    phase_names = ["Initial Phase", "Development Phase", "Maturity Phase"]
    analyzed_phases = []
    for i, phase_data in enumerate(phases_data):
        if not phase_data:
            continue
        start_metrics = phase_data[0]
        end_metrics = phase_data[-1]
        start_total_wealth = start_metrics.get("TotalWealth_B", 0)
        end_total_wealth = end_metrics.get("TotalWealth_B", 0)
        wealth_growth = (
            (end_total_wealth - start_total_wealth) / start_total_wealth
            if start_total_wealth > 1e-6
            else 0
        )
        if i == 0:
            phase_char = (
                "Adaptation"
                if abs(wealth_growth) < 0.05
                else "Rapid Growth"
                if wealth_growth > 0.1
                else "Steady Growth"
            )
        elif i == 1:
            previous_growth = analyzed_phases[0]["raw_growth"] if analyzed_phases else 0
            phase_char = (
                "Consolidation"
                if wealth_growth < previous_growth
                else "Acceleration"
                if wealth_growth > previous_growth
                else "Stabilization"
            )
        else:
            phase_char = (
                "Maturity"
                if abs(wealth_growth) < 0.03
                else "Continued Growth"
                if wealth_growth > 0
                else "Contraction"
            )
        analyzed_phases.append(
            {
                "period": phase_periods[i],
                "type": phase_names[i],
                "raw_growth": wealth_growth,
                "characteristics": (
                    f"{phase_char} (Wealth Change: {wealth_growth*100:+.1f}%)"
                ),
                "metrics": {
                    "avg_wealth": f"${end_metrics.get('AvgWealth_B', 0):.2f}",
                    "poverty_rate": f"{end_metrics.get('PovertyRate_B', 0)*100:.1f}%",
                    "gini": f"{end_metrics.get('Gini_B', 0):.3f}",
                },
            }
        )
    for phase in analyzed_phases:
        del phase["raw_growth"]
    return analyzed_phases


def generate_conclusion(history: List[Dict[str, float]]) -> str:
    if not history:
        return "No simulation data to generate conclusion."
    first_period = history[0]
    last_period = history[-1]
    wealth_change_B = (
        (last_period["TotalWealth_B"] - first_period["TotalWealth_B"])
        / first_period["TotalWealth_B"]
        if first_period["TotalWealth_B"] > 1e-6
        else 0
    )
    inequality_change_B = last_period["Gini_B"] - first_period["Gini_B"]
    poverty_change_B = last_period["PovertyRate_B"] - first_period["PovertyRate_B"]
    resilience_change_B = last_period.get("CommunityResilience", 0) - first_period.get(
        "CommunityResilience", 0
    )
    final_wealth_diff = last_period["TotalWealth_B"] - last_period["TotalWealth_A"]
    final_gini_diff = last_period["Gini_B"] - last_period["Gini_A"]
    economic_success = (
        "successful"
        if wealth_change_B > 0.1 and poverty_change_B < 0
        else "moderately successful"
        if wealth_change_B >= 0 and poverty_change_B <= 0
        else "challenging"
    )
    equity_outcome = (
        "more equitable"
        if inequality_change_B < -0.02
        else "slightly more equitable"
        if inequality_change_B < 0
        else "less equitable"
        if inequality_change_B > 0.02
        else "equity neutral"
    )
    resilience_outcome = (
        "more resilient"
        if resilience_change_B > 0.05
        else "less resilient"
        if resilience_change_B < -0.05
        else "resilience neutral"
    )
    conclusion = (
        "The simulation suggests a "
        f"{economic_success} outcome for the Cooperative Model (Scenario B) over {len(history)} weeks. "
        "Compared to its starting point, the community became "
        f"{equity_outcome} and potentially {resilience_outcome}."
    )
    if final_wealth_diff > 0:
        conclusion += (
            "Crucially, Scenario B ended with $"
            f"{final_wealth_diff:,.2f} more total wealth than Scenario A (Existing System). "
        )
    else:
        conclusion += (
            "However, Scenario B ended with $"
            f"{abs(final_wealth_diff):,.2f} less total wealth than Scenario A. "
        )
    if final_gini_diff < -0.01:
        conclusion += (
            "Scenario B also demonstrated lower final inequality (Gini diff: "
            f"{final_gini_diff:.3f}). "
        )
    elif final_gini_diff > 0.01:
        conclusion += (
            "However, Scenario B showed higher final inequality (Gini diff: "
            f"{final_gini_diff:.3f}). "
        )
    else:
        conclusion += "Final inequality levels were similar between scenarios. "
    conclusion += (
        "These results highlight the potential benefits (or drawbacks) of the cooperative model under the simulated parameters, "
        "particularly regarding wealth retention and distribution."
    )
    return conclusion
