/**
 * GroToken contribution-based distribution (token-structure refresh)
 *
 * The refresh replaces the Gaussian random draw in weekly distribution with
 * distribution proportional to Dirichlet attribution weight, so tokens track
 * real recorded contribution instead of chance. See
 * pmoves/docs/architecture/TOKEN_STRUCTURE_REFRESH.md §4.3.
 */

import { GroTokenDistribution } from '../grotoken-model';
import { DirichletWeights } from '../chit/dirichlet-weights';

describe('GroTokenDistribution.distributeByAttribution', () => {
  it('gives each contributor pool × their Dirichlet attribution weight', () => {
    const dirichlet = new DirichletWeights();
    // Alice does 3× Bob's real work in the same category and week.
    dirichlet.addContribution('0xALICE', 30, 'hosting', 1);
    dirichlet.addContribution('0xBOB', 10, 'hosting', 1);
    const attribution = dirichlet.getExpectedAttribution('hosting');
    const aliceWeight = attribution.find((a) => a.address === '0xALICE')!.weight;

    const groToken = new GroTokenDistribution();
    groToken.initializeHolders(['0xALICE', '0xBOB']);

    const pool = 100;
    const events = groToken.distributeByAttribution(attribution, pool, 1);

    const alice = events.find((e) => e.recipient === '0xALICE')!;
    // The amount is contribution-proportional, not a random draw.
    expect(alice.amount).toBeCloseTo(aliceWeight * pool, 6);
  });

  it('credits each recipient balance by their attributed amount', () => {
    const dirichlet = new DirichletWeights();
    dirichlet.addContribution('0xALICE', 30, 'hosting', 1);
    dirichlet.addContribution('0xBOB', 10, 'hosting', 1);
    const attribution = dirichlet.getExpectedAttribution('hosting');
    const aliceWeight = attribution.find((a) => a.address === '0xALICE')!.weight;

    const groToken = new GroTokenDistribution();
    groToken.initializeHolders(['0xALICE', '0xBOB']);
    groToken.distributeByAttribution(attribution, 100, 1);

    // A distribution actually moves tokens — the ledger reflects it.
    expect(groToken.balanceOf('0xALICE')).toBeCloseTo(aliceWeight * 100, 6);
  });

  // Invariant guards: properties the Dirichlet wire holds by construction and
  // the old Gaussian draw did not (anti-extractive / shared-surplus / auditable).
  describe('invariants', () => {
    const attributionFor = (contribs: Array<[string, number]>) => {
      const d = new DirichletWeights();
      for (const [addr, amt] of contribs) d.addContribution(addr, amt, 'hosting', 1);
      return d.getExpectedAttribution('hosting');
    };

    it('gives a non-zero share even to a minimal contributor (D12 smoothing)', () => {
      const attribution = attributionFor([['0xWHALE', 1000], ['0xTINY', 0]]);
      const groToken = new GroTokenDistribution();
      groToken.initializeHolders(['0xWHALE', '0xTINY']);

      const events = groToken.distributeByAttribution(attribution, 100, 1);

      expect(events.find((e) => e.recipient === '0xTINY')!.amount).toBeGreaterThan(0);
    });

    it('distributes the whole pool and no more (conservation)', () => {
      const attribution = attributionFor([['0xA', 5], ['0xB', 3], ['0xC', 2]]);
      const groToken = new GroTokenDistribution();
      groToken.initializeHolders(['0xA', '0xB', '0xC']);

      const events = groToken.distributeByAttribution(attribution, 100, 1);

      const total = events.reduce((s, e) => s + e.amount, 0);
      expect(total).toBeCloseTo(100, 6);
    });

    it('is deterministic — identical inputs produce identical amounts', () => {
      const contribs: Array<[string, number]> = [['0xA', 5], ['0xB', 3], ['0xC', 2]];
      const run = () => {
        const groToken = new GroTokenDistribution();
        groToken.initializeHolders(['0xA', '0xB', '0xC']);
        return groToken
          .distributeByAttribution(attributionFor(contribs), 100, 1)
          .map((e) => e.amount);
      };

      expect(run()).toEqual(run());
    });
  });
});
