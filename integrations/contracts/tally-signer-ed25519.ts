// contracts/tally-signer-ed25519.ts
// Real Ed25519 k-of-n committee multisignature over a canonical tally preimage.
// Third-party verifiable on public keys only. Replaces MockThresholdSigner's
// stubbed bytes behind the same TallySigner interface. See
// docs/superpowers/specs/2026-07-18-tally-signer-ed25519-design.md.
import { generateKeyPairSync, sign as edSign, createPrivateKey, verify as edVerify, createPublicKey } from 'crypto';
import { TallyResult, TallyAttestation, TallySigner, assertCommitteeThreshold } from './equalweight-governor-model';

const TALLY_DOMAIN = 'pmoves.tally.v1';

// Netstring: <utf8 byte length>:<utf8 bytes>, — length-prefixed so fields
// cannot collide by concatenation (e.g. "p1"+"12" vs "p11"+"2").
function ns(s: string): Buffer {
  const body = Buffer.from(s, 'utf8');
  return Buffer.concat([Buffer.from(`${body.length}:`, 'utf8'), body, Buffer.from(',', 'utf8')]);
}

function assertCanonicalTally(tally: TallyResult): void {
  const counts: Array<[string, number]> = [
    ['votesFor', tally.votesFor],
    ['votesAgainst', tally.votesAgainst],
    ['eligibleCount', tally.eligibleCount],
    ['voterCount', tally.voterCount]
  ];
  for (const [label, value] of counts) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${label} must be a non-negative safe integer (got ${value})`);
    }
  }
  if (tally.voterCount > tally.eligibleCount) {
    throw new Error(`voterCount ${tally.voterCount} cannot exceed eligibleCount ${tally.eligibleCount}`);
  }
}

// Canonical signed bytes: encodes the domain tag + result fields: proposalId,
// the four vote/eligibility counts, and the quorumMet/passed booleans. Signed
// counts must be non-negative safe integers. Weighted deployments must convert
// fractional unit/share weights to a documented scaled-integer representation
// before signing. turnout/forShare are excluded because they are derived floats.
export function tallyPreimage(tally: TallyResult): Buffer {
  assertCanonicalTally(tally);
  const fields = [
    TALLY_DOMAIN,
    tally.proposalId,
    String(tally.votesFor),
    String(tally.votesAgainst),
    String(tally.eligibleCount),
    String(tally.voterCount),
    tally.quorumMet ? '1' : '0',
    tally.passed ? '1' : '0'
  ];
  // Backward-compatible provenance binding: only when a ballotRef is present do we
  // append its sentinel + fields. A tally without ballotRef yields byte-identical
  // output to before, so existing signatures/tests still hold; because the
  // signature covers the whole byte string, a ballotRef cannot be stripped from a
  // signed tally and still verify.
  if (tally.ballotRef) {
    fields.push('ballotref.v1', tally.ballotRef.ballotId, tally.ballotRef.receiptLogDigest);
  }
  return Buffer.concat(fields.map(ns));
}

// Ed25519 committee keypair, hex-encoded DER (SPKI public / PKCS8 private).
export interface CommitteeKeypair {
  publicKey: string;
  privateKey: string;
}

// Sim/test convenience. Keys are INJECTED, never hardcoded — because who holds
// the committee private keys IS who holds the authority, and that choice
// belongs to the group deciding where its own power sits (hardware token /
// per-device / paper-backed). Counsel can inform the mechanics; it does not
// grant the authority. Custody is deliberately not coded here so the community
// wires in its own — we build the rails, the group holds the keys.
export function generateCommitteeKeypair(): CommitteeKeypair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKey: (publicKey.export({ type: 'spki', format: 'der' }) as Buffer).toString('hex'),
    privateKey: (privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer).toString('hex')
  };
}

// Real Ed25519 k-of-n multisig. The sim signer holds committee keypairs to
// model the signing ceremony; a production deployment collects independently
// produced per-member signatures. The interface (approvers in -> per-approver
// signatures out) is ceremony-agnostic.
export class Ed25519MultisigSigner implements TallySigner {
  constructor(private keyring: Record<string, CommitteeKeypair>) {}

  sign(tally: TallyResult, approvers: string[], committee: string[], threshold: number): TallyAttestation {
    const unique = assertCommitteeThreshold(approvers, committee, threshold);
    const msg = tallyPreimage(tally);
    const signatures: Record<string, string> = {};
    for (const id of unique) {
      const kp = this.keyring[id];
      if (!kp || !kp.privateKey) {
        throw new Error(`No private key for approver ${id}`);
      }
      const priv = createPrivateKey({
        key: Buffer.from(kp.privateKey, 'hex'),
        type: 'pkcs8',
        format: 'der'
      });
      signatures[id] = (edSign(null, msg, priv) as Buffer).toString('hex');
    }
    return { algo: 'ed25519-multisig', approvers: unique, signatures };
  }
}

export interface VerifyResult {
  valid: boolean;
  signers: string[]; // distinct committee members whose signatures verified
  reason?: string;
}

// Canonical-hex + exact-length guard, checked BEFORE any Buffer.from(x, 'hex')
// decode. Buffer.from silently stops at the first non-hex character instead of
// throwing, so a string like `<valid 128-char sig>z` decodes to the exact same
// 64 bytes as the valid signature, quietly discarding the trailing garbage
// instead of rejecting the input. Validating length in hex chars (2 per byte)
// against an expected byte count closes that smuggling path.
function isHex(s: string, expectedBytes: number): boolean {
  return typeof s === 'string' && /^[0-9a-fA-F]+$/.test(s) && s.length === expectedBytes * 2;
}

// Verification on PUBLIC material only — needs no signer, no governor, no
// private keys, no outside authority. WE own and run this on our own
// infrastructure, on our own command; it never waits on anyone else to bless
// a result. Because it needs only public keys, the SAME proof is independently
// checkable by anyone we choose to show — a member on their own laptop who
// distrusts the operator, or an external party if we decide to open the books.
// That is transparency we extend outward, not a gate we stand behind: the
// forge-resistance means even the operator/builder cannot fake a result, which
// is what makes the tally trustworthy to the group itself.
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
  if (attestation.algo !== 'ed25519-multisig') {
    return {
      valid: false,
      signers: [],
      reason: `unsupported attestation algorithm: ${attestation.algo}`
    };
  }
  if (!Number.isSafeInteger(threshold) || threshold < 2) {
    return {
      valid: false,
      signers: [],
      reason: `invalid threshold: ${threshold}`
    };
  }
  const sigs = attestation.signatures;
  if (!sigs || Object.keys(sigs).length === 0) {
    return { valid: false, signers: [], reason: 'no signatures present' };
  }
  const signatureIds = Object.keys(sigs);
  const approverIds = attestation.approvers;
  if (new Set(approverIds).size !== approverIds.length) {
    return {
      valid: false,
      signers: [],
      reason: 'attestation approvers contain duplicates'
    };
  }
  if (
    approverIds.length !== signatureIds.length ||
    approverIds.some((id) => !Object.prototype.hasOwnProperty.call(sigs, id))
  ) {
    return {
      valid: false,
      signers: [],
      reason: 'attestation approvers do not match signature ids'
    };
  }
  let msg: Buffer;
  try {
    msg = tallyPreimage(tally);
  } catch (error) {
    return {
      valid: false,
      signers: [],
      reason: error instanceof Error ? error.message : 'invalid tally preimage'
    };
  }
  const verified: string[] = [];
  // Distinct PUBLIC KEY material, not distinct ids -- if the keyring maps two
  // ids to the same key, one private key must not be able to satisfy a
  // multi-party quorum. Reported `signers` stays id-based; the threshold gate
  // below keys off this set instead.
  const distinctKeys = new Set<string>();
  for (const [id, sigHex] of Object.entries(sigs)) {
    const pubHex = publicKeyring[id];
    if (!pubHex) {
      return {
        valid: false,
        signers: [],
        reason: `signer ${id} not in committee keyring`
      };
    }
    if (!isHex(sigHex, 64)) {
      return {
        valid: false,
        signers: [],
        reason: `malformed signature encoding from ${id}`
      };
    }
    if (!isHex(pubHex, 44)) {
      return {
        valid: false,
        signers: [],
        reason: `malformed public key encoding for ${id}`
      };
    }
    let ok = false;
    try {
      const pub = createPublicKey({
        key: Buffer.from(pubHex, 'hex'),
        type: 'spki',
        format: 'der'
      });
      ok = edVerify(null, msg, pub, Buffer.from(sigHex, 'hex'));
    } catch {
      ok = false;
    }
    if (!ok) {
      return {
        valid: false,
        signers: [],
        reason: `invalid signature from ${id}`
      };
    }
    verified.push(id);
    distinctKeys.add(pubHex.toLowerCase());
  }
  // Defense-in-depth, not a correctness requirement: `verified` entries come
  // from Object.entries(sigs), whose keys are already unique, so this dedup
  // is belt-and-suspenders against a future non-object signature container.
  const distinct = Array.from(new Set(verified));
  if (distinctKeys.size < threshold) {
    return {
      valid: false,
      signers: distinct,
      reason: `below threshold: ${distinctKeys.size} distinct keys < ${threshold}`
    };
  }
  return { valid: true, signers: distinct };
}
