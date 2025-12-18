/**
 * CHIT NATS Publisher
 *
 * Publishes CHIT events to the PMOVES.AI event bus via NATS.
 * Connects the CHIT attribution system to the GEOMETRY BUS.
 *
 * @module chit-nats-publisher
 */

import { NATSClient } from '../../nats/nats-client';
import { CHIT_NATS_SUBJECTS } from './index';
import type { SwarmMeta, ToKenismMetrics } from './swarm-attribution';
import type { AttributionRecord } from './shape-attribution';
import type { CGPDocument } from './cgp-generator';

/**
 * Swarm population event payload
 */
export interface SwarmPopulationPayload {
  namespace: string;
  modality: string;
  pack_id: string;
  status: string;
  population_id?: string | null;
  generation?: number;
  best_fitness?: number | null;
  metrics?: ToKenismMetrics | Record<string, unknown> | null;
  timestamp: string;
}

/**
 * Attribution recorded event payload
 */
export interface AttributionRecordedPayload {
  chit_id: string;
  address: string;
  action: string;
  amount: number;
  week: number;
  category?: string;
  merkle_root?: string;
  timestamp: string;
}

/**
 * Weekly CGP event payload
 */
export interface CGPWeeklyPayload {
  week: number;
  cgp: CGPDocument;
  super_node_count: number;
  total_attributions: number;
  gini?: number;
  poverty_rate?: number;
  cgp_spec?: string;
}

/**
 * CHIT NATS Publisher
 *
 * Provides methods to publish CHIT events to the PMOVES.AI NATS bus.
 *
 * @example
 * ```typescript
 * const publisher = new CHITNATSPublisher(natsClient);
 *
 * // Publish swarm population update
 * await publisher.publishSwarmPopulation(swarmMeta);
 *
 * // Publish attribution recorded
 * await publisher.publishAttributionRecorded(attributionRecord);
 *
 * // Publish weekly CGP
 * await publisher.publishWeeklyCGP(week, cgpDocument, metrics);
 * ```
 */
export class CHITNATSPublisher {
  private client: NATSClient;
  private enabled: boolean;

  constructor(client: NATSClient, enabled = true) {
    this.client = client;
    this.enabled = enabled;
  }

  /**
   * Check if publishing is enabled and client is connected
   */
  private canPublish(): boolean {
    return this.enabled && this.client.isConnected();
  }

  /**
   * Publish swarm population update
   *
   * Subject: tokenism.swarm.population.v1
   */
  async publishSwarmPopulation(
    meta: SwarmMeta,
    generation?: number
  ): Promise<void> {
    if (!this.canPublish()) {
      console.log('[CHIT] Skipping swarm population publish (disabled or disconnected)');
      return;
    }

    const payload: SwarmPopulationPayload = {
      namespace: meta.namespace,
      modality: meta.modality,
      pack_id: meta.pack_id,
      status: meta.status,
      population_id: meta.population_id,
      generation: generation,
      best_fitness: meta.best_fitness,
      metrics: meta.metrics,
      timestamp: meta.ts || new Date().toISOString(),
    };

    try {
      await this.client.publish(
        CHIT_NATS_SUBJECTS.swarmPopulation,
        payload
      );
      console.log(`[CHIT] Published swarm population: ${meta.pack_id}`);
    } catch (error) {
      console.error('[CHIT] Failed to publish swarm population:', error);
      // Best-effort: don't throw
    }
  }

  /**
   * Publish attribution recorded event
   *
   * Subject: tokenism.attribution.recorded.v1
   */
  async publishAttributionRecorded(
    record: AttributionRecord
  ): Promise<void> {
    if (!this.canPublish()) {
      console.log('[CHIT] Skipping attribution publish (disabled or disconnected)');
      return;
    }

    const payload: AttributionRecordedPayload = {
      chit_id: record.chitId,
      address: record.address,
      action: record.action,
      amount: record.amount,
      week: record.week,
      category: record.category,
      merkle_root: record.proof?.merkleRoot,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.client.publish(
        CHIT_NATS_SUBJECTS.attributionRecorded,
        payload
      );
      console.log(`[CHIT] Published attribution recorded: ${record.chitId} (${record.action})`);
    } catch (error) {
      console.error('[CHIT] Failed to publish attribution:', error);
      // Best-effort: don't throw
    }
  }

  /**
   * Publish weekly CGP document
   *
   * Subject: tokenism.cgp.weekly.v1
   */
  async publishWeeklyCGP(
    week: number,
    cgp: CGPDocument,
    metrics?: { gini?: number; poverty_rate?: number; total_attributions?: number }
  ): Promise<void> {
    if (!this.canPublish()) {
      console.log('[CHIT] Skipping CGP weekly publish (disabled or disconnected)');
      return;
    }

    const payload: CGPWeeklyPayload = {
      week,
      cgp,
      super_node_count: cgp.super_nodes?.length || 0,
      total_attributions: metrics?.total_attributions || 0,
      gini: metrics?.gini,
      poverty_rate: metrics?.poverty_rate,
      cgp_spec: cgp.spec,
    };

    try {
      await this.client.publish(
        CHIT_NATS_SUBJECTS.cgpWeekly,
        payload
      );
      console.log(`[CHIT] Published CGP weekly: week ${week}`);
    } catch (error) {
      console.error('[CHIT] Failed to publish CGP weekly:', error);
      // Best-effort: don't throw
    }
  }

  /**
   * Publish CGP ready event (for immediate consumption)
   *
   * Subject: tokenism.cgp.ready.v1
   */
  async publishCGPReady(
    cgp: CGPDocument,
    metadata?: { week?: number; source?: string }
  ): Promise<void> {
    if (!this.canPublish()) {
      console.log('[CHIT] Skipping CGP ready publish (disabled or disconnected)');
      return;
    }

    const payload = {
      cgp,
      super_node_count: cgp.super_nodes?.length || 0,
      week: metadata?.week,
      source: metadata?.source || 'chit-publisher',
      cgp_spec: cgp.spec,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.client.publish(
        CHIT_NATS_SUBJECTS.cgpReady,
        payload
      );
      console.log(`[CHIT] Published CGP ready: ${cgp.summary?.slice(0, 50)}...`);
    } catch (error) {
      console.error('[CHIT] Failed to publish CGP ready:', error);
      // Best-effort: don't throw
    }
  }

  /**
   * Enable or disable publishing
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if publisher is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Create a CHIT NATS publisher with the default client
 */
export function createCHITPublisher(client: NATSClient): CHITNATSPublisher {
  return new CHITNATSPublisher(client);
}

export default CHITNATSPublisher;
