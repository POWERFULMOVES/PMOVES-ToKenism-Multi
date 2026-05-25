/**
 * Contract Settlement Executor
 *
 * Builds contract-lane settlement calls from signed Tokenism settlement batches.
 * Dry-run is the default. Live submission requires a deployment manifest,
 * explicit signed executor identity, and matching signed operator approval.
 */

import { parseUnits } from 'ethers';
import type {
  SettlementAction,
  SettlementInstruction,
  SettlementRequestedEvent,
  SettlementSignature,
} from './settlement-planner';
import type {
  SettlementExecutionResultEvents,
  SettlementFailedEvent,
  SettlementRecordedEvent,
} from './settlement-results';

export type SettlementContractName =
  | 'GroToken'
  | 'FoodUSD'
  | 'GroupPurchase'
  | 'GroVault'
  | 'CoopGovernor'
  | 'SettlementExecutor';

export interface ContractDeploymentEntry {
  address: string;
  abi?: unknown[];
  deployed_at_block?: number;
  deployment_tx_hash?: string;
  version?: string;
}

export interface ContractDeploymentManifest {
  chain_id: number;
  network: string;
  contracts: Partial<Record<SettlementContractName, ContractDeploymentEntry>>;
  generated_at?: string;
}

export interface ContractSettlementOperatorApproval {
  approval_id: string;
  settlement_id: string;
  scope: 'contract_live_execution';
  approved_by: string;
  approved_at: string;
  expires_at?: string;
  signature: SettlementSignature;
}

export interface ContractWritableClient {
  executeContractCall(call: ContractSettlementCall): Promise<unknown>;
}

export interface ContractSettlementExecutorConfig {
  dryRun?: boolean;
  executorAgentId?: string;
  executorSignature?: SettlementSignature;
  retryableErrors?: boolean;
  requireOperatorApproval?: boolean;
  operatorApproval?: ContractSettlementOperatorApproval;
  trustedExecutorIds?: string[];
  deploymentManifest?: ContractDeploymentManifest;
  assetDecimals?: Record<string, number>;
}

interface ResolvedContractSettlementExecutorConfig {
  dryRun: boolean;
  executorAgentId: string;
  executorSignature: SettlementSignature;
  retryableErrors: boolean;
  requireOperatorApproval: boolean;
  operatorApproval?: ContractSettlementOperatorApproval;
  trustedExecutorIds: string[];
  deploymentManifest?: ContractDeploymentManifest;
  assetDecimals: Record<string, number>;
}

export interface ContractSettlementCall {
  settlement_id: string;
  instruction_id: string;
  idempotency_key: string;
  chain_id: number;
  network: string;
  to: string;
  contract: SettlementContractName;
  method: string;
  args: unknown[];
  metadata: {
    action: SettlementAction;
    asset: string;
    amount: number;
    amount_units: string;
    address: string;
    cgp_hash: string;
  };
}

export interface ContractSettlementSkip {
  instruction_id: string;
  idempotency_key: string;
  lane: string;
  reason: string;
}

export interface ContractSettlementExecutionResult extends SettlementExecutionResultEvents {
  dry_run: boolean;
  requested: number;
  processed: number;
  skipped: ContractSettlementSkip[];
  calls: ContractSettlementCall[];
}

const DEFAULT_ASSET_DECIMALS: Record<string, number> = {
  GRO: 18,
  FUSD: 18,
};

const ZERO_SIGNATURE: SettlementSignature = { alg: '', kid: '', hmac: '' };

export class ContractSettlementExecutor {
  private client?: ContractWritableClient;
  private config: ResolvedContractSettlementExecutorConfig;

  constructor(
    client?: ContractWritableClient,
    config: ContractSettlementExecutorConfig = {}
  ) {
    this.client = client;
    this.config = {
      dryRun: config.dryRun ?? true,
      executorAgentId: config.executorAgentId ?? '',
      executorSignature: config.executorSignature ?? ZERO_SIGNATURE,
      retryableErrors: config.retryableErrors ?? true,
      requireOperatorApproval: config.requireOperatorApproval ?? true,
      operatorApproval: config.operatorApproval,
      trustedExecutorIds: config.trustedExecutorIds ?? [],
      deploymentManifest: config.deploymentManifest,
      assetDecimals: { ...DEFAULT_ASSET_DECIMALS, ...(config.assetDecimals ?? {}) },
    };
  }

  async execute(
    request: SettlementRequestedEvent
  ): Promise<ContractSettlementExecutionResult> {
    validateRequest(request);
    const manifest = this.requireManifest();

    if (!this.config.dryRun && !this.client) {
      throw new Error('Contract client is required when dryRun=false');
    }

    if (!this.config.dryRun) {
      this.validateLiveExecutionGate(request);
    }

    const seen = new Set<string>();
    const calls: ContractSettlementCall[] = [];
    const skipped: ContractSettlementSkip[] = [];
    const recorded: SettlementRecordedEvent[] = [];
    const failed: SettlementFailedEvent[] = [];

    for (const instruction of request.instructions) {
      if (seen.has(instruction.idempotency_key)) {
        throw new Error(`Duplicate settlement idempotency key: ${instruction.idempotency_key}`);
      }
      seen.add(instruction.idempotency_key);

      if (instruction.lane !== 'contract') {
        skipped.push({
          instruction_id: instruction.instruction_id,
          idempotency_key: instruction.idempotency_key,
          lane: instruction.lane,
          reason: 'not a contract-lane instruction',
        });
        continue;
      }

      const call = this.createCall(request, instruction, manifest);
      calls.push(call);

      if (this.config.dryRun) {
        continue;
      }

      try {
        const response = await this.client!.executeContractCall(call);
        recorded.push(this.createRecordedEvent(request, instruction, call, response));
      } catch (error) {
        failed.push(this.createFailedEvent(request, instruction, error));
      }
    }

    return {
      settlement_id: request.settlement_id,
      dry_run: this.config.dryRun,
      requested: request.instructions.length,
      processed: calls.length,
      skipped,
      calls,
      recorded,
      failed,
    };
  }

  createCall(
    request: SettlementRequestedEvent,
    instruction: SettlementInstruction,
    manifest: ContractDeploymentManifest = this.requireManifest()
  ): ContractSettlementCall {
    if (instruction.lane !== 'contract') {
      throw new Error(`Cannot create contract call for lane: ${instruction.lane}`);
    }

    const target = this.resolveTarget(instruction);
    const deployment = manifest.contracts[target.contract];
    if (!deployment) {
      throw new Error(`Deployment manifest missing contract: ${target.contract}`);
    }

    assertAddress(deployment.address, `deployment ${target.contract}.address`);
    const amountUnits = this.amountUnits(instruction);

    return {
      settlement_id: request.settlement_id,
      instruction_id: instruction.instruction_id,
      idempotency_key: instruction.idempotency_key,
      chain_id: manifest.chain_id,
      network: manifest.network,
      to: deployment.address,
      contract: target.contract,
      method: target.method,
      args: target.args(instruction, amountUnits),
      metadata: {
        action: instruction.action,
        asset: instruction.asset,
        amount: instruction.amount,
        amount_units: amountUnits,
        address: instruction.address,
        cgp_hash: instruction.source_ref.cgp_hash,
      },
    };
  }

  private resolveTarget(instruction: SettlementInstruction): {
    contract: SettlementContractName;
    method: string;
    args: (instruction: SettlementInstruction, amountUnits: string) => unknown[];
  } {
    const contractMeta = instruction.contract || {};
    const explicitContract = asContractName(contractMeta.contract);
    const explicitMethod = asString(contractMeta.method);

    if (explicitContract && explicitMethod && explicitContract !== 'SettlementExecutor') {
      if (explicitContract === 'GroupPurchase' && explicitMethod === 'execute') {
        const orderId = contractMeta.order_id;
        if (!isNonNegativeInteger(orderId)) {
          throw new Error('group_purchase_settle requires contract.order_id');
        }
        return {
          contract: explicitContract,
          method: explicitMethod,
          args: () => [orderId],
        };
      }

      return {
        contract: explicitContract,
        method: explicitMethod,
        args: (entry, amountUnits) => defaultArgs(entry, explicitMethod, amountUnits),
      };
    }

    switch (instruction.action) {
      case 'grotoken_mint':
      case 'reward_distribute':
        return {
          contract: 'GroToken',
          method: 'mint',
          args: (entry, amountUnits) => [entry.address, amountUnits],
        };
      case 'foodusd_transfer':
        return {
          contract: 'FoodUSD',
          method: 'transfer',
          args: (entry, amountUnits) => [entry.address, amountUnits],
        };
      case 'group_purchase_settle': {
        const orderId = contractMeta.order_id;
        if (!isNonNegativeInteger(orderId)) {
          throw new Error('group_purchase_settle requires contract.order_id');
        }
        return {
          contract: 'GroupPurchase',
          method: 'execute',
          args: () => [orderId],
        };
      }
      case 'vault_stake':
      case 'governance_record':
        throw new Error(`${instruction.action} requires an explicit non-SettlementExecutor contract mapping`);
      default: {
        const exhaustive: never = instruction.action;
        return exhaustive;
      }
    }
  }

  private amountUnits(instruction: SettlementInstruction): string {
    const decimals = this.config.assetDecimals[instruction.asset] ?? 18;
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30) {
      throw new Error(`Invalid decimals for asset ${instruction.asset}: ${decimals}`);
    }

    return parseUnits(instruction.amount.toString(), decimals).toString();
  }

  private createRecordedEvent(
    request: SettlementRequestedEvent,
    instruction: SettlementInstruction,
    call: ContractSettlementCall,
    response: unknown
  ): SettlementRecordedEvent {
    return {
      settlement_id: request.settlement_id,
      instruction_id: instruction.instruction_id,
      idempotency_key: instruction.idempotency_key,
      lane: 'contract',
      action: instruction.action,
      status: 'recorded',
      amount: instruction.amount,
      asset: instruction.asset,
      tx_hash: extractTxHash(response),
      timestamp: new Date().toISOString(),
      agent_id: this.config.executorAgentId,
      signature: this.config.executorSignature,
      metadata: {
        source_subject: request.source_subject,
        cgp_hash: request.cgp_hash,
        chain_id: call.chain_id,
        network: call.network,
        contract: call.contract,
        method: call.method,
        operator_approval_id: this.config.operatorApproval?.approval_id,
      },
    };
  }

  private createFailedEvent(
    request: SettlementRequestedEvent,
    instruction: SettlementInstruction,
    error: unknown
  ): SettlementFailedEvent {
    return {
      settlement_id: request.settlement_id,
      instruction_id: instruction.instruction_id,
      idempotency_key: instruction.idempotency_key,
      lane: 'contract',
      action: instruction.action,
      error_code: 'CONTRACT_WRITE_FAILED',
      error_message: errorMessage(error),
      retryable: this.config.retryableErrors,
      timestamp: new Date().toISOString(),
      agent_id: this.config.executorAgentId,
      signature: this.config.executorSignature,
      metadata: {
        source_subject: request.source_subject,
        cgp_hash: request.cgp_hash,
        operator_approval_id: this.config.operatorApproval?.approval_id,
      },
    };
  }

  private requireManifest(): ContractDeploymentManifest {
    const manifest = this.config.deploymentManifest;
    if (!manifest) {
      throw new Error('Contract deployment manifest is required');
    }

    validateManifest(manifest);
    return manifest;
  }

  private validateLiveExecutionGate(request: SettlementRequestedEvent): void {
    if (!this.config.executorAgentId) {
      throw new Error('Live contract settlement requires executorAgentId');
    }

    if (!isSigned(this.config.executorSignature)) {
      throw new Error('Live contract settlement requires executorSignature');
    }

    if (
      this.config.trustedExecutorIds.length > 0 &&
      !this.config.trustedExecutorIds.includes(this.config.executorAgentId)
    ) {
      throw new Error(`Live contract settlement executor is not trusted: ${this.config.executorAgentId}`);
    }

    if (!this.config.requireOperatorApproval) {
      return;
    }

    const approval = this.config.operatorApproval;
    if (!approval) {
      throw new Error('Live contract settlement requires operator approval');
    }

    if (approval.settlement_id !== request.settlement_id) {
      throw new Error('Contract operator approval settlement_id does not match request');
    }

    if (approval.scope !== 'contract_live_execution') {
      throw new Error(`Contract operator approval scope is invalid: ${approval.scope}`);
    }

    if (!approval.approved_by) {
      throw new Error('Contract operator approval must include approved_by');
    }

    if (!isSigned(approval.signature)) {
      throw new Error('Contract operator approval must be signed');
    }

    parseDate(approval.approved_at);
    if (approval.expires_at && parseDate(approval.expires_at).getTime() < Date.now()) {
      throw new Error('Contract operator approval has expired');
    }
  }
}

export function validateManifest(manifest: ContractDeploymentManifest): void {
  if (!Number.isInteger(manifest.chain_id) || manifest.chain_id <= 0) {
    throw new Error('Deployment manifest chain_id must be a positive integer');
  }

  if (!manifest.network) {
    throw new Error('Deployment manifest network is required');
  }

  if (!manifest.contracts || Object.keys(manifest.contracts).length === 0) {
    throw new Error('Deployment manifest must include contracts');
  }

  for (const [name, entry] of Object.entries(manifest.contracts)) {
    if (!entry) continue;
    assertAddress(entry.address, `deployment ${name}.address`);
  }
}

function defaultArgs(
  instruction: SettlementInstruction,
  method: string,
  amountUnits: string
): unknown[] {
  if (method === 'mint' || method === 'transfer') {
    return [instruction.address, amountUnits];
  }

  return [instruction.idempotency_key, instruction.address, amountUnits, instruction.source_ref.cgp_hash];
}

function validateRequest(request: SettlementRequestedEvent): void {
  if (!isSigned(request.signature)) {
    throw new Error('Settlement request must be signed');
  }

  if (!request.instructions.length) {
    throw new Error('Settlement request must contain instructions');
  }
}

function isSigned(signature: SettlementSignature | undefined): signature is SettlementSignature {
  return Boolean(signature?.alg && signature.kid && signature.hmac);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asContractName(value: unknown): SettlementContractName | undefined {
  if (
    value === 'GroToken' ||
    value === 'FoodUSD' ||
    value === 'GroupPurchase' ||
    value === 'GroVault' ||
    value === 'CoopGovernor' ||
    value === 'SettlementExecutor'
  ) {
    return value;
  }

  return undefined;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0;
}

function assertAddress(value: string, field: string): void {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${field} must be a 20-byte hex address`);
  }
}

function parseDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Invalid contract approval timestamp: ${value}`);
  }

  return date;
}

function extractTxHash(response: unknown): string | undefined {
  if (!isRecord(response)) {
    return undefined;
  }

  if (typeof response.hash === 'string') {
    return response.hash;
  }

  if (typeof response.transactionHash === 'string') {
    return response.transactionHash;
  }

  if (isRecord(response.receipt) && typeof response.receipt.hash === 'string') {
    return response.receipt.hash;
  }

  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
