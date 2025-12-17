/**
 * PMOVES Event Bus
 * Handles event publishing, subscription, and routing with schema validation
 */

import { EventEmitter } from 'events';
import { SchemaValidator } from './schema-validator';

export interface EventEnvelope<T = any> {
  id: string;
  topic: string;
  timestamp: string;
  source: string;
  data: T;
  metadata?: Record<string, any>;
}

export interface EventHandler<T = any> {
  (event: EventEnvelope<T>): Promise<void> | void;
}

export interface EventBusConfig {
  validateSchemas: boolean;
  maxRetries: number;
  retryDelay: number;
  enableMetrics: boolean;
}

interface Subscription {
  topic: string;
  handler: EventHandler;
  id: string;
}

export class EventBus extends EventEmitter {
  private validator: SchemaValidator;
  private config: EventBusConfig;
  private subscriptions: Map<string, Set<Subscription>> = new Map();
  private metrics: Map<string, number> = new Map();
  private retryQueues: Map<string, EventEnvelope[]> = new Map();
  private retryTimers: Set<NodeJS.Timeout> = new Set();

  constructor(config: Partial<EventBusConfig> = {}) {
    super();
    this.setMaxListeners(100); // Increase for many subscribers

    this.config = {
      validateSchemas: true,
      maxRetries: 3,
      retryDelay: 1000,
      enableMetrics: true,
      ...config,
    };

    this.validator = new SchemaValidator();
  }

  /**
   * Initialize the event bus and load schemas
   */
  async initialize(projectRoot: string): Promise<void> {
    if (this.config.validateSchemas) {
      await this.validator.loadSchemas(projectRoot);
      console.log('[EventBus] Schema validation enabled');
    }

    console.log('[EventBus] Initialized');
  }

  /**
   * Publish an event to the bus
   */
  async publish<T = any>(
    topic: string,
    data: T,
    source: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Validate schema if enabled
    if (this.config.validateSchemas) {
      const validation = this.validator.validate(topic, data);

      if (!validation.valid) {
        const error = new Error(
          `Schema validation failed for topic ${topic}: ${JSON.stringify(validation.errors)}`
        );
        console.error('[EventBus] Validation error:', error.message);
        throw error;
      }
    }

    // Create event envelope
    const event: EventEnvelope<T> = {
      id: this.generateEventId(),
      topic,
      timestamp: new Date().toISOString(),
      source,
      data,
      metadata,
    };

    // Update metrics
    if (this.config.enableMetrics) {
      this.incrementMetric(`published.${topic}`);
      this.incrementMetric('published.total');
    }

    // Emit to subscribers
    this.emit(topic, event);
    this.emit('*', event); // Global handler

    console.log(`[EventBus] Published event to ${topic} from ${source}`);
  }

  /**
   * Subscribe to a topic
   */
  subscribe<T = any>(
    topic: string,
    handler: EventHandler<T>
  ): () => void {
    const subscription: Subscription = {
      topic,
      handler: handler as EventHandler,
      id: this.generateSubscriptionId(),
    };

    // Add to subscriptions map
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    this.subscriptions.get(topic)!.add(subscription);

    // Register event listener with error handling
    const wrappedHandler = async (event: EventEnvelope) => {
      try {
        await handler(event);

        if (this.config.enableMetrics) {
          this.incrementMetric(`handled.${topic}`);
        }
      } catch (error) {
        console.error(
          `[EventBus] Handler error for topic ${topic}:`,
          error
        );

        // Retry logic
        await this.handleFailedEvent(event, error as Error);

        if (this.config.enableMetrics) {
          this.incrementMetric(`errors.${topic}`);
        }
      }
    };

    this.on(topic, wrappedHandler);

    console.log(`[EventBus] Subscribed to ${topic}`);

    // Return unsubscribe function
    return () => {
      this.off(topic, wrappedHandler);
      this.subscriptions.get(topic)?.delete(subscription);
      console.log(`[EventBus] Unsubscribed from ${topic}`);
    };
  }

  /**
   * Subscribe to all events
   */
  subscribeAll(handler: EventHandler): () => void {
    return this.subscribe('*', handler);
  }

  /**
   * Handle failed event processing with retry
   */
  private async handleFailedEvent(
    event: EventEnvelope,
    error: Error
  ): Promise<void> {
    const retryCount = (event.metadata?.retryCount || 0) as number;

    if (retryCount < this.config.maxRetries) {
      // Add to retry queue
      if (!this.retryQueues.has(event.topic)) {
        this.retryQueues.set(event.topic, []);
      }

      event.metadata = {
        ...event.metadata,
        retryCount: retryCount + 1,
        lastError: error.message,
      };

      this.retryQueues.get(event.topic)!.push(event);

      // Schedule retry with timer tracking
      const timer = setTimeout(() => {
        this.retryTimers.delete(timer);
        this.retryEvent(event);
      }, this.config.retryDelay * Math.pow(2, retryCount)).unref(); // Exponential backoff with unref to prevent hanging

      this.retryTimers.add(timer);

      console.log(
        `[EventBus] Scheduled retry ${retryCount + 1}/${
          this.config.maxRetries
        } for event ${event.id}`
      );
    } else {
      console.error(
        `[EventBus] Event ${event.id} failed after ${this.config.maxRetries} retries`
      );
      this.emit('event:failed', { event, error });
    }
  }

  /**
   * Retry a failed event
   */
  private async retryEvent(event: EventEnvelope): Promise<void> {
    console.log(`[EventBus] Retrying event ${event.id} for topic ${event.topic}`);
    this.emit(event.topic, event);
  }

  /**
   * Get metrics
   */
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Get available topics from schema validator
   */
  getAvailableTopics(): string[] {
    return this.validator.getAvailableTopics();
  }

  /**
   * Check if topic exists
   */
  hasTopic(topic: string): boolean {
    return this.validator.hasTopic(topic);
  }

  /**
   * Increment metric counter
   */
  private incrementMetric(key: string): void {
    this.metrics.set(key, (this.metrics.get(key) || 0) + 1);
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown the event bus gracefully
   */
  async shutdown(): Promise<void> {
    console.log('[EventBus] Shutting down...');

    // Clear all pending retry timers
    console.log(`[EventBus] Clearing ${this.retryTimers.size} pending retry timers`);
    for (const timer of this.retryTimers) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();

    // Process remaining retry queues
    for (const [topic, queue] of this.retryQueues) {
      console.log(
        `[EventBus] Draining retry queue for ${topic}: ${queue.length} events`
      );
    }

    this.removeAllListeners();
    this.subscriptions.clear();
    this.retryQueues.clear();

    console.log('[EventBus] Shutdown complete');
  }
}

export default EventBus;
