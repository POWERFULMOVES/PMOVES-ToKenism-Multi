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

import { Ed25519MultisigSigner, generateCommitteeKeypair, verifyTallyAttestation } from '../tally-signer-ed25519';

describe('EqualWeightGovernorModel.ingestSecretTally', () => {
  function gov(overrides = {}) {
    const g = new EqualWeightGovernorModel({ committeeSize: 3, committeeThreshold: 2, ...overrides });
    g.setRoll([{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }]); // 5 eligible
    g.createProposal('p1', 'Recall');
    return g;
  }

  it('sources eligibleCount from the roll and derives voterCount', () => {
    const g = gov();
    const t = g.ingestSecretTally('p1', { votesFor: 3, votesAgainst: 1, abstentions: 0 });
    expect(t.eligibleCount).toBe(5);
    expect(t.voterCount).toBe(4);
    expect(t.turnout).toBeCloseTo(0.8, 6);
  });

  it('locks the proposal to secret mode — a later castVote throws', () => {
    const g = gov();
    g.ingestSecretTally('p1', { votesFor: 3, votesAgainst: 1, abstentions: 0 });
    expect(() => g.castVote('p1', 'A', true)).toThrow(/mode|secret|named/i);
  });

  it('refuses ingestion on a proposal already used for named votes', () => {
    const g = gov();
    g.castVote('p1', 'A', true);
    expect(() => g.ingestSecretTally('p1', { votesFor: 1, votesAgainst: 0, abstentions: 0 })).toThrow(/mode|secret|named/i);
  });

  it('propagates the voterCount<=eligibleCount guard', () => {
    const g = gov();
    expect(() => g.ingestSecretTally('p1', { votesFor: 4, votesAgainst: 2, abstentions: 0 })).toThrow(/exceeds|eligible/i);
  });

  it('tally() returns the ingested result for a secret proposal', () => {
    const g = gov();
    const ingested = g.ingestSecretTally('p1', { votesFor: 3, votesAgainst: 1, abstentions: 0 });
    expect(g.tally('p1')).toEqual(ingested);
  });

  it('finalize() signs an ingested tally and verifyTallyAttestation accepts, with ballotRef in the signed bytes', () => {
    const keyring = { '0xC1': generateCommitteeKeypair(), '0xC2': generateCommitteeKeypair(), '0xC3': generateCommitteeKeypair() };
    const g = new EqualWeightGovernorModel({ committeeSize: 3, committeeThreshold: 2 }, new Ed25519MultisigSigner(keyring));
    g.setRoll([{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }]);
    g.setCommittee(['0xC1', '0xC2', '0xC3']);
    g.createProposal('p1', 'Recall');
    g.ingestSecretTally('p1', { votesFor: 3, votesAgainst: 1, abstentions: 1, ballotRef: { ballotId: 'b1', receiptLogDigest: 'd1' } });

    const result = g.finalize('p1', ['0xC1', '0xC2']);
    expect(result.finalized).toBe(true);
    expect(result.ballotRef).toEqual({ ballotId: 'b1', receiptLogDigest: 'd1' });

    const pub = Object.fromEntries(Object.entries(keyring).map(([id, kp]) => [id, kp.publicKey]));
    expect(verifyTallyAttestation(result, result.attestation!, pub, 2).valid).toBe(true);
    // tampering the bound ballotRef breaks verification
    const tampered = { ...result, ballotRef: { ballotId: 'b1', receiptLogDigest: 'HACKED' } };
    expect(verifyTallyAttestation(tampered, result.attestation!, pub, 2).valid).toBe(false);
  });
});
