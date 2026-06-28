import type { SettlementSignature } from './settlement-planner';

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

  if (!isSigned(attestation.signature)) {
    throw new Error('Deployment attestation must be signed');
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

  if (!Array.isArray(attestation.approvals) || attestation.approvals.length === 0) {
    throw new Error('Deployment attestation requires at least one operator approval');
  }

  for (const approval of attestation.approvals) {
    validateDeploymentApproval(approval, options.now);
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
  now: Date | undefined
): void {
  if (approval.scope !== 'settlement_deployment_manifest') {
    throw new Error(`Deployment approval scope is invalid: ${approval.scope}`);
  }

  if (!approval.approved_by) {
    throw new Error('Deployment approval must include approved_by');
  }

  if (!isSigned(approval.signature)) {
    throw new Error('Deployment approval must be signed');
  }

  parseDate(approval.approved_at, 'Deployment approval approved_at');
  assertNotExpired(approval.expires_at, now, 'Deployment approval');
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

function isSigned(signature: SettlementSignature | undefined): signature is SettlementSignature {
  return Boolean(signature?.alg && signature.kid && signature.hmac);
}
