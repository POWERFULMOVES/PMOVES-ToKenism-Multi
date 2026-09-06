import {
  ContractDeploymentManifest,
  ContractSettlementExecutor,
  ContractWritableClient,
} from '../contract-settlement-executor';
import {
  SettlementDeploymentAttestation,
  SettlementRequestedEvent,
} from '../';
import type { SettlementBatch } from '../settlement-planner';
import {
  TEST_EXECUTOR_KID,
  forgedSignature,
  placeholderSignature,
  signApproval,
  signContractExecutor,
  signFireflyExecutor,
  signDeploymentAttestation,
  signRequest,
  testKeyring,
} from '../../testing/settlement-fixtures';

// Real, test-only key material. Before this, every signature in this file was
// a placeholder string that the executor's private isSigned() accepted.
const KEYRING = testKeyring();
const AGENT_ID = 'PMOVES-AGENT-ZERO-CODEX';
const SETTLEMENT_ID = 'settlement_1234abcd5678ef00';
const CGP_HASH = `sha256:${'a'.repeat(64)}`;
const EXECUTOR_AGENT = 'CONTRACT-SETTLEMENT-EXECUTOR';

const EXECUTOR_SIGNATURE = signContractExecutor(
  {
    settlementId: SETTLEMENT_ID,
    executorAgentId: EXECUTOR_AGENT,
    cgpHash: CGP_HASH,
    week: 12,
  },
  KEYRING
);

const OPERATOR_APPROVAL = signApproval(
  {
    approval_id: 'approval_contract_1234abcd5678ef00',
    settlement_id: SETTLEMENT_ID,
    scope: 'contract_live_execution' as const,
    approved_by: 'PMOVES-OPERATOR',
    approved_at: '2026-05-25T12:00:00Z',
    expires_at: '2099-01-01T00:00:00Z',
  },
  KEYRING
);

const DEPLOYMENT_ATTESTATION: SettlementDeploymentAttestation = signDeploymentAttestation(
  {
  manifest_id: 'tokenism-hardhat-local-20260525',
  environment: 'local',
  rpc_ref: 'env:ETHEREUM_RPC_URL',
  wallet_custody: {
    custody_type: 'local',
    signer_ref: 'env:ETHEREUM_SETTLEMENT_SIGNER',
    policy_ref: 'docs:tokenism-local-policy',
  },
  approvals: [
    {
      approval_id: 'approval_deployment_1234abcd5678ef00',
      scope: 'settlement_deployment_manifest',
      approved_by: 'PMOVES-OPERATOR',
      approved_at: '2026-05-25T12:00:00Z',
      expires_at: '2099-01-01T00:00:00Z',
    },
  ],
  signed_at: '2026-05-25T12:00:00Z',
  expires_at: '2099-01-01T00:00:00Z',
  } as SettlementDeploymentAttestation,
  KEYRING
);

const MANIFEST: ContractDeploymentManifest = {
  chain_id: 31337,
  network: 'hardhat',
  generated_at: '2026-05-25T12:00:00Z',
  attestation: DEPLOYMENT_ATTESTATION,
  contracts: {
    GroToken: {
      address: '0x1111111111111111111111111111111111111111',
      version: '0.1.0',
    },
    FoodUSD: {
      address: '0x2222222222222222222222222222222222222222',
      version: '0.1.0',
    },
    GroupPurchase: {
      address: '0x3333333333333333333333333333333333333333',
      version: '0.1.0',
    },
  },
};

function settlementBatch(): SettlementBatch {
  return {
    settlement_id: 'settlement_1234abcd5678ef00',
    source_subject: 'tokenism.cgp.weekly.v1',
    source_id: 'weekly-cgp-12',
    cgp_spec: 'chit.cgp.v1.0',
    cgp_hash: `sha256:${'a'.repeat(64)}`,
    week: 12,
    status: 'planned',
    settlement_profile: 'weekly-grotoken-v1',
    created_at: '2026-05-22T01:02:03Z',
    totals: {
      instruction_count: 2,
      amount: 1000,
      asset: 'GRO',
    },
    instructions: [
      {
        instruction_id: 'settle_inst_1234abcd5678ef00',
        idempotency_key: 'tokenism:weekly-grotoken-v1:week-12:0xalice:1234abcd5678ef00',
        lane: 'contract',
        action: 'grotoken_mint',
        address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        amount: 600,
        asset: 'GRO',
        source_ref: {
          cgp_hash: `sha256:${'a'.repeat(64)}`,
          merkle_root: `0x${'b'.repeat(64)}`,
          contributor_weight: 0.6,
          raw_contribution: 60,
        },
        contract: {
          contract: 'GroToken',
          method: 'mint',
        },
      },
      {
        instruction_id: 'settle_inst_abcdef0012345678',
        idempotency_key: 'tokenism:weekly-grotoken-v1:week-12:0xbob:abcdef0012345678',
        lane: 'firefly',
        action: 'grotoken_mint',
        address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        amount: 400,
        asset: 'GRO',
        source_ref: {
          cgp_hash: `sha256:${'a'.repeat(64)}`,
          merkle_root: `0x${'b'.repeat(64)}`,
          contributor_weight: 0.4,
          raw_contribution: 40,
        },
      },
    ],
  } as SettlementBatch;
}

/** A contract-lane settlement request carrying a REAL MAC over its preimage. */
function settlementRequest(): SettlementRequestedEvent {
  return signRequest(settlementBatch(), AGENT_ID, KEYRING);
}

describe('ContractSettlementExecutor', () => {
  it('dry-runs contract lane instructions without calling a client', async () => {
    const client: ContractWritableClient = {
      executeContractCall: jest.fn(),
    };
    const executor = new ContractSettlementExecutor(client, {
      deploymentManifest: MANIFEST,
      signatureKeyring: KEYRING,
    });

    const result = await executor.execute(settlementRequest());

    expect(client.executeContractCall).not.toHaveBeenCalled();
    expect(result.dry_run).toBe(true);
    expect(result.requested).toBe(2);
    expect(result.processed).toBe(1);
    expect(result.skipped).toEqual([
      {
        instruction_id: 'settle_inst_abcdef0012345678',
        idempotency_key: 'tokenism:weekly-grotoken-v1:week-12:0xbob:abcdef0012345678',
        lane: 'firefly',
        reason: 'not a contract-lane instruction',
      },
    ]);
    expect(result.calls[0]).toMatchObject({
      chain_id: 31337,
      network: 'hardhat',
      to: '0x1111111111111111111111111111111111111111',
      contract: 'GroToken',
      method: 'mint',
      args: ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '600000000000000000000'],
      metadata: {
        action: 'grotoken_mint',
        asset: 'GRO',
        amount_units: '600000000000000000000',
      },
    });
    expect(result.recorded).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  it('formats tiny exponent amounts before converting to token units', async () => {
    const batch = settlementBatch();
    batch.totals = {
      instruction_count: 1,
      amount: 0.00000001,
      asset: 'GRO',
    };
    batch.instructions = [
      {
        ...batch.instructions[0],
        amount: 0.00000001,
      },
    ];
    const request = signRequest(batch, AGENT_ID, KEYRING);

    const executor = new ContractSettlementExecutor(undefined, {
      deploymentManifest: MANIFEST,
      signatureKeyring: KEYRING,
      assetDecimals: {
        GRO: 8,
      },
    });

    const result = await executor.execute(request);

    expect(result.calls[0]).toMatchObject({
      args: ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '1'],
      metadata: {
        amount: 0.00000001,
        amount_units: '1',
      },
    });
  });

  it('requires a deployment manifest', async () => {
    const executor = new ContractSettlementExecutor(undefined, { signatureKeyring: KEYRING });

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Contract deployment manifest is required'
    );
  });

  it('validates manifest contract addresses', async () => {
    const executor = new ContractSettlementExecutor(undefined, {
      signatureKeyring: KEYRING,
      deploymentManifest: {
        ...MANIFEST,
        contracts: {
          GroToken: { address: '0xBAD' },
        },
      },
    });

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'deployment GroToken.address must be a 20-byte hex address'
    );
  });

  it('writes contract calls and emits recorded events when dryRun is false', async () => {
    const client: ContractWritableClient = {
      executeContractCall: jest.fn().mockResolvedValue({
        hash: `0x${'c'.repeat(64)}`,
      }),
    };
    const executor = new ContractSettlementExecutor(client, {
      dryRun: false,
      executorAgentId: 'CONTRACT-SETTLEMENT-EXECUTOR',
      executorSignature: EXECUTOR_SIGNATURE,
      operatorApproval: OPERATOR_APPROVAL,
      trustedExecutorIds: ['CONTRACT-SETTLEMENT-EXECUTOR'],
      deploymentManifest: MANIFEST,
      signatureKeyring: KEYRING,
    });

    const result = await executor.execute(settlementRequest());

    expect(client.executeContractCall).toHaveBeenCalledTimes(1);
    expect(result.recorded).toMatchObject([
      {
        settlement_id: 'settlement_1234abcd5678ef00',
        instruction_id: 'settle_inst_1234abcd5678ef00',
        lane: 'contract',
        action: 'grotoken_mint',
        status: 'recorded',
        amount: 600,
        asset: 'GRO',
        tx_hash: `0x${'c'.repeat(64)}`,
        agent_id: 'CONTRACT-SETTLEMENT-EXECUTOR',
        metadata: {
          chain_id: 31337,
          network: 'hardhat',
          contract: 'GroToken',
          method: 'mint',
          deployment_manifest_id: 'tokenism-hardhat-local-20260525',
          operator_approval_id: 'approval_contract_1234abcd5678ef00',
        },
      },
    ]);
    expect(result.failed).toHaveLength(0);
  });

  it('requires operator approval for live execution by default', async () => {
    const client: ContractWritableClient = {
      executeContractCall: jest.fn().mockResolvedValue({ hash: `0x${'c'.repeat(64)}` }),
    };
    const executor = new ContractSettlementExecutor(client, {
      dryRun: false,
      executorAgentId: 'CONTRACT-SETTLEMENT-EXECUTOR',
      executorSignature: EXECUTOR_SIGNATURE,
      deploymentManifest: MANIFEST,
      signatureKeyring: KEYRING,
    });

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Live contract settlement requires operator approval'
    );
    expect(client.executeContractCall).not.toHaveBeenCalled();
  });

  it('requires deployment attestation for live execution by default', async () => {
    const client: ContractWritableClient = {
      executeContractCall: jest.fn().mockResolvedValue({ hash: `0x${'c'.repeat(64)}` }),
    };
    const executor = new ContractSettlementExecutor(client, {
      dryRun: false,
      executorAgentId: 'CONTRACT-SETTLEMENT-EXECUTOR',
      executorSignature: EXECUTOR_SIGNATURE,
      operatorApproval: OPERATOR_APPROVAL,
      signatureKeyring: KEYRING,
      deploymentManifest: {
        ...MANIFEST,
        attestation: undefined,
      },
    });

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Deployment attestation is required'
    );
    expect(client.executeContractCall).not.toHaveBeenCalled();
  });

  it('rejects malformed deployment attestation approvals cleanly', async () => {
    const client: ContractWritableClient = {
      executeContractCall: jest.fn().mockResolvedValue({ hash: `0x${'c'.repeat(64)}` }),
    };
    const executor = new ContractSettlementExecutor(client, {
      dryRun: false,
      executorAgentId: 'CONTRACT-SETTLEMENT-EXECUTOR',
      executorSignature: EXECUTOR_SIGNATURE,
      operatorApproval: OPERATOR_APPROVAL,
      signatureKeyring: KEYRING,
      deploymentManifest: {
        ...MANIFEST,
        attestation: {
          ...DEPLOYMENT_ATTESTATION,
          approvals: undefined as any,
        },
      },
    });

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Deployment attestation requires at least one operator approval'
    );
    expect(client.executeContractCall).not.toHaveBeenCalled();
  });

  it('requires a signed executor identity for live execution', async () => {
    const client: ContractWritableClient = {
      executeContractCall: jest.fn().mockResolvedValue({ hash: `0x${'c'.repeat(64)}` }),
    };
    const executor = new ContractSettlementExecutor(client, {
      dryRun: false,
      executorAgentId: 'CONTRACT-SETTLEMENT-EXECUTOR',
      executorSignature: { alg: '', kid: '' },
      operatorApproval: OPERATOR_APPROVAL,
      deploymentManifest: MANIFEST,
      signatureKeyring: KEYRING,
    });

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Live contract settlement executorSignature: signature.alg is missing'
    );
    expect(client.executeContractCall).not.toHaveBeenCalled();
  });

  it('rejects approval for a different settlement', async () => {
    const client: ContractWritableClient = {
      executeContractCall: jest.fn().mockResolvedValue({ hash: `0x${'c'.repeat(64)}` }),
    };
    const executor = new ContractSettlementExecutor(client, {
      dryRun: false,
      executorAgentId: 'CONTRACT-SETTLEMENT-EXECUTOR',
      executorSignature: EXECUTOR_SIGNATURE,
      // Re-signed for the OTHER settlement_id so this test reaches the
      // settlement_id comparison it names, instead of tripping the signature
      // check first and passing for the wrong reason.
      operatorApproval: signApproval(
        { ...OPERATOR_APPROVAL, settlement_id: 'settlement_deadbeefdeadbeef' },
        KEYRING
      ),
      deploymentManifest: MANIFEST,
      signatureKeyring: KEYRING,
    });

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Contract operator approval settlement_id does not match request'
    );
    expect(client.executeContractCall).not.toHaveBeenCalled();
  });

  it('returns failed events for contract write errors', async () => {
    const client: ContractWritableClient = {
      executeContractCall: jest.fn().mockRejectedValue(new Error('RPC down')),
    };
    const executor = new ContractSettlementExecutor(client, {
      dryRun: false,
      executorAgentId: 'CONTRACT-SETTLEMENT-EXECUTOR',
      executorSignature: EXECUTOR_SIGNATURE,
      operatorApproval: OPERATOR_APPROVAL,
      deploymentManifest: MANIFEST,
      signatureKeyring: KEYRING,
    });

    const result = await executor.execute(settlementRequest());

    expect(result.recorded).toHaveLength(0);
    expect(result.failed).toMatchObject([
      {
        settlement_id: 'settlement_1234abcd5678ef00',
        instruction_id: 'settle_inst_1234abcd5678ef00',
        lane: 'contract',
        action: 'grotoken_mint',
        error_code: 'CONTRACT_WRITE_FAILED',
        error_message: 'RPC down',
        retryable: true,
        agent_id: 'CONTRACT-SETTLEMENT-EXECUTOR',
      },
    ]);
  });

  it('maps group purchase settlement to execute(order_id)', async () => {
    const batch = settlementBatch();
    batch.instructions = [
      {
        ...batch.instructions[0],
        action: 'group_purchase_settle',
        amount: 1,
        asset: 'FUSD',
        contract: {
          contract: 'GroupPurchase',
          method: 'execute',
          order_id: 42,
        },
      },
    ];
    const request = signRequest(batch, AGENT_ID, KEYRING);
    const executor = new ContractSettlementExecutor(undefined, {
      deploymentManifest: MANIFEST,
      signatureKeyring: KEYRING,
    });

    const result = await executor.execute(request);

    expect(result.calls[0]).toMatchObject({
      to: '0x3333333333333333333333333333333333333333',
      contract: 'GroupPurchase',
      method: 'execute',
      args: [42],
    });
  });

  it('requires explicit mappings for vault and governance actions', async () => {
    const batch = settlementBatch();
    batch.instructions = [
      {
        ...batch.instructions[0],
        action: 'vault_stake',
        contract: {
          contract: 'SettlementExecutor',
          method: 'recordSettlement',
        },
      },
    ];
    const request = signRequest(batch, AGENT_ID, KEYRING);
    const executor = new ContractSettlementExecutor(undefined, {
      deploymentManifest: MANIFEST,
      signatureKeyring: KEYRING,
    });

    await expect(executor.execute(request)).rejects.toThrow(
      'vault_stake requires an explicit non-SettlementExecutor contract mapping'
    );
  });
});

/**
 * The contract lane is the SECOND executor on the settlement money path. Its
 * three gates kept a private copy of the isSigned() truthiness check after the
 * Firefly lane was fixed, so every placeholder below opened a gate on LIVE
 * on-chain execution until this branch. Each case asserts the SPECIFIC reason.
 */
describe('ContractSettlementExecutor — the `abc123` placeholder is refused at every gate', () => {
  function liveConfig(overrides: Record<string, unknown> = {}) {
    return {
      dryRun: false,
      executorAgentId: EXECUTOR_AGENT,
      executorSignature: EXECUTOR_SIGNATURE,
      operatorApproval: OPERATOR_APPROVAL,
      deploymentManifest: MANIFEST,
      signatureKeyring: KEYRING,
      ...overrides,
    };
  }

  function writingClient(): ContractWritableClient {
    return {
      executeContractCall: jest.fn().mockResolvedValue({ hash: `0x${'c'.repeat(64)}` }),
    };
  }

  it('gate 1: the settlement request', async () => {
    const client = writingClient();
    const request = {
      ...settlementRequest(),
      signature: placeholderSignature('test-agent-zero'),
    };
    const executor = new ContractSettlementExecutor(client, liveConfig());

    await expect(executor.execute(request)).rejects.toThrow(
      'Settlement request signature: signature.hmac must be 64 canonical hex characters'
    );
    expect(client.executeContractCall).not.toHaveBeenCalled();
  });

  it('gate 2: the live on-chain executor identity', async () => {
    const client = writingClient();
    const executor = new ContractSettlementExecutor(
      client,
      liveConfig({ executorSignature: placeholderSignature(TEST_EXECUTOR_KID) })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Live contract settlement executorSignature: signature.hmac must be 64 canonical hex characters'
    );
    expect(client.executeContractCall).not.toHaveBeenCalled();
  });

  it('gate 3: the operator approval', async () => {
    const client = writingClient();
    const executor = new ContractSettlementExecutor(
      client,
      liveConfig({
        operatorApproval: {
          ...OPERATOR_APPROVAL,
          signature: placeholderSignature('test-operator'),
        },
      })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Contract operator approval signature: signature.hmac must be 64 canonical hex characters'
    );
    expect(client.executeContractCall).not.toHaveBeenCalled();
  });

  it('gate 4: the deployment attestation', async () => {
    const client = writingClient();
    const executor = new ContractSettlementExecutor(
      client,
      liveConfig({
        deploymentManifest: {
          ...MANIFEST,
          attestation: {
            ...DEPLOYMENT_ATTESTATION,
            signature: placeholderSignature('test-deployment-manifest'),
          },
        },
      })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Deployment attestation signature: signature.hmac must be 64 canonical hex characters'
    );
    expect(client.executeContractCall).not.toHaveBeenCalled();
  });

  it('refuses a well-formed but forged on-chain executor proof', async () => {
    const client = writingClient();
    const executor = new ContractSettlementExecutor(
      client,
      liveConfig({ executorSignature: forgedSignature(TEST_EXECUTOR_KID) })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Live contract settlement executorSignature: signature does not verify'
    );
    expect(client.executeContractCall).not.toHaveBeenCalled();
  });

  it('refuses a Firefly executor identity replayed onto the contract lane', async () => {
    // Same settlement, same agent, same key — only the purpose tag differs.
    const client = writingClient();
    const executor = new ContractSettlementExecutor(
      client,
      liveConfig({
        executorSignature: signFireflyExecutor(
          {
            settlementId: SETTLEMENT_ID,
            executorAgentId: EXECUTOR_AGENT,
            cgpHash: CGP_HASH,
            week: 12,
          },
          KEYRING
        ),
      })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Live contract settlement executorSignature: signature does not verify'
    );
    expect(client.executeContractCall).not.toHaveBeenCalled();
  });

  it('refuses even a DRY RUN when no keyring is configured', async () => {
    const executor = new ContractSettlementExecutor(undefined, {
      deploymentManifest: MANIFEST,
    });

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Settlement request signature: no settlement keyring configured'
    );
  });
});
