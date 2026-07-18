// contracts/__tests__/equalweight-governor-model.test.ts
import {
  EqualWeightGovernorModel,
  MockThresholdSigner,
} from '../equalweight-governor-model';

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

  it('sanitizes negative unit weights so votesFor stays non-negative and finite', () => {
    const gov = new EqualWeightGovernorModel({ votingBasis: 'unit' });
    gov.setRoll([{ id: '0xA', units: -5 }, { id: '0xB', units: 3 }]);
    gov.createProposal('p', 'x');
    gov.castVote('p', '0xA', true);
    gov.castVote('p', '0xB', true);

    const t = gov.tally('p');
    expect(t.votesFor).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(t.votesFor)).toBe(true);
  });

  it('sanitizes NaN share weights so votesFor is never NaN', () => {
    const gov = new EqualWeightGovernorModel({ votingBasis: 'share' });
    gov.setRoll([{ id: '0xA', shares: NaN }, { id: '0xB', shares: 3 }]);
    gov.createProposal('p', 'x');
    gov.castVote('p', '0xA', true);
    gov.castVote('p', '0xB', true);

    const t = gov.tally('p');
    expect(Number.isNaN(t.votesFor)).toBe(false);
  });

  it('counts voterCount/turnout against the CURRENT roll after a voter is removed', () => {
    const gov = new EqualWeightGovernorModel();
    gov.setRoll([{ id: '0xA' }, { id: '0xB' }, { id: '0xC' }, { id: '0xD' }]);
    gov.createProposal('p', 'x');
    gov.castVote('p', '0xA', true);
    gov.castVote('p', '0xB', true);

    // A votes then is removed from the roll (roll mutation after voting)
    gov.setRoll([{ id: '0xB' }, { id: '0xC' }, { id: '0xD' }]);

    const t = gov.tally('p');
    expect(t.voterCount).toBe(1); // only B is still on the roll
    expect(t.turnout).toBeCloseTo(1 / 3, 6); // NOT 2/4
    expect(t.turnout).toBeLessThanOrEqual(1);
  });

  describe('committee config validation', () => {
    it('rejects a non-positive committeeThreshold', () => {
      expect(() => new EqualWeightGovernorModel({ committeeThreshold: 0 })).toThrow(
        /committeeThreshold/i
      );
    });

    it('rejects committeeThreshold greater than committeeSize', () => {
      expect(
        () => new EqualWeightGovernorModel({ committeeThreshold: 4, committeeSize: 3 })
      ).toThrow(/committeeThreshold/i);
    });

    it('a default construct still works', () => {
      expect(() => new EqualWeightGovernorModel()).not.toThrow();
    });
  });

  describe('committee finalize (M-of-N)', () => {
    const build = () => {
      const gov = new EqualWeightGovernorModel({ committeeThreshold: 2, committeeSize: 3 });
      gov.setRoll([{ id: '0xA' }, { id: '0xB' }]);
      gov.setCommittee(['0xC1', '0xC2', '0xC3']);
      gov.createProposal('p', 'x');
      gov.castVote('p', '0xA', true);
      gov.castVote('p', '0xB', true);
      return gov;
    };

    it('a single approver cannot finalize (no single party can forge)', () => {
      const gov = build();
      expect(() => gov.finalize('p', ['0xC1'])).toThrow(/threshold|approv/i);
    });

    it('k valid committee approvers finalize and attest', () => {
      const gov = build();
      const result = gov.finalize('p', ['0xC1', '0xC2']);
      expect(result.finalized).toBe(true);
      expect(result.attestation?.approvers).toEqual(['0xC1', '0xC2']);
      expect(result.attestation?.algo).toBe('stub-mofn');
    });

    it('rejects an approver who is not on the committee', () => {
      const gov = build();
      expect(() => gov.finalize('p', ['0xC1', '0xNOTCOMMITTEE'])).toThrow(/committee/i);
    });

    it('MockThresholdSigner throws below threshold', () => {
      const signer = new MockThresholdSigner();
      const tally = { proposalId: 'p' } as any;
      expect(() => signer.sign(tally, ['0xC1'], ['0xC1', '0xC2', '0xC3'], 2)).toThrow(/threshold/i);
    });

    it('rejects duplicate approvers collapsing to fewer distinct approvers than threshold', () => {
      const gov = build();
      expect(() => gov.finalize('p', ['0xC1', '0xC1'])).toThrow(/threshold|approv/i);
    });

    it('MockThresholdSigner rejects duplicate approvers directly (dedup replay defense)', () => {
      const signer = new MockThresholdSigner();
      const tally = { proposalId: 'p' } as any;
      expect(() =>
        signer.sign(tally, ['0xC1', '0xC1'], ['0xC1', '0xC2', '0xC3'], 2)
      ).toThrow(/threshold/i);
    });
  });
});
