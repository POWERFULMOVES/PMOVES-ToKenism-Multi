/**
 * Tests for the settlement MAC verifier.
 *
 * The module this covers replaced a truthiness check that guarded LIVE money
 * movement, and it shipped with zero tests. Every case below is written as a
 * REJECTION with a named reason wherever a rejection is the point: a bare
 * `toThrow()` / `toBe(false)` would pass for the wrong reason, which is the
 * exact failure mode that let `hmac: 'abc123'` through in the first place.
 *
 * No key here is a production key. All material is locally constructed test
 * material and no key bytes are ever printed.
 */
import { createHmac } from 'crypto';
import {
  InMemorySettlementKeyring,
  contractExecutorPreimage,
  deploymentApprovalPreimage,
  deploymentAttestationPreimage,
  hasSettlementProof,
  settlementApprovalPreimage,
  settlementExecutorPreimage,
  settlementRequestPreimage,
  signSettlement,
  supportedSettlementAlgorithms,
  verifySettlementSignature,
} from '../settlement-signature';
import { tallyPreimage } from '../tally-signer-ed25519';
import type { SettlementBatch, SettlementSignature } from '../settlement-planner';

const KID = 'settlement-test-key';
const OTHER_KID = 'settlement-test-key-2';
// Deterministic, non-secret, test-only material.
const KEY = 'a'.repeat(64);
const OTHER_KEY = 'b'.repeat(64);

function keyring(): InMemorySettlementKeyring {
  return new InMemorySettlementKeyring({ [KID]: KEY, [OTHER_KID]: OTHER_KEY });
}

function batch(): SettlementBatch & { agent_id?: string } {
  return {
    settlement_id: 'settlement_1234abcd5678ef00',
    source_subject: 'tokenism.cgp.weekly.v1',
    source_id: 'weekly-cgp-12',
    cgp_spec: 'chit.cgp.v1.0',
    cgp_hash: `sha256:${'a'.repeat(64)}`,
    week: 12,
    status: 'planned',
    settlement_profile: 'weekly-grotoken-v1',
    created_at: '2026-05-22T01:02:03Z',
    agent_id: 'PMOVES-AGENT-ZERO-CODEX',
    totals: { instruction_count: 1, amount: 600, asset: 'GRO' },
    instructions: [
      {
        instruction_id: 'settle_inst_1234abcd5678ef00',
        idempotency_key: 'tokenism:weekly-grotoken-v1:week-12:0xalice:1234abcd5678ef00',
        lane: 'firefly',
        action: 'grotoken_mint',
        address: '0xALICE',
        amount: 600,
        asset: 'GRO',
        source_ref: {
          cgp_hash: `sha256:${'a'.repeat(64)}`,
          merkle_root: `0x${'b'.repeat(64)}`,
          contributor_weight: 0.6,
          raw_contribution: 60,
        },
      },
    ],
  } as SettlementBatch & { agent_id?: string };
}

describe('settlement signature — round trip', () => {
  it('signs and verifies a settlement request', () => {
    const ring = keyring();
    const message = settlementRequestPreimage(batch());
    const signature = signSettlement(message, KID, ring);

    expect(signature.alg).toBe('hmac-sha256');
    expect(signature.kid).toBe(KID);
    expect(verifySettlementSignature(signature, message, ring)).toEqual({ valid: true });
  });

  it('advertises hmac-sha256 as a supported algorithm', () => {
    expect(supportedSettlementAlgorithms()).toContain('hmac-sha256');
  });
});

describe('settlement signature — fail-closed rejections', () => {
  const ring = keyring();
  const message = settlementRequestPreimage(batch());
  const good = signSettlement(message, KID, ring);

  it('rejects the pre-fix `abc123` placeholder', () => {
    // The literal fixture that opened the old gate.
    const result = verifySettlementSignature(
      { alg: 'HMAC-SHA256', kid: KID, hmac: 'abc123' },
      message,
      ring
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('signature.hmac must be 64 canonical hex characters');
  });

  it('rejects a missing signature', () => {
    expect(verifySettlementSignature(undefined, message, ring)).toEqual({
      valid: false,
      reason: 'signature is missing',
    });
  });

  it('rejects a missing alg', () => {
    const result = verifySettlementSignature({ ...good, alg: '' }, message, ring);
    expect(result.reason).toBe('signature.alg is missing');
  });

  it('rejects a missing kid', () => {
    const result = verifySettlementSignature({ ...good, kid: '' }, message, ring);
    expect(result.reason).toBe('signature.kid is missing');
  });

  it('rejects an unknown alg rather than falling back to hmac', () => {
    const result = verifySettlementSignature({ ...good, alg: 'ed25519-not-registered' }, message, ring);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/^unsupported signature\.alg /);
  });

  it('rejects when no keyring is configured — a missing keyring is not a bypass', () => {
    const result = verifySettlementSignature(good, message, undefined);
    expect(result).toEqual({ valid: false, reason: 'no settlement keyring configured' });
  });

  it('rejects an unknown kid', () => {
    const result = verifySettlementSignature({ ...good, kid: 'kid-not-in-ring' }, message, ring);
    expect(result.reason).toBe('unknown signature.kid: kid-not-in-ring');
  });

  it('rejects a valid MAC minted under a different key', () => {
    const wrongKey = signSettlement(message, OTHER_KID, ring);
    const result = verifySettlementSignature({ ...wrongKey, kid: KID }, message, ring);
    expect(result).toEqual({ valid: false, reason: 'signature does not verify' });
  });

  it('rejects hex smuggling — trailing garbage on an otherwise valid proof', () => {
    const result = verifySettlementSignature(
      { ...good, hmac: `${good.hmac}z` },
      message,
      ring
    );
    expect(result.reason).toBe('signature.hmac must be 64 canonical hex characters');
  });

  it('rejects a truncated proof', () => {
    const result = verifySettlementSignature(
      { ...good, hmac: String(good.hmac).slice(0, 62) },
      message,
      ring
    );
    expect(result.reason).toBe('signature.hmac must be 64 canonical hex characters');
  });

  it('rejects a non-string proof (type confusion)', () => {
    const result = verifySettlementSignature(
      { alg: 'hmac-sha256', kid: KID, hmac: 1234 } as unknown as SettlementSignature,
      message,
      ring
    );
    expect(result.reason).toBe('signature.hmac must be 64 canonical hex characters');
  });
});

describe('settlement signature — replay resistance', () => {
  const ring = keyring();

  it('rejects a signature replayed onto a different payload', () => {
    const original = batch();
    const signature = signSettlement(settlementRequestPreimage(original), KID, ring);

    const tampered = batch();
    // Redirect the money while holding the totals constant — the attack that a
    // count+total summary preimage would not have caught.
    tampered.instructions[0].address = '0xMALLORY';

    const result = verifySettlementSignature(
      signature,
      settlementRequestPreimage(tampered),
      ring
    );
    expect(result).toEqual({ valid: false, reason: 'signature does not verify' });
  });

  it('rejects an amount change that preserves the declared totals', () => {
    const original = batch();
    const signature = signSettlement(settlementRequestPreimage(original), KID, ring);

    const tampered = batch();
    tampered.instructions[0].amount = 599;

    expect(
      verifySettlementSignature(signature, settlementRequestPreimage(tampered), ring).valid
    ).toBe(false);
  });

  it('rejects a cross-DOMAIN replay: a tally MAC is not a settlement MAC', () => {
    // Same key, same HMAC construction, different domain tag. If the domain tag
    // were absent or shared, this would verify.
    const tallyMessage = tallyPreimage({
      proposalId: 'settlement_1234abcd5678ef00',
      votesFor: 1,
      votesAgainst: 0,
      eligibleCount: 2,
      voterCount: 1,
      quorumMet: true,
      passed: true,
    } as never);
    const tallyMac = createHmac('sha256', Buffer.from(KEY, 'hex'))
      .update(tallyMessage)
      .digest('hex');

    const result = verifySettlementSignature(
      { alg: 'hmac-sha256', kid: KID, hmac: tallyMac },
      settlementRequestPreimage(batch()),
      ring
    );
    expect(result).toEqual({ valid: false, reason: 'signature does not verify' });
  });

  it('rejects a cross-PURPOSE replay: an executor signature is not an approval', () => {
    const executorMessage = settlementExecutorPreimage({
      settlementId: 'settlement_1234abcd5678ef00',
      executorAgentId: 'FIREFLY-SETTLEMENT-EXECUTOR',
      cgpHash: `sha256:${'a'.repeat(64)}`,
      week: 12,
    });
    const executorSignature = signSettlement(executorMessage, KID, ring);

    const approvalMessage = settlementApprovalPreimage({
      approvalId: 'approval_firefly_1234abcd5678ef00',
      settlementId: 'settlement_1234abcd5678ef00',
      scope: 'firefly_live_execution',
      approvedBy: 'PMOVES-OPERATOR',
      approvedAt: '2026-05-25T12:00:00Z',
    });

    expect(verifySettlementSignature(executorSignature, approvalMessage, ring)).toEqual({
      valid: false,
      reason: 'signature does not verify',
    });
  });

  it('rejects a cross-LANE replay: a Firefly executor identity is not a contract one', () => {
    const params = {
      settlementId: 'settlement_1234abcd5678ef00',
      executorAgentId: 'SHARED-EXECUTOR',
      cgpHash: `sha256:${'a'.repeat(64)}`,
      week: 12,
    };
    const fireflySignature = signSettlement(settlementExecutorPreimage(params), KID, ring);

    expect(
      verifySettlementSignature(fireflySignature, contractExecutorPreimage(params), ring)
    ).toEqual({ valid: false, reason: 'signature does not verify' });
  });

  it('rejects an executor signature bound to a different settlement_id', () => {
    const signature = signSettlement(
      settlementExecutorPreimage({
        settlementId: 'settlement_ffffffffffffffff',
        executorAgentId: 'FIREFLY-SETTLEMENT-EXECUTOR',
        cgpHash: `sha256:${'a'.repeat(64)}`,
        week: 12,
      }),
      KID,
      ring
    );

    expect(
      verifySettlementSignature(
        signature,
        settlementExecutorPreimage({
          settlementId: 'settlement_1234abcd5678ef00',
          executorAgentId: 'FIREFLY-SETTLEMENT-EXECUTOR',
          cgpHash: `sha256:${'a'.repeat(64)}`,
          week: 12,
        }),
        ring
      ).reason
    ).toBe('signature does not verify');
  });

  it('rejects a deployment approval lifted from another manifest', () => {
    const signature = signSettlement(
      deploymentApprovalPreimage({
        approvalId: 'approval_deployment_1234abcd5678ef00',
        manifestId: 'other-manifest',
        scope: 'settlement_deployment_manifest',
        approvedBy: 'PMOVES-OPERATOR',
        approvedAt: '2026-05-25T12:00:00Z',
      }),
      KID,
      ring
    );

    expect(
      verifySettlementSignature(
        signature,
        deploymentApprovalPreimage({
          approvalId: 'approval_deployment_1234abcd5678ef00',
          manifestId: 'tokenism-firefly-local-20260525',
          scope: 'settlement_deployment_manifest',
          approvedBy: 'PMOVES-OPERATOR',
          approvedAt: '2026-05-25T12:00:00Z',
        }),
        ring
      ).reason
    ).toBe('signature does not verify');
  });

  it('binds the approval set into the deployment attestation signature', () => {
    const base = {
      manifestId: 'tokenism-firefly-local-20260525',
      environment: 'local',
      signedAt: '2026-05-25T12:00:00Z',
      approvalIds: ['approval_deployment_1234abcd5678ef00'],
    };
    const signature = signSettlement(deploymentAttestationPreimage(base), KID, ring);

    // Adding an approval after signing must invalidate the manifest.
    expect(
      verifySettlementSignature(
        signature,
        deploymentAttestationPreimage({
          ...base,
          approvalIds: [...base.approvalIds, 'approval_deployment_injected'],
        }),
        ring
      ).reason
    ).toBe('signature does not verify');
  });
});

describe('settlement signature — preimage canonicalisation', () => {
  const ring = keyring();

  it('does not confuse adjacent fields by concatenation', () => {
    // 'ab' + 'c' must not produce the same preimage as 'a' + 'bc'.
    const a = deploymentApprovalPreimage({
      approvalId: 'ab',
      manifestId: 'c',
      scope: 's',
      approvedBy: 'o',
      approvedAt: '2026-05-25T12:00:00Z',
    });
    const b = deploymentApprovalPreimage({
      approvalId: 'a',
      manifestId: 'bc',
      scope: 's',
      approvedBy: 'o',
      approvedAt: '2026-05-25T12:00:00Z',
    });
    expect(a.equals(b)).toBe(false);
  });

  it('distinguishes an absent optional from an empty-string optional', () => {
    const absent = deploymentApprovalPreimage({
      approvalId: 'a',
      manifestId: 'm',
      scope: 's',
      approvedBy: 'o',
      approvedAt: '2026-05-25T12:00:00Z',
    });
    const present = deploymentApprovalPreimage({
      approvalId: 'a',
      manifestId: 'm',
      scope: 's',
      approvedBy: 'o',
      approvedAt: '2026-05-25T12:00:00Z',
      expiresAt: '2099-01-01T00:00:00Z',
    });
    expect(absent.equals(present)).toBe(false);
  });

  it('refuses to sign a non-finite amount rather than signing "NaN"', () => {
    const bad = batch();
    bad.instructions[0].amount = Number.NaN;
    expect(() => settlementRequestPreimage(bad)).toThrow(
      'settlement amount must be finite'
    );
  });

  it('treats -0 and 0 as the same signable amount', () => {
    const zero = batch();
    zero.instructions[0].amount = 0;
    const negZero = batch();
    negZero.instructions[0].amount = -0;
    const signature = signSettlement(settlementRequestPreimage(zero), KID, ring);
    expect(
      verifySettlementSignature(signature, settlementRequestPreimage(negZero), ring).valid
    ).toBe(true);
  });
});

describe('settlement signature — prototype pollution', () => {
  const ring = keyring();
  const message = settlementRequestPreimage(batch());

  afterEach(() => {
    delete (Object.prototype as Record<string, unknown>).hmac;
  });

  it('does not read an inherited proof field', () => {
    // Settlement events arrive JSON.parse'd off NATS, so the object shape is
    // attacker-influenced. A bare index read would find this.
    const valid = signSettlement(message, KID, ring);
    (Object.prototype as Record<string, unknown>).hmac = valid.hmac;

    const noOwnHmac = { alg: 'hmac-sha256', kid: KID } as unknown as SettlementSignature;
    expect(noOwnHmac.hmac).toBe(valid.hmac); // the pollution IS visible...

    const result = verifySettlementSignature(noOwnHmac, message, ring);
    expect(result).toEqual({
      valid: false,
      reason: 'signature.hmac must be 64 canonical hex characters',
    }); // ...but the verifier does not use it.
  });
});

describe('InMemorySettlementKeyring', () => {
  it('rejects a non-canonical hex key rather than silently truncating it', () => {
    expect(() => new InMemorySettlementKeyring({ [KID]: `${'a'.repeat(62)}zz` })).toThrow(
      `key for kid ${KID} must be canonical even-length hex`
    );
  });

  it('rejects an odd-length hex key', () => {
    expect(() => new InMemorySettlementKeyring({ [KID]: 'a'.repeat(63) })).toThrow(
      'canonical even-length hex'
    );
  });

  it('rejects a key below the minimum length without disclosing the length', () => {
    let message = '';
    try {
      new InMemorySettlementKeyring({ [KID]: 'a'.repeat(16) });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe(`key for kid ${KID} is shorter than the 32-byte minimum`);
    // The supplied key's own length must not appear in operator-facing text.
    expect(message).not.toMatch(/\b8 bytes\b/);
  });

  it('requires a non-empty kid', () => {
    expect(() => new InMemorySettlementKeyring({ '': KEY })).toThrow(
      'keyring entry requires a non-empty kid'
    );
  });

  it('lists kids without exposing key material', () => {
    const ring = keyring();
    expect(ring.kids().sort()).toEqual([KID, OTHER_KID].sort());
  });
});

describe('hasSettlementProof', () => {
  const ring = keyring();
  const good = signSettlement(settlementRequestPreimage(batch()), KID, ring);

  it('accepts a structurally complete signature', () => {
    expect(hasSettlementProof(good)).toBe(true);
  });

  it('rejects the `abc123` placeholder at the producer', () => {
    expect(hasSettlementProof({ alg: 'hmac-sha256', kid: KID, hmac: 'abc123' })).toBe(false);
  });

  it('rejects an unknown alg', () => {
    expect(hasSettlementProof({ ...good, alg: 'made-up' })).toBe(false);
  });

  it('rejects undefined', () => {
    expect(hasSettlementProof(undefined)).toBe(false);
  });
});
