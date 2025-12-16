/**
 * NATS Client for PMOVES.AI Integration
 *
 * This module provides event bus connectivity to the PMOVES.AI ecosystem
 * via NATS JetStream messaging.
 *
 * @module nats-client
 */

import { EventEmitter } from "events";

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
      url: config.url ?? process.env.NATS_URL ?? "nats://localhost:4222",
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
    // TODO: Implement actual NATS connection using nats.ws or nats package
    // For now, this is a stub that logs the connection attempt

    console.log(`[NATS] Connecting to ${this.config.url}...`);
    console.log(`[NATS] Client: ${this.config.clientName}`);
    console.log(`[NATS] JetStream: ${this.config.jetstream ? "enabled" : "disabled"}`);

    // Stub: Simulate connection
    this.connected = true;
    this.emit("connect");

    console.log("[NATS] Connected (stub mode - implement nats package for production)");
  }

  /**
   * Disconnect from NATS server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    console.log("[NATS] Disconnecting...");
    this.connected = false;
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
    if (!this.connected) {
      throw new Error("NATS client not connected");
    }

    const event: PMOVESEvent<T> = {
      subject,
      data,
      correlationId: correlationId ?? this.generateCorrelationId(),
      timestamp: new Date().toISOString(),
      source: this.config.clientName,
    };

    // TODO: Implement actual NATS publish
    console.log(`[NATS] Publishing to ${subject}:`, JSON.stringify(event, null, 2).slice(0, 200) + "...");

    this.emit("publish", event);
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
    if (!this.connected) {
      throw new Error("NATS client not connected");
    }

    // TODO: Implement actual NATS subscription
    console.log(`[NATS] Subscribed to ${subject}`);

    this.on(`message:${subject}`, handler);
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
