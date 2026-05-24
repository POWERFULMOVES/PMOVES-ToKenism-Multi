import {
  FireflySettlementPublisher,
  SettlementPublishClient,
  TOKENISM_SETTLEMENT_SUBJECTS,
} from './settlement-publisher';
import {
  FireflySettlementExecutionResult,
  SettlementFailedEvent,
  SettlementRecordedEvent,
} from './settlement-executor';

const SIGNATURE = { alg: 'HMAC-SHA256', kid: 'firefly-exec', hmac: 'execsig' };

function recordedEvent(): SettlementRecordedEvent {
  return {
    settlement_id: 'settlement_1234abcd5678ef00',
    instruction_id: 'settle_inst_1234abcd5678ef00',
    idempotency_key: 'tokenism:weekly-grotoken-v1:week-12:0xalice:1234abcd5678ef00',
    lane: 'firefly',
    action: 'grotoken_mint',
    status: 'recorded',
    amount: 600,
    asset: 'GRO',
    firefly_transaction_id: 'firefly-tx-1',
    timestamp: '2026-05-22T01:02:03.000Z',
    agent_id: 'FIREFLY-SETTLEMENT-EXECUTOR',
    signature: SIGNATURE,
    metadata: {
      source_subject: 'tokenism.cgp.weekly.v1',
      cgp_hash: `sha256:${'a'.repeat(64)}`,
    },
  };
}

function failedEvent(): SettlementFailedEvent {
  return {
    settlement_id: 'settlement_1234abcd5678ef00',
    instruction_id: 'settle_inst_abcdef0012345678',
    idempotency_key: 'tokenism:weekly-grotoken-v1:week-12:0xbob:abcdef0012345678',
    lane: 'firefly',
    action: 'grotoken_mint',
    error_code: 'FIREFLY_WRITE_FAILED',
    error_message: 'Firefly down',
    retryable: true,
    timestamp: '2026-05-22T01:02:03.000Z',
    agent_id: 'FIREFLY-SETTLEMENT-EXECUTOR',
    signature: SIGNATURE,
  };
}

function executionResult(
  recorded: SettlementRecordedEvent[] = [recordedEvent()],
  failed: SettlementFailedEvent[] = [failedEvent()]
): Pick<FireflySettlementExecutionResult, 'settlement_id' | 'recorded' | 'failed'> {
  return {
    settlement_id: 'settlement_1234abcd5678ef00',
    recorded,
    failed,
  };
}

function publishClient(overrides: Partial<SettlementPublishClient> = {}): SettlementPublishClient {
  return {
    isConnected: jest.fn(() => true),
    publish: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('FireflySettlementPublisher', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('validates and publishes recorded and failed settlement result events', async () => {
    const client = publishClient();
    const publisher = new FireflySettlementPublisher(client);

    const summary = await publisher.publishExecutionResult(executionResult());

    expect(summary).toEqual({
      ok: true,
      attempted: 2,
      published: 2,
      recorded: 1,
      failed: 1,
      validationFailures: 0,
      publishFailures: 0,
    });
    expect(client.publish).toHaveBeenNthCalledWith(
      1,
      TOKENISM_SETTLEMENT_SUBJECTS.recorded,
      recordedEvent(),
      recordedEvent().idempotency_key
    );
    expect(client.publish).toHaveBeenNthCalledWith(
      2,
      TOKENISM_SETTLEMENT_SUBJECTS.failed,
      failedEvent(),
      failedEvent().idempotency_key
    );
  });

  it('returns false summary instead of publishing invalid payloads in best-effort mode', async () => {
    const client = publishClient();
    const invalid = {
      ...recordedEvent(),
      signature: { alg: '', kid: '', hmac: '' },
    } as SettlementRecordedEvent;
    const publisher = new FireflySettlementPublisher(client);

    const summary = await publisher.publishExecutionResult(executionResult([invalid], []));

    expect(summary.ok).toBe(false);
    expect(summary.attempted).toBe(1);
    expect(summary.published).toBe(0);
    expect(summary.validationFailures).toBe(1);
    expect(client.publish).not.toHaveBeenCalled();
  });

  it('throws validation errors in strict mode', async () => {
    const invalid = {
      ...recordedEvent(),
      status: 'done',
    } as unknown as SettlementRecordedEvent;
    const publisher = new FireflySettlementPublisher(publishClient(), {
      strictPublish: true,
    });

    await expect(publisher.publishExecutionResult(executionResult([invalid], []))).rejects.toThrow(
      'Payload failed schema validation'
    );
  });

  it('returns false summary when the client is disconnected', async () => {
    const client = publishClient({ isConnected: jest.fn(() => false) });
    const publisher = new FireflySettlementPublisher(client);

    const summary = await publisher.publishExecutionResult(executionResult());

    expect(summary.ok).toBe(false);
    expect(summary.publishFailures).toBe(1);
    expect(summary.attempted).toBe(0);
    expect(client.publish).not.toHaveBeenCalled();
  });

  it('throws publish errors in strict mode', async () => {
    const client = publishClient({
      publish: jest.fn().mockRejectedValue(new Error('NATS down')),
    });
    const publisher = new FireflySettlementPublisher(client, {
      strictPublish: true,
    });

    await expect(publisher.publishExecutionResult(executionResult([recordedEvent()], []))).rejects.toThrow(
      'NATS down'
    );
  });
});
