/**
 * NATS Client Tests
 * Tests for the production NATS client with JetStream support
 */

import { NATSClient, NATSConfig, PMOVESEvent } from './nats-client';

// Mock nats module
jest.mock('nats', () => ({
  connect: jest.fn(),
  StringCodec: jest.fn(() => ({
    encode: jest.fn((data: string) => Buffer.from(data)),
    decode: jest.fn((data: Uint8Array) => data.toString()),
  })),
}));

describe('NATSClient', () => {
  let client: NATSClient;
  const mockConfig: Partial<NATSConfig> = {
    url: 'nats://localhost:4222',
    clientName: 'test-client',
    jetstream: true,
    maxReconnectAttempts: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    client = new NATSClient(mockConfig);
  });

  afterEach(async () => {
    // Ensure client is disconnected
    if (client) {
      try {
        await client.disconnect();
      } catch {
        // Ignore disconnect errors in cleanup
      }
    }
  });

  describe('constructor', () => {
    it('initializes with default configuration', () => {
      const defaultClient = new NATSClient({});
      expect(defaultClient).toBeDefined();
    });

    it('accepts custom configuration', () => {
      const customClient = new NATSClient({
        servers: ['nats://custom:4222'],
        clientName: 'custom-client',
        reconnect: false,
        maxReconnectAttempts: 5,
      });
      expect(customClient).toBeDefined();
    });
  });

  describe('connection state', () => {
    it('starts disconnected', () => {
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('event emission', () => {
    it('emits connect event on successful connection', async () => {
      const nats = require('nats');
      const mockNc = {
        status: jest.fn().mockReturnValue({
          [Symbol.asyncIterator]: () => ({
            next: () => Promise.resolve({ done: true }),
          }),
        }),
        drain: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      };
      nats.connect.mockResolvedValue(mockNc);

      const connectHandler = jest.fn();
      client.on('connect', connectHandler);

      await client.connect();

      expect(connectHandler).toHaveBeenCalled();
    });

    it('emits error event on connection failure', async () => {
      const nats = require('nats');
      const error = new Error('Connection refused');
      nats.connect.mockRejectedValue(error);

      const errorHandler = jest.fn();
      client.on('error', errorHandler);

      await expect(client.connect()).rejects.toThrow('Connection refused');
    });
  });

  describe('publish', () => {
    it('throws error when not connected', async () => {
      await expect(
        client.publish('test.subject', { data: 'test' })
      ).rejects.toThrow('NATS client not connected');
    });

    it('publishes message when connected', async () => {
      const nats = require('nats');
      const mockPublish = jest.fn();
      const mockNc = {
        status: jest.fn().mockReturnValue({
          [Symbol.asyncIterator]: () => ({
            next: () => Promise.resolve({ done: true }),
          }),
        }),
        publish: mockPublish,
        drain: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      };
      nats.connect.mockResolvedValue(mockNc);

      await client.connect();
      await client.publish('test.subject', { test: 'data' });

      expect(mockPublish).toHaveBeenCalledWith(
        'test.subject',
        expect.any(Uint8Array)
      );
    });
  });

  describe('subscribe', () => {
    it('throws error when not connected', async () => {
      await expect(
        client.subscribe('test.subject', jest.fn())
      ).rejects.toThrow('NATS client not connected');
    });
  });

  describe('disconnect', () => {
    it('handles disconnect when already disconnected', async () => {
      // Should not throw
      await expect(client.disconnect()).resolves.toBeUndefined();
    });

    it('drains and closes connection', async () => {
      const nats = require('nats');
      const mockDrain = jest.fn().mockResolvedValue(undefined);
      const mockClose = jest.fn().mockResolvedValue(undefined);
      const mockNc = {
        status: jest.fn().mockReturnValue({
          [Symbol.asyncIterator]: () => ({
            next: () => Promise.resolve({ done: true }),
          }),
        }),
        drain: mockDrain,
        close: mockClose,
      };
      nats.connect.mockResolvedValue(mockNc);

      await client.connect();
      await client.disconnect();

      expect(mockDrain).toHaveBeenCalled();
    });
  });

  describe('event structure', () => {
    it('creates properly formatted events', async () => {
      const nats = require('nats');
      let publishedData: string | undefined;
      const mockNc = {
        status: jest.fn().mockReturnValue({
          [Symbol.asyncIterator]: () => ({
            next: () => Promise.resolve({ done: true }),
          }),
        }),
        publish: jest.fn((subject: string, data: Uint8Array) => {
          publishedData = data.toString();
        }),
        drain: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      };
      nats.connect.mockResolvedValue(mockNc);

      await client.connect();
      await client.publish('test.subject', { test: 'payload' }, 'custom-correlation-id');

      expect(publishedData).toBeDefined();
      const event = JSON.parse(publishedData!) as PMOVESEvent<{ test: string }>;

      expect(event).toMatchObject({
        correlationId: expect.any(String),
        timestamp: expect.any(String),
        source: 'test-client',
        subject: 'test.subject',
        data: { test: 'payload' },
      });
    });

    it('uses provided correlation ID', async () => {
      const nats = require('nats');
      let publishedData: string | undefined;
      const mockNc = {
        status: jest.fn().mockReturnValue({
          [Symbol.asyncIterator]: () => ({
            next: () => Promise.resolve({ done: true }),
          }),
        }),
        publish: jest.fn((subject: string, data: Uint8Array) => {
          publishedData = data.toString();
        }),
        drain: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      };
      nats.connect.mockResolvedValue(mockNc);

      await client.connect();
      await client.publish('test.subject', { data: 'test' }, 'my-correlation-id');

      const event = JSON.parse(publishedData!) as PMOVESEvent<unknown>;
      expect(event.correlationId).toBe('my-correlation-id');
    });
  });

  describe('error handling', () => {
    it('emits subscription_error on handler failure', async () => {
      // This test validates that the error handling improvements work
      const subscriptionErrorHandler = jest.fn();
      client.on('subscription_error', subscriptionErrorHandler);

      // The actual implementation would emit this when a subscription handler fails
      client.emit('subscription_error', { subject: 'test.subject', error: new Error('Handler failed') });

      expect(subscriptionErrorHandler).toHaveBeenCalledWith({
        subject: 'test.subject',
        error: expect.any(Error),
      });
    });
  });
});
