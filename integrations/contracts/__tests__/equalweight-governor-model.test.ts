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

  it('member basis ignores shares; share basis lets a whale dominate', () => {
    const roll = [{ id: '0xWHALE', shares: 1000 }, { id: '0xA' }, { id: '0xB' }];

    const byMember = new EqualWeightGovernorModel({ votingBasis: 'member' });
    byMember.setRoll(roll);
    byMember.createProposal('p', 'x');
    byMember.castVote('p', '0xWHALE', true);
    byMember.castVote('p', '0xA', false);
    byMember.castVote('p', '0xB', false);
    const m = byMember.tally('p');
    expect(m.votesFor).toBe(1); // whale counts as one member
    expect(m.votesAgainst).toBe(2);

    const byShare = new EqualWeightGovernorModel({ votingBasis: 'share' });
    byShare.setRoll(roll);
    byShare.createProposal('p', 'x');
    byShare.castVote('p', '0xWHALE', true);
    byShare.castVote('p', '0xA', false);
    byShare.castVote('p', '0xB', false);
    const s = byShare.tally('p');
    expect(s.votesFor).toBe(1000); // plutocratic: whale dominates
    expect(s.votesAgainst).toBe(2);
  });

  it('fails quorum below the roll-percentage threshold even if unanimous', () => {
    const gov = new EqualWeightGovernorModel({ quorumPercentage: 0.5 });
    gov.setRoll([{ id: '0xA' }, { id: '0xB' }, { id: '0xC' }, { id: '0xD' }]);
    gov.createProposal('p', 'x');
    gov.castVote('p', '0xA', true); // 1/4 = 25% turnout < 50%
    const t = gov.tally('p');
    expect(t.quorumMet).toBe(false);
    expect(t.passed).toBe(false);
  });

  it('passes on majority once quorum is met', () => {
    const gov = new EqualWeightGovernorModel({ quorumPercentage: 0.5, passThreshold: 0.5 });
    gov.setRoll([{ id: '0xA' }, { id: '0xB' }, { id: '0xC' }, { id: '0xD' }]);
    gov.createProposal('p', 'x');
    gov.castVote('p', '0xA', true);
    gov.castVote('p', '0xB', true);
    gov.castVote('p', '0xC', false); // 3/4 turnout, for-share 2/3 >= 0.5
    const t = gov.tally('p');
    expect(t.quorumMet).toBe(true);
    expect(t.passed).toBe(true);
  });
});
