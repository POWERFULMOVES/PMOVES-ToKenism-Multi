import { CHITNATSPublisher } from '../chit/chit-nats-publisher';
import { CHIT_NATS_SUBJECTS } from '../chit';
import type { SwarmMeta } from '../chit/swarm-attribution';

const validSwarmMeta = (overrides: Partial<SwarmMeta> = {}): SwarmMeta => ({
  namespace: 'pmoves.tokenism',
  modality: 'economic_simulation',
  pack_id: 'sim-week-1',
  status: 'active',
  population_id: null,
  best_fitness: 0.75,
  metrics: { gini: 0.3 },
  ts: '2026-05-22T00:00:00Z',
  ...overrides,
});

const mockClient = (connected: boolean, publish = jest.fn().mockResolvedValue(undefined)) => ({
  isConnected: jest.fn(() => connected),
  publish,
});

describe('CHITNATSPublisher', () => {
  let consoleError: jest.SpyInstance;
  let consoleLog: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
    consoleLog.mockRestore();
    jest.clearAllMocks();
  });

  test('publishes valid payloads after schema validation', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    const client = mockClient(true, publish);
    const publisher = new CHITNATSPublisher(client as any);

    const result = await publisher.publishSwarmPopulation(validSwarmMeta(), 2);

    expect(result).toBe(true);
    expect(publish).toHaveBeenCalledWith(
      CHIT_NATS_SUBJECTS.swarmPopulation,
      expect.objectContaining({
        namespace: 'pmoves.tokenism',
        generation: 2,
        timestamp: '2026-05-22T00:00:00Z',
      }),
    );
  });

  test('publishes zero-count weekly CGP reports', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    const client = mockClient(true, publish);
    const publisher = new CHITNATSPublisher(client as any);

    const result = await publisher.publishWeeklyCGP(
      4,
      {
        spec: 'chit.cgp.v1.0',
        summary: 'No ToKenism activity for week 4',
        created_at: '2026-05-22T00:00:00Z',
        super_nodes: [],
      },
      { total_attributions: 0 },
    );

    expect(result).toBe(true);
    expect(publish).toHaveBeenCalledWith(
      CHIT_NATS_SUBJECTS.cgpWeekly,
      expect.objectContaining({
        week: 4,
        super_node_count: 0,
        total_attributions: 0,
      }),
    );
  });

  test('returns false and skips publish for validation failures by default', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    const client = mockClient(true, publish);
    const publisher = new CHITNATSPublisher(client as any);

    const result = await publisher.publishSwarmPopulation(
      validSwarmMeta({ best_fitness: 2 }),
    );

    expect(result).toBe(false);
    expect(publish).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to publish tokenism.swarm.population.v1'),
    );
  });

  test('returns false when the NATS client is disconnected by default', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    const client = mockClient(false, publish);
    const publisher = new CHITNATSPublisher(client as any);

    const result = await publisher.publishSwarmPopulation(validSwarmMeta());

    expect(result).toBe(false);
    expect(publish).not.toHaveBeenCalled();
  });

  test('throws validation and connection failures in strict mode', async () => {
    const connectedClient = mockClient(true);
    const strictPublisher = new CHITNATSPublisher(connectedClient as any, {
      strictPublish: true,
    });

    await expect(
      strictPublisher.publishSwarmPopulation(validSwarmMeta({ best_fitness: 2 })),
    ).rejects.toThrow(/schema validation/);

    const disconnectedClient = mockClient(false);
    const disconnectedPublisher = new CHITNATSPublisher(disconnectedClient as any, {
      strictPublish: true,
    });

    await expect(
      disconnectedPublisher.publishSwarmPopulation(validSwarmMeta()),
    ).rejects.toThrow(/NATS client not connected/);
  });
});
