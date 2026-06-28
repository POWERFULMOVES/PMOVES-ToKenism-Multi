/**
 * Firefly Settlement Publisher
 *
 * Publishes signed settlement result events after executor processing.
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { ErrorObject, ValidateFunction } from 'ajv';
import type {
  SettlementExecutionResultEvents,
  SettlementFailedEvent,
  SettlementRecordedEvent,
} from '../contracts/settlement-results';

export const TOKENISM_SETTLEMENT_SUBJECTS = {
  recorded: 'tokenism.settlement.recorded.v1',
  failed: 'tokenism.settlement.failed.v1',
} as const;

const SETTLEMENT_SCHEMA_FILES: Record<string, string> = {
  [TOKENISM_SETTLEMENT_SUBJECTS.recorded]: 'settlement.recorded.v1.schema.json',
  [TOKENISM_SETTLEMENT_SUBJECTS.failed]: 'settlement.failed.v1.schema.json',
};

export interface SettlementPublishClient {
  isConnected?: () => boolean;
  publish<T>(subject: string, payload: T, correlationId?: string): Promise<boolean | void>;
}

export interface FireflySettlementPublisherOptions {
  enabled?: boolean;
  strictPublish?: boolean;
}

export interface SettlementPublishSummary {
  ok: boolean;
  attempted: number;
  published: number;
  recorded: number;
  failed: number;
  validationFailures: number;
  publishFailures: number;
}

type SettlementResultEvent = SettlementRecordedEvent | SettlementFailedEvent;

export class FireflySettlementPublisher {
  private client: SettlementPublishClient;
  private enabled: boolean;
  private strictPublish: boolean;
  private static readonly validators = FireflySettlementPublisher.createValidators();

  constructor(
    client: SettlementPublishClient,
    options: FireflySettlementPublisherOptions = {}
  ) {
    this.client = client;
    this.enabled = options.enabled ?? true;
    this.strictPublish = options.strictPublish ?? false;
  }

  async publishExecutionResult(
    result: Pick<SettlementExecutionResultEvents, 'recorded' | 'failed' | 'settlement_id'>
  ): Promise<SettlementPublishSummary> {
    const summary: SettlementPublishSummary = {
      ok: true,
      attempted: 0,
      published: 0,
      recorded: 0,
      failed: 0,
      validationFailures: 0,
      publishFailures: 0,
    };

    if (!this.enabled) {
      return { ...summary, ok: false };
    }

    if (this.client.isConnected && !this.client.isConnected()) {
      return this.recordFailure(summary, 'publishFailures', new Error('NATS client not connected'));
    }

    for (const event of result.recorded) {
      await this.publishOne(TOKENISM_SETTLEMENT_SUBJECTS.recorded, event, summary);
      summary.recorded += 1;
    }

    for (const event of result.failed) {
      await this.publishOne(TOKENISM_SETTLEMENT_SUBJECTS.failed, event, summary);
      summary.failed += 1;
    }

    return summary;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private async publishOne(
    subject: string,
    event: SettlementResultEvent,
    summary: SettlementPublishSummary
  ): Promise<void> {
    summary.attempted += 1;

    const payload = JSON.parse(JSON.stringify(event)) as SettlementResultEvent;

    try {
      this.validatePayload(subject, payload);
    } catch (error) {
      this.recordFailure(summary, 'validationFailures', error);
      return;
    }

    try {
      await this.client.publish(subject, payload, event.idempotency_key);
      summary.published += 1;
    } catch (error) {
      this.recordFailure(summary, 'publishFailures', error);
    }
  }

  private recordFailure(
    summary: SettlementPublishSummary,
    counter: 'validationFailures' | 'publishFailures',
    error: unknown
  ): SettlementPublishSummary {
    summary.ok = false;
    summary[counter] += 1;
    const err = error instanceof Error ? error : new Error(String(error));

    if (this.strictPublish) {
      throw err;
    }

    console.error(`[Tokenism settlement] Publish failure: ${err.message}`);
    return summary;
  }

  private validatePayload(subject: string, payload: unknown): void {
    const validate = FireflySettlementPublisher.validators.get(subject);
    if (!validate) {
      throw new Error(`No settlement schema validator registered for ${subject}`);
    }

    if (!validate(payload)) {
      throw new Error(
        `Payload failed schema validation for ${subject}: ${this.formatValidationErrors(validate.errors)}`
      );
    }
  }

  private formatValidationErrors(errors: ErrorObject[] | null | undefined): string {
    if (!errors || errors.length === 0) {
      return 'unknown schema violation';
    }

    return errors
      .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
      .join('; ');
  }

  private static createValidators(): Map<string, ValidateFunction> {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const schemaDir = FireflySettlementPublisher.schemaDir();
    const validators = new Map<string, ValidateFunction>();

    for (const [subject, fileName] of Object.entries(SETTLEMENT_SCHEMA_FILES)) {
      const schemaPath = path.join(schemaDir, fileName);
      const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
      validators.set(subject, ajv.compile(schema));
    }

    return validators;
  }

  private static schemaDir(): string {
    const candidates = [
      path.resolve(__dirname, '../../contracts/schemas/tokenism'),
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
}

export function createFireflySettlementPublisher(
  client: SettlementPublishClient,
  options: FireflySettlementPublisherOptions = {}
): FireflySettlementPublisher {
  return new FireflySettlementPublisher(client, options);
}

export default FireflySettlementPublisher;
