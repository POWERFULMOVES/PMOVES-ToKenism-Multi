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

import { sign as edSign2, createPrivateKey as makePriv } from 'crypto';
import { verifyTallyAttestation } from '../tally-signer-ed25519';
import { EqualWeightGovernorModel } from '../equalweight-governor-model';

function pubKeyring(keyring: Record<string, CommitteeKeypair>): Record<string, string> {
  return Object.fromEntries(Object.entries(keyring).map(([id, kp]) => [id, kp.publicKey]));
}

describe('verifyTallyAttestation', () => {
  const committee = ['0xC1', '0xC2', '0xC3'];
  let keyring: Record<string, CommitteeKeypair>;
  beforeEach(() => {
    keyring = {
      '0xC1': generateCommitteeKeypair(),
      '0xC2': generateCommitteeKeypair(),
      '0xC3': generateCommitteeKeypair(),
    };
  });

  it('accepts a valid 2-of-3 attestation and reports the signers', () => {
    const att = new Ed25519MultisigSigner(keyring).sign(baseTally(), ['0xC1', '0xC2'], committee, 2);
    const res = verifyTallyAttestation(baseTally(), att, pubKeyring(keyring), 2);
    expect(res.valid).toBe(true);
    expect(res.signers.sort()).toEqual(['0xC1', '0xC2']);
  });

  it('rejects a tampered tally (signature binds the exact result)', () => {
    const att = new Ed25519MultisigSigner(keyring).sign(baseTally(), ['0xC1', '0xC2'], committee, 2);
    const tampered = baseTally({ votesFor: 99 });
    const res = verifyTallyAttestation(tampered, att, pubKeyring(keyring), 2);
    expect(res.valid).toBe(false);
  });

  it('rejects an outsider signature not in the committee keyring', () => {
    const att = new Ed25519MultisigSigner(keyring).sign(baseTally(), ['0xC1', '0xC2'], committee, 2);
    // splice in a real signature from a stranger key under a new id
    const stranger = generateCommitteeKeypair();
    const msg = tallyPreimage(baseTally());
    const strangerSig = (edSign2(null, msg, makePriv({ key: Buffer.from(stranger.privateKey, 'hex'), type: 'pkcs8', format: 'der' })) as Buffer).toString('hex');
    att.signatures!['0xSTRANGER'] = strangerSig;
    const res = verifyTallyAttestation(baseTally(), att, pubKeyring(keyring), 2);
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/0xSTRANGER|keyring|committee/i);
  });

  it('rejects a signature presented with the wrong tally', () => {
    const att = new Ed25519MultisigSigner(keyring).sign(baseTally({ proposalId: 'pA' }), ['0xC1', '0xC2'], committee, 2);
    const res = verifyTallyAttestation(baseTally({ proposalId: 'pB' }), att, pubKeyring(keyring), 2);
    expect(res.valid).toBe(false);
  });

  it('rejects below the required threshold count', () => {
    // a genuine 2-of-3 attestation checked against threshold 3
    const att = new Ed25519MultisigSigner(keyring).sign(baseTally(), ['0xC1', '0xC2'], committee, 2);
    const res = verifyTallyAttestation(baseTally(), att, pubKeyring(keyring), 3);
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/threshold/i);
  });

  it('rejects an attestation with no signatures', () => {
    const res = verifyTallyAttestation(baseTally(), { algo: 'ed25519-multisig', approvers: [] }, pubKeyring(keyring), 2);
    expect(res.valid).toBe(false);
  });

  it('rejects a malformed signature without throwing', () => {
    const att = new Ed25519MultisigSigner(keyring).sign(baseTally(), ['0xC1', '0xC2'], committee, 2);
    att.signatures!['0xC1'] = 'zznothex'; // non-hex / corrupt
    expect(() => verifyTallyAttestation(baseTally(), att, pubKeyring(keyring), 2)).not.toThrow();
    const res = verifyTallyAttestation(baseTally(), att, pubKeyring(keyring), 2);
    expect(res.valid).toBe(false);
  });

  it('rejects a malformed public key without throwing', () => {
    const att = new Ed25519MultisigSigner(keyring).sign(baseTally(), ['0xC1', '0xC2'], committee, 2);
    const badKeyring = { ...pubKeyring(keyring), '0xC1': 'zznothex' };
    expect(() => verifyTallyAttestation(baseTally(), att, badKeyring, 2)).not.toThrow();
    const res = verifyTallyAttestation(baseTally(), att, badKeyring, 2);
    expect(res.valid).toBe(false);
  });

  it('rejects the whole attestation if any single signature is invalid (all-must-verify)', () => {
    const att = new Ed25519MultisigSigner(keyring).sign(baseTally(), ['0xC1', '0xC2'], committee, 2);
    // corrupt exactly one signature's bytes while keeping it hex + right length,
    // so it reaches edVerify and fails there, not the try/catch.
    const good = att.signatures!['0xC2'];
    const flippedChar = good[0] === '0' ? '1' : '0';
    const flipped = flippedChar + good.slice(1);
    expect(flipped).not.toEqual(good); // guard: the flip must actually change the byte
    att.signatures!['0xC2'] = flipped;
    const res = verifyTallyAttestation(baseTally(), att, pubKeyring(keyring), 2);
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/invalid signature/i);
  });
});

describe('integration: governor.finalize() with the real signer', () => {
  it('produces an attestation that verifyTallyAttestation accepts', () => {
    const keyring = {
      '0xC1': generateCommitteeKeypair(),
      '0xC2': generateCommitteeKeypair(),
      '0xC3': generateCommitteeKeypair(),
    };
    const gov = new EqualWeightGovernorModel(
      { committeeSize: 3, committeeThreshold: 2 },
      new Ed25519MultisigSigner(keyring)
    );
    gov.setCommittee(['0xC1', '0xC2', '0xC3']);
    gov.setRoll([{ id: '0xA' }, { id: '0xB' }, { id: '0xC' }, { id: '0xD' }]);
    gov.createProposal('p1', 'Adopt bylaw');
    gov.castVote('p1', '0xA', true);
    gov.castVote('p1', '0xB', true);
    gov.castVote('p1', '0xC', false);

    const result = gov.finalize('p1', ['0xC1', '0xC2']);
    expect(result.finalized).toBe(true);

    const publicKeyring = Object.fromEntries(Object.entries(keyring).map(([id, kp]) => [id, kp.publicKey]));
    const res = verifyTallyAttestation(result, result.attestation!, publicKeyring, 2);
    expect(res.valid).toBe(true);
    expect(res.signers.sort()).toEqual(['0xC1', '0xC2']);
  });
});
