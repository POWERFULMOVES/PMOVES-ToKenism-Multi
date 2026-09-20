import type { SettlementSignature } from './settlement-planner';
import {
  validateSettlementDeploymentAttestation,
  type SettlementDeploymentAttestation,
} from './settlement-deployment-attestation';
import type { SettlementKeyring } from './settlement-signature';
import {
  type ContractDeploymentManifest,
  type SettlementContractName,
  validateManifest,
} from './contract-settlement-executor';

export type TokenismActivationLane = 'firefly' | 'contract';

export interface TokenismActivationDryRunEvidence {
  evidence_id: string;
  lane: TokenismActivationLane;
  settlement_id: string;
  result_ref: string;
  passed: boolean;
  run_at: string;
  reviewed_by: string;
  signature: SettlementSignature;
}

export interface TokenismActivationIncidentContact {
  name: string;
  contact_ref: string;
  role?: string;
}

export interface TokenismActivationRollbackPlan {
  disable_switch: string;
  affected_subjects: string[];
  steps: string[];
  incident_contacts: TokenismActivationIncidentContact[];
}

export interface TokenismActivationPack {
  spec: 'tokenism.activation.pack.v1';
  deployment_manifest_id: string;
  environment: string;
  chain_id: number;
  network: string;
  contract_addresses: Partial<Record<SettlementContractName, string>>;
  rpc_endpoint_ref: string;
  wallet_custody_ref: string;
  firefly_endpoint_ref: string;
  operator_approval_id: string;
  deployment_attestation: SettlementDeploymentAttestation;
  deployment_attestation_sig: SettlementSignature;
  executor_agent_id: string;
  executor_signature: SettlementSignature;
  dry_run_evidence: TokenismActivationDryRunEvidence[];
  rollback_plan: TokenismActivationRollbackPlan;
  created_at: string;
  expires_at?: string;
  signature: SettlementSignature;
}

export interface TokenismActivationPackValidationOptions {
  requireFirefly?: boolean;
  requireContract?: boolean;
  trustedExecutorIds?: string[];
  now?: Date;
  /**
   * Forwarded to the deployment-attestation validator, which now performs real
   * MAC verification and rejects when no keyring is supplied. Validating an
   * activation pack without a keyring therefore fails closed rather than
   * accepting an unverifiable manifest.
   */
  keyring?: SettlementKeyring;
}

const PLACEHOLDER_PATTERN = /^(todo|tbd|placeholder|changeme|change-me|example|sample|unset|none)$/i;
const RAW_URL_PATTERN = /^https?:\/\//i;
const RAW_PRIVATE_KEY_PATTERN = /^0x[a-fA-F0-9]{64}$/;

export function validateTokenismActivationPack(
  pack: TokenismActivationPack,
  options: TokenismActivationPackValidationOptions = {}
): void {
  const requireContract = options.requireContract ?? true;
  const requireFirefly = options.requireFirefly ?? true;

  if (!pack || pack.spec !== 'tokenism.activation.pack.v1') {
    throw new Error('Tokenism activation pack spec must be tokenism.activation.pack.v1');
  }

  requireRealRef(pack.deployment_manifest_id, 'deployment_manifest_id');
  requireRealRef(pack.environment, 'environment');
  requireRealRef(pack.network, 'network');
  requireRealRef(pack.operator_approval_id, 'operator_approval_id');
  requireRealRef(pack.executor_agent_id, 'executor_agent_id');

  if (!Number.isInteger(pack.chain_id) || pack.chain_id <= 0) {
    throw new Error('Tokenism activation pack chain_id must be a positive integer');
  }

  validateRef(pack.rpc_endpoint_ref, 'rpc_endpoint_ref', { rejectUrl: true });
  validateRef(pack.wallet_custody_ref, 'wallet_custody_ref', { rejectPrivateKey: true });
  validateRef(pack.firefly_endpoint_ref, 'firefly_endpoint_ref', { rejectUrl: true });
  validateSignature(pack.deployment_attestation_sig, 'deployment_attestation_sig');
  validateSignature(pack.executor_signature, 'executor_signature');
  validateSignature(pack.signature, 'activation pack signature');
  parseDate(pack.created_at, 'created_at');
  assertNotExpired(pack.expires_at, options.now, 'Tokenism activation pack');

  if (
    options.trustedExecutorIds?.length &&
    !options.trustedExecutorIds.includes(pack.executor_agent_id)
  ) {
    throw new Error(`Tokenism activation executor is not trusted: ${pack.executor_agent_id}`);
  }

  validateSettlementDeploymentAttestation(pack.deployment_attestation, {
    requireRpc: requireContract,
    requireWalletCustody: requireContract,
    requireFirefly,
    now: options.now,
    keyring: options.keyring,
  });

  if (pack.deployment_attestation.manifest_id !== pack.deployment_manifest_id) {
    throw new Error('deployment_manifest_id must match deployment_attestation.manifest_id');
  }

  if (pack.deployment_attestation.environment !== pack.environment) {
    throw new Error('environment must match deployment_attestation.environment');
  }

  if (!pack.deployment_attestation.approvals.some((approval) => approval.approval_id === pack.operator_approval_id)) {
    throw new Error('operator_approval_id must be present in deployment_attestation approvals');
  }

  if (requireContract) {
    requireMatchingRef(
      pack.rpc_endpoint_ref,
      pack.deployment_attestation.rpc_ref,
      'rpc_endpoint_ref',
      'deployment_attestation.rpc_ref'
    );
    requireMatchingRef(
      pack.wallet_custody_ref,
      pack.deployment_attestation.wallet_custody?.signer_ref,
      'wallet_custody_ref',
      'deployment_attestation.wallet_custody.signer_ref'
    );
    validateContractAddresses(pack.contract_addresses);
    validateManifest(toContractDeploymentManifest(pack));
  }

  if (requireFirefly) {
    requireMatchingRef(
      pack.firefly_endpoint_ref,
      pack.deployment_attestation.firefly?.instance_ref,
      'firefly_endpoint_ref',
      'deployment_attestation.firefly.instance_ref'
    );
  }

  if (!signaturesMatch(pack.deployment_attestation_sig, pack.deployment_attestation.signature)) {
    throw new Error('deployment_attestation_sig must match deployment_attestation.signature');
  }

  validateDryRunEvidence(pack.dry_run_evidence, options);
  validateRollbackPlan(pack.rollback_plan);
}

export function toContractDeploymentManifest(
  pack: TokenismActivationPack
): ContractDeploymentManifest {
  return {
    chain_id: pack.chain_id,
    network: pack.network,
    generated_at: pack.created_at,
    attestation: pack.deployment_attestation,
    contracts: Object.fromEntries(
      Object.entries(pack.contract_addresses).map(([name, address]) => [
        name,
        { address: address as string },
      ])
    ) as ContractDeploymentManifest['contracts'],
  };
}

function validateDryRunEvidence(
  evidence: TokenismActivationDryRunEvidence[],
  options: TokenismActivationPackValidationOptions
): void {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    throw new Error('Tokenism activation pack requires dry_run_evidence');
  }

  const lanes = new Set<TokenismActivationLane>();
  for (const item of evidence) {
    requireRealRef(item.evidence_id, 'dry_run_evidence.evidence_id');
    requireRealRef(item.settlement_id, 'dry_run_evidence.settlement_id');
    requireRealRef(item.result_ref, 'dry_run_evidence.result_ref');
    requireRealRef(item.reviewed_by, 'dry_run_evidence.reviewed_by');
    parseDate(item.run_at, 'dry_run_evidence.run_at');
    validateSignature(item.signature, 'dry_run_evidence.signature');

    if (item.lane !== 'firefly' && item.lane !== 'contract') {
      throw new Error(`dry_run_evidence lane is invalid: ${item.lane}`);
    }

    if (!item.passed) {
      throw new Error(`dry_run_evidence did not pass: ${item.evidence_id}`);
    }

    lanes.add(item.lane);
  }

  if ((options.requireFirefly ?? true) && !lanes.has('firefly')) {
    throw new Error('Tokenism activation pack requires Firefly dry-run evidence');
  }

  if ((options.requireContract ?? true) && !lanes.has('contract')) {
    throw new Error('Tokenism activation pack requires contract dry-run evidence');
  }
}

function validateRollbackPlan(plan: TokenismActivationRollbackPlan): void {
  if (!plan) {
    throw new Error('Tokenism activation pack requires rollback_plan');
  }

  requireRealRef(plan.disable_switch, 'rollback_plan.disable_switch');
  requireNonEmptyStringArray(plan.affected_subjects, 'rollback_plan.affected_subjects');
  requireNonEmptyStringArray(plan.steps, 'rollback_plan.steps');

  if (!Array.isArray(plan.incident_contacts) || plan.incident_contacts.length === 0) {
    throw new Error('rollback_plan.incident_contacts must not be empty');
  }

  for (const contact of plan.incident_contacts) {
    requireRealRef(contact.name, 'rollback_plan.incident_contacts.name');
    validateRef(contact.contact_ref, 'rollback_plan.incident_contacts.contact_ref');
  }
}

function validateContractAddresses(
  addresses: Partial<Record<SettlementContractName, string>>
): void {
  if (!addresses || Object.keys(addresses).length === 0) {
    throw new Error('Tokenism activation pack requires contract_addresses');
  }

  for (const [name, address] of Object.entries(addresses)) {
    validateAddress(address, `contract_addresses.${name}`);
  }
}

function requireNonEmptyStringArray(values: string[], field: string): void {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`${field} must not be empty`);
  }

  for (const value of values) {
    requireRealRef(value, field);
  }
}

function validateAddress(value: string | undefined, field: string): void {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${field} must be a 20-byte hex address`);
  }
}

function validateRef(
  value: string | undefined,
  field: string,
  options: { rejectUrl?: boolean; rejectPrivateKey?: boolean } = {}
): void {
  requireRealRef(value, field);

  if (options.rejectUrl && RAW_URL_PATTERN.test(value!)) {
    throw new Error(`${field} must be a secret-managed reference, not a raw URL`);
  }

  if (options.rejectPrivateKey && RAW_PRIVATE_KEY_PATTERN.test(value!)) {
    throw new Error(`${field} must be a custody reference, not a raw private key`);
  }
}

function requireRealRef(value: string | undefined, field: string): void {
  if (!value || PLACEHOLDER_PATTERN.test(value.trim())) {
    throw new Error(`${field} must be a real non-placeholder value`);
  }
}

function requireMatchingRef(
  value: string,
  expected: string | undefined,
  field: string,
  expectedField: string
): void {
  if (value !== expected) {
    throw new Error(`${field} must match ${expectedField}`);
  }
}

function validateSignature(signature: SettlementSignature | undefined, field: string): void {
  if (!signature?.alg || !signature.kid || !signature.hmac) {
    throw new Error(`${field} must be signed`);
  }
}

function signaturesMatch(left: SettlementSignature, right: SettlementSignature): boolean {
  return left.alg === right.alg && left.kid === right.kid && left.hmac === right.hmac;
}

function assertNotExpired(expiresAt: string | undefined, now: Date | undefined, label: string): void {
  if (!expiresAt) return;
  const reference = now ?? new Date();
  if (parseDate(expiresAt, `${label} expires_at`).getTime() < reference.getTime()) {
    throw new Error(`${label} has expired`);
  }
}

function parseDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`${field} must be a valid date-time`);
  }

  return date;
}
