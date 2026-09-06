// contracts/settlement-signature.ts
// Real MAC verification for the settlement money path.
//
// Before this module, `isSigned()` in firefly/settlement-executor.ts was a
// truthiness check on three strings — `Boolean(sig?.alg && sig.kid && sig.hmac)`
// — standing in for a security gate on LIVE Firefly execution and on operator
// approval. `createHmac` appeared in ZERO files repo-wide and `timingSafeEqual`
// in ZERO, so the `hmac` field was never computed and never verified: it only
// had to be non-empty. `hmac: 'abc123'` opened the gate. The only thing holding
// the money path shut was `dryRun: config.dryRun ?? true`.
//
// House style follows contracts/tally-signer-ed25519.ts: an explicit domain
// tag, a canonical netstring preimage, canonical-hex + exact-length guards
// BEFORE any decode, and fail-closed verification that returns a reason rather
// than a bare boolean.
//
// SEPARATION FROM THE TALLY DOMAIN
// The tally signer signs under `pmoves.tally.v1`. This module signs under
// `pmoves.settlement.v1` plus a per-gate purpose tag, so a committee tally
// signature can never be replayed as a settlement executor identity or as an
// operator approval, and an operator approval can never be replayed as the
// request that it approves.
import { createHmac, timingSafeEqual } from 'crypto';
import type {
  SettlementBatch,
  SettlementInstruction,
  SettlementSignature,
} from './settlement-planner';

export const SETTLEMENT_DOMAIN = 'pmoves.settlement.v1';

// Per-gate purpose tags. Each of the three gates the old `isSigned()` guarded
// gets its own tag so a signature minted for one gate cannot satisfy another.
export type SettlementSignaturePurpose =
  | 'settlement.request'
  | 'settlement.executor'
  | 'settlement.operator_approval';

// Netstring: <utf8 byte length>:<utf8 bytes>, — length-prefixed so adjacent
// fields cannot collide by concatenation (e.g. "ab"+"c" vs "a"+"bc").
function ns(s: string): Buffer {
  const body = Buffer.from(s, 'utf8');
  return Buffer.concat([Buffer.from(`${body.length}:`, 'utf8'), body, Buffer.from(',', 'utf8')]);
}

// Every preimage is built from an ORDERED field list, never from object key
// iteration, so no reordering of a JS object literal can change the signed
// bytes. Optional fields are encoded as a fixed-position empty netstring rather
// than being omitted, so presence/absence cannot shift later fields.
function preimage(purpose: SettlementSignaturePurpose, fields: string[]): Buffer {
  return Buffer.concat([SETTLEMENT_DOMAIN, purpose, ...fields].map(ns));
}

function opt(value: string | undefined | null): string {
  return value === undefined || value === null ? '' : value;
}

// Instructions are folded into the preimage in array order, every field of
// every instruction. A settlement's money movement IS its instruction list; if
// the list were summarised (count + total) an attacker could redirect a
// verified batch by swapping addresses while holding the totals constant.
function instructionFields(instruction: SettlementInstruction): string[] {
  return [
    instruction.instruction_id,
    instruction.idempotency_key,
    instruction.lane,
    instruction.action,
    instruction.address,
    canonicalAmount(instruction.amount),
    instruction.asset,
    instruction.source_ref.cgp_hash,
    opt(instruction.source_ref.merkle_root),
    canonicalAmount(instruction.source_ref.contributor_weight),
    instruction.source_ref.raw_contribution === undefined
      ? ''
      : canonicalAmount(instruction.source_ref.raw_contribution),
  ];
}

// Amounts are signed as their canonical decimal string. NaN/Infinity are
// rejected rather than stringified, because "NaN" would otherwise be a
// perfectly stable signable token for an unusable amount.
function canonicalAmount(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`settlement amount must be finite (got ${value})`);
  }
  // Normalise -0 to 0 so two numerically equal amounts never produce two
  // different preimages.
  return String(value === 0 ? 0 : value);
}

export function settlementRequestPreimage(batch: SettlementBatch & { agent_id?: string }): Buffer {
  const fields: string[] = [
    batch.settlement_id,
    batch.source_subject,
    opt(batch.source_id),
    batch.cgp_spec,
    batch.cgp_hash,
    String(batch.week),
    batch.status,
    batch.settlement_profile,
    batch.created_at,
    opt(batch.agent_id),
    String(batch.totals.instruction_count),
    canonicalAmount(batch.totals.amount),
    batch.totals.asset,
    String(batch.instructions.length),
  ];
  for (const instruction of batch.instructions) {
    fields.push(...instructionFields(instruction));
  }
  return preimage('settlement.request', fields);
}

// The executor identity binds the acting agent to THIS settlement. Binding the
// settlement_id is what stops an executor signature captured from one batch
// being replayed to authorise a different one.
export function settlementExecutorPreimage(params: {
  settlementId: string;
  executorAgentId: string;
  cgpHash: string;
  week: number;
}): Buffer {
  return preimage('settlement.executor', [
    params.settlementId,
    params.executorAgentId,
    params.cgpHash,
    String(params.week),
  ]);
}

export function settlementApprovalPreimage(params: {
  approvalId: string;
  settlementId: string;
  scope: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt?: string;
}): Buffer {
  return preimage('settlement.operator_approval', [
    params.approvalId,
    params.settlementId,
    params.scope,
    params.approvedBy,
    params.approvedAt,
    opt(params.expiresAt),
  ]);
}
