// contracts/settlement-signature.ts
// Real MAC verification for the settlement money path — BOTH executors on it
// (firefly/settlement-executor.ts and contracts/contract-settlement-executor.ts)
// plus the deployment attestation that gates them.
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
  | 'settlement.operator_approval'
  // The contract lane is a SECOND executor on the same money path. It gets its
  // own executor tag so a Firefly executor identity cannot be replayed to
  // authorise an on-chain execution of the same settlement, or vice versa.
  | 'contract.executor'
  // The deployment manifest that says WHICH chain, WHICH wallet custody and
  // WHICH Firefly instance a live execution is allowed to touch.
  | 'settlement.deployment_attestation'
  | 'settlement.deployment_approval';

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
export interface ExecutorPreimageParams {
  settlementId: string;
  executorAgentId: string;
  cgpHash: string;
  week: number;
}

function executorPreimage(
  purpose: 'settlement.executor' | 'contract.executor',
  params: ExecutorPreimageParams
): Buffer {
  return preimage(purpose, [
    params.settlementId,
    params.executorAgentId,
    params.cgpHash,
    String(params.week),
  ]);
}

// Firefly-lane executor identity.
export function settlementExecutorPreimage(params: ExecutorPreimageParams): Buffer {
  return executorPreimage('settlement.executor', params);
}

// Contract-lane executor identity. Deliberately a SEPARATE exported function
// rather than an optional `purpose` argument on the one above: an optional
// argument is a footgun that silently degrades to cross-lane replay when a
// caller forgets it, whereas a wrong function name is greppable.
export function contractExecutorPreimage(params: ExecutorPreimageParams): Buffer {
  return executorPreimage('contract.executor', params);
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

// The deployment manifest signature. It covers the environment and the RPC /
// custody / Firefly bindings, AND the id list of its own approvals, so an
// attested manifest cannot have an approval added, removed or reordered after
// signing, and cannot be repointed at another chain or another Firefly
// instance while keeping the manifest_id constant.
export function deploymentAttestationPreimage(params: {
  manifestId: string;
  environment: string;
  rpcRef?: string;
  custodyType?: string;
  custodySignerRef?: string;
  custodyPolicyRef?: string;
  custodyOperatorRef?: string;
  fireflyInstanceRef?: string;
  fireflyEnvironment?: string;
  fireflyAccountRef?: string;
  signedAt: string;
  expiresAt?: string;
  approvalIds: string[];
}): Buffer {
  return preimage('settlement.deployment_attestation', [
    params.manifestId,
    params.environment,
    opt(params.rpcRef),
    opt(params.custodyType),
    opt(params.custodySignerRef),
    opt(params.custodyPolicyRef),
    opt(params.custodyOperatorRef),
    opt(params.fireflyInstanceRef),
    opt(params.fireflyEnvironment),
    opt(params.fireflyAccountRef),
    params.signedAt,
    opt(params.expiresAt),
    String(params.approvalIds.length),
    ...params.approvalIds,
  ]);
}

// A deployment approval is bound to the manifest it approves. The approval
// object itself carries no manifest_id field, so the id is supplied by the
// enclosing attestation at verification time — which is strictly stronger than
// a self-declared one: an approval lifted from another manifest verifies
// against that manifest's id and therefore fails here.
export function deploymentApprovalPreimage(params: {
  approvalId: string;
  manifestId: string;
  scope: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt?: string;
}): Buffer {
  return preimage('settlement.deployment_approval', [
    params.approvalId,
    params.manifestId,
    params.scope,
    params.approvedBy,
    params.approvedAt,
    opt(params.expiresAt),
  ]);
}

// ---------------------------------------------------------------------------
// Keyring
// ---------------------------------------------------------------------------

// Key material is INJECTED, never hardcoded and never generated here — the same
// custody stance as tally-signer-ed25519.ts. Whoever holds the settlement key
// holds the authority to move money, and that choice belongs to the deploying
// group, not to this file.
//
// Nothing in this module ever prints, logs, stringifies or embeds key material
// OR key lengths in an error. Rejection reasons name the `kid` and the required
// minimum only — never anything measured from the supplied key.
export interface SettlementKeyring {
  // Returns the secret key for `kid`, or undefined if this keyring does not
  // hold one. Returning undefined must mean REJECT, never "skip the check".
  get(kid: string): Buffer | undefined;
}

export class InMemorySettlementKeyring implements SettlementKeyring {
  private keys = new Map<string, Buffer>();

  constructor(entries: Record<string, Buffer | string> = {}) {
    for (const [kid, key] of Object.entries(entries)) {
      this.set(kid, key);
    }
  }

  // Hex strings are decoded with a canonical-hex guard: Buffer.from(x, 'hex')
  // silently stops at the first non-hex character rather than throwing, so an
  // operator typo could otherwise install a short, weak key without any error.
  set(kid: string, key: Buffer | string): this {
    if (!kid) {
      throw new Error('keyring entry requires a non-empty kid');
    }
    let material: Buffer;
    if (typeof key === 'string') {
      if (!/^[0-9a-fA-F]+$/.test(key) || key.length % 2 !== 0) {
        throw new Error(`key for kid ${kid} must be canonical even-length hex`);
      }
      material = Buffer.from(key, 'hex');
    } else {
      material = key;
    }
    if (material.length < MIN_KEY_BYTES) {
      // The observed length is deliberately NOT reported. It is a property of
      // supplied key material, and the invariant this file states twice (at the
      // keyring contract and at kids()) is that no key material and no key
      // length ever leaves this module. The requirement is enough to act on.
      throw new Error(
        `key for kid ${kid} is shorter than the ${MIN_KEY_BYTES}-byte minimum`
      );
    }
    this.keys.set(kid, material);
    return this;
  }

  get(kid: string): Buffer | undefined {
    return this.keys.get(kid);
  }

  // Diagnostics expose kids only — never key material or key lengths that
  // could narrow a search.
  kids(): string[] {
    return [...this.keys.keys()];
  }
}

const MIN_KEY_BYTES = 32;

// ---------------------------------------------------------------------------
// Algorithm registry — step B's door
// ---------------------------------------------------------------------------

// `alg` is the discriminator. Each algorithm declares which field of the
// signature carries its proof, so `hmac` is NOT hardcoded as the only proof
// field: an Ed25519 algorithm (step B) registers here with proofField 'sig'
// and the gates below need no change.
export interface SettlementSignatureAlgorithm {
  alg: string;
  proofField: string;
  proofBytes: number;
  // Verifies `proof` against `message` for `kid`. Must return false rather
  // than throw for any attacker-controlled input.
  verify(message: Buffer, proof: Buffer, kid: string, keyring: SettlementKeyring): boolean;
  // Optional — present only for algorithms this process can also produce.
  sign?(message: Buffer, kid: string, keyring: SettlementKeyring): Buffer;
}

const HMAC_SHA256: SettlementSignatureAlgorithm = {
  alg: 'hmac-sha256',
  proofField: 'hmac',
  proofBytes: 32,
  verify(message, proof, kid, keyring) {
    const key = keyring.get(kid);
    if (!key) {
      return false;
    }
    const expected = createHmac('sha256', key).update(message).digest();
    // Constant-time. A plain `===` on hex strings leaks the length of the
    // matching prefix through comparison timing, which is enough to forge a
    // MAC byte by byte against an online oracle. Lengths are already equal by
    // the proofBytes guard, but timingSafeEqual throws on a length mismatch so
    // the guard is load-bearing, not decorative.
    return proof.length === expected.length && timingSafeEqual(proof, expected);
  },
  sign(message, kid, keyring) {
    const key = keyring.get(kid);
    if (!key) {
      throw new Error(`no settlement key for kid ${kid}`);
    }
    return createHmac('sha256', key).update(message).digest();
  },
};

const ALGORITHMS = new Map<string, SettlementSignatureAlgorithm>([
  [HMAC_SHA256.alg, HMAC_SHA256],
]);

export function registerSettlementAlgorithm(algorithm: SettlementSignatureAlgorithm): void {
  ALGORITHMS.set(algorithm.alg.toLowerCase(), algorithm);
}

export function supportedSettlementAlgorithms(): string[] {
  return [...ALGORITHMS.keys()].sort();
}

// ---------------------------------------------------------------------------
// Verification — fail closed
// ---------------------------------------------------------------------------

export interface SettlementVerifyResult {
  valid: boolean;
  // Informing, not just a boolean: an operator staring at a refused settlement
  // needs to know WHICH check refused it. Never contains key material.
  reason?: string;
}

// Canonical-hex + exact-length guard, checked BEFORE any Buffer.from(x, 'hex')
// decode — the same smuggling path closed in tally-signer-ed25519.ts. Without
// it, `<valid 64-char proof>z` decodes to the identical bytes as the valid
// proof, silently discarding the trailing garbage instead of rejecting.
// Own-property read. A bare index would consult the prototype chain, so with
// `Object.prototype.hmac` polluted, a signature that OMITS `hmac` inherits one
// and can verify. Settlement events are JSON.parse'd off NATS, i.e. the shape
// of the object is attacker-influenced, so the read must be own-property only.
function readOwnField(source: object, field: string): unknown {
  return Object.prototype.hasOwnProperty.call(source, field)
    ? (source as Record<string, unknown>)[field]
    : undefined;
}

function decodeProof(value: unknown, expectedBytes: number): Buffer | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  if (!/^[0-9a-fA-F]+$/.test(value) || value.length !== expectedBytes * 2) {
    return undefined;
  }
  return Buffer.from(value, 'hex');
}

// EVERY failure path returns { valid: false }. There is no branch on which an
// unrecognised, unkeyed or unparseable signature is treated as acceptable —
// that was the whole defect this module replaces.
export function verifySettlementSignature(
  signature: SettlementSignature | undefined,
  message: Buffer,
  keyring: SettlementKeyring | undefined
): SettlementVerifyResult {
  if (!signature || typeof signature !== 'object') {
    return { valid: false, reason: 'signature is missing' };
  }
  if (typeof signature.alg !== 'string' || !signature.alg) {
    return { valid: false, reason: 'signature.alg is missing' };
  }
  if (typeof signature.kid !== 'string' || !signature.kid) {
    return { valid: false, reason: 'signature.kid is missing' };
  }
  const algorithm = ALGORITHMS.get(signature.alg.toLowerCase());
  if (!algorithm) {
    return {
      valid: false,
      reason: `unsupported signature.alg (supported: ${supportedSettlementAlgorithms().join(', ')})`,
    };
  }
  // A missing keyring is a REJECT, not a bypass. A deployment that forgot to
  // configure keys must fail shut rather than wave every settlement through.
  if (!keyring) {
    return { valid: false, reason: 'no settlement keyring configured' };
  }
  const proof = decodeProof(
    readOwnField(signature, algorithm.proofField),
    algorithm.proofBytes
  );
  if (!proof) {
    return {
      valid: false,
      reason: `signature.${algorithm.proofField} must be ${algorithm.proofBytes * 2} canonical hex characters`,
    };
  }
  if (!keyring.get(signature.kid)) {
    return { valid: false, reason: `unknown signature.kid: ${signature.kid}` };
  }
  let ok = false;
  try {
    ok = algorithm.verify(message, proof, signature.kid, keyring);
  } catch {
    // Any throw from a verifier is a rejection, and the underlying error is
    // deliberately not surfaced — it could carry key-shaped detail.
    return { valid: false, reason: 'signature verification failed' };
  }
  return ok ? { valid: true } : { valid: false, reason: 'signature does not verify' };
}

// STRUCTURAL check only — "does this object carry a proof for its declared
// algorithm", NOT "is this proof valid". Producers use it to refuse to emit an
// obviously unsigned event; it is NEVER a substitute for
// verifySettlementSignature at a gate. Named to say so: `hasProof`, not
// `isSigned`. The old `isSigned()` blurred exactly this line, which is how a
// structural check ended up standing in for a security gate.
export function hasSettlementProof(signature: SettlementSignature | undefined): boolean {
  if (!signature || typeof signature !== 'object') {
    return false;
  }
  if (typeof signature.alg !== 'string' || !signature.alg) {
    return false;
  }
  if (typeof signature.kid !== 'string' || !signature.kid) {
    return false;
  }
  const algorithm = ALGORITHMS.get(signature.alg.toLowerCase());
  if (!algorithm) {
    return false;
  }
  return decodeProof(readOwnField(signature, algorithm.proofField), algorithm.proofBytes) !== undefined;
}

// Throwing wrapper for the gates. `gate` names WHICH gate refused so the three
// call sites stay distinguishable in operator-facing errors.
export function assertSettlementSignature(
  gate: string,
  signature: SettlementSignature | undefined,
  message: Buffer,
  keyring: SettlementKeyring | undefined
): void {
  const result = verifySettlementSignature(signature, message, keyring);
  if (!result.valid) {
    throw new Error(`${gate}: ${result.reason}`);
  }
}

// Produce a signature. Sim/test/ceremony convenience — a production signer may
// live in an HSM or a separate process and only the verify path above is
// required of it.
export function signSettlement(
  message: Buffer,
  kid: string,
  keyring: SettlementKeyring,
  alg: string = HMAC_SHA256.alg
): SettlementSignature {
  const algorithm = ALGORITHMS.get(alg.toLowerCase());
  if (!algorithm || !algorithm.sign) {
    throw new Error(`cannot sign with alg ${alg}`);
  }
  const proof = algorithm.sign(message, kid, keyring);
  return { alg: algorithm.alg, kid, [algorithm.proofField]: proof.toString('hex') } as SettlementSignature;
}
