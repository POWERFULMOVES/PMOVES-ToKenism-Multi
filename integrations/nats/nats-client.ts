/**
 * NATS Client for PMOVES.AI Integration
 *
 * This module provides event bus connectivity to the PMOVES.AI ecosystem
 * via NATS JetStream messaging.
 *
 * @module nats-client
 */

import { EventEmitter } from "events";
import { connect, NatsConnection, StringCodec, Subscription } from "nats";

/**
 * NATS connection configuration
 */
export interface NATSConfig {
  /** NATS server URL (default: nats://localhost:4222) */
  url: string;
  /** Client name for identification */
  clientName: string;
  /** Enable JetStream for durable messaging */
  jetstream: boolean;
  /** Reconnect attempts before giving up */
  maxReconnectAttempts: number;
}

/**
 * Event payload structure for PMOVES.AI events
 */
export interface PMOVESEvent<T = unknown> {
  /** Event type/subject */
  subject: string;
  /** Event payload data */
  data: T;
  /** Correlation ID for tracing */
  correlationId: string;
  /** ISO timestamp */
  timestamp: string;
  /** Source service identifier */
  source: string;
}

/**
 * Simulation result event payload
 */
export interface SimulationResultEvent {
  simulationId: string;
  scenario: string;
  weeklyHistory: Array<{
    week: number;
    avgWealth: number;
    gini: number;
    povertyRate: number;
  }>;
  finalMetrics: {
    totalWealth: number;
    wealthGap: number;
    economicVelocity: number;
  };
  parameters: Record<string, number>;
}

/**
 * NATS Client for PMOVES.AI event bus integration
 *
 * @example
 * ```typescript
 * const client = new NATSClient({
 *   url: 'nats://localhost:4222',
 *   clientName: 'tokenism-multi',
 *   jetstream: true,
 *   maxReconnectAttempts: 10
 * });
 *
 * await client.connect();
 *
 * // Publish simulation results
 * await client.publishSimulationResult({
 *   simulationId: 'sim-123',
 *   scenario: 'baseline',
 *   weeklyHistory: [...],
 *   finalMetrics: {...},
 *   parameters: {...}
 * });
 *
 * // Subscribe to research requests
 * client.subscribe('research.deepresearch.request.v1', (event) => {
 *   console.log('Research request:', event.data);
 * });
 * ```
 */
export class NATSClient extends EventEmitter {
  private config: NATSConfig;
  private connected: boolean = false;
  private nc: NatsConnection | null = null;
  private sc = StringCodec();
  private subscriptions: Map<string, Subscription> = new Map();

  /** NATS subjects for PMOVES.AI integration */
  static readonly SUBJECTS = {
    /** Publish simulation results */
    SIMULATION_RESULT: "tokenism.simulation.result.v1",
    /** Publish calibration results */
    CALIBRATION_RESULT: "tokenism.calibration.result.v1",
    /** Subscribe to research requests */
    RESEARCH_REQUEST: "research.deepresearch.request.v1",
    /** Subscribe to SupaSerch requests */
    SUPASERCH_REQUEST: "supaserch.request.v1",
  } as const;

  constructor(config: Partial<NATSConfig> = {}) {
    super();
    this.config = {
      url: config.url ?? process.env.NATS_URL ?? "nats://nats:pmoves@nats:4222",
      clientName: config.clientName ?? "pmoves-tokenism-multi",
      jetstream: config.jetstream ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
    };
  }

  /**
   * Connect to NATS server
   *
   * @throws Error if connection fails after max attempts
   */
  async connect(): Promise<void> {
    if (this.connected && this.nc) {
      console.log("[NATS] Already connected");
      return;
    }

    console.log(`[NATS] Connecting to ${this.config.url}...`);
    console.log(`[NATS] Client: ${this.config.clientName}`);
    console.log(`[NATS] JetStream: ${this.config.jetstream ? "enabled" : "disabled"}`);

    try {
      this.nc = await connect({
        servers: this.config.url,
        name: this.config.clientName,
        maxReconnectAttempts: this.config.maxReconnectAttempts,
      });

      this.connected = true;
      this.emit("connect");

      console.log("[NATS] Connected successfully");

      // Handle connection events
      this.setupConnectionHandlers();
    } catch (error) {
      console.error("[NATS] Connection failed:", error);
      throw new Error(`Failed to connect to NATS: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionHandlers(): void {
    if (!this.nc) return;

    (async () => {
      for await (const status of this.nc!.status()) {
        switch (status.type) {
          case "disconnect":
            console.log("[NATS] Disconnected");
            this.emit("disconnect");
            break;
          case "reconnect":
            console.log("[NATS] Reconnected");
            this.emit("reconnect");
            break;
          case "error":
            console.error("[NATS] Error:", status.data);
            this.emit("error", status.data);
            break;
        }
      }
    })().catch((err) => {
      console.error("[NATS] Status handler error:", err);
      // Security: Emit error instead of swallowing it
      this.emit("error", err);
    });
  }

  /**
   * Disconnect from NATS server
   */
  async disconnect(): Promise<void> {
    if (!this.connected || !this.nc) return;

    console.log("[NATS] Disconnecting...");

    // Close all subscriptions
    for (const [subject, sub] of this.subscriptions.entries()) {
      try {
        await sub.drain();
        console.log(`[NATS] Drained subscription: ${subject}`);
      } catch (error) {
        console.error(`[NATS] Error draining subscription ${subject}:`, error);
      }
    }
    this.subscriptions.clear();

    // Close NATS connection
    try {
      await this.nc.drain();
      console.log("[NATS] Connection drained");
    } catch (error) {
      console.error("[NATS] Error draining connection:", error);
    }

    this.connected = false;
    this.nc = null;
    this.emit("disconnect");
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Publish an event to NATS
   *
   * @param subject - NATS subject to publish to
   * @param data - Event payload
   * @param correlationId - Optional correlation ID for tracing
   */
  async publish<T>(subject: string, data: T, correlationId?: string): Promise<void> {
    if (!this.connected || !this.nc) {
      throw new Error("NATS client not connected");
    }

    const event: PMOVESEvent<T> = {
      subject,
      data,
      correlationId: correlationId ?? this.generateCorrelationId(),
      timestamp: new Date().toISOString(),
      source: this.config.clientName,
    };

    try {
      const payload = this.sc.encode(JSON.stringify(event));
      this.nc.publish(subject, payload);

      console.log(`[NATS] Published to ${subject}:`, {
        correlationId: event.correlationId,
        timestamp: event.timestamp,
        dataPreview: JSON.stringify(event.data).slice(0, 100) + "...",
      });

      this.emit("publish", event);
    } catch (error) {
      console.error(`[NATS] Failed to publish to ${subject}:`, error);
      throw new Error(`Failed to publish message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Publish simulation result to PMOVES.AI
   *
   * @param result - Simulation result data
   */
  async publishSimulationResult(result: SimulationResultEvent): Promise<void> {
    await this.publish(NATSClient.SUBJECTS.SIMULATION_RESULT, result);
  }

  /**
   * Subscribe to a NATS subject
   *
   * @param subject - NATS subject to subscribe to
   * @param handler - Callback function for received messages
   */
  subscribe<T>(subject: string, handler: (event: PMOVESEvent<T>) => void): void {
    if (!this.connected || !this.nc) {
      throw new Error("NATS client not connected");
    }

    // Check if already subscribed
    if (this.subscriptions.has(subject)) {
      console.log(`[NATS] Already subscribed to ${subject}`);
      return;
    }

    try {
      const sub = this.nc.subscribe(subject);
      this.subscriptions.set(subject, sub);

      console.log(`[NATS] Subscribed to ${subject}`);

      // Process messages asynchronously
      (async () => {
        for await (const msg of sub) {
          try {
            const payload = this.sc.decode(msg.data);
            const event: PMOVESEvent<T> = JSON.parse(payload);

            console.log(`[NATS] Received message on ${subject}:`, {
              correlationId: event.correlationId,
              timestamp: event.timestamp,
              source: event.source,
            });

            handler(event);
            this.emit(`message:${subject}`, event);
          } catch (error) {
            console.error(`[NATS] Error processing message on ${subject}:`, error);
            this.emit("error", error);
          }
        }
      })().catch((err) => {
        console.error(`[NATS] Subscription handler error for ${subject}:`, err);
        this.subscriptions.delete(subject);
        // Security: Emit error instead of swallowing it
        this.emit("error", err);
        this.emit("subscription_error", { subject, error: err });
      });
    } catch (error) {
      console.error(`[NATS] Failed to subscribe to ${subject}:`, error);
      throw new Error(`Failed to subscribe: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate a correlation ID for event tracing
   */
  private generateCorrelationId(): string {
    return `${this.config.clientName}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

/**
 * Default NATS client instance
 *
 * @example
 * ```typescript
 * import { natsClient } from './nats-client';
 *
 * await natsClient.connect();
 * await natsClient.publishSimulationResult({...});
 * ```
 */
export const natsClient = new NATSClient();

export default NATSClient;
