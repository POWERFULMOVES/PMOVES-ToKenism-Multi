/**
 * Firefly Settlement Executor
 *
 * Consumes signed Tokenism settlement batches and maps Firefly-lane
 * instructions into Firefly transaction drafts. Dry-run mode is the default
 * and never calls Firefly.
 */

import type {
  SettlementAction,
  SettlementInstruction,
  SettlementRequestedEvent,
  SettlementSignature,
} from '../contracts/settlement-planner';
import type {
  SettlementExecutionResultEvents,
  SettlementFailedEvent,
  SettlementRecordedEvent,
} from '../contracts/settlement-results';
import {
  validateSettlementDeploymentAttestation,
  type SettlementDeploymentAttestation,
} from '../contracts/settlement-deployment-attestation';

export type {
  SettlementFailedEvent,
  SettlementRecordedEvent,
} from '../contracts/settlement-results';

export type FireflyTransactionType = 'withdrawal' | 'deposit' | 'transfer';

export interface FireflyTransactionInput {
  type: FireflyTransactionType;
  date: Date;
  amount: number;
  description: string;
  sourceId?: string;
  destinationId?: string;
  sourceName?: string;
  destinationName?: string;
  category?: string;
  budget?: string;
}

export interface FireflyWritableClient {
  createTransaction(data: FireflyTransactionInput): Promise<unknown>;
}

export interface SettlementOperatorApproval {
  approval_id: string;
  settlement_id: string;
  scope: 'firefly_live_execution';
  approved_by: string;
  approved_at: string;
  expires_at?: string;
  signature: SettlementSignature;
}

export interface FireflySettlementExecutorConfig {
  dryRun?: boolean;
  sourceName?: string;
  destinationNamePrefix?: string;
  categoryPrefix?: string;
  executorAgentId?: string;
  executorSignature?: SettlementSignature;
  retryableErrors?: boolean;
  requireOperatorApproval?: boolean;
  operatorApproval?: SettlementOperatorApproval;
  trustedExecutorIds?: string[];
  deploymentAttestation?: SettlementDeploymentAttestation;
  requireDeploymentAttestation?: boolean;
}

interface ResolvedFireflySettlementExecutorConfig {
  dryRun: boolean;
  sourceName: string;
  destinationNamePrefix: string;
  categoryPrefix: string;
  executorAgentId: string;
  executorSignature: SettlementSignature;
  retryableErrors: boolean;
  requireOperatorApproval: boolean;
  operatorApproval?: SettlementOperatorApproval;
  trustedExecutorIds: string[];
  deploymentAttestation?: SettlementDeploymentAttestation;
  requireDeploymentAttestation: boolean;
}

export interface FireflySettlementDraft {
  settlement_id: string;
  instruction_id: string;
  idempotency_key: string;
  transaction: FireflyTransactionInput;
  metadata: {
    action: SettlementAction;
    asset: string;
    address: string;
    cgp_hash: string;
  };
}

export interface FireflySettlementSkip {
  instruction_id: string;
  idempotency_key: string;
  lane: string;
  reason: string;
}

export interface FireflySettlementExecutionResult extends SettlementExecutionResultEvents {
  settlement_id: string;
  dry_run: boolean;
  requested: number;
  processed: number;
  skipped: FireflySettlementSkip[];
  drafts: FireflySettlementDraft[];
}

const DEFAULT_SOURCE_NAME = 'Tokenism Settlement Pool';
const DEFAULT_DESTINATION_PREFIX = 'Tokenism Member';
const DEFAULT_CATEGORY_PREFIX = 'Tokenism';

export class FireflySettlementExecutor {
  private client?: FireflyWritableClient;
  private config: ResolvedFireflySettlementExecutorConfig;

  constructor(
    client?: FireflyWritableClient,
    config: FireflySettlementExecutorConfig = {}
  ) {
    this.client = client;
    this.config = {
      dryRun: config.dryRun ?? true,
      sourceName: config.sourceName ?? DEFAULT_SOURCE_NAME,
      destinationNamePrefix: config.destinationNamePrefix ?? DEFAULT_DESTINATION_PREFIX,
      categoryPrefix: config.categoryPrefix ?? DEFAULT_CATEGORY_PREFIX,
      executorAgentId: config.executorAgentId ?? '',
      executorSignature: config.executorSignature ?? { alg: '', kid: '', hmac: '' },
      retryableErrors: config.retryableErrors ?? true,
      requireOperatorApproval: config.requireOperatorApproval ?? true,
      operatorApproval: config.operatorApproval,
      trustedExecutorIds: config.trustedExecutorIds ?? [],
      deploymentAttestation: config.deploymentAttestation,
      requireDeploymentAttestation: config.requireDeploymentAttestation ?? true,
    };
  }

  async execute(
    request: SettlementRequestedEvent
  ): Promise<FireflySettlementExecutionResult> {
    validateRequest(request);

    if (!this.config.dryRun && !this.client) {
      throw new Error('Firefly client is required when dryRun=false');
    }

    if (!this.config.dryRun) {
      this.validateLiveExecutionGate(request);
    }

    const seen = new Set<string>();
    const drafts: FireflySettlementDraft[] = [];
    const skipped: FireflySettlementSkip[] = [];
    const recorded: SettlementRecordedEvent[] = [];
    const failed: SettlementFailedEvent[] = [];

    for (const instruction of request.instructions) {
      if (seen.has(instruction.idempotency_key)) {
        throw new Error(`Duplicate settlement idempotency key: ${instruction.idempotency_key}`);
      }
      seen.add(instruction.idempotency_key);

      if (instruction.lane !== 'firefly') {
        skipped.push({
          instruction_id: instruction.instruction_id,
          idempotency_key: instruction.idempotency_key,
          lane: instruction.lane,
          reason: 'not a Firefly-lane instruction',
        });
        continue;
      }

      const draft = this.createDraft(request, instruction);
      drafts.push(draft);

      if (this.config.dryRun) {
        continue;
      }

      try {
        const response = await this.client!.createTransaction(draft.transaction);
        recorded.push(this.createRecordedEvent(request, instruction, response));
      } catch (error) {
        failed.push(this.createFailedEvent(request, instruction, error));
      }
    }

    return {
      settlement_id: request.settlement_id,
      dry_run: this.config.dryRun,
      requested: request.instructions.length,
      processed: drafts.length,
      skipped,
      drafts,
      recorded,
      failed,
    };
  }

  createDraft(
    request: SettlementRequestedEvent,
    instruction: SettlementInstruction
  ): FireflySettlementDraft {
    if (instruction.lane !== 'firefly') {
      throw new Error(`Cannot create Firefly draft for lane: ${instruction.lane}`);
    }

    const fireflyMeta = instruction.firefly || {};
    const transactionType =
      asTransactionType(fireflyMeta.transaction_type) ||
      defaultTransactionType(instruction.action);
    const destinationName =
      asString(fireflyMeta.destination_name) ||
      `${this.config.destinationNamePrefix}: ${instruction.address}`;
    const sourceName = asString(fireflyMeta.source_name) || this.config.sourceName;
    const category =
      asString(fireflyMeta.category_name) ||
      `${this.config.categoryPrefix}:${instruction.action}`;
    const budget = asString(fireflyMeta.budget_name);

    return {
      settlement_id: request.settlement_id,
      instruction_id: instruction.instruction_id,
      idempotency_key: instruction.idempotency_key,
      transaction: {
        type: transactionType,
        date: parseDate(request.created_at),
        amount: instruction.amount,
        description: this.descriptionFor(request, instruction),
        sourceName,
        destinationName,
        category,
        budget,
      },
      metadata: {
        action: instruction.action,
        asset: instruction.asset,
        address: instruction.address,
        cgp_hash: instruction.source_ref.cgp_hash,
      },
    };
  }

  private createRecordedEvent(
    request: SettlementRequestedEvent,
    instruction: SettlementInstruction,
    response: unknown
  ): SettlementRecordedEvent {
    return {
      settlement_id: request.settlement_id,
      instruction_id: instruction.instruction_id,
      idempotency_key: instruction.idempotency_key,
      lane: 'firefly',
      action: instruction.action,
      status: 'recorded',
      amount: instruction.amount,
      asset: instruction.asset,
      firefly_transaction_id: extractTransactionId(response),
      timestamp: new Date().toISOString(),
      agent_id: this.executorAgentId(request),
      signature: this.executorSignature(request),
      metadata: {
        source_subject: request.source_subject,
        cgp_hash: request.cgp_hash,
        deployment_manifest_id: this.config.deploymentAttestation?.manifest_id,
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
      lane: 'firefly',
      action: instruction.action,
      error_code: 'FIREFLY_WRITE_FAILED',
      error_message: errorMessage(error),
      retryable: this.config.retryableErrors,
      timestamp: new Date().toISOString(),
      agent_id: this.executorAgentId(request),
      signature: this.executorSignature(request),
      metadata: {
        source_subject: request.source_subject,
        cgp_hash: request.cgp_hash,
        deployment_manifest_id: this.config.deploymentAttestation?.manifest_id,
        operator_approval_id: this.config.operatorApproval?.approval_id,
      },
    };
  }

  private executorAgentId(request: SettlementRequestedEvent): string {
    return this.config.executorAgentId || request.agent_id;
  }

  private executorSignature(request: SettlementRequestedEvent): SettlementSignature {
    return this.config.executorSignature.hmac ? this.config.executorSignature : request.signature;
  }

  private validateLiveExecutionGate(request: SettlementRequestedEvent): void {
    const executorAgentId = this.config.executorAgentId;
    const executorSignature = this.config.executorSignature;

    if (!executorAgentId) {
      throw new Error('Live Firefly settlement requires executorAgentId');
    }

    if (!isSigned(executorSignature)) {
      throw new Error('Live Firefly settlement requires executorSignature');
    }

    if (
      this.config.trustedExecutorIds.length > 0 &&
      !this.config.trustedExecutorIds.includes(executorAgentId)
    ) {
      throw new Error(`Live Firefly settlement executor is not trusted: ${executorAgentId}`);
    }

    if (this.config.requireOperatorApproval) {
      const approval = this.config.operatorApproval;
      if (!approval) {
        throw new Error('Live Firefly settlement requires operator approval');
      }

      if (approval.settlement_id !== request.settlement_id) {
        throw new Error('Operator approval settlement_id does not match request');
      }

      if (approval.scope !== 'firefly_live_execution') {
        throw new Error(`Operator approval scope is invalid: ${approval.scope}`);
      }

      if (!approval.approved_by) {
        throw new Error('Operator approval must include approved_by');
      }

      if (!isSigned(approval.signature)) {
        throw new Error('Operator approval must be signed');
      }

      parseDate(approval.approved_at);
      if (approval.expires_at && parseDate(approval.expires_at).getTime() < Date.now()) {
        throw new Error('Operator approval has expired');
      }
    }

    if (this.config.requireDeploymentAttestation) {
      validateSettlementDeploymentAttestation(this.config.deploymentAttestation, {
        requireFirefly: true,
      });
    }
  }

  private descriptionFor(
    request: SettlementRequestedEvent,
    instruction: SettlementInstruction
  ): string {
    return [
      'Tokenism settlement',
      request.settlement_profile,
      `week ${request.week}`,
      instruction.action,
      instruction.instruction_id,
    ].join(' | ');
  }
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

function defaultTransactionType(action: SettlementAction): FireflyTransactionType {
  switch (action) {
    case 'foodusd_transfer':
    case 'group_purchase_settle':
      return 'transfer';
    case 'vault_stake':
    case 'governance_record':
      return 'withdrawal';
    case 'grotoken_mint':
    case 'reward_distribute':
      return 'deposit';
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

function asTransactionType(value: unknown): FireflyTransactionType | undefined {
  return value === 'withdrawal' || value === 'deposit' || value === 'transfer'
    ? value
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parseDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Invalid settlement created_at timestamp: ${value}`);
  }

  return date;
}

function extractTransactionId(response: unknown): string | undefined {
  if (!isRecord(response)) {
    return undefined;
  }

  if (typeof response.id === 'string') {
    return response.id;
  }

  if (isRecord(response.data) && typeof response.data.id === 'string') {
    return response.data.id;
  }

  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
