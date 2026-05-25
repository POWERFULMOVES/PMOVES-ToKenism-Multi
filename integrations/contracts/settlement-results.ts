import type {
  SettlementAction,
  SettlementLane,
  SettlementSignature,
} from './settlement-planner';

export interface SettlementRecordedEvent {
  settlement_id: string;
  instruction_id: string;
  idempotency_key: string;
  lane: SettlementLane;
  action: SettlementAction;
  status: 'recorded' | 'skipped';
  amount?: number;
  asset?: string;
  firefly_transaction_id?: string;
  tx_hash?: string;
  timestamp: string;
  agent_id: string;
  signature: SettlementSignature;
  metadata?: Record<string, unknown>;
}

export interface SettlementFailedEvent {
  settlement_id: string;
  instruction_id?: string;
  idempotency_key: string;
  lane?: SettlementLane;
  action?: SettlementAction;
  error_code: string;
  error_message: string;
  retryable: boolean;
  timestamp: string;
  agent_id: string;
  signature: SettlementSignature;
  metadata?: Record<string, unknown>;
}

export interface SettlementExecutionResultEvents {
  settlement_id: string;
  recorded: SettlementRecordedEvent[];
  failed: SettlementFailedEvent[];
}
