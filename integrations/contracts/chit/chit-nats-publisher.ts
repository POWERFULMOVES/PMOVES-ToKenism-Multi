/**
 * CHIT NATS Publisher
 *
 * Publishes CHIT events to the PMOVES.AI event bus via NATS.
 * Connects the CHIT attribution system to the GEOMETRY BUS.
 *
 * @module chit-nats-publisher
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { ErrorObject, ValidateFunction } from 'ajv';
import { NATSClient } from '../../nats/nats-client';
import type { SwarmMeta, ToKenismMetrics } from './swarm-attribution';
import type { AttributionRecord } from './shape-attribution';
import type { CGPDocument } from './cgp-generator';

const CHIT_PUBLISH_SUBJECTS = {
  attributionRecorded: 'tokenism.attribution.recorded.v1',
  cgpWeekly: 'tokenism.cgp.weekly.v1',
  cgpReady: 'tokenism.cgp.ready.v1',
  swarmPopulation: 'tokenism.swarm.population.v1',
} as const;

const TOKENISM_SCHEMA_FILES: Record<string, string> = {
  [CHIT_PUBLISH_SUBJECTS.attributionRecorded]: 'attribution.recorded.v1.schema.json',
  [CHIT_PUBLISH_SUBJECTS.cgpWeekly]: 'cgp.weekly.v1.schema.json',
  [CHIT_PUBLISH_SUBJECTS.cgpReady]: 'cgp.ready.v1.schema.json',
  [CHIT_PUBLISH_SUBJECTS.swarmPopulation]: 'swarm.population.v1.schema.json',
};

export interface CHITPublisherOptions {
  enabled?: boolean;
  strictPublish?: boolean;
}

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
 * CGP ready event payload
 */
export interface CGPReadyPayload {
  cgp: CGPDocument;
  super_node_count: number;
  week?: number;
  source: string;
  cgp_spec: string;
  timestamp: string;
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
  private strictPublish: boolean;
  private static readonly validators = CHITNATSPublisher.createValidators();

  constructor(client: NATSClient, enabledOrOptions: boolean | CHITPublisherOptions = true) {
    this.client = client;
    if (typeof enabledOrOptions === 'boolean') {
      this.enabled = enabledOrOptions;
      this.strictPublish = false;
    } else {
      this.enabled = enabledOrOptions.enabled ?? true;
      this.strictPublish = enabledOrOptions.strictPublish ?? false;
    }
  }

  /**
   * Locate tokenism schema files from source or built output.
   */
  private static schemaDir(): string {
    const candidates = [
      path.resolve(__dirname, '../../../contracts/schemas/tokenism'),
      path.resolve(process.cwd(), '../contracts/schemas/tokenism'),
      path.resolve(process.cwd(), 'contracts/schemas/tokenism'),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    return candidates[0];
  }

  private static createValidators(): Map<string, ValidateFunction> {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const schemaDir = CHITNATSPublisher.schemaDir();
    const validators = new Map<string, ValidateFunction>();

    for (const [subject, fileName] of Object.entries(TOKENISM_SCHEMA_FILES)) {
      const schemaPath = path.join(schemaDir, fileName);
      const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
      validators.set(subject, ajv.compile(schema));
    }

    return validators;
  }

  private formatValidationErrors(errors: ErrorObject[] | null | undefined): string {
    if (!errors || errors.length === 0) {
      return 'unknown schema violation';
    }

    return errors
      .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
      .join('; ');
  }

  private validatePayload(subject: string, payload: unknown): void {
    const validate = CHITNATSPublisher.validators.get(subject);
    if (!validate) {
      throw new Error(`No CHIT schema validator registered for ${subject}`);
    }

    if (!validate(payload)) {
      throw new Error(
        `Payload failed schema validation for ${subject}: ${this.formatValidationErrors(validate.errors)}`
      );
    }
  }

  private fail(subject: string, error: unknown): false {
    const err = error instanceof Error ? error : new Error(String(error));
    if (this.strictPublish) {
      throw err;
    }

    console.error(`[CHIT] Failed to publish ${subject}: ${err.message}`);
    return false;
  }

  private async publishValidated<T>(
    subject: string,
    payload: T,
    successMessage: string,
  ): Promise<boolean> {
    if (!this.enabled) {
      console.log(`[CHIT] Skipping ${subject} publish (disabled)`);
      return false;
    }

    if (!this.client.isConnected()) {
      return this.fail(subject, new Error('NATS client not connected'));
    }

    try {
      const cleanPayload = JSON.parse(JSON.stringify(payload)) as T;
      this.validatePayload(subject, cleanPayload);
      await this.client.publish(subject, cleanPayload);
      console.log(successMessage);
      return true;
    } catch (error) {
      return this.fail(subject, error);
    }
  }

  /**
   * Publish swarm population update
   *
   * Subject: tokenism.swarm.population.v1
   */
  async publishSwarmPopulation(
    meta: SwarmMeta,
    generation?: number
  ): Promise<boolean> {
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

    return this.publishValidated(
      CHIT_PUBLISH_SUBJECTS.swarmPopulation,
      payload,
      `[CHIT] Published swarm population: ${meta.pack_id}`,
    );
  }

  /**
   * Publish attribution recorded event
   *
   * Subject: tokenism.attribution.recorded.v1
   */
  async publishAttributionRecorded(
    record: AttributionRecord
  ): Promise<boolean> {
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

    return this.publishValidated(
      CHIT_PUBLISH_SUBJECTS.attributionRecorded,
      payload,
      `[CHIT] Published attribution recorded: ${record.chitId} (${record.action})`,
    );
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
  ): Promise<boolean> {
    const payload: CGPWeeklyPayload = {
      week,
      cgp,
      super_node_count: cgp.super_nodes?.length || 0,
      total_attributions: metrics?.total_attributions || 0,
      gini: metrics?.gini,
      poverty_rate: metrics?.poverty_rate,
      cgp_spec: cgp.spec,
    };

    return this.publishValidated(
      CHIT_PUBLISH_SUBJECTS.cgpWeekly,
      payload,
      `[CHIT] Published CGP weekly: week ${week}`,
    );
  }

  /**
   * Publish CGP ready event (for immediate consumption)
   *
   * Subject: tokenism.cgp.ready.v1
   */
  async publishCGPReady(
    cgp: CGPDocument,
    metadata?: { week?: number; source?: string }
  ): Promise<boolean> {
    const payload: CGPReadyPayload = {
      cgp,
      super_node_count: cgp.super_nodes?.length || 0,
      week: metadata?.week,
      source: metadata?.source || 'chit-publisher',
      cgp_spec: cgp.spec,
      timestamp: new Date().toISOString(),
    };

    return this.publishValidated(
      CHIT_PUBLISH_SUBJECTS.cgpReady,
      payload,
      `[CHIT] Published CGP ready: ${cgp.summary?.slice(0, 50)}...`,
    );
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
export function createCHITPublisher(
  client: NATSClient,
  options: boolean | CHITPublisherOptions = true,
): CHITNATSPublisher {
  return new CHITNATSPublisher(client, options);
}

export default CHITNATSPublisher;
