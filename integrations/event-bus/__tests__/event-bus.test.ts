/**
 * Event Bus Tests
 */

import { EventBus } from '../event-bus';
import path from 'path';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus({
      validateSchemas: false, // Disable for unit tests
      maxRetries: 3,
      enableMetrics: true,
    });
  });

  afterEach(async () => {
    await eventBus.shutdown();
  });

  describe('publish and subscribe', () => {
    it('should publish and receive events', async () => {
      const received: any[] = [];

      eventBus.subscribe('test.topic', async (event) => {
        received.push(event);
      });

      await eventBus.publish('test.topic', { foo: 'bar' }, 'test-source');

      expect(received).toHaveLength(1);
      expect(received[0].topic).toBe('test.topic');
      expect(received[0].source).toBe('test-source');
      expect(received[0].data).toEqual({ foo: 'bar' });
    });

    it('should support multiple subscribers', async () => {
      const received1: any[] = [];
      const received2: any[] = [];

      eventBus.subscribe('test.topic', async (event) => {
        received1.push(event);
      });

      eventBus.subscribe('test.topic', async (event) => {
        received2.push(event);
      });

      await eventBus.publish('test.topic', { foo: 'bar' }, 'test-source');

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
    });

    it('should support wildcard subscription', async () => {
      const received: any[] = [];

      eventBus.subscribeAll(async (event) => {
        received.push(event);
      });

      await eventBus.publish('topic1', { foo: 'bar' }, 'test-source');
      await eventBus.publish('topic2', { baz: 'qux' }, 'test-source');

      expect(received).toHaveLength(2);
      expect(received[0].topic).toBe('topic1');
      expect(received[1].topic).toBe('topic2');
    });

    it('should support unsubscribe', async () => {
      const received: any[] = [];

      const unsubscribe = eventBus.subscribe('test.topic', async (event) => {
        received.push(event);
      });

      await eventBus.publish('test.topic', { foo: 'bar' }, 'test-source');

      unsubscribe();

      await eventBus.publish('test.topic', { foo: 'baz' }, 'test-source');

      expect(received).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should handle handler errors with retry', async () => {
      let callCount = 0;

      eventBus.subscribe('test.topic', async () => {
        callCount++;
        throw new Error('Handler error');
      });

      await eventBus.publish('test.topic', { foo: 'bar' }, 'test-source');

      // Give time for retries (increased timeout for CI environments)
      await new Promise((resolve) => setTimeout(resolve, 15000));

      // Should have called initial + retries
      expect(callCount).toBeGreaterThan(1);
    }, 30000); // 30 second test timeout

    it('should emit event:failed after max retries', async () => {
      let failedEvent: any = null;

      eventBus.on('event:failed', ({ event }) => {
        failedEvent = event;
      });

      eventBus.subscribe('test.topic', async () => {
        throw new Error('Persistent error');
      });

      await eventBus.publish('test.topic', { foo: 'bar' }, 'test-source');

      // Give time for all retries (increased timeout for CI environments)
      await new Promise((resolve) => setTimeout(resolve, 20000));

      expect(failedEvent).not.toBeNull();
      expect(failedEvent.topic).toBe('test.topic');
    }, 45000); // 45 second test timeout
  });

  describe('metrics', () => {
    it('should track published events', async () => {
      await eventBus.publish('topic1', { foo: 'bar' }, 'test-source');
      await eventBus.publish('topic2', { baz: 'qux' }, 'test-source');

      const metrics = eventBus.getMetrics();

      expect(metrics['published.total']).toBe(2);
      expect(metrics['published.topic1']).toBe(1);
      expect(metrics['published.topic2']).toBe(1);
    });

    it('should track handled events', async () => {
      eventBus.subscribe('test.topic', async () => {
        // Handler
      });

      await eventBus.publish('test.topic', { foo: 'bar' }, 'test-source');

      const metrics = eventBus.getMetrics();

      expect(metrics['handled.test.topic']).toBe(1);
    });

    it('should reset metrics', async () => {
      await eventBus.publish('test.topic', { foo: 'bar' }, 'test-source');

      eventBus.resetMetrics();

      const metrics = eventBus.getMetrics();

      expect(Object.keys(metrics)).toHaveLength(0);
    });
  });

  describe('schema validation', () => {
    it('should validate schemas when enabled', async () => {
      const validatingBus = new EventBus({
        validateSchemas: true,
        maxRetries: 3,
      });

      await validatingBus.initialize(path.join(__dirname, '../../..'));

      // This should pass if schema exists
      await expect(
        validatingBus.publish(
          'finance.monthly.summary.v1',
          {
            namespace: 'test',
            month: '2025-11',
            totals: {
              income: 5000,
              spend: 3000,
            },
          },
          'test-source'
        )
      ).resolves.not.toThrow();

      await validatingBus.shutdown();
    });

    it('should reject invalid data when validation enabled', async () => {
      const validatingBus = new EventBus({
        validateSchemas: true,
        maxRetries: 3,
      });

      await validatingBus.initialize(path.join(__dirname, '../../..'));

      // This should fail - missing required fields
      await expect(
        validatingBus.publish(
          'finance.monthly.summary.v1',
          {
            namespace: 'test',
            // Missing 'month' and 'totals'
          },
          'test-source'
        )
      ).rejects.toThrow();

      await validatingBus.shutdown();
    });
  });
});
