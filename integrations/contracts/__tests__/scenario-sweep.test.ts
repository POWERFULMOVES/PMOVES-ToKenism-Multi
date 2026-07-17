/**
 * Scenario sweep — runs the coordinator sim across policy-variable settings and
 * reports the outcome metrics (Gini, top-holder concentration, D12), so we can
 * see WHERE THE CHIPS LAND under each policy rather than pre-deciding it.
 */

import { sweepScenarios } from '../scenario-sweep';

describe('sweepScenarios', () => {
  const population = { addresses: ['0xA', '0xB', '0xC'], initialWealth: [0, 0, 0] };
  const budgets = () =>
    new Map([
      ['0xA', { foodBudget: 100, totalIncome: 5000 }],
      ['0xB', { foodBudget: 100, totalIncome: 2000 }],
      ['0xC', { foodBudget: 100, totalIncome: 1000 }],
    ]);

  it('reveals that income-weighting concentrates more than flat (higher Gini)', async () => {
    const outcomes = await sweepScenarios(
      [
        { name: 'flat', config: { contributionMeasure: 'flat' } },
        { name: 'income', config: { contributionMeasure: 'income' } },
      ],
      population,
      budgets(),
      4
    );

    const flat = outcomes.find((o) => o.name === 'flat')!;
    const income = outcomes.find((o) => o.name === 'income')!;

    // The whole point of the sweep: the policy choice changes the outcome.
    expect(income.gini).toBeGreaterThan(flat.gini);
    // Flat distributes equally → near-zero inequality.
    expect(flat.gini).toBeCloseTo(0, 2);
    // D12 holds under both: every participant keeps non-zero standing.
    expect(flat.minNonZeroShare).toBeGreaterThan(0);
    expect(income.minNonZeroShare).toBeGreaterThan(0);
    // Concentration (top holder's share) is higher under income-weighting.
    expect(income.topShare).toBeGreaterThan(flat.topShare);
  });
});
