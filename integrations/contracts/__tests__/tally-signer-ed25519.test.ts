// contracts/__tests__/tally-signer-ed25519.test.ts
import { tallyPreimage } from '../tally-signer-ed25519';
import { TallyResult } from '../equalweight-governor-model';

function baseTally(overrides: Partial<TallyResult> = {}): TallyResult {
  return {
    proposalId: 'p1',
    votesFor: 3,
    votesAgainst: 1,
    eligibleCount: 5,
    voterCount: 4,
    turnout: 0.8,
    quorumMet: true,
    passed: true,
    finalized: false,
    ...overrides,
  };
}

describe('tallyPreimage', () => {
  it('is deterministic across calls (same bytes)', () => {
    const t = baseTally();
    expect(tallyPreimage(t).equals(tallyPreimage(t))).toBe(true);
  });

  it('is float-independent: turnout does not affect the bytes', () => {
    const a = baseTally({ turnout: 0.8 });
    const b = baseTally({ turnout: 0.79999999999 });
    expect(tallyPreimage(a).equals(tallyPreimage(b))).toBe(true);
  });

  it('changes when an integer result field changes (binds the count)', () => {
    const a = baseTally({ votesFor: 3 });
    const b = baseTally({ votesFor: 4 });
    expect(tallyPreimage(a).equals(tallyPreimage(b))).toBe(false);
  });

  it('changes when a boolean outcome field changes', () => {
    const a = baseTally({ passed: true });
    const b = baseTally({ passed: false });
    expect(tallyPreimage(a).equals(tallyPreimage(b))).toBe(false);
  });

  it('is unambiguous under length-prefix (no concatenation collision)', () => {
    // proposalId 'p1' + votesFor 12  vs  proposalId 'p11' + votesFor 2
    const a = baseTally({ proposalId: 'p1', votesFor: 12 });
    const b = baseTally({ proposalId: 'p11', votesFor: 2 });
    expect(tallyPreimage(a).equals(tallyPreimage(b))).toBe(false);
  });
});
