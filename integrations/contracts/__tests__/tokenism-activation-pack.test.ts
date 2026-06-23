import {
  toContractDeploymentManifest,
  validateTokenismActivationPack,
  type TokenismActivationPack,
} from '../tokenism-activation-pack';

const SIGNATURE = { alg: 'HMAC-SHA256', kid: 'operator-test', hmac: 'sig' };

function activationPack(): TokenismActivationPack {
  return {
    spec: 'tokenism.activation.pack.v1',
    deployment_manifest_id: 'tokenism-staging-20260609',
    environment: 'staging',
    chain_id: 31337,
    network: 'hardhat',
    contract_addresses: {
      GroToken: '0x1111111111111111111111111111111111111111',
      FoodUSD: '0x2222222222222222222222222222222222222222',
    },
    rpc_endpoint_ref: 'secret:tokenism/staging/rpc',
    wallet_custody_ref: 'vault:tokenism/staging/signer',
    firefly_endpoint_ref: 'secret:firefly/staging/api',
    operator_approval_id: 'approval_deployment_1234abcd5678ef00',
    deployment_attestation: {
      manifest_id: 'tokenism-staging-20260609',
      environment: 'staging',
      rpc_ref: 'secret:tokenism/staging/rpc',
      wallet_custody: {
        custody_type: 'vault',
        signer_ref: 'vault:tokenism/staging/signer',
        policy_ref: 'policy:tokenism/staging-low-value',
      },
      firefly: {
        instance_ref: 'secret:firefly/staging/api',
        environment: 'staging',
        account_ref: 'firefly-account:tokenism-settlement-pool',
      },
      approvals: [
        {
          approval_id: 'approval_deployment_1234abcd5678ef00',
          scope: 'settlement_deployment_manifest',
          approved_by: 'PMOVES-OPERATOR',
          approved_at: '2026-06-09T10:00:00Z',
          expires_at: '2099-01-01T00:00:00Z',
          signature: SIGNATURE,
        },
      ],
      signed_at: '2026-06-09T10:01:00Z',
      expires_at: '2099-01-01T00:00:00Z',
      signature: { alg: 'HMAC-SHA256', kid: 'deployment-manifest', hmac: 'manifest-sig' },
    },
    deployment_attestation_sig: {
      alg: 'HMAC-SHA256',
      kid: 'deployment-manifest',
      hmac: 'manifest-sig',
    },
    executor_agent_id: 'PMOVES-AGENT-ZERO-CODEX',
    executor_signature: {
      alg: 'HMAC-SHA256',
      kid: 'agent-zero-codex',
      hmac: 'executor-sig',
    },
    dry_run_evidence: [
      {
        evidence_id: 'dryrun_firefly_1234abcd5678ef00',
        lane: 'firefly',
        settlement_id: 'settlement_1234abcd5678ef00',
        result_ref: 'artifact:tokenism/firefly-dryrun-20260609',
        passed: true,
        run_at: '2026-06-09T10:10:00Z',
        reviewed_by: 'PMOVES-OPERATOR',
        signature: { alg: 'HMAC-SHA256', kid: 'firefly-dryrun', hmac: 'firefly-sig' },
      },
      {
        evidence_id: 'dryrun_contract_1234abcd5678ef00',
        lane: 'contract',
        settlement_id: 'settlement_1234abcd5678ef00',
        result_ref: 'artifact:tokenism/contract-dryrun-20260609',
        passed: true,
        run_at: '2026-06-09T10:12:00Z',
        reviewed_by: 'PMOVES-OPERATOR',
        signature: { alg: 'HMAC-SHA256', kid: 'contract-dryrun', hmac: 'contract-sig' },
      },
    ],
    rollback_plan: {
      disable_switch: 'TOKENISM_LIVE_SETTLEMENT_ENABLED=false',
      affected_subjects: [
        'tokenism.settlement.requested.v1',
        'tokenism.settlement.recorded.v1',
        'tokenism.settlement.failed.v1',
      ],
      steps: [
        'Disable live executor flag',
        'Pause settlement consumers',
        'Publish incident trail entry',
      ],
      incident_contacts: [
        {
          name: 'PMOVES Operator',
          role: 'owner',
          contact_ref: 'vault:contacts/pmoves-operator',
        },
      ],
    },
    created_at: '2026-06-09T10:15:00Z',
    expires_at: '2099-01-01T00:00:00Z',
    signature: { alg: 'HMAC-SHA256', kid: 'activation-pack', hmac: 'pack-sig' },
  };
}

describe('tokenism activation pack', () => {
  it('validates a signed staging activation pack', () => {
    const pack = activationPack();

    expect(() =>
      validateTokenismActivationPack(pack, {
        trustedExecutorIds: ['PMOVES-AGENT-ZERO-CODEX'],
      })
    ).not.toThrow();
  });

  it('rejects raw RPC URLs', () => {
    const pack = activationPack();
    pack.rpc_endpoint_ref = 'https://rpc.example.test';

    expect(() => validateTokenismActivationPack(pack)).toThrow(
      'rpc_endpoint_ref must be a secret-managed reference, not a raw URL'
    );
  });

  it('rejects raw wallet private keys', () => {
    const pack = activationPack();
    pack.wallet_custody_ref = `0x${'a'.repeat(64)}`;

    expect(() => validateTokenismActivationPack(pack)).toThrow(
      'wallet_custody_ref must be a custody reference, not a raw private key'
    );
  });

  it('requires matching deployment attestation and approval ids', () => {
    const pack = activationPack();
    pack.deployment_manifest_id = 'tokenism-other-manifest';

    expect(() => validateTokenismActivationPack(pack)).toThrow(
      'deployment_manifest_id must match deployment_attestation.manifest_id'
    );

    const approvalMismatch = activationPack();
    approvalMismatch.operator_approval_id = 'approval_missing';

    expect(() => validateTokenismActivationPack(approvalMismatch)).toThrow(
      'operator_approval_id must be present in deployment_attestation approvals'
    );
  });

  it('requires activation refs to match the signed deployment attestation', () => {
    const rpcMismatch = activationPack();
    rpcMismatch.rpc_endpoint_ref = 'secret:tokenism/staging/other-rpc';

    expect(() => validateTokenismActivationPack(rpcMismatch)).toThrow(
      'rpc_endpoint_ref must match deployment_attestation.rpc_ref'
    );

    const walletMismatch = activationPack();
    walletMismatch.wallet_custody_ref = 'vault:tokenism/staging/other-signer';

    expect(() => validateTokenismActivationPack(walletMismatch)).toThrow(
      'wallet_custody_ref must match deployment_attestation.wallet_custody.signer_ref'
    );

    const fireflyMismatch = activationPack();
    fireflyMismatch.firefly_endpoint_ref = 'secret:firefly/staging/other-api';

    expect(() => validateTokenismActivationPack(fireflyMismatch)).toThrow(
      'firefly_endpoint_ref must match deployment_attestation.firefly.instance_ref'
    );

    const signatureMismatch = activationPack();
    signatureMismatch.deployment_attestation_sig = {
      alg: 'HMAC-SHA256',
      kid: 'deployment-manifest',
      hmac: 'other-manifest-sig',
    };

    expect(() => validateTokenismActivationPack(signatureMismatch)).toThrow(
      'deployment_attestation_sig must match deployment_attestation.signature'
    );
  });

  it('requires passing dry-run evidence for both live lanes by default', () => {
    const pack = activationPack();
    pack.dry_run_evidence = pack.dry_run_evidence.filter((item) => item.lane === 'firefly');

    expect(() => validateTokenismActivationPack(pack)).toThrow(
      'Tokenism activation pack requires contract dry-run evidence'
    );

    const failedEvidence = activationPack();
    failedEvidence.dry_run_evidence[0].passed = false;

    expect(() => validateTokenismActivationPack(failedEvidence)).toThrow(
      'dry_run_evidence did not pass: dryrun_firefly_1234abcd5678ef00'
    );
  });

  it('rejects untrusted executor ids when a trust list is provided', () => {
    const pack = activationPack();

    expect(() =>
      validateTokenismActivationPack(pack, {
        trustedExecutorIds: ['HERMES'],
      })
    ).toThrow('Tokenism activation executor is not trusted: PMOVES-AGENT-ZERO-CODEX');
  });

  it('builds a contract deployment manifest for the executor', () => {
    const pack = activationPack();

    expect(toContractDeploymentManifest(pack)).toMatchObject({
      chain_id: 31337,
      network: 'hardhat',
      contracts: {
        GroToken: { address: '0x1111111111111111111111111111111111111111' },
        FoodUSD: { address: '0x2222222222222222222222222222222222222222' },
      },
      attestation: {
        manifest_id: 'tokenism-staging-20260609',
      },
    });
  });
});
