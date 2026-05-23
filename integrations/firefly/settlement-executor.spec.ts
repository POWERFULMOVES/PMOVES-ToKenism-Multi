import { FireflySettlementExecutor, FireflyWritableClient } from './settlement-executor';
import { SettlementRequestedEvent } from '../contracts';

const SIGNATURE = { alg: 'HMAC-SHA256', kid: 'agent-zero-test', hmac: 'abc123' };

function settlementRequest(): SettlementRequestedEvent {
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
    agent_id: 'PMOVES-AGENT-ZERO-CODEX',
    signature: SIGNATURE,
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
          cgp_hash: `sha256:${'a'.repeat(64)}`,
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
          cgp_hash: `sha256:${'a'.repeat(64)}`,
          merkle_root: `0x${'b'.repeat(64)}`,
          contributor_weight: 0.4,
          raw_contribution: 40,
        },
      },
    ],
  };
}

describe('FireflySettlementExecutor', () => {
  it('dry-runs Firefly lane instructions without calling a client', async () => {
    const client: FireflyWritableClient = {
      createTransaction: jest.fn(),
    };
    const executor = new FireflySettlementExecutor(client);

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
    const client: FireflyWritableClient = {
      createTransaction: jest.fn().mockResolvedValue({ id: 'firefly-tx-1' }),
    };
    const executor = new FireflySettlementExecutor(client, {
      dryRun: false,
      executorAgentId: 'FIREFLY-SETTLEMENT-EXECUTOR',
      executorSignature: { alg: 'HMAC-SHA256', kid: 'firefly-exec', hmac: 'execsig' },
    });

    const result = await executor.execute(settlementRequest());

    expect(client.createTransaction).toHaveBeenCalledTimes(1);
    expect(result.recorded).toMatchObject([
      {
        settlement_id: 'settlement_1234abcd5678ef00',
        instruction_id: 'settle_inst_1234abcd5678ef00',
        lane: 'firefly',
        action: 'grotoken_mint',
        status: 'recorded',
        amount: 600,
        asset: 'GRO',
        firefly_transaction_id: 'firefly-tx-1',
        agent_id: 'FIREFLY-SETTLEMENT-EXECUTOR',
      },
    ]);
    expect(result.failed).toHaveLength(0);
  });

  it('returns failed events for Firefly write errors', async () => {
    const client: FireflyWritableClient = {
      createTransaction: jest.fn().mockRejectedValue(new Error('Firefly down')),
    };
    const executor = new FireflySettlementExecutor(client, { dryRun: false });

    const result = await executor.execute(settlementRequest());

    expect(result.recorded).toHaveLength(0);
    expect(result.failed).toMatchObject([
      {
        settlement_id: 'settlement_1234abcd5678ef00',
        instruction_id: 'settle_inst_1234abcd5678ef00',
        lane: 'firefly',
        action: 'grotoken_mint',
        error_code: 'FIREFLY_WRITE_FAILED',
        error_message: 'Firefly down',
        retryable: true,
        agent_id: 'PMOVES-AGENT-ZERO-CODEX',
      },
    ]);
  });

  it('rejects duplicate idempotency keys inside a batch', async () => {
    const request = settlementRequest();
    request.instructions[1].lane = 'firefly';
    request.instructions[1].idempotency_key = request.instructions[0].idempotency_key;
    const executor = new FireflySettlementExecutor();

    await expect(executor.execute(request)).rejects.toThrow(
      'Duplicate settlement idempotency key'
    );
  });

  it('requires a client for live execution', async () => {
    const executor = new FireflySettlementExecutor(undefined, { dryRun: false });

    await expect(executor.execute(settlementRequest())).rejects.toThrow(
      'Firefly client is required when dryRun=false'
    );
  });
});
