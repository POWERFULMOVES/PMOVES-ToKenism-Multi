/**
 * Firefly-iii Integration Module
 *
 * Provides integration with Firefly-iii personal finance manager
 * to calibrate PMOVES projections with real financial data
 */

export { FireflyClient } from './firefly-client';
export type {
  FireflyConfig,
  CategorySpending,
  BudgetAnalysis,
  WealthDistribution,
  Transaction,
  SavingsMetrics,
} from './firefly-client';

export { FireflyDataTransformer } from './data-transformer';
export type {
  CategoryMapping,
  WeeklySpending,
  ParticipationMetrics,
  TransformedData,
} from './data-transformer';

export { FireflyIntegration } from './firefly-integration';
export type {
  IntegrationConfig,
  IntegrationResult,
} from './firefly-integration';

export { FireflySettlementExecutor } from './settlement-executor';
export type {
  FireflySettlementDraft,
  FireflySettlementExecutionResult,
  FireflySettlementExecutorConfig,
  FireflySettlementSkip,
  FireflyTransactionInput,
  FireflyTransactionType,
  FireflyWritableClient,
  SettlementFailedEvent,
  SettlementRecordedEvent,
} from './settlement-executor';

export {
  FireflySettlementPublisher,
  TOKENISM_SETTLEMENT_SUBJECTS,
  createFireflySettlementPublisher,
} from './settlement-publisher';
export type {
  FireflySettlementPublisherOptions,
  SettlementPublishClient,
  SettlementPublishSummary,
} from './settlement-publisher';

export { runIntegration } from './run-integration';
