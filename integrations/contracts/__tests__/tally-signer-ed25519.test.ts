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

import { verify, createPublicKey } from 'crypto';
// NOTE: `tallyPreimage` is already imported in the Task 1 block above — do NOT
// re-import it (duplicate identifier). Only add the names new to this block.
import {
  generateCommitteeKeypair,
  Ed25519MultisigSigner,
  CommitteeKeypair,
} from '../tally-signer-ed25519';

describe('Ed25519MultisigSigner', () => {
  const committee = ['0xC1', '0xC2', '0xC3'];
  let keyring: Record<string, CommitteeKeypair>;
  beforeEach(() => {
    keyring = {
      '0xC1': generateCommitteeKeypair(),
      '0xC2': generateCommitteeKeypair(),
      '0xC3': generateCommitteeKeypair(),
    };
  });

  it('produces one real Ed25519 signature per approver over the preimage', () => {
    const signer = new Ed25519MultisigSigner(keyring);
    const tally = baseTally();
    const att = signer.sign(tally, ['0xC1', '0xC2'], committee, 2);

    expect(att.algo).toBe('ed25519-multisig');
    expect(att.approvers.sort()).toEqual(['0xC1', '0xC2']);
    expect(Object.keys(att.signatures!).sort()).toEqual(['0xC1', '0xC2']);

    // each signature really verifies against that member's public key
    const msg = tallyPreimage(tally);
    for (const id of ['0xC1', '0xC2']) {
      const pub = createPublicKey({ key: Buffer.from(keyring[id].publicKey, 'hex'), type: 'spki', format: 'der' });
      const ok = verify(null, msg, pub, Buffer.from(att.signatures![id], 'hex'));
      expect(ok).toBe(true);
    }
  });

  it('rejects below threshold (gate)', () => {
    const signer = new Ed25519MultisigSigner(keyring);
    expect(() => signer.sign(baseTally(), ['0xC1'], committee, 2)).toThrow(/threshold/i);
  });

  it('rejects a non-committee approver (gate)', () => {
    const signer = new Ed25519MultisigSigner(keyring);
    expect(() => signer.sign(baseTally(), ['0xC1', '0xSTRANGER'], committee, 2)).toThrow(/committee/i);
  });

  it('rejects a duplicate approver (dedupe -> below threshold)', () => {
    const signer = new Ed25519MultisigSigner(keyring);
    expect(() => signer.sign(baseTally(), ['0xC1', '0xC1'], committee, 2)).toThrow(/threshold/i);
  });

  it('throws when an approver has no private key in the keyring', () => {
    const pubOnly: Record<string, CommitteeKeypair> = {
      '0xC1': keyring['0xC1'],
      '0xC2': { publicKey: keyring['0xC2'].publicKey, privateKey: '' },
      '0xC3': keyring['0xC3'],
    };
    const signer = new Ed25519MultisigSigner(pubOnly);
    expect(() => signer.sign(baseTally(), ['0xC1', '0xC2'], committee, 2)).toThrow(/private key/i);
  });
});
