import type { SettlementSignature } from './settlement-planner';
import {
  assertSettlementSignature,
  deploymentApprovalPreimage,
  deploymentAttestationPreimage,
  type SettlementKeyring,
} from './settlement-signature';

export interface SettlementDeploymentApproval {
  approval_id: string;
  scope: 'settlement_deployment_manifest';
  approved_by: string;
  approved_at: string;
  expires_at?: string;
  signature: SettlementSignature;
}

export interface SettlementWalletCustody {
  custody_type: 'local' | 'hardware' | 'vault' | 'mpc' | 'fireblocks' | 'other';
  signer_ref: string;
  policy_ref?: string;
  operator_ref?: string;
}

export interface SettlementFireflyBinding {
  instance_ref: string;
  environment: string;
  account_ref?: string;
}

export interface SettlementDeploymentAttestation {
  manifest_id: string;
  environment: string;
  rpc_ref?: string;
  wallet_custody?: SettlementWalletCustody;
  firefly?: SettlementFireflyBinding;
  approvals: SettlementDeploymentApproval[];
  signed_at: string;
  expires_at?: string;
  signature: SettlementSignature;
}

export interface SettlementDeploymentAttestationValidationOptions {
  requireRpc?: boolean;
  requireWalletCustody?: boolean;
  requireFirefly?: boolean;
  now?: Date;
  /**
   * Keys used to VERIFY the manifest signature and each operator approval on
   * it. There is no default and no bypass: with no keyring this validator
   * rejects. Before this existed, both checks here were the same
   * `Boolean(sig?.alg && sig.kid && sig.hmac)` truthiness test that the money
   * path had already replaced, and this validator sits on the LIVE branch of
   * both executors — so `hmac: 'abc123'` still satisfied a gate on real
   * execution.
   */
  keyring?: SettlementKeyring;
}

export function validateSettlementDeploymentAttestation(
  attestation: SettlementDeploymentAttestation | undefined,
  options: SettlementDeploymentAttestationValidationOptions = {}
): asserts attestation is SettlementDeploymentAttestation {
  if (!attestation) {
    throw new Error('Deployment attestation is required');
  }

  if (!attestation.manifest_id) {
    throw new Error('Deployment attestation manifest_id is required');
  }

  if (!attestation.environment) {
    throw new Error('Deployment attestation environment is required');
  }

  // Structural completeness FIRST, then cryptographic verification. The
  // approval list has to be known before the manifest signature can be
  // checked, because the manifest signature covers the approval ids.
  if (!Array.isArray(attestation.approvals) || attestation.approvals.length === 0) {
    throw new Error('Deployment attestation requires at least one operator approval');
  }

  parseDate(attestation.signed_at, 'Deployment attestation signed_at');
  assertNotExpired(attestation.expires_at, options.now, 'Deployment attestation');

  if (options.requireRpc && !attestation.rpc_ref) {
    throw new Error('Deployment attestation rpc_ref is required');
  }

  if (options.requireWalletCustody) {
    validateWalletCustody(attestation.wallet_custody);
  }

  if (options.requireFirefly) {
    validateFireflyBinding(attestation.firefly);
  }

  assertSettlementSignature(
    'Deployment attestation signature',
    attestation.signature,
    deploymentAttestationPreimage({
      manifestId: attestation.manifest_id,
      environment: attestation.environment,
      rpcRef: attestation.rpc_ref,
      custodyType: attestation.wallet_custody?.custody_type,
      custodySignerRef: attestation.wallet_custody?.signer_ref,
      custodyPolicyRef: attestation.wallet_custody?.policy_ref,
      custodyOperatorRef: attestation.wallet_custody?.operator_ref,
      fireflyInstanceRef: attestation.firefly?.instance_ref,
      fireflyEnvironment: attestation.firefly?.environment,
      fireflyAccountRef: attestation.firefly?.account_ref,
      signedAt: attestation.signed_at,
      expiresAt: attestation.expires_at,
      approvalIds: attestation.approvals.map((approval) => approval?.approval_id),
    }),
    options.keyring
  );

  for (const approval of attestation.approvals) {
    validateDeploymentApproval(approval, attestation.manifest_id, options);
  }
}

function validateWalletCustody(custody: SettlementWalletCustody | undefined): void {
  if (!custody) {
    throw new Error('Deployment attestation wallet_custody is required');
  }

  if (!custody.custody_type) {
    throw new Error('Deployment attestation wallet_custody.custody_type is required');
  }

  if (!custody.signer_ref) {
    throw new Error('Deployment attestation wallet_custody.signer_ref is required');
  }
}

function validateFireflyBinding(binding: SettlementFireflyBinding | undefined): void {
  if (!binding) {
    throw new Error('Deployment attestation firefly binding is required');
  }

  if (!binding.instance_ref) {
    throw new Error('Deployment attestation firefly.instance_ref is required');
  }

  if (!binding.environment) {
    throw new Error('Deployment attestation firefly.environment is required');
  }
}

function validateDeploymentApproval(
  approval: SettlementDeploymentApproval,
  manifestId: string,
  options: SettlementDeploymentAttestationValidationOptions
): void {
  if (!approval || typeof approval !== 'object') {
    throw new Error('Deployment approval is required');
  }

  if (approval.scope !== 'settlement_deployment_manifest') {
    throw new Error(`Deployment approval scope is invalid: ${approval.scope}`);
  }

  if (!approval.approval_id) {
    throw new Error('Deployment approval must include approval_id');
  }

  if (!approval.approved_by) {
    throw new Error('Deployment approval must include approved_by');
  }

  parseDate(approval.approved_at, 'Deployment approval approved_at');
  assertNotExpired(approval.expires_at, options.now, 'Deployment approval');

  // Bound to the manifest it approves, using the ENCLOSING attestation's id
  // rather than a self-declared one, so an approval cannot be lifted from
  // another manifest.
  assertSettlementSignature(
    'Deployment approval signature',
    approval.signature,
    deploymentApprovalPreimage({
      approvalId: approval.approval_id,
      manifestId,
      scope: approval.scope,
      approvedBy: approval.approved_by,
      approvedAt: approval.approved_at,
      expiresAt: approval.expires_at,
    }),
    options.keyring
  );
}

function assertNotExpired(expiresAt: string | undefined, now: Date | undefined, label: string): void {
  if (!expiresAt) {
    return;
  }

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

