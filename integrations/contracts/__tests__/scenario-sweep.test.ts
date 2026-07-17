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
    // D12 holds under both: min over ALL holders is > 0 (would be 0 if anyone zeroed).
    expect(flat.minShare).toBeGreaterThan(0);
    expect(income.minShare).toBeGreaterThan(0);
    // Concentration (top holder's share) is higher under income-weighting.
    expect(income.topShare).toBeGreaterThan(flat.topShare);
  });

  it('a concentration cap lowers top-holder share vs uncapped income', async () => {
    const outcomes = await sweepScenarios(
      [
        { name: 'income', config: { contributionMeasure: 'income' } },
        {
          name: 'income+cap',
          config: { contributionMeasure: 'income', maxConcentration: 0.4 },
        },
      ],
      population,
      budgets(),
      4
    );

    const uncapped = outcomes.find((o) => o.name === 'income')!;
    const capped = outcomes.find((o) => o.name === 'income+cap')!;

    // The cap guardrail visibly reduces concentration...
    expect(capped.topShare).toBeLessThan(uncapped.topShare);
    expect(capped.topShare).toBeLessThanOrEqual(0.4 + 0.02);
    // ...and it also lowers overall inequality, while D12 still holds.
    expect(capped.gini).toBeLessThan(uncapped.gini);
    expect(capped.minShare).toBeGreaterThan(0);
  });
});
