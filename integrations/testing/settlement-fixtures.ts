/**
 * Signed settlement fixtures for tests.
 *
 * NOT a test file (it lives outside __tests__ and is not named *.spec/*.test)
 * so jest does not try to run it as a suite.
 *
 * Every key here is locally constructed, deterministic, test-only material.
 * Nothing in this file reads a real key, an environment variable, or a
 * production keyring, and no key bytes are ever printed.
 *
 * The point of this module is that consumer tests no longer hand-write a
 * placeholder proof. Before it, every settlement fixture in the repo carried
 * `hmac: 'abc123'`, which was both the fixture AND the exploit.
 */
import {
  InMemorySettlementKeyring,
  contractExecutorPreimage,
  deploymentApprovalPreimage,
  deploymentAttestationPreimage,
  settlementApprovalPreimage,
  settlementExecutorPreimage,
  settlementRequestPreimage,
  signSettlement,
  type ExecutorPreimageParams,
} from '../contracts/settlement-signature';
import type {
  SettlementDeploymentApproval,
  SettlementDeploymentAttestation,
} from '../contracts/settlement-deployment-attestation';
import type {
  SettlementBatch,
  SettlementRequestedEvent,
  SettlementSignature,
} from '../contracts/settlement-planner';

export const TEST_REQUEST_KID = 'test-agent-zero';
export const TEST_EXECUTOR_KID = 'test-firefly-exec';
export const TEST_OPERATOR_KID = 'test-operator';
export const TEST_DEPLOYMENT_KID = 'test-deployment-manifest';
export const TEST_UNKNOWN_KID = 'test-kid-not-in-ring';

// Test-only material. Distinct per kid so a cross-kid replay is a real
// negative, not an artefact of every kid sharing one key.
const TEST_KEYS: Record<string, string> = {
  [TEST_REQUEST_KID]: '11'.repeat(32),
  [TEST_EXECUTOR_KID]: '22'.repeat(32),
  [TEST_OPERATOR_KID]: '33'.repeat(32),
  [TEST_DEPLOYMENT_KID]: '44'.repeat(32),
};

export function testKeyring(): InMemorySettlementKeyring {
  return new InMemorySettlementKeyring(TEST_KEYS);
}

/** A structurally valid but WRONG proof: right shape, right length, no key. */
export function forgedSignature(kid: string): SettlementSignature {
  return { alg: 'hmac-sha256', kid, hmac: 'de'.repeat(32) };
}

/** The literal pre-fix placeholder, kept so tests can assert it is refused. */
export function placeholderSignature(kid: string): SettlementSignature {
  return { alg: 'HMAC-SHA256', kid, hmac: 'abc123' };
}

export function signRequest(
  batch: SettlementBatch,
  agentId: string,
  keyring = testKeyring(),
  kid = TEST_REQUEST_KID
): SettlementRequestedEvent {
  const unsigned = { ...batch, agent_id: agentId };
  return {
    ...unsigned,
    signature: signSettlement(settlementRequestPreimage(unsigned), kid, keyring),
  };
}

export function signFireflyExecutor(
  params: ExecutorPreimageParams,
  keyring = testKeyring(),
  kid = TEST_EXECUTOR_KID
): SettlementSignature {
  return signSettlement(settlementExecutorPreimage(params), kid, keyring);
}

export function signContractExecutor(
  params: ExecutorPreimageParams,
  keyring = testKeyring(),
  kid = TEST_EXECUTOR_KID
): SettlementSignature {
  return signSettlement(contractExecutorPreimage(params), kid, keyring);
}

export interface ApprovalFields {
  approval_id: string;
  settlement_id: string;
  scope: string;
  approved_by: string;
  approved_at: string;
  expires_at?: string;
}

/** Re-signs an operator approval over its own current field values. */
export function signApproval<T extends ApprovalFields>(
  approval: T,
  keyring = testKeyring(),
  kid = TEST_OPERATOR_KID
): T & { signature: SettlementSignature } {
  return {
    ...approval,
    signature: signSettlement(
      settlementApprovalPreimage({
        approvalId: approval.approval_id,
        settlementId: approval.settlement_id,
        scope: approval.scope,
        approvedBy: approval.approved_by,
        approvedAt: approval.approved_at,
        expiresAt: approval.expires_at,
      }),
      kid,
      keyring
    ),
  };
}

/**
 * Re-signs a deployment attestation AND every approval on it over their
 * current field values, so a test can mutate a field and get a fixture that is
 * consistent-but-for-that-field, or mutate AFTER signing to get a genuine
 * tamper case.
 */
export function signDeploymentAttestation(
  attestation: SettlementDeploymentAttestation,
  keyring = testKeyring(),
  kid = TEST_DEPLOYMENT_KID
): SettlementDeploymentAttestation {
  const approvals: SettlementDeploymentApproval[] = attestation.approvals.map((approval) => ({
    ...approval,
    signature: signSettlement(
      deploymentApprovalPreimage({
        approvalId: approval.approval_id,
        manifestId: attestation.manifest_id,
        scope: approval.scope,
        approvedBy: approval.approved_by,
        approvedAt: approval.approved_at,
        expiresAt: approval.expires_at,
      }),
      TEST_OPERATOR_KID,
      keyring
    ),
  }));

  const signed: SettlementDeploymentAttestation = { ...attestation, approvals };
  signed.signature = signSettlement(
    deploymentAttestationPreimage({
      manifestId: signed.manifest_id,
      environment: signed.environment,
      rpcRef: signed.rpc_ref,
      custodyType: signed.wallet_custody?.custody_type,
      custodySignerRef: signed.wallet_custody?.signer_ref,
      custodyPolicyRef: signed.wallet_custody?.policy_ref,
      custodyOperatorRef: signed.wallet_custody?.operator_ref,
      fireflyInstanceRef: signed.firefly?.instance_ref,
      fireflyEnvironment: signed.firefly?.environment,
      fireflyAccountRef: signed.firefly?.account_ref,
      signedAt: signed.signed_at,
      expiresAt: signed.expires_at,
      approvalIds: approvals.map((approval) => approval.approval_id),
    }),
    kid,
    keyring
  );
  return signed;
}
