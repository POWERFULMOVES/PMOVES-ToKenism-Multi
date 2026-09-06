import { FireflySettlementExecutor, FireflyWritableClient } from './settlement-executor';
import {
  SettlementDeploymentAttestation,
  SettlementRequestedEvent,
} from '../contracts';
import {
  TEST_EXECUTOR_KID,
  TEST_UNKNOWN_KID,
  forgedSignature,
  placeholderSignature,
  signApproval,
  signDeploymentAttestation,
  signFireflyExecutor,
  signRequest,
  testKeyring,
} from '../testing/settlement-fixtures';
import type { SettlementBatch } from '../contracts/settlement-planner';

const KEYRING = testKeyring();
const AGENT_ID = 'PMOVES-AGENT-ZERO-CODEX';
const SETTLEMENT_ID = 'settlement_1234abcd5678ef00';
const CGP_HASH = `sha256:${'a'.repeat(64)}`;
const EXECUTOR_AGENT = 'FIREFLY-SETTLEMENT-EXECUTOR';

function settlementBatch(): SettlementBatch {
  return {
    settlement_id: SETTLEMENT_ID,
    source_subject: 'tokenism.cgp.weekly.v1',
    source_id: 'weekly-cgp-12',
    cgp_spec: 'chit.cgp.v1.0',
    cgp_hash: CGP_HASH,
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
        lane: 'firefly',
        action: 'grotoken_mint',
        address: '0xALICE',
        amount: 600,
        asset: 'GRO',
        source_ref: {
          cgp_hash: CGP_HASH,
          merkle_root: `0x${'b'.repeat(64)}`,
          contributor_weight: 0.6,
          raw_contribution: 60,
        },
        firefly: {
          transaction_type: 'deposit',
          destination_name: 'Alice Tokenism Account',
          category_name: 'Tokenism Rewards',
        },
        contract: {
          contract: 'GroToken',
          method: 'mint',
        },
      },
      {
        instruction_id: 'settle_inst_abcdef0012345678',
        idempotency_key: 'tokenism:weekly-grotoken-v1:week-12:0xbob:abcdef0012345678',
        lane: 'contract',
        action: 'grotoken_mint',
        address: '0xBOB',
        amount: 400,
        asset: 'GRO',
        source_ref: {
          cgp_hash: CGP_HASH,
          merkle_root: `0x${'b'.repeat(64)}`,
          contributor_weight: 0.4,
          raw_contribution: 40,
        },
      },
    ],
  } as SettlementBatch;
}

/** A settlement request carrying a REAL MAC over its own canonical preimage. */
function settlementRequest(): SettlementRequestedEvent {
  return signRequest(settlementBatch(), AGENT_ID, KEYRING);
}

const EXECUTOR_SIGNATURE = signFireflyExecutor(
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
    approval_id: 'approval_firefly_1234abcd5678ef00',
    settlement_id: SETTLEMENT_ID,
    scope: 'firefly_live_execution' as const,
    approved_by: 'PMOVES-OPERATOR',
    approved_at: '2026-05-25T12:00:00Z',
    expires_at: '2099-01-01T00:00:00Z',
  },
  KEYRING
);

const DEPLOYMENT_ATTESTATION: SettlementDeploymentAttestation = signDeploymentAttestation(
  {
    manifest_id: 'tokenism-firefly-local-20260525',
    environment: 'local',
    firefly: {
      instance_ref: 'env:FIREFLY_BASE_URL',
      environment: 'local',
      account_ref: 'Tokenism Settlement Pool',
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

function liveConfig(overrides: Record<string, unknown> = {}) {
  return {
    dryRun: false,
    executorAgentId: EXECUTOR_AGENT,
    executorSignature: EXECUTOR_SIGNATURE,
    operatorApproval: OPERATOR_APPROVAL,
    deploymentAttestation: DEPLOYMENT_ATTESTATION,
    signatureKeyring: KEYRING,
    ...overrides,
  };
}

function writingClient(): FireflyWritableClient {
  return { createTransaction: jest.fn().mockResolvedValue({ id: 'firefly-tx-1' }) };
}

describe('FireflySettlementExecutor', () => {
  it('dry-runs Firefly lane instructions without calling a client', async () => {
    const client: FireflyWritableClient = {
      createTransaction: jest.fn(),
    };
    const executor = new FireflySettlementExecutor(client, { signatureKeyring: KEYRING });

    const result = await executor.execute(settlementRequest());

    expect(client.createTransaction).not.toHaveBeenCalled();
    expect(result.dry_run).toBe(true);
    expect(result.requested).toBe(2);
    expect(result.processed).toBe(1);
    expect(result.skipped).toEqual([
      {
        instruction_id: 'settle_inst_abcdef0012345678',
        idempotency_key: 'tokenism:weekly-grotoken-v1:week-12:0xbob:abcdef0012345678',
        lane: 'contract',
        reason: 'not a Firefly-lane instruction',
      },
    ]);
    expect(result.drafts[0].transaction).toMatchObject({
      type: 'deposit',
      amount: 600,
      description:
        'Tokenism settlement | weekly-grotoken-v1 | week 12 | grotoken_mint | settle_inst_1234abcd5678ef00',
      sourceName: 'Tokenism Settlement Pool',
      destinationName: 'Alice Tokenism Account',
      category: 'Tokenism Rewards',
    });
    expect(result.recorded).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  it('writes transactions and emits recorded events when dryRun is false', async () => {
    const client = writingClient();
    const executor = new FireflySettlementExecutor(
      client,
      liveConfig({ trustedExecutorIds: [EXECUTOR_AGENT] })
    );

    const result = await executor.execute(settlementRequest());

    expect(client.createTransaction).toHaveBeenCalledTimes(1);
    expect(result.recorded).toMatchObject([
      {
        settlement_id: SETTLEMENT_ID,
        instruction_id: 'settle_inst_1234abcd5678ef00',
        lane: 'firefly',
        action: 'grotoken_mint',
        status: 'recorded',
        amount: 600,
        asset: 'GRO',
        firefly_transaction_id: 'firefly-tx-1',
        agent_id: EXECUTOR_AGENT,
        metadata: {
          deployment_manifest_id: 'tokenism-firefly-local-20260525',
          operator_approval_id: 'approval_firefly_1234abcd5678ef00',
        },
      },
    ]);
    expect(result.failed).toHaveLength(0);
  });

  it('returns failed events for Firefly write errors', async () => {
    const client: FireflyWritableClient = {
      createTransaction: jest.fn().mockRejectedValue(new Error('Firefly down')),
    };
    const executor = new FireflySettlementExecutor(client, liveConfig());

    const result = await executor.execute(settlementRequest());

    expect(result.recorded).toHaveLength(0);
    expect(result.failed).toMatchObject([
      {
        settlement_id: SETTLEMENT_ID,
        instruction_id: 'settle_inst_1234abcd5678ef00',
        lane: 'firefly',
        action: 'grotoken_mint',
        error_code: 'FIREFLY_WRITE_FAILED',
        error_message: 'Firefly down',
        retryable: true,
        agent_id: EXECUTOR_AGENT,
      },
    ]);
  });

  it('rejects duplicate idempotency keys inside a batch', async () => {
    const batch = settlementBatch();
    batch.instructions[1].lane = 'firefly';
    batch.instructions[1].idempotency_key = batch.instructions[0].idempotency_key;
    const request = signRequest(batch, AGENT_ID, KEYRING);
    const executor = new FireflySettlementExecutor(undefined, { signatureKeyring: KEYRING });

    await expect(executor.execute(request)).rejects.toThrow(
      'Duplicate settlement idempotency key'
    );
  });

  it('requires a client for live execution', async () => {
    const executor = new FireflySettlementExecutor(undefined, {
      dryRun: false,
      signatureKeyring: KEYRING,
    });

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Firefly client is required when dryRun=false'
    );
  });

  it('requires operator approval for live execution by default', async () => {
    const client = writingClient();
    const executor = new FireflySettlementExecutor(
      client,
      liveConfig({ operatorApproval: undefined })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Live Firefly settlement requires operator approval'
    );
    expect(client.createTransaction).not.toHaveBeenCalled();
  });

  it('requires deployment attestation for live execution by default', async () => {
    const client = writingClient();
    const executor = new FireflySettlementExecutor(
      client,
      liveConfig({ deploymentAttestation: undefined })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Deployment attestation is required'
    );
    expect(client.createTransaction).not.toHaveBeenCalled();
  });

  it('requires a signed executor identity for live execution', async () => {
    const client = writingClient();
    const executor = new FireflySettlementExecutor(
      client,
      liveConfig({ executorSignature: { alg: '', kid: '' } })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Live Firefly settlement executorSignature: signature.alg is missing'
    );
    expect(client.createTransaction).not.toHaveBeenCalled();
  });

  it('requires an explicit executor agent id for live execution', async () => {
    const client = writingClient();
    const executor = new FireflySettlementExecutor(
      client,
      liveConfig({ executorAgentId: undefined })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Live Firefly settlement requires executorAgentId'
    );
    expect(client.createTransaction).not.toHaveBeenCalled();
  });

  it('rejects untrusted live executors when an allowlist is configured', async () => {
    const client = writingClient();
    // Signed correctly FOR the untrusted id, so the allowlist is what refuses
    // it rather than a signature mismatch.
    const executor = new FireflySettlementExecutor(
      client,
      liveConfig({
        executorAgentId: 'UNKNOWN-EXECUTOR',
        executorSignature: signFireflyExecutor(
          {
            settlementId: SETTLEMENT_ID,
            executorAgentId: 'UNKNOWN-EXECUTOR',
            cgpHash: CGP_HASH,
            week: 12,
          },
          KEYRING
        ),
        trustedExecutorIds: [EXECUTOR_AGENT],
      })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Live Firefly settlement executor is not trusted: UNKNOWN-EXECUTOR'
    );
    expect(client.createTransaction).not.toHaveBeenCalled();
  });

  it('rejects approval for a different settlement, on the settlement_id check', async () => {
    const client = writingClient();
    // Re-signed for the OTHER settlement_id, so this test reaches the
    // settlement_id comparison it names instead of tripping the signature
    // check first and passing for the wrong reason.
    const executor = new FireflySettlementExecutor(
      client,
      liveConfig({
        operatorApproval: signApproval(
          { ...OPERATOR_APPROVAL, settlement_id: 'settlement_ffffffffffffffff' },
          KEYRING
        ),
      })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Operator approval settlement_id does not match request'
    );
    expect(client.createTransaction).not.toHaveBeenCalled();
  });

  it('rejects expired operator approval, on the expiry check', async () => {
    const client = writingClient();
    const executor = new FireflySettlementExecutor(
      client,
      liveConfig({
        operatorApproval: signApproval(
          { ...OPERATOR_APPROVAL, expires_at: '2000-01-01T00:00:00Z' },
          KEYRING
        ),
      })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Operator approval has expired'
    );
    expect(client.createTransaction).not.toHaveBeenCalled();
  });
});

/**
 * The inversion of the pre-fix fixtures. Before this branch, every signature in
 * this file was `hmac: 'abc123'` and the suite was GREEN — the placeholder was
 * accepted at all four gates. Each case below feeds that same placeholder to
 * one gate and asserts the specific reason it is refused, so a regression that
 * loosens any one gate fails here rather than silently passing.
 */
describe('FireflySettlementExecutor — the `abc123` placeholder is refused at every gate', () => {
  it('gate 1: the settlement request', async () => {
    const client = writingClient();
    const request = {
      ...settlementRequest(),
      signature: placeholderSignature('test-agent-zero'),
    };
    const executor = new FireflySettlementExecutor(client, liveConfig());

    await expect(executor.execute(request)).rejects.toThrow(
      'Settlement request signature: signature.hmac must be 64 canonical hex characters'
    );
    expect(client.createTransaction).not.toHaveBeenCalled();
  });

  it('gate 2: the live executor identity', async () => {
    const client = writingClient();
    const executor = new FireflySettlementExecutor(
      client,
      liveConfig({ executorSignature: placeholderSignature(TEST_EXECUTOR_KID) })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Live Firefly settlement executorSignature: signature.hmac must be 64 canonical hex characters'
    );
    expect(client.createTransaction).not.toHaveBeenCalled();
  });

  it('gate 3: the operator approval', async () => {
    const client = writingClient();
    const executor = new FireflySettlementExecutor(
      client,
      liveConfig({
        operatorApproval: {
          ...OPERATOR_APPROVAL,
          signature: placeholderSignature('test-operator'),
        },
      })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Operator approval signature: signature.hmac must be 64 canonical hex characters'
    );
    expect(client.createTransaction).not.toHaveBeenCalled();
  });

  it('gate 4: the deployment attestation', async () => {
    const client = writingClient();
    const executor = new FireflySettlementExecutor(
      client,
      liveConfig({
        deploymentAttestation: {
          ...DEPLOYMENT_ATTESTATION,
          signature: placeholderSignature('test-deployment-manifest'),
        },
      })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Deployment attestation signature: signature.hmac must be 64 canonical hex characters'
    );
    expect(client.createTransaction).not.toHaveBeenCalled();
  });

  it('gate 4b: an approval on the deployment attestation', async () => {
    const client = writingClient();
    const executor = new FireflySettlementExecutor(
      client,
      liveConfig({
        deploymentAttestation: {
          ...DEPLOYMENT_ATTESTATION,
          approvals: [
            {
              ...DEPLOYMENT_ATTESTATION.approvals[0],
              signature: placeholderSignature('test-operator'),
            },
          ],
        },
      })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Deployment approval signature: signature.hmac must be 64 canonical hex characters'
    );
    expect(client.createTransaction).not.toHaveBeenCalled();
  });
});

describe('FireflySettlementExecutor — fail-closed configuration', () => {
  it('refuses even a DRY RUN when no keyring is configured', async () => {
    // A deployment that forgot to configure keys must fail shut. This is the
    // behaviour that turned the pre-fix suite red, and it is correct.
    const executor = new FireflySettlementExecutor();

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Settlement request signature: no settlement keyring configured'
    );
  });

  it('refuses a signature minted under a kid the keyring does not hold', async () => {
    const client = writingClient();
    const executor = new FireflySettlementExecutor(
      client,
      liveConfig({
        executorSignature: { ...EXECUTOR_SIGNATURE, kid: TEST_UNKNOWN_KID },
      })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      `Live Firefly settlement executorSignature: unknown signature.kid: ${TEST_UNKNOWN_KID}`
    );
    expect(client.createTransaction).not.toHaveBeenCalled();
  });

  it('refuses a well-formed but forged proof', async () => {
    const client = writingClient();
    const executor = new FireflySettlementExecutor(
      client,
      liveConfig({ executorSignature: forgedSignature(TEST_EXECUTOR_KID) })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Live Firefly settlement executorSignature: signature does not verify'
    );
    expect(client.createTransaction).not.toHaveBeenCalled();
  });

  it('refuses a request whose instructions were edited after signing', async () => {
    const request = settlementRequest();
    request.instructions[0].address = '0xMALLORY';
    const executor = new FireflySettlementExecutor(undefined, { signatureKeyring: KEYRING });

    await expect(executor.execute(request)).rejects.toThrow(
      'Settlement request signature: signature does not verify'
    );
  });

  it('refuses a deployment attestation whose approval list grew after signing', async () => {
    const client = writingClient();
    const executor = new FireflySettlementExecutor(
      client,
      liveConfig({
        deploymentAttestation: {
          ...DEPLOYMENT_ATTESTATION,
          approvals: [
            ...DEPLOYMENT_ATTESTATION.approvals,
            { ...DEPLOYMENT_ATTESTATION.approvals[0], approval_id: 'approval_injected' },
          ],
        },
      })
    );

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Deployment attestation signature: signature does not verify'
    );
    expect(client.createTransaction).not.toHaveBeenCalled();
  });
});
