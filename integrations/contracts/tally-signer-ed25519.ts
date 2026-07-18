// contracts/tally-signer-ed25519.ts
// Real Ed25519 k-of-n committee multisignature over a canonical tally preimage.
// Third-party verifiable on public keys only. Replaces MockThresholdSigner's
// stubbed bytes behind the same TallySigner interface. See
// docs/superpowers/specs/2026-07-18-tally-signer-ed25519-design.md.
import { TallyResult } from './equalweight-governor-model';

const TALLY_DOMAIN = 'pmoves.tally.v1';

// Netstring: <utf8 byte length>:<utf8 bytes>, — length-prefixed so fields
// cannot collide by concatenation (e.g. "p1"+"12" vs "p11"+"2").
function ns(s: string): Buffer {
  const body = Buffer.from(s, 'utf8');
  return Buffer.concat([Buffer.from(`${body.length}:`, 'utf8'), body, Buffer.from(',', 'utf8')]);
}

// Canonical signed bytes: domain tag + INTEGER/BOOLEAN result fields only.
// turnout/forShare are derived floats and are deliberately excluded — floats
// serialize non-deterministically and would break verification.
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
