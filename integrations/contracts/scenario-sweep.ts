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
  /**
   * Smallest holder's share across ALL holders — a live D12 check: it is > 0
   * only if every participant kept non-zero standing, and drops to 0 the moment
   * any holder is zeroed out (a real D12 violation), so the check can actually fail.
   */
  minShare: number;
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
    // reduce-based max/min (spreading the whole array overflows the stack at large N)
    const total = balances.reduce((sum, b) => sum + b, 0);
    const maxBal = balances.reduce((m, b) => (b > m ? b : m), 0);
    const minBal = balances.reduce((m, b) => (b < m ? b : m), Infinity);

    outcomes.push({
      name: scenario.name,
      gini: gini(balances),
      topShare: total > 0 ? maxBal / total : 0,
      // min over ALL holders → 0 if anyone was zeroed (catches a real D12 violation).
      minShare: total > 0 && balances.length > 0 ? minBal / total : 0,
      totalDistributed: total,
    });
  }

  return outcomes;
}
