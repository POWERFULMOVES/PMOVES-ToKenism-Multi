/**
 * PMOVES Smart Contract Models
 * Export all contract models and coordinator
 */

// GroToken
export {
  GroTokenDistribution,
  GroTokenConfig,
  TokenHolder,
  DistributionEvent,
} from './grotoken-model';

// FoodUSD
export {
  FoodUSDModel,
  FoodUSDConfig,
  FoodUSDHolder,
  SpendingTransaction,
} from './foodusd-model';

// GroupPurchase
export {
  GroupPurchaseModel,
  GroupPurchaseConfig,
  GroupOrder,
  Contribution,
  SavingsResult,
} from './grouppurchase-model';

// GroVault
export {
  GroVaultModel,
  GroVaultConfig,
  LockPosition,
  StakingEvent,
} from './grovault-model';

// CoopGovernor
export {
  CoopGovernorModel,
  GovernanceConfig,
  Proposal,
  Vote,
  ProposalResult,
} from './coopgovernor-model';

// RewardsPool (Phase 5)
export {
  RewardsPoolModel,
  RewardsPoolConfig,
  RewardsClaim,
  RewardsPoolStats,
  RewardsEvent,
} from './rewardspool-model';

// LoyaltyPoints (Phase 5)
export {
  LoyaltyPointsModel,
  LoyaltyConfig,
  LoyaltyAccount,
  LoyaltyEvent,
  LoyaltyStats,
} from './loyaltypoints-model';

// Contract Coordinator
export {
  ContractCoordinator,
  ContractCoordinatorConfig,
  PopulationConfig,
  WeeklySimulationData,
} from './contract-coordinator';

// Event Listeners (from Phase 1)
export {
  ContractEventListener,
  ContractConfig,
  NetworkConfig,
} from './contract-listeners';

// Settlement Planner
export {
  planTokenSettlement,
  createSettlementRequestedEvent,
  SettlementAction,
  SettlementBatch,
  SettlementInstruction,
  SettlementLane,
  SettlementPlannerConfig,
  SettlementRequestedEvent,
  SettlementSignature,
} from './settlement-planner';

// Settlement signature verification.
// Consumers MUST configure a keyring or every settlement gate fails closed, so
// the keyring API has to be reachable from the package entry point rather than
// through a deep path import.
export {
  SETTLEMENT_DOMAIN,
  InMemorySettlementKeyring,
  SettlementKeyring,
  SettlementSignatureAlgorithm,
  SettlementSignaturePurpose,
  SettlementVerifyResult,
  ExecutorPreimageParams,
  assertSettlementSignature,
  contractExecutorPreimage,
  deploymentApprovalPreimage,
  deploymentAttestationPreimage,
  hasSettlementProof,
  registerSettlementAlgorithm,
  settlementApprovalPreimage,
  settlementExecutorPreimage,
  settlementRequestPreimage,
  signSettlement,
  supportedSettlementAlgorithms,
  verifySettlementSignature,
} from './settlement-signature';

export {
  SettlementExecutionResultEvents,
  SettlementFailedEvent,
  SettlementRecordedEvent,
} from './settlement-results';

export {
  SettlementDeploymentApproval,
  SettlementDeploymentAttestation,
  SettlementDeploymentAttestationValidationOptions,
  SettlementFireflyBinding,
  SettlementWalletCustody,
  validateSettlementDeploymentAttestation,
} from './settlement-deployment-attestation';

export {
  ContractDeploymentEntry,
  ContractDeploymentManifest,
  ContractSettlementCall,
  ContractSettlementExecutionResult,
  ContractSettlementExecutor,
  ContractSettlementExecutorConfig,
  ContractSettlementOperatorApproval,
  ContractSettlementSkip,
  ContractWritableClient,
  SettlementContractName,
  validateManifest,
} from './contract-settlement-executor';

export {
  toContractDeploymentManifest,
  validateTokenismActivationPack,
  TokenismActivationDryRunEvidence,
  TokenismActivationIncidentContact,
  TokenismActivationLane,
  TokenismActivationPack,
  TokenismActivationPackValidationOptions,
  TokenismActivationRollbackPlan,
} from './tokenism-activation-pack';
