// contracts/__tests__/equalweight-governor-model.test.ts
import { EqualWeightGovernorModel } from '../equalweight-governor-model';

describe('EqualWeightGovernorModel', () => {
  it('tallies weighted for/against and turnout under member basis', () => {
    const gov = new EqualWeightGovernorModel();
    gov.setRoll([{ id: '0xA' }, { id: '0xB' }, { id: '0xC' }, { id: '0xD' }]);
    gov.createProposal('p1', 'Adopt bylaw');
    gov.castVote('p1', '0xA', true);
    gov.castVote('p1', '0xB', true);
    gov.castVote('p1', '0xC', false);

    const t = gov.tally('p1');
    expect(t.votesFor).toBe(2);
    expect(t.votesAgainst).toBe(1);
    expect(t.eligibleCount).toBe(4);
    expect(t.voterCount).toBe(3);
    expect(t.turnout).toBeCloseTo(0.75, 6);
    expect(t.finalized).toBe(false);
  });

  it('rejects a voter not on the roll', () => {
    const gov = new EqualWeightGovernorModel();
    gov.setRoll([{ id: '0xA' }]);
    gov.createProposal('p1', 'x');
    expect(() => gov.castVote('p1', '0xSTRANGER', true)).toThrow(/roll|eligible/i);
  });

  it('rejects a second vote by the same member (one vote per member)', () => {
    const gov = new EqualWeightGovernorModel();
    gov.setRoll([{ id: '0xA' }]);
    gov.createProposal('p1', 'x');
    gov.castVote('p1', '0xA', true);
    expect(() => gov.castVote('p1', '0xA', false)).toThrow(/already voted/i);
  });
});
