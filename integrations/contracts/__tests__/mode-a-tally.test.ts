// contracts/__tests__/mode-a-tally.test.ts
import { computeSecretOutcome, sweepAbstentionPolicy } from '../mode-a-tally';
import { EqualWeightGovernorModel } from '../equalweight-governor-model';

const CFG = { quorumPercentage: 0.5, passThreshold: 0.5 };

describe('computeSecretOutcome', () => {
  it('quorum policy counts abstentions toward turnout', () => {
    const o = computeSecretOutcome({ votesFor: 30, votesAgainst: 10, abstentions: 15 }, 100, { ...CFG, abstentionPolicy: 'quorum' });
    expect(o.voterCount).toBe(55);
    expect(o.turnout).toBeCloseTo(0.55, 6);
    expect(o.quorumMet).toBe(true);
    expect(o.passed).toBe(true); // forShare 30/40 = 0.75 >= 0.5
  });

  it('excluded policy omits abstentions from turnout — flips the outcome', () => {
    const o = computeSecretOutcome({ votesFor: 30, votesAgainst: 10, abstentions: 15 }, 100, { ...CFG, abstentionPolicy: 'excluded' });
    expect(o.voterCount).toBe(55);            // voterCount still includes abstentions
    expect(o.turnout).toBeCloseTo(0.40, 6);   // but turnout omits them
    expect(o.quorumMet).toBe(false);
    expect(o.passed).toBe(false);
  });

  it('decision excludes abstentions (forShare over for+against only)', () => {
    const o = computeSecretOutcome({ votesFor: 3, votesAgainst: 1, abstentions: 90 }, 100, { ...CFG, abstentionPolicy: 'quorum' });
    expect(o.turnout).toBeCloseTo(0.94, 6);
    expect(o.passed).toBe(true); // 3/(3+1)=0.75 >= 0.5, abstentions don't dilute the decision
  });

  it('rejects non-safe-integer / negative counts', () => {
    expect(() => computeSecretOutcome({ votesFor: NaN, votesAgainst: 1, abstentions: 0 }, 10, { ...CFG, abstentionPolicy: 'quorum' })).toThrow(/votesFor/);
    expect(() => computeSecretOutcome({ votesFor: -1, votesAgainst: 1, abstentions: 0 }, 10, { ...CFG, abstentionPolicy: 'quorum' })).toThrow(/votesFor/);
    expect(() => computeSecretOutcome({ votesFor: 1.5, votesAgainst: 1, abstentions: 0 }, 10, { ...CFG, abstentionPolicy: 'quorum' })).toThrow(/votesFor/);
  });

  it('rejects voterCount exceeding eligibleCount', () => {
    expect(() => computeSecretOutcome({ votesFor: 2, votesAgainst: 1, abstentions: 1 }, 3, { ...CFG, abstentionPolicy: 'quorum' })).toThrow(/exceeds|eligible/i);
  });
});

describe('sweepAbstentionPolicy', () => {
  it('returns both outcomes and shows the divergence', () => {
    const s = sweepAbstentionPolicy({ votesFor: 30, votesAgainst: 10, abstentions: 15 }, 100, CFG);
    expect(s.quorum.quorumMet).toBe(true);
    expect(s.excluded.quorumMet).toBe(false);
  });

  it('policies agree when for+against alone clears quorum', () => {
    const s = sweepAbstentionPolicy({ votesFor: 40, votesAgainst: 10, abstentions: 15 }, 100, CFG);
    expect(s.quorum.quorumMet).toBe(true);
    expect(s.excluded.quorumMet).toBe(true); // (40+10)/100 = 0.50 >= 0.5
  });
});

describe('EqualWeightGovernorModel abstentionPolicy config', () => {
  it('defaults abstentionPolicy to quorum', () => {
    const gov = new EqualWeightGovernorModel();
    expect((gov as unknown as { config: { abstentionPolicy: string } }).config.abstentionPolicy).toBe('quorum');
  });
});
