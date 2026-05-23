/**
 * Tokenism Settlement Planner
 *
 * Converts a validated CGP attribution document into deterministic settlement
 * instructions. This module plans the Firefly/contract handoff; it does not
 * execute Firefly API calls or blockchain transactions.
 */

import { createHash } from 'crypto';
import type { CGPContributor, CGPDocument } from './chit';

export type SettlementLane = 'firefly' | 'contract' | 'manual';

export type SettlementAction =
  | 'grotoken_mint'
  | 'foodusd_transfer'
  | 'reward_distribute'
  | 'group_purchase_settle'
  | 'vault_stake'
  | 'governance_record';

export interface SettlementSignature {
  alg: string;
  kid: string;
  hmac: string;
  [key: string]: unknown;
}

export interface SettlementPlannerConfig {
  totalRewardPool: number;
  asset?: string;
  lane?: SettlementLane;
  action?: SettlementAction;
  settlementProfile?: string;
  sourceSubject?: string;
  sourceId?: string;
  week?: number;
  precision?: number;
  requireMerkleRoot?: boolean;
  createdAt?: string;
}

export interface SettlementInstruction {
  instruction_id: string;
  idempotency_key: string;
  lane: SettlementLane;
  action: SettlementAction;
  address: string;
  amount: number;
  asset: string;
  source_ref: {
    cgp_hash: string;
    merkle_root?: string;
    contributor_weight: number;
    raw_contribution?: number;
  };
  firefly?: Record<string, unknown>;
  contract?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SettlementBatch {
  settlement_id: string;
  source_subject: string;
  source_id?: string;
  cgp_spec: 'chit.cgp.v0.2' | 'chit.cgp.v1.0';
  cgp_hash: string;
  week: number;
  status: 'planned';
  settlement_profile: string;
  instructions: SettlementInstruction[];
  totals: {
    instruction_count: number;
    amount: number;
    asset: string;
  };
  created_at: string;
}

export interface SettlementRequestedEvent extends SettlementBatch {
  agent_id: string;
  signature: SettlementSignature;
}

interface AggregatedContributor {
  address: string;
  weight: number;
  rawContribution: number;
  merkleRoot?: string;
  categories: Set<string>;
  actionTypes: Set<string>;
}

interface UnitAllocation {
  contributor: AggregatedContributor;
  units: number;
}

const DEFAULT_ASSET = 'GRO';
const DEFAULT_PROFILE = 'weekly-grotoken-v1';
const DEFAULT_SOURCE_SUBJECT = 'tokenism.cgp.weekly.v1';
const SHA256_PREFIX = 'sha256:';

export function planTokenSettlement(
  cgp: CGPDocument,
  config: SettlementPlannerConfig
): SettlementBatch {
  validateConfig(config);

  const settlementProfile = config.settlementProfile || DEFAULT_PROFILE;
  const sourceSubject = config.sourceSubject || DEFAULT_SOURCE_SUBJECT;
  const asset = config.asset || DEFAULT_ASSET;
  const lane = config.lane || 'firefly';
  const action = config.action || 'grotoken_mint';
  const precision = config.precision ?? 6;
  const createdAt = config.createdAt || new Date().toISOString();
  const week = inferWeek(cgp, config.week);
  const cgpSpec = normalizeCgpSpec(cgp.spec);
  const cgpHash = `${SHA256_PREFIX}${sha256(cgp)}`;
  const contributors = aggregateContributors(extractContributors(cgp));

  if (contributors.length === 0) {
    throw new Error('Cannot plan settlement without CGP attribution contributors');
  }

  if (config.requireMerkleRoot && !findMerkleRoot(cgp)) {
    throw new Error('Cannot plan settlement without a CGP Merkle root');
  }

  const allocations = allocateUnits(contributors, config.totalRewardPool, precision);
  const scale = 10 ** precision;
  const instructions = allocations
    .filter((allocation) => allocation.units > 0)
    .map((allocation) => {
      const amount = roundToPrecision(allocation.units / scale, precision);
      return createInstruction({
        allocation,
        amount,
        asset,
        lane,
        action,
        week,
        cgpHash,
        merkleRoot: findMerkleRoot(cgp, allocation.contributor),
        settlementProfile,
      });
    });

  if (instructions.length === 0) {
    throw new Error('Cannot plan settlement with zero payable instructions');
  }

  const amount = roundToPrecision(
    instructions.reduce((sum, instruction) => sum + instruction.amount, 0),
    precision
  );
  const settlementHash = shortHash({
    cgpHash,
    settlementProfile,
    sourceSubject,
    week,
    instructions: instructions.map((instruction) => instruction.idempotency_key),
  });

  return {
    settlement_id: `settlement_${settlementHash}`,
    source_subject: sourceSubject,
    source_id: config.sourceId,
    cgp_spec: cgpSpec,
    cgp_hash: cgpHash,
    week,
    status: 'planned',
    settlement_profile: settlementProfile,
    instructions,
    totals: {
      instruction_count: instructions.length,
      amount,
      asset,
    },
    created_at: createdAt,
  };
}

function normalizeCgpSpec(spec: CGPDocument['spec']): 'chit.cgp.v0.2' | 'chit.cgp.v1.0' {
  if (spec === 'chit.cgp.v0.2' || spec === 'chit.cgp.v1.0') {
    return spec;
  }

  throw new Error(`Unsupported settlement CGP spec: ${spec}`);
}

export function createSettlementRequestedEvent(
  batch: SettlementBatch,
  attestation: { agentId: string; signature: SettlementSignature }
): SettlementRequestedEvent {
  if (!attestation.agentId) {
    throw new Error('Settlement event requires agentId');
  }

  if (!attestation.signature?.hmac) {
    throw new Error('Settlement event requires signature.hmac');
  }

  return {
    ...batch,
    agent_id: attestation.agentId,
    signature: attestation.signature,
  };
}

function validateConfig(config: SettlementPlannerConfig): void {
  if (!Number.isFinite(config.totalRewardPool) || config.totalRewardPool <= 0) {
    throw new Error('totalRewardPool must be a positive finite number');
  }

  if (config.precision !== undefined && (!Number.isInteger(config.precision) || config.precision < 0 || config.precision > 8)) {
    throw new Error('precision must be an integer between 0 and 8');
  }
}

function inferWeek(cgp: CGPDocument, override?: number): number {
  if (override !== undefined) {
    return assertNonNegativeInteger(override, 'week');
  }

  const metaWeek = cgp.meta?.simulation_week;
  if (typeof metaWeek === 'number') {
    return assertNonNegativeInteger(metaWeek, 'meta.simulation_week');
  }

  const attributionWeek = cgp.attribution?.week;
  if (typeof attributionWeek === 'number') {
    return assertNonNegativeInteger(attributionWeek, 'attribution.week');
  }

  throw new Error('Settlement planning requires a week or CGP meta.simulation_week');
}

function assertNonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }

  return value;
}

function extractContributors(cgp: CGPDocument): CGPContributor[] {
  if (cgp.attribution?.contributors?.length) {
    return cgp.attribution.contributors;
  }

  return cgp.super_nodes.flatMap((node) => node.attribution?.contributors || []);
}

function aggregateContributors(contributors: CGPContributor[]): AggregatedContributor[] {
  const byAddress = new Map<string, AggregatedContributor>();

  for (const contributor of contributors) {
    if (!contributor.address) {
      throw new Error('CGP contributor is missing address');
    }

    if (!Number.isFinite(contributor.weight) || contributor.weight < 0) {
      throw new Error(`Invalid contributor weight for ${contributor.address}`);
    }

    const key = contributor.address.toLowerCase();
    const existing = byAddress.get(key) || {
      address: contributor.address,
      weight: 0,
      rawContribution: 0,
      merkleRoot: contributor.proof?.root,
      categories: new Set<string>(),
      actionTypes: new Set<string>(),
    };

    existing.weight += contributor.weight;
    existing.rawContribution += contributor.raw_contribution || 0;
    existing.merkleRoot = existing.merkleRoot || contributor.proof?.root;
    if (contributor.category) existing.categories.add(contributor.category);
    if (contributor.action_type) existing.actionTypes.add(contributor.action_type);
    byAddress.set(key, existing);
  }

  const aggregated = Array.from(byAddress.values()).sort((a, b) => a.address.localeCompare(b.address));
  const totalWeight = aggregated.reduce((sum, contributor) => sum + contributor.weight, 0);

  if (totalWeight <= 0) {
    throw new Error('CGP contributors must have positive total weight');
  }

  return aggregated.map((contributor) => ({
    ...contributor,
    weight: contributor.weight / totalWeight,
  }));
}

function allocateUnits(
  contributors: AggregatedContributor[],
  totalRewardPool: number,
  precision: number
): UnitAllocation[] {
  const scale = 10 ** precision;
  const totalUnits = Math.round(totalRewardPool * scale);

  if (totalUnits <= 0) {
    throw new Error('totalRewardPool is too small for configured precision');
  }

  const allocations = contributors.map((contributor) => {
    const exact = contributor.weight * totalUnits;
    const floor = Math.floor(exact);
    return {
      contributor,
      units: floor,
      remainder: exact - floor,
    };
  });

  let remaining = totalUnits - allocations.reduce((sum, allocation) => sum + allocation.units, 0);
  const byRemainder = [...allocations].sort((a, b) => {
    const remainderDelta = b.remainder - a.remainder;
    return remainderDelta !== 0 ? remainderDelta : a.contributor.address.localeCompare(b.contributor.address);
  });

  for (const allocation of byRemainder) {
    if (remaining <= 0) break;
    allocation.units += 1;
    remaining -= 1;
  }

  return allocations.map(({ contributor, units }) => ({ contributor, units }));
}

function createInstruction(args: {
  allocation: UnitAllocation;
  amount: number;
  asset: string;
  lane: SettlementLane;
  action: SettlementAction;
  week: number;
  cgpHash: string;
  merkleRoot?: string;
  settlementProfile: string;
}): SettlementInstruction {
  const contributor = args.allocation.contributor;
  const hashInput = {
    profile: args.settlementProfile,
    week: args.week,
    address: contributor.address.toLowerCase(),
    amount: args.amount,
    asset: args.asset,
    action: args.action,
    cgpHash: args.cgpHash,
  };
  const instructionHash = shortHash(hashInput);
  const idempotencyHash = shortHash({ ...hashInput, purpose: 'idempotency' });

  return {
    instruction_id: `settle_inst_${instructionHash}`,
    idempotency_key: `tokenism:${args.settlementProfile}:week-${args.week}:${contributor.address.toLowerCase()}:${idempotencyHash}`,
    lane: args.lane,
    action: args.action,
    address: contributor.address,
    amount: args.amount,
    asset: args.asset,
    source_ref: {
      cgp_hash: args.cgpHash,
      merkle_root: args.merkleRoot,
      contributor_weight: roundToPrecision(contributor.weight, 8),
      raw_contribution: roundToPrecision(contributor.rawContribution, 8),
    },
    firefly: {
      transaction_type: 'deposit',
      category: args.action,
      tags: ['tokenism', args.settlementProfile, `week-${args.week}`],
    },
    contract: {
      contract: args.action === 'grotoken_mint' ? 'GroToken' : 'SettlementExecutor',
      method: args.action === 'grotoken_mint' ? 'mint' : 'recordSettlement',
    },
    metadata: {
      categories: Array.from(contributor.categories).sort(),
      action_types: Array.from(contributor.actionTypes).sort(),
    },
  };
}

function findMerkleRoot(
  cgp: CGPDocument,
  contributor?: AggregatedContributor
): string | undefined {
  return (
    contributor?.merkleRoot ||
    cgp.attribution?.merkle_root ||
    cgp.super_nodes.find((node) => node.attribution?.merkle_root)?.attribution?.merkle_root
  );
}

function roundToPrecision(value: number, precision: number): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

function sha256(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function shortHash(value: unknown): string {
  return sha256(value).slice(0, 16);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);

  return `{${entries.join(',')}}`;
}
