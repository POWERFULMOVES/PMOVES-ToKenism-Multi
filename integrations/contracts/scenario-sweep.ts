/**
 * Scenario Sweep
 *
 * Runs the coordinator simulation across policy-variable settings (the open
 * decisions from the crystallized spec) and reports outcome metrics — so the
 * simulation SHOWS where the chips land under each policy, rather than baking a
 * choice in. Each scenario is just a `ContractCoordinatorConfig`; the sweep runs
 * it for N weeks and measures the resulting GroToken wealth distribution.
 */

import {
  ContractCoordinator,
  ContractCoordinatorConfig,
  PopulationConfig,
} from './contract-coordinator';

export interface Scenario {
  name: string;
  config: Partial<ContractCoordinatorConfig>;
}

export interface ScenarioOutcome {
  name: string;
  /** Gini coefficient of GroToken balances [0 = perfect equality, →1 = concentrated]. */
  gini: number;
  /** Top holder's share of all distributed GroToken (concentration). */
  topShare: number;
  /** Smallest non-zero holder's share — a live check that D12 held (must be > 0). */
  minNonZeroShare: number;
  /** Total GroToken distributed over the run. */
  totalDistributed: number;
}

type HouseholdBudgets = Map<string, { foodBudget: number; totalIncome: number }>;

/**
 * Gini coefficient via the sorted-values formula:
 *   G = (2·Σ i·x_i) / (n·Σ x_i) − (n+1)/n,  x sorted ascending, i = 1..n.
 * Returns 0 for an empty set or all-zero balances.
 */
export function gini(values: number[]): number {
  const xs = values.filter((v) => v >= 0).slice().sort((a, b) => a - b);
  const n = xs.length;
  const total = xs.reduce((sum, v) => sum + v, 0);
  if (n === 0 || total === 0) return 0;
  let weighted = 0;
  for (let i = 0; i < n; i++) weighted += (i + 1) * xs[i];
  return (2 * weighted) / (n * total) - (n + 1) / n;
}

/**
 * Run each scenario for `weeks` weeks against the same population + budgets, and
 * return the outcome metrics per scenario.
 */
export async function sweepScenarios(
  scenarios: Scenario[],
  population: PopulationConfig,
  budgets: HouseholdBudgets,
  weeks: number
): Promise<ScenarioOutcome[]> {
  const outcomes: ScenarioOutcome[] = [];

  for (const scenario of scenarios) {
    const coordinator = new ContractCoordinator(scenario.config);
    coordinator.initialize(population);
    for (let week = 1; week <= weeks; week++) {
      await coordinator.processWeek(week, budgets);
    }

    const balances = coordinator
      .getModels()
      .groToken.getHolders()
      .map((holder) => holder.balance);
    const total = balances.reduce((sum, b) => sum + b, 0);
    const nonZero = balances.filter((b) => b > 0);

    outcomes.push({
      name: scenario.name,
      gini: gini(balances),
      topShare: total > 0 ? Math.max(0, ...balances) / total : 0,
      minNonZeroShare:
        total > 0 && nonZero.length > 0 ? Math.min(...nonZero) / total : 0,
      totalDistributed: total,
    });
  }

  return outcomes;
}
