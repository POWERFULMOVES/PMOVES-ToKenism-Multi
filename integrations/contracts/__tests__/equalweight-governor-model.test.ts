// contracts/__tests__/equalweight-governor-model.test.ts
import { EqualWeightGovernorModel, MockThresholdSigner, assertCommitteeThreshold } from '../equalweight-governor-model';

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
    const gov = new EqualWeightGovernorModel({
      quorumPercentage: 0.5,
      passThreshold: 0.5
    });
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
    gov.setRoll([
      { id: '0xA', units: -5 },
      { id: '0xB', units: 3 }
    ]);
    gov.createProposal('p', 'x');
    gov.castVote('p', '0xA', true);
    gov.castVote('p', '0xB', true);

    const t = gov.tally('p');
    expect(t.votesFor).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(t.votesFor)).toBe(true);
  });

  it('sanitizes NaN share weights so votesFor is never NaN', () => {
    const gov = new EqualWeightGovernorModel({ votingBasis: 'share' });
    gov.setRoll([
      { id: '0xA', shares: NaN },
      { id: '0xB', shares: 3 }
    ]);
    gov.createProposal('p', 'x');
    gov.castVote('p', '0xA', true);
    gov.castVote('p', '0xB', true);

    const t = gov.tally('p');
    expect(Number.isNaN(t.votesFor)).toBe(false);
  });

  it('snapshots the eligible roll per proposal so later roll changes do not rewrite history', () => {
    const gov = new EqualWeightGovernorModel();
    gov.setRoll([{ id: '0xA' }, { id: '0xB' }, { id: '0xC' }, { id: '0xD' }]);
    gov.createProposal('p', 'x');
    gov.castVote('p', '0xA', true);
    gov.castVote('p', '0xB', true);

    // A votes, then the active roll changes for future proposals.
    gov.setRoll([{ id: '0xB' }, { id: '0xC' }, { id: '0xD' }]);

    const t = gov.tally('p');
    expect(t.voterCount).toBe(2);
    expect(t.eligibleCount).toBe(4);
    expect(t.turnout).toBeCloseTo(2 / 4, 6);
    expect(t.turnout).toBeLessThanOrEqual(1);

    gov.createProposal('future', 'future proposal');
    expect(gov.tally('future').eligibleCount).toBe(3);
  });

  it('rejects duplicate proposal ids instead of overwriting votes', () => {
    const gov = new EqualWeightGovernorModel();
    gov.setRoll([{ id: '0xA' }]);
    gov.createProposal('p', 'first');
    gov.castVote('p', '0xA', true);

    expect(() => gov.createProposal('p', 'replacement')).toThrow(/already exists/i);
    expect(gov.tally('p').votesFor).toBe(1);
  });

  it('requires and enforces currentWeek for proposals with a close week', () => {
    const gov = new EqualWeightGovernorModel();
    gov.setRoll([{ id: '0xA' }, { id: '0xB' }]);
    gov.createProposal('p', 'time bounded', 12);

    expect(() => gov.castVote('p', '0xA', true)).toThrow(/currentWeek/i);
    expect(() => gov.castVote('p', '0xA', true, 12)).not.toThrow();
    expect(() => gov.castVote('p', '0xB', true, 13)).toThrow(/closed/i);
  });

  it('only ingests a secret tally after a proposal close week', () => {
    const gov = new EqualWeightGovernorModel();
    gov.setRoll([{ id: '0xA' }, { id: '0xB' }]);
    gov.createProposal('p', 'time bounded secret proposal', 12);
    const counts = { votesFor: 1, votesAgainst: 1, abstentions: 0 };

    expect(() => gov.ingestSecretTally('p', counts)).toThrow(/currentWeek/i);
    expect(() => gov.ingestSecretTally('p', counts, 11)).toThrow(/remains open/i);
    expect(() => gov.ingestSecretTally('p', counts, 12)).toThrow(/remains open/i);
    expect(() => gov.ingestSecretTally('p', counts, 13)).not.toThrow();
  });

  describe('committee config validation', () => {
    it('rejects a non-positive committeeThreshold', () => {
      expect(() => new EqualWeightGovernorModel({ committeeThreshold: 0 })).toThrow(/committeeThreshold/i);
    });

    it('rejects a single-party committeeThreshold', () => {
      expect(() => new EqualWeightGovernorModel({ committeeThreshold: 1 })).toThrow(/committeeThreshold/i);
    });

    it('rejects committeeThreshold greater than committeeSize', () => {
      expect(
        () =>
          new EqualWeightGovernorModel({
            committeeThreshold: 4,
            committeeSize: 3
          })
      ).toThrow(/committeeThreshold/i);
    });

    it('a default construct still works', () => {
      expect(() => new EqualWeightGovernorModel()).not.toThrow();
    });

    it.each([
      ['quorumPercentage', -0.1],
      ['quorumPercentage', 1.1],
      ['quorumPercentage', NaN],
      ['passThreshold', -0.1],
      ['passThreshold', 1.1],
      ['passThreshold', NaN]
    ] as const)('rejects invalid %s %p', (field, value) => {
      expect(() => new EqualWeightGovernorModel({ [field]: value })).toThrow(new RegExp(field, 'i'));
    });

    it.each([0, 1, 1.5, NaN])('rejects invalid committeeSize %p', (committeeSize) => {
      expect(() => new EqualWeightGovernorModel({ committeeSize })).toThrow(/committeeSize/i);
    });
  });

  describe('committee finalize (M-of-N)', () => {
    const build = () => {
      const gov = new EqualWeightGovernorModel({
        committeeThreshold: 2,
        committeeSize: 3
      });
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

    it('requires exactly committeeSize distinct committee members', () => {
      const gov = new EqualWeightGovernorModel({
        committeeThreshold: 2,
        committeeSize: 3
      });
      expect(() => gov.setCommittee(['0xC1', '0xC2'])).toThrow(/exactly 3/i);
      expect(() => gov.setCommittee(['0xC1', '0xC1', '0xC2'])).toThrow(/duplicate/i);
    });

    it('persists a finalized snapshot and rejects later votes', () => {
      const gov = build();
      const finalized = gov.finalize('p', ['0xC1', '0xC2']);

      expect(() => gov.castVote('p', '0xA', false)).toThrow(/finalized/i);
      expect(gov.tally('p')).toEqual(finalized);

      finalized.votesFor = 999;
      finalized.attestation!.approvers[0] = 'tampered';
      expect(gov.tally('p').votesFor).toBe(2);
      expect(gov.tally('p').attestation!.approvers).toEqual(['0xC1', '0xC2']);
    });

    it('MockThresholdSigner rejects duplicate approvers directly (dedup replay defense)', () => {
      const signer = new MockThresholdSigner();
      const tally = { proposalId: 'p' } as any;
      expect(() => signer.sign(tally, ['0xC1', '0xC1'], ['0xC1', '0xC2', '0xC3'], 2)).toThrow(/threshold/i);
    });
  });

  describe('assertCommitteeThreshold (shared M-of-N gate)', () => {
    const committee = ['0xC1', '0xC2', '0xC3'];

    it('returns the deduped approvers when threshold is met', () => {
      expect(assertCommitteeThreshold(['0xC1', '0xC2'], committee, 2).sort()).toEqual(['0xC1', '0xC2']);
    });

    it('throws below threshold', () => {
      expect(() => assertCommitteeThreshold(['0xC1'], committee, 2)).toThrow(/threshold/i);
    });

    it('dedupes a repeated approver (counts once)', () => {
      expect(() => assertCommitteeThreshold(['0xC1', '0xC1'], committee, 2)).toThrow(/threshold/i);
    });

    it('rejects an approver not on the committee', () => {
      expect(() => assertCommitteeThreshold(['0xC1', '0xSTRANGER'], committee, 2)).toThrow(/committee/i);
    });

    it.each([0, 1, -1, 1.5, NaN])(
      'rejects a non-safe-integer threshold (%p) before any dedupe/membership logic',
      (threshold) => {
        expect(() => assertCommitteeThreshold(['0xC1', '0xC2'], committee, threshold)).toThrow(/invalid threshold/i);
      }
    );
  });
});
