// contracts/tally-signer-ed25519.ts
// Real Ed25519 k-of-n committee multisignature over a canonical tally preimage.
// Third-party verifiable on public keys only. Replaces MockThresholdSigner's
// stubbed bytes behind the same TallySigner interface. See
// docs/superpowers/specs/2026-07-18-tally-signer-ed25519-design.md.
import {
  generateKeyPairSync,
  sign as edSign,
  createPrivateKey,
  verify as edVerify,
  createPublicKey,
} from 'crypto';
import {
  TallyResult,
  TallyAttestation,
  TallySigner,
  assertCommitteeThreshold,
} from './equalweight-governor-model';

const TALLY_DOMAIN = 'pmoves.tally.v1';

// Netstring: <utf8 byte length>:<utf8 bytes>, — length-prefixed so fields
// cannot collide by concatenation (e.g. "p1"+"12" vs "p11"+"2").
function ns(s: string): Buffer {
  const body = Buffer.from(s, 'utf8');
  return Buffer.concat([Buffer.from(`${body.length}:`, 'utf8'), body, Buffer.from(',', 'utf8')]);
}

// Canonical signed bytes: encodes the domain tag + result fields: proposalId,
// the four vote/eligibility counts, and the quorumMet/passed booleans. Counts
// are integers under member-basis (the contested-ballot case); under
// share/unit basis they may be fractional but verification still reconciles
// because signer and verifier serialize the same transmitted value with
// String(). turnout/forShare are excluded (derived floats). NOTE: this binds
// the transmitted numeric value, not a recomputation — a consumer that
// RE-TALLIES on another platform under a weighted basis must use a
// scaled-integer representation instead.
export function tallyPreimage(tally: TallyResult): Buffer {
  const fields = [
    TALLY_DOMAIN,
    tally.proposalId,
    String(tally.votesFor),
    String(tally.votesAgainst),
    String(tally.eligibleCount),
    String(tally.voterCount),
    tally.quorumMet ? '1' : '0',
    tally.passed ? '1' : '0',
  ];
  return Buffer.concat(fields.map(ns));
}

// Ed25519 committee keypair, hex-encoded DER (SPKI public / PKCS8 private).
export interface CommitteeKeypair {
  publicKey: string;
  privateKey: string;
}

// Sim/test convenience. Real deployments supply keys out of band (custody is a
// counsel-gated decision — hardware token / per-device / paper-backed — and is
// deliberately NOT coded here; keys are injected).
export function generateCommitteeKeypair(): CommitteeKeypair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKey: (publicKey.export({ type: 'spki', format: 'der' }) as Buffer).toString('hex'),
    privateKey: (privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer).toString('hex'),
  };
}

// Real Ed25519 k-of-n multisig. The sim signer holds committee keypairs to
// model the signing ceremony; a production deployment collects independently
// produced per-member signatures. The interface (approvers in -> per-approver
// signatures out) is ceremony-agnostic.
export class Ed25519MultisigSigner implements TallySigner {
  constructor(private keyring: Record<string, CommitteeKeypair>) {}

  sign(
    tally: TallyResult,
    approvers: string[],
    committee: string[],
    threshold: number
  ): TallyAttestation {
    const unique = assertCommitteeThreshold(approvers, committee, threshold);
    const msg = tallyPreimage(tally);
    const signatures: Record<string, string> = {};
    for (const id of unique) {
      const kp = this.keyring[id];
      if (!kp || !kp.privateKey) {
        throw new Error(`No private key for approver ${id}`);
      }
      const priv = createPrivateKey({ key: Buffer.from(kp.privateKey, 'hex'), type: 'pkcs8', format: 'der' });
      signatures[id] = (edSign(null, msg, priv) as Buffer).toString('hex');
    }
    return { algo: 'ed25519-multisig', approvers: unique, signatures };
  }
}

export interface VerifyResult {
  valid: boolean;
  signers: string[];   // distinct committee members whose signatures verified
  reason?: string;
}

// Third-party verification on PUBLIC material only — needs no signer or
// governor. An AG/bank runs this with the published committee public keys.
// Requires EVERY listed signature to verify AND at least `threshold` distinct
// committee signers. Any unknown id, bad signature, or short count => invalid,
// with a reason (informing, not just a boolean). Consumers should recompute
// `turnout` from the verified counts rather than trusting the transmitted
// float — it is excluded from the signed bytes by design.
export function verifyTallyAttestation(
  tally: TallyResult,
  attestation: TallyAttestation,
  publicKeyring: Record<string, string>,
  threshold: number
): VerifyResult {
  if (threshold < 1) {
    return { valid: false, signers: [], reason: `invalid threshold: ${threshold} < 1` };
  }
  const sigs = attestation.signatures;
  if (!sigs || Object.keys(sigs).length === 0) {
    return { valid: false, signers: [], reason: 'no signatures present' };
  }
  const msg = tallyPreimage(tally);
  const verified: string[] = [];
  for (const [id, sigHex] of Object.entries(sigs)) {
    const pubHex = publicKeyring[id];
    if (!pubHex) {
      return { valid: false, signers: [], reason: `signer ${id} not in committee keyring` };
    }
    let ok = false;
    try {
      const pub = createPublicKey({ key: Buffer.from(pubHex, 'hex'), type: 'spki', format: 'der' });
      ok = edVerify(null, msg, pub, Buffer.from(sigHex, 'hex'));
    } catch {
      ok = false;
    }
    if (!ok) {
      return { valid: false, signers: [], reason: `invalid signature from ${id}` };
    }
    verified.push(id);
  }
  // Defense-in-depth, not a correctness requirement: `verified` entries come
  // from Object.entries(sigs), whose keys are already unique, so this dedup
  // is belt-and-suspenders against a future non-object signature container.
  const distinct = Array.from(new Set(verified));
  if (distinct.length < threshold) {
    return { valid: false, signers: distinct, reason: `below threshold: ${distinct.length} < ${threshold}` };
  }
  return { valid: true, signers: distinct };
}
